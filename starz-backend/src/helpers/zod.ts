import { z } from "zod";

export const booleanLikeSchema = z.preprocess((value) => {
	if (typeof value === "boolean") {
		return value;
	}

	if (typeof value === "number") {
		return value > 0;
	}

	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();

		if (["1", "true", "yes"].includes(normalized)) {
			return true;
		}
		if (["0", "false", "no"].includes(normalized)) {
			return false;
		}
	}

	return value;
}, z.boolean());
