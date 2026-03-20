import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";

export const validateRequest = (ZodObject: z.ZodObject<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const parseResult = ZodObject.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(StatusCodes.BAD_REQUEST).json({
                success: false,
                message: "Validation failed",
                error: parseResult.error.issues,
            });
        }
        next();
    }
}