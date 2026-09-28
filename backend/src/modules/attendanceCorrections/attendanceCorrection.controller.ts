import type { Request, Response } from "express";
import * as correctionService from "./attendanceCorrection.service";
import type { ListCorrectionFilters } from "./attendanceCorrection.service";

export async function create(req: Request, res: Response): Promise<void> {
  const correction = await correctionService.createCorrection(req.auth!, req.body);
  res.status(201).json(correction);
}

export async function list(req: Request, res: Response): Promise<void> {
  const filters = (req.validatedQuery ?? {}) as ListCorrectionFilters;
  const corrections = await correctionService.listCorrectionsForAuth(req.auth!, filters);
  res.status(200).json(corrections);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const correction = await correctionService.getCorrectionForAuth(
    req.auth!,
    req.params.correctionId as string,
  );
  res.status(200).json(correction);
}

export async function approve(req: Request, res: Response): Promise<void> {
  const correction = await correctionService.approveCorrection(
    req.auth!,
    req.params.correctionId as string,
  );
  res.status(200).json(correction);
}

export async function reject(req: Request, res: Response): Promise<void> {
  const correction = await correctionService.rejectCorrection(
    req.auth!,
    req.params.correctionId as string,
  );
  res.status(200).json(correction);
}
