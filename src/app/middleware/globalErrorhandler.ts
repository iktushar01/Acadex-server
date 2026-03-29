/* eslint-disable @typescript-eslint/no-unused-vars */
import { NextFunction, Request, Response } from "express";
import multer from "multer";
import { StatusCodes } from "http-status-codes";
import z from "zod";
import { Prisma } from "../../generated/prisma";
import AppError from "../errorHelpers/AppError";
import { envVars } from "../../config/env";
import handleZodError from "../errorHelpers/handlezoderror";
import { TErrorResponse, TErrorSource } from "../interfaces/error.interfaces";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const globalErrorhandler = (err: any, req: Request, res: Response, next: NextFunction) => {
    if (envVars.NODE_ENV === 'development') {
        console.log("Error from Global Error Handler", err);
    }

    let errorSources: TErrorSource[] = []
    let statusCode: number = StatusCodes.INTERNAL_SERVER_ERROR;
    let message: string = 'Internal Server Error';
    let stack: string | undefined = undefined;

    //Zod Error Patttern
    /*
     error.issues;
    /* [
      {
        expected: 'string',
        code: 'invalid_type',
        path: [ 'username' , 'password' ], => username password
        message: 'Invalid input: expected string'
      },
      {
        expected: 'number',
        code: 'invalid_type',
        path: [ 'xp' ],
        message: 'Invalid input: expected number'
      }
    ]
    */

    if (err instanceof z.ZodError) {
        const simplifiedError = handleZodError(err);
        statusCode = simplifiedError.statusCode as number
        message = simplifiedError.message
        errorSources = [...simplifiedError.errorSources]
        stack = err.stack;

    } else if (err instanceof multer.MulterError) {
        statusCode = StatusCodes.BAD_REQUEST;
        message =
            err.code === "LIMIT_FILE_SIZE"
                ? "One or more files exceed the maximum size (10MB per file)"
                : err.message;
        errorSources = [{ path: "files", message }];
    } else if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
    ) {
        statusCode = StatusCodes.CONFLICT;
        message = "This information already exists. Please use a different value.";
        errorSources = [
            {
                path: Array.isArray(err.meta?.target) ? String(err.meta.target[0]) : "",
                message,
            }
        ];
        stack = err.stack;
    } else if (err instanceof AppError) {
        statusCode = err.statusCode;
        message = err.message;
        stack = err.stack;
        errorSources = [
            {
                path: '',
                message: err.message
            }
        ]
    }
    else if (err instanceof Error) {
        statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
        message = err.message
        stack = err.stack;
        errorSources = [
            {
                path: '',
                message: err.message
            }
        ]
    }


    const errorResponse: TErrorResponse = {
        success: false,
        statusCode,
        message: message,
        errorSources,
        error: envVars.NODE_ENV === 'development' ? err : undefined,
        stack: envVars.NODE_ENV === 'development' ? stack : undefined,
    }

    res.status(statusCode).json(errorResponse);
}
