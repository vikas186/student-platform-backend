import { Request, Response } from 'express';
import constant from '../../../constant';
import { catchAsyncError } from '../../../middleware/catchAsyncError';
import { matchAgentRecommendations, matchPublicRecommendations } from './recommendation-match.service';
import type { AgentMatchBody, PublicMatchBody } from './recommendation.types';

export const postPublicMatch = catchAsyncError(async (req: Request, res: Response) => {
  const data = await matchPublicRecommendations(req.body as PublicMatchBody);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Course recommendations generated',
    data,
  });
});

export const postAgentMatch = catchAsyncError(async (req: Request, res: Response) => {
  const data = await matchAgentRecommendations(req.body as AgentMatchBody);
  res.status(constant.msgCode.successCode).json({
    success: true,
    message: 'Partner pathways generated',
    data,
  });
});
