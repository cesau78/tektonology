import { clerkMiddleware, getAuth } from "@clerk/express";

/**
 * Clerk middleware — attaches auth state to every request.
 * Must be applied before any route handlers.
 */
export const clerkAuth = clerkMiddleware();

/**
 * Express middleware that requires a valid Clerk session.
 * Returns 401 if no valid token is present.
 */
export function requireAuth(req, res, next) {
  const auth = getAuth(req);
  if (!auth?.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

/**
 * Express middleware factory that checks the user's role from
 * Clerk session claims (publicMetadata.role).
 *
 * @param  {...string} roles - Allowed roles (e.g. "owner", "auditor")
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    const auth = getAuth(req);
    if (!auth?.userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userRole = auth.sessionClaims?.publicMetadata?.role ?? "member";
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
