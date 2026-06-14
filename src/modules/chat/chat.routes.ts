import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { jwtAuthMiddleware } from '../../../middleware/jwtAuth';
import validateMiddleware from '../../../middleware/validate';
import {
  deleteChatHistoryJoiSchema,
  getChatHistoryJoiSchema,
  getPublicSuggestionsJoiSchema,
  getChatSuggestionsJoiSchema,
  postChatFeedbackJoiSchema,
  postChatMessageJoiSchema,
  postPublicMessageJoiSchema,
} from './chat.validation';
import {
  postMessage,
  getHistory,
  deleteHistory,
  postFeedback,
  getPublicSuggestions,
  getChatSuggestions,
  postPublicMessage,
} from './chat.controller';

const chatRouter = Router();

const keyByUserId = (req: import('express').Request) => {
  const id = (req as { user?: { id?: string } }).user?.id;
  if (id && typeof id === 'string') return id;
  if (req.ip) return ipKeyGenerator(req.ip);
  return 'unknown';
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

const publicChatLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req.ip ? ipKeyGenerator(req.ip) : 'unknown'),
});

const publicMessageLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req.ip ? ipKeyGenerator(req.ip) : 'unknown'),
});

/** Explore / marketing — no JWT */
chatRouter.get(
  '/public/suggestions',
  publicChatLimiter,
  validateMiddleware(getPublicSuggestionsJoiSchema as any),
  getPublicSuggestions,
);
chatRouter.post(
  '/public/message',
  publicMessageLimiter,
  validateMiddleware(postPublicMessageJoiSchema as any),
  postPublicMessage,
);

chatRouter.use(jwtAuthMiddleware(['all']));

chatRouter.get(
  '/suggestions',
  historyLimiter,
  validateMiddleware(getChatSuggestionsJoiSchema as any),
  getChatSuggestions,
);
chatRouter.post('/message', messageLimiter, validateMiddleware(postChatMessageJoiSchema as any), postMessage);
chatRouter.get('/history', historyLimiter, validateMiddleware(getChatHistoryJoiSchema as any), getHistory);
chatRouter.delete('/history', historyLimiter, validateMiddleware(deleteChatHistoryJoiSchema as any), deleteHistory);
chatRouter.post('/feedback', historyLimiter, validateMiddleware(postChatFeedbackJoiSchema as any), postFeedback);

export default chatRouter;
