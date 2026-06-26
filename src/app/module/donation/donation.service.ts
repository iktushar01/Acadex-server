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

const getPaymentStats = async () => {
  const stripe = getStripeClient();

  let totalAmountCents = 0;
  let totalDonations = 0;
  const recentDonations: Array<{
    id: string;
    amountCents: number;
    currency: string;
    createdAt: string;
    email: string | null;
  }> = [];

  let hasMore = true;
  let startingAfter: string | undefined;
  let pagesRead = 0;

  while (hasMore && pagesRead < 10) {
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
      status: "complete",
    });

    for (const session of sessions.data) {
      if (session.metadata?.type !== "donation") {
        continue;
      }

      const amount = session.amount_total ?? 0;
      totalAmountCents += amount;
      totalDonations += 1;

      if (recentDonations.length < 10) {
        recentDonations.push({
          id: session.id,
          amountCents: amount,
          currency: session.currency ?? "usd",
          createdAt: new Date(session.created * 1000).toISOString(),
          email: session.customer_details?.email ?? null,
        });
      }
    }

    hasMore = sessions.has_more;
    pagesRead += 1;

    if (hasMore && sessions.data.length > 0) {
      startingAfter = sessions.data[sessions.data.length - 1]?.id;
    } else {
      hasMore = false;
    }
  }

  return {
    configured: true,
    totalAmountCents,
    totalDonations,
    currency: "usd",
    recentDonations,
  };
};

export const DonationService = {
  createCheckoutSession,
  getPaymentStats,
};
