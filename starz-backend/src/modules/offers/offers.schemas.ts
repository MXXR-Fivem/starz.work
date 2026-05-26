import { z } from "zod";

import { booleanLikeSchema } from "../../helpers/zod";

const offerStatusSchema = z.enum(["draft", "published", "closed"]);
const moderationStatusSchema = z.enum(["approved", "rejected"]);
const sourceNameSchema = z.enum(["welovedevs", "manual"]);
const salaryPeriodSchema = z.enum(["yearly", "daily"]);

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();
const optionalDateTime = z.string().datetime().nullable().optional();

const salaryFields = {
	salaryMin: z.coerce.number().nonnegative().nullable().optional(),
	salaryMax: z.coerce.number().nonnegative().nullable().optional()
};

const salaryRangeIsValid = (payload: {
	salaryMin?: number | null;
	salaryMax?: number | null;
}): boolean =>
	payload.salaryMin === undefined ||
	payload.salaryMax === undefined ||
	payload.salaryMin === null ||
	payload.salaryMax === null ||
	payload.salaryMin <= payload.salaryMax;

export const withValidSalaryRange = <T extends z.ZodType>(
	schema: T
): T =>
	schema.refine((payload) => salaryRangeIsValid(payload as {
		salaryMin?: number | null;
		salaryMax?: number | null;
	}), {
		message: "salaryMin must be lower than or equal to salaryMax",
		path: ["salaryMin"]
	}) as T;

export const offerIdParamsSchema = z.object({
	id: z.coerce.number().int().positive("id must be a positive integer")
});

export const offerSkillParamsSchema = z.object({
	id: z.coerce.number().int().positive("id must be a positive integer"),
	skillId: z.coerce.number().int().positive("skillId must be a positive integer")
});

export const offerSourceParamsSchema = z.object({
	id: z.coerce.number().int().positive("id must be a positive integer"),
	sourceId: z.coerce.number().int().positive("sourceId must be a positive integer")
});

export const getOffersQuerySchema = z.object({
	q: z.string().trim().min(1).optional(),
	status: offerStatusSchema.optional(),
	moderationStatus: moderationStatusSchema.optional(),
	companyId: z.coerce.number().int().positive().optional(),
	city: z.string().trim().min(1).optional(),
	location: z.string().trim().min(1).optional(),
	contractType: z.string().trim().min(1).optional(),
	remotePolicy: z.string().trim().min(1).optional(),
	premium: booleanLikeSchema.optional(),
	salaryMin: z.coerce.number().nonnegative().optional(),
	salaryMax: z.coerce.number().nonnegative().optional(),
	skillIds: z.string().trim().optional(),
	skills: z.string().trim().optional(),
	lat: z.coerce.number().min(-90).max(90).optional(),
	lng: z.coerce.number().min(-180).max(180).optional(),
	radiusKm: z.coerce.number().positive().max(1000).optional(),
	page: z.coerce.number().int().min(0).default(0),
	size: z.coerce.number().int().min(1).max(100).default(20),
	sortBy: z
		.enum([
			"publishedAt",
			"createdAt",
			"updatedAt",
			"title",
			"salaryMin",
			"salaryMax",
			"distance",
			"premiumThenDate"
		])
		.default("publishedAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc")
});

export const createOfferPayloadBaseSchema = z.object({
	...salaryFields,
	companyId: z.coerce.number().int().positive(),
	title: z.string().trim().min(1).max(255),
	description: z.string().trim().min(1),
	descriptionPreview: z.string().trim().nullable().optional(),
	location: optionalText(255),
	latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
	longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
	contractType: optionalText(100),
	remotePolicy: optionalText(100),
	status: offerStatusSchema.default("draft"),
	moderationStatus: moderationStatusSchema.default("approved"),
	premium: z.boolean().optional().default(false),
	salaryCurrency: z
		.string()
		.trim()
		.toUpperCase()
		.regex(/^[A-Z]{3}$/)
		.optional()
		.default("EUR"),
	salaryPeriod: salaryPeriodSchema.optional().default("yearly"),
	sourcePostedAt: optionalDateTime,
	publishedAt: optionalDateTime,
	expiresAt: optionalDateTime,
	skills: z.array(z.string().trim().min(1).max(100)).optional().default([])
});

export const createOfferPayloadSchema = withValidSalaryRange(createOfferPayloadBaseSchema);

export const updateOfferPayloadSchema = withValidSalaryRange(
	z
		.object({
			...salaryFields,
			title: z.string().trim().min(1).max(255).optional(),
			description: z.string().trim().min(1).optional(),
			descriptionPreview: z.string().trim().nullable().optional(),
			location: optionalText(255),
			latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
			longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
			contractType: optionalText(100),
			remotePolicy: optionalText(100),
			status: offerStatusSchema.optional(),
			premium: z.boolean().optional(),
			salaryCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
			salaryPeriod: salaryPeriodSchema.optional(),
			sourcePostedAt: optionalDateTime,
			publishedAt: optionalDateTime,
			expiresAt: optionalDateTime,
			skills: z.array(z.string().trim().min(1).max(100)).optional()
		})
		.refine((payload) => Object.keys(payload).length > 0, {
			message: "At least one field must be provided"
		})
);

export const moderationStatusPayloadSchema = z.object({
	moderationStatus: moderationStatusSchema
});

export const offerSkillsPayloadSchema = z.object({
	skills: z.array(z.string().trim().min(1).max(100)).min(1)
});

export const createOfferSourcePayloadSchema = z.object({
	sourceName: sourceNameSchema,
	externalId: z.string().trim().min(1).max(255),
	sourceUrl: z.string().trim().url().nullable().optional(),
	rawPayload: z.unknown().optional(),
	fetchedAt: optionalDateTime
});

export const updateOfferSourcePayloadSchema = z
	.object({
		sourceUrl: z.string().trim().url().nullable().optional(),
		rawPayload: z.unknown().optional(),
		fetchedAt: optionalDateTime
	})
	.refine((payload) => Object.keys(payload).length > 0, {
		message: "At least one field must be provided"
	});

export type OfferIdParams = z.infer<typeof offerIdParamsSchema>;
export type OfferSkillParams = z.infer<typeof offerSkillParamsSchema>;
export type OfferSourceParams = z.infer<typeof offerSourceParamsSchema>;
export type GetOffersQuery = z.infer<typeof getOffersQuerySchema>;
export type CreateOfferPayload = z.infer<typeof createOfferPayloadSchema>;
export type UpdateOfferPayload = z.infer<typeof updateOfferPayloadSchema>;
export type ModerationStatusPayload = z.infer<typeof moderationStatusPayloadSchema>;
export type OfferSkillsPayload = z.infer<typeof offerSkillsPayloadSchema>;
export type CreateOfferSourcePayload = z.infer<typeof createOfferSourcePayloadSchema>;
export type UpdateOfferSourcePayload = z.infer<typeof updateOfferSourcePayloadSchema>;
