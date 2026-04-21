import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { uploadFileToCloudinary } from "../../../config/cloudinary.config";
import AppError from "../../errorHelpers/AppError";

const uploadLogo = catchAsync(async (req: Request, res: Response) => {
    const file = (req as Express.Request & { file?: Express.Multer.File }).file;
    const logoUrl = typeof req.body?.logoUrl === "string" ? req.body.logoUrl.trim() : "";
    const providedFileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";

    let uploadResult: Awaited<ReturnType<typeof uploadFileToCloudinary>>;

    if (file?.buffer && file.originalname) {
        uploadResult = await uploadFileToCloudinary(file.buffer, file.originalname);
    } else if (logoUrl) {
        let parsedUrl: URL;

        try {
            parsedUrl = new URL(logoUrl);
        } catch {
            throw new AppError(StatusCodes.BAD_REQUEST, "Invalid logo URL");
        }

        if (parsedUrl.protocol !== "https:") {
            throw new AppError(StatusCodes.BAD_REQUEST, "Only HTTPS logo URLs are allowed");
        }

        const response = await fetch(parsedUrl.toString());

        if (!response.ok) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Could not fetch the logo URL");
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fallbackName = parsedUrl.pathname.split("/").pop() || "logo.png";
        const fileName = providedFileName || fallbackName;

        if (!buffer.length) {
            throw new AppError(StatusCodes.BAD_REQUEST, "The logo URL did not return image data");
        }

        uploadResult = await uploadFileToCloudinary(buffer, fileName);
    } else {
        throw new AppError(StatusCodes.BAD_REQUEST, "A logo image or logo URL is required");
    }

    sendResponse(res, {
        statusCode: StatusCodes.OK,
        success: true,
        message: "Logo uploaded successfully",
        data: {
            url: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            originalName: file?.originalname || providedFileName || "logo",
        },
    });
});

export const CoverPageController = {
    uploadLogo,
};
