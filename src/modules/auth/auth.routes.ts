import { Router } from "express";

import { otpService } from "./auth.service";
import { requestOtpSchema, verifyOtpSchema } from "./auth.schema";
import { validateBody } from "../../utils/validate";

export const authRouter = Router();

authRouter.post("/request-otp", async (req, res, next) => {
  try {
    const data = validateBody(requestOtpSchema, req.body);
    const result = await otpService.requestOtp(data.email);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/verify-otp", (req, res, next) => {
  try {
    const data = validateBody(verifyOtpSchema, req.body);
    const result = otpService.verifyOtp(data.email, data.otp);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});
