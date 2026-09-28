import type { Request, Response } from "express";
import * as paymentService from "./payment.service";
import type { ListPaymentFilters } from "./payment.service";

export async function create(req: Request, res: Response): Promise<void> {
  const payment = await paymentService.createPayment(req.auth!, req.body);
  res.status(201).json(payment);
}

export async function list(req: Request, res: Response): Promise<void> {
  const filters = (req.validatedQuery ?? {}) as ListPaymentFilters;
  const payments = await paymentService.listPaymentsForAuth(req.auth!, filters);
  res.status(200).json(payments);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const payment = await paymentService.getPaymentForAuth(req.auth!, req.params.paymentId as string);
  res.status(200).json(payment);
}

export async function getBalance(req: Request, res: Response): Promise<void> {
  const balance = await paymentService.getEmployeeBalanceForAuth(req.auth!, req.params.employeeId as string);
  res.status(200).json({
    totalOwed: balance.totalOwed.toString(),
    totalPaid: balance.totalPaid.toString(),
    outstanding: balance.outstanding.toString(),
  });
}
