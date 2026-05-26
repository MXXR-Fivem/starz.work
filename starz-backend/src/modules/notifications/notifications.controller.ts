import type { Request } from "express";

import asyncHandler from "../../helpers/asyncHandler";
import { getAuthenticatedNumericUserId } from "../../helpers/requestAuth";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import notificationsService from "./notifications.service";
import type {
	MarkNotificationsSeenPayload,
	NotificationsQuery
} from "./notifications.schemas";

const currentUserId = (req: Request): number =>
	getAuthenticatedNumericUserId(req as AuthenticatedRequest);

export const listNotifications = asyncHandler(async (req, res) => {
	const result = await notificationsService.listNotifications(
		currentUserId(req),
		req.query as unknown as NotificationsQuery
	);

	res.status(200).json({
		success: true,
		message: "Notifications fetched successfully",
		data: result
	});
});

export const markNotificationsSeen = asyncHandler(async (req, res) => {
	const result = await notificationsService.markNotificationsSeen(
		currentUserId(req),
		req.body as MarkNotificationsSeenPayload
	);

	res.status(200).json({
		success: true,
		message: "Notifications marked as seen successfully",
		data: result
	});
});

const notificationsController = {
	listNotifications,
	markNotificationsSeen
};

export default notificationsController;
