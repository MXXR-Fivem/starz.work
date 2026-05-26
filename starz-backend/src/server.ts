import "./config/env";

import app from "./app";
import pool from "./config/database";
import { isSwaggerEnabled } from "./config/swagger";
import { runStartupMigrations } from "./services/migrations";
import { startWeLoveDevsSyncCron } from "./services/welovedevsSync";

const port = Number(process.env.PORT ?? 3001);

const startServer = async (): Promise<void> => {
	try {
		await pool.query("SELECT 1");
		console.log("[database] MySQL pool connected");
		await runStartupMigrations();

		app.listen(port, () => {
			console.log(`[server] API running on http://localhost:${port}`);
			if (isSwaggerEnabled()) {
				console.log(`[server] Swagger docs on http://localhost:${port}/docs`);
			}
		});

		startWeLoveDevsSyncCron();
	} catch (error) {
		console.error("[server] Startup failed", error);
		process.exit(1);
	}
};

void startServer();
