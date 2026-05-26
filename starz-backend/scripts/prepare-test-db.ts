import fs from "node:fs";
import path from "node:path";

import mysql from "mysql2/promise";

const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false, quiet: true });

const projectRoot = path.resolve(process.cwd(), "..");
const initSqlPath = path.join(projectRoot, "database/init.sql");
const seedSqlPath = path.join(projectRoot, "database/seeds/test.sql");

const testDbName = process.env.TEST_DB_NAME ?? "job_aggregator_test";
const adminUser = process.env.TEST_DB_ADMIN_USER ?? "root";
const adminPassword = process.env.TEST_DB_ADMIN_PASSWORD ?? process.env.TEST_DB_PASSWORD ?? "root";
const testDbUser = process.env.TEST_DB_USER ?? "root";
const testDbPassword = process.env.TEST_DB_PASSWORD ?? "root";

const assertSafeDatabaseName = (databaseName: string): void => {
	if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
		throw new Error("TEST_DB_NAME must contain only letters, numbers and underscores");
	}

	if (databaseName === "job_aggregator" || !databaseName.endsWith("_test")) {
		throw new Error("TEST_DB_NAME must be a dedicated test database ending with _test");
	}
};

const readSqlForTestDatabase = (filePath: string): string =>
	fs.readFileSync(filePath, "utf8").replace(/\bjob_aggregator\b/g, testDbName);

const main = async (): Promise<void> => {
	assertSafeDatabaseName(testDbName);

	const connection = await mysql.createConnection({
		host: process.env.TEST_DB_HOST ?? process.env.DB_HOST ?? "localhost",
		port: Number(process.env.TEST_DB_PORT ?? process.env.DB_PORT ?? 3307),
		user: adminUser,
		password: adminPassword,
		multipleStatements: true
	});

	try {
		console.log(`[test-db] dropping and recreating ${testDbName}`);
		await connection.query(`DROP DATABASE IF EXISTS ${mysql.escapeId(testDbName)}`);
		await connection.query(readSqlForTestDatabase(initSqlPath));

		if (testDbUser !== adminUser) {
			await connection.query(
				`CREATE USER IF NOT EXISTS ${mysql.escape(testDbUser)}@'%' IDENTIFIED BY ${mysql.escape(testDbPassword)}`
			);
			await connection.query(
				`GRANT ALL PRIVILEGES ON ${mysql.escapeId(testDbName)}.* TO ${mysql.escape(testDbUser)}@'%'`
			);
			await connection.query("FLUSH PRIVILEGES");
		}

		await connection.query(readSqlForTestDatabase(seedSqlPath));
		console.log(`[test-db] ${testDbName} ready`);
	} finally {
		await connection.end();
	}
};

void main().catch((error) => {
	console.error("[test-db] failed to prepare test database", error);
	process.exit(1);
});
