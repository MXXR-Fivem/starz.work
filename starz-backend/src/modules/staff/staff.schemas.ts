import { z } from "zod";

import { booleanLikeSchema } from "../../helpers/zod";
import { updateOfferPayloadSchema, moderationStatusPayloadSchema } from "../offers/offers.schemas";

const idParam = (name: string) => z.coerce.number().int().positive(`${name} must be a positive integer`);

export const staffUserParamsSchema = z.object({
	userId: idParam("userId")
});

export const staffCompanyParamsSchema = z.object({
	companyId: idParam("companyId")
});

export const staffOfferParamsSchema = z.object({
	offerId: idParam("offerId")
});

export const staffListUsersQuerySchema = z.object({
	q: z.string().trim().min(1).optional(),
	companyId: z.coerce.number().int().positive().optional(),
	companyName: z.string().trim().min(1).optional(),
	banned: booleanLikeSchema.optional(),
	page: z.coerce.number().int().min(0).default(0),
	size: z.coerce.number().int().min(1).max(100).default(20)
});

export const staffListCompaniesQuerySchema = z.object({
	q: z.string().trim().min(1).optional(),
	page: z.coerce.number().int().min(0).default(0),
	size: z.coerce.number().int().min(1).max(100).default(20)
});

export const staffListModerationLogsQuerySchema = z.object({
	page: z.coerce.number().int().min(0).default(0),
	size: z.coerce.number().int().min(1).max(100).default(20)
});

export const staffBanUserPayloadSchema = z
	.object({
		reason: z.string().trim().max(1000).nullable().optional()
	})
	.default({});

export const staffUpdateCompanyPayloadSchema = z
	.object({
		name: z.string().trim().min(1).max(255).optional(),
		description: z.string().trim().max(5000).nullable().optional(),
		websiteUrl: z.string().trim().url().max(500).nullable().optional(),
		logoUrl: z.string().trim().max(500).nullable().optional()
	})
	.refine((payload) => Object.keys(payload).length > 0, {
		message: "At least one company field must be provided"
	});

export const staffUpdateOfferPayloadSchema = updateOfferPayloadSchema;
export const staffModerationStatusPayloadSchema = moderationStatusPayloadSchema;

export type StaffUserParams = z.infer<typeof staffUserParamsSchema>;
export type StaffCompanyParams = z.infer<typeof staffCompanyParamsSchema>;
export type StaffOfferParams = z.infer<typeof staffOfferParamsSchema>;
export type StaffListUsersQuery = z.infer<typeof staffListUsersQuerySchema>;
export type StaffListCompaniesQuery = z.infer<typeof staffListCompaniesQuerySchema>;
export type StaffListModerationLogsQuery = z.infer<typeof staffListModerationLogsQuerySchema>;
export type StaffBanUserPayload = z.infer<typeof staffBanUserPayloadSchema>;
export type StaffUpdateCompanyPayload = z.infer<typeof staffUpdateCompanyPayloadSchema>;
export type StaffUpdateOfferPayload = z.infer<typeof staffUpdateOfferPayloadSchema>;
export type StaffModerationStatusPayload = z.infer<typeof staffModerationStatusPayloadSchema>;
