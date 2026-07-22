const frontendBase = () =>
  (process.env.FRONTEND_URL || 'http://localhost:8080').replace(/\/$/, '');

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
  /** After Google OAuth, send the admin back to the live Scheduling page (not localhost). */
  adminUiRedirectSuccess:
    process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT?.trim() ||
    `${frontendBase()}/admin/scheduling?google=connected`,
  adminUiRedirectError:
    process.env.GOOGLE_OAUTH_ERROR_REDIRECT?.trim() ||
    `${frontendBase()}/admin/scheduling?google=error`,
});

export const assertGoogleOAuthConfigured = (): void => {
  const c = schedulingConfig();
  if (!c.clientId || !c.clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
  }
};
