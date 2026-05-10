import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { jwtAuthMiddleware } from '../../../middleware/jwtAuth';
import validateMiddleware from '../../../middleware/validate';
import {
  deleteChatHistoryJoiSchema,
  getChatHistoryJoiSchema,
  postChatFeedbackJoiSchema,
  postChatMessageJoiSchema,
} from './chat.validation';
import { postMessage, getHistory, deleteHistory, postFeedback } from './chat.controller';

const chatRouter = Router();

const keyByUserId = (req: import('express').Request) => {
  const id = (req as { user?: { id?: string } }).user?.id;
  if (id && typeof id === 'string') return id;
  return req.ip || 'unknown';
};

const messageLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserId,
});

const historyLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserId,
});

chatRouter.use(jwtAuthMiddleware(['all']));

chatRouter.post('/message', messageLimiter, validateMiddleware(postChatMessageJoiSchema as any), postMessage);
chatRouter.get('/history', historyLimiter, validateMiddleware(getChatHistoryJoiSchema as any), getHistory);
chatRouter.delete('/history', historyLimiter, validateMiddleware(deleteChatHistoryJoiSchema as any), deleteHistory);
chatRouter.post('/feedback', historyLimiter, validateMiddleware(postChatFeedbackJoiSchema as any), postFeedback);

export default chatRouter;
