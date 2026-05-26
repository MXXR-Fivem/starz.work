const express = require("express");

import authMiddleware from "../../middlewares/auth.middleware";
import { validate, validateBody } from "../../middlewares/validate.middleware";
import meController from "./me.controller";
import {
	favoriteOfferParamsSchema,
	favoriteOfferPayloadSchema,
	favoritesQuerySchema,
	deleteAccountPayloadSchema,
	oauthCallbackPayloadSchema,
	oauthProviderParamsSchema,
	updateMePayloadSchema,
	updatePasswordPayloadSchema
} from "./me.schemas";

const router = express.Router();

const profilePhotoUpload = express.raw({
	type: ["image/jpeg", "image/png", "image/webp"],
	limit: process.env.PROFILE_PHOTO_MAX_BYTES ?? "5mb"
});
const cvUpload = express.raw({
	type: [
		"application/pdf",
		"application/msword",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	],
	limit: process.env.CV_MAX_BYTES ?? "10mb"
});

router.use(authMiddleware);

router.get("/", meController.getProfile);
router.get("/data", meController.getData);
router.patch("/", validateBody(updateMePayloadSchema), meController.updateProfile);
router.post("/delete-code", meController.requestDeleteAccountCode);
router.delete("/", validateBody(deleteAccountPayloadSchema), meController.deleteAccount);
router.put("/profile-photo", profilePhotoUpload, meController.uploadProfilePhoto);
router.put("/cv", cvUpload, meController.uploadCv);
router.post(
	"/oauth/:provider",
	validate({ params: oauthProviderParamsSchema, body: oauthCallbackPayloadSchema }),
	meController.linkOAuthProvider
);
router.post("/password-code", meController.requestPasswordUpdateCode);
router.patch("/password", validateBody(updatePasswordPayloadSchema), meController.updatePassword);
router.get(
	"/favorites",
	validate({ query: favoritesQuerySchema }),
	meController.listFavorites
);
router.post(
	"/favorites",
	validateBody(favoriteOfferPayloadSchema),
	meController.addFavorite
);
router.delete(
	"/favorites/:offerId",
	validate({ params: favoriteOfferParamsSchema }),
	meController.removeFavorite
);

export const basePath = "/me";
export default router;
