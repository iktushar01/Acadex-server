import z from "zod";

export const createCheckoutSessionZodSchema = z.object({
  amount: z
    .number({ message: "Amount is required" })
    .int("Amount must be a whole number of cents")
    .min(100, "Minimum donation is $1.00")
    .max(100000, "Maximum donation is $1,000.00"),
});

export const confirmCheckoutSessionZodSchema = z.object({
  sessionId: z
    .string({ message: "Session ID is required" })
    .trim()
    .min(1, "Session ID is required"),
});
