import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import validateMiddleware from '../../../middleware/validate';
import { postPublicMatch } from './recommendations.controller';
import { publicMatchJoiSchema } from './recommendations.validation';

const recommendationsRouter = Router();

const publicMatchLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => (req.ip ? ipKeyGenerator(req.ip) : 'unknown'),
});

recommendationsRouter.post(
  '/public/match',
  publicMatchLimiter,
  validateMiddleware(publicMatchJoiSchema as any),
  postPublicMatch,
);

export default recommendationsRouter;
