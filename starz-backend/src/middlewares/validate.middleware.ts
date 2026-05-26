import type { NextFunction, Request, RequestHandler, Response } from "express";
import { type ZodType } from "zod";

type ValidationTarget = "body" | "query" | "params";

type ValidationSchema = ZodType<unknown>;

type ValidationSchemas = Partial<Record<ValidationTarget, ValidationSchema>>;

type ValidationIssue = { path: PropertyKey[]; message: string };

const formatPathSegment = (segment: PropertyKey): string => {
	if (typeof segment === "symbol") {
		return segment.description ?? segment.toString();
	}

	return String(segment);
};

const mapValidationErrors = (issues: ValidationIssue[]) => {
	return issues.map((issue) => ({
		path: issue.path.map(formatPathSegment).join("."),
		message: issue.message
	}));
};

const applyValidatedTarget = (
	req: Request,
	target: ValidationTarget,
	data: unknown
): void => {
	Object.defineProperty(req, target, {
		value: data,
		configurable: true,
		enumerable: true,
		writable: true
	});
};

const validateTarget = (
	req: Request,
	target: ValidationTarget,
	schema: ValidationSchema,
	res: Response
): boolean => {
	const parsed = schema.safeParse(req[target]);

	if (!parsed.success) {
		res.status(400).json({
			success: false,
			message: "Validation failed",
			errors: mapValidationErrors(parsed.error.issues)
		});
		return false;
	}

	applyValidatedTarget(req, target, parsed.data);
	return true;
};

export const validate = (schemas: ValidationSchemas): RequestHandler => {
	return (req: Request, res: Response, next: NextFunction): void => {
		const targets: ValidationTarget[] = ["params", "query", "body"];

		for (const target of targets) {
			const schema = schemas[target];

			if (!schema) {
				continue;
			}

			if (!validateTarget(req, target, schema, res)) {
				return;
			}
		}

		next();
	};
};

export const validateBody = (schema: ValidationSchema): RequestHandler => validate({ body: schema });
export const validateQuery = (schema: ValidationSchema): RequestHandler => validate({ query: schema });
export const validateParams = (schema: ValidationSchema): RequestHandler => validate({ params: schema });

export default validate;
