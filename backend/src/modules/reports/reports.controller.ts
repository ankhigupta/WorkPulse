import type { Request, Response } from "express";
import * as reportsService from "./reports.service";
import type {
  AttendanceReportFilters,
  PaymentsReportFilters,
  PayrollReportFilters,
  WorkforceReportFilters,
} from "./reports.service";

export async function attendance(req: Request, res: Response): Promise<void> {
  const filters = req.validatedQuery as unknown as AttendanceReportFilters;
  const report = await reportsService.getAttendanceReport(req.auth!, filters);
  res.status(200).json(report);
}

export async function payroll(req: Request, res: Response): Promise<void> {
  const filters = req.validatedQuery as unknown as PayrollReportFilters;
  const report = await reportsService.getPayrollReport(req.auth!, filters);
  res.status(200).json(report);
}

export async function payments(req: Request, res: Response): Promise<void> {
  const filters = req.validatedQuery as unknown as PaymentsReportFilters;
  const report = await reportsService.getPaymentsReport(req.auth!, filters);
  res.status(200).json(report);
}

export async function workforce(req: Request, res: Response): Promise<void> {
  const filters = req.validatedQuery as unknown as WorkforceReportFilters;
  const report = await reportsService.getWorkforceReport(req.auth!, filters);
  res.status(200).json(report);
}
