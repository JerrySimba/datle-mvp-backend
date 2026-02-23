import { NextFunction, Request, Response } from "express";

import { env } from "../config/env";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

const getClientKey = (req: Request) => req.ip || req.socket.remoteAddress || "unknown";

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  // Avoid flaky test behavior from shared process state.
  if (env.NODE_ENV === "test") {
    return next();
  }

  const now = Date.now();
  const key = getClientKey(req);
  const existing = buckets.get(key);

  if (!existing || now > existing.resetAt) {
    buckets.set(key, {
      count: 1,
      resetAt: now + env.RATE_LIMIT_WINDOW_MS
    });
    return next();
  }

  if (existing.count >= env.RATE_LIMIT_MAX_REQUESTS) {
    const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
    res.setHeader("Retry-After", retryAfterSeconds.toString());
    return res.status(429).json({ message: "Too many requests" });
  }

  existing.count += 1;
  return next();
};
