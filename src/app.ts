import cors from "cors";
import express from "express";

import { env } from "./config/env";
import { rateLimiter } from "./middleware/rateLimiter";
import { requestLogger } from "./middleware/requestLogger";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { analyticsRouter } from "./modules/analytics/analytics.routes";
import { authRouter } from "./modules/auth/auth.routes";
import { respondentsRouter } from "./modules/respondents/respondents.routes";
import { studiesRouter } from "./modules/studies/studies.routes";
import { responsesRouter } from "./modules/responses/responses.routes";

const app = express();

const corsOrigins = env.CORS_ORIGIN.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins
  })
);
app.use(express.json());
app.use(requestLogger);
app.use(rateLimiter);

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/respondents", respondentsRouter);
app.use("/api/studies", studiesRouter);
app.use("/api/responses", responsesRouter);
app.use("/api/analytics", analyticsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
