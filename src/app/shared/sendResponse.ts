import { Response } from "express";

interface ISendResponse<T> {
    statusCode: number;
    success: boolean;
    data?: T;
    message?: string;
    meta?: any;
}

export const sendResponse = <T>(res: Response, data: ISendResponse<T>) => {
    res.status(data.statusCode).json({
        success: data.success,
        data: data.data,
        message: data.message,
        meta: data.meta,
    });
}
