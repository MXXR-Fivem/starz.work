import fs from "node:fs/promises";
import path from "node:path";
import type { RowDataPacket } from "mysql2/promise";

import pool from "../config/database";

interface MigrationRow extends RowDataPacket {
	name: string;
}

type DbError = Error & { code?: string };

const MIGRATIONS_TABLE = "schema_migrations";

const resolveMigrationsDir = async (): Promise<string | null> => {
	const candidates = [
		path.resolve(process.cwd(), "../database/migrations"),
		path.resolve(process.cwd(), "database/migrations")
	];

	for (const candidate of candidates) {
		try {
			const stat = await fs.stat(candidate);

			if (stat.isDirectory()) {
				return candidate;
			}
		} catch (_error) {
			continue;
		}
	}

	return null;
};

const splitSqlStatements = (sql: string): string[] =>
	sql
		.split(";")
		.map((statement) => statement.trim())
		.filter(Boolean);

const isAlreadyEffectiveError = (error: unknown): boolean => {
	const dbError = error as DbError | null;
	return dbError?.code === "ER_DUP_FIELDNAME" || dbError?.code === "ER_DUP_KEYNAME";
};

const ensureMigrationsTable = async (): Promise<boolean> => {
	try {
		await pool.query(`
			CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
				name VARCHAR(255) NOT NULL,
				applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
				PRIMARY KEY (name)
			) ENGINE=InnoDB
		`);
		return true;
	} catch (error) {
		console.warn("[migrations] unable to ensure migrations table; skipping migrations", error);
		return false;
	}
};

const loadAppliedMigrationNames = async (): Promise<Set<string>> => {
	const [rows] = await pool.query<MigrationRow[]>(`SELECT name FROM ${MIGRATIONS_TABLE}`);
	return new Set(rows.map((row) => row.name));
};

const markMigrationApplied = async (name: string): Promise<void> => {
	await pool.query(`INSERT IGNORE INTO ${MIGRATIONS_TABLE} (name) VALUES (?)`, [name]);
};

const runMigration = async (name: string, sql: string): Promise<void> => {
	const statements = splitSqlStatements(sql);

	if (statements.length === 0) {
		await markMigrationApplied(name);
		return;
	}

	for (const statement of statements) {
		await pool.query(statement);
	}

	await markMigrationApplied(name);
	console.log(`[migrations] applied ${name}`);
};

export const runStartupMigrations = async (): Promise<void> => {
	if ((process.env.DB_AUTO_MIGRATIONS ?? "true").toLowerCase() === "false") {
		console.log("[migrations] skipped because DB_AUTO_MIGRATIONS=false");
		return;
	}

	const migrationsDir = await resolveMigrationsDir();

	if (!migrationsDir) {
		console.log("[migrations] no migrations directory found");
		return;
	}

	if (!(await ensureMigrationsTable())) {
		return;
	}

	let appliedMigrations: Set<string>;
	let migrationFiles: string[];

	try {
		appliedMigrations = await loadAppliedMigrationNames();
		migrationFiles = (await fs.readdir(migrationsDir))
			.filter((file) => file.endsWith(".sql"))
			.sort();
	} catch (error) {
		console.warn("[migrations] unable to list migrations; skipping migrations", error);
		return;
	}

	for (const migrationFile of migrationFiles) {
		if (appliedMigrations.has(migrationFile)) {
			continue;
		}

		try {
			const sql = await fs.readFile(path.join(migrationsDir, migrationFile), "utf8");
			await runMigration(migrationFile, sql);
		} catch (error) {
			if (isAlreadyEffectiveError(error)) {
				console.warn(`[migrations] ${migrationFile} already effective; marking as applied`);
				await markMigrationApplied(migrationFile).catch((markError) => {
					console.warn(`[migrations] unable to mark ${migrationFile} as applied`, markError);
				});
				continue;
			}

			console.warn(`[migrations] failed ${migrationFile}; continuing startup`, error);
		}
	}
};
