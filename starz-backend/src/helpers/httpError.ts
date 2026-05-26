export interface HttpError extends Error {
	statusCode: number;
}

export const createHttpError = (statusCode: number, message: string): HttpError => {
	const error = new Error(message) as HttpError;
	error.statusCode = statusCode;
	return error;
};

export const isHttpError = (value: unknown): value is HttpError => {
	return (
		typeof value === "object" &&
		value !== null &&
		"statusCode" in value &&
		typeof (value as { statusCode?: unknown }).statusCode === "number" &&
		"message" in value &&
		typeof (value as { message?: unknown }).message === "string"
	);
};

export default createHttpError;
