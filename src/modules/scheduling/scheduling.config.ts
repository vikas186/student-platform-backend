export const schedulingConfig = () => ({
  clientId: process.env.GOOGLE_CLIENT_ID?.trim() || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() || '',
  redirectUri:
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `${process.env.BACKEND_URL || 'http://localhost:4001'}/api/v1/admin/google/callback`,
  scopes: (
    process.env.GOOGLE_CALENDAR_SCOPES?.trim() ||
    'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email'
  ).split(/[\s,]+/),
  slotMinutes: parseInt(process.env.SCHEDULING_SLOT_MINUTES || '45', 10) || 45,
  timezone: process.env.SCHEDULING_TIMEZONE?.trim() || 'Asia/Kolkata',
  defaultCounsellorAdminUserId: process.env.DEFAULT_COUNSELLOR_ADMIN_USER_ID?.trim() || null,
  adminUiRedirectSuccess:
    process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT?.trim() || 'http://localhost:3380/admin/settings/calendar?connected=1',
  adminUiRedirectError:
    process.env.GOOGLE_OAUTH_ERROR_REDIRECT?.trim() || 'http://localhost:3380/admin/settings/calendar?connected=0',
});

export const assertGoogleOAuthConfigured = (): void => {
  const c = schedulingConfig();
  if (!c.clientId || !c.clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  }
};
