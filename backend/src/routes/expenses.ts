import { Router } from "express";
import * as expensesController from "../controllers/expenses";
import { authenticate, requireRole } from "../middleware/auth";

export const expensesRouter = Router();
expensesRouter.use(authenticate);

// List and Create
expensesRouter.get("/", expensesController.getExpenses);
expensesRouter.get("/:id", expensesController.getExpenseById);
expensesRouter.post("/", expensesController.createExpense);

// Approval actions
expensesRouter.patch("/:id/approve", requireRole("MANAGER", "ADMIN"), expensesController.approveExpense);
expensesRouter.patch("/:id/reject", requireRole("MANAGER", "ADMIN"), expensesController.rejectExpense);
expensesRouter.patch("/:id/status", requireRole("ADMIN"), expensesController.updateExpenseStatus);
