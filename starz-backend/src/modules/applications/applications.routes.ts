const express = require("express");

import authMiddleware from "../../middlewares/auth.middleware";
import { validate, validateBody } from "../../middlewares/validate.middleware";
import applicationsController from "./applications.controller";
import {
	applicationIdParamsSchema,
	applicationsQuerySchema,
	createApplicationPayloadSchema
} from "./applications.schemas";

const router = express.Router();

router.get(
	"/",
	authMiddleware,
	validate({ query: applicationsQuerySchema }),
	applicationsController.listCurrentApplications
);
router.post(
	"/",
	authMiddleware,
	validateBody(createApplicationPayloadSchema),
	applicationsController.createApplication
);
router.get(
	"/expired",
	authMiddleware,
	validate({ query: applicationsQuerySchema }),
	applicationsController.listExpiredApplications
);
router.get(
	"/:applicationId",
	authMiddleware,
	validate({ params: applicationIdParamsSchema }),
	applicationsController.getApplication
);
router.patch(
	"/:applicationId/withdraw",
	authMiddleware,
	validate({ params: applicationIdParamsSchema }),
	applicationsController.withdrawApplication
);

export const basePath = "/applications";
export default router;
