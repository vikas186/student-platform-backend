/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Sign up (student or agent)
 *     description: |
 *       Creates a new **student** or **agent** account based on `role`.
 *       - **student**: requires `phoneNumber` and `targetCountries` (do not send agency fields).
 *       - **agent**: requires `agencyName` and `primaryMarket` (do not send `targetCountries`).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *           examples:
 *             student:
 *               summary: Student signup
 *               value:
 *                 role: student
 *                 fullName: Alex Johnson
 *                 email: student@example.com
 *                 password: SecurePass1
 *                 confirmPassword: SecurePass1
 *                 phoneNumber: "+91 9876543210"
 *                 targetCountries:
 *                   - Canada
 *                   - United Kingdom
 *             agent:
 *               summary: Agent signup
 *               value:
 *                 role: agent
 *                 fullName: Morgan Lee
 *                 email: agent@example.com
 *                 password: SecurePass1
 *                 confirmPassword: SecurePass1
 *                 agencyName: GlobalEdu Consulting
 *                 primaryMarket: India
 *     responses:
 *       201:
 *         description: Account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [success, message, data]
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: Student account created successfully }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/UserPublic' }
 *       400:
 *         description: Validation error or email already registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/v1/auth/users/{userId}:
 *   delete:
 *     tags:
 *       - Auth
 *     summary: Delete user (admin)
 *     description: Permanently removes a user and dependent rows. Path `userId` must be a UUID.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User deleted
 *       400:
 *         description: Invalid id or delete failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin role required
 */

/**
 * @swagger
 * /api/v1/auth/admin/signup:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Admin sign up
 *     description: |
 *       Creates a user with role **admin** (no student/agent profile).
 *       - **First admin**: allowed without `signupSecret` unless `ADMIN_SIGNUP_SECRET` is set on the server (then body must match).
 *       - **Additional admins**: require `signupSecret` to match `ADMIN_SIGNUP_SECRET` (env must be non-empty).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminSignupRequest'
 *     responses:
 *       201:
 *         description: Admin account created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string }
 *                 data:
 *                   type: object
 *                   properties:
 *                     user: { $ref: '#/components/schemas/UserPublic' }
 *       400:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Invalid or missing admin signup secret
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */

/**
 * @swagger
 * /api/v1/auth/admin/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Admin log in
 *     description: |
 *       Same credentials shape as `/auth/login`, but only succeeds for users with role **admin**.
 *       Returns JWT `token`, opaque `refreshToken`, and `data` (user). Non-admin accounts receive 403.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: Admin login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       403:
 *         description: Valid credentials but account is not an admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Log in
 *     description: |
 *       Returns a short-lived **access** JWT (`token` — use as `Authorization: Bearer …`),
 *       a long-lived opaque **refreshToken**, and the user object. Call **`POST /api/v1/auth/refresh-token`**
 *       with the latest `refreshToken` to obtain new tokens (refresh is rotated each time).
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: "Login successful"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: "Invalid request"
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       500:
 *         description: "Internal server error"
 */

/**
 * @swagger
 * /api/v1/auth/refresh-token:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Refresh access token
 *     description: |
 *       Exchanges a valid `refreshToken` from login or a previous refresh for a new **token** and **refreshToken**
 *       (rotation). The previous refresh token becomes invalid immediately.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshTokenBody'
 *     responses:
 *       200:
 *         description: New access and refresh tokens issued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RefreshTokenResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 *       401:
 *         description: Invalid or expired refresh token
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Log out (current session)
 *     description: Invalidates the JWT sent in the Authorization header.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "Logout successful"
 *       400:
 *         description: "Invalid request"
 *       500:
 *         description: "Internal server error"
 */

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   patch:
 *     tags: [Auth]
 *     summary: Change password (authenticated)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [oldPassword, newPassword]
 *             properties:
 *               oldPassword: { type: string, format: password }
 *               newPassword: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200:
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 message: { type: string }
 *                 data: { $ref: '#/components/schemas/UserPublic' }
 *       400:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */

/**
 * @swagger
 * /api/v1/auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
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
 *                   type: object
 *                   properties:
 *                     message: { type: string }
 *                     resetUrl: { type: string, description: Reset link (dev) }
 */
