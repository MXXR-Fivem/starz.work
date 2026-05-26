import mysql, { type Pool } from "mysql2/promise";

const pool: Pool = mysql.createPool({
	host: process.env.DB_HOST ?? "localhost",
	port: Number(process.env.DB_PORT ?? 3307),
	user: process.env.DB_USER ?? "app",
	password: process.env.DB_PASSWORD ?? "app",
	database: process.env.DB_NAME ?? "job_aggregator",
	waitForConnections: (process.env.DB_WAIT_FOR_CONNECTIONS ?? "true") === "true",
	connectionLimit: Number(process.env.DB_CONNECTION_LIMIT ?? 10),
	queueLimit: Number(process.env.DB_QUEUE_LIMIT ?? 0)
});

export default pool;
