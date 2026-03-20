import { ZodError } from "zod";
import { StatusCodes } from "http-status-codes";
import { TypeErrorSource } from "../interfaces/error.interfaces";


const handleZodError = (error: ZodError) => {
    const statusCode = StatusCodes.BAD_REQUEST;
    const message = "Zod Validation Error";
    const errorSources: TypeErrorSource[] = [];

    error.issues.forEach((issue) => {
        errorSources.push({
            path: issue.path.join(".") || "",
            message: issue.message,
        });
    });

        return { statusCode, message, errorSources };
}

export default handleZodError;