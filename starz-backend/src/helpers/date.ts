import createHttpError from "./httpError";

export const toIsoDateOrNull = (value: Date | string | null): string | null => {
	if (!value) {
		return null;
	}

	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

export const toIsoDate = (value: Date | string): string => {
	const date = value instanceof Date ? value : new Date(value);

	if (Number.isNaN(date.getTime())) {
		throw createHttpError(500, "Invalid date received from database");
	}

	return date.toISOString();
};

export const toIsoDateOrNow = (value: Date | string): string => {
	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

export const isExpired = (value: Date | string | null): boolean => {
	if (!value) {
		return false;
	}

	const date = value instanceof Date ? value : new Date(value);
	return Number.isNaN(date.getTime()) || date.getTime() <= Date.now();
};
