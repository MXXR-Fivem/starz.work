import { z } from "zod";

export const applicationStatusSchema = z.enum([
	"draft",
	"submitted",
	"viewed",
	"accepted",
	"rejected",
	"withdrawn"
]);

export const applicationsQuerySchema = z.object({
	status: applicationStatusSchema.optional(),
	page: z.coerce.number().int().min(0).default(0),
	size: z.coerce.number().int().min(1).max(100).default(20)
});

export const applicationIdParamsSchema = z.object({
	applicationId: z.coerce.number().int().positive("applicationId must be a positive integer")
});

export const createApplicationPayloadSchema = z.object({
	offerId: z.coerce.number().int().positive("offerId must be a positive integer"),
	coverLetter: z.string().trim().max(5000).nullable().optional(),
	resumeUrl: z.string().trim().max(1000).nullable().optional()
});

export type ApplicationStatus = z.infer<typeof applicationStatusSchema>;
export type ApplicationsQuery = z.infer<typeof applicationsQuerySchema>;
export type ApplicationIdParams = z.infer<typeof applicationIdParamsSchema>;
export type CreateApplicationPayload = z.infer<typeof createApplicationPayloadSchema>;
