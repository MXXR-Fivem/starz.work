const express = require("express");

import authMiddleware from "../../middlewares/auth.middleware";
import { validate, validateBody } from "../../middlewares/validate.middleware";
import notificationsController from "./notifications.controller";
import {
	markNotificationsSeenPayloadSchema,
	notificationsQuerySchema
} from "./notifications.schemas";

const router = express.Router();

router.use(authMiddleware);

router.get(
	"/",
	validate({ query: notificationsQuerySchema }),
	notificationsController.listNotifications
);
router.patch(
	"/seen",
	validateBody(markNotificationsSeenPayloadSchema),
	notificationsController.markNotificationsSeen
);

export const basePath = "/notifications";
export default router;
