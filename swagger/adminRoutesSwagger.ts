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

/**
 * @swagger
 * /api/v1/admin/agents/agreements:
 *   get:
 *     tags: [Admin]
 *     summary: List agent partnership agreements (queue)
 *     description: |
 *       Defaults to the **submitted** queue (agents who have uploaded a signed copy
 *       and are awaiting admin approval). Use `status` to view other states.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, submitted, approved, rejected]
 *           default: submitted
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 200, default: 50 }
 *     responses:
 *       200:
 *         description: OK
 */

/**
 * @swagger
 * /api/v1/admin/agents/{agentProfileId}/agreement/approve:
 *   post:
 *     tags: [Admin]
 *     summary: Approve an agent's signed agreement (unlocks their portal)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: agentProfileId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Approved
 *       400:
 *         description: Agent has not submitted a signed agreement yet
 *       404:
 *         description: Agent profile not found
 */

/**
 * @swagger
 * /api/v1/admin/agents/{agentProfileId}/agreement/reject:
 *   post:
 *     tags: [Admin]
 *     summary: Reject an agent's signed agreement (agent can re-upload)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: agentProfileId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 maxLength: 2000
 *                 description: Optional human-readable reason shown to the agent
 *     responses:
 *       200:
 *         description: Rejected
 *       400:
 *         description: Agreement is not in a rejectable state
 *       404:
 *         description: Agent profile not found
 */

/**
 * @swagger
 * /api/v1/admin/agents/{agentProfileId}/agreement:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete an agent's signed agreement and reset onboarding
 *     description: |
 *       Clears the stored signed PDF (when saved locally), sets status to **pending**, and removes approval metadata.
 *       The agent portal locks until the agent uploads again and an admin approves.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: agentProfileId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Agreement removed; workflow reset to pending
 *       404:
 *         description: Agent profile not found
 */

/**
 * @swagger
 * /api/v1/admin/universities:
 *   get:
 *     tags: [Admin]
 *     summary: List universities (admin grid) with metrics
 *     description: |
 *       Each item includes **programsCount** (courses), **applicantsCount** (non-draft applications scoped to the institution),
 *       and **offersCount** (applications with status `offer_generated`). Optional **search** filters by name or country (ILIKE);
 *       **page** and **limit** paginate (defaults page=1, limit=100).
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search university name or country
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 200 }
 *     responses:
 *       200:
 *         description: data.universities, data.total, data.page, data.limit
 */

/**
 * @swagger
 * /api/v1/admin/universities/{universityId}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a university
 *     description: |
 *       Permanently removes the university row. Related **courses**, **deadlines**, **commissions**, and **university profiles**
 *       are removed via database cascades. Applications that only store the university as free text are not deleted.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: universityId
 *         required: true
 *         schema: { type: integer, minimum: 1 }
 *     responses:
 *       200:
 *         description: University deleted
 *       400:
 *         description: Invalid university id
 *       404:
 *         description: University not found
 */

/**
 * @swagger
 * /api/v1/admin/universities/import-catalog:
 *   post:
 *     tags: [Admin]
 *     summary: Import university catalog (Excel/CSV, one row per institution)
 *     description: |
 *       **No university id in the path** — each data row is a separate institution (name + country + fee matrix).
 *       Creates or updates `University` by name+country and stores **programFeeRanges** (UG/PG Business, STEM, CS).
 *       Accepts **.xlsx**, **.xls**, or **.csv** (export/save as UTF-8 CSV from Excel if needed). First sheet is read;
 *       the header row is auto-detected (rows above titles are skipped). Column titles may match e.g. *University*,
 *       *Country*, *UG – Business Fees (USD/year)*, *PG – STEM Fees*, etc.
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
 *         description: created / updated row counts; optional rowErrors
 */

/**
 * @swagger
 * /api/v1/admin/universities/{universityId}/courses/import-csv:
 *   post:
 *     tags: [Admin]
 *     summary: Import courses for one university (CSV)
 *     description: |
 *       For **course rows** linked to a **selected** `universityId` only. For a **full fee matrix** (one row per university, no pre-selected school), use **`POST /admin/universities/import-catalog`** instead.
 *       Multipart field **file** (`.csv`, max 10 MB). **Required** headers: university name + course/program name.
 *       Each row must include `universityName` matching an existing catalog university (no dropdown fallback).
 *       Optional scrape-style columns: country, studyLevel/degree, tuitionFee/fee, duration, intake, ieltsRequirement,
 *       academicRequirement, applicationFee, scholarship, courseUrl.
 *       Upserts **Course** by resolved `universityId` + course name; IELTS/academic/intake/etc. saved on `admissionRequirements`.
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: universityId
 *         required: true
 *         schema: { type: integer }
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
 *         description: created/updated counts and optional rowErrors
 */

/**
 * @swagger
 * /api/v1/admin/courses:
 *   get:
 *     tags: [Admin]
 *     summary: List courses for a university
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: universityId
 *         required: true
 *         schema: { type: integer }
 *   post:
 *     tags: [Admin]
 *     summary: Create a course under a university (fee / duration)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [universityId, courseName, degree, fee, duration]
 *             properties:
 *               universityId: { type: integer }
 *               courseName: { type: string }
 *               degree: { type: string }
 *               fee: { type: number }
 *               duration: { type: string }
 */

/**
 * @swagger
 * /api/v1/admin/courses/{courseId}:
 *   patch:
 *     tags: [Admin]
 *     summary: Patch course catalog fields
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: integer }
 */
