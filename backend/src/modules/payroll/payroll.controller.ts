import type { Request, Response } from "express";
import * as payrollService from "./payroll.service";
import type { ListPayrollFilters } from "./payroll.service";

export async function create(req: Request, res: Response): Promise<void> {
  const payroll = await payrollService.createPayroll(req.auth!, req.body);
  res.status(201).json(payroll);
}

export async function list(req: Request, res: Response): Promise<void> {
  const filters = (req.validatedQuery ?? {}) as ListPayrollFilters;
  const payrolls = await payrollService.listPayrollForAuth(req.auth!, filters);
  res.status(200).json(payrolls);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const payroll = await payrollService.getPayrollForAuth(req.auth!, req.params.payrollId as string);
  res.status(200).json(payroll);
}

export async function recalculate(req: Request, res: Response): Promise<void> {
  const payroll = await payrollService.recalculatePayroll(req.auth!, req.params.payrollId as string);
  res.status(200).json(payroll);
}

export async function finalize(req: Request, res: Response): Promise<void> {
  const payroll = await payrollService.finalizePayroll(req.auth!, req.params.payrollId as string);
  res.status(200).json(payroll);
}
