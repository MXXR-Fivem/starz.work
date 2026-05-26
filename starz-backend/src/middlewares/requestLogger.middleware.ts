import type { Request, RequestHandler, Response } from "express";

const morgan = require("morgan");

const requestLoggerMiddleware: RequestHandler = morgan("dev", {
	skip: (req: Request, _res: Response) =>
		process.env.NODE_ENV === "test" || req.originalUrl === "/health"
});

export default requestLoggerMiddleware;
