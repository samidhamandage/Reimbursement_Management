import { Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { AuthRequest } from "../middleware/auth";
import { io } from "../lib/socket";
import { runApprovalEngine } from "../lib/approvalEngine";

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
    where.OR = [
      { employee: { managerId: userId } },
      { rule: { steps: { some: { userId } } } },
      { rule: { specificApproverId: userId } }
    ];
  }

  const expenses = await prisma.expense.findMany({
    where,
    include: {
      employee: { select: { id: true, name: true, email: true, managerId: true } },
      approvalLogs: { include: { approver: { select: { name: true } } } },
      rule: { include: { steps: true } },
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
  const currentUser = req.user!;

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      rule: { include: { steps: { orderBy: { order: "asc" } } } },
      approvalLogs: true,
      employee: { select: { id: true, name: true, managerId: true } },
    },
  });

  if (!expense) return res.status(404).json({ error: "Expense not found" });
  if (expense.status !== "WAITING_APPROVAL") return res.status(400).json({ error: `Already ${expense.status}` });

  // ─── Strict Authorization & Rules ──────────────────────────────────────────
  const rule = expense.rule;
  if (!rule) {
    // Fallback: If no rule, only Admins or Direct Managers can approve
    if (currentUser.role !== "ADMIN" && currentUser.id !== expense.employee.managerId) {
      return res.status(403).json({ error: "Strict: Direct Manager or Admin required for this expense." });
    }
  } else {
    // Check if user is an authorized approver for this rule
    const isDirectManager = rule.includeDirectManager && currentUser.id === expense.employee.managerId;
    const isInSequence = rule.steps.some(s => s.userId === currentUser.id);
    const isOverrideApprover = rule.overrideApproverId === currentUser.id;

    if (currentUser.role !== "ADMIN" && !isDirectManager && !isInSequence && !isOverrideApprover) {
      return res.status(403).json({ error: "Strict: You are not an authorized approver for this rule." });
    }
  }

  // ─── Record Approval ───────────────────────────────────────────────────────
  const currentStep = expense.approvalLogs.length + 1;
  await prisma.approvalLog.create({
    data: { expenseId: expense.id, approverId: currentUser.id, action: "APPROVED", comment, step: currentStep },
  });

  // ─── Hand-off to Core Engine ─────────────────────────────────────────────
  await runApprovalEngine(expense.id);

  res.json({ message: "Approval recorded. Flow engine triggered." });
};

/**
 * Reject an expense
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

/**
 * Administrative override: Forcefully change expense status (Admin only)
 */
export const updateExpenseStatus = async (req: AuthRequest, res: Response) => {
  const expenseId = req.params.id as string;
  const { status, comment } = req.body;

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status for override" });
  }

  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { employee: true },
  });

  if (!expense) return res.status(404).json({ error: "Expense not found" });

  const updated = await prisma.expense.update({
    where: { id: expenseId },
    data: { 
      status, 
      rejectionReason: status === "REJECTED" ? (comment || "Overridden by Admin") : null 
    },
    include: { employee: { select: { id: true, name: true } } },
  });

  // Log the administrative action in a special way
  await prisma.approvalLog.create({
    data: {
      expenseId,
      approverId: req.user!.id,
      action: status === "APPROVED" ? "APPROVED" : "REJECTED",
      comment: comment || `Administrative Override to ${status}`,
      step: 99, // 99 indicates an out-of-band admin action
    },
  });

  // Notify Employee
  io.to(updated.employee.id).emit(status === "APPROVED" ? "expense_approved" : "expense_rejected", {
    id: updated.id,
    description: updated.description,
    approver: req.user!.name,
    rejectionReason: status === "REJECTED" ? (comment || "Overridden by Admin") : undefined,
  });

  res.json({ expense: updated });
};
