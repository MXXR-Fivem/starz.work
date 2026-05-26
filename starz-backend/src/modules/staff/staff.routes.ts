const express = require("express");

import authMiddleware from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import staffController from "./staff.controller";
import {
	staffBanUserPayloadSchema,
	staffCompanyParamsSchema,
	staffListCompaniesQuerySchema,
	staffListModerationLogsQuerySchema,
	staffListUsersQuerySchema,
	staffModerationStatusPayloadSchema,
	staffOfferParamsSchema,
	staffUpdateCompanyPayloadSchema,
	staffUpdateOfferPayloadSchema,
	staffUserParamsSchema
} from "./staff.schemas";
import { getOffersQuerySchema } from "../offers/offers.schemas";

const router = express.Router();

router.use(authMiddleware);

router.get("/data", staffController.getData);
router.get("/logs", validate({ query: staffListModerationLogsQuerySchema }), staffController.listLogs);

router.get("/users", validate({ query: staffListUsersQuerySchema }), staffController.listUsers);
router.get("/users/:userId", validate({ params: staffUserParamsSchema }), staffController.getUser);
router.patch(
	"/users/:userId/ban",
	validate({ params: staffUserParamsSchema, body: staffBanUserPayloadSchema }),
	staffController.banUser
);
router.patch(
	"/users/:userId/unban",
	validate({ params: staffUserParamsSchema }),
	staffController.unbanUser
);
router.delete(
	"/users/:userId",
	validate({ params: staffUserParamsSchema }),
	staffController.deleteUser
);

router.get(
	"/companies",
	validate({ query: staffListCompaniesQuerySchema }),
	staffController.listCompanies
);
router.get(
	"/companies/:companyId",
	validate({ params: staffCompanyParamsSchema }),
	staffController.getCompany
);
router.patch(
	"/companies/:companyId",
	validate({ params: staffCompanyParamsSchema, body: staffUpdateCompanyPayloadSchema }),
	staffController.updateCompany
);
router.delete(
	"/companies/:companyId",
	validate({ params: staffCompanyParamsSchema }),
	staffController.deleteCompany
);

router.post("/welovedevs-sync", staffController.syncWeLoveDevs);

router.get("/offers", validate({ query: getOffersQuerySchema }), staffController.listOffers);
router.patch(
	"/offers/:offerId",
	validate({ params: staffOfferParamsSchema, body: staffUpdateOfferPayloadSchema }),
	staffController.updateOffer
);
router.delete(
	"/offers/:offerId",
	validate({ params: staffOfferParamsSchema }),
	staffController.deleteOffer
);
router.patch(
	"/offers/:offerId/moderation-status",
	validate({ params: staffOfferParamsSchema, body: staffModerationStatusPayloadSchema }),
	staffController.updateOfferModerationStatus
);

export const basePath = "/staff";
export default router;
