import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { DonationController } from "./donation.controller";
import { createCheckoutSessionZodSchema } from "./donation.validation";

const router = Router();

router.post(
  "/checkout",
  validateRequest(createCheckoutSessionZodSchema),
  DonationController.createCheckoutSession,
);

export const DonationRoutes = router;
