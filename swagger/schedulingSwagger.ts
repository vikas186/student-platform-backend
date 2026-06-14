/**
 * @swagger
 * tags:
 *   - name: Scheduling
 *     description: Google Calendar — counselling & mock interview booking
 */

/**
 * @swagger
 * /api/v1/admin/google/auth-url:
 *   get:
 *     tags: [Scheduling, Admin]
 *     summary: Get Google OAuth URL to connect admin calendar
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: OAuth redirect URL
 */

/**
 * @swagger
 * /api/v1/admin/google/callback:
 *   get:
 *     tags: [Scheduling, Admin]
 *     summary: Google OAuth callback (public redirect from Google)
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: state
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       302:
 *         description: Redirect to admin UI
 */

/**
 * @swagger
 * /api/v1/admin/google/connection:
 *   get:
 *     tags: [Scheduling, Admin]
 *     summary: Google Calendar connection status
 *     security: [{ bearerAuth: [] }]
 *   delete:
 *     tags: [Scheduling, Admin]
 *     summary: Disconnect Google Calendar
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/admin/scheduling/availability:
 *   get:
 *     tags: [Scheduling, Admin]
 *     summary: Get counsellor weekly availability
 *     security: [{ bearerAuth: [] }]
 *   put:
 *     tags: [Scheduling, Admin]
 *     summary: Set counsellor weekly availability windows
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/admin/scheduling/appointments:
 *   get:
 *     tags: [Scheduling, Admin]
 *     summary: List appointments (filter by status, type, date range)
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/admin/scheduling/appointments/{appointmentId}/status:
 *   patch:
 *     tags: [Scheduling, Admin]
 *     summary: Update appointment status (completed sets counsellingCompletedAt for counselling)
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/student/scheduling/flow:
 *   get:
 *     tags: [Scheduling, Student]
 *     summary: Student scheduling pipeline state
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/student/scheduling/slots:
 *   get:
 *     tags: [Scheduling, Student]
 *     summary: Available booking slots
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [counselling, mock_interview] }
 *       - in: query
 *         name: from
 *         required: true
 *         schema: { type: string, format: date-time }
 *       - in: query
 *         name: to
 *         required: true
 *         schema: { type: string, format: date-time }
 */

/**
 * @swagger
 * /api/v1/student/scheduling/appointments:
 *   get:
 *     tags: [Scheduling, Student]
 *     summary: List student appointments
 *     security: [{ bearerAuth: [] }]
 *   post:
 *     tags: [Scheduling, Student]
 *     summary: Book counselling or mock interview
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/student/scheduling/appointments/{appointmentId}/cancel:
 *   patch:
 *     tags: [Scheduling, Student]
 *     summary: Cancel a scheduled appointment
 *     security: [{ bearerAuth: [] }]
 */

/**
 * @swagger
 * /api/v1/student/scheduling/appointments/{appointmentId}/reschedule:
 *   patch:
 *     tags: [Scheduling, Student]
 *     summary: Reschedule to a new slot
 *     security: [{ bearerAuth: [] }]
 */
