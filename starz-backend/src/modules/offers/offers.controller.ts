import type { Response } from "express";

import asyncHandler from "../../helpers/asyncHandler";
import { getAuthenticatedNumericUserId } from "../../helpers/requestAuth";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import offersService from "./offers.service";
import type {
	CreateOfferPayload,
	CreateOfferSourcePayload,
	ModerationStatusPayload,
	OfferIdParams,
	OfferSkillParams,
	OfferSkillsPayload,
	OfferSourceParams,
	UpdateOfferPayload,
	UpdateOfferSourcePayload
} from "./offers.schemas";

const currentUserId = (req: unknown): number =>
	getAuthenticatedNumericUserId(req as AuthenticatedRequest);

const sendOffer = (res: Response, message: string, offer: unknown, status = 200): void => {
	res.status(status).json({
		success: true,
		message,
		data: { offer }
	});
};

export const listOffers = asyncHandler(async (req, res) => {
	const result = await offersService.listOffers(req.query);

	res.status(200).json({
		success: true,
		message: "Offers fetched successfully",
		data: result
	});
});

export const listRandomOffers = asyncHandler(async (_req, res) => {
	const offers = await offersService.listRandomOffers(3);

	res.status(200).json({
		success: true,
		message: "Random offers fetched successfully",
		data: { offers }
	});
});

export const getOfferById = asyncHandler(async (req, res) => {
	const { id } = req.params as unknown as OfferIdParams;
	const offer = await offersService.getOfferById(id, { publicView: true });
	sendOffer(res, "Offer fetched successfully", offer);
});

export const createOffer = asyncHandler(async (req, res) => {
	const offer = await offersService.createOffer(
		currentUserId(req),
		req.body as CreateOfferPayload
	);
	sendOffer(res, "Offer created successfully", offer, 201);
});

export const updateOffer = asyncHandler(async (req, res) => {
	const { id } = req.params as unknown as OfferIdParams;
	const offer = await offersService.updateOffer(
		currentUserId(req),
		id,
		req.body as UpdateOfferPayload
	);
	sendOffer(res, "Offer updated successfully", offer);
});

export const deleteOffer = asyncHandler(async (req, res) => {
	const { id } = req.params as unknown as OfferIdParams;
	await offersService.deleteOffer(currentUserId(req), id);

	res.status(200).json({
		success: true,
		message: "Offer deleted successfully"
	});
});

const updateOfferLifecycle = (
	serviceCall: (userId: number, offerId: number) => Promise<unknown>,
	message: string
) =>
	asyncHandler(async (req, res) => {
		const { id } = req.params as unknown as OfferIdParams;
		const offer = await serviceCall(currentUserId(req), id);
		sendOffer(res, message, offer);
	});

export const publishOffer = updateOfferLifecycle(
	offersService.publishOffer,
	"Offer published successfully"
);
export const closeOffer = updateOfferLifecycle(offersService.closeOffer, "Offer closed successfully");
export const archiveOffer = updateOfferLifecycle(
	offersService.archiveOffer,
	"Offer archived successfully"
);
export const restoreOffer = updateOfferLifecycle(
	offersService.restoreOffer,
	"Offer restored successfully"
);

export const updateModerationStatus = asyncHandler(async (req, res) => {
	const { id } = req.params as unknown as OfferIdParams;
	const { moderationStatus } = req.body as ModerationStatusPayload;
	const offer = await offersService.updateOfferModerationStatus(
		currentUserId(req),
		id,
		moderationStatus
	);
	sendOffer(res, "Offer moderation status updated successfully", offer);
});

export const getSkills = asyncHandler(async (req, res) => {
	const { id } = req.params as unknown as OfferIdParams;
	const skills = await offersService.getOfferSkills(id);

	res.status(200).json({
		success: true,
		message: "Offer skills fetched successfully",
		data: { skills }
	});
});

export const addSkills = asyncHandler(async (req, res) => {
	const { id } = req.params as unknown as OfferIdParams;
	const { skills } = req.body as OfferSkillsPayload;
	const result = await offersService.addOfferSkills(currentUserId(req), id, skills);

	res.status(200).json({
		success: true,
		message: "Offer skills added successfully",
		data: { skills: result }
	});
});

export const removeSkill = asyncHandler(async (req, res) => {
	const { id, skillId } = req.params as unknown as OfferSkillParams;
	await offersService.removeOfferSkill(currentUserId(req), id, skillId);

	res.status(200).json({
		success: true,
		message: "Offer skill removed successfully"
	});
});

export const getSources = asyncHandler(async (req, res) => {
	const { id } = req.params as unknown as OfferIdParams;
	const sources = await offersService.getOfferSources(id);

	res.status(200).json({
		success: true,
		message: "Offer sources fetched successfully",
		data: { sources }
	});
});

export const addSource = asyncHandler(async (req, res) => {
	const { id } = req.params as unknown as OfferIdParams;
	await offersService.addOfferSource(currentUserId(req), id, req.body as CreateOfferSourcePayload);

	res.status(201).json({
		success: true,
		message: "Offer source created successfully"
	});
});

export const updateSource = asyncHandler(async (req, res) => {
	const { id, sourceId } = req.params as unknown as OfferSourceParams;
	await offersService.updateOfferSource(
		currentUserId(req),
		id,
		sourceId,
		req.body as UpdateOfferSourcePayload
	);

	res.status(200).json({
		success: true,
		message: "Offer source updated successfully"
	});
});

export const deleteSource = asyncHandler(async (req, res) => {
	const { id, sourceId } = req.params as unknown as OfferSourceParams;
	await offersService.deleteOfferSource(currentUserId(req), id, sourceId);

	res.status(200).json({
		success: true,
		message: "Offer source deleted successfully"
	});
});

const offersController = {
	listOffers,
	listRandomOffers,
	getOfferById,
	createOffer,
	updateOffer,
	deleteOffer,
	publishOffer,
	closeOffer,
	archiveOffer,
	restoreOffer,
	updateModerationStatus,
	getSkills,
	addSkills,
	removeSkill,
	getSources,
	addSource,
	updateSource,
	deleteSource
};

export default offersController;
