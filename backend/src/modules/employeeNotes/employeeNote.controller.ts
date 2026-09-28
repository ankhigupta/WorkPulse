import type { Request, Response } from "express";
import * as employeeNoteService from "./employeeNote.service";
import type { ListEmployeeNoteFilters } from "./employeeNote.service";

export async function create(req: Request, res: Response): Promise<void> {
  const note = await employeeNoteService.createEmployeeNote(req.auth!, req.body);
  res.status(201).json(note);
}

export async function list(req: Request, res: Response): Promise<void> {
  const filters = (req.validatedQuery ?? {}) as ListEmployeeNoteFilters;
  const notes = await employeeNoteService.listEmployeeNotesForAuth(req.auth!, filters);
  res.status(200).json(notes);
}

export async function getById(req: Request, res: Response): Promise<void> {
  const note = await employeeNoteService.getEmployeeNoteForAuth(req.auth!, req.params.noteId as string);
  res.status(200).json(note);
}
