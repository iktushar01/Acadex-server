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

export const DonationController = {
  createCheckoutSession,
};
