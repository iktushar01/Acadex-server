import { Router } from "express";
import { validateRequest } from "../../middleware/validateRequest";
import { DonationController } from "./donation.controller";
import {
  confirmCheckoutSessionZodSchema,
  createCheckoutSessionZodSchema,
} from "./donation.validation";

const router = Router();

router.post(
  "/checkout",
  validateRequest(createCheckoutSessionZodSchema),
  DonationController.createCheckoutSession,
);

router.post(
  "/confirm",
  validateRequest(confirmCheckoutSessionZodSchema),
  DonationController.confirmCheckoutSession,
);

export const DonationRoutes = router;
