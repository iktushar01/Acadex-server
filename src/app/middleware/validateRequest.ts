import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";

export const validateRequest = (ZodObject: z.ZodObject<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const parseResult = ZodObject.safeParse(req.body);
        if (!parseResult.success) {
            const errorSources = parseResult.error.issues.map((issue) => ({
                path: issue.path.join(".") || "",
                message: issue.message,
            }));
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Validation failed",
                errorSources,
                error: parseResult.error.issues, // keep for debugging compatibility
            });
        }
        next();
    }
}