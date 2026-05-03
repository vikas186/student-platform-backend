/**
 * @swagger
 * /api/v1/admin/dashboard:
 *   get:
 *     tags: [Admin]
 *     summary: Dashboard summary counts
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Users by role, applications by status, pending payments, agent count
 */

/**
 * @swagger
 * /api/v1/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List users (search, role filter, pagination)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [student, agent, admin, university] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *   post:
 *     tags: [Admin]
 *     summary: Create user (student / agent / admin / university)
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/admin/users/{userId}/role:
 *   patch:
 *     tags: [Admin]
 *     summary: Change user role
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/admin/applications:
 *   get:
 *     tags: [Admin]
 *     summary: List all applications (search, status, pagination)
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/admin/applications/{applicationId}/status:
 *   patch:
 *     tags: [Admin]
 *     summary: Update application lifecycle status
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/admin/deadlines:
 *   get:
 *     tags: [Admin]
 *     summary: University intake matrix rows
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Admin]
 *     summary: Add intake row (requires universityId + courseId + deadlineDate)
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/admin/offer-letters:
 *   get:
 *     tags: [Admin]
 *     summary: List uploaded offers (OFR refs)
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Admin]
 *     summary: Create offer letter row for an application (upload file via …/file)
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/admin/offer-letters/{offerLetterId}/file:
 *   post:
 *     tags: [Admin]
 *     summary: Upload PDF (multipart field `file`)
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/admin/agents:
 *   get:
 *     tags: [Admin]
 *     summary: Partner agencies with metrics (conversion, tier)
 *     security: [{ bearerAuth: [] }]
 */
