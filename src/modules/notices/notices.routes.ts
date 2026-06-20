import { Router } from 'express';
import { jwtAuthMiddleware } from '../../../middleware/jwtAuth';
import { listActiveNoticesHandler } from './notice.controller';

const noticesRouter = Router();

/** Active ticker items for all authenticated dashboard roles */
noticesRouter.get('/', jwtAuthMiddleware(['all']), listActiveNoticesHandler);

export default noticesRouter;
