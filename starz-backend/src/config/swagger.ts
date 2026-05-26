import fs from "node:fs";
import path from "node:path";
import type { Express, Response } from "express";

const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");

const OPEN_API_PATH = path.resolve(process.cwd(), "src", "docs", "openapi", "openapi.yml");
const SWAGGER_FAVICON_PATH = path.resolve(process.cwd(), "src", "docs", "openapi", "favicon.ico");

export const isSwaggerEnabled = (): boolean => {
	if (process.env.NODE_ENV === "production") {
		return false;
	}

	if (process.env.SWAGGER_ENABLED !== undefined) {
		return process.env.SWAGGER_ENABLED === "true";
	}

	return true;
};

const sendSwaggerUnavailableResponse = (res: Response, message: string): void => {
	res.status(503).json({
		success: false,
		message
	});
};

const resolveSwaggerFavicon = (app: Express): string | undefined => {

	if (!fs.existsSync(SWAGGER_FAVICON_PATH)) {
		return undefined;
	}

	app.get("/docs/favicon.ico", (_req, res) => {
		res.sendFile(SWAGGER_FAVICON_PATH);
	});

	return "/docs/favicon.ico";
};

export const setupSwagger = (app: Express): void => {
	if (!isSwaggerEnabled()) {
		return;
	}

	if (!fs.existsSync(OPEN_API_PATH)) {
		app.get("/docs", (_req, res) => {
			sendSwaggerUnavailableResponse(
				res,
				"OpenAPI file not found. Expected at src/docs/openapi/openapi.yml"
			);
		});
		return;
	}

	try {
		const swaggerDocument = YAML.load(OPEN_API_PATH);
		const customfavIcon = resolveSwaggerFavicon(app);

		app.get("/openapi.json", (_req, res) => {
			res.status(200).json(swaggerDocument);
		});

		app.use(
			"/docs",
			swaggerUi.serve,
			swaggerUi.setup(swaggerDocument, {
				explorer: true,
				customSiteTitle: "Starz.work Backend API Docs",
				customfavIcon
			})
		);
	} catch (error) {
		console.error("[swagger] Failed to load OpenAPI specification", error);

		app.get("/docs", (_req, res) => {
			sendSwaggerUnavailableResponse(
				res,
				"OpenAPI specification is invalid. Check src/docs/openapi/openapi.yml"
			);
		});
	}
};

export default setupSwagger;
