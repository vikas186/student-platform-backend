/**
 * @swagger
 * tags:
 *   - name: University
 *     description: University portal — JWT role must be **university**
 */

/**
 * @swagger
 * /api/v1/university/dashboard:
 *   get:
 *     tags: [University]
 *     summary: KPI metrics, partnership summary, status breakdown
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Dashboard payload
 */

/**
 * @swagger
 * /api/v1/university/partnership:
 *   get:
 *     tags: [University]
 *     summary: Partnership dispatch / countersigned flags (read-only)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Partnership summary
 */

/**
 * @swagger
 * /api/v1/university/partnership/countersigned-contract:
 *   post:
 *     tags: [University]
 *     summary: Upload countersigned PDF (multipart field **file**)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Updated partnership summary
 */

/**
 * @swagger
 * /api/v1/university/commission:
 *   get:
 *     tags: [University]
 *     summary: Commission slabs (locked until countersigned contract is stored)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: { locked, reason?, commissions }
 */

/**
 * @swagger
 * /api/v1/university/applications:
 *   get:
 *     tags: [University]
 *     summary: Paginated applications for this institution
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated list with statusUi
 */

/**
 * @swagger
 * /api/v1/university/applications/{applicationId}:
 *   get:
 *     tags: [University]
 *     summary: Application detail (scoped)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 *         description: UUID or APP-12345
 *   patch:
 *     tags: [University]
 *     summary: Update application status (Enroll label or backend enum)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, example: Review }
 */

/**
 * @swagger
 * /api/v1/university/applications/{applicationId}/checklist:
 *   get:
 *     tags: [University]
 *     summary: Document checklist for review modal
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 */

/**
 * @swagger
 * /api/v1/university/documents/{documentId}:
 *   patch:
 *     tags: [University]
 *     summary: Verify or reject a document
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [pending, verified, rejected] }
 */

/**
 * @swagger
 * /api/v1/university/application-status-options:
 *   get:
 *     tags: [University]
 *     summary: Backend status values with Enroll statusUi labels
 *     security: [{ bearerAuth: [] }]
 */
