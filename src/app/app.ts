import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { IndexRoute } from "./routes";
import { globalErrorhandler } from "./middleware/globalErrorhandler";
import { notFound } from "./middleware/notFound";
import { toNodeHandler } from "better-auth/node";
import { auth } from "./lib/auth";
import path from "node:path";
import { envVars } from "../config/env";

const app: Application = express();

app.set("view engine", "ejs");
app.set("views",path.resolve(process.cwd(), `src/app/templates`) )

app.use(cors({
    origin : [envVars.FRONTEND_URL, envVars.BETTER_AUTH_URL, "http://localhost:3000", "http://localhost:5000"],
    credentials : true,
    methods : ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders : ["Content-Type", "Authorization"]
}))

app.use("/api/auth", toNodeHandler(auth))

app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res: Response) => {
  res.send("Acadex Server is running 🚀");
});


app.use("/api/v1", IndexRoute);


app.use(globalErrorhandler);
app.use(notFound);
export default app;
