import { uploadFileToCloudinary } from "../../config/cloudinary.config";
import AppError from "../errorHelpers/AppError";
import { StatusCodes } from "http-status-codes";

/**
 * Converts a base64 string to a Buffer and uploads it to Cloudinary.
 * Replaces the old imgbb upload utility with Cloudinary integration.
 *
 * @param base64String - Base64 encoded image string (with or without data URI prefix)
 * @returns Cloudinary secure URL
 * @throws AppError if upload fails
 */
export const uploadToImgbb = async (base64String: string): Promise<string> => {
    try {
        // Remove data URI prefix if present (e.g., "data:image/png;base64,")
        const base64Data = base64String.includes(",")
            ? base64String.split(",")[1]
            : base64String;

        // Convert base64 to Buffer
        const buffer = Buffer.from(base64Data, "base64");

        if (!buffer || buffer.length === 0) {
            throw new AppError(StatusCodes.BAD_REQUEST, "Invalid image data");
        }

        // Generate a filename for the upload
        const fileName = `image-${Date.now()}.png`;

        // Upload to Cloudinary
        const result = await uploadFileToCloudinary(buffer, fileName);

        return result.secure_url;
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }
        throw new AppError(
            StatusCodes.INTERNAL_SERVER_ERROR,
            "Failed to upload image to cloud storage"
        );
    }
};
