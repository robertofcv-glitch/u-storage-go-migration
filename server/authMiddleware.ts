import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { platformRoles as platformRoleDefinitions, platformRoleModules } from "@shared/schema";
import { and, eq, inArray } from "drizzle-orm";
import { PLATFORM_ADMIN_ALL_MODULES, PLATFORM_ADMIN_ROLE_VALUES, permissionsForPlatformRoles, hasPlatformPermission } from "@shared/platformAdmin";

export function getActiveUserId(req: Request): string | undefined {
  const impersonatedUser = (req as any).session?.impersonatedUser;
  if (impersonatedUser?.id) {
    return impersonatedUser.id;
  }
  
  const emailUser = (req as any).session?.emailUser;
  if (emailUser?.id) {
    return emailUser.id;
  }
  
  const oauthUser = (req as any).user;
  if (oauthUser?.claims?.sub) {
    return oauthUser.claims.sub;
  }
  
  return undefined;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = getActiveUserId(req);
  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  (req as any).userId = userId;
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getActiveUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const [user, userRolesData] = await Promise.all([
        storage.getUser(userId),
        storage.getUserRoles(userId)
      ]);
      
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }

      const userRoleNames = userRolesData.filter(r => r.isActive).map(r => r.role);
      const hasRequiredRole = allowedRoles.some(role => 
        userRoleNames.includes(role)
      );
      
      if (!hasRequiredRole) {
        return res.status(403).json({ 
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
        });
      }
      
      (req as any).userId = userId;
      (req as any).userRoles = userRoleNames;
      (req as any).dbUser = user;
      next();
    } catch (error) {
      console.error("Role check error:", error);
      res.status(500).json({ message: "Server error during authorization" });
    }
  };
}

function requireCallerRole(...allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getCallerUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    try {
      const [user, userRolesData] = await Promise.all([
        storage.getUser(userId),
        storage.getUserRoles(userId),
      ]);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      const userRoleNames = userRolesData.filter((role) => role.isActive).map((role) => role.role);
      if (!allowedRoles.some((role) => userRoleNames.includes(role))) {
        return res.status(403).json({ message: `Access denied. Required role: ${allowedRoles.join(" or ")}` });
      }
      (req as any).userId = userId;
      (req as any).userRoles = userRoleNames;
      (req as any).dbUser = user;
      next();
    } catch (error) {
      console.error("Caller role check error:", error);
      res.status(500).json({ message: "Server error during authorization" });
    }
  };
}

export const requireAdmin = requireCallerRole('admin', ...PLATFORM_ADMIN_ROLE_VALUES);
export const requireMover = requireRole('mover', 'admin');
export const requireClient = requireRole('client', 'admin');

export function verifyResourceOwnership(getResourceUserId: (req: Request) => Promise<string | null>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getActiveUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    try {
      const [userRolesData, resourceOwnerId] = await Promise.all([
        storage.getUserRoles(userId),
        getResourceUserId(req)
      ]);
      
      const userRoleNames = userRolesData.filter(r => r.isActive).map(r => r.role);
      const isAdmin = userRoleNames.includes('admin');
      if (isAdmin) {
        (req as any).userId = userId;
        return next();
      }
      
      if (!resourceOwnerId) {
        return res.status(404).json({ message: "Resource not found" });
      }
      
      if (resourceOwnerId !== userId) {
        return res.status(403).json({ message: "Access denied. You can only access your own resources." });
      }
      
      (req as any).userId = userId;
      next();
    } catch (error) {
      console.error("Ownership verification error:", error);
      res.status(500).json({ message: "Server error during authorization" });
    }
  };
}

export function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    const session = (req as any).session;
    if (!session || !session.regenerate) {
      return resolve();
    }
    
    const emailUser = session.emailUser;
    const impersonatedUser = session.impersonatedUser;
    const originalAdminUser = session.originalAdminUser;
    const authType = session.authType;
    
    session.regenerate((err: Error | null) => {
      if (err) {
        console.error("Session regeneration failed:", err);
        return reject(err);
      }
      
      if (emailUser) session.emailUser = emailUser;
      if (impersonatedUser) session.impersonatedUser = impersonatedUser;
      if (originalAdminUser) session.originalAdminUser = originalAdminUser;
      if (authType) session.authType = authType;
      
      resolve();
    });
  });
}

export function isAdminImpersonating(req: Request): boolean {
  return !!(req as any).session?.impersonatedUser && !!(req as any).session?.originalAdminUser;
}

/**
 * Returns the ID of the real (authenticated) admin operator.
 * When impersonation is active, this returns the original admin's ID rather
 * than the impersonated user's ID, so permission checks always reflect the
 * actual caller's privileges and not the target account's privileges.
 */
