import { NextFunction, Request, Response } from "express";

interface RateLimitEntry {
	count: number;
	resetAt: number;
}

/**
 * Simple in-memory rate limiter.
 * For production use a Redis-backed solution (e.g. express-rate-limit + rate-limit-redis).
 */
const store = new Map<string, RateLimitEntry>();

const cleanup = () => {
	const now = Date.now();
	for (const [key, entry] of store.entries()) {
		if (entry.resetAt < now) store.delete(key);
	}
};

// Clean up stale entries every 5 minutes
setInterval(cleanup, 5 * 60 * 1000);

export const createRateLimiter = (
	windowMs: number,
	max: number,
	message = "Too many requests, please try again later.",
) => {
	return (req: Request, res: Response, next: NextFunction): void => {
		const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";
		const key = `${req.path}:${ip}`;
		const now = Date.now();

		const entry = store.get(key);

		if (!entry || entry.resetAt < now) {
			store.set(key, { count: 1, resetAt: now + windowMs });
			next();
			return;
		}

		entry.count += 1;

		if (entry.count > max) {
			res.status(429).json({ success: false, message });
			return;
		}

		next();
	};
};

/** Pre-configured limiter for auth endpoints (20 req / 15 min per IP) */
export const authRateLimiter = createRateLimiter(
	15 * 60 * 1000,
	20,
	"Too many authentication attempts. Please try again in 15 minutes.",
);
