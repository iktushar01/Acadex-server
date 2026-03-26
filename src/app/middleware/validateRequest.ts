import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { StatusCodes } from "http-status-codes";

export const validateRequest = (
  ZodObject: z.ZodObject<any>,
  source: "body" | "query" | "params" = "body"
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const dataToValidate = req[source];
    const parseResult = ZodObject.safeParse(dataToValidate);

    if (!parseResult.success) {
      const errorSources = parseResult.error.issues.map((issue) => ({
        path: issue.path.join(".") || "",
        message: issue.message,
      }));

      return res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: "Validation failed",
        errorSources,
        error: parseResult.error.issues,
      });
    }

    // Use Object.assign to update the request data to avoid 'read-only' property errors
    // while still ensuring the controller gets the coerced/parsed data.
    Object.assign(req[source], parseResult.data);
    
    next();
  };
};