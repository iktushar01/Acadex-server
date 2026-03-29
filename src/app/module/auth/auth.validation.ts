import z from "zod";
import { Gender } from "../../../generated/prisma";

/**
 * Auth module owns the public registration schema.
 * The user module's createStudentZodSchema (which required gender, contactNumber, etc.)
 * is for admin-created students with full profiles. Public self-registration only
 * needs the minimum required fields — additional profile data can be filled later.
 */
export const registerStudentZodSchema = z.object({
    name: z
        .string({ message: "Name is required" })
        .min(2, "Name must be at least 2 characters")
        .max(50, "Name must be at most 50 characters")
        .trim(),

    email: z
        .string({ message: "Email is required" })
        .email("Invalid email address")
        .toLowerCase()
        .trim(),

    password: z
        .string({ message: "Password is required" })
        .min(6, "Password must be at least 6 characters")
        .max(20, "Password must be at most 20 characters"),
});
[]
export const loginZodSchema = z.object({
    email: z
        .string({ message: "Email is required" })
        .email("Invalid email address")
        .toLowerCase()
        .trim(),

    password: z
        .string({ message: "Password is required" })
        .min(1, "Password is required"),
});

export const changePasswordZodSchema = z.object({
    currentPassword: z
        .string({ message: "Current password is required" })
        .min(1, "Current password is required"),

    newPassword: z
        .string({ message: "New password is required" })
        .min(6, "New password must be at least 6 characters")
        .max(20, "New password must be at most 20 characters"),
});

export const verifyEmailZodSchema = z.object({
    email: z.string({ message: "Email is required" }).email("Invalid email address"),
    otp: z
        .string({ message: "OTP is required" })
        .min(4, "OTP must be at least 4 characters")
        .max(10, "OTP must be at most 10 characters"),
});

export const forgetPasswordZodSchema = z.object({
    email: z.string({ message: "Email is required" }).email("Invalid email address"),
});

export const resetPasswordZodSchema = z.object({
    email: z.string({ message: "Email is required" }).email("Invalid email address"),
    otp: z
        .string({ message: "OTP is required" })
        .min(4, "OTP must be at least 4 characters")
        .max(10, "OTP must be at most 10 characters"),
    newPassword: z
        .string({ message: "New password is required" })
        .min(6, "New password must be at least 6 characters")
        .max(20, "New password must be at most 20 characters"),
});

const optionalTrimmedString = z.preprocess(
    (value) => {
        if (typeof value !== "string") return value;
        const trimmed = value.trim();
        return trimmed === "" ? undefined : trimmed;
    },
    z.string().trim().optional(),
);

const optionalNullableTrimmedString = z.preprocess(
    (value) => {
        if (value === null) return null;
        if (typeof value !== "string") return value;
        const trimmed = value.trim();
        return trimmed === "" ? null : trimmed;
    },
    z.string().trim().nullable().optional(),
);

export const updateProfileZodSchema = z.object({
    name: optionalTrimmedString
        .pipe(
            z
                .string()
                .min(2, "Name must be at least 2 characters")
                .max(50, "Name must be at most 50 characters")
                .optional(),
        ),
    profilePhoto: z.preprocess(
        (value) => {
            if (value === null) return null;
            if (typeof value !== "string") return value;
            const trimmed = value.trim();
            return trimmed === "" ? null : trimmed;
        },
        z
            .string()
            .url("Profile photo must be a valid URL")
            .nullable()
            .optional(),
    ),
    contactNumber: optionalNullableTrimmedString.pipe(
        z
            .string()
            .min(7, "Contact number must be at least 7 characters")
            .max(15, "Contact number must be at most 15 characters")
            .regex(/^\+?[0-9\s\-()]+$/, "Contact number contains invalid characters")
            .nullable()
            .optional(),
    ),
    address: optionalNullableTrimmedString.pipe(
        z
            .string()
            .min(3, "Address must be at least 3 characters")
            .max(200, "Address must be at most 200 characters")
            .nullable()
            .optional(),
    ),
    gender: z.preprocess(
        (value) => {
            if (value === null) return null;
            if (typeof value !== "string") return value;
            const trimmed = value.trim();
            return trimmed === "" ? null : trimmed;
        },
        z.nativeEnum(Gender).nullable().optional(),
    ),
}).refine(
    (data) =>
        data.name !== undefined ||
        data.profilePhoto !== undefined ||
        data.contactNumber !== undefined ||
        data.address !== undefined ||
        data.gender !== undefined,
    {
        message: "At least one profile field must be provided",
    },
);
