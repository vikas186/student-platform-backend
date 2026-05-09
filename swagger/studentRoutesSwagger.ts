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
 *       multipart/form-data field "file" (required). Optional link: applicationId, application_id, or applicationNumber (UUID or APP-xxxxx); same keys may be sent as query params.
 *       If omitted, the document is linked to your most recently updated application when you have at least one (otherwise applicationId stays null).
 *       Send standalone=true to skip that default (keep applicationId null). Optional documentType / document_type. Max 1 MB. PDF, JPG, PNG.
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
 *               applicationNumber:
 *                 type: string
 *                 description: Alternative to applicationId (same APP-xxxxx format)
 *               standalone:
 *                 type: string
 *                 description: Send true or 1 for standalone upload without linking to an application
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

/**
 * @swagger
 * /api/v1/student/offer-letters:
 *   get:
 *     tags: [Student]
 *     summary: List my offer letters
 *     description: All offer letters linked to this student’s applications (admin/agent uploads). Includes file paths for PDFs when present.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OK
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiError'
 */

/**
 * @swagger
 * /api/v1/student/offer-letters/{offerLetterId}:
 *   get:
 *     tags: [Student]
 *     summary: Get one offer letter by id or OFR reference
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offerLetterId
 *         required: true
 *         schema:
 *           type: string
 *         description: Numeric id (e.g. 12) or reference (e.g. OFR-201)
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Not found or not yours
 */

/**
 * @swagger
 * /api/v1/student/applications/{applicationId}/offer-letter:
 *   get:
 *     tags: [Student]
 *     summary: Get offer letter for a specific application
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Application UUID or APP-xxxxx
 *     responses:
 *       200:
 *         description: OK
 *       404:
 *         description: Application or offer letter not found
 */

/**
 * @swagger
 * /api/v1/student/applications/{applicationId}/offer-letter/signed:
 *   post:
 *     tags: [Student]
 *     summary: Upload signed offer letter (PDF/image) for an application
 *     description: Requires the official offer (`fileUrl`) to exist first. Sets `signedFileUrl` and status `signed` — visible on admin offer list.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Uploaded
 *       400:
 *         description: No official offer yet or bad file
 */

/**
 * @swagger
 * /api/v1/student/offer-letters/{offerLetterId}/signed:
 *   post:
 *     tags: [Student]
 *     summary: Upload signed offer by offer id or OFR reference
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: offerLetterId
 *         required: true
 *         schema:
 *           type: string
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
 *         description: Uploaded
 */

/**
 * @swagger
 * /api/v1/student/universities:
 *   get:
 *     tags: [Student]
 *     summary: List universities (admin-uploaded catalog)
 *     description: |
 *       Browse active universities published by admin. Useful before creating an application.
 *       Only public fields are returned (admin agreement/contract internals are not exposed).
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *           maximum: 200
 *           default: 50
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     universities:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           name: { type: string }
 *                           country: { type: string }
 *                           status: { type: boolean }
 *                           programFeeRanges:
 *                             type: object
 *                             nullable: true
 *                           programsCount: { type: integer }
 *                           createdAt: { type: string, format: date-time }
 *                           updatedAt: { type: string, format: date-time }
 *                     page: { type: integer }
 *                     limit: { type: integer }
 *                     total: { type: integer }
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/student/universities/{universityId}:
 *   get:
 *     tags: [Student]
 *     summary: Get one university (with course catalog)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: universityId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: integer }
 *                     name: { type: string }
 *                     country: { type: string }
 *                     status: { type: boolean }
 *                     programFeeRanges: { type: object, nullable: true }
 *                     programsCount: { type: integer }
 *                     courses:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id: { type: integer }
 *                           courseName: { type: string }
 *                           degree: { type: string }
 *                           fee: { type: number }
 *                           duration: { type: string }
 *       400:
 *         description: Invalid id
 *       404:
 *         description: University not found
 */
