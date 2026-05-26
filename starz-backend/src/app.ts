const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("node:path");

import { setupSwagger } from "./config/swagger";
import { parsePositiveInteger } from "./helpers/env";
import requestLoggerMiddleware from "./middlewares/requestLogger.middleware";
import errorMiddleware from "./middlewares/error.middleware";
import notFoundMiddleware from "./middlewares/notFound.middleware";
import privateUploadMiddleware from "./middlewares/privateUpload.middleware";
import { registerModuleRoutes } from "./modules/registerRoutes";

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const defaultAllowedOrigins = "https://starz.work,https://api.starz.work";
const allowedOrigins = String(process.env.CORS_ALLOWED_ORIGINS ?? defaultAllowedOrigins)
	.split(",")
	.map((origin) => origin.trim())
	.filter((origin) => origin.length > 0);
const jsonLimit = process.env.JSON_BODY_LIMIT ?? "1mb";
const urlencodedLimit = process.env.URLENCODED_BODY_LIMIT ?? "100kb";
const urlencodedParameterLimit = parsePositiveInteger(
	process.env.URLENCODED_PARAMETER_LIMIT,
	100
);
const parseTrustProxy = (value: string): boolean | number | string => {
	const normalized = value.trim().toLowerCase();

	if (normalized === "true") {
		return true;
	}

	const numericValue = Number(normalized);
	return Number.isInteger(numericValue) && numericValue >= 0 ? numericValue : value;
};

if (process.env.TRUST_PROXY) {
	app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));
}

const corsMiddleware = isProduction
	? cors({
			origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
				if (!origin) {
					callback(null, true);
					return;
				}

				callback(null, allowedOrigins.includes(origin));
			},
			credentials: true
		})
	: cors({
			origin: true,
			credentials: true
		});

app.disable("x-powered-by");
app.use(helmet());
app.use(corsMiddleware);
app.use(express.json({ limit: jsonLimit }));
app.use(
	express.urlencoded({
		extended: true,
		limit: urlencodedLimit,
		parameterLimit: urlencodedParameterLimit
	})
);
app.use("/uploads/users/:userId/:filename", privateUploadMiddleware);
app.use(
	"/uploads",
	express.static(path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "uploads"), {
		dotfiles: "deny",
		index: false,
		setHeaders: (res: import("express").Response) => {
			res.setHeader("X-Content-Type-Options", "nosniff");
			res.setHeader("Cache-Control", "private, max-age=3600");
		}
	})
);
app.use(requestLoggerMiddleware);

registerModuleRoutes(app);
setupSwagger(app);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
