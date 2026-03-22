import { Router } from "express";
import { Role } from "../../../generated/prisma";
import { checkAuth } from "../../middleware/checkAuth";
import { validateRequest } from "../../middleware/validateRequest";
import { UserController } from "./user.controller";
import { createStudentZodSchema } from "./user.validation";


const router = Router();


router.post("/create-student",
    validateRequest(createStudentZodSchema),
    UserController.createStudent);


router.post("/create-admin",
    checkAuth(Role.ADMIN, Role.ADMIN),
    UserController.createAdmin);

export const UserRoutes = router;