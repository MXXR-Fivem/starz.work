import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { RowDataPacket } from "mysql2/promise";

import pool from "../config/database";
import { getAuthenticatedNumericUserId } from "../helpers/requestAuth";
import authMiddleware, { type AuthenticatedRequest } from "./auth.middleware";

interface UploadUserRow extends RowDataPacket {
	orga_id: number | null;
	role_name: string | null;
}

interface ExistingRow extends RowDataPacket {
	id: number;
}

const authenticate = async (req: Request, res: Response): Promise<boolean> => {
	let authenticated = false;

	await authMiddleware(req as AuthenticatedRequest, res, (() => {
		authenticated = true;
	}) as NextFunction);

	return authenticated;
};

const isPrivateUserCvRequest = (req: Request): boolean => {
	const filename = String(req.params.filename ?? "");
	return filename.startsWith("cv-");
};

const getUploadPath = (req: Request): string => req.originalUrl.split("?")[0];

const canAccessCv = async (
	requestUserId: number,
	fileOwnerId: number,
	uploadPath: string
): Promise<boolean> => {
	if (requestUserId === fileOwnerId) {
		return true;
	}

	const [userRows] = await pool.query<UploadUserRow[]>(
		`
			SELECT u.orga_id, r.name AS role_name
			FROM users u
			LEFT JOIN roles r ON r.id = u.role_id
			WHERE u.id = ?
			LIMIT 1
		`,
		[requestUserId]
	);
	const user = userRows[0];

	if (!user) {
		return false;
	}

	if (user.role_name === "admin") {
		return true;
	}

	if (!user.orga_id) {
		return false;
	}

	const [applicationRows] = await pool.query<ExistingRow[]>(
		`
			SELECT a.id
			FROM applications a
			INNER JOIN offers o ON o.id = a.offer_id
			WHERE a.user_id = ?
				AND a.resume_url = ?
				AND o.company_id = ?
			LIMIT 1
		`,
		[fileOwnerId, uploadPath, user.orga_id]
	);

	return applicationRows.length > 0;
};

const privateUploadMiddleware: RequestHandler = async (req, res, next) => {
	if (!isPrivateUserCvRequest(req)) {
		next();
		return;
	}

	const authenticated = await authenticate(req, res);

	if (!authenticated) {
		return;
	}

	const fileOwnerId = Number(req.params.userId);

	if (!Number.isInteger(fileOwnerId) || fileOwnerId <= 0) {
		res.status(404).json({ success: false, message: "File not found" });
		return;
	}

	const canAccess = await canAccessCv(
		getAuthenticatedNumericUserId(req as AuthenticatedRequest),
		fileOwnerId,
		getUploadPath(req)
	);

	if (!canAccess) {
		res.status(403).json({ success: false, message: "Forbidden" });
		return;
	}

	next();
};

export default privateUploadMiddleware;
