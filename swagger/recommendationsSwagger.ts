/**
 * @swagger
 * tags:
 *   - name: Recommendations
 *     description: RAG + AI course recommendations — public explore and agent partner pathways
 */

/**
 * @swagger
 * /api/v1/recommendations/public/match:
 *   post:
 *     tags: [Recommendations]
 *     summary: Public course match (no auth — university names hidden)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [level, field, country]
 *             properties:
 *               level: { type: string, example: undergraduate }
 *               field: { type: string, example: computer science }
 *               country: { type: string, example: Canada }
 *               score: { type: number }
 *               budget: { oneOf: [{ type: number }, { type: string }] }
 *               intake: { type: string }
 *     responses:
 *       200:
 *         description: Ranked suggestions with disclaimer
 *       503:
 *         description: Knowledge base or OpenAI unavailable
 */

/**
 * @swagger
 * /api/v1/agent/recommendations/match:
 *   post:
 *     tags: [Recommendations, Agent]
 *     summary: Agent partner pathways with commission data
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [country, programFocus]
 *             properties:
 *               country: { type: string }
 *               programFocus: { type: string }
 *               limit: { type: integer, minimum: 1, maximum: 4, default: 2 }
 *     responses:
 *       200:
 *         description: Partner pathways
 *       403:
 *         description: Agreement not approved
 */

/**
 * @swagger
 * /api/v1/admin/recommendations/knowledge/sync:
 *   post:
 *     tags: [Recommendations, Admin]
 *     summary: Re-index catalog + scraped courses + career reference for recommendations RAG
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Upsert count in data
 */
