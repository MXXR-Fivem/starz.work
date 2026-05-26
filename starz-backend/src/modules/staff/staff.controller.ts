import type { Request } from "express";

import asyncHandler from "../../helpers/asyncHandler";
import { getAuthenticatedNumericUserId } from "../../helpers/requestAuth";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import staffService from "./staff.service";
import type {
	StaffBanUserPayload,
	StaffCompanyParams,
	StaffListCompaniesQuery,
	StaffListModerationLogsQuery,
	StaffListUsersQuery,
	StaffModerationStatusPayload,
	StaffOfferParams,
	StaffUpdateCompanyPayload,
	StaffUpdateOfferPayload,
	StaffUserParams
} from "./staff.schemas";

const currentUserId = (req: Request): number =>
	getAuthenticatedNumericUserId(req as AuthenticatedRequest);

export const getData = asyncHandler(async (req, res) => {
	const result = await staffService.getData(currentUserId(req));
	res.status(200).json({ success: true, message: "Staff data fetched successfully", data: result });
});

export const listUsers = asyncHandler(async (req, res) => {
	const result = await staffService.listUsers(
		currentUserId(req),
		req.query as unknown as StaffListUsersQuery
	);
	res.status(200).json({ success: true, message: "Users fetched successfully", data: result });
});

export const listLogs = asyncHandler(async (req, res) => {
	const result = await staffService.listLogs(
		currentUserId(req),
		req.query as unknown as StaffListModerationLogsQuery
	);
	res.status(200).json({ success: true, message: "Moderation logs fetched successfully", data: result });
});

export const getUser = asyncHandler(async (req, res) => {
	const { userId } = req.params as unknown as StaffUserParams;
	const result = await staffService.getUser(currentUserId(req), userId);
	res.status(200).json({ success: true, message: "User fetched successfully", data: result });
});

export const banUser = asyncHandler(async (req, res) => {
	const { userId } = req.params as unknown as StaffUserParams;
	const result = await staffService.banUser(
		currentUserId(req),
		userId,
		req.body as StaffBanUserPayload
	);
	res.status(200).json({ success: true, message: "User banned successfully", data: result });
});

export const unbanUser = asyncHandler(async (req, res) => {
	const { userId } = req.params as unknown as StaffUserParams;
	const result = await staffService.unbanUser(currentUserId(req), userId);
	res.status(200).json({ success: true, message: "User unbanned successfully", data: result });
});

export const deleteUser = asyncHandler(async (req, res) => {
	const { userId } = req.params as unknown as StaffUserParams;
	await staffService.deleteUser(currentUserId(req), userId);
	res.status(200).json({ success: true, message: "User deleted successfully" });
});

export const listCompanies = asyncHandler(async (req, res) => {
	const result = await staffService.listCompanies(
		currentUserId(req),
		req.query as unknown as StaffListCompaniesQuery
	);
	res.status(200).json({ success: true, message: "Companies fetched successfully", data: result });
});

export const getCompany = asyncHandler(async (req, res) => {
	const { companyId } = req.params as unknown as StaffCompanyParams;
	const result = await staffService.getCompany(currentUserId(req), companyId);
	res.status(200).json({ success: true, message: "Company fetched successfully", data: result });
});

export const updateCompany = asyncHandler(async (req, res) => {
	const { companyId } = req.params as unknown as StaffCompanyParams;
	const result = await staffService.updateCompany(
		currentUserId(req),
		companyId,
		req.body as StaffUpdateCompanyPayload
	);
	res.status(200).json({ success: true, message: "Company updated successfully", data: result });
});

export const deleteCompany = asyncHandler(async (req, res) => {
	const { companyId } = req.params as unknown as StaffCompanyParams;
	await staffService.deleteCompany(currentUserId(req), companyId);
	res.status(200).json({ success: true, message: "Company deleted successfully" });
});

export const syncWeLoveDevs = asyncHandler(async (req, res) => {
	const result = await staffService.syncWeLoveDevs(currentUserId(req));
	res.status(200).json({ success: true, message: "WeLoveDevs sync completed", data: result });
});

export const listOffers = asyncHandler(async (req, res) => {
	const result = await staffService.listOffers(currentUserId(req), req.query);
	res.status(200).json({ success: true, message: "Offers fetched successfully", data: result });
});

export const updateOffer = asyncHandler(async (req, res) => {
	const { offerId } = req.params as unknown as StaffOfferParams;
	const result = await staffService.updateOffer(
		currentUserId(req),
		offerId,
		req.body as StaffUpdateOfferPayload
	);
	res.status(200).json({ success: true, message: "Offer updated successfully", data: result });
});

export const deleteOffer = asyncHandler(async (req, res) => {
	const { offerId } = req.params as unknown as StaffOfferParams;
	await staffService.deleteOffer(currentUserId(req), offerId);
	res.status(200).json({ success: true, message: "Offer deleted successfully" });
});

export const updateOfferModerationStatus = asyncHandler(async (req, res) => {
	const { offerId } = req.params as unknown as StaffOfferParams;
	const result = await staffService.updateOfferModerationStatus(
		currentUserId(req),
		offerId,
		req.body as StaffModerationStatusPayload
	);
	res.status(200).json({ success: true, message: "Offer moderation updated successfully", data: result });
});

const staffController = {
	getData,
	listLogs,
	listUsers,
	getUser,
	banUser,
	unbanUser,
	deleteUser,
	listCompanies,
	getCompany,
	updateCompany,
	deleteCompany,
	syncWeLoveDevs,
	listOffers,
	updateOffer,
	deleteOffer,
	updateOfferModerationStatus
};

export default staffController;
