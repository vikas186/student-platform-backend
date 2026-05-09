const Joi = require('joi');

const signupJoiSchema = {
  body: Joi.object().keys({
    companyName: Joi.string().required(),
    abn: Joi.string().allow(''),
    custom_id: Joi.string().allow(''),
    contactName: Joi.string().required().allow(''),
    position: Joi.string().optional().allow(''),
    email: Joi.string().email().required(),
    mobileNumber: Joi.string().required().allow(''),
    contactNumber: Joi.string().optional().allow(''),
    address: Joi.string().required().allow(''),
    businessCategory: Joi.string().required().allow(''),
    // socialMedia: Joi.string(),
    socialMediaUrl: Joi.object(),
    yearly: Joi.bool().optional(),
    monthly: Joi.bool().optional(),
    otherPlan: Joi.bool().optional(),
    paymentDetails: Joi.object().optional(),
    termsAndConditions: Joi.boolean().required(),
    isSubscription: Joi.boolean().optional(),
    isReferUs: Joi.boolean().optional(),
    referUsCode: Joi.string().optional().allow(''),
    paymentId: Joi.string().optional().allow(''),
  }),
};

const updateAdminProfileJoiSchema = {
  body: Joi.object().keys({
    abn: Joi.string().optional().allow(''),
    contactName: Joi.string().optional().allow(''),
    position: Joi.string().optional().allow(''),
    mobileNumber: Joi.string(),
    contactNumber: Joi.string().optional(),
    address: Joi.string().optional().allow(''),
    firstName: Joi.string().optional().allow(''),
    lastName: Joi.string().optional().allow(''),
    profilePhoto: Joi.string().uri().optional(),
    // socialMediaUrl: Joi.object(),
    socialMedia: Joi.object(),
  }),
};

const loginJoiSchema = {
  body: Joi.object().keys({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    // role: Joi.string().valid('admin', 'superAdmin').required(),
  }),
};

const referrRegisterJoiSchema = {
  body: Joi.object().keys({
    firstName: Joi.string().required().messages({
      'string.empty': 'First Name is required',
      'any.required': 'First Name is required',
    }),
    lastName: Joi.string().required().messages({
      'string.empty': 'Last Name is required',
      'any.required': 'Last Name is required',
    }),
    email: Joi.string().email().required().messages({
      'string.empty': 'Email is required',
      'string.email': 'Invalid email address',
      'any.required': 'Email is required',
    }),
    mobileNumber: Joi.string()
      .required()
      .pattern(/^[0-9]{10,15}$/)
      .messages({
        'string.empty': 'Mobile number is required',
        'string.pattern.base': 'Mobile number must be between 10 and 15 digits',
        'any.required': 'Mobile number is required',
      }),
    // password: Joi.string().required().messages({
    //   // 'string.pattern.base': 'Contact number must be between 10 and 15 digits',
    //   'any.required': 'password is required',
    // }),
    address: Joi.string(),
    senderCode: Joi.string().required().messages({
      'any.required': 'senderCode is required',
    }),
    // referrerCode: Joi.string().allow('').optional()
  }),
};

const getUsersJoiSchema = {
  query: Joi.object().keys({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).default(10),
    sort: Joi.string().valid('username', 'email', 'createdAt', 'updatedAt').default('createdAt'),
    order: Joi.string().valid('asc', 'desc').default('asc'),
    search: Joi.string().optional(),
    role: Joi.string().optional(),
  }),
};
const changePasswordJoiSchema = {
  body: Joi.object().keys({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().required(),
  }),
};

const refreshTokenJoiSchema = {
  body: Joi.object({
    refreshToken: Joi.string().trim().min(64).max(256),
    refresh_token: Joi.string().trim().min(64).max(256),
  })
    .or('refreshToken', 'refresh_token')
    .messages({
      'object.missing': 'Either refreshToken or refresh_token is required',
    }),
};

const signupPassword = Joi.string().min(8).max(128).required();

/** Single signup: `student` requires phone + targetCountries; `agent` requires agency + primary market. */
const adminSignupJoiSchema = {
  body: Joi.object({
    fullName: Joi.string().trim().min(1).max(200).required(),
    email: Joi.string().email().required(),
    password: signupPassword,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'confirmPassword must match password',
    }),
    signupSecret: Joi.string().trim().max(500).optional().allow('', null),
  }),
};

