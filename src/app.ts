import cors from "cors";
import express from "express";

import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { authRouter } from "./modules/auth/auth.routes";
import { respondentsRouter } from "./modules/respondents/respondents.routes";
import { studiesRouter } from "./modules/studies/studies.routes";
import { responsesRouter } from "./modules/responses/responses.routes";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/respondents", respondentsRouter);
app.use("/api/studies", studiesRouter);
app.use("/api/responses", responsesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export { app };
