import type { Request, Response } from "express";
import * as dashboardService from "./dashboard.service";

export async function getSummary(req: Request, res: Response): Promise<void> {
  const filters = (req.validatedQuery ?? {}) as { startDate?: Date; endDate?: Date };
  const summary = await dashboardService.getDashboardSummary(req.auth!, filters);
  res.status(200).json(summary);
}
