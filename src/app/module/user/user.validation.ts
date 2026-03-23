import z from "zod";
import { Role } from "../../../generated/prisma";

// ─── Reusable primitives ──────────────────────────────────────────────────────

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

// ─── Admin ────────────────────────────────────────────────────────────────────

export const createAdminZodSchema = z.object({
    password: passwordSchema,
    admin: z.object({
        name: nameSchema,
        email: emailSchema,
        contactNumber: contactNumberSchema.optional(),
        profilePhoto: z.string().url("Profile photo must be a valid URL").optional(),
    }),
    /**
     * SUPER_ADMIN can assign ADMIN or SUPER_ADMIN.
     * ADMIN can only assign ADMIN.
     * This is enforced in the service layer — the route only checks that the
     * requesting user is at least ADMIN.
     */
    role: z.enum([Role.ADMIN, Role.SUPER_ADMIN], {
        message: "Role must be ADMIN or SUPER_ADMIN",
    }),
});

// ─── CR Application ───────────────────────────────────────────────────────────

export const createCRApplicationZodSchema = z.object({
    semesterId: z.string().cuid("Invalid semester ID").optional(),
    reason: z
        .string({ message: "Reason is required" })
        .min(20, "Please provide a reason of at least 20 characters")
        .max(500, "Reason must be at most 500 characters"),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateAdminInput = z.infer<typeof createAdminZodSchema>;