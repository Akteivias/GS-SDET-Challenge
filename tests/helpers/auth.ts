/**
 * Authentication header helper for the User Management API challenge.
 *
 * Defaults to the published challenge fixture. Set SDET_AUTH_TOKEN in the
 * environment to override it.
 */
export const authenticationHeaders = (): Record<string, string> => ({
  Authentication: process.env.SDET_AUTH_TOKEN ?? 'mysecrettoken',
});