/**
 * Dedicated university signup — matches Enroll UI (email, passwords, institution name, country).
 * Creates or links an institution row, then `User` + `UniversityProfile`.
 */
const universitySignupJoiSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: signupPassword,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'confirmPassword must match password',
    }),
    institutionName: Joi.string().trim().min(1).max(300).required(),
    country: Joi.string().trim().min(1).max(120).required(),
  }),
};

const roleBasedSignupJoiSchema = {
  body: Joi.object({
    role: Joi.string().valid('student', 'agent', 'university').required(),
    fullName: Joi.when('role', {
      is: 'university',
      then: Joi.string().trim().max(200).optional().allow('', null),
      otherwise: Joi.string().trim().min(1).max(200).required(),
    }),
    email: Joi.string().email().required(),
    password: signupPassword,
    confirmPassword: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'confirmPassword must match password',
    }),
    phoneNumber: Joi.string().trim().min(8).max(32).optional().allow(null, ''),
    targetCountries: Joi.when('role', {
      is: 'student',
      then: Joi.array().items(Joi.string().trim().min(1)).min(1).max(50).required(),
      otherwise: Joi.forbidden(),
    }),
    agencyName: Joi.when('role', {
      is: 'agent',
      then: Joi.string().trim().min(1).max(200).required(),
      otherwise: Joi.forbidden(),
    }),
    primaryMarket: Joi.when('role', {
      is: 'agent',
      then: Joi.string().trim().min(1).max(120).required(),
      otherwise: Joi.forbidden(),
    }),
    universityId: Joi.when('role', {
      is: 'university',
      then: Joi.number().integer().positive().optional(),
      otherwise: Joi.forbidden(),
    }),
    institutionName: Joi.when('role', {
      is: 'university',
      then: Joi.string().trim().max(300).optional(),
      otherwise: Joi.forbidden(),
    }),
    country: Joi.when('role', {
      is: 'university',
      then: Joi.string().trim().max(120).optional(),
      otherwise: Joi.forbidden(),
    }),
  }).custom((value: Record<string, unknown>, helpers: { error: (code: string, ctx?: object) => unknown }) => {
    if (value.role !== 'university') {
      return value;
    }
    const uid = value.universityId;
    const hasId = typeof uid === 'number' && uid >= 1;
    const inst = typeof value.institutionName === 'string' ? value.institutionName.trim() : '';
    const ctry = typeof value.country === 'string' ? value.country.trim() : '';
    const hasInst = inst.length > 0 && ctry.length > 0;

    if (hasId && hasInst) {
      return helpers.error('any.custom', {
        message: 'Provide either universityId or institutionName and country, not both',
      });
    }
    if (!hasId && !hasInst) {
      return helpers.error('any.custom', {
        message: 'For university: provide universityId and fullName, or institutionName and country',
      });
    }
    if (hasId && !(typeof value.fullName === 'string' && value.fullName.trim())) {
      return helpers.error('any.custom', { message: 'fullName is required when universityId is set' });
    }
    return value;
  }),
};

const customerSignupJoiSchema = {
  body: Joi.object().keys({
    companyName: Joi.string().required(),
    ABN: Joi.string().required(),
    contactName: Joi.string().required(),
    position: Joi.string().required(),
    email: Joi.string().email().required(),
    mobileNumber: Joi.string().required(),
    contactNumber: Joi.string().optional(),
    address: Joi.string().required(),
    businessCategory: Joi.string().required(),
    socialMedia: Joi.string(),
    yearly: Joi.number().optional(),
    monthly: Joi.number().optional(),
    paymentDetails: Joi.string().optional(),
    termsAndConditions: Joi.boolean().required(),
    password: Joi.string().required(),
  }),
};

export {
  signupJoiSchema,
  universitySignupJoiSchema,
  loginJoiSchema,
  getUsersJoiSchema,
  changePasswordJoiSchema,
  referrRegisterJoiSchema,
  customerSignupJoiSchema,
  updateAdminProfileJoiSchema,
  roleBasedSignupJoiSchema,
  adminSignupJoiSchema,
  refreshTokenJoiSchema,
};
