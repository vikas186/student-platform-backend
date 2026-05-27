import { Router } from 'express';
import {
  listCourses,
  listPublicUniversitiesWithProgramsHandler,
  listUniversities,
} from '../controller/catalogController';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { requirePermission } from '../middleware/requirePermission';
import validateMiddleware from '../middleware/validate';
import { publicUniversitiesQueryJoiSchema } from '../validations/catalog.validation';

const catalogRouter = Router();

catalogRouter.get(
  '/public/universities-with-programs',
  validateMiddleware(publicUniversitiesQueryJoiSchema as never),
  listPublicUniversitiesWithProgramsHandler,
);

catalogRouter
  .get('/universities', jwtAuthMiddleware(['all']), requirePermission('applications', 'view'), listUniversities)
  .get('/courses', jwtAuthMiddleware(['all']), requirePermission('applications', 'view'), listCourses);

export default catalogRouter;
