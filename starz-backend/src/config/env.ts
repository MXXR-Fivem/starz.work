import fs from "node:fs";
import path from "node:path";

const dotenv = require("dotenv");

const ENV_PATHS = [
	path.resolve(process.cwd(), ".env")
];

for (const envPath of ENV_PATHS) {
	if (!fs.existsSync(envPath)) {
		continue;
	}

	dotenv.config({ path: envPath, override: false, quiet: true });
}

if (!process.env.DB_HOST) {
	process.env.DB_HOST = "localhost";
}

if (!process.env.DB_PORT) {
	process.env.DB_PORT = "3307";
}

if (!process.env.DB_NAME && process.env.MYSQL_DATABASE) {
	process.env.DB_NAME = process.env.MYSQL_DATABASE;
}

if (!process.env.DB_USER) {
	process.env.DB_USER = process.env.MYSQL_USER ?? "app";
}

if (!process.env.DB_PASSWORD) {
	process.env.DB_PASSWORD = process.env.MYSQL_PASSWORD ?? "app";
}

const isProduction = process.env.NODE_ENV === "production";
const jwtSecret = process.env.JWT_SECRET?.trim();
const weakJwtSecrets = new Set(["change_me", "changeme", "secret", "jwt_secret"]);

if (isProduction && (!jwtSecret || jwtSecret.length < 32 || weakJwtSecrets.has(jwtSecret.toLowerCase()))) {
	throw new Error("JWT_SECRET must be configured with a strong value in production");
}

if (isProduction && (!process.env.DB_PASSWORD || process.env.DB_PASSWORD === "app")) {
	throw new Error("DB_PASSWORD must be configured with a non-default value in production");
}
