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
 * /api/v1/admin/permissions:
 *   get:
 *     tags: [Admin]
 *     summary: Roles & permissions matrix (catalog + matrix + summary counts)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: data.catalog (modules/actions), data.matrix[role][moduleKey][actionKey], data.summary (granted/total/percent per role)
 *   put:
 *     tags: [Admin]
 *     summary: Replace entire permission matrix
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [matrix]
 *             properties:
 *               matrix:
 *                 type: object
 *                 description: Full matrix for student, agent, admin, university — each module and action from GET catalog must be present with boolean values
 */

/**
 * @swagger
 * /api/v1/admin/permissions/reset:
 *   post:
 *     tags: [Admin]
 *     summary: Reset permissions to platform defaults
 *     security: [{ bearerAuth: [] }]
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
 * /api/v1/admin/offer-letters/upload-match:
 *   post:
 *     tags: [Admin]
 *     summary: Upload offer PDF and attach by fuzzy match or explicit application ref
 *     description: |
 *       Multipart: `file` (required). Form fields: `studentName`, `program`, `university` (required when `applicationId` is omitted).
 *       Optional: `applicationId` or `application_id` or `applicationNumber` — UUID or `APP-12345`; when set, skips name/program/university matching.
 *       Optional: `studentEmail` / `student_email` — narrows fuzzy match to that student.
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
 *     summary: Partner agencies dashboard (students, conversion %, Gold/Silver/Bronze tier)
 *     description: |
 *       **data** — array of agents. **meta** — `total`, `page`, `limit` (if `limit` query is set, results are paginated).
 *       Conversion = applications with status enrolled / visa_approved / deposit_paid ÷ all applications scoped to the agent
 *       (`agent_id` **or** student linked via `student_profiles.agent_profile_id`).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Filter by agency name, primary market / country, or agent user name
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, conversion, students, tier]
 *         description: Default name (A–Z). conversion = highest % first; students = most students first; tier = Gold first
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 200 }
 *         description: Omit to return all agents (still sorted/filtered)
 */
