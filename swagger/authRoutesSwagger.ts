/**
 * @swagger
 * /api/v1/auth/signup:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Sign up (student, agent, or university)
 *     description: |
 *       Creates a new account based on `role`.
 *       - **student**: requires `fullName`, `phoneNumber` and `targetCountries` (do not send agency fields).
 *       - **agent**: requires `fullName`, `agencyName` and `primaryMarket` (do not send `targetCountries`).
 *       - **university**: send **`institutionName`** + **`country`** (Enroll UI — finds or creates institution), **or** **`universityId`** + **`fullName`** (link existing institution). Same validation as `POST /auth/university/signup` when using institution fields.
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
 *             university:
 *               summary: University signup (institution + country)
 *               value:
 *                 role: university
 *                 email: admissions@pnwu.edu
 *                 password: SecurePass1
 *                 confirmPassword: SecurePass1
 *                 institutionName: Pacific Northwest University
 *                 country: United Kingdom
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
 * /api/v1/auth/university/signup:
 *   post:
 *     tags:
 *       - Auth
 *     summary: University portal sign up (Enroll UI fields)
 *     description: |
 *       Matches the Enroll **University** signup form: **email**, **password**, **confirmPassword**,
 *       **institutionName**, **country** (country / region).
 *       Finds an existing `University` by case-insensitive name + country or creates one, then creates
 *       `User` (role `university`, display name = institution name) + **`UniversityProfile`**.
 *       Does not send `role` (always university). For linking an existing row by id only, use `POST /auth/signup`
 *       with `role: university`, `universityId`, and `fullName`.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UniversitySignupRequest'
 *           example:
 *             email: admissions@pnwu.edu
 *             password: SecurePass1
 *             confirmPassword: SecurePass1
 *             institutionName: Pacific Northwest University
 *             country: United Kingdom
 *     responses:
 *       201:
 *         description: Account created
 *       400:
 *         description: Validation error or email taken / university not found
 */

/**
 * @swagger
 * /api/v1/auth/university/login:
 *   post:
 *     tags:
 *       - Auth
 *     summary: University portal log in
 *     description: |
 *       Same body as `/auth/login`, but only succeeds for users with role **university**.
 *       Returns JWT `token`, opaque `refreshToken`, and `data` (user + permissions). Other roles receive 403.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: University login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: Invalid credentials
 *       403:
 *         description: Valid credentials but account is not a university user
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
