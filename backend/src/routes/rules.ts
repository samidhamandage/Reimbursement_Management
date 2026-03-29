import { Router, Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, requireRole, AuthRequest } from "../middleware/auth";

export const rulesRouter = Router();
rulesRouter.use(authenticate, requireRole("ADMIN"));

const ruleSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  minApprovalPercentage: z.number().min(0).max(100).default(100),
  includeDirectManager: z.boolean().default(false),
  overrideApproverId: z.string().optional().nullable(),
  steps: z.array(z.object({ order: z.number().int().positive(), userId: z.string() })).optional().default([]),
});

// ─── GET /api/rules ────────────────────────────────────────────────────────

rulesRouter.get("/", async (_req: AuthRequest, res: Response): Promise<void> => {
  const rules = await prisma.approvalRule.findMany({
    include: {
      steps: { orderBy: { order: "asc" } },
      _count: { select: { expenses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ rules });
});

// ─── GET /api/rules/:id ────────────────────────────────────────────────────

rulesRouter.get("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params["id"] as string;
  const rule = await prisma.approvalRule.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!rule) { res.status(404).json({ error: "Rule not found" }); return; }
  res.json({ rule });
});

// ─── POST /api/rules ───────────────────────────────────────────────────────

rulesRouter.post("/", async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const { steps, ...ruleData } = parsed.data;

  const existing = await prisma.approvalRule.findFirst({ where: { name: ruleData.name } });
  if (existing) { res.status(409).json({ error: "A rule with this name already exists" }); return; }

  const rule = await prisma.approvalRule.create({
    data: {
      ...ruleData,
      overrideApproverId: ruleData.overrideApproverId ?? null,
      steps: { create: steps.map(({ order, userId }: { order: number; userId: string }) => ({ order, userId })) },
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  res.status(201).json({ rule });
});

// ─── PUT /api/rules/:id ────────────────────────────────────────────────────

rulesRouter.put("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params["id"] as string;
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() }); return; }

  const { steps, ...ruleData } = parsed.data;

  const rule = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.approvalStep.deleteMany({ where: { ruleId: id } });
    return tx.approvalRule.update({
      where: { id },
      data: {
        ...ruleData,
        overrideApproverId: ruleData.overrideApproverId ?? null,
        steps: { create: steps.map(({ order, userId }: { order: number; userId: string }) => ({ order, userId })) },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
  });
  res.json({ rule });
});

// ─── DELETE /api/rules/:id ─────────────────────────────────────────────────

rulesRouter.delete("/:id", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params["id"] as string;
  await prisma.approvalRule.delete({ where: { id } });
  res.json({ message: "Rule deleted successfully" });
});

// ─── PATCH /api/rules/:id/toggle ──────────────────────────────────────────

rulesRouter.patch("/:id/toggle", async (req: AuthRequest, res: Response): Promise<void> => {
  const id = req.params["id"] as string;
  const rule = await prisma.approvalRule.findUnique({ where: { id } });
  if (!rule) { res.status(404).json({ error: "Rule not found" }); return; }

  const updated = await prisma.approvalRule.update({ where: { id }, data: { isActive: !rule.isActive } });
  res.json({ rule: updated });
});
