/**
 * @swagger
 * /api/v1/chat/message:
 *   post:
 *     tags: [Chat]
 *     summary: Send a message and get an AI reply
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               sessionId: { type: string, format: uuid, nullable: true, description: Omit to start a new session }
 *               message: { type: string, maxLength: 8000 }
 *     responses:
 *       200:
 *         description: Reply and message ids
 *       503:
 *         description: OpenAI or knowledge base unavailable
 */

/**
 * @swagger
 * /api/v1/chat/history:
 *   get:
 *     tags: [Chat]
 *     summary: List messages in a session (newest page via cursor)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 50 }
 *       - in: query
 *         name: cursor
 *         schema: { type: string, description: Numeric message id; return older messages than this id }
 *     responses:
 *       200:
 *         description: messages array (oldest first in page)
 */

/**
 * @swagger
 * /api/v1/chat/history:
 *   delete:
 *     tags: [Chat]
 *     summary: Delete chat history for the current user
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: sessionId
 *         schema: { type: string, format: uuid }
 *         description: Delete one session (required unless all=true)
 *       - in: query
 *         name: all
 *         schema: { type: string, enum: ['true', 'false'] }
 *         description: Pass true to delete every session for this user
 *     responses:
 *       200:
 *         description: Deleted
 */

/**
 * @swagger
 * /api/v1/chat/feedback:
 *   post:
 *     tags: [Chat]
 *     summary: Rate an assistant message (upsert per user)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [messageId, rating]
 *             properties:
 *               messageId: { type: integer }
 *               rating: { type: integer, minimum: -1, maximum: 5 }
 *               comment: { type: string, maxLength: 2000, nullable: true }
 *     responses:
 *       200:
 *         description: Saved
 */

/**
 * @swagger
 * /api/v1/admin/chat/knowledge/sync:
 *   post:
 *     tags: [Admin]
 *     summary: Rebuild knowledge_base embeddings from catalog (OpenAI + pgvector)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Upsert count in data
 */

/**
 * @swagger
 * /api/v1/admin/students/{studentProfileId}/counselling:
 *   patch:
 *     tags: [Admin]
 *     summary: Set student counselling completed (unlocks named universities in chat)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: studentProfileId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [counsellingCompleted]
 *             properties:
 *               counsellingCompleted: { type: boolean }
 *     responses:
 *       200:
 *         description: Updated student profile
 */
