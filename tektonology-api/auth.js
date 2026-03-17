import { auth } from "express-oauth2-jwt-bearer";

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;

/**
 * JWT validation middleware — verifies Auth0 access tokens.
 * Must be applied before any protected route handlers.
 */
export const jwtCheck = auth({
  issuerBaseURL: `https://${AUTH0_DOMAIN}/`,
  audience: AUTH0_AUDIENCE,
});

/**
 * Express middleware that requires a valid Auth0 session.
 * Apply after jwtCheck — returns 401 if no valid token is present.
 */
export function requireAuth(req, res, next) {
  if (!req.auth?.payload?.sub) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

const EMAIL_VERIFIED_CLAIM = "https://tektonology.com/email_verified";
const ROLE_CLAIM = "https://tektonology.com/role";

/**
 * Express middleware that requires a verified email address.
 * Checks the custom claim added by the Auth0 Login Action.
 */
export function requireEmailVerified(req, res, next) {
  if (!req.auth?.payload?.[EMAIL_VERIFIED_CLAIM]) {
    return res.status(403).json({ error: "Email verification required" });
  }
  next();
}

/**
 * Express middleware factory that checks the user's role from
 * Auth0 access token custom claims.
 *
 * @param  {...string} roles - Allowed roles (e.g. "owner", "auditor")
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth?.payload?.sub) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = req.auth.payload[ROLE_CLAIM] ?? "member";
    if (!roles.includes(userRole)) {
      return res.status(403).json({
        error: "Insufficient permissions",
        required: roles,
        current: userRole,
      });
    }

    next();
  };
}
