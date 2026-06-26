import Stripe from "stripe";
import { StatusCodes } from "http-status-codes";
import AppError from "../app/errorHelpers/AppError";
import { envVars } from "./env";

let stripeClient: Stripe | null = null;

export const getStripeClient = (): Stripe => {
  if (!envVars.STRIPE_SECRET_KEY) {
    throw new AppError(
      StatusCodes.SERVICE_UNAVAILABLE,
      "Stripe is not configured on the server. Add STRIPE_SECRET_KEY to environment variables.",
    );
  }

  if (!stripeClient) {
    stripeClient = new Stripe(envVars.STRIPE_SECRET_KEY);
  }

  return stripeClient;
};