export function getCallerUserId(req: Request): string | undefined {
  const originalAdminUser = (req as any).session?.originalAdminUser;
  if (originalAdminUser?.id) {
    return originalAdminUser.id;
  }
  return getActiveUserId(req);
}

/**
 * Middleware that enforces a fine-grained admin permission flag.
 * Super admins always pass. All other admins must have the specified
 * permission explicitly set to true in their admin_permissions record.
 *
 * Permission checks always use the real caller's identity. When an admin is
 * impersonating another account the check is performed against the original
 * admin's permissions, not the impersonated account's permissions.
 *
 * Usage: place AFTER requireAdmin in the middleware chain.
 *   app.get("/api/admin/...", isAuthenticated, requireAdmin, requireAdminPermission('canAccessDatabase'), handler)
 */
export function requireAdminPermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getCallerUserId(req);
    if (!userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    try {
      const perms = await storage.getAdminPermissions(userId);
      const platformAccess = await getPlatformAdminAccess(userId);
      if (perms?.isSuperAdmin || platformAccess.effectivePermissions.includes("*")) {
        return next();
      }
      if (perms && (perms as any)[permission] === true) {
        return next();
      }
      return res.status(403).json({ message: "Insufficient admin permissions" });
    } catch (error) {
      console.error("Admin permission check error:", error);
      res.status(500).json({ message: "Server error during authorization" });
    }
  };
}

export async function getPlatformAdminAccess(userId: string, requestedRole?: string | null) {
  const [roles, legacy] = await Promise.all([
    storage.getUserRoles(userId),
    storage.getAdminPermissions(userId),
  ]);
  const activeRoles = roles.filter((role) => role.isActive).map((role) => role.role);
  const candidateRoles = activeRoles.filter((role) => !["client", "mover", "admin"].includes(role));
  const definitions = candidateRoles.length
    ? await db.select().from(platformRoleDefinitions).where(and(inArray(platformRoleDefinitions.slug, candidateRoles), eq(platformRoleDefinitions.isActive, true)))
    : [];
  const platformRoles = definitions.map((role) => role.slug);
  if (legacy?.isSuperAdmin && !platformRoles.includes("super_admin")) platformRoles.push("super_admin");
  const availablePlatformRoles = definitions.map(({ slug, name }) => ({ slug, name }));
  if (legacy?.isSuperAdmin && !availablePlatformRoles.some((role) => role.slug === "super_admin")) {
    availablePlatformRoles.unshift({ slug: "super_admin", name: "Super Admin" });
  }
  const activePlatformRole = requestedRole && platformRoles.includes(requestedRole)
    ? requestedRole
    : platformRoles.includes("super_admin")
      ? "super_admin"
      : platformRoles[0] || null;
  const legacyPermissions = platformRoles.length === 0 && activeRoles.includes("admin")
    ? PLATFORM_ADMIN_ALL_MODULES
    : [];
  const effectivePermissions = legacyPermissions.length
    ? legacyPermissions
    : activePlatformRole === "super_admin"
      ? ["*"]
      : activePlatformRole
        ? (await db.select({ moduleKey: platformRoleModules.moduleKey }).from(platformRoleModules)
            .innerJoin(platformRoleDefinitions, eq(platformRoleModules.roleId, platformRoleDefinitions.id))
            .where(eq(platformRoleDefinitions.slug, activePlatformRole))).map((row) => row.moduleKey)
        : permissionsForPlatformRoles(platformRoles);
  return { platformRoles, availablePlatformRoles, activePlatformRole, effectivePermissions };
}

export async function activateCallerPlatformRole(req: Request, role: string) {
  const userId = getCallerUserId(req);
  if (!userId) {
    return { ok: false as const, status: 401, message: "Authentication required" };
  }
  const access = await getPlatformAdminAccess(userId, role);
  if (!access.platformRoles.includes(role)) {
    return { ok: false as const, status: 403, message: "This workspace role is not assigned to this user" };
  }
  (req as any).session.activePlatformRole = role;
  return { ok: true as const, access };
}

export function requirePlatformPermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const userId = getCallerUserId(req);
    if (!userId) return res.status(401).json({ message: "Authentication required" });
    try {
      const access = await getPlatformAdminAccess(userId, (req as any).session?.activePlatformRole);
      if (!hasPlatformPermission(access.effectivePermissions, permission)) {
        return res.status(403).json({ message: "This workspace role cannot access this module" });
      }
      (req as any).platformAdminAccess = access;
      next();
    } catch (error) {
      console.error("Platform permission check error:", error);
      res.status(500).json({ message: "Server error during authorization" });
    }
  };
}
