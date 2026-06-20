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

  /** `POST /auth/university/signup` — Uniwizer university signup (no `role` field). */
  UniversitySignupRequest: {
    type: 'object',
    required: ['email', 'password', 'confirmPassword', 'institutionName', 'country'],
    properties: {
      email: { type: 'string', format: 'email', example: 'admissions@pnwu.edu' },
      password: { type: 'string', format: 'password', minLength: 8, maxLength: 128, example: 'SecurePass1' },
      confirmPassword: { type: 'string', format: 'password', description: 'Must match password' },
      institutionName: {
        type: 'string',
        minLength: 1,
        maxLength: 300,
        example: 'Pacific Northwest University',
        description: 'Institution display name; stored on user `name` and used to find or create `University`.',
      },
      country: {
        type: 'string',
        minLength: 1,
        maxLength: 120,
        example: 'United Kingdom',
        description: 'Country / region; paired with institution name to match or create the institution.',
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
      role: { type: 'string', enum: ['student', 'agent', 'admin', 'university'] },
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
      applicationNumber: {
        type: 'string',
        example: 'APP-10241',
        description: 'Globally unique reference (PostgreSQL sequence + unique index)',
      },
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

  AgentNewStudentInput: {
    type: 'object',
    required: ['email', 'fullName'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: {
        type: 'string',
        minLength: 8,
        description: 'Optional; if omitted a temporary password is generated and returned once',
      },
      fullName: { type: 'string', example: 'Jane Student' },
      phone: { type: 'string', nullable: true },
      targetCountries: { type: 'array', items: { type: 'string' } },
      countryOfResidence: { type: 'string', nullable: true },
      dateOfBirth: { type: 'string', nullable: true },
      nationality: { type: 'string', nullable: true },
    },
  },

  AgentCreateStudentResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string' },
      data: {
        type: 'object',
        properties: {
          studentProfileId: { type: 'integer' },
          user: { $ref: '#/components/schemas/UserPublic' },
          temporaryPassword: { type: 'string', description: 'Present only when password was auto-generated' },
        },
      },
    },
  },

  AgentCreateApplicationBody: {
    type: 'object',
    description:
      'Send **either** `studentProfileId` (existing student in your portfolio) **or** `student` (inline new student). Not both.',
    properties: {
      studentProfileId: { type: 'integer', minimum: 1, example: 1 },
      student: { $ref: '#/components/schemas/AgentNewStudentInput' },
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

  CatalogProgram: {
    type: 'object',
    description: 'Program nested under a university — from admin courses, scraped catalog, or fee-range matrix.',
    properties: {
      id: {
        oneOf: [{ type: 'integer' }, { type: 'string' }],
        example: 10,
        description: 'Numeric id for DB/scraped rows; synthetic string id for fee-range programs (e.g. fee-ugBusinessUsdYear).',
      },
      courseName: { type: 'string', example: 'Master of Computer Science' },
      degree: { type: 'string', example: 'Postgraduate' },
      fee: { type: 'number', nullable: true, example: 42000 },
      feeRange: {
        type: 'string',
        nullable: true,
        example: '$18,000 – $38,000',
        description: 'Present for scraped tuition strings or catalog fee-matrix rows.',
      },
      duration: { type: 'string', example: '2 Years' },
      source: {
        type: 'string',
        enum: ['course', 'scrape', 'fee_range'],
        example: 'scrape',
      },
    },
  },

  CatalogUniversityWithPrograms: {
    type: 'object',
    properties: {
      id: { type: 'integer', example: 1 },
      name: { type: 'string', example: 'University of Toronto' },
      country: { type: 'string', example: 'Canada' },
      status: { type: 'boolean', example: true },
      programFeeRanges: { type: 'object', nullable: true },
      programsCount: { type: 'integer', example: 2 },
      programs: {
        type: 'array',
        items: { $ref: '#/components/schemas/CatalogProgram' },
      },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },

  PublicUniversitiesWithProgramsResponse: {
    type: 'object',
    properties: {
      success: { type: 'boolean', example: true },
      message: { type: 'string', example: 'Universities with programs fetched' },
      data: {
        type: 'object',
        properties: {
          universities: {
            type: 'array',
            items: { $ref: '#/components/schemas/CatalogUniversityWithPrograms' },
          },
          page: { type: 'integer', example: 1 },
          limit: { type: 'integer', example: 20 },
          total: { type: 'integer', example: 25 },
        },
      },
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
          calculator: {
            type: 'object',
            description: 'Pipeline universities × admin commission slabs (GET /admin/commissions)',
            properties: {
              hint: { type: 'string' },
              universities: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    universityId: { type: 'integer', nullable: true },
                    universityName: { type: 'string' },
                    commissionPercent: {
                      type: 'number',
                      nullable: true,
                      description: 'Admin-configured partner %; null if no slab or unknown university',
                    },
                    commissionId: { type: 'integer', nullable: true },
                    slabLabel: { type: 'string', nullable: true },
                    slabDetails: { type: 'string', nullable: true },
                    parsedSlab: { type: 'object', additionalProperties: true, nullable: true },
                    inPipeline: {
                      type: 'boolean',
                      description: 'True if this university appears on at least one of the agent applications',
                    },
                  },
                },
              },
            },
          },
          rows: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  },
};
