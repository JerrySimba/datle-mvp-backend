import { NextFunction, Request, Response } from "express";

import { AppError } from "./errorHandler";
import { AuthTokenPayload, tokenService } from "../services/token";
import { prisma } from "../services/prisma";

export type AuthenticatedRequest = Request & {
  auth?: AuthTokenPayload;
};

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const authorization = req.headers.authorization;

    if (!authorization || !authorization.startsWith("Bearer ")) {
      return next(new AppError("Unauthorized", 401));
    }

    const token = authorization.slice("Bearer ".length).trim();
    const payload = tokenService.verifyToken(token);

    if (!payload) {
      return next(new AppError("Invalid token", 401));
    }

    if (payload.accountId) {
      const account = await prisma.account.findUnique({
        where: { id: payload.accountId },
        select: { sessionVersion: true, role: true, companyId: true }
      });

      if (!account) {
        return next(new AppError("Invalid token", 401));
      }

      if (payload.sessionVersion !== account.sessionVersion) {
        return next(new AppError("Session expired. Please login again.", 401));
      }

      payload.role = account.role;
      payload.companyId = account.companyId || undefined;
    }

    (req as AuthenticatedRequest).auth = payload;

    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireRoles =
  (...roles: Array<"BUSINESS" | "ADMIN">) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth?.accountId || !auth.role || !roles.includes(auth.role as "BUSINESS" | "ADMIN")) {
      return next(new AppError("Forbidden", 403));
    }

    return next();
  };
