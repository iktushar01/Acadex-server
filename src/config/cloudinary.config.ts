import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { envVars } from "./env";
import AppError from "../app/errorHelpers/AppError";
import { StatusCodes } from "http-status-codes";


cloudinary.config({
    cloud_name: envVars.CLOUDINARY_CLOUD_NAME,
    api_key: envVars.CLOUDINARY_API_KEY,
    api_secret: envVars.CLOUDINARY_API_SECRET,
})

const sanitizeFileName = (fileName: string) =>
    fileName
        .split(".")
        .slice(0, -1)
        .join(".")
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/g, "");

const getCloudinaryFolder = (fileName: string) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    return extension === "pdf" ? "pdfs" : "images";
};

const getCloudinaryResourceType = (fileName: string): "image" | "raw" => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    return extension === "pdf" ? "raw" : "image";
};

const collapseDuplicateFolderSegments = (assetPath: string) =>
    assetPath
        .replace(/^(Acadex\/pdfs)\/\1\//, "$1/")
        .replace(/^(Acadex\/images)\/\1\//, "$1/");

const getDedupedPath = (pathname: string) => {
    const match = pathname.match(/(\/upload\/(?:v\d+\/)?)(.+)$/);

    if (!match) {
        return null;
    }

    const [, prefix, assetPath] = match;

    if (!prefix || !assetPath) {
        return null;
    }

    const collapsedAssetPath = collapseDuplicateFolderSegments(assetPath);

    if (collapsedAssetPath !== assetPath) {
        return `${prefix}${collapsedAssetPath}`;
    }

    const parts = assetPath.split("/");

    if (parts.length % 2 !== 0) {
        return null;
    }

    const half = parts.length / 2;
    const firstHalf = parts.slice(0, half).join("/");
    const secondHalf = parts.slice(half).join("/");

    if (firstHalf !== secondHalf) {
        return null;
    }

    return `${prefix}${secondHalf}`;
};

export const normalizeCloudinaryUrl = (url: string, fileName?: string | null) => {
    try {
        const parsed = new URL(url);

        if (!parsed.hostname.endsWith("cloudinary.com")) {
            return url;
        }

        const dedupedPath = getDedupedPath(parsed.pathname);

        if (dedupedPath) {
            parsed.pathname = dedupedPath;
        }

        if (fileName?.toLowerCase().endsWith(".pdf")) {
            parsed.pathname = parsed.pathname.replace("/image/upload/", "/raw/upload/");
        }

        return parsed.toString();
    } catch {
        return url;
    }
};

export const uploadFileToCloudinary = async (
    buffer: Buffer,
    fileName: string,
): Promise<UploadApiResponse> => {
    if (!buffer || !fileName) {
        throw new AppError(StatusCodes.BAD_REQUEST, "File buffer and file name are required for upload");
    }

    const fileNameWithoutExtension = sanitizeFileName(fileName);

    const uniqueName =
        Math.random().toString(36).substring(2) +
        "-" +
        Date.now() +
        "-" +
        fileNameWithoutExtension;

    const folder = getCloudinaryFolder(fileName);
    const resourceType = getCloudinaryResourceType(fileName);

    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                resource_type: resourceType,
                public_id: uniqueName,
                folder: `Acadex/${folder}`,
                use_filename: false,
                unique_filename: false,
            },
            (error, result) => {
                if (error) {
                    return reject(new AppError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to upload file to Cloudinary"));
                }
                const normalizedResult = result as UploadApiResponse;
                normalizedResult.secure_url = normalizeCloudinaryUrl(normalizedResult.secure_url, fileName);
                resolve(normalizedResult);
            }
        ).end(buffer);
    })
}

export const deleteFileFromCloudinary = async (url: string, resourceType: "image" | "video" | "raw" = "image") => {
    try {
        const normalizedUrl = normalizeCloudinaryUrl(url);
        const regex = /\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?$/;
        const match = normalizedUrl.match(regex);

        if (!match?.[1]) {
            return;
        }

        const publicId = match[1];
        const candidateIds = [publicId];

        if (url !== normalizedUrl) {
            const legacyMatch = url.match(regex);
            if (legacyMatch?.[1]) {
                candidateIds.push(legacyMatch[1]);
            }
        }

        for (const candidateId of [...new Set(candidateIds)]) {
            const result = await cloudinary.uploader.destroy(candidateId, {
                resource_type: resourceType
            });

            if (result.result === "ok") {
                console.log(`File ${candidateId} deleted from Cloudinary successfully`);
                return;
            }

            if (result.result !== "not found") {
                console.warn(`Cloudinary deletion returned status: ${result.result} for publicId: ${candidateId}`);
            }
        }
    } catch (error) {
        console.error("Error deleting file from Cloudinary:", error);
        throw new AppError(StatusCodes.INTERNAL_SERVER_ERROR, "Failed to delete file from Cloudinary");
    }
}


export const cloudinaryUpload = cloudinary;
