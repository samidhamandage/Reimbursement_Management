import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { io } from "../lib/socket";

const createExpenseSchema = z.object({
  description: z.string().min(3),
  amount: z.number().positive(),
  currency: z.string().length(3),
  convertedAmount: z.number().positive(),
  category: z.string().min(1),
  date: z.string(),
  receiptUrl: z.string().optional(),
  ocrRawText: z.string().optional(),
  ruleId: z.string().optional(),
});

const actionSchema = z.object({
  comment: z.string().min(3),
});

/**
 * Get all expenses with role-based filtering
 */
export const getExpenses = async (req: AuthRequest, res: Response) => {
  const { role, id: userId } = req.user!;
  const where: any = {};

  if (role === "EMPLOYEE") {
    where.employeeId = userId;
  } else if (role === "MANAGER") {
    const reports = await prisma.user.findMany({
      where: { managerId: userId },
      select: { id: true },
    });
    where.employeeId = { in: reports.map((r) => r.id) };
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, email: true, role: true } },
      approvalLogs: {
        include: { approver: { select: { id: true, name: true } } },
        orderBy: { step: "asc" },
      },
      rule: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  res.json({ expenses });
};

/**
 * Get single expense detail
 */
export const getExpenseById = async (req: AuthRequest, res: Response) => {
  const id = req.params.id as string;

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, email: true } },
      approvalLogs: {
        include: { approver: { select: { id: true, name: true } } },
        orderBy: { step: "asc" },
      },
      rule: true,
    },
  });

  if (!expense) {
    return res.status(404).json({ error: "Expense not found" });
  }

  if (req.user!.role === "EMPLOYEE" && expense.employeeId !== req.user!.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.json({ expense });
};

/**
 * Create a new expense reimbursement request
 */
export const createExpense = async (req: AuthRequest, res: Response) => {
  const parsed = createExpenseSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });
  }

  const data = parsed.data;
  let ruleId = data.ruleId;
  
  if (!ruleId) {
    try {
      const defaultRule = await prisma.approvalRule.findFirst({ 
        where: { isActive: true }, 
        orderBy: { createdAt: "asc" } 
      });
      ruleId = defaultRule?.id || null;
    } catch (error) {
      console.error("Failed to fetch default rule:", error);
      ruleId = null;
    }
  }

  const expense = await prisma.expense.create({
    data: {
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      convertedAmount: data.convertedAmount,
      category: data.category,
      date: new Date(data.date),
      receiptUrl: data.receiptUrl || null,
      ocrRawText: data.ocrRawText || null,
      status: "WAITING_APPROVAL",
      employeeId: req.user!.id,
      ruleId: ruleId,
    },
    include: {
      employee: { select: { id: true, name: true, email: true } },
    },
  });

  // Notify Managers & Admins in real-time
  const socketPayload = {
    id: expense.id,
    description: expense.description,
    amount: expense.convertedAmount,
    employee: expense.employee.name,
  };

  io.to("MANAGER").emit("expense_submitted", socketPayload);
  io.to("ADMIN").emit("expense_submitted", socketPayload);

  res.status(201).json({ expense });
};

/**
 * Approve an expense (Manager/Admin)
 */
export const approveExpense = async (req: AuthRequest, res: Response) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Validation failed" });
  }

  const { comment } = parsed.data;
  const expenseId = req.params.id as string;

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      rule: { include: { steps: { orderBy: { order: "asc" } } } },
      approvalLogs: true,
      employee: { select: { id: true, name: true } },
    },
  });

  if (!expense) return res.status(404).json({ error: "Expense not found" });
  if (expense.status !== "WAITING_APPROVAL") return res.status(400).json({ error: `Already ${expense.status}` });

  const currentStep = expense.approvalLogs.length + 1;
  const totalSteps = expense.rule?.steps.length ?? 1;

  await prisma.approvalLog.create({
    data: { expenseId: expense.id, approverId: req.user!.id, action: "APPROVED", comment, step: currentStep },
  });

  const newStatus = (currentStep >= totalSteps || req.user!.role === "ADMIN") ? "APPROVED" : "WAITING_APPROVAL";

  const updated = await prisma.expense.update({
    where: { id: expense.id },
    data: { status: newStatus },
    include: { employee: { select: { id: true, name: true } } },
  });

  if (newStatus === "APPROVED") {
    io.to(updated.employee.id).emit("expense_approved", {
      id: updated.id,
      description: updated.description,
      approver: req.user!.name,
    });
  }

  res.json({ expense: updated });
};

/**
 * Reject an expense (Manager/Admin)
 */
export const rejectExpense = async (req: AuthRequest, res: Response) => {
  const parsed = actionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Validation failed" });

  const { comment } = parsed.data;
  const expenseId = req.params.id as string;

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { employee: { select: { id: true, name: true } } },
  });

  if (!expense) return res.status(404).json({ error: "Expense not found" });
  if (expense.status !== "WAITING_APPROVAL") return res.status(400).json({ error: `Already ${expense.status}` });

  const currentStep = (await prisma.approvalLog.count({ where: { expenseId } })) + 1;

  await prisma.approvalLog.create({
    data: { expenseId, approverId: req.user!.id, action: "REJECTED", comment, step: currentStep },
  });

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: { status: "REJECTED", rejectionReason: comment },
    include: { employee: { select: { id: true, name: true } } },
  });

  io.to(updated.employee.id).emit("expense_rejected", {
    id: updated.id,
    description: updated.description,
    rejectionReason: comment,
    rejectedBy: req.user!.name,
  });

  res.json({ expense: updated });
};
