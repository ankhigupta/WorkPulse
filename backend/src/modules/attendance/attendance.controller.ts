import type { Request, Response } from "express";
import * as attendanceService from "./attendance.service";
import type { ListAttendanceFilters } from "./attendance.service";

export async function create(req: Request, res: Response): Promise<void> {
  const attendance = await attendanceService.createAttendance(req.auth!, req.body);
  res.status(201).json(attendance);
}

export async function list(req: Request, res: Response): Promise<void> {
  const filters = (req.validatedQuery ?? {}) as ListAttendanceFilters;
  const attendance = await attendanceService.listAttendanceForAuth(req.auth!, filters);
  res.status(200).json(attendance);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const attendance = await attendanceService.getAttendanceForAuth(
    req.auth!,
    req.params.attendanceId as string,
  );
  res.status(200).json(attendance);
}

export async function update(req: Request, res: Response): Promise<void> {
  const attendance = await attendanceService.updateAttendanceForAuth(
    req.auth!,
    req.params.attendanceId as string,
    req.body,
  );
  res.status(200).json(attendance);
}
