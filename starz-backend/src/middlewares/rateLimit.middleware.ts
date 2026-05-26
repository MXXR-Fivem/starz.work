import type { NextFunction, Request, RequestHandler, Response } from "express";

interface RateLimitOptions {
	windowMs: number;
	maxRequests: number;
	keyPrefix?: string;
}

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

const bucket = new Map<string, RateLimitEntry>();

const now = (): number => Date.now();

const maybeCleanup = (timestamp: number): void => {
	if (bucket.size < 5000) {
		return;
	}

	for (const [key, value] of bucket.entries()) {
		if (value.resetAt <= timestamp) {
			bucket.delete(key);
		}
	}
};

export const createRateLimiter = ({
	windowMs,
	maxRequests,
	keyPrefix = "global"
}: RateLimitOptions): RequestHandler => {
	return (req: Request, res: Response, next: NextFunction): void => {
		const timestamp = now();
		maybeCleanup(timestamp);

		const clientIp = req.ip || req.socket.remoteAddress || "unknown";
		const key = `${keyPrefix}:${clientIp}`;
		const current = bucket.get(key);

		if (!current || current.resetAt <= timestamp) {
			res.setHeader("X-RateLimit-Limit", String(maxRequests));
			res.setHeader("X-RateLimit-Remaining", String(maxRequests - 1));
			res.setHeader("X-RateLimit-Reset", String(Math.ceil((timestamp + windowMs) / 1000)));
			bucket.set(key, {
				count: 1,
				resetAt: timestamp + windowMs
			});
			next();
			return;
		}

		if (current.count >= maxRequests) {
			const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - timestamp) / 1000));
			res.setHeader("Retry-After", String(retryAfterSeconds));
			res.setHeader("X-RateLimit-Limit", String(maxRequests));
			res.setHeader("X-RateLimit-Remaining", "0");
			res.setHeader("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));
			res.status(429).json({
				success: false,
				message: "Too many requests, please try again later"
			});
			return;
		}

		current.count += 1;
		bucket.set(key, current);
		res.setHeader("X-RateLimit-Limit", String(maxRequests));
		res.setHeader("X-RateLimit-Remaining", String(Math.max(0, maxRequests - current.count)));
		res.setHeader("X-RateLimit-Reset", String(Math.ceil(current.resetAt / 1000)));
		next();
	};
};

export default createRateLimiter;
