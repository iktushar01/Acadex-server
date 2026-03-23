import express from "express";
import { AuthRoute } from "../module/auth/auth.route";
import { UserRoutes } from "../module/user/user.route";
import { ClassroomRoutes } from "../module/classrooom/classroom.route";
import { SubjectRoutes } from "../module/subject/subject.route";
import { FolderRoutes } from "../module/folder/folder.route";
import { NoteRoutes } from "../module/notes/notes.route";
import { FavoriteRoutes } from "../module/favorite/favorite.route";
const router = express.Router();

router.use("/auth", AuthRoute);
router.use("/users", UserRoutes);
router.use("/classrooms", ClassroomRoutes);
router.use("/subjects", SubjectRoutes);
router.use("/folders", FolderRoutes);
router.use("/notes", NoteRoutes);
router.use("/favorites", FavoriteRoutes);


export const IndexRoute = router;