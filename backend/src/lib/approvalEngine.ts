import { prisma } from "./prisma";
import { io } from "./socket";

/**
 * Core Engine: Determines the final status of an expense after any approval/rejection action.
 * Priority: REJECTION > SPECIFIC OVERRIDE > PERCENTAGE RULE > SEQUENTIAL FLOW
 */
export async function runApprovalEngine(expenseId: string) {
  // ── STEP 1: Fetch data ───────────────────────────────────────────
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: {
      rule: { 
        include: { 
          steps: { orderBy: { order: "asc" } },
          specificApprover: { select: { name: true } }
        } 
      },
      approvalLogs: { orderBy: { createdAt: "desc" } },
      employee: { select: { id: true, name: true, managerId: true } },
    },
  });

  // @ts-ignore
  if (!expense || !expense.rule) return;

  // @ts-ignore
  const rule = expense.rule;
  // @ts-ignore
  const logs = expense.approvalLogs;
  
  // Total possible distinct approvers (Steps + Direct Manager if enabled)
  const totalPossible = rule.steps.length + (rule.includeDirectManager ? 1 : 0);
  
  const approvals = logs.filter((l: any) => l.action === "APPROVED");
  const uniqueApproverIds = new Set(approvals.map((a: any) => a.approverId));
  const rejectionExists = logs.some((l: any) => l.action === "REJECTED");

  // ── PRIORITY 1: REJECTION (immediately hard stop) ───────────────
  if (rejectionExists) {
    const lastRejection = logs.find((l: any) => l.action === "REJECTED");
    await prisma.expense.update({ 
      where: { id: expenseId }, 
      data: { status: "REJECTED", rejectionReason: lastRejection?.comment || "Rejected by approver" } 
    });
    
    io.to(expense.employeeId).emit("expense_rejected", { 
      id: expenseId, 
      description: expense.description,
      reason: lastRejection?.comment
    });
    
    // Notify all listeners
    io.emit("approval_updated", expenseId);
    return;
  }

  // ── PRIORITY 2: SPECIFIC OVERRIDE (CFO MODE) ─────────────────────
  if (rule.enableSpecificRule && rule.specificApproverId) {
    if (uniqueApproverIds.has(rule.specificApproverId)) {
      await prisma.expense.update({ 
        where: { id: expenseId }, 
        data: { 
          status: "APPROVED" as any, 
          // @ts-ignore
          approvalReason: `Approved via Specific Override (${rule.specificApprover?.name || "CFO"})` 
        } 
      });
      io.to(expense.employeeId).emit("expense_approved", { id: expenseId, description: expense.description });
      io.emit("approval_updated", expenseId);
      return;
    }
  }

  // ── PRIORITY 3: PERCENTAGE RULE ──────────────────────────────────
  if (rule.enablePercentageRule && rule.minApprovalPercentage) {
    const percentage = (uniqueApproverIds.size / totalPossible) * 100;
    if (percentage >= rule.minApprovalPercentage) {
      await prisma.expense.update({ 
        where: { id: expenseId }, 
        data: { 
          status: "APPROVED" as any, 
          // @ts-ignore
          approvalReason: `Approved via ${rule.minApprovalPercentage}% threshold rule (${uniqueApproverIds.size}/${totalPossible} approved)` 
        } 
      });
      io.to(expense.employeeId).emit("expense_approved", { id: expenseId, description: expense.description });
      io.emit("approval_updated", expenseId);
      return;
    }
  }

  // ── PRIORITY 4: SEQUENTIAL FLOW (fallback) ───────────────────────
  // If all participants have approved, mark as fully approved
  if (uniqueApproverIds.size >= totalPossible) {
    await prisma.expense.update({ 
      where: { id: expenseId }, 
      data: { 
        status: "APPROVED" as any, 
        // @ts-ignore
        approvalReason: "All sequential approval steps completed." 
      } 
    });
    io.to(expense.employeeId).emit("expense_approved", { id: expenseId, description: expense.description });
  }

  // Broad cast updates for real-time progress bars even if not fully approved
  io.emit("approval_updated", expenseId);
}
