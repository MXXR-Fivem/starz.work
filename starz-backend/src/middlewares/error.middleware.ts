import type { NextFunction, Request, Response } from "express";

import { isHttpError } from "../helpers/httpError";

const isProduction = process.env.NODE_ENV === "production";

const errorMiddleware = (
	err: unknown,
	_req: Request,
	res: Response,
	_next: NextFunction
): void => {
	const statusCode = isHttpError(err) ? err.statusCode : 500;
	const message =
		statusCode >= 500 && isProduction
			? "Internal server error"
			: err instanceof Error
				? err.message
				: "Internal server error";

	if (statusCode >= 500) {
		console.error("[error]", err);
	}

	res.status(statusCode).json({
		success: false,
		message
	});
};

export default errorMiddleware;
