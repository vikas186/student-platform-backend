import { Router } from 'express';
import { listCourses, listUniversities } from '../controller/catalogController';
import { jwtAuthMiddleware } from '../middleware/jwtAuth';
import { requirePermission } from '../middleware/requirePermission';

/**
 * @swagger
 * /api/v1/catalog/universities:
 *   get:
 *     tags: [Catalog]
 *     summary: List all universities
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CatalogListResponse' }
 *             examples:
 *               sample:
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: 1
 *                       name: University of Toronto
 *                       country: Canada
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *
 * /api/v1/catalog/courses:
 *   get:
 *     tags: [Catalog]
 *     summary: List courses
 *     description: Optional `universityId` filter
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: universityId
 *         schema:
 *           type: integer
 *         description: Filter by owning university
 *     responses:
 *       200:
 *         description: OK — each course may include nested `university`
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CatalogListResponse' }
 *       401:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */

const catalogRouter = Router();

catalogRouter
  .get('/universities', jwtAuthMiddleware(['all']), requirePermission('applications', 'view'), listUniversities)
  .get('/courses', jwtAuthMiddleware(['all']), requirePermission('applications', 'view'), listCourses);

export default catalogRouter;
