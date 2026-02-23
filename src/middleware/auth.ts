import { NextFunction, Request, Response } from "express";

import { AppError } from "./errorHandler";
import { tokenService } from "../services/token";

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    return next(new AppError("Unauthorized", 401));
  }

  const token = authorization.slice("Bearer ".length).trim();
  const payload = tokenService.verifyToken(token);

  if (!payload) {
    return next(new AppError("Invalid token", 401));
  }

  return next();
};
