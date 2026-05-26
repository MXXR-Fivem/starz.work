import { z } from "zod";

import { applicationStatusSchema } from "../applications/applications.schemas";
import {
	createOfferPayloadBaseSchema,
	updateOfferPayloadSchema,
	withValidSalaryRange
} from "../offers/offers.schemas";

const idParam = (name: string) => z.coerce.number().int().positive(`${name} must be a positive integer`);

export const companyMemberParamsSchema = z.object({
	userId: idParam("userId")
});

export const companyInvitationParamsSchema = z.object({
	invitationId: idParam("invitationId")
});

export const companyOfferParamsSchema = z.object({
	offerId: idParam("offerId")
});

export const companyApplicationParamsSchema = companyOfferParamsSchema.extend({
	applicationId: idParam("applicationId")
});

export const createCompanyPayloadSchema = z.object({
	name: z.string().trim().min(1).max(255),
	description: z.string().trim().max(5000).nullable().optional(),
	websiteUrl: z.string().trim().url().max(500).nullable().optional(),
	logoUrl: z.string().trim().max(500).nullable().optional()
});

export const updateCompanyPayloadSchema = z
	.object({
		name: z.string().trim().min(1).max(255).optional(),
		description: z.string().trim().max(5000).nullable().optional(),
		websiteUrl: z.string().trim().url().max(500).nullable().optional(),
		logoUrl: z.string().trim().max(500).nullable().optional()
	})
	.refine((payload) => Object.keys(payload).length > 0, {
		message: "At least one company field must be provided"
	});

export const inviteMemberPayloadSchema = z.object({
	email: z.string().trim().email().max(255)
});

export const companyOffersQuerySchema = z.object({
	status: z.enum(["draft", "published", "closed"]).optional(),
	q: z.string().trim().max(255).optional(),
	page: z.coerce.number().int().min(0).default(0),
	size: z.coerce.number().int().min(1).max(100).default(20)
});

export const companyApplicationsQuerySchema = z.object({
	status: applicationStatusSchema.optional(),
	page: z.coerce.number().int().min(0).default(0),
	size: z.coerce.number().int().min(1).max(100).default(20)
});

export const companyApplicationStatusPayloadSchema = z.object({
	status: z.enum(["accepted", "rejected"])
});

export const createCompanyOfferPayloadSchema = withValidSalaryRange(
	createOfferPayloadBaseSchema.omit({ companyId: true })
);
export const updateCompanyOfferPayloadSchema = updateOfferPayloadSchema;

export type CompanyMemberParams = z.infer<typeof companyMemberParamsSchema>;
export type CompanyInvitationParams = z.infer<typeof companyInvitationParamsSchema>;
export type CompanyOfferParams = z.infer<typeof companyOfferParamsSchema>;
export type CompanyApplicationParams = z.infer<typeof companyApplicationParamsSchema>;
export type CreateCompanyPayload = z.infer<typeof createCompanyPayloadSchema>;
export type UpdateCompanyPayload = z.infer<typeof updateCompanyPayloadSchema>;
export type InviteMemberPayload = z.infer<typeof inviteMemberPayloadSchema>;
export type CompanyOffersQuery = z.infer<typeof companyOffersQuerySchema>;
export type CompanyApplicationsQuery = z.infer<typeof companyApplicationsQuerySchema>;
export type CompanyApplicationStatusPayload = z.infer<typeof companyApplicationStatusPayloadSchema>;
export type CreateCompanyOfferPayload = z.infer<typeof createCompanyOfferPayloadSchema>;
export type UpdateCompanyOfferPayload = z.infer<typeof updateCompanyOfferPayloadSchema>;
