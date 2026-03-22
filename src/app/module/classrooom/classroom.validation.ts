import z from "zod";
import { ClassroomStatus, InstitutionLevel } from "../../../generated/prisma";

// ─── Create Classroom ─────────────────────────────────────────────────────────

export const createClassroomZodSchema = z.object({
  name: z
    .string({ message: "Classroom name is required" })
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters")
    .trim(),

  institutionName: z
    .string({ message: "Institution name is required" })
    .min(2, "Institution name must be at least 2 characters")
    .max(150, "Institution name must be at most 150 characters")
    .trim(),

  level: z.enum(
    [InstitutionLevel.SCHOOL, InstitutionLevel.COLLEGE, InstitutionLevel.UNIVERSITY],
    { message: "Level must be SCHOOL, COLLEGE, or UNIVERSITY" },
  ),

  className: z
    .string()
    .min(1, "Class name must be at least 1 character")
    .max(50, "Class name must be at most 50 characters")
    .trim()
    .optional(),

  department: z
    .string()
    .min(1)
    .max(100, "Department must be at most 100 characters")
    .trim()
    .optional(),

  groupName: z
    .string()
    .min(1)
    .max(50, "Group name must be at most 50 characters")
    .trim()
    .optional(),

  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .trim()
    .optional(),
});

// ─── Reject Classroom ─────────────────────────────────────────────────────────

export const rejectClassroomZodSchema = z.object({
  rejectionReason: z
    .string({ message: "Rejection reason is required" })
    .min(10, "Please provide a reason of at least 10 characters")
    .max(500, "Reason must be at most 500 characters"),
});

// ─── Join Classroom ───────────────────────────────────────────────────────────

export const joinClassroomZodSchema = z.object({
  joinCode: z
    .string({ message: "Join code is required" })
    .length(6, "Join code must be exactly 6 characters")
    .regex(/^[A-Za-z0-9]+$/, "Join code must be alphanumeric")
    .trim(),
});

 // ─── List / filter (query params) ─────────────────────────────────────────────

export const classroomFilterZodSchema = z.object({
  status: z
    .enum([
      ClassroomStatus.PENDING,
      ClassroomStatus.APPROVED,
      ClassroomStatus.REJECTED,
    ])
    .optional(),

  level: z
    .enum([
      InstitutionLevel.SCHOOL,
      InstitutionLevel.COLLEGE,
      InstitutionLevel.UNIVERSITY,
    ])
    .optional(),

  institutionName: z.string().trim().optional(),
  name: z.string().trim().optional(),

  page: z.coerce
    .number({ message: "Page must be a number" })
    .int()
    .min(1, "Page must be at least 1")
    .default(1),

  limit: z.coerce
    .number({ message: "Limit must be a number" })
    .int()
    .min(1)
    .max(100, "Limit must be at most 100")
    .default(10),
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type CreateClassroomInput = z.infer<typeof createClassroomZodSchema>;
export type RejectClassroomInput = z.infer<typeof rejectClassroomZodSchema>;
export type ClassroomFilterInput = z.infer<typeof classroomFilterZodSchema>;