const express = require("express");

import authMiddleware from "../../middlewares/auth.middleware";
import { validate, validateBody } from "../../middlewares/validate.middleware";
import companyController from "./company.controller";
import {
	companyApplicationStatusPayloadSchema,
	companyApplicationParamsSchema,
	companyApplicationsQuerySchema,
	companyInvitationParamsSchema,
	companyMemberParamsSchema,
	companyOfferParamsSchema,
	companyOffersQuerySchema,
	createCompanyOfferPayloadSchema,
	createCompanyPayloadSchema,
	inviteMemberPayloadSchema,
	updateCompanyOfferPayloadSchema,
	updateCompanyPayloadSchema
} from "./company.schemas";

const router = express.Router();

const logoUpload = express.raw({
	type: ["image/jpeg", "image/png", "image/webp"],
	limit: process.env.COMPANY_LOGO_MAX_BYTES ?? "5mb"
});

router.use(authMiddleware);

router.get("/", companyController.getCompany);
router.get("/data", companyController.getData);
router.post("/", validateBody(createCompanyPayloadSchema), companyController.createCompany);
router.patch("/", validateBody(updateCompanyPayloadSchema), companyController.updateCompany);
router.put("/logo", logoUpload, companyController.uploadLogo);

router.get("/members", companyController.listMembers);
router.get("/activity", companyController.listActivity);
router.delete("/members/me", companyController.leaveCompany);
router.delete(
	"/members/:userId",
	validate({ params: companyMemberParamsSchema }),
	companyController.kickMember
);

router.get("/invitations", companyController.listInvitations);
router.post(
	"/invitations",
	validateBody(inviteMemberPayloadSchema),
	companyController.inviteMember
);
router.post(
	"/invitations/:invitationId/accept",
	validate({ params: companyInvitationParamsSchema }),
	companyController.acceptInvitation
);
router.post(
	"/invitations/:invitationId/decline",
	validate({ params: companyInvitationParamsSchema }),
	companyController.declineInvitation
);

router.get(
	"/offers",
	validate({ query: companyOffersQuerySchema }),
	companyController.listOffers
);
router.post(
	"/offers",
	validateBody(createCompanyOfferPayloadSchema),
	companyController.createOffer
);
router.patch(
	"/offers/:offerId",
	validate({ params: companyOfferParamsSchema, body: updateCompanyOfferPayloadSchema }),
	companyController.updateOffer
);
router.patch(
	"/offers/:offerId/close",
	validate({ params: companyOfferParamsSchema }),
	companyController.closeOffer
);

router.get(
	"/offers/:offerId/applications",
	validate({ params: companyOfferParamsSchema, query: companyApplicationsQuerySchema }),
	companyController.listOfferApplications
);
router.get(
	"/offers/:offerId/applications/:applicationId",
	validate({ params: companyApplicationParamsSchema }),
	companyController.getOfferApplication
);
router.patch(
	"/offers/:offerId/applications/:applicationId/status",
	validate({ params: companyApplicationParamsSchema, body: companyApplicationStatusPayloadSchema }),
	companyController.updateApplicationStatus
);

export const basePath = "/company";
export default router;
