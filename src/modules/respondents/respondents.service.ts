import { prisma } from "../../services/prisma";

import { AppError } from "../../middleware/errorHandler";

type CreateRespondentInput = {
  email: string;
  age: number;
  gender: string;
  location: string;
  income_band: string;
  education: string;
  employment_status: string;
};

export const respondentsService = {
  async create(data: CreateRespondentInput) {
    return prisma.respondent.create({
      data: {
        email: data.email.toLowerCase(),
        age: data.age,
        gender: data.gender,
        location: data.location,
        incomeBand: data.income_band,
        education: data.education,
        employmentStatus: data.employment_status
      }
    });
  },

  async findById(id: string) {
    const respondent = await prisma.respondent.findUnique({ where: { id } });

    if (!respondent) {
      throw new AppError("Respondent not found", 404);
    }

    return respondent;
  }
};
