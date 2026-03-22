import z from "zod";
import { Gender, Role } from "../../../generated/prisma";

// ─── Reusable primitives ─────────────────────────────────────────────────────

const passwordSchema = z
    .string({ message: "Password is required" })
    .min(6, "Password must be at least 6 characters")
    .max(20, "Password must be at most 20 characters");

const nameSchema = z
    .string({ message: "Name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(50, "Name must be at most 50 characters")
    .trim();

const emailSchema = z
    .string({ message: "Email is required" })
    .email("Invalid email address")
    .toLowerCase()
    .trim();

const contactNumberSchema = z
    .string({ message: "Contact number must be a string" })
    .min(7, "Contact number must be at least 7 characters")
    .max(15, "Contact number must be at most 15 characters")
    .regex(/^\+?[0-9\s\-()]+$/, "Contact number contains invalid characters");

const profilePhotoSchema = z
    .string()
    .url("Profile photo must be a valid URL")
    .optional();

// ─── Student ─────────────────────────────────────────────────────────────────

export const createStudentZodSchema = z.object({
    password: passwordSchema,
    student: z.object({
        name: nameSchema,
        email: emailSchema,
        contactNumber: contactNumberSchema.optional(),
        address: z
            .string()
            .min(5, "Address must be at least 5 characters")
            .max(150, "Address must be at most 150 characters")
            .optional(),
        gender: z.enum([Gender.MALE, Gender.FEMALE], {
            message: "Gender must be MALE or FEMALE",
        }),
        profilePhoto: profilePhotoSchema,
    }),
});

// ─── CR Application ──────────────────────────────────────────────────────────

export const createCRApplicationZodSchema = z.object({
    semesterId: z.string().cuid("Invalid semester ID").optional(),
    reason: z
        .string({ message: "Reason is required" })
        .min(20, "Please provide a reason of at least 20 characters")
        .max(500, "Reason must be at most 500 characters"),
});

export const approveCRApplicationZodSchema = z.object({
    applicationId: z.string().cuid("Invalid application ID"),
    adminNote: z.string().max(300).optional(),
});

// ─── Admin ───────────────────────────────────────────────────────────────────

export const createAdminZodSchema = z.object({
    password: passwordSchema,
    admin: z.object({
        name: nameSchema,
        email: emailSchema,
        contactNumber: contactNumberSchema.optional(),
        profilePhoto: profilePhotoSchema,
    }),
    /**
     * The requesting user's own role is verified in the service layer:
     * - SUPER_ADMIN can assign either ADMIN or SUPER_ADMIN
     * - ADMIN can only assign ADMIN
     */
    role: z.enum([Role.ADMIN, Role.SUPER_ADMIN], {
        message: "Role must be ADMIN or SUPER_ADMIN",
    }),
});

export type CreateStudentInput = z.infer<typeof createStudentZodSchema>;
export type CreateAdminInput = z.infer<typeof createAdminZodSchema>;
export type CreateCRApplicationInput = z.infer<typeof createCRApplicationZodSchema>;