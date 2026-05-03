/**
 * @swagger
 * /api/v1/student/profile:
 *   get:
 *     tags: [Student]
 *     summary: Get my profile
 *     description: Merged user + student fields (incl. linkedAgentProfileId when set).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentProfileResponse'
 *             examples:
 *               sample:
 *                 value:
 *                   success: true
 *                   message: Profile fetched
 *                   data:
 *                     id: "00000000-0000-0000-0000-000000000001"
 *                     fullName: Jane Doe
 *                     email: student@example.com
 *                     linkedAgentProfileId: null
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   patch:
 *     tags: [Student]
 *     summary: Update my profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StudentProfilePatch'
 *           example:
 *             fullName: Jane Doe
 *             countryOfResidence: India
 *             linkedAgentProfileId: 1
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentProfileResponse'
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */

/**
 * @swagger
 * /api/v1/student/applications:
 *   get:
 *     tags: [Student]
 *     summary: List my applications
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Matches university, program, notes, country, application number
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, submitted, under_review, approved, rejected, offer_generated, deposit_paid, visa_approved, enrolled]
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *       - in: query
 *         name: id
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: applicationNumber
 *         description: Exact APP-xxxxx
 *         schema: { type: string, example: APP-10241 }
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StudentApplicationsListResponse'
 *   post:
 *     tags: [Student]
 *     summary: Create draft application
 *     description: Response includes generated applicationNumber (e.g. APP-10241).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplicationDraftBody'
 *           example:
 *             universityName: University of Toronto
 *             programName: MSc Computer Science
 *             country: Canada
 *     responses:
 *       201:
 *         description: Created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/ApplicationRecord'
 */

/**
 * @swagger
 * /api/v1/student/applications/{applicationId}:
 *   get:
 *     tags: [Student]
 *     summary: Get one application
 *     description: "Path applicationId is UUID or APP-10241"
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *           example: APP-10241
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   $ref: '#/components/schemas/ApplicationRecord'
 *       404:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 *   patch:
 *     tags: [Student]
 *     summary: Update draft application
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ApplicationDraftBody'
 *     responses:
 *       200:
 *         description: Updated draft
 *   delete:
 *     tags: [Student]
 *     summary: Delete draft application
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 */

/**
 * @swagger
 * /api/v1/student/applications/{applicationId}/submit:
 *   post:
 *     tags: [Student]
 *     summary: Submit application (draft → submitted)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Submitted
 */

/**
 * @swagger
 * /api/v1/student/documents:
 *   get:
 *     tags: [Student]
 *     summary: List my documents
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DocumentRecord'
 *   post:
 *     tags: [Student]
 *     summary: Upload document (multipart)
 *     description: |
 *       multipart/form-data field "file" (required). Optional applicationId (UUID or APP-xxxxx), documentType (string). Max 1 MB. PDF, JPG, PNG.
 *     security:
 *       - bearerAuth: []
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
 *               applicationId:
 *                 type: string
 *                 description: UUID or APP-10241
 *               documentType:
 *                 type: string
 *                 example: passport_id
 *     responses:
 *       201:
 *         description: Uploaded
 *       400:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */

/**
 * @swagger
 * /api/v1/student/documents/{documentId}:
 *   delete:
 *     tags: [Student]
 *     summary: Delete document
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 */
