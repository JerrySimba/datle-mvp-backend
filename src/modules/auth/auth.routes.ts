import { Router } from "express";

import { accountAuthService, otpService } from "./auth.service";
import {
  loginAccountSchema,
  registerAccountSchema,
  registerBusinessSchema,
  requestOtpSchema,
  updateAccountRoleSchema,
  verifyOtpSchema
} from "./auth.schema";
import { validateBody } from "../../utils/validate";
import { AuthenticatedRequest, requireAuth, requireRoles } from "../../middleware/auth";

export const authRouter = Router();

authRouter.post("/request-otp", async (req, res, next) => {
  try {
    const data = validateBody(requestOtpSchema, req.body);
    const result = await otpService.requestOtp(data.email, req.ip || req.socket.remoteAddress || "unknown");
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/verify-otp", async (req, res, next) => {
  try {
    const data = validateBody(verifyOtpSchema, req.body);
    const result = await otpService.verifyOtp(data.email, data.otp, req.ip || req.socket.remoteAddress || "unknown");
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const data = validateBody(registerAccountSchema, req.body);
    const result = await accountAuthService.register(data, req.ip || req.socket.remoteAddress || "unknown");
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/business/register", async (req, res, next) => {
  try {
    const data = validateBody(registerBusinessSchema, req.body);
    const result = await accountAuthService.registerBusiness(data, req.ip || req.socket.remoteAddress || "unknown");
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const data = validateBody(loginAccountSchema, req.body);
    const result = await accountAuthService.login(data, req.ip || req.socket.remoteAddress || "unknown");
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", requireAuth, async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    if (!auth?.accountId) {
      return res.status(200).json({ message: "Logged out" });
    }
    await accountAuthService.logout(auth.accountId, req.ip || req.socket.remoteAddress || "unknown");
    res.status(200).json({ message: "Logged out" });
  } catch (error) {
    next(error);
  }
});

authRouter.patch("/accounts/:id/role", requireAuth, requireRoles("ADMIN"), async (req, res, next) => {
  try {
    const auth = (req as AuthenticatedRequest).auth;
    const data = validateBody(updateAccountRoleSchema, req.body);
    const result = await accountAuthService.updateRole(req.params.id, data.role, {
      accountId: auth?.accountId || "",
      email: auth?.email
    }, data.company_id);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.get("/accounts", requireAuth, requireRoles("ADMIN"), async (_req, res, next) => {
  try {
    const result = await accountAuthService.listAccounts();
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
