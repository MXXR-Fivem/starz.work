import { z } from "zod";

import { booleanLikeSchema } from "../../helpers/zod";

export type NotificationEvent = "company_invite" | "application_update";

export const notificationsQuerySchema = z.object({
	seen: booleanLikeSchema.optional(),
	page: z.coerce.number().int().min(0).default(0),
	size: z.coerce.number().int().min(1).max(100).default(20)
});

export const markNotificationsSeenPayloadSchema = z
	.object({
		ids: z.array(z.coerce.number().int().positive()).min(1).max(100).optional(),
		all: z.boolean().optional().default(false)
	})
	.refine((payload) => payload.all || payload.ids !== undefined, {
		message: "ids or all=true must be provided"
	});

export type NotificationsQuery = z.infer<typeof notificationsQuerySchema>;
export type MarkNotificationsSeenPayload = z.infer<typeof markNotificationsSeenPayloadSchema>;
