import express, { Application, NextFunction, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { toNodeHandler } from "better-auth/node";
import path from "node:path";
import { envVars } from "./config/env";
import { IndexRoute } from "./app/routes";
import { globalErrorhandler } from "./app/middleware/globalErrorhandler";
import { notFound } from "./app/middleware/notFound";
import { auth } from "./app/lib/auth";

const app: Application = express();

app.set("view engine", "ejs");
app.set("views",path.resolve(process.cwd(), `src/app/templates`) )

const corsOptions = {
    origin: [envVars.FRONTEND_URL, envVars.BETTER_AUTH_URL, "http://localhost:3000", "http://localhost:5000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

app.use("/api/auth", toNodeHandler(auth))
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
