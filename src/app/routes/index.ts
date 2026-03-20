import express from "express";
import { AuthRoute } from "../module/auth/auth.route";
import { UserRoutes } from "../module/user/user.route";
const router = express.Router();

router.use("/auth", AuthRoute);
router.use("/users", UserRoutes);


export const IndexRoute = router;