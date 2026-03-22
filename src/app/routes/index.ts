import express from "express";
import { AuthRoute } from "../module/auth/auth.route";
import { UserRoutes } from "../module/user/user.route";
import { ClassroomRoutes } from "../module/classrooom/classroom.route";
import { SubjectRoutes } from "../module/subject/subject.route";
const router = express.Router();

router.use("/auth", AuthRoute);
router.use("/users", UserRoutes);
router.use("/classrooms", ClassroomRoutes);
router.use("/subjects", SubjectRoutes);


export const IndexRoute = router;