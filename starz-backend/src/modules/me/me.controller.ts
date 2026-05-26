import asyncHandler from "../../helpers/asyncHandler";
import { clearRefreshTokenCookie } from "../../helpers/refreshTokenCookie";
import { getAuthenticatedUserId } from "../../helpers/requestAuth";
import { getRawUploadBuffer, getUploadOriginalName } from "../../helpers/upload";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import meService from "./me.service";
import type {
	FavoriteOfferParams,
	FavoriteOfferPayload,
	FavoritesQuery,
	DeleteAccountPayload,
	OAuthCallbackPayload,
	OAuthProviderParams,
	UpdateMePayload,
	UpdatePasswordPayload
} from "./me.schemas";

export const getProfile = asyncHandler(async (req, res) => {
	const result = await meService.getProfile(getAuthenticatedUserId(req as AuthenticatedRequest));

	res.status(200).json({
		success: true,
		message: "Profile fetched successfully",
		data: result
	});
});

export const getData = asyncHandler(async (req, res) => {
	const result = await meService.getData(getAuthenticatedUserId(req as AuthenticatedRequest));

	res.status(200).json({
		success: true,
		message: "Profile data fetched successfully",
		data: result
	});
});

export const updateProfile = asyncHandler(async (req, res) => {
	const payload = req.body as UpdateMePayload;
	const result = await meService.updateProfile(
		getAuthenticatedUserId(req as AuthenticatedRequest),
		payload
	);

	res.status(200).json({
		success: true,
		message: "Profile updated successfully",
		data: result
	});
});

export const uploadProfilePhoto = asyncHandler(async (req, res) => {
	const result = await meService.saveProfileFile({
		userId: getAuthenticatedUserId(req as AuthenticatedRequest),
		buffer: getRawUploadBuffer(req),
		contentType: req.headers["content-type"],
		originalName: getUploadOriginalName(req),
		kind: "profile-photo"
	});

	res.status(200).json({
		success: true,
		message: "Profile photo uploaded successfully",
		data: result
	});
});

export const uploadCv = asyncHandler(async (req, res) => {
	const result = await meService.saveProfileFile({
		userId: getAuthenticatedUserId(req as AuthenticatedRequest),
		buffer: getRawUploadBuffer(req),
		contentType: req.headers["content-type"],
		originalName: getUploadOriginalName(req),
		kind: "cv"
	});

	res.status(200).json({
		success: true,
		message: "CV uploaded successfully",
		data: result
	});
});

export const linkOAuthProvider = asyncHandler(async (req, res) => {
	const { provider } = req.params as unknown as OAuthProviderParams;
	const payload = req.body as OAuthCallbackPayload;
	const result = await meService.linkOAuthProvider(
		getAuthenticatedUserId(req as AuthenticatedRequest),
		provider,
		payload
	);

	res.status(200).json({
		success: true,
		message: "OAuth provider linked successfully",
		data: result
	});
});

export const updatePassword = asyncHandler(async (req, res) => {
	const payload = req.body as UpdatePasswordPayload;
	await meService.updatePassword(getAuthenticatedUserId(req as AuthenticatedRequest), payload);

	res.status(200).json({
		success: true,
		message: "Password updated successfully"
	});
});

export const requestPasswordUpdateCode = asyncHandler(async (req, res) => {
	const result = await meService.requestPasswordUpdateCode(
		getAuthenticatedUserId(req as AuthenticatedRequest)
	);

	res.status(200).json({
		success: true,
		message: "Password confirmation code sent successfully",
		data: result
	});
});

export const requestDeleteAccountCode = asyncHandler(async (req, res) => {
	const result = await meService.requestDeleteAccountCode(
		getAuthenticatedUserId(req as AuthenticatedRequest)
	);

	res.status(200).json({
		success: true,
		message: "Delete account confirmation code sent successfully",
		data: result
	});
});

export const deleteAccount = asyncHandler(async (req, res) => {
	const { code } = req.body as DeleteAccountPayload;
	await meService.deleteAccount(getAuthenticatedUserId(req as AuthenticatedRequest), code);
	clearRefreshTokenCookie(res);

	res.status(200).json({
		success: true,
		message: "Account deleted successfully"
	});
});

export const listFavorites = asyncHandler(async (req, res) => {
	const result = await meService.listFavorites(
		getAuthenticatedUserId(req as AuthenticatedRequest),
		req.query as unknown as FavoritesQuery
	);

	res.status(200).json({
		success: true,
		message: "Favorite applications fetched successfully",
		data: result
	});
});

export const addFavorite = asyncHandler(async (req, res) => {
	const { offerId } = req.body as FavoriteOfferPayload;
	const result = await meService.addFavorite(
		getAuthenticatedUserId(req as AuthenticatedRequest),
		offerId
	);

	res.status(201).json({
		success: true,
		message: "Favorite offer added successfully",
		data: result
	});
});

export const removeFavorite = asyncHandler(async (req, res) => {
	const { offerId } = req.params as unknown as FavoriteOfferParams;
	await meService.removeFavorite(getAuthenticatedUserId(req as AuthenticatedRequest), offerId);

	res.status(200).json({
		success: true,
		message: "Favorite offer removed successfully"
	});
});

const meController = {
	getProfile,
	getData,
	updateProfile,
	uploadProfilePhoto,
	uploadCv,
	linkOAuthProvider,
	updatePassword,
	requestPasswordUpdateCode,
	requestDeleteAccountCode,
	deleteAccount,
	listFavorites,
	addFavorite,
	removeFavorite
};

export default meController;
