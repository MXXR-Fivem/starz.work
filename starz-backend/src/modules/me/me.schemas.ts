import { z } from "zod";

import {
	dateOfBirthSchema,
	firstNameSchema,
	lastNameSchema,
	oauthCallbackPayloadSchema,
	oauthProviderParamsSchema,
	passwordSchema,
	statusSchema,
	type OAuthCallbackPayload,
	type OAuthProvider,
	type OAuthProviderParams
} from "../auth/auth.schemas";

export const updateMePayloadSchema = z
	.object({
		firstName: firstNameSchema.optional(),
		lastName: lastNameSchema.optional(),
		dateOfBirth: dateOfBirthSchema.nullable().optional(),
		status: statusSchema.optional(),
		shortBio: z.string().trim().max(500).nullable().optional(),
		linkedinUrl: z.string().trim().url().max(1000).nullable().optional(),
		githubUrl: z.string().trim().url().max(1000).nullable().optional(),
		portfolioUrl: z.string().trim().url().max(1000).nullable().optional(),
		workLocation: z.string().trim().max(255).nullable().optional(),
		darkMode: z.boolean().optional(),
		skills: z.array(z.string().trim().min(1).max(100)).max(50).optional()
	})
	.refine(
		(payload) =>
			payload.firstName !== undefined ||
			payload.lastName !== undefined ||
			payload.dateOfBirth !== undefined ||
			payload.status !== undefined ||
			payload.shortBio !== undefined ||
			payload.linkedinUrl !== undefined ||
			payload.githubUrl !== undefined ||
			payload.portfolioUrl !== undefined ||
			payload.workLocation !== undefined ||
			payload.darkMode !== undefined ||
			payload.skills !== undefined,
		{
			message: "At least one profile field must be provided"
		}
	);

export const updatePasswordPayloadSchema = z
	.object({
		currentPassword: passwordSchema,
		newPassword: passwordSchema,
		code: z.string().trim().regex(/^\d{6}$/, "code must be a 6-digit value")
	})
	.refine((payload) => payload.currentPassword !== payload.newPassword, {
		message: "New password must be different from current password",
		path: ["newPassword"]
	});

export const deleteAccountPayloadSchema = z.object({
	code: z.string().trim().regex(/^\d{6}$/, "code must be a 6-digit value")
});

export const favoritesQuerySchema = z.object({
	page: z.coerce.number().int().min(0).default(0),
	size: z.coerce.number().int().min(1).max(100).default(20)
});

export const favoriteOfferPayloadSchema = z.object({
	offerId: z.coerce.number().int().positive("offerId must be a positive integer")
});

export const favoriteOfferParamsSchema = z.object({
	offerId: z.coerce.number().int().positive("offerId must be a positive integer")
});

export {
	oauthCallbackPayloadSchema,
	oauthProviderParamsSchema
};

export type FavoriteOfferPayload = z.infer<typeof favoriteOfferPayloadSchema>;
export type FavoriteOfferParams = z.infer<typeof favoriteOfferParamsSchema>;
export type FavoritesQuery = z.infer<typeof favoritesQuerySchema>;
export type UpdateMePayload = z.infer<typeof updateMePayloadSchema>;
export type UpdatePasswordPayload = z.infer<typeof updatePasswordPayloadSchema>;
export type DeleteAccountPayload = z.infer<typeof deleteAccountPayloadSchema>;
export type {
	OAuthCallbackPayload,
	OAuthProvider,
	OAuthProviderParams
};
