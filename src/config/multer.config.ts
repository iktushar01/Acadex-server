import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import { cloudinaryUpload } from "./cloudinary.config";

const storage = new CloudinaryStorage({
    cloudinary: cloudinaryUpload,
    params: async (req, file) => {
        const originalName = file.originalname;
        const extension = originalName.split(".").pop()?.toLowerCase();

        // Clean file name
        const fileNameWithoutExtension = originalName
            .split(".")
            .slice(0, -1)
            .join(".")
            .toLowerCase()
            .replace(/\s+/g, "-")
            .replace(/[^a-z0-9\-]/g, "");

        const uniqueName = `${Math.random().toString(36).substring(2)}-${Date.now()}-${fileNameWithoutExtension}`;

        // Determine folder based on file type
        const folder = extension === "pdf" ? "pdfs" : "images";

        return {
            folder: `Acadex/${folder}`,
            public_id: uniqueName,
            resource_type: "auto",
        };
    },
});

// File filter: only allow images and PDFs
const fileFilter = (req: any, file: Express.Multer.File, cb: any) => {
    if (file.mimetype.startsWith("image/") || file.mimetype === "application/pdf") {
        cb(null, true);
    } else {
        cb(new Error("Only images and PDFs are allowed!"), false);
    }
};

// Limits: e.g., 10MB per file
const limits = {
    fileSize: 10 * 1024 * 1024, // 10MB
};

export const upload = multer({
    storage,
    fileFilter,
    limits,
});

export const memoryUpload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits,
});