import type { Request, Response } from "express";
import * as accessRequestService from "./accessRequest.service";
import type { ApproveAccessRequestInput, ListAccessRequestFilters } from "./accessRequest.service";

export async function create(req: Request, res: Response): Promise<void> {
  const result = await accessRequestService.createAccessRequest(req.body);
  res.status(201).json(result);
}

export async function status(req: Request, res: Response): Promise<void> {
  const { token } = req.validatedQuery as unknown as { token: string };
  const result = await accessRequestService.getAccessRequestStatus(req.params.requestId as string, token);
  res.status(200).json(result);
}

export async function list(req: Request, res: Response): Promise<void> {
  const filters = (req.validatedQuery ?? {}) as ListAccessRequestFilters;
  const requests = await accessRequestService.listAccessRequestsForAuth(req.auth!, filters);
  res.status(200).json(requests);
}

export async function approve(req: Request, res: Response): Promise<void> {
  const request = await accessRequestService.approveAccessRequest(
    req.auth!,
    req.params.requestId as string,
    req.body as ApproveAccessRequestInput,
  );
  res.status(200).json(request);
}

export async function reject(req: Request, res: Response): Promise<void> {
  const request = await accessRequestService.rejectAccessRequest(
    req.auth!,
    req.params.requestId as string,
    req.body.reason,
  );
  res.status(200).json(request);
}
