/**
 * @swagger
 * /api/v1/catalog/public/universities-with-programs:
 *   get:
 *     tags: [Catalog]
 *     summary: Public — list universities with programs (paginated)
 *     description: |
 *       **No authentication required.** Returns active universities from the admin catalog,
 *       each with programs merged from (in priority order):
 *       1. Admin `courses` rows linked by `universityId`
 *       2. Scraped courses matched by university name
 *       3. Fee-matrix categories from `programFeeRanges` when no named programs exist
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Matches university name or country (case-insensitive)
 *       - in: query
 *         name: country
 *         schema:
 *           type: string
 *         description: Filter by country (case-insensitive contains)
 *     responses:
 *       200:
 *         description: Paginated universities with nested programs
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PublicUniversitiesWithProgramsResponse'
 *             examples:
 *               sample:
 *                 value:
 *                   success: true
 *                   message: Universities with programs fetched
 *                   data:
 *                     universities:
 *                       - id: 1
 *                         name: University of Toronto
 *                         country: Canada
 *                         status: true
 *                         programFeeRanges: null
 *                         programsCount: 1
 *                         programs:
 *                           - id: 10
 *                             courseName: Master of Computer Science
 *                             degree: Postgraduate
 *                             fee: 42000
 *                             duration: 2 Years
 *                         createdAt: '2026-01-15T10:00:00.000Z'
 *                         updatedAt: '2026-01-15T10:00:00.000Z'
 *                     page: 1
 *                     limit: 20
 *                     total: 1
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *
 * /api/v1/catalog/universities:
 *   get:
 *     tags: [Catalog]
 *     summary: List all universities (auth required)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CatalogListResponse'
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
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *
 * /api/v1/catalog/courses:
 *   get:
 *     tags: [Catalog]
 *     summary: List courses (auth required)
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
 *             schema:
 *               $ref: '#/components/schemas/CatalogListResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */

export {};
