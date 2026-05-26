import asyncHandler from "../../helpers/asyncHandler";
import { getAuthenticatedNumericUserId } from "../../helpers/requestAuth";
import type { AuthenticatedRequest } from "../../middlewares/auth.middleware";
import applicationsService from "./applications.service";
import type {
	ApplicationIdParams,
	ApplicationsQuery,
	CreateApplicationPayload
} from "./applications.schemas";

export const listCurrentApplications = asyncHandler(async (req, res) => {
	const result = await applicationsService.listCurrentApplications(
		getAuthenticatedNumericUserId(req as AuthenticatedRequest),
		req.query as unknown as ApplicationsQuery
	);

	res.status(200).json({
		success: true,
		message: "Applications fetched successfully",
		data: result
	});
});

export const listExpiredApplications = asyncHandler(async (req, res) => {
	const result = await applicationsService.listExpiredApplications(
		getAuthenticatedNumericUserId(req as AuthenticatedRequest),
		req.query as unknown as ApplicationsQuery
	);

	res.status(200).json({
		success: true,
		message: "Expired applications fetched successfully",
		data: result
	});
});

export const getApplication = asyncHandler(async (req, res) => {
	const { applicationId } = req.params as unknown as ApplicationIdParams;
	const result = await applicationsService.getApplication(
		getAuthenticatedNumericUserId(req as AuthenticatedRequest),
		applicationId
	);

	res.status(200).json({
		success: true,
		message: "Application fetched successfully",
		data: result
	});
});

export const createApplication = asyncHandler(async (req, res) => {
	const result = await applicationsService.createApplication(
		getAuthenticatedNumericUserId(req as AuthenticatedRequest),
		req.body as CreateApplicationPayload
	);

	res.status(201).json({
		success: true,
		message: "Application created successfully",
		data: result
	});
});

export const withdrawApplication = asyncHandler(async (req, res) => {
	const { applicationId } = req.params as unknown as ApplicationIdParams;
	const result = await applicationsService.withdrawApplication(
		getAuthenticatedNumericUserId(req as AuthenticatedRequest),
		applicationId
	);

	res.status(200).json({
		success: true,
		message: "Application withdrawn successfully",
		data: result
	});
});

const applicationsController = {
	listCurrentApplications,
	listExpiredApplications,
	getApplication,
	createApplication,
	withdrawApplication
};

export default applicationsController;
