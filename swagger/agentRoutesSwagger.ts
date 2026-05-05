/**
 * @swagger
 * tags:
 *   - name: Agent
 *     description: Agent portal — JWT role must be **agent**
 */

/**
 * @swagger
 * /api/v1/agent/profile:
 *   get:
 *     tags: [Agent]
 *     summary: Agent + agency profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AgentProfileResponse' }
 *   patch:
 *     tags: [Agent]
 *     summary: Update display name, agency, logo
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AgentProfilePatch' }
 *           example:
 *             fullName: Agent Name
 *             agencyName: GlobalEdu Partners
 *             logoUrl: https://example.com/logo.png
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AgentProfileResponse' }
 */

/**
 * @swagger
 * /api/v1/agent/dashboard:
 *   get:
 *     tags: [Agent]
 *     summary: Status counts and recent applications
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AgentDashboardResponse' }
 */

/**
 * @swagger
 * /api/v1/agent/search:
 *   get:
 *     tags: [Agent]
 *     summary: Global search (applications, documents, courses)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Search text
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AgentSearchResponse' }
 */

/**
 * @swagger
 * /api/v1/agent/students:
 *   post:
 *     tags: [Agent]
 *     summary: Create a student account linked to this agent
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AgentNewStudentInput' }
 *     responses:
 *       201:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AgentCreateStudentResponse' }
 *   get:
 *     tags: [Agent]
 *     summary: Students linked via applications or profile.agent_profile_id
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Filter by name/email substring
 */

/**
 * @swagger
 * /api/v1/agent/applications:
 *   get:
 *     tags: [Agent]
 *     summary: List applications (paginated)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, submitted, under_review, approved, rejected, offer_generated, deposit_paid, visa_approved, enrolled]
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *       - in: query
 *         name: applicationNumber
 *         schema: { type: string }
 *       - in: query
 *         name: id
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AgentApplicationsPagedResponse' }
 *   post:
 *     tags: [Agent]
 *     summary: Create draft application (existing student **or** inline new student)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AgentCreateApplicationBody' }
 *     responses:
 *       201:
 *         description: Created — response **data** is the application record (plus **temporaryPassword** when a new student was created without a password)
 */

/**
 * @swagger
 * /api/v1/agent/applications/export:
 *   get:
 *     tags: [Agent]
 *     summary: Export applications CSV (same filters as list)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: country
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: CSV file
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 */

/**
 * @swagger
 * /api/v1/agent/applications/{applicationId}:
 *   get:
 *     tags: [Agent]
 *     summary: Get one application (UUID or APP-xxxxx)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 *   patch:
 *     tags: [Agent]
 *     summary: Update draft application
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AgentPatchApplicationBody' }
 *   delete:
 *     tags: [Agent]
 *     summary: Delete draft
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 */

/**
 * @swagger
 * /api/v1/agent/applications/{applicationId}/submit:
 *   post:
 *     tags: [Agent]
 *     summary: Submit draft application
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema: { type: string }
 */

/**
 * @swagger
 * /api/v1/agent/documents:
 *   get:
 *     tags: [Agent]
 *     summary: List documents (optional filter by application)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: applicationId
 *         schema: { type: string }
 *         description: UUID or APP-xxxxx
 *   post:
 *     tags: [Agent]
 *     summary: Upload document (multipart)
 *     description: |
 *       **file** (required). Provide **either** applicationId / application_id / applicationNumber (UUID or APP-xxxxx), **or** studentProfileId / student_profile_id (upload attaches to that student's latest application in your portfolio).
 *       Optional documentType / document_type. Same keys may be sent as query params.
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
 *               applicationId:
 *                 type: string
 *                 description: UUID or APP-xxxxx
 *               applicationNumber:
 *                 type: string
 *               studentProfileId:
 *                 type: integer
 *                 description: Alternative — latest application for this student
 *               documentType:
 *                 type: string
 *                 example: passport_id
 */

/**
 * @swagger
 * /api/v1/agent/documents/{documentId}:
 *   patch:
 *     tags: [Agent]
 *     summary: Update document status (verify/reject)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, verified, rejected]
 *   delete:
 *     tags: [Agent]
 *     summary: Delete document
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema: { type: string, format: uuid }
 */

/**
 * @swagger
 * /api/v1/agent/documents/verify-demo:
 *   post:
 *     tags: [Agent]
 *     summary: Document checklist demo for an application
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/VerifyDocumentsDemoBody' }
 */

/**
 * @swagger
 * /api/v1/agent/offer-letters:
 *   get:
 *     tags: [Agent]
 *     summary: List offer letters
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Agent]
 *     summary: Create offer letter for an application
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CreateOfferLetterBody' }
 */

/**
 * @swagger
 * /api/v1/agent/offer-letters/{offerLetterId}:
 *   get:
 *     tags: [Agent]
 *     summary: Get offer letter (numeric id or OFR-201)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: offerLetterId
 *         required: true
 *         schema: { type: string }
 *   patch:
 *     tags: [Agent]
 *     summary: Patch offer letter metadata / URLs / status
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: offerLetterId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileUrl: { type: string, nullable: true }
 *               signedFileUrl: { type: string, nullable: true }
 *               status: { type: string, enum: [pending, active, signed, sent, expired] }
 *               expiresAt: { type: string, format: date-time }
 *               notes: { type: string }
 */

/**
 * @swagger
 * /api/v1/agent/offer-letters/{offerLetterId}/file:
 *   post:
 *     tags: [Agent]
 *     summary: Upload primary offer PDF
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: offerLetterId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 */

/**
 * @swagger
 * /api/v1/agent/offer-letters/{offerLetterId}/signed:
 *   post:
 *     tags: [Agent]
 *     summary: Upload signed acceptance PDF
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: offerLetterId
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 */

/**
 * @swagger
 * /api/v1/agent/offer-letters/{offerLetterId}/send:
 *   post:
 *     tags: [Agent]
 *     summary: Mark offer as sent
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: offerLetterId
 *         required: true
 *         schema: { type: string }
 */

/**
 * @swagger
 * /api/v1/agent/commission:
 *   get:
 *     tags: [Agent]
 *     summary: Commission summary + rows + calculator (pipeline universities with admin slab %)
 *     description: |
 *       **data.calculator.universities** lists **all** admin **Commission** slabs (so every partner rate appears), merged with pipeline-only universities; **inPipeline** marks universities on this agent's applications.
 *       Frontend formula: `estimatedCommission = annualTuition * (commissionPercent / 100)` when percent is set.
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AgentCommissionResponse' }
 */

/**
 * @swagger
 * /api/v1/agent/deposits/pay-link:
 *   post:
 *     tags: [Agent]
 *     summary: Create deposit payment link
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/DepositPayLinkBody' }
 */

/**
 * @swagger
 * /api/v1/agent/deadlines:
 *   get:
 *     tags: [Agent]
 *     summary: University/program deadlines
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 */

/**
 * @swagger
 * /api/v1/agent/discovery/universities:
 *   get:
 *     tags: [Agent]
 *     summary: Search universities
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 */

/**
 * @swagger
 * /api/v1/agent/discovery/courses:
 *   get:
 *     tags: [Agent]
 *     summary: Search courses
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema: { type: string }
 */
