import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { uploadFileToCloudinary } from "../../../config/cloudinary.config";
import AppError from "../../errorHelpers/AppError";

const uploadLogo = catchAsync(async (req: Request, res: Response) => {
    const file = (req as Express.Request & { file?: Express.Multer.File }).file;

    if (!file?.buffer || !file.originalname) {
        throw new AppError(StatusCodes.BAD_REQUEST, "A logo image is required");
    }

    const uploadResult = await uploadFileToCloudinary(file.buffer, file.originalname);

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Logo uploaded successfully",
        data: {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            originalName: file.originalname,
        },
    });
});

export const CoverPageController = {
    uploadLogo,
};
