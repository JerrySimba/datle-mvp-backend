import { Prisma } from "@prisma/client";

import { prisma } from "../../services/prisma";
import { AppError } from "../../middleware/errorHandler";

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const companiesService = {
  async list() {
    return prisma.company.findMany({
      orderBy: { createdAt: "desc" }
    });
  },

  async create(name: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
    const normalizedName = name.trim();
    if (!normalizedName) {
      throw new AppError("Company name is required", 400);
    }

    const baseSlug = slugify(normalizedName) || "company";
    let slug = baseSlug;
    let suffix = 1;

    while (await db.company.findUnique({ where: { slug } })) {
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }

    return db.company.create({
      data: {
        name: normalizedName,
        slug
      }
    });
  }
};
