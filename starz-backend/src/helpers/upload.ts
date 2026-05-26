import type { Request } from "express";
import path from "node:path";

import createHttpError from "./httpError";

type UploadKind = "image" | "document";

export const getUploadOriginalName = (req: Request): string | undefined => {
	const rawName = req.headers["x-filename"];
	return Array.isArray(rawName) ? rawName[0] : rawName;
};

export const getRawUploadBuffer = (req: Request): Buffer => {
	if (!Buffer.isBuffer(req.body)) {
		throw createHttpError(400, "Request body must be a supported binary file");
	}

	return req.body;
};

export const sanitizeUploadFilename = (filename?: string): string | undefined => {
	if (!filename) {
		return undefined;
	}

	const basename = path.basename(filename).trim().normalize("NFC");
	const sanitized = basename.replace(/[^\p{L}\p{N}._ -]/gu, "_").replace(/\s+/g, "_");

	return sanitized.length > 0 ? sanitized.slice(0, 255) : undefined;
};

const hasPrefix = (buffer: Buffer, bytes: number[]): boolean =>
	buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);

const isJpeg = (buffer: Buffer): boolean => hasPrefix(buffer, [0xff, 0xd8, 0xff]);

const isPng = (buffer: Buffer): boolean =>
	hasPrefix(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const isWebp = (buffer: Buffer): boolean =>
	buffer.length >= 12 &&
	buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
	buffer.subarray(8, 12).toString("ascii") === "WEBP";

const isPdf = (buffer: Buffer): boolean => buffer.subarray(0, 5).toString("ascii") === "%PDF-";

const isDoc = (buffer: Buffer): boolean =>
	hasPrefix(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

const isDocx = (buffer: Buffer): boolean => hasPrefix(buffer, [0x50, 0x4b, 0x03, 0x04]);

const matchesExtension = (buffer: Buffer, extension: string): boolean => {
	switch (extension) {
		case "jpg":
		case "jpeg":
			return isJpeg(buffer);
		case "png":
			return isPng(buffer);
		case "webp":
			return isWebp(buffer);
		case "pdf":
			return isPdf(buffer);
		case "doc":
			return isDoc(buffer);
		case "docx":
			return isDocx(buffer);
		default:
			return false;
	}
};

export const assertUploadSignature = (
	buffer: Buffer,
	extension: string,
	kind: UploadKind
): void => {
	if (!matchesExtension(buffer, extension)) {
		throw createHttpError(400, "Uploaded file content does not match its type");
	}

	if (kind === "image" && !["jpg", "jpeg", "png", "webp"].includes(extension)) {
		throw createHttpError(400, "Unsupported file type");
	}

	if (kind === "document" && !["pdf", "doc", "docx"].includes(extension)) {
		throw createHttpError(400, "Unsupported file type");
	}
};
