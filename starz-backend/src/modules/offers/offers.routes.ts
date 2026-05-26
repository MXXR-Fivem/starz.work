const express = require("express");

import authMiddleware from "../../middlewares/auth.middleware";
import { validate, validateBody } from "../../middlewares/validate.middleware";
import offersController from "./offers.controller";
import {
	createOfferPayloadSchema,
	createOfferSourcePayloadSchema,
	getOffersQuerySchema,
	moderationStatusPayloadSchema,
	offerIdParamsSchema,
	offerSkillParamsSchema,
	offerSkillsPayloadSchema,
	offerSourceParamsSchema,
	updateOfferPayloadSchema,
	updateOfferSourcePayloadSchema
} from "./offers.schemas";

const router = express.Router();

router.get("/", validate({ query: getOffersQuerySchema }), offersController.listOffers);
router.get("/random", offersController.listRandomOffers);
router.get("/:id", validate({ params: offerIdParamsSchema }), offersController.getOfferById);
router.post("/", authMiddleware, validateBody(createOfferPayloadSchema), offersController.createOffer);
router.patch(
	"/:id",
	authMiddleware,
	validate({ params: offerIdParamsSchema, body: updateOfferPayloadSchema }),
	offersController.updateOffer
);
router.delete(
	"/:id",
	authMiddleware,
	validate({ params: offerIdParamsSchema }),
	offersController.deleteOffer
);

router.patch(
	"/:id/publish",
	authMiddleware,
	validate({ params: offerIdParamsSchema }),
	offersController.publishOffer
);
router.patch(
	"/:id/close",
	authMiddleware,
	validate({ params: offerIdParamsSchema }),
	offersController.closeOffer
);
router.patch(
	"/:id/archive",
	authMiddleware,
	validate({ params: offerIdParamsSchema }),
	offersController.archiveOffer
);
router.patch(
	"/:id/restore",
	authMiddleware,
	validate({ params: offerIdParamsSchema }),
	offersController.restoreOffer
);
router.patch(
	"/:id/moderation-status",
	authMiddleware,
	validate({ params: offerIdParamsSchema, body: moderationStatusPayloadSchema }),
	offersController.updateModerationStatus
);

router.get(
	"/:id/skills",
	validate({ params: offerIdParamsSchema }),
	offersController.getSkills
);
router.post(
	"/:id/skills",
	authMiddleware,
	validate({ params: offerIdParamsSchema, body: offerSkillsPayloadSchema }),
	offersController.addSkills
);
router.delete(
	"/:id/skills/:skillId",
	authMiddleware,
	validate({ params: offerSkillParamsSchema }),
	offersController.removeSkill
);

router.get(
	"/:id/sources",
	validate({ params: offerIdParamsSchema }),
	offersController.getSources
);
router.post(
	"/:id/sources",
	authMiddleware,
	validate({ params: offerIdParamsSchema, body: createOfferSourcePayloadSchema }),
	offersController.addSource
);
router.patch(
	"/:id/sources/:sourceId",
	authMiddleware,
	validate({ params: offerSourceParamsSchema, body: updateOfferSourcePayloadSchema }),
	offersController.updateSource
);
router.delete(
	"/:id/sources/:sourceId",
	authMiddleware,
	validate({ params: offerSourceParamsSchema }),
	offersController.deleteSource
);

export const basePath = "/offers";
export default router;
