import { z } from "zod";

export const emailSchema = z
	.string()
	.trim()
	.email("Invalid email format")
	.max(255, "Email is too long");

export const passwordSchema = z
	.string()
	.min(8, "Password must contain at least 8 characters")
	.max(128, "Password is too long");

export const firstNameSchema = z
	.string()
	.trim()
	.min(1, "First name is required")
	.max(100, "First name is too long");

export const lastNameSchema = z
	.string()
	.trim()
	.min(1, "Last name is required")
	.max(100, "Last name is too long");

export const dateOfBirthSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "dateOfBirth must use YYYY-MM-DD format");

export const statusSchema = z.enum(["en_recherche", "recruteur"]);

export const registerPayloadSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
	firstName: firstNameSchema,
	lastName: lastNameSchema,
	dateOfBirth: dateOfBirthSchema.optional(),
	status: statusSchema.optional()
});

export const loginPayloadSchema = z.object({
	email: emailSchema,
	password: passwordSchema
});

export const logoutPayloadSchema = z
	.object({
		refreshToken: z.string().trim().min(32).optional()
	})
	.default({});

export const refreshPayloadSchema = z
	.object({
		refreshToken: z.string().trim().min(32, "refreshToken is invalid").optional()
	})
	.default({});

export const verifyEmailPayloadSchema = z.object({
	email: emailSchema,
	code: z.string().trim().regex(/^\d{6}$/, "code must be a 6-digit value")
});

export const emailPayloadSchema = z.object({
	email: emailSchema
});

export const resetPasswordPayloadSchema = z.object({
	token: z.string().trim().min(20, "token is invalid"),
	newPassword: passwordSchema
});

export const oauthProviderSchema = z.enum(["google", "github", "linkedin"]);

export const oauthProviderParamsSchema = z.object({
	provider: oauthProviderSchema
});

export const sessionIdParamsSchema = z.object({
	sessionId: z.coerce.number().int().positive("sessionId must be a positive integer")
});

export const oauthAuthorizeQuerySchema = z.object({
	redirectUri: z.string().trim().url("redirectUri must be a valid URL"),
	state: z.string().trim().min(1).max(500).optional()
});

export const oauthCallbackPayloadSchema = z.object({
	code: z.string().trim().min(1, "code is required"),
	redirectUri: z.string().trim().url("redirectUri must be a valid URL")
});

export type RegisterPayload = z.infer<typeof registerPayloadSchema>;
export type LoginPayload = z.infer<typeof loginPayloadSchema>;
export type LogoutPayloadBody = z.infer<typeof logoutPayloadSchema>;
export type RefreshPayload = z.infer<typeof refreshPayloadSchema>;
export type VerifyEmailPayload = z.infer<typeof verifyEmailPayloadSchema>;
export type EmailPayload = z.infer<typeof emailPayloadSchema>;
export type ResetPasswordPayload = z.infer<typeof resetPasswordPayloadSchema>;
export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
export type OAuthProviderParams = z.infer<typeof oauthProviderParamsSchema>;
export type SessionIdParams = z.infer<typeof sessionIdParamsSchema>;
export type OAuthAuthorizeQuery = z.infer<typeof oauthAuthorizeQuerySchema>;
export type OAuthCallbackPayload = z.infer<typeof oauthCallbackPayloadSchema>;
