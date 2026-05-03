/**
 * Shared OpenAPI 3.0 component schemas for Swagger UI ("Try it out").
 * Imported into swagger.ts — keep in sync with Joi validations / controllers.
 */

export const openapiSchemas = {
  ApiError: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: false },
      message: { type: 'string', example: 'Validation error' },
      stack: { type: 'string', description: 'Present in development only' },
    },
  },

  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'user@example.com' },
      password: { type: 'string', format: 'password', minLength: 1, example: 'SecurePass1' },
    },
  },

  AdminSignupRequest: {
    type: 'object',
    required: ['fullName', 'email', 'password', 'confirmPassword'],
    properties: {
      fullName: { type: 'string', minLength: 1, maxLength: 200, example: 'Platform Admin' },
      email: { type: 'string', format: 'email', example: 'admin@example.com' },
      password: { type: 'string', format: 'password', minLength: 8, maxLength: 128, example: 'SecurePass1' },
      confirmPassword: { type: 'string', format: 'password', description: 'Must match password' },
      signupSecret: {
        type: 'string',
        maxLength: 500,
        description:
          'Required to match server `ADMIN_SIGNUP_SECRET` when an admin already exists, or when that env is set for the first admin.',
      },
    },
  },

  LoginResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Login successful' },
      token: { type: 'string', description: 'JWT access token (Authorization: Bearer)' },
      refreshToken: { type: 'string', description: 'Opaque refresh token (hex)' },
      data: { $ref: '#/components/schemas/UserPublic' },
    },
  },

  RefreshTokenBody: {
    oneOf: [
      {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: {
            type: 'string',
            minLength: 64,
            maxLength: 256,
            description: 'Opaque refresh from login or last refresh',
          },
        },
      },
      {
        type: 'object',
        required: ['refresh_token'],
        properties: {
          refresh_token: { type: 'string', minLength: 64, maxLength: 256 },
        },
      },
    ],
    description: 'Use either shape (not both required).',
  },

  RefreshTokenResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Token refreshed successfully' },
      token: { type: 'string' },
      refreshToken: { type: 'string', description: 'New opaque refresh (previous one is invalid)' },
      data: { $ref: '#/components/schemas/UserPublic' },
    },
  },

  UserPublic: {
    type: 'object',
    description: 'User without password',
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', nullable: true },
      role: { type: 'string', enum: ['student', 'agent', 'admin'] },
      status: { type: 'boolean' },
    },
  },

  StudentPortalProfile: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      fullName: { type: 'string' },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', nullable: true },
      role: { type: 'string', example: 'student' },
      countryOfResidence: { type: 'string', nullable: true },
      targetCountries: { type: 'array', items: { type: 'string' } },
      highestEducation: { type: 'string', nullable: true },
      gradeGpa: { type: 'string', nullable: true },
      academicDetails: { type: 'object', nullable: true },
      preferredCountry: { type: 'string', nullable: true },
      linkedAgentProfileId: { type: 'integer', nullable: true, description: 'FK to agent_profiles.id' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  StudentProfilePatch: {
    type: 'object',
    properties: {
      fullName: { type: 'string', maxLength: 200 },
      name: { type: 'string', maxLength: 200 },
      email: { type: 'string', format: 'email' },
      phone: { type: 'string', maxLength: 64, nullable: true },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      countryOfResidence: { type: 'string', maxLength: 120, nullable: true },
      targetCountries: { type: 'array', items: { type: 'string' }, maxItems: 50 },
      highestEducation: { type: 'string', maxLength: 120, nullable: true },
      gradeGpa: { type: 'string', maxLength: 32, nullable: true },
      linkedAgentProfileId: { type: 'integer', minimum: 1, nullable: true },
      agentProfileId: { type: 'integer', minimum: 1, nullable: true },
    },
  },

  ApplicationDraftBody: {
    type: 'object',
    properties: {
      universityName: { type: 'string', maxLength: 300, nullable: true, example: 'University of Toronto' },
      programName: { type: 'string', maxLength: 300, nullable: true, example: 'MSc Computer Science' },
      notes: { type: 'string', maxLength: 8000, nullable: true },
      country: { type: 'string', maxLength: 120, nullable: true, example: 'Canada' },
    },
  },

  ApplicationRecord: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      studentId: { type: 'integer' },
      agentId: { type: 'integer', nullable: true },
      courseId: { type: 'integer', nullable: true },
      universityName: { type: 'string', nullable: true },
      programName: { type: 'string', nullable: true },
      notes: { type: 'string', nullable: true },
      country: { type: 'string', nullable: true },
      applicationNumber: { type: 'string', example: 'APP-10241' },
      status: { type: 'string', example: 'draft' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  StudentApplicationsListResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
      data: { type: 'array', items: { $ref: '#/components/schemas/ApplicationRecord' } },
    },
  },

  StudentProfileResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
      data: { $ref: '#/components/schemas/StudentPortalProfile' },
    },
  },

  DocumentRecord: {
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      applicationId: { type: 'string', format: 'uuid', nullable: true },
      fileUrl: { type: 'string' },
      originalFileName: { type: 'string' },
      type: { type: 'string' },
      fileSize: { type: 'integer' },
      status: { type: 'string', enum: ['pending', 'verified', 'rejected'] },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  AgentProfileResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/UserPublic' },
          agency: {
            type: 'object',
            properties: {
              id: { type: 'integer', example: 1 },
              agencyName: { type: 'string' },
              primaryMarket: { type: 'string', nullable: true },
              logoUrl: { type: 'string', nullable: true },
            },
          },
        },
      },
    },
  },

  AgentProfilePatch: {
    type: 'object',
    properties: {
      fullName: { type: 'string' },
      name: { type: 'string' },
      agencyName: { type: 'string' },
      primaryMarket: { type: 'string', nullable: true },
      logoUrl: { type: 'string', nullable: true },
    },
  },

  AgentCreateApplicationBody: {
    type: 'object',
    required: ['studentProfileId'],
    properties: {
      studentProfileId: { type: 'integer', minimum: 1, example: 1 },
      universityName: { type: 'string', nullable: true },
      programName: { type: 'string', nullable: true },
      country: { type: 'string', nullable: true },
      courseId: { type: 'integer', nullable: true },
      notes: { type: 'string', nullable: true },
      commissionAmount: { type: 'number', nullable: true },
      commissionSlab: { type: 'string', nullable: true },
      metadata: { type: 'object', additionalProperties: true, nullable: true },
    },
  },

  AgentPatchApplicationBody: {
    type: 'object',
    properties: {
      universityName: { type: 'string', nullable: true },
      programName: { type: 'string', nullable: true },
      country: { type: 'string', nullable: true },
      courseId: { type: 'integer', nullable: true },
      notes: { type: 'string', nullable: true },
      commissionAmount: { type: 'number', nullable: true },
      commissionSlab: { type: 'string', nullable: true },
      metadata: { type: 'object', additionalProperties: true, nullable: true },
    },
  },

  AgentApplicationsPagedResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          data: { type: 'array', items: { $ref: '#/components/schemas/ApplicationRecord' } },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 42 },
        },
      },
    },
  },

  VerifyDocumentsDemoBody: {
    type: 'object',
    required: ['applicationId'],
    properties: {
      applicationId: { type: 'string', description: 'UUID or APP-10241', example: 'APP-10241' },
    },
  },

  CreateOfferLetterBody: {
    type: 'object',
    required: ['applicationId'],
    properties: {
      applicationId: { type: 'string', description: 'UUID or APP-xxxxx' },
      fileUrl: { type: 'string', nullable: true },
      expiresAt: { type: 'string', format: 'date-time', nullable: true },
      notes: { type: 'string', nullable: true },
      universityName: { type: 'string', nullable: true },
      programName: { type: 'string', nullable: true },
    },
  },

  DepositPayLinkBody: {
    type: 'object',
    required: ['applicationId', 'amount'],
    properties: {
      applicationId: { type: 'string' },
      amount: { type: 'number', example: 5000 },
      currency: { type: 'string', example: 'USD' },
      studentEmail: { type: 'string', format: 'email', nullable: true },
    },
  },

  University: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      name: { type: 'string' },
      country: { type: 'string' },
    },
  },

  Course: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      universityId: { type: 'integer' },
      courseName: { type: 'string' },
      degree: { type: 'string' },
      fee: { type: 'number' },
      duration: { type: 'string' },
      university: { $ref: '#/components/schemas/University' },
    },
  },

  CatalogListResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      data: { type: 'array', items: {} },
    },
  },

  AgentDashboardResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          statusCounts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                count: { type: 'string' },
              },
            },
          },
          recentApplications: { type: 'array', items: { $ref: '#/components/schemas/ApplicationRecord' } },
        },
      },
    },
  },

  AgentSearchResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          applications: { type: 'array', items: {} },
          documents: { type: 'array', items: {} },
          courses: { type: 'array', items: {} },
        },
      },
    },
  },

  AgentCommissionResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      message: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          summary: {
            type: 'object',
            properties: {
              earnedThisCycle: { type: 'number' },
              projectedTotal: { type: 'number' },
              defaultEnrolledRateSample: { type: 'number' },
            },
          },
          rows: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  },
};
