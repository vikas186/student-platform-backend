/**
 * @swagger
 * /api/v1/user/my-profile:
 *   get:
 *     tags: [User]
 *     summary: Get my profile (any authenticated role)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile payload
 *       401:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */

/**
 * @swagger
 * /api/v1/user/update-profile:
 *   patch:
 *     tags: [User]
 *     summary: Update profile (multipart — optional profile photo)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePhoto:
 *                 type: string
 *                 format: binary
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */

/**
 * @swagger
 * /api/v1/user/account:
 *   delete:
 *     tags: [User]
 *     summary: Delete my account (self-service)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted
 *       401:
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ApiError' }
 */
