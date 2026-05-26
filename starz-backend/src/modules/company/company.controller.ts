import type { Request } from "express";

import asyncHandler from "../../helpers/asyncHandler";
import { getAuthenticatedNumericUserId } from "../../helpers/requestAuth";
import { getRawUploadBuffer, getUploadOriginalName } from "../../helpers/upload";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import companyService from "./company.service";
import type {
	CompanyApplicationParams,
	CompanyApplicationStatusPayload,
	CompanyApplicationsQuery,
	CompanyOffersQuery,
	CompanyInvitationParams,
	CompanyMemberParams,
	CompanyOfferParams,
	CreateCompanyOfferPayload,
	CreateCompanyPayload,
	InviteMemberPayload,
	UpdateCompanyOfferPayload,
	UpdateCompanyPayload
} from "./company.schemas";

const currentUserId = (req: Request): number =>
	getAuthenticatedNumericUserId(req as AuthenticatedRequest);

export const getCompany = asyncHandler(async (req, res) => {
	const result = await companyService.getCompany(currentUserId(req));
	res.status(200).json({ success: true, message: "Company fetched successfully", data: result });
});

export const getData = asyncHandler(async (req, res) => {
	const result = await companyService.getCompanyData(currentUserId(req));
	res.status(200).json({ success: true, message: "Company data fetched successfully", data: result });
});

export const createCompany = asyncHandler(async (req, res) => {
	const result = await companyService.createCompany(
		currentUserId(req),
		req.body as CreateCompanyPayload
	);
	res.status(201).json({ success: true, message: "Company created successfully", data: result });
});

export const updateCompany = asyncHandler(async (req, res) => {
	const result = await companyService.updateCompany(
		currentUserId(req),
		req.body as UpdateCompanyPayload
	);
	res.status(200).json({ success: true, message: "Company updated successfully", data: result });
});

export const uploadLogo = asyncHandler(async (req, res) => {
	const result = await companyService.saveCompanyLogo({
		userId: currentUserId(req),
		buffer: getRawUploadBuffer(req),
		contentType: req.headers["content-type"],
		originalName: getUploadOriginalName(req)
	});
	res.status(200).json({ success: true, message: "Company logo uploaded successfully", data: result });
});

export const listMembers = asyncHandler(async (req, res) => {
	const result = await companyService.listMembers(currentUserId(req));
	res.status(200).json({ success: true, message: "Company members fetched successfully", data: result });
});

export const listActivity = asyncHandler(async (req, res) => {
	const result = await companyService.listActivity(currentUserId(req));
	res.status(200).json({ success: true, message: "Company activity fetched successfully", data: result });
});

export const inviteMember = asyncHandler(async (req, res) => {
	const result = await companyService.inviteMember(
		currentUserId(req),
		req.body as InviteMemberPayload
	);
	res.status(201).json({ success: true, message: "Invitation created successfully", data: result });
});

export const listInvitations = asyncHandler(async (req, res) => {
	const result = await companyService.listInvitations(currentUserId(req));
	res.status(200).json({ success: true, message: "Invitations fetched successfully", data: result });
});

export const acceptInvitation = asyncHandler(async (req, res) => {
	const { invitationId } = req.params as unknown as CompanyInvitationParams;
	const result = await companyService.acceptInvitation(currentUserId(req), invitationId);
	res.status(200).json({ success: true, message: "Invitation accepted successfully", data: result });
});

export const declineInvitation = asyncHandler(async (req, res) => {
	const { invitationId } = req.params as unknown as CompanyInvitationParams;
	const result = await companyService.declineInvitation(currentUserId(req), invitationId);
	res.status(200).json({ success: true, message: "Invitation declined successfully", data: result });
});

export const kickMember = asyncHandler(async (req, res) => {
	const { userId } = req.params as unknown as CompanyMemberParams;
	await companyService.kickMember(currentUserId(req), userId);
	res.status(200).json({ success: true, message: "Company member removed successfully" });
});

export const leaveCompany = asyncHandler(async (req, res) => {
	await companyService.leaveCompany(currentUserId(req));
	res.status(200).json({ success: true, message: "Company left successfully" });
});

export const listOffers = asyncHandler(async (req, res) => {
	const result = await companyService.listOffers(
		currentUserId(req),
		req.query as unknown as CompanyOffersQuery
	);
	res.status(200).json({ success: true, message: "Company offers fetched successfully", data: result });
});

export const createOffer = asyncHandler(async (req, res) => {
	const result = await companyService.createOffer(
		currentUserId(req),
		req.body as CreateCompanyOfferPayload
	);
	res.status(201).json({ success: true, message: "Company offer created successfully", data: result });
});

export const updateOffer = asyncHandler(async (req, res) => {
	const { offerId } = req.params as unknown as CompanyOfferParams;
	const result = await companyService.updateOffer(
		currentUserId(req),
		offerId,
		req.body as UpdateCompanyOfferPayload
	);
	res.status(200).json({ success: true, message: "Company offer updated successfully", data: result });
});

export const closeOffer = asyncHandler(async (req, res) => {
	const { offerId } = req.params as unknown as CompanyOfferParams;
	const result = await companyService.closeOffer(currentUserId(req), offerId);
	res.status(200).json({ success: true, message: "Company offer closed successfully", data: result });
});

export const listOfferApplications = asyncHandler(async (req, res) => {
	const { offerId } = req.params as unknown as CompanyOfferParams;
	const result = await companyService.listOfferApplications(
		currentUserId(req),
		offerId,
		req.query as unknown as CompanyApplicationsQuery
	);
	res.status(200).json({ success: true, message: "Offer applications fetched successfully", data: result });
});

export const getOfferApplication = asyncHandler(async (req, res) => {
	const { offerId, applicationId } = req.params as unknown as CompanyApplicationParams;
	const result = await companyService.getOfferApplication(
		currentUserId(req),
		offerId,
		applicationId
	);
	res.status(200).json({ success: true, message: "Offer application fetched successfully", data: result });
});

export const updateApplicationStatus = asyncHandler(async (req, res) => {
	const { offerId, applicationId } = req.params as unknown as CompanyApplicationParams;
	const result = await companyService.updateApplicationStatus(
		currentUserId(req),
		offerId,
		applicationId,
		req.body as CompanyApplicationStatusPayload
	);
	res.status(200).json({ success: true, message: "Application status updated successfully", data: result });
});

const companyController = {
	getCompany,
	getData,
	createCompany,
	updateCompany,
	uploadLogo,
	listMembers,
	listActivity,
	inviteMember,
	listInvitations,
	acceptInvitation,
	declineInvitation,
	kickMember,
	leaveCompany,
	listOffers,
	createOffer,
	updateOffer,
	closeOffer,
	listOfferApplications,
	getOfferApplication,
	updateApplicationStatus
};

export default companyController;
