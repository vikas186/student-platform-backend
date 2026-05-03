const responseMessage = {
  // Response codes
  msgType: {
    successStatus: true,
    failedStatus: false,
  },
  msg: {
    superAdminAdd: 'SuperAdmin created successfully',
    loginSuccess: 'Login successful',
    userGetAll: 'Users fetched successfully',
    changePassword: 'Password changed successfully',
    resetPassword: 'Password reset successfully',
    passwordChangeEmail: 'Password change email sent successfully',
    getProfile: 'Profile fetched successfully',
    profileFetch: 'Profile fetched successfully',
    profileUpdate: 'Profile updated successfully',
    businessDetailsAdd: 'Business details added successfully',
    referrerAdd: 'Referrer invitation send successfully',
    referralAdd: 'Referral addedd successfully',
    roleAdd: 'Role created successfully',
    internalServerError: 'Internal Server Error',
    accessDeniedAdmin: 'Access denied. Admin privileges required.',
    accessDeniedSuperAdmin: 'Access denied. SuperAdmin privileges required.',
    locationAccessNotFound: 'LocationAccess not found',
    adminNotFound: 'Admin not found',
    userNotFound: 'User not found',
    roleNotFound: 'Role not found',
    incorrectPassword: 'Incorrect current password',
    somethingWrong: 'Something went wrong!',
    invalidEmailPassword: 'Invalid email or password',
    restrictAccess: 'You are no longer accessible to use the service. Please contact admin to resume your services.',
    businessStatus: 'Business Status updated successfully',
    contactStatus: 'Status updated successfully',
    resetPasswordEmail: 'Reset password email sent successfully',
    emailError: 'Email error',
    emailExists: 'Email already exists',
    inviteAlreadySent: 'Invitation already sent',
    noAdminFoundGivenId: 'No admin found with the given ID',
    profileUpdateFailed: 'Failed to update profile',
    subscriptionExpire: 'Your subscription is expired please contact to admin',
    authError: 'Auth Error',
    tokenExpire: 'Your session has been expired.',
    invalidToken: 'Invalid Token',
    invalidBusinessCode: 'Invalid business code ',
    invalidRefererCode: 'Invalid referer code ',
    businessExists: 'Your business already exists',
    businessAdd: 'Business added successfully',
    businessFetch: 'Business fetched successfully',
    businessUpdate: 'Business updated successfully',
    referReferUsFetch: 'Refer Refer Us list fetched successfully',
    referrerFetch: 'Referer list fetched successfully',
    referralFetch: 'Refereral list fetched successfully',
    userAdded: 'User created successfully',
    contactCreated: 'Contact created successfully',
    contactFetched: 'Contact List fetched successfully',
    roleAdded: 'Role created successfully',
    failedContactCreated: 'Failed to create new contact',
    failedBlogCreated: 'Failed to create new blog',
    blogAlreadyExist: 'Blog already exists',
    blogCreated: 'Blog created successfully',
    blogUpated: 'Blog upated successfully',
    blogFetched: 'Blog List fetched successfully',
    ticketRaisedSuccessfully: 'Ticket raised successfully. Our support team will contact you shortly regarding your inquiry.',
    notifiyCount: 'Dashboard count fetched successfully.',
    smsCreated: 'Template created successfully',
    templateAlreadyExist: ' Template already exist',
    templateNotExist: 'Template not  exist',
  },

  msgCode: {
    // To be used when no new record is inserted but to display success message
    successCode: 200,
    // To be used when a new record is inserted
    newResourceCreated: 201,
    // To be used if database query returns empty record
    nocontent: 204,
    // To be used if the request is bad, e.g., if we pass record id which does not exist
    badRequest: 400,
    // To be used when the user is not authorized to access the API, e.g., invalid access token
    unAuthorizedUser: 401,
    // To be used when the access token is not valid
    forbidden: 403,
    // To be used if something went wrong
    failureCode: 404,
    // To be used when error occurs while accessing the API
    internalServerError: 500,
    // To be used if a record already exists
    conflictCode: 409,
  },
};

export default responseMessage;
