import type { Request, Response } from "express";
import * as authService from "./auth.service";

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  const result = await authService.login(email, password);
  res.status(200).json(result);
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  const result = await authService.refreshTokens(refreshToken);
  res.status(200).json(result);
}

export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body;
  await authService.logout(refreshToken);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getCurrentUser(req.auth!.userId);
  res.status(200).json(user);
}
