import { Router } from "express";
import * as usersController from "../controllers/users";
import { authenticate, requireRole } from "../middleware/auth";

export const usersRouter = Router();

// Only Admins can manage users
usersRouter.use(authenticate, requireRole("ADMIN"));

usersRouter.get("/", usersController.getUsers);
usersRouter.get("/:id", usersController.getUserById);
usersRouter.post("/", usersController.createUser);
usersRouter.put("/:id", usersController.updateUser);
usersRouter.delete("/:id", usersController.deleteUser);
