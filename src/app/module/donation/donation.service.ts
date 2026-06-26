import { StatusCodes } from "http-status-codes";
import AppError from "../../errorHelpers/AppError";
import { getStripeClient } from "../../../config/stripe";
import { envVars } from "../../../config/env";

const createCheckoutSession = async (amount: number) => {
  const stripe = getStripeClient();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "Support Acadex",
              description:
                "Help keep Acadex free for students — classrooms, notes, and collaboration tools.",
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${envVars.FRONTEND_URL}/support/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${envVars.FRONTEND_URL}/support/cancel`,
      metadata: {
        type: "donation",
      },
    });

    if (!session.url) {
      throw new AppError(
        StatusCodes.INTERNAL_SERVER_ERROR,
        "Failed to create checkout session",
      );
    }

    return { url: session.url, sessionId: session.id };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    throw new AppError(
      StatusCodes.INTERNAL_SERVER_ERROR,
      "Unable to start Stripe checkout. Please try again.",
    );
  }
};

export const DonationService = {
  createCheckoutSession,
};
