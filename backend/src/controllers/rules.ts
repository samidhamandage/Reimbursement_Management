import { Response } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";

const ruleSchema = z.object({
  name: z.string().min(3),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  enablePercentageRule: z.boolean().default(false),
  minApprovalPercentage: z.number().min(0).max(100).default(100),
  enableSpecificRule: z.boolean().default(false),
  specificApproverId: z.string().optional().nullable(),
  includeDirectManager: z.boolean().default(false),
  steps: z.array(z.object({ order: z.number().int().positive(), userId: z.string() })).optional().default([]),
});

/**
 * Get all approval rules (Admin only)
 */
export const getRules = async (_req: AuthRequest, res: Response) => {
  const rules = await prisma.approvalRule.findMany({
    include: {
      steps: { orderBy: { order: "asc" } },
      _count: { select: { expenses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ rules });
};

/**
 * Get single rule detail
 */
export const getRuleById = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const rule = await prisma.approvalRule.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  res.json({ rule });
};

/**
 * Create a new approval rule
 */
export const createRule = async (req: AuthRequest, res: Response) => {
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

  const { steps, ...ruleData } = parsed.data;

  const existing = await prisma.approvalRule.findFirst({ where: { name: ruleData.name } });
  if (existing) return res.status(409).json({ error: "A rule with this name already exists" });

  const rule = await prisma.approvalRule.create({
    data: {
      ...ruleData,
      specificApproverId: ruleData.specificApproverId ?? null,
      steps: { create: steps.map(({ order, userId }) => ({ order, userId })) },
    },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  res.status(201).json({ rule });
};

/**
 * Update an existing rule and its steps
 */
export const updateRule = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const parsed = ruleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

  const { steps, ...ruleData } = parsed.data;

  const rule = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Replace steps by deleting old ones first
    await tx.approvalStep.deleteMany({ where: { ruleId: id } });
    
    return tx.approvalRule.update({
      where: { id },
      data: {
        ...ruleData,
        specificApproverId: ruleData.specificApproverId ?? null,
        steps: { create: steps.map(({ order, userId }) => ({ order, userId })) },
      },
      include: { steps: { orderBy: { order: "asc" } } },
    });
  });
  res.json({ rule });
};

/**
 * Delete an approval rule
 */
export const deleteRule = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  await prisma.approvalRule.delete({ where: { id } });
  res.json({ message: "Rule deleted successfully" });
};

/**
 * Toggle rule activation status
 */
export const toggleRule = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;
  const rule = await prisma.approvalRule.findUnique({ where: { id } });
  if (!rule) return res.status(404).json({ error: "Rule not found" });

  const updated = await prisma.approvalRule.update({ where: { id }, data: { isActive: !rule.isActive } });
  res.json({ rule: updated });
};
