import { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { catchAsync } from "../../shared/catchAsync";
import { sendResponse } from "../../shared/sendResponse";
import { DonationService } from "./donation.service";

const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
  const result = await DonationService.createCheckoutSession(req.body.amount);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Checkout session created successfully",
    data: result,
  });
});

const confirmCheckoutSession = catchAsync(async (req: Request, res: Response) => {
  const result = await DonationService.confirmCheckoutSession(req.body.sessionId);

  sendResponse(res, {
    statusCode: StatusCodes.OK,
    success: true,
    message: "Donation recorded successfully",
    data: result,
  });
});

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers["stripe-signature"];
  const payload = req.body as Buffer;

  const result = await DonationService.handleStripeWebhook(
    payload,
    typeof signature === "string" ? signature : undefined,
  );

  res.status(StatusCodes.OK).json(result);
});

export const DonationController = {
  createCheckoutSession,
  confirmCheckoutSession,
  handleWebhook,
};
