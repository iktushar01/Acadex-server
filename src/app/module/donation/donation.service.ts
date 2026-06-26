import type Stripe from "stripe";
import { StatusCodes } from "http-status-codes";
import AppError from "../../errorHelpers/AppError";
import { prisma } from "../../lib/prisma";
import { getStripeClient } from "../../../config/stripe";
import { envVars } from "../../../config/env";

const resolveSessionAmount = (session: Stripe.Checkout.Session): number => {
  if (session.amount_total && session.amount_total > 0) {
    return session.amount_total;
  }

  if (session.amount_subtotal && session.amount_subtotal > 0) {
    return session.amount_subtotal;
  }

  return 0;
};

const isPaidDonationSession = (session: Stripe.Checkout.Session): boolean => {
  if (session.payment_status !== "paid") {
    return false;
  }

  // Accept our checkout sessions and legacy sessions without metadata.
  if (session.metadata?.type && session.metadata.type !== "donation") {
    return false;
  }

  return resolveSessionAmount(session) > 0;
};

const recordFromCheckoutSession = async (session: Stripe.Checkout.Session) => {
  if (!isPaidDonationSession(session)) {
    return null;
  }

  const amountCents = resolveSessionAmount(session);
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  return prisma.donation.upsert({
    where: { stripeCheckoutSessionId: session.id },
    create: {
      stripeCheckoutSessionId: session.id,
      stripePaymentIntentId: paymentIntentId,
      amountCents,
      currency: session.currency ?? "usd",
      donorEmail: session.customer_details?.email ?? null,
      paidAt: new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000),
    },
    update: {
      amountCents,
      currency: session.currency ?? "usd",
      donorEmail: session.customer_details?.email ?? null,
      stripePaymentIntentId: paymentIntentId,
    },
  });
};

const syncDonationsFromStripe = async () => {
  const stripe = getStripeClient();

  let hasMore = true;
  let startingAfter: string | undefined;
  let pagesRead = 0;

  while (hasMore && pagesRead < 10) {
    const sessions = await stripe.checkout.sessions.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const session of sessions.data) {
      if (session.payment_status !== "paid") {
        continue;
      }

      let resolvedSession = session;

      if (resolveSessionAmount(session) === 0) {
        resolvedSession = await stripe.checkout.sessions.retrieve(session.id);
      }

      await recordFromCheckoutSession(resolvedSession);
    }

    hasMore = sessions.has_more;
    pagesRead += 1;

    if (hasMore && sessions.data.length > 0) {
      startingAfter = sessions.data[sessions.data.length - 1]?.id;
    } else {
      hasMore = false;
    }
  }
};

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

const confirmCheckoutSession = async (sessionId: string) => {
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId);

  if (!isPaidDonationSession(session)) {
    throw new AppError(
      StatusCodes.BAD_REQUEST,
      "This checkout session is not a completed donation payment.",
    );
  }

  return recordFromCheckoutSession(session);
};

const getPaymentStats = async () => {
  await syncDonationsFromStripe();

  const [aggregate, recentDonations] = await Promise.all([
    prisma.donation.aggregate({
      _sum: { amountCents: true },
      _count: { _all: true },
    }),
    prisma.donation.findMany({
      orderBy: { paidAt: "desc" },
      take: 10,
      select: {
        stripeCheckoutSessionId: true,
        amountCents: true,
        currency: true,
        donorEmail: true,
        paidAt: true,
      },
    }),
  ]);

  return {
    configured: true,
    totalAmountCents: aggregate._sum.amountCents ?? 0,
    totalDonations: aggregate._count._all,
    currency: "usd",
    recentDonations: recentDonations.map((donation) => ({
      id: donation.stripeCheckoutSessionId,
      amountCents: donation.amountCents,
      currency: donation.currency,
      createdAt: donation.paidAt.toISOString(),
      email: donation.donorEmail,
    })),
  };
};

const handleStripeWebhook = async (payload: Buffer, signature: string | undefined) => {
  const stripe = getStripeClient();

  let event: Stripe.Event;

  if (envVars.STRIPE_WEBHOOK_SECRET && signature) {
    event = stripe.webhooks.constructEvent(
      payload,
      signature,
      envVars.STRIPE_WEBHOOK_SECRET,
    );
  } else {
    event = JSON.parse(payload.toString()) as Stripe.Event;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await recordFromCheckoutSession(session);
  }

  return { received: true };
};

export const DonationService = {
  createCheckoutSession,
  confirmCheckoutSession,
  getPaymentStats,
  handleStripeWebhook,
};
