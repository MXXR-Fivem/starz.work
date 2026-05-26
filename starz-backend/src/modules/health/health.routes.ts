const express = require("express");
import type { Request, Response } from "express";

const router = express.Router();

router.get("/", (_req: Request, res: Response) => {
	res.status(200).json({
		success: true,
		message: "API is healthy"
	});
});

export const basePath = "/health";
export default router;
