import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users, userRoles, quotes, moverProfiles, platformRoles, platformRoleModules, adminWorkspaceSections, quoteActivityLog, quoteIntakeAttachments, inventoryItems, services, addOns, quoteServices, quoteAddOns, operationalServices, type User } from "@shared/schema";
import { ADMIN_WORKSPACE_DEFINITIONS, DEFAULT_ADMIN_WORKSPACE_LAYOUT, reconcileAdminWorkspaceLayout, type AdminWorkspaceKey } from "@shared/adminWorkspaces";
import { insertQuoteSchema, insertInventoryItemSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { seedDatabase } from "./seed";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { 
  getActiveUserId, 
  getCallerUserId,
  requireAuth, 
  requireRole, 
  requireAdmin as requireAdminNew, 
  requireMover, 
  requireClient, 
  verifyResourceOwnership, 
  regenerateSession,
  requireAdminPermission,
  getPlatformAdminAccess,
  activateCallerPlatformRole,
  requirePlatformPermission,
} from "./authMiddleware";
import { PLATFORM_ADMIN_ROLE_VALUES, PLATFORM_ADMIN_ALL_MODULES, validatePlatformRoleModules, PLATFORM_CAPABILITIES } from "@shared/platformAdmin";
import bcrypt from "bcryptjs";
import { eq, and, sql, isNotNull, inArray } from "drizzle-orm";
import { 
  sendPasswordResetEmail, 
  sendAdminApprovalEmail, 
  sendAdminAccessDeniedEmail,
  sendWelcomeEmail,
  sendQuoteConfirmationEmail,
  sendQuoteInvitationEmail,
  sendBidReceivedEmail,
  sendBidAcceptedEmail,
  sendQuoteStatusUpdateEmail,
  sendEmail
} from "./emailService";
import { generateQuotePdf, saveQuotePdf, getPdfBuffer } from "./pdfService";
import { sendQuotePdfEmail } from "./emailService";
import { tableMetadataConfig, getTableMetadata, getAccessibleTables, getTablesByCategory } from "@shared/tableMetadata";
import { calculateDistance } from "./services/distanceService";
import { 
  enqueueCrmLead, 
  isMirroredPartner, 
  isSalesforceConfigured, 
  processCrmOutbox, 
  retryCrmOutboxEntry, 
  startCrmOutboxWorker 
} from "./services/salesforceService";
import { syncOfficialBranchCatalog, getStorageRecommendation, validateStorageProximity } from "./services/ustorageBranchService";
import { OFFICIAL_BRANCH_CATALOG_VERSION } from "./data/officialBranchCatalog";
import { registerDispatchRouter } from "./dispatchRouter";
import { registerServiceOperationsRouter } from "./serviceOperationsRouter";
import { assertQuoteOfferDeliverable, markQuoteOfferDelivered, recalculateReviewedQuoteEstimate, startCollectionExpiryWorker, transitionQuoteStage } from "./services/serviceOperations";
import { registerCompanyRouter } from "./companyRouter";
import { resolveActiveCompany, requireCompanyPermission } from "./companyAuthorization";
import { toPartnerSafeQuote } from "./services/dispatchDtos";
import {
  assertNoDerivedEligibilityFields,
  QuoteEligibilityError,
  type QuoteEndpointSelection,
} from "./services/quoteEligibilityService";
import { getStorageMoveContext } from "@shared/storageMoveContext";
import { quoteOperationsCsv } from "./services/quoteOperationsExport";
import { platformRoleAuditRecord } from "./platformRoleAudit";
import { capabilityForRoute } from "@shared/adminCapabilities";
import { legacyMoveDateForPreferences, moveDatePreferencesSchema } from "@shared/moveDatePreferences";
import { createUStorageAvailabilityAdapter, sanitizeUnitSnapshot, validateReservationHandoff } from "./services/ustorageAvailabilityService";
import { normalizeEmail, normalizePhone, duplicateMatch, assistedQuoteDraftSchema } from "./services/assistedQuote";
import { createUStorageReservationProvider, hashReservationReference, type ReservationConfirmation } from "./services/ustorageReservationProvider";
import crypto from "crypto";
import { z } from "zod";
import { normalizeQuoteStage, QUOTE_STAGE } from "@shared/workflowStages";
import { associationDiff, quoteReviewValuesMatch } from "./quoteReviewDiff";
import { assignPlatformAdminRole } from "./adminAccess";
import {
  createAiClient,
  DEFAULT_AI_MODEL,
  FALLBACK_AI_MODEL,
  resolveAiModel,
  getAiProviderStatus,
} from "./aiProvider";
import {
  isClaraResponse,
  isInventoryParserResponse,
  isPresetInventoryResponse,
} from "./aiContracts";

// Use the imported middleware - getUserId alias for backward compatibility
const getUserId = getActiveUserId;

// Use the new requireAdmin from authMiddleware
const requireAdmin = requireAdminNew;

const WRITABLE_AI_MODELS = new Set([DEFAULT_AI_MODEL, FALLBACK_AI_MODEL]);

function normalizeAiConfig<T extends { model?: string | null } | null | undefined>(config: T) {
  if (!config) return config;
  try {
    return { ...config, model: resolveAiModel(config.model) };
  } catch {
    return {
      ...config,
      model: DEFAULT_AI_MODEL,
      unsupportedModel: config.model,
      modelWarning: `The saved model "${config.model}" is unsupported. Select a supported model to update this configuration.`,
    };
  }
}

function validateAiConfigModelWrite(body: any): string | null {
  if (!Object.prototype.hasOwnProperty.call(body || {}, "model")) return null;
  if (typeof body.model !== "string" || !WRITABLE_AI_MODELS.has(body.model)) {
    return `Invalid model. Valid options: ${Array.from(WRITABLE_AI_MODELS).join(", ")}`;
  }
  return null;
}

function endpointSelection(body: Record<string, unknown>): QuoteEndpointSelection {
  const selection: QuoteEndpointSelection = {};
  for (const key of ["fromBranchId", "toBranchId"] as const) {
    if (!Object.prototype.hasOwnProperty.call(body, key)) continue;
    const value = body[key];
    if (value !== null && (typeof value !== "string" || !value.trim() || value.length > 100)) {
      throw new QuoteEligibilityError(
        "INVALID_REQUEST",
        `${key} must be a valid branch ID or null`,
        { field: key },
      );
    }
    selection[key] = typeof value === "string" ? value.trim() : null;
  }
  return selection;
}

const storageContractStatuses = ["existing", "needs_unit", "not_applicable"] as const;
const storageRentalIntents = ["reserve", "no_reservation"] as const;
const storageAvailabilityStatuses = ["available", "unavailable", "rate_limited", "format_error", "wrong_branch", "no_availability"] as const;
const storageReservationStatuses = ["not_started", "handed_off", "confirmed"] as const;

type ReservationClaim = {
  quoteSessionId: string;
  expiresAt: number;
  confirmation: ReservationConfirmation;
};
const reservationClaims = new Map<string, ReservationClaim>();
function issueReservationClaim(quoteSessionId: string, confirmation: ReservationClaim["confirmation"]): string {
  const id = crypto.randomBytes(24).toString("base64url");
  reservationClaims.set(id, { quoteSessionId, expiresAt: Math.min(Date.now() + 10 * 60_000, confirmation.expiresAt.getTime()), confirmation });
  return id;
}

function storageEnumOrNull(value: unknown, allowed: readonly string[]): string | null {
  return typeof value === "string" && allowed.includes(value) ? value : null;
}

function storageCheckedAtOrNull(value: unknown): Date | null {
  if (typeof value !== "string" && !(value instanceof Date)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sendQuoteEligibilityError(res: Response, error: unknown): boolean {
  if (!(error instanceof QuoteEligibilityError)) return false;
  // Deliberately omit addresses/contact data; this is safe to aggregate in
  // production logs while still exposing launch-impacting failure patterns.
  console.warn(JSON.stringify({
    event: "ustorage.eligibility_failure",
    code: error.code,
    status: error.status,
    catalogVersion: OFFICIAL_BRANCH_CATALOG_VERSION,
    path: res.req.path,
    method: res.req.method,
    retryable: error.status === 503,
    details: error.details ?? null,
  }));
  res.status(error.status).json({
    message: error.message,
    code: error.code,
    error: {
      code: error.code,
      message: error.message,
      details: error.details ?? null,
      retryable: error.status === 503,
    },
  });
  return true;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Seed database on startup
  await seedDatabase();

  // Start CRM outbox worker (Salesforce lead mirroring for partner leads)
  startCrmOutboxWorker();

  // Setup Replit Auth (handles session, passport, login/logout routes)
  await setupAuth(app);
  app.use("/api", registerCompanyRouter());
  // New dispatch workflow APIs are isolated from legacy bidding routes.
  app.use("/api", registerDispatchRouter());
  app.use("/api", registerServiceOperationsRouter());
  startCollectionExpiryWorker();
  const guardAdminModule = (permission: string, prefixes: string[]) => {
    for (const prefix of prefixes) {
      // Keep the guard vocabulary tied to the shared capability contract. A
      // module remains explicit here for older routes not yet catalogued.
      const capability = capabilityForRoute(`/api/admin/${prefix}`);
      const modulePermission = capability?.module || permission;
      app.use(`/api/admin/${prefix}`, requireAdmin, requirePlatformPermission(modulePermission));
    }
  };
  guardAdminModule("module:users", ["admins", "users", "roles", "non-admin-users"]);
  guardAdminModule("module:companies", ["movers", "partners", "active-partners"]);
  guardAdminModule("module:quotes", ["quotes", "bids", "invitations", "documents", "document-types"]);
  guardAdminModule("module:analytics", ["analytics"]);
  guardAdminModule("module:ratings", ["ratings", "rating-requests"]);
  guardAdminModule("module:activity", ["activity-logs"]);
  guardAdminModule("module:communications", ["conversations", "email-campaigns", "email-config", "email-event-types", "email-logs", "email-senders", "email-stats", "email-templates", "email-triggers", "gmail-status", "translate-template"]);
  guardAdminModule("module:whatsapp", ["whatsapp", "whatsapp-config", "whatsapp-status"]);
  guardAdminModule("module:ai_agent", ["ai-agent", "ai-agent-config", "ai-config", "ai-models", "ai-pricing-prompts", "llm", "seed-ai-config"]);
  guardAdminModule("module:inventory", ["inventory-categories", "inventory-rooms", "category-keywords", "room-keywords", "preset-inventories", "preset-inventory-items", "truck-types"]);
  guardAdminModule("module:pricing", ["pricing-defaults", "pricing-formula-parameters", "pricing-templates"]);
  guardAdminModule("module:ustorage", ["ustorage"]);
  guardAdminModule("module:payments", ["stripe"]);
  guardAdminModule("module:database", ["db", "database"]);
  guardAdminModule("module:marketing", ["seo", "blog"]);
  guardAdminModule("module:settings", ["settings", "website-config", "quote-workflow-statuses", "cities", "countries", "services", "addons", "crm", "seed-config"]);
  guardAdminModule("module:role_management", ["platform-roles"]);
  const isManagedPlatformRole = async (slug: string) =>
    !!(await db.query.platformRoles.findFirst({ where: eq(platformRoles.slug, slug) }));

  // ========== AUTH ROUTES ==========

  // Get current user - Replit Auth style (for OAuth users)
  app.get('/api/auth/user', isAuthenticated, async (req: any, res: Response) => {
    try {
      // Handle both OAuth and email/password authentication
      const userId = getActiveUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Email/Password Registration
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { email, password, fullName, userType, phone } = req.body;

      if (!email || !password || !fullName) {
        return res.status(400).json({ message: "Email, password, and full name are required" });
      }

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      
      let user;
      
      if (existingUser) {
        // Check if this is a placeholder user (no password set)
        if (existingUser.password) {
          // User has a password - they already have a full account
          return res.status(400).json({ message: "Email already registered" });
        }
        
        // This is a placeholder user - only allow upgrade if the requester can prove
        // they are the same browser session that originally created the guest quote.
        // Without this, anyone can claim a placeholder account by knowing the email.
        const { quoteSessionId } = req.body;
        if (!quoteSessionId) {
          return res.status(403).json({ message: "A valid quote session is required to complete registration" });
        }
        const sessionQuote = await storage.getQuoteBySessionId(quoteSessionId);
        if (!sessionQuote || sessionQuote.userId !== existingUser.id) {
          return res.status(403).json({ message: "Quote session does not match the account being registered" });
        }

        // This is a placeholder user - upgrade them to a full account
        console.log(`[Auth] Upgrading placeholder user ${existingUser.id} to full account`);
        const hashedPassword = await bcrypt.hash(password, 10);
        
        user = await storage.updateUser(existingUser.id, {
          password: hashedPassword,
          fullName,
          phone: phone || existingUser.phone,
          userType: userType || existingUser.userType || 'client',
        });
        
        // Ensure they have the client role
        const hasClientRole = await storage.hasRole(user.id, 'client');
        if (!hasClientRole) {
          await storage.addUserRole({ userId: user.id, role: 'client' });
        }
        
        // If registering as mover, add mover role and create profile
        if (userType === 'mover') {
          const hasMoverRole = await storage.hasRole(user.id, 'mover');
          if (!hasMoverRole) {
            await storage.addUserRole({ userId: user.id, role: 'mover' });
          }
          await storage.ensureMoverProfile(user.id, { companyName: fullName });
        }
      } else {
        // No existing user - create new account
        const hashedPassword = await bcrypt.hash(password, 10);

        user = await storage.createUser({
          email,
          password: hashedPassword,
          fullName,
          userType: userType || 'client',
          phone,
        });
        
        // Add client role for new users
        await storage.addUserRole({ userId: user.id, role: 'client' });
        
        // If registering as mover, add mover role and create profile
        if (userType === 'mover') {
          await storage.addUserRole({ userId: user.id, role: 'mover' });
          await storage.ensureMoverProfile(user.id, { companyName: fullName });
        }
      }

      // Every registered account has a durable client company for quotes and
      // saved addresses; partner companies remain separately classified.
      await storage.ensureClientCompany(user.id);

      // Don't send password back
      const { password: _, ...userWithoutPassword } = user;

      // Auto-login the user after registration by setting session
      (req as any).session.emailUser = {
        id: user.id,
        email: user.email,
        userType: user.userType,
      };

      // Save session before responding
      await new Promise<void>((resolve, reject) => {
        (req as any).session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Send welcome email
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const dashboardLink = `${baseUrl}/dashboard`;
      sendWelcomeEmail(user.email!, fullName, dashboardLink, 'es').catch(err => 
        console.log('[EMAIL] Failed to send welcome email:', err.message)
      );

      res.json({ user: userWithoutPassword, success: true });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Email/Password Login
  app.post("/api/auth/email-login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Regenerate session to prevent session fixation attacks
      try {
        await regenerateSession(req);
      } catch (err) {
        console.warn("Session regeneration failed, continuing with existing session");
      }

      // Store user info in session for email/password users
      (req as any).session.emailUser = {
        id: user.id,
        email: user.email,
        userType: user.userType,
      };
      (req as any).session.authType = 'email';

      // Save session before responding
      await new Promise<void>((resolve, reject) => {
        (req as any).session.save((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, success: true });
    } catch (error: any) {
      console.error("Login error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get current email user (for email/password users)
  app.get("/api/auth/email-user", async (req: Request, res: Response) => {
    try {
      const emailUser = (req as any).session?.emailUser;
      if (!emailUser) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await storage.getUser(emailUser.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Email logout - clears all session data (email user, impersonated user)
  app.post("/api/auth/email-logout", (req: Request, res: Response) => {
    // Clear any impersonated user first
    if ((req as any).session?.impersonatedUser) {
      delete (req as any).session.impersonatedUser;
    }
    // Clear email user
    if ((req as any).session?.emailUser) {
      delete (req as any).session.emailUser;
    }
    // Destroy the entire session
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie('connect.sid');
      res.json({ message: "Logged out successfully" });
    });
  });

  // Unified /api/user endpoint - returns current user from any auth method
  app.get("/api/user", async (req: Request, res: Response) => {
    try {
      // 1. Check for impersonated user (development testing - highest priority)
      const impersonatedUser = (req as any).session?.impersonatedUser;
      if (impersonatedUser?.id) {
        const user = await storage.getUser(impersonatedUser.id);
        if (user) {
          const roles = await storage.getUserRoles(user.id);
          const { password: _, ...userWithoutPassword } = user;
          return res.json({ ...userWithoutPassword, roles });
        }
      }

      // 2. Check for email/password session user
      const emailUser = (req as any).session?.emailUser;
      if (emailUser?.id) {
        const user = await storage.getUser(emailUser.id);
        if (user) {
          const roles = await storage.getUserRoles(user.id);
          const { password: _, ...userWithoutPassword } = user;
          return res.json({ ...userWithoutPassword, roles });
        }
      }

      // 3. Check for OAuth user
      const oauthUser = req.user as any;
      if (oauthUser?.claims?.sub) {
        const user = await storage.getUser(oauthUser.claims.sub);
        if (user) {
          const roles = await storage.getUserRoles(user.id);
          const { password: _, ...userWithoutPassword } = user;
          return res.json({ ...userWithoutPassword, roles });
        }
      }

      // Not authenticated
      return res.status(401).json({ message: "Not authenticated" });
    } catch (error: any) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Forgot Password - Request reset link
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await storage.getUserByEmail(email);
      
      // Always return success to prevent email enumeration
      if (!user) {
        return res.json({ success: true, message: "If an account with that email exists, a reset link will be sent." });
      }

      // Cooldown: if a valid reset token was already issued within the last 5 minutes,
      // silently return success without sending another email. This prevents inbox
      // flooding and repeated invalidation of the victim's current reset link.
      const recentTokenExists = await storage.getRecentPasswordResetToken(user.id, 5 * 60 * 1000);
      if (recentTokenExists) {
        return res.json({ success: true, message: "If an account with that email exists, a reset link will be sent." });
      }

      // Generate secure token
      const crypto = await import('crypto');
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry

      // Store token
      await storage.createPasswordResetToken(user.id, token, expiresAt);

      // Build reset URL from a trusted canonical base URL, never from the
      // incoming Host header, to prevent password-reset poisoning attacks.
      const canonicalBase =
        process.env.APP_URL ||
        (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0].trim()}` : null) ||
        `${req.protocol}://localhost:5000`;
      const resetUrl = `${canonicalBase}/reset-password?token=${token}`;

      // Log the activity
      await storage.logActivity({
        userId: user.id,
        action: 'password_reset.requested',
        entityType: 'user',
        entityId: user.id,
        details: { email: user.email },
      });

      // Send password reset email
      const emailSent = await sendPasswordResetEmail(user.email!, resetUrl, user.preferredLanguage || 'es');
      if (!emailSent) {
        console.log(`[EMAIL FALLBACK] Password reset link for ${email}: ${resetUrl}`);
      }

      res.json({ 
        success: true, 
        message: "If an account with that email exists, a reset link will be sent.",
      });
    } catch (error: any) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "An error occurred. Please try again." });
    }
  });

  // Reset Password - Verify token and set new password
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
      }

      // Validate token
      const resetToken = await storage.getValidPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ message: "Invalid or expired reset link. Please request a new one." });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user password
      await storage.updateUser(resetToken.userId, { password: hashedPassword });

      // Revoke all outstanding reset tokens for this user (not just the submitted one)
      await storage.revokeAllPasswordResetTokens(resetToken.userId);

      // Log the activity
      await storage.logActivity({
        userId: resetToken.userId,
        action: 'password_reset.completed',
        entityType: 'user',
        entityId: resetToken.userId,
      });

      res.json({ success: true, message: "Password has been reset successfully. You can now log in." });
    } catch (error: any) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "An error occurred. Please try again." });
    }
  });

  // Verify reset token (for frontend to check if token is valid before showing form)
  app.get("/api/auth/verify-reset-token", async (req: Request, res: Response) => {
    try {
      const { token } = req.query;

      if (!token || typeof token !== 'string') {
        return res.status(400).json({ valid: false, message: "Token is required" });
      }

      const resetToken = await storage.getValidPasswordResetToken(token);
      if (!resetToken) {
        return res.status(400).json({ valid: false, message: "Invalid or expired reset link" });
      }

      res.json({ valid: true });
    } catch (error: any) {
      res.status(500).json({ valid: false, message: "An error occurred" });
    }
  });

  // ========== IMPERSONATION ROUTES (For Development/Testing Only) ==========
  // These routes are only available in development mode for testing purposes
  // Get all users for impersonation dropdown - requires admin
  app.get("/api/impersonate/users", requireAdmin, requireAdminPermission('canManageUsers'), async (req: Request, res: Response) => {
    try {
      const allUsers = await storage.getAllUsers();
      const usersWithRoles = await Promise.all(
        allUsers.map(async (user) => {
          const roles = await storage.getUserRoles(user.id);
          const { password: _, ...userWithoutPassword } = user;
          return { ...userWithoutPassword, roles };
        })
      );
      res.json({ users: usersWithRoles });
    } catch (error: any) {
      console.error("Error fetching users for impersonation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get current session user (impersonated or actual logged-in user)
  // NOTE: This route MUST come before /api/impersonate/:userId to avoid matching "current" as userId
  app.get("/api/impersonate/current", async (req: Request, res: Response) => {
    try {
      const callerId = getCallerUserId(req);
      const operatorAccess = callerId
        ? await getPlatformAdminAccess(callerId, (req as any).session?.activePlatformRole)
        : null;
      // First check for impersonated user
      const impersonatedUser = (req as any).session?.impersonatedUser;
      if (impersonatedUser) {
        const user = await storage.getUser(impersonatedUser.id);
        if (user) {
          const roles = await storage.getUserRoles(user.id);
          const { password: _, ...userWithoutPassword } = user;
          const adminAccess = await getPlatformAdminAccess(user.id, (req as any).session?.activePlatformRole);
          return res.json({ user: { ...userWithoutPassword, roles, ...adminAccess }, operatorAccess, isImpersonated: true });
        }
      }
      
      // Check for email/password session user
      const emailUser = (req as any).session?.emailUser;
      if (emailUser) {
        const user = await storage.getUser(emailUser.id);
        if (user) {
          const roles = await storage.getUserRoles(user.id);
          const { password: _, ...userWithoutPassword } = user;
          const adminAccess = await getPlatformAdminAccess(user.id, (req as any).session?.activePlatformRole);
          return res.json({ user: { ...userWithoutPassword, roles, ...adminAccess }, operatorAccess, isImpersonated: false });
        }
      }
      
      // Check for OAuth user
      const oauthUser = (req as any).user;
      if (oauthUser?.claims?.sub) {
        const user = await storage.getUser(oauthUser.claims.sub);
        if (user) {
          const roles = await storage.getUserRoles(user.id);
          const { password: _, ...userWithoutPassword } = user;
          const adminAccess = await getPlatformAdminAccess(user.id, (req as any).session?.activePlatformRole);
          return res.json({ user: { ...userWithoutPassword, roles, ...adminAccess }, operatorAccess, isImpersonated: false });
        }
      }
      
      return res.json({ user: null, operatorAccess, isImpersonated: false });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/active-platform-role", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    const role = String(req.body?.role || "");
    const result = await activateCallerPlatformRole(req, role);
    if (!result.ok) return res.status(result.status).json({ message: result.message });
    res.json({ activePlatformRole: role, effectivePermissions: result.access.effectivePermissions });
  });

  // Stop impersonation - restore original admin user
  // NOTE: This route MUST come before /api/impersonate/:userId to avoid matching "stop" as userId
  app.post("/api/impersonate/stop", async (req: Request, res: Response) => {
    try {
      console.log("Stop impersonation called");
      console.log("Session originalAdminUser:", (req as any).session?.originalAdminUser);
      console.log("Session impersonatedUser:", (req as any).session?.impersonatedUser);
      
      // Clear impersonated user
      if ((req as any).session?.impersonatedUser) {
        delete (req as any).session.impersonatedUser;
      }
      
      // Restore original admin user if available
      const originalAdmin = (req as any).session?.originalAdminUser;
      if (originalAdmin && originalAdmin.id) {
        console.log("Restoring original admin:", originalAdmin.id);
        
        // Restore based on auth type
        if (originalAdmin.authType === 'email') {
          (req as any).session.emailUser = { 
            id: originalAdmin.id, 
            email: originalAdmin.email,
            userType: originalAdmin.userType 
          };
        }
        // For OAuth, we don't need to restore session - the OAuth middleware will handle it
        
        delete (req as any).session.originalAdminUser;
        
        // Return the restored admin user info
        const adminUser = await storage.getUser(originalAdmin.id);
        if (adminUser) {
          const roles = await storage.getUserRoles(adminUser.id);
          const { password: _, ...userWithoutPassword } = adminUser;
          return res.json({ 
            message: "Impersonation stopped", 
            user: { ...userWithoutPassword, roles },
            restored: true 
          });
        } else {
          console.log("Admin user not found in database:", originalAdmin.id);
          return res.json({ message: "Impersonation stopped", restored: false });
        }
      } else {
        console.log("No original admin to restore");
        if ((req as any).session?.emailUser) {
          delete (req as any).session.emailUser;
        }
      }
      
      res.json({ message: "Impersonation stopped", restored: false });
    } catch (error: any) {
      console.error("Stop impersonation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Impersonate a user (switch to viewing as that user)
  // NOTE: This route MUST come AFTER /current and /stop routes
  app.post("/api/impersonate/:userId", requireAdmin, requireAdminPermission('canManageUsers'), async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const roles = await storage.getUserRoles(userId);

      // Block impersonating admin accounts to prevent privilege escalation.
      // An admin with canManageUsers but limited permissions must not be able to
      // gain a higher-privileged admin's capabilities by impersonating them.
      const targetRoleNames = roles.map((r: any) => r.role);
      if (targetRoleNames.includes('admin')) {
        return res.status(403).json({ message: "Admin accounts cannot be impersonated" });
      }
      
      // Store the original admin user before impersonation (if not already impersonating)
      if (!(req as any).session.originalAdminUser) {
        // Check email/password session first
        const currentEmailUser = (req as any).session?.emailUser;
        if (currentEmailUser) {
          (req as any).session.originalAdminUser = { ...currentEmailUser, authType: 'email' };
        } else {
          // Check OAuth user
          const oauthUser = (req as any).user;
          if (oauthUser?.claims?.sub) {
            (req as any).session.originalAdminUser = { 
              id: oauthUser.claims.sub, 
              email: oauthUser.claims.email,
              authType: 'oauth'
            };
          }
        }
      }
      
      // Store impersonated user in session
      (req as any).session.emailUser = {
        id: user.id,
        email: user.email,
        userType: user.userType,
      };
      (req as any).session.impersonatedUser = {
        id: user.id,
        email: user.email,
        userType: user.userType,
        roles,
      };
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: { ...userWithoutPassword, roles }, success: true });
    } catch (error: any) {
      console.error("Impersonation error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Partner Registration with Profile
  app.post("/api/auth/partner-register", async (req: Request, res: Response) => {
    try {
      const { fullName, email, password, profile } = req.body;

      if (!email || !password || !fullName || !profile?.companyName) {
        return res.status(400).json({ 
          message: "Full name, email, password, and company name are required" 
        });
      }

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user with mover type
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        fullName,
        userType: 'mover',
        phone: profile.contactPhone,
      });

      // Create mover profile
      const moverProfile = await storage.createMoverProfile({
        userId: user.id,
        companyName: profile.companyName,
        description: profile.description || null,
        yearsInBusiness: profile.yearsInBusiness || null,
        fleetSize: profile.fleetSize || null,
        crewSize: profile.crewSize || null,
        moveTypes: profile.moveTypes || [],
        vehicleTypes: profile.vehicleTypes || [],
        serviceAreas: profile.serviceAreas || [],
        operatingHours: profile.operatingHours || null,
        contactPhone: profile.contactPhone || null,
        contactWhatsApp: profile.contactWhatsApp || null,
        businessEmail: profile.businessEmail || email,
        website: profile.website || null,
        taxId: profile.taxId || null,
        onboardingComplete: true,
      });
      await storage.ensureCompanyOwnerMembership(moverProfile.id, user.id);

      // Store user info in session
      (req as any).session.emailUser = {
        id: user.id,
        email: user.email,
        userType: user.userType,
      };

      const { password: _, ...userWithoutPassword } = user;
      res.json({ 
        user: userWithoutPassword, 
        profile: moverProfile,
        success: true 
      });
    } catch (error: any) {
      console.error("Partner registration error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== GOOGLE PLACES API ==========

  // Proxy endpoint for Google Places Autocomplete (keeps API key secure on server)
  app.get("/api/places/autocomplete", async (req: Request, res: Response) => {
    try {
      const { input, sessionToken, countries } = req.query;
      
      if (!input || typeof input !== "string") {
        return res.status(400).json({ message: "Input is required" });
      }

      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Places API key not configured" });
      }

      // Try the new Places API (Autocomplete) first
      const countryList = countries ? String(countries).split(",") : ["mx", "co", "ar", "cl", "pe"];
      
      const requestBody = {
        input,
        includedPrimaryTypes: [
          "street_address", 
          "premise", 
          "route",
          "establishment",
          "point_of_interest"
        ],
        includedRegionCodes: countryList,
        languageCode: "es",
      };

      const response = await fetch(
        "https://places.googleapis.com/v1/places:autocomplete",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Places API error response:", errorText);
        throw new Error("Google Places API request failed");
      }

      const data = await response.json();

      // Transform the response from new API format
      const suggestions = (data.suggestions || []).map((suggestion: any) => {
        const prediction = suggestion.placePrediction;
        return {
          placeId: prediction?.placeId || "",
          description: prediction?.text?.text || "",
          mainText: prediction?.structuredFormat?.mainText?.text || prediction?.text?.text || "",
          secondaryText: prediction?.structuredFormat?.secondaryText?.text || "",
        };
      }).filter((s: any) => s.placeId);

      res.json({ suggestions });
    } catch (error: any) {
      console.error("Error fetching place suggestions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get place details (for getting full address components) - Uses new Places API
  app.get("/api/places/details/:placeId", async (req: Request, res: Response) => {
    try {
      const { placeId } = req.params;

      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ message: "Google Places API key not configured" });
      }

      const response = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          method: "GET",
          headers: {
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": "formattedAddress,addressComponents,location",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Google Places Details API error:", errorText);
        throw new Error("Google Places API request failed");
      }

      const data = await response.json();

      const addressComponents: Record<string, string> = {};
      (data.addressComponents || []).forEach((component: any) => {
        const type = component.types?.[0];
        if (type) {
          addressComponents[type] = component.longText || "";
          addressComponents[`${type}_short`] = component.shortText || "";
        }
      });

      res.json({
        formattedAddress: data.formattedAddress,
        addressComponents,
        location: data.location,
      });
    } catch (error: any) {
      console.error("Error fetching place details:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== CLIENT ROUTES ==========

  // Sanitize quote data for client - only expose safe fields
  const sanitizeQuoteForClient = (quote: any) => ({
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    workflowMode: quote.workflowMode,
    fromAddress: quote.fromAddress,
    toAddress: quote.toAddress,
    moveDate: quote.moveDate,
    homeSize: quote.homeSize,
    storageOption: quote.storageOption,
    workflowStatus: quote.workflowStatus,
    createdAt: quote.createdAt,
    // Only show final price if quote is confirmed/scheduled/completed
    finalPrice: ['confirmed', 'scheduled', 'completed'].includes(quote.workflowStatus) ? quote.finalPrice : null,
  });

  // Get client dashboard data (quotes, profile info)
  app.get("/api/client/dashboard", requireClient, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }

      const user = await storage.getUser(userId);
      const rawQuotes = await storage.getQuotesByUser(userId);
      
      // Sanitize quotes to only include client-safe fields
      const quotes = rawQuotes.map(sanitizeQuoteForClient);

      // Calculate stats
      const pendingQuotes = quotes.filter(q => ['intake', 'triage', 'bidding_open'].includes(q.workflowStatus || ''));
      const activeQuotes = quotes.filter(q => ['selection', 'confirmed', 'scheduled'].includes(q.workflowStatus || ''));
      const completedQuotes = quotes.filter(q => q.workflowStatus === 'completed');

      res.json({
        user: user ? { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone } : null,
        quotes,
        stats: {
          pendingQuotes: pendingQuotes.length,
          activeQuotes: activeQuotes.length,
          completedQuotes: completedQuotes.length,
          totalQuotes: quotes.length,
        }
      });
    } catch (error: any) {
      console.error("Error fetching client dashboard:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get client's quotes with enhanced data for moves page
  app.get("/api/client/quotes", requireClient, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      const rawQuotes = await storage.getQuotesByUser(userId);
      
      // Enhance quotes with bid counts and assigned mover info
      const quotesWithDetails = await Promise.all(rawQuotes.map(async (quote) => {
        const sanitized = sanitizeQuoteForClient(quote);
        
        // Get bid count for bidding quotes
        let bidsCount = 0;
        if (['bidding_open', 'bidding_closed', 'selection'].includes(quote.workflowStatus || '')) {
          const bids = await storage.getQuoteBids(quote.id);
          bidsCount = bids.filter(b => b.status === 'submitted' || b.status === 'accepted' || b.status === 'selected').length;
        }
        
        // Get assigned mover info for confirmed moves
        let assignedMover: { id: string; companyName: string; companyLogo: string | null; city: string | null; state: string | null } | null = null;
        if (quote.assignedMoverProfileId) {
          const moverProfile = await storage.getMoverProfile(quote.assignedMoverProfileId);
          if (moverProfile) {
            assignedMover = {
              id: moverProfile.id,
              companyName: moverProfile.companyName,
              companyLogo: moverProfile.companyLogo,
              city: moverProfile.city,
              state: moverProfile.state,
            };
          }
        }
        
        return {
          ...sanitized,
          bidsCount,
          biddingCloseAt: quote.biddingCloseAt,
          assignedMover,
        };
      }));
      
      res.json({ quotes: quotesWithDetails });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get a single client quote with inventory
  app.get("/api/client/quotes/:quoteId", requireClient, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { quoteId } = req.params;
      
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Verify ownership
      if (quote.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get inventory items
      const inventoryItems = await storage.getInventoryByQuote(quoteId);
      
      // Get bids if quote is in bidding/selection phase
      let bids: Array<{
        id: string;
        amount: string;
        status: string;
        notes: string | null;
        adjustmentReason: string | null;
        createdAt: Date;
        clientPreferenceRank: number | null;
        moverProfile: {
          id: string;
          companyName: string;
          companyLogo: string | null;
          city: string | null;
          state: string | null;
        };
      }> = [];
      
      const biddingStatuses = ['bidding_open', 'bidding_closed', 'selection', 'confirmed', 'scheduled', 'in_progress', 'completed'];
      if (biddingStatuses.includes(quote.workflowStatus || '')) {
        const allBids = await storage.getQuoteBids(quoteId);
        // Only include submitted bids with sanitized mover info (no contact info for privacy)
        bids = allBids
          .filter(bid => bid.status === 'submitted' || bid.status === 'accepted' || bid.status === 'selected')
          .map(bid => ({
            id: bid.id,
            amount: bid.amount,
            status: bid.status,
            notes: bid.notes,
            adjustmentReason: bid.adjustmentReason,
            createdAt: bid.createdAt,
            clientPreferenceRank: bid.clientPreferenceRank,
            moverProfile: {
              id: bid.moverProfile.id,
              companyName: bid.moverProfile.companyName,
              companyLogo: bid.moverProfile.companyLogo,
              city: bid.moverProfile.city,
              state: bid.moverProfile.state,
            },
          }));
      }
      
      res.json({ 
        quote: {
          ...sanitizeQuoteForClient(quote),
          inventoryItems,
          bids,
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Set client bid preferences (ranking order)
  app.put("/api/client/quotes/:quoteId/preferences", requireClient, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { quoteId } = req.params;
      const { bidRankings } = req.body; // Array of { bidId: string, rank: number }
      
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }
      
      // Validate input
      if (!Array.isArray(bidRankings)) {
        return res.status(400).json({ message: "bidRankings must be an array" });
      }
      
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Verify ownership
      if (quote.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Only allow ranking when quote is in bidding/selection phase
      const allowedStatuses = ['bidding_open', 'bidding_closed', 'selection'];
      if (!allowedStatuses.includes(quote.workflowStatus || '')) {
        return res.status(400).json({ message: "Cannot set preferences for quotes not in bidding phase" });
      }
      
      // Get all bids for this quote
      const allBids = await storage.getQuoteBids(quoteId);
      const allBidIds = new Set(allBids.map(b => b.id));
      const submittedBidIds = new Set(
        allBids
          .filter(b => b.status === 'submitted' || b.status === 'accepted' || b.status === 'selected')
          .map(b => b.id)
      );
      
      // Validate all bidIds exist and belong to this quote
      for (const ranking of bidRankings) {
        // Allow ranking any bid that belongs to this quote (even if status changed)
        if (!allBidIds.has(ranking.bidId)) {
          return res.status(400).json({ message: `Invalid bid ID: ${ranking.bidId}` });
        }
        if (typeof ranking.rank !== 'number' || ranking.rank < 1) {
          return res.status(400).json({ message: "Rank must be a positive number" });
        }
      }
      
      // Update each bid's preference rank
      const now = new Date();
      for (const ranking of bidRankings) {
        await db.update(quoteBids)
          .set({ 
            clientPreferenceRank: ranking.rank,
            clientPreferenceUpdatedAt: now,
            updatedAt: now,
          })
          .where(eq(quoteBids.id, ranking.bidId));
      }
      
      // Clear rank from any bids not in the rankings
      const rankedBidIds = new Set(bidRankings.map((r: any) => r.bidId));
      for (const bidId of submittedBidIds) {
        if (!rankedBidIds.has(bidId)) {
          await db.update(quoteBids)
            .set({ 
              clientPreferenceRank: null,
              clientPreferenceUpdatedAt: null,
              updatedAt: now,
            })
            .where(eq(quoteBids.id, bidId));
        }
      }
      
      res.json({ success: true, message: "Preferences saved successfully" });
    } catch (error: any) {
      console.error("Error saving bid preferences:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new quote for authenticated user
  app.post("/api/client/quotes", requireClient, async (req: Request, res: Response) => {
    try {
      assertNoDerivedEligibilityFields(req.body);
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "User not found" });
      }

      const { fromAddress, toAddress, date, homeSize, storage: storageOpt } = req.body;
      const branchSelection = endpointSelection(req.body);

      // Validate required fields
      if (!fromAddress || typeof fromAddress !== 'string' || fromAddress.length < 5) {
        return res.status(400).json({ message: "fromAddress is required and must be at least 5 characters" });
      }
      if (!toAddress || typeof toAddress !== 'string' || toAddress.length < 5) {
        return res.status(400).json({ message: "toAddress is required and must be at least 5 characters" });
      }
      if (!date || typeof date !== 'string') {
        return res.status(400).json({ message: "date is required" });
      }
      
      // Validate date format
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ message: "Invalid date format" });
      }

      // Validate and normalize homeSize
      const validHomeSizes = ['small', 'medium', 'large', 'office'];
      const normalizedHomeSize = validHomeSizes.includes(homeSize) ? homeSize : 'medium';

      // Validate and normalize storageOption
      const validStorageOptions = ['none', 'need', 'ustorage', 'other'];
      const normalizedStorageOption = validStorageOptions.includes(storageOpt) ? storageOpt : 'none';

      // Only pass fields that are part of InsertQuote schema
      const newQuote = await storage.createQuote({
        userId,
        fromAddress,
        toAddress,
        moveDate: parsedDate,
        homeSize: normalizedHomeSize,
        storageOption: normalizedStorageOption,
        ...branchSelection,
      });

      // Update workflowStatus to 'intake' after creation
      const quote = await storage.updateQuote(newQuote.id, { workflowStatus: 'intake' });

      // NOTE: Quote confirmation email is NOT sent at creation time.
      // It should be sent when the user explicitly submits their quote after completing inventory.
      // This prevents confusing UX where "quote received" emails are sent before inventory is complete.

      res.status(201).json({ quote: sanitizeQuoteForClient(quote) });
    } catch (error: any) {
      if (sendQuoteEligibilityError(res, error)) return;
      console.error("Error creating quote:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== MOVER ROUTES ==========

  // Get mover profile - requires authentication and ownership verification
  app.get("/api/mover/profile/:userId", requireCompanyPermission("company:read"), async (req: Request, res: Response) => {
    try {
      res.json({ profile: (req as any).company });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get current user's mover profile (no userId param needed)
  app.get("/api/mover/profile", requireCompanyPermission("company:read"), async (req: Request, res: Response) => {
    try {
      res.json({ profile: (req as any).company });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Fields that only admins may modify on a mover profile.
  // Movers must never be allowed to self-assign trust or approval state.
  const MOVER_PROFILE_ADMIN_ONLY_FIELDS = [
    "verified",
    "partnerStatus",
    "partnerStatusNote",
    "partnerStatusUpdatedAt",
    "rating",
    "totalJobs",
    "onboardingComplete",
  ] as const;

  function stripAdminOnlyMoverFields(body: Record<string, unknown>): Record<string, unknown> {
    const allowed = ["companyName","businessEmail","contactPhone","contactWhatsApp","website","description","taxId","insuranceInfo","serviceAreas","moveTypes","vehicleTypes","fleetSize","crewSize","yearsInBusiness","operatingHours","operatingTimezone","operatingSchedule","serviceCapabilities","travelBufferMinutes","turnaroundBufferMinutes"];
    const sanitized: Record<string, unknown> = {};
    for (const field of allowed) if (body[field] !== undefined) sanitized[field] = body[field];
    return sanitized;
  }

  // Update mover profile - requires authentication and ownership verification
  app.patch("/api/mover/profile/:userId", requireCompanyPermission("company:manage"), async (req: Request, res: Response) => {
    try {
      const [profile] = await db.update(moverProfiles).set({ ...stripAdminOnlyMoverFields(req.body), updatedAt: new Date() }).where(eq(moverProfiles.id, (req as any).company.id)).returning();
      res.json({ profile });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update current user's mover profile (no userId param needed)
  app.patch("/api/mover/profile", requireCompanyPermission("company:manage"), async (req: Request, res: Response) => {
    try {
      const [profile] = await db.update(moverProfiles).set({ ...stripAdminOnlyMoverFields(req.body), updatedAt: new Date() }).where(eq(moverProfiles.id, (req as any).company.id)).returning();
      res.json({ profile });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== ADMIN ROUTES ==========

  // Get all partners/movers - fetches users with mover role, with optional profile data
  app.get("/api/admin/partners", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      // Get users with mover role from user_roles table
      const moverUsers = await storage.getUsersByRole('mover');
      
      // Get last activity for all mover users
      const lastActiveMap = await storage.getLastActiveByUserIds(moverUsers.map(u => u.id));
      
      // For each mover user, try to get their profile (optional)
      const partners = await Promise.all(moverUsers.map(async (user) => {
        let profile = null;
        try {
          profile = await storage.getMoverProfile(user.id);
        } catch (e) {
          // No profile found, that's ok
        }
        const { password: _, ...userWithoutPassword } = user;
        const lastActiveAt = lastActiveMap.get(user.id)?.toISOString() || user.lastLoginAt || user.createdAt;
        return {
          user: { ...userWithoutPassword, lastActiveAt },
          profile: profile ? {
            id: profile.id,
            userId: profile.userId,
            companyName: profile.companyName,
            description: profile.description,
            yearsInBusiness: profile.yearsInBusiness,
            fleetSize: profile.fleetSize,
            serviceAreas: profile.serviceAreas,
            insuranceInfo: profile.insuranceInfo,
            rating: profile.rating,
            totalJobs: profile.totalJobs,
            verified: profile.verified,
            createdAt: profile.createdAt,
          } : null
        };
      }));
      res.json({ partners });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single mover/partner details (admin)
  // Supports lookup by either mover profile ID or user ID
  // A mover/socio is defined by having the 'mover' role, not by having a profile
  app.get("/api/admin/movers/:moverId", isAuthenticated, requireAdmin, requireAdminPermission('canManageMovers'), async (req: Request, res: Response) => {
    try {
      const { moverId } = req.params;
      
      // First try to find by profile ID
      let profile = await storage.getMoverProfileById(moverId);
      
      // If not found, try to find by user ID
      if (!profile) {
        profile = await storage.getMoverProfile(moverId);
      }
      
      // Get linked user - either from profile or directly by ID
      let user = null;
      if (profile?.userId) {
        const userData = await storage.getUser(profile.userId);
        if (userData) {
          const { password, ...safeUser } = userData;
          user = safeUser;
        }
      } else if (!profile) {
        // No profile found - try to get user directly by ID
        // A user with mover role but no profile is still a valid mover/socio
        const userData = await storage.getUser(moverId);
        if (userData) {
          // Check if user has mover role
          const roles = await storage.getUserRoles(moverId);
          const hasMoverRole = roles.some(r => r.role === 'mover');
          if (hasMoverRole) {
            const { password, ...safeUser } = userData;
            user = safeUser;
          }
        }
      }
      
      // If no profile AND no user with mover role found, return 404
      if (!profile && !user) {
        return res.status(404).json({ message: "Mover profile not found" });
      }
      
      // Return mover data - profile may be null for users with mover role but no profile yet
      res.json({ mover: { ...profile, user, userId: profile?.userId || user?.id } });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update mover/partner details (admin)
  app.patch("/api/admin/movers/:moverId", isAuthenticated, requireAdmin, requireAdminPermission('canManageMovers'), async (req: Request, res: Response) => {
    try {
      const { moverId } = req.params;
      const profile = await storage.getMoverProfileById(moverId);
      if (!profile) {
        return res.status(404).json({ message: "Mover profile not found" });
      }
      const updatedProfile = await storage.updateMoverProfileById(moverId, req.body);
      res.json({ mover: updatedProfile, success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Verify/unverify mover (admin)
  app.patch("/api/admin/movers/:moverId/verify", isAuthenticated, requireAdmin, requireAdminPermission('canManageMovers'), async (req: Request, res: Response) => {
    try {
      const { moverId } = req.params;
      const { verified } = req.body;
      const updatedProfile = await storage.updateMoverProfileById(moverId, { verified });
      res.json({ mover: updatedProfile, success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get mover's bids (admin)
  app.get("/api/admin/movers/:moverId/bids", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { moverId } = req.params;
      const bids = await storage.getBidsByMoverProfileId(moverId);
      // Enrich with quote info
      const enrichedBids = await Promise.all(bids.map(async (bid: any) => {
        const quote = await storage.getQuote(bid.quoteId);
        return {
          ...bid,
          quote: quote ? {
            quoteNumber: quote.quoteNumber,
            fromAddress: quote.fromAddress,
            toAddress: quote.toAddress,
          } : null,
        };
      }));
      res.json({ bids: enrichedBids });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get mover's ratings (admin)
  app.get("/api/admin/movers/:moverId/ratings", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { moverId } = req.params;
      const ratings = await storage.getRatingsByMoverProfileId(moverId);
      res.json({ ratings });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get partner status definitions (public endpoint for labels/colors)
  app.get("/api/partner-statuses", async (req: Request, res: Response) => {
    const statuses = [
      {
        id: 'pending',
        key: 'pending',
        labelEs: 'Pendiente',
        labelEn: 'Pending',
        descriptionEs: 'Esperando revisión inicial',
        description: 'Awaiting initial review',
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        icon: 'clock',
        sortOrder: 1,
        isActive: true,
        isFinal: false,
        isDefault: true,
      },
      {
        id: 'documents_review',
        key: 'documents_review',
        labelEs: 'Revisión de Documentos',
        labelEn: 'Documents Review',
        descriptionEs: 'Documentos en revisión',
        description: 'Documents under review',
        color: '#3B82F6',
        bgColor: '#DBEAFE',
        icon: 'file-text',
        sortOrder: 2,
        isActive: true,
        isFinal: false,
        isDefault: false,
      },
      {
        id: 'approved',
        key: 'approved',
        labelEs: 'Aprobado',
        labelEn: 'Approved',
        descriptionEs: 'Aprobado, completando onboarding',
        description: 'Approved, completing onboarding',
        color: '#8B5CF6',
        bgColor: '#EDE9FE',
        icon: 'check-circle',
        sortOrder: 3,
        isActive: true,
        isFinal: false,
        isDefault: false,
      },
      {
        id: 'active',
        key: 'active',
        labelEs: 'Activo',
        labelEn: 'Active',
        descriptionEs: 'Puede recibir invitaciones y ofertar',
        description: 'Can receive invitations and bid',
        color: '#10B981',
        bgColor: '#D1FAE5',
        icon: 'check',
        sortOrder: 4,
        isActive: true,
        isFinal: false,
        isDefault: false,
      },
      {
        id: 'suspended',
        key: 'suspended',
        labelEs: 'Suspendido',
        labelEn: 'Suspended',
        descriptionEs: 'Temporalmente suspendido',
        description: 'Temporarily suspended',
        color: '#EF4444',
        bgColor: '#FEE2E2',
        icon: 'pause-circle',
        sortOrder: 5,
        isActive: true,
        isFinal: false,
        isDefault: false,
      },
      {
        id: 'inactive',
        key: 'inactive',
        labelEs: 'Inactivo',
        labelEn: 'Inactive',
        descriptionEs: 'Desactivado',
        description: 'Deactivated',
        color: '#6B7280',
        bgColor: '#F3F4F6',
        icon: 'x-circle',
        sortOrder: 6,
        isActive: true,
        isFinal: true,
        isDefault: false,
      },
    ];
    res.json(statuses);
  });

  // Update partner status (admin)
  // Supports lookup by either mover profile ID or user ID
  // Creates a profile automatically if the user has mover role but no profile
  app.patch("/api/admin/movers/:moverId/status", isAuthenticated, requireAdmin, requireAdminPermission('canManageMovers'), async (req: Request, res: Response) => {
    try {
      const { moverId } = req.params;
      const { status, note } = req.body;
      
      if (!status) {
        return res.status(400).json({ message: "Status is required" });
      }
      
      const validStatuses = ['pending', 'documents_review', 'approved', 'active', 'suspended', 'inactive'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      
      // Try to find profile by profile ID first, then by user ID
      let profile = await storage.getMoverProfileById(moverId);
      if (!profile) {
        profile = await storage.getMoverProfile(moverId);
      }
      
      // If no profile exists, try to create one for the user (if they have mover role)
      if (!profile) {
        const user = await storage.getUser(moverId);
        if (user) {
          const roles = await storage.getUserRoles(moverId);
          const hasMoverRole = roles.some(r => r.role === 'mover');
          if (hasMoverRole) {
            // Create a new mover profile for this user
            profile = await storage.createMoverProfile({
              userId: moverId,
              companyName: user.fullName || user.email || 'Nuevo Socio',
              partnerStatus: 'pending',
            });
            console.log(`[Admin] Created mover profile for user ${moverId}`);
          }
        }
      }
      
      if (!profile) {
        return res.status(404).json({ message: "Mover profile not found and could not be created" });
      }
      
      const actorId = getActiveUserId(req);
      const actor = actorId ? await storage.getUser(actorId) : null;
      
      const updatedProfile = await storage.updatePartnerStatus(
        profile.id,
        status,
        'admin',
        actorId || undefined,
        actor?.firstName && actor?.lastName ? `${actor.firstName} ${actor.lastName}` : actor?.email || undefined,
        note
      );
      
      res.json({ mover: updatedProfile, success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get partner status history (admin)
  app.get("/api/admin/movers/:moverId/status-history", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { moverId } = req.params;
      const history = await storage.getPartnerStatusHistory(moverId);
      res.json({ history });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Backfill mover profiles for all users with mover role but no profile
  app.post("/api/admin/movers/backfill-profiles", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const createdProfiles = await storage.backfillMoverProfiles();
      
      // Log activity
      const actorId = getActiveUserId(req);
      await storage.logActivity({
        userId: actorId || undefined,
        actorRole: 'admin',
        action: 'mover.profiles_backfilled',
        entityType: 'system',
        entityId: 'backfill',
        details: { 
          profilesCreated: createdProfiles.length,
          profiles: createdProfiles,
        },
      });
      
      res.json({ 
        success: true, 
        message: `Created ${createdProfiles.length} mover profile(s)`,
        profilesCreated: createdProfiles.length,
        profiles: createdProfiles,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== CRM SYNC (Salesforce lead mirroring) ==========

  // CRM integration status - configured (live) vs dry-run mode + outbox stats
  app.get("/api/admin/crm/status", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const [configured, stats] = await Promise.all([
        isSalesforceConfigured(),
        storage.getCrmOutboxStats(),
      ]);
      res.json({
        provider: 'salesforce',
        configured,
        mode: configured ? 'live' : 'dry_run',
        stats,
      });
    } catch (error: any) {
      console.error("Error fetching CRM status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // List CRM outbox entries (optionally filtered by status/partner)
  app.get("/api/admin/crm/outbox", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status, partner } = req.query as { status?: string; partner?: string };
      const entries = await storage.getCrmOutboxEntries({ status, partner, limit: 200 });
      res.json({ entries });
    } catch (error: any) {
      console.error("Error fetching CRM outbox:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // CRM delivery status for a specific quote (used in admin quote details)
  app.get("/api/admin/quotes/:quoteId/crm-outbox", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const entries = await storage.getCrmOutboxByQuote(req.params.quoteId);
      res.json({ entries });
    } catch (error: any) {
      console.error("Error fetching quote CRM outbox:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Manually retry a failed/stuck outbox entry
  app.post("/api/admin/crm/outbox/:id/retry", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const entry = await retryCrmOutboxEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ message: "Outbox entry not found" });
      }
      if ('alreadySent' in entry) {
        return res.status(409).json({ message: "This lead was already delivered to Salesforce; retrying would create a duplicate record" });
      }
      res.json({ entry });
    } catch (error: any) {
      console.error("Error retrying CRM outbox entry:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Manually trigger the outbox worker (process everything deliverable now)
  app.post("/api/admin/crm/outbox/process", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await processCrmOutbox();
      res.json(result);
    } catch (error: any) {
      console.error("Error processing CRM outbox:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get active partners only (for invitation dropdown)
  app.get("/api/admin/active-partners", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const partners = await storage.getActivePartners();
      res.json({ partners });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== U-STORAGE BRANCH ROUTES ==========

  // Admin: list branches + settings
  app.get("/api/admin/ustorage/branches", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const [branches, settings] = await Promise.all([
        storage.getUstorageBranches(),
        storage.getUstorageSettings(),
      ]);
      res.json({ branches, settings });
    } catch (error: any) {
      console.error("Error fetching U-Storage branches:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: reconcile the versioned official workbook (never the live scraper)
  app.post("/api/admin/ustorage/branches/refresh", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const result = await syncOfficialBranchCatalog();
      await storage.logActivity({
        userId: getUserId(req),
        actorRole: "admin",
        action: "storage_catalog.synced",
        entityType: "storage_catalog",
        details: result,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      res.json(result);
    } catch (error: any) {
      console.error("Error refreshing U-Storage branches:", error);
      res.status(502).json({ message: error.message || "Failed to refresh branches from u-storage.com.mx" });
    }
  });

  // Admin: toggle a branch active/inactive
  app.patch("/api/admin/ustorage/branches/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { isActive } = req.body;
      if (typeof isActive !== 'boolean') {
        return res.status(400).json({ message: "isActive (boolean) is required" });
      }
      const branch = await storage.getUstorageBranch(req.params.id);
      if (!branch) {
        return res.status(404).json({ message: "Branch not found" });
      }
      if (isActive && (
        branch.catalogStatus !== "official" ||
        !branch.address ||
        !branch.googlePlaceId ||
        !branch.lat ||
        !branch.lng
      )) {
        return res.status(409).json({
          message: "Only complete official catalog branches can be activated",
          code: "BRANCH_DATA_INCOMPLETE",
        });
      }
      const updated = await storage.updateUstorageBranch(branch.id, { isActive });
      await storage.logActivity({
        userId: getUserId(req),
        actorRole: "admin",
        action: isActive ? "storage_branch.activated" : "storage_branch.deactivated",
        entityType: "storage_branch",
        entityId: branch.id,
        details: { name: branch.name, brand: branch.brand, previousIsActive: branch.isActive, isActive },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      res.json({ branch: updated });
    } catch (error: any) {
      console.error("Error updating U-Storage branch:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: update storage feature settings
  app.patch("/api/admin/ustorage/settings", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { branchMovesEnabled, generalMovesEnabled, intoStorageEnabled, outOfStorageEnabled, matchRadiusKm } = req.body;
      const updateData: any = {};
      if (branchMovesEnabled !== undefined) {
        if (typeof branchMovesEnabled !== 'boolean') return res.status(400).json({ message: "branchMovesEnabled must be a boolean" });
        updateData.branchMovesEnabled = branchMovesEnabled;
      }
      if (generalMovesEnabled !== undefined) {
        if (typeof generalMovesEnabled !== 'boolean') return res.status(400).json({ message: "generalMovesEnabled must be a boolean" });
        updateData.generalMovesEnabled = generalMovesEnabled;
      }
      if (intoStorageEnabled !== undefined) {
        if (typeof intoStorageEnabled !== 'boolean') return res.status(400).json({ message: "intoStorageEnabled must be a boolean" });
        updateData.intoStorageEnabled = intoStorageEnabled;
      }
      if (outOfStorageEnabled !== undefined) {
        if (typeof outOfStorageEnabled !== 'boolean') return res.status(400).json({ message: "outOfStorageEnabled must be a boolean" });
        updateData.outOfStorageEnabled = outOfStorageEnabled;
      }
      if (matchRadiusKm !== undefined) {
        const r = parseFloat(matchRadiusKm);
        if (!Number.isFinite(r) || r <= 0 || r > 100) {
          return res.status(400).json({ message: "matchRadiusKm must be a number between 0 and 100" });
        }
        updateData.matchRadiusKm = r.toString();
      }
      const previous = await storage.getUstorageSettings();
      const settings = await storage.updateUstorageSettings(updateData);
      await storage.logActivity({
        userId: getUserId(req),
        actorRole: "admin",
        action: "storage_policy.updated",
        entityType: "storage_settings",
        entityId: settings.id,
        details: { previous, changes: updateData },
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
      });
      res.json({ settings });
    } catch (error: any) {
      console.error("Error updating U-Storage settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Public: active branches from the approved catalog only
  app.get("/api/ustorage/branches", async (req: Request, res: Response) => {
    try {
      const query = typeof req.query.q === "string" ? req.query.q.trim().toLocaleLowerCase("es-MX") : "";
      const normalizeSearchText = (value: string) =>
        value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
      const queryTerms = normalizeSearchText(query).split(/\s+/).filter(Boolean);
      const branches = (await storage.getUstorageBranches())
        .filter((branch) => branch.catalogStatus === "official" && branch.isActive)
        .filter((branch) => branch.address && branch.googlePlaceId && branch.lat && branch.lng)
        .filter((branch) => {
          if (queryTerms.length === 0) return true;
          const searchable = normalizeSearchText(
            `${branch.brand} ${branch.name} ${branch.region ?? ""} ${branch.address ?? ""}`.toLocaleLowerCase("es-MX"),
          );
          return queryTerms.every((term) => searchable.includes(term));
        })
        .map((branch) => ({
          id: branch.id,
          brand: branch.brand,
          name: branch.name,
          region: branch.region,
          address: branch.address,
          lat: branch.lat,
          lng: branch.lng,
          googlePlaceId: branch.googlePlaceId,
          mapsUrl: branch.mapsUrl,
        }));
      res.json({ branches });
    } catch (error: any) {
      console.error("Error fetching public storage branches:", error);
      res.status(500).json({ message: "Failed to fetch storage branches" });
    }
  });

  app.get("/api/ustorage/service-policy", async (_req: Request, res: Response) => {
    const settings = await storage.getUstorageSettings();
    res.json({
      branchMovesEnabled: settings.branchMovesEnabled,
      generalMovesEnabled: settings.generalMovesEnabled,
      intoStorageEnabled: settings.intoStorageEnabled !== false,
      outOfStorageEnabled: settings.outOfStorageEnabled !== false,
    });
  });

  // Server-only bridge to the temporary public availability source. The
  // browser never contacts this undocumented endpoint directly.
  app.get("/api/ustorage/availability", async (req: Request, res: Response) => {
    try {
      const branchId = typeof req.query.branchId === "string" ? req.query.branchId : "";
      const branch = branchId ? await storage.getUstorageBranch(branchId) : undefined;
      if (!branch || !branch.isActive || branch.catalogStatus !== "official" || !branch.googlePlaceId || !branch.lat || !branch.lng) {
        return res.status(404).json({ status: "wrong_branch", options: [], message: "The selected storage branch is unavailable." });
      }
      const volume = typeof req.query.volumeM3 === "string" ? Number(req.query.volumeM3) : undefined;
      const result = await createUStorageAvailabilityAdapter().getAvailability(branch, Number.isFinite(volume) ? volume : undefined);
      if (result.status !== "available" && result.status !== "no_availability") {
        console.warn(JSON.stringify({
          event: "ustorage.availability_health",
          branchId: branch.id,
          status: result.status,
          checkedAt: result.checkedAt,
        }));
      }
      res.json(result);
    } catch (error) {
      console.error("U-Storage availability adapter failed:", error instanceof Error ? error.message : error);
      res.status(503).json({ status: "unavailable", options: [], retryable: true, message: "Storage availability is temporarily unavailable." });
    }
  });

  // Validate the selected public unit at handoff time and return an official
  // deep link. No customer contact data is accepted or included in the URL.
  app.post("/api/ustorage/reservation-handoff", async (req: Request, res: Response) => {
    try {
      const branchId = typeof req.body?.branchId === "string" ? req.body.branchId : "";
      const code = typeof req.body?.code === "string" ? req.body.code.trim().slice(0, 100) : "";
      const volumeM3 = req.body?.volumeM3 === undefined ? undefined : Number(req.body.volumeM3);
      const branch = branchId ? await storage.getUstorageBranch(branchId) : undefined;
      if (
        !branch || !branch.isActive || branch.catalogStatus !== "official" || !branch.googlePlaceId || !code ||
        (volumeM3 !== undefined && (!Number.isFinite(volumeM3) || volumeM3 < 0 || volumeM3 > 10000))
      ) {
        return res.status(400).json({ message: "A valid official branch and unit are required." });
      }
      const handoff = await validateReservationHandoff({ branch, code, volumeM3 });
      if (!handoff.ok) {
        return res.status(handoff.status === "unavailable" || handoff.status === "rate_limited" || handoff.status === "format_error" ? 503 : 409).json({
          status: handoff.status,
          message: "That unit is no longer available at the selected branch.",
        });
      }
      res.json({ reservationUrl: handoff.reservationUrl, option: handoff.option });
    } catch (error) {
      console.error("U-Storage reservation handoff failed:", error instanceof Error ? error.message : error);
      res.status(503).json({ status: "unavailable", message: "Storage reservation is temporarily unavailable." });
    }
  });

  // Redeem an opaque U-Storage code; raw codes never leave this request.
  app.post("/api/ustorage/reservations/redeem", async (req: Request, res: Response) => {
    const quoteSessionId = typeof req.body?.quoteSessionId === "string" ? req.body.quoteSessionId.trim() : "";
    const code = typeof (req.body?.code ?? req.body?.reservationCode) === "string" ? String(req.body.code ?? req.body.reservationCode).trim() : "";
    if (!quoteSessionId || !code || quoteSessionId.length > 200) return res.status(400).json({ message: "quoteSessionId and reservation code are required" });
    const result = await createUStorageReservationProvider().redeem(code);
    console.log(JSON.stringify({ event: "ustorage.reservation_redeem", outcome: result.ok ? "verified_upstream" : result.reason }));
    if (!result.ok) return res.status(result.reason === "unavailable" ? 503 : 422).json({ status: result.reason, message: result.reason === "expired" ? "Reservation code has expired" : result.reason === "unavailable" ? "Reservation service is temporarily unavailable" : "Reservation could not be confirmed" });
    const officialBranch = result.confirmation.branchExternalId
      ? await storage.getUstorageBranchByExternalId(result.confirmation.branchExternalId)
      : result.confirmation.branchGooglePlaceId
        ? await storage.getUstorageBranchByGooglePlaceId(result.confirmation.branchGooglePlaceId)
        : undefined;
    if (!officialBranch || !officialBranch.isActive || officialBranch.catalogStatus !== "official" ||
        (result.confirmation.branchExternalId && officialBranch.externalId !== result.confirmation.branchExternalId) ||
        (result.confirmation.branchGooglePlaceId && officialBranch.googlePlaceId !== result.confirmation.branchGooglePlaceId)) {
      console.log(JSON.stringify({ event: "ustorage.reservation_redeem", outcome: "wrong_branch" }));
      return res.status(422).json({ status: "wrong_branch", message: "Reservation branch could not be verified" });
    }
    console.log(JSON.stringify({ event: "ustorage.reservation_redeem", outcome: "confirmed", branchId: officialBranch.id }));
    const exchangeId = issueReservationClaim(quoteSessionId, result.confirmation);
    return res.json({
      exchangeId, provenance: "ustorage_confirmed", status: "confirmed",
      verifiedFields: ["status", "consent", "audience", "issuedAt", "expiresAt", "nonce", "redemptionRef", "branch", "customer", "unit", "rentalStart", "locale"],
      expiresAt: new Date(Math.min(Date.now() + 600000, result.confirmation.expiresAt.getTime())).toISOString(),
      customer: result.confirmation.customer,
      branch: { id: officialBranch.id, externalId: officialBranch.externalId, name: officialBranch.name, address: officialBranch.address, googlePlaceId: officialBranch.googlePlaceId },
      unit: result.confirmation.unit, rentalStart: result.confirmation.rentalStart.toISOString(), locale: result.confirmation.locale,
    });
  });

  app.post("/api/ustorage/reservations/events", (req: Request, res: Response) => {
    const allowed = new Set([
      "arrival", "manual_started", "exchange_confirmed", "exchange_failed",
      "step_completed", "quote_submitted", "abandoned",
    ]);
    const event = typeof req.body?.event === "string" && allowed.has(req.body.event) ? req.body.event : null;
    if (!event) return res.status(400).json({ message: "Invalid event" });
    const step = typeof req.body?.step === "number" && req.body.step >= 1 && req.body.step <= 6
      ? req.body.step
      : undefined;
    const tokenState = ["none", "confirmed", "invalid", "expired", "used", "partial", "unavailable", "wrong_branch"]
      .includes(req.body?.tokenState) ? req.body.tokenState : undefined;
    console.log(JSON.stringify({
      event: "ustorage.reservation_funnel",
      action: event,
      step,
      tokenState,
      verified: req.body?.verified === true,
    }));
    res.status(204).end();
  });

  // Public: get a storage recommendation for a move (used by quote wizard step 4)
  app.post("/api/quotes/storage-recommendation", async (req: Request, res: Response) => {
    try {
      const { fromAddress, toAddress, volumeM3 } = req.body;
      if (typeof fromAddress !== 'string' || typeof toAddress !== 'string' ||
          !fromAddress.trim() || !toAddress.trim() ||
          fromAddress.length > 500 || toAddress.length > 500) {
        return res.status(400).json({ message: "fromAddress and toAddress are required (max 500 chars)" });
      }
      let vol: number | undefined = undefined;
      if (volumeM3 !== undefined && volumeM3 !== null) {
        const v = parseFloat(volumeM3);
        if (!Number.isFinite(v) || v < 0 || v > 10000) {
          return res.status(400).json({ message: "volumeM3 must be a number between 0 and 10000" });
        }
        vol = v;
      }
      const recommendation = await getStorageRecommendation({
        fromAddress: fromAddress.trim(),
        toAddress: toAddress.trim(),
        volumeM3: vol,
      });
      let availability = null;
      if (recommendation?.moveType === "into_storage") {
        const branch = await storage.getUstorageBranch(recommendation.branch.id);
        if (branch) {
          availability = await createUStorageAvailabilityAdapter().getAvailability(branch, vol);
          if (availability.status !== "available" && availability.status !== "no_availability") {
            console.warn(JSON.stringify({
              event: "ustorage.availability_health",
              branchId: branch.id,
              status: availability.status,
              checkedAt: availability.checkedAt,
            }));
          }
        }
      }
      res.json({
        recommendation: recommendation ? { ...recommendation, availability } : null,
        availability,
      });
    } catch (error: any) {
      console.error("Error getting storage recommendation:", error);
      res.status(500).json({ message: "Failed to get storage recommendation" });
    }
  });

  // Public: booking rule — origin OR destination must be near a U-Storage branch
  app.post("/api/quotes/validate-storage-address", async (req: Request, res: Response) => {
    try {
      const { fromAddress, toAddress } = req.body;
      if (typeof fromAddress !== 'string' || typeof toAddress !== 'string' ||
          !fromAddress.trim() || !toAddress.trim() ||
          fromAddress.length > 500 || toAddress.length > 500) {
        return res.status(400).json({ message: "fromAddress and toAddress are required (max 500 chars)" });
      }
      const result = await validateStorageProximity({
        fromAddress: fromAddress.trim(),
        toAddress: toAddress.trim(),
      });
      res.json({ result });
    } catch (error: any) {
      if (sendQuoteEligibilityError(res, error)) return;
      console.error("Error validating storage address:", error);
      res.status(500).json({ message: "Failed to validate addresses" });
    }
  });

  // ========== QUOTE ROUTES ==========

  // Create quote
  app.post("/api/quotes", async (req: Request, res: Response) => {
    try {
      assertNoDerivedEligibilityFields(req.body);
      const branchSelection = endpointSelection(req.body);
      const result = insertQuoteSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: fromZodError(result.error).message,
        });
      }

      const quote = await storage.createQuote({ ...result.data, ...branchSelection });

      // Mirror partner leads (e.g. u-storage) to their CRM via the outbox (never blocks/fails lead creation)
      if (isMirroredPartner(quote.partner)) {
        enqueueCrmLead(quote, 'lead.created');
      }

      res.json({ quote });
    } catch (error: any) {
      if (sendQuoteEligibilityError(res, error)) return;
      console.error("Create quote error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create or update partial quote (for lead capture)
  // - Logged-in users: Creates quote immediately after step 1 with userId
  // - Non-logged users: Creates placeholder user from contact info, links quote after step 2
  // CRITICAL: All quotes must be linked to a user - either authenticated or placeholder
  app.post("/api/quotes/partial", async (req: Request, res: Response) => {
    try {
      assertNoDerivedEligibilityFields(req.body);
      const branchSelection = endpointSelection(req.body);
      const { 
        id, fromAddress, toAddress, moveDate, moveAvailabilityStart, moveAvailabilityEnd, preferredMoveDates, blockedMoveDates, homeSize,
        contactName, contactEmail, contactPhone,
        storageOption, needsInsurance, needsPacking, needsUnpacking, needsBox, clientNotes,
         storageSizeLabel, storageSizeM2, storageAccepted,
         storageContractStatus, storageRentalIntent, storageAvailabilityStatus,
         storageSelectedUnitCode, storageSelectedUnitSnapshot, storageReservationStatus,
         storageAvailabilityCheckedAt, storageRentalStart,
        estimatedCost, estimatedCostHigh, estimatedCurrency, truckRecommendation,
        inventoryItems,
        partner, utmSource, utmMedium, utmCampaign, utmTerm, utmContent, landingPage, referrerUrl,
         quoteSessionId, exchangeId
      } = req.body;
      const claim = typeof exchangeId === "string" ? reservationClaims.get(exchangeId) : undefined;
      const validClaim = claim && claim.expiresAt > Date.now() && claim.quoteSessionId === quoteSessionId ? claim : undefined;
      const manualReservationJourney = partner === "u-storage" && utmCampaign === "reserva-confirmada";
      const parsedStorageRentalStart = storageRentalStart ? new Date(storageRentalStart) : null;
      const safeStorageRentalStart = parsedStorageRentalStart && !Number.isNaN(parsedStorageRentalStart.getTime())
        ? parsedStorageRentalStart
        : null;
      const activeUserId = getActiveUserId(req);
      const hasDatePreferences = moveAvailabilityStart !== undefined
        || moveAvailabilityEnd !== undefined
        || preferredMoveDates !== undefined
        || blockedMoveDates !== undefined;
      const datePreferencesResult = hasDatePreferences
        ? moveDatePreferencesSchema.safeParse({
          availabilityStart: moveAvailabilityStart,
          availabilityEnd: moveAvailabilityEnd,
          preferredDates: preferredMoveDates,
          blockedDates: blockedMoveDates,
        })
        : null;
      if (datePreferencesResult && !datePreferencesResult.success) {
        return res.status(400).json({
          message: "Select a valid availability range of up to 14 days with at least one available date",
        });
      }
      const datePreferences = datePreferencesResult?.success ? datePreferencesResult.data : null;
      const hasLegacyMoveDate = Object.prototype.hasOwnProperty.call(req.body, "moveDate");
      const parsedLegacyMoveDate = moveDate ? new Date(moveDate) : null;
      if (!datePreferences && moveDate && (!parsedLegacyMoveDate || Number.isNaN(parsedLegacyMoveDate.getTime()))) {
        return res.status(400).json({ message: "Invalid move date" });
      }
      const legacyDateOnly = parsedLegacyMoveDate?.toISOString().slice(0, 10) || null;
      const canonicalLegacyDate = datePreferences
        ? legacyMoveDateForPreferences(datePreferences)
        : null;
      const primaryMoveDate = canonicalLegacyDate
        ? new Date(`${canonicalLegacyDate}T12:00:00.000Z`)
        : parsedLegacyMoveDate;
      const canonicalDateFields = datePreferences
        ? {
          moveAvailabilityStart: datePreferences.availabilityStart,
          moveAvailabilityEnd: datePreferences.availabilityEnd,
          preferredMoveDates: datePreferences.preferredDates,
          blockedMoveDates: datePreferences.blockedDates,
        }
        : hasLegacyMoveDate
          ? {
            moveAvailabilityStart: legacyDateOnly,
            moveAvailabilityEnd: legacyDateOnly,
            preferredMoveDates: legacyDateOnly ? [legacyDateOnly] : [],
            blockedMoveDates: [],
          }
          : {};
      const dateUpdateFields = datePreferences || hasLegacyMoveDate
        ? { moveDate: primaryMoveDate, ...canonicalDateFields }
        : {};
      
      if (id) {
        // Verify the caller is allowed to update this partial quote.
        // The quote must still be in partial/in-progress state.
        const existingQuote = await storage.getQuote(id);
        if (!existingQuote) {
          return res.status(404).json({ message: "Quote not found" });
        }
        if (!existingQuote.isPartial) {
          return res.status(403).json({ message: "Quote has already been submitted and cannot be modified via this endpoint" });
        }
        if (activeUserId) {
          // Authenticated caller: may only update their own quote
          if (existingQuote.userId && existingQuote.userId !== activeUserId) {
            return res.status(403).json({ message: "Access denied" });
          }
        } else {
          // Unauthenticated caller: require quoteSessionId to match the server-stored
          // token so an attacker who only knows the quote UUID cannot tamper with it.
          if (!quoteSessionId || existingQuote.quoteSessionId !== quoteSessionId) {
            return res.status(403).json({ message: "Access denied: valid quote session required" });
          }
        }

        // Update existing partial quote with all provided fields
        const updateData: any = {
          fromAddress,
          toAddress,
          ...dateUpdateFields,
          homeSize,
          ...branchSelection,
        };
        
        // Only update contact fields if provided (non-logged users)
        if (contactName !== undefined) updateData.contactName = contactName;
        if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
        if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
        
        // Update service options if provided
        if (storageOption !== undefined) updateData.storageOption = storageOption;
        if (needsInsurance !== undefined) updateData.needsInsurance = needsInsurance;
        if (needsPacking !== undefined) updateData.needsPacking = needsPacking;
        if (needsUnpacking !== undefined) updateData.needsUnpacking = needsUnpacking;
        if (needsBox !== undefined) updateData.needsBox = needsBox;
        if (clientNotes !== undefined) updateData.clientNotes = clientNotes;

        if (storageSizeLabel !== undefined) {
          updateData.storageSizeLabel = typeof storageSizeLabel === 'string' ? storageSizeLabel.slice(0, 100) : null;
        }
        if (storageSizeM2 !== undefined) {
          const s = parseFloat(storageSizeM2);
          updateData.storageSizeM2 = Number.isFinite(s) && s > 0 && s < 1000 ? s.toString() : null;
        }
        if (storageAccepted !== undefined) {
          updateData.storageAccepted = typeof storageAccepted === 'boolean' ? storageAccepted : null;
          updateData.storageAcceptedAt = storageAccepted === true ? new Date() : null;
        }
        if (storageContractStatus !== undefined) {
          updateData.storageContractStatus = storageEnumOrNull(storageContractStatus, storageContractStatuses);
        }
        if (storageRentalIntent !== undefined) {
          updateData.storageRentalIntent = storageEnumOrNull(storageRentalIntent, storageRentalIntents);
        }
        if (storageAvailabilityStatus !== undefined) {
          updateData.storageAvailabilityStatus = storageEnumOrNull(storageAvailabilityStatus, storageAvailabilityStatuses);
        }
        if (storageSelectedUnitCode !== undefined) {
          updateData.storageSelectedUnitCode = typeof storageSelectedUnitCode === "string" ? storageSelectedUnitCode.trim().slice(0, 100) : null;
        }
        if (storageSelectedUnitSnapshot !== undefined) {
          // Store a bounded, non-PII snapshot. Reservation URLs are rebuilt
          // server-side by the handoff endpoint and are never trusted here.
          updateData.storageSelectedUnitSnapshot = sanitizeUnitSnapshot(storageSelectedUnitSnapshot);
        }
        if (storageReservationStatus !== undefined) {
          updateData.storageReservationStatus = storageEnumOrNull(storageReservationStatus, storageReservationStatuses);
        }
        if (storageAvailabilityCheckedAt !== undefined) {
          updateData.storageAvailabilityCheckedAt = storageCheckedAtOrNull(storageAvailabilityCheckedAt);
        }
        if (manualReservationJourney && !validClaim && existingQuote.storageHandoffProvenance !== "ustorage_confirmed") {
          updateData.storageHandoffProvenance = "manual";
          if (storageRentalStart !== undefined) updateData.storageRentalStart = safeStorageRentalStart;
        }
        if (validClaim) {
          updateData.storageReservationStatus = "confirmed";
          updateData.storageHandoffProvenance = "ustorage_confirmed";
          updateData.storageReservationRefHash = hashReservationReference(validClaim.confirmation.reservationRef);
          updateData.storageRentalStart = validClaim.confirmation.rentalStart;
          updateData.storageVerifiedFields = ["status", "consent", "audience", "issuedAt", "expiresAt", "nonce", "redemptionRef", "branch"];
          updateData.storageRedemptionRef = validClaim.confirmation.redemptionRef;
          updateData.storageExchangeId = exchangeId;
        }

        // Update estimated cost from Clara if provided
        if (estimatedCost !== undefined) updateData.estimatedCost = estimatedCost.toString();
        if (estimatedCostHigh !== undefined) updateData.estimatedCostHigh = estimatedCostHigh.toString();
        if (estimatedCurrency !== undefined) updateData.estimatedCurrency = estimatedCurrency;
        
        // Update attribution fields (only on first save, don't overwrite existing)
        if (partner !== undefined) updateData.partner = partner;
        if (utmSource !== undefined) updateData.utmSource = utmSource;
        if (utmMedium !== undefined) updateData.utmMedium = utmMedium;
        if (utmCampaign !== undefined) updateData.utmCampaign = utmCampaign;
        if (utmTerm !== undefined) updateData.utmTerm = utmTerm;
        if (utmContent !== undefined) updateData.utmContent = utmContent;
        if (landingPage !== undefined) updateData.landingPage = landingPage;
        if (referrerUrl !== undefined) updateData.referrerUrl = referrerUrl;
        
        const quote = await storage.updateQuote(id, updateData);
        
        // Save inventory items if provided - only update if there are items to save
        // IMPORTANT: Skip empty arrays to prevent race conditions where early requests
        // with empty inventoryItems could arrive after later requests with actual items
        if (inventoryItems !== undefined && Array.isArray(inventoryItems) && inventoryItems.length > 0) {
          const totalQuantity = inventoryItems.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
          console.log(`[Inventory] Saving ${inventoryItems.length} line items (${totalQuantity} total quantity) for quote ${id}`);
          // Delete existing inventory items for this quote first
          await storage.deleteInventoryByQuote(id);
          
          // Add all new inventory items
          for (const item of inventoryItems) {
            await storage.addInventoryItem({
              quoteId: id,
              itemName: item.name,
              room: item.room || 'unassigned',
              category: item.category || null,
              quantity: item.quantity || 1,
              notes: item.notes || null,
            });
          }
          
          // CRITICAL: Recalculate estimate on server-side to ensure data integrity
          // This overrides any AI-provided estimates with authoritative server calculation
          if (inventoryItems.length > 0) {
            try {
              // Get location-based pricing
              const pricing = await storage.getResolvedPricing(fromAddress || quote?.originCity, 'MX');
              const categories = await storage.getInventoryCategories();
              const categoryWeights: Record<string, number> = {};
              const categoryVolumes: Record<string, number> = {};
              categories.forEach(c => {
                categoryWeights[c.key] = parseFloat(c.avgWeightKg?.toString() || '20');
                categoryVolumes[c.key] = parseFloat(c.avgVolumeM3?.toString() || '0.5');
              });

              // Get distance from quote or calculate it (use city's default as fallback)
              let quoteDistanceKm = pricing.defaultDistanceKm || 20;
              const quoteFromAddress = fromAddress || quote?.fromAddress;
              const quoteToAddress = toAddress || quote?.toAddress;
              
              if (quote?.estimatedDistanceKm) {
                quoteDistanceKm = parseFloat(quote.estimatedDistanceKm.toString());
              } else if (quoteFromAddress && quoteToAddress) {
                const distanceResult = await calculateDistance(quoteFromAddress, quoteToAddress);
                if (distanceResult.success) {
                  quoteDistanceKm = distanceResult.distanceKm;
                  await storage.updateQuote(id, {
                    estimatedDistanceKm: quoteDistanceKm.toString(),
                    distanceCalculatedAt: new Date(),
                  });
                }
              }

              // Calculate total weight and volume
              let totalWeight = 0;
              let totalVolume = 0;
              for (const item of inventoryItems) {
                const weight = item.estimatedWeightKg || categoryWeights[item.category] || 20;
                const volume = item.estimatedVolumeM3 || categoryVolumes[item.category] || 0.5;
                const qty = item.quantity || 1;
                totalWeight += weight * qty;
                totalVolume += volume * qty;
              }

              // Get usable volume helper
              const getUsableVolume = (truck: any) => {
                const capacityM3 = parseFloat(truck.capacityM3?.toString() || '0');
                const usableFactor = parseFloat(truck.usableVolumeFactor?.toString() || '0.85');
                return capacityM3 * usableFactor;
              };

              // Sort trucks and find optimal fleet
              const allTrucks = pricing.truckPricing.map((t: any) => ({
                ...t,
                usableVolume: getUsableVolume(t),
                weightCapacity: t.capacityKg || 0
              })).filter((t: any) => t.usableVolume > 0 || t.weightCapacity > 0);

              const trucksByVolumeAsc = [...allTrucks].sort((a, b) => a.usableVolume - b.usableVolume);
              const trucksByVolumeDesc = [...allTrucks].sort((a, b) => b.usableVolume - a.usableVolume);

              // Build fleet using greedy algorithm
              const buildFleetGreedy = (primaryTruck: any): any[] => {
                const fleet: any[] = [];
                let remVol = totalVolume;
                let remWeight = totalWeight;
                
                while (remVol > 0 || remWeight > 0) {
                  let finisherFound = false;
                  for (const truck of trucksByVolumeAsc) {
                    if (truck.usableVolume >= remVol && truck.weightCapacity >= remWeight) {
                      fleet.push(truck);
                      remVol = 0;
                      remWeight = 0;
                      finisherFound = true;
                      break;
                    }
                  }
                  if (finisherFound) break;
                  fleet.push(primaryTruck);
                  remVol -= primaryTruck.usableVolume;
                  remWeight -= primaryTruck.weightCapacity;
                }
                return fleet;
              };

              // Generate and score candidate fleets
              const candidateFleets: any[][] = [];
              for (const primaryTruck of trucksByVolumeDesc) {
                const fleet = buildFleetGreedy(primaryTruck);
                if (fleet.length > 0) candidateFleets.push(fleet);
              }
              for (const truck of allTrucks) {
                if (truck.usableVolume <= 0 && truck.weightCapacity <= 0) continue;
                const countByVol = truck.usableVolume > 0 ? Math.ceil(totalVolume / truck.usableVolume) : Infinity;
                const countByWeight = truck.weightCapacity > 0 ? Math.ceil(totalWeight / truck.weightCapacity) : Infinity;
                const count = Math.max(countByVol, countByWeight);
                if (count !== Infinity && count > 0 && count <= 10) {
                  candidateFleets.push(Array(count).fill(truck));
                }
              }

              // Calculate cost for fleet using actual distance
              const calculateTruckCost = (trucks: any[]) => {
                let totalCost = 0;
                let maxBaseHours = 0;
                for (const truck of trucks) {
                  const baseRate = parseFloat(truck.baseRate?.toString() || '1800');
                  const perKmRate = parseFloat(truck.perKmRate?.toString() || '10');
                  const baseHours = parseFloat(truck.baseServiceHours?.toString() || '3');
                  totalCost += baseRate + (quoteDistanceKm * perKmRate);
                  maxBaseHours = Math.max(maxBaseHours, baseHours);
                }
                return { totalCost, baseHours: maxBaseHours };
              };

              // Select best fleet
              let bestFleet: any[] = [];
              let bestScore = { count: Infinity, totalVol: Infinity, cost: Infinity };
              for (const fleet of candidateFleets) {
                const count = fleet.length;
                const totalVol = fleet.reduce((sum: number, t: any) => sum + t.usableVolume, 0);
                const { totalCost } = calculateTruckCost(fleet);
                if (count < bestScore.count ||
                    (count === bestScore.count && totalVol < bestScore.totalVol) ||
                    (count === bestScore.count && totalVol === bestScore.totalVol && totalCost < bestScore.cost)) {
                  bestScore = { count, totalVol, cost: totalCost };
                  bestFleet = fleet;
                }
              }

              const selectedTrucks = bestFleet.length > 0 ? bestFleet : (trucksByVolumeDesc[0] ? [trucksByVolumeDesc[0]] : []);
              const { totalCost: baseCost, baseHours } = calculateTruckCost(selectedTrucks);

              const calculatedLow = Math.round(baseCost);
              const complicatedMultiplier = parseFloat(pricing.complicatedMoveMultiplier?.toString() || '1.3');
              const calculatedHigh = Math.round(calculatedLow * complicatedMultiplier);

              // Build truck recommendation string
              const truckBreakdown = selectedTrucks.reduce((acc: any[], truck) => {
                const existing = acc.find(t => t.name === (truck.nameEs || truck.name));
                if (existing) existing.count++;
                else acc.push({ name: truck.nameEs || truck.name, count: 1 });
                return acc;
              }, []);
              const recommendedTruck = truckBreakdown.map(t => `${t.count}× ${t.name}`).join(' + ');

              // Update quote with authoritative server-calculated cost values
              // Note: Weight and truck are recalculated from inventory items at display time
              console.log(`[Quote] Server recalculation: ${totalWeight.toFixed(0)}kg, ${totalVolume.toFixed(2)}m³, ${recommendedTruck}, $${calculatedLow}-$${calculatedHigh}`);
              await storage.updateQuote(id, {
                estimatedCost: calculatedLow.toString(),
                estimatedCostHigh: calculatedHigh.toString(),
                estimatedCurrency: pricing.currency || 'MXN',
              });
            } catch (calcError) {
              console.error('[Quote] Server-side recalculation failed:', calcError);
              // Continue without updating estimates - better to have AI estimate than none
            }
          }
        } else {
          console.log(`[Inventory] No inventory items in request for quote ${id}`);
        }
        
        // Auto-link any calculation logs from this session to the quote (on UPDATE too)
        if (quoteSessionId && quote) {
          try {
            const calculationLogs = await storage.getCalculationLogsBySessionId(quoteSessionId);
            const unlinkedLogs = calculationLogs.filter((log: any) => !log.details?.linkedQuoteId);
            if (unlinkedLogs.length > 0) {
              console.log(`[Quote] Linking ${unlinkedLogs.length} calculations with session ${quoteSessionId} to quote ${quote.quoteNumber}`);
              for (const log of unlinkedLogs) {
                await storage.updateActivityLogDetails(log.id, {
                  linkedQuoteId: quote.id,
                  linkedQuoteNumber: quote.quoteNumber,
                  linkedAt: new Date().toISOString(),
                  autoLinked: true,
                });
              }
            }
          } catch (linkError) {
            console.error('[Quote] Failed to auto-link calculations on update:', linkError);
          }
        }
        
        // Re-fetch the quote to get the updated values
        const finalQuote = await storage.getQuote(id);
        // Capture CRM context only after inventory and authoritative estimates
        // are persisted so the durable outbox snapshot cannot lag this save.
        if (finalQuote && isMirroredPartner(finalQuote.partner)) {
          enqueueCrmLead(
            finalQuote,
            storageAccepted === true ? 'storage.accepted' : 'lead.updated',
          );
        }
        res.json({ quote: finalQuote });
      } else {
        // IDEMPOTENCY CHECK: If quoteSessionId is provided, check if a quote already exists for this session
        // This prevents duplicate quotes when the client loses the partialQuoteId but retains the session
        if (quoteSessionId) {
          const existingQuoteBySession = await storage.getQuoteBySessionId(quoteSessionId);
          if (existingQuoteBySession) {
            console.log(`[Quote] Found existing quote ${existingQuoteBySession.quoteNumber} for session ${quoteSessionId}, updating instead of creating new`);
            // Redirect to update flow - call this endpoint recursively with the ID
            req.body.id = existingQuoteBySession.id;
            // Re-process as an update
            const updateData: any = {
              fromAddress,
              toAddress,
              ...dateUpdateFields,
              homeSize,
              ...branchSelection,
            };
            if (contactName !== undefined) updateData.contactName = contactName;
            if (contactEmail !== undefined) updateData.contactEmail = contactEmail;
            if (contactPhone !== undefined) updateData.contactPhone = contactPhone;
            if (storageOption !== undefined) updateData.storageOption = storageOption;
            if (needsInsurance !== undefined) updateData.needsInsurance = needsInsurance;
            if (needsPacking !== undefined) updateData.needsPacking = needsPacking;
            if (needsUnpacking !== undefined) updateData.needsUnpacking = needsUnpacking;
            if (needsBox !== undefined) updateData.needsBox = needsBox;
            if (clientNotes !== undefined) updateData.clientNotes = clientNotes;
            if (storageContractStatus !== undefined) updateData.storageContractStatus = storageEnumOrNull(storageContractStatus, storageContractStatuses);
            if (storageRentalIntent !== undefined) updateData.storageRentalIntent = storageEnumOrNull(storageRentalIntent, storageRentalIntents);
            if (storageAvailabilityStatus !== undefined) updateData.storageAvailabilityStatus = storageEnumOrNull(storageAvailabilityStatus, storageAvailabilityStatuses);
            if (storageSelectedUnitCode !== undefined) updateData.storageSelectedUnitCode = typeof storageSelectedUnitCode === "string" ? storageSelectedUnitCode.trim().slice(0, 100) : null;
            if (storageSelectedUnitSnapshot !== undefined) updateData.storageSelectedUnitSnapshot = sanitizeUnitSnapshot(storageSelectedUnitSnapshot);
            if (storageReservationStatus !== undefined) updateData.storageReservationStatus = storageEnumOrNull(storageReservationStatus, storageReservationStatuses);
            if (storageAvailabilityCheckedAt !== undefined) updateData.storageAvailabilityCheckedAt = storageCheckedAtOrNull(storageAvailabilityCheckedAt);
             if (manualReservationJourney && !validClaim && existingQuoteBySession.storageHandoffProvenance !== "ustorage_confirmed") {
               updateData.storageHandoffProvenance = "manual";
               if (storageRentalStart !== undefined) updateData.storageRentalStart = safeStorageRentalStart;
             }
             if (validClaim) {
               updateData.storageReservationStatus = "confirmed";
               updateData.storageHandoffProvenance = "ustorage_confirmed";
               updateData.storageReservationRefHash = hashReservationReference(validClaim.confirmation.reservationRef);
               updateData.storageRentalStart = validClaim.confirmation.rentalStart;
               updateData.storageVerifiedFields = ["status", "consent", "audience", "issuedAt", "expiresAt", "nonce", "redemptionRef", "branch"];
               updateData.storageRedemptionRef = validClaim.confirmation.redemptionRef;
               updateData.storageExchangeId = exchangeId;
             }
            if (estimatedCost !== undefined) updateData.estimatedCost = estimatedCost.toString();
            if (estimatedCostHigh !== undefined) updateData.estimatedCostHigh = estimatedCostHigh.toString();
            if (estimatedCurrency !== undefined) updateData.estimatedCurrency = estimatedCurrency;
            
            const quote = await storage.updateQuote(existingQuoteBySession.id, updateData);
            return res.json({ quote });
          }
        }
        
        // Create new partial quote
        let userId = activeUserId;
        
        // For non-logged users, require at least email or phone to create placeholder user
        if (!userId) {
          if (!contactEmail && !contactPhone) {
            return res.status(400).json({ 
              message: "Contact email or phone is required to create a quote without logging in" 
            });
          }
          
          // Find or create a placeholder user
          const placeholderUser = await storage.findOrCreatePlaceholderUser(
            contactEmail || undefined,
            contactPhone || undefined,
            contactName || undefined
          );
          userId = placeholderUser.id;
        }
        
        // Ensure we always have a userId before creating the quote
        if (!userId) {
          return res.status(400).json({ 
            message: "Unable to link quote to a user" 
          });
        }
        
        const newQuote = await storage.createQuote({
          userId,
          fromAddress,
          toAddress,
          ...dateUpdateFields,
          homeSize: homeSize || "medium",
          isPartial: true,
          quoteSessionId: quoteSessionId || null, // Store session ID for idempotency
          contactName: contactName || null,
          contactEmail: contactEmail || null,
          contactPhone: contactPhone || null,
          storageContractStatus: storageEnumOrNull(storageContractStatus, storageContractStatuses),
          storageRentalIntent: storageEnumOrNull(storageRentalIntent, storageRentalIntents),
          storageAvailabilityStatus: storageEnumOrNull(storageAvailabilityStatus, storageAvailabilityStatuses),
          storageSelectedUnitCode: typeof storageSelectedUnitCode === "string" ? storageSelectedUnitCode.trim().slice(0, 100) : null,
          storageSelectedUnitSnapshot: sanitizeUnitSnapshot(storageSelectedUnitSnapshot),
          storageReservationStatus: storageEnumOrNull(storageReservationStatus, storageReservationStatuses) || "not_started",
           ...(manualReservationJourney && !validClaim ? {
             storageHandoffProvenance: "manual",
             storageRentalStart: safeStorageRentalStart,
           } : {}),
           ...(validClaim ? {
             storageReservationStatus: "confirmed",
             storageHandoffProvenance: "ustorage_confirmed",
             storageReservationRefHash: hashReservationReference(validClaim.confirmation.reservationRef),
             storageRentalStart: validClaim.confirmation.rentalStart,
             storageVerifiedFields: ["status", "consent", "audience", "issuedAt", "expiresAt", "nonce", "redemptionRef", "branch"],
             storageRedemptionRef: validClaim.confirmation.redemptionRef,
             storageExchangeId: exchangeId,
           } : {}),
          storageAvailabilityCheckedAt: storageCheckedAtOrNull(storageAvailabilityCheckedAt),
          clientNotes: clientNotes || null,
          partner: partner || null,
          utmSource: utmSource || null,
          utmMedium: utmMedium || null,
          utmCampaign: utmCampaign || null,
          utmTerm: utmTerm || null,
          utmContent: utmContent || null,
          landingPage: landingPage || null,
          referrerUrl: referrerUrl || null,
          ...branchSelection,
        });
        // Set workflow status after creation
        const quote = await storage.updateQuote(newQuote.id, { workflowStatus: 'intake' });
        
        // Mirror partner leads (e.g. u-storage) to their CRM via the outbox (never blocks/fails lead creation)
        if (isMirroredPartner(quote.partner)) {
          enqueueCrmLead(quote, 'lead.created');
        }
        
        // Auto-link any calculation logs from this session to the new quote
        if (quoteSessionId) {
          try {
            const calculationLogs = await storage.getCalculationLogsBySessionId(quoteSessionId);
            console.log(`[Quote] Found ${calculationLogs.length} calculations with session ${quoteSessionId} to auto-link to quote ${quote.id}`);
            for (const log of calculationLogs) {
              await storage.updateActivityLogDetails(log.id, {
                linkedQuoteId: quote.id,
                linkedQuoteNumber: quote.quoteNumber,
                linkedAt: new Date().toISOString(),
                autoLinked: true,
              });
            }
          } catch (linkError) {
            console.error('[Quote] Failed to auto-link calculations:', linkError);
          }
        }
        
        res.json({ quote });
      }
    } catch (error: any) {
      if (sendQuoteEligibilityError(res, error)) return;
      console.error("Partial quote error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Link an existing partial quote to a new user account
  app.post("/api/quotes/:id/link-user", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const quoteId = req.params.id;
      const { isPartial, quoteSessionId } = req.body;

      // Get the authenticated user's ID from session (don't trust userId from body)
      const activeUserId = getActiveUserId(req);

      if (!activeUserId) {
        return res.status(401).json({ message: "User not authenticated" });
      }

      // Verify the quote exists
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Only allow claiming a quote that is:
      //   (a) unclaimed (no userId), or
      //   (b) already owned by this user (re-entrant / idempotent), or
      //   (c) owned by a placeholder account (no password set) — the intended
      //       flow when a guest fills the wizard and then registers/logs in.
      //       In this case the caller must also prove session possession by
      //       supplying the quoteSessionId that was bound at quote creation.
      // Any other case is a hijacking attempt and must be rejected.
      if (quote.userId && quote.userId !== activeUserId) {
        const existingOwner = await storage.getUser(quote.userId);
        const isPlaceholder = existingOwner && !existingOwner.password;
        if (!isPlaceholder) {
          return res.status(403).json({ message: "Quote already belongs to another user" });
        }
        // Placeholder transfer: require the session token to prove the caller
        // was the browser session that originally created this quote.
        if (!quoteSessionId || quote.quoteSessionId !== quoteSessionId) {
          return res.status(403).json({ message: "Access denied: valid quote session required to claim this quote" });
        }
      }

      // Update the quote to link it to the authenticated user
      // Keep workflowStatus as 'intake' (displays as 'Recibido') - don't change to invalid status
      const updatedQuote = await storage.updateQuote(quoteId, {
        userId: activeUserId,
        isPartial: isPartial !== undefined ? isPartial : false,
        // Completed new dispatch submissions enter solicitation; drafts remain intake.
        ...(isPartial === false ? { workflowStatus: 'solicited', workflowMode: 'dispatch' } : {}),
      });

      console.log(`[Quote] Linked quote ${quoteId} to user ${activeUserId}`);
      if (quote.isPartial && updatedQuote.isPartial === false) {
        const user = await storage.getUser(activeUserId);
        const recipient = updatedQuote.contactEmail || user?.email;
        if (recipient) {
          const language = user?.preferredLanguage || "es";
          const moveDate = updatedQuote.moveDate
            ? new Date(updatedQuote.moveDate).toLocaleDateString(language === "en" ? "en-US" : "es-MX")
            : (language === "en" ? "To be confirmed" : "Por confirmar");
          const dashboardLink = `${req.protocol}://${req.get("host")}/dashboard`;
          sendQuoteConfirmationEmail(
            recipient,
            updatedQuote.contactName || user?.fullName || (language === "en" ? "Customer" : "Cliente"),
            updatedQuote.quoteNumber || updatedQuote.id,
            updatedQuote.fromAddress,
            updatedQuote.toAddress,
            moveDate,
            dashboardLink,
            language,
            getStorageMoveContext(updatedQuote),
          ).catch((error) => console.log("[EMAIL] Failed to send quote confirmation:", error.message));
        }
      }
      res.json({ quote: updatedQuote });
    } catch (error: any) {
      if (sendQuoteEligibilityError(res, error)) return;
      console.error("Link quote to user error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Calculate estimate based on inventory items (dual weight + volume estimation)
  app.post("/api/quotes/calculate-estimate", async (req: Request, res: Response) => {
    try {
      const { items, originCity, originCountry, quoteSessionId, fromAddress, toAddress, quoteId } = req.body;
      
      if (!items || !Array.isArray(items)) {
        return res.status(400).json({ message: "Items array is required" });
      }

      // Get location-based pricing first (to get city's default distance)
      const pricing = await storage.getResolvedPricing(originCity, originCountry);

      // Calculate distance from Google Maps if addresses provided, or use stored distance from quote
      let distanceKm = pricing.defaultDistanceKm; // Use city's configured default fallback
      let distanceSource = 'default';
      
      if (quoteId) {
        // Try to get stored distance from quote
        const quote = await storage.getQuote(quoteId);
        if (quote?.estimatedDistanceKm) {
          distanceKm = parseFloat(quote.estimatedDistanceKm.toString());
          distanceSource = 'stored';
          console.log(`[calculate-estimate] Using stored distance from quote: ${distanceKm}km`);
        } else {
          // Use quote addresses if available, otherwise use provided addresses
          const calcFromAddress = quote?.fromAddress || fromAddress;
          const calcToAddress = quote?.toAddress || toAddress;
          
          if (calcFromAddress && calcToAddress) {
            const distanceResult = await calculateDistance(calcFromAddress, calcToAddress);
            if (distanceResult.success) {
              distanceKm = distanceResult.distanceKm;
              distanceSource = 'google_maps';
              // Store the calculated distance on the quote
              await storage.updateQuote(quoteId, {
                estimatedDistanceKm: distanceKm.toString(),
                distanceCalculatedAt: new Date(),
              });
            } else {
              distanceSource = 'fallback';
            }
            console.log(`[calculate-estimate] Calculated distance for quote: ${distanceKm}km (${distanceSource})`);
          }
        }
      } else if (fromAddress && toAddress) {
        // Calculate distance live from provided addresses (no quote to store on)
        const distanceResult = await calculateDistance(fromAddress, toAddress);
        if (distanceResult.success) {
          distanceKm = distanceResult.distanceKm;
          distanceSource = 'google_maps';
        } else {
          distanceSource = 'fallback';
        }
        console.log(`[calculate-estimate] Live distance calculation: ${distanceKm}km (${distanceSource})`);
      }
      
      // Debug logging for truck pricing data
      console.log('[calculate-estimate] Pricing source:', pricing.source, 'City:', originCity);
      console.log('[calculate-estimate] Truck pricing data:', pricing.truckPricing.map((t: any) => ({
        name: t.name,
        capacityKg: t.capacityKg,
        capacityM3: t.capacityM3,
        usableVolumeFactor: t.usableVolumeFactor,
        usableVolumeCalc: parseFloat(t.capacityM3?.toString() || '0') * parseFloat(t.usableVolumeFactor?.toString() || '0.85'),
        baseServiceHours: t.baseServiceHours,
        includedMovers: t.includedMovers
      })));
      
      // Get inventory categories for weight and volume lookup
      const categories = await storage.getInventoryCategories();
      const categoryWeights: Record<string, number> = {};
      const categoryVolumes: Record<string, number> = {};
      categories.forEach(c => {
        categoryWeights[c.key] = parseFloat(c.avgWeightKg?.toString() || '20');
        categoryVolumes[c.key] = parseFloat(c.avgVolumeM3?.toString() || '0.5');
      });

      // Calculate total weight and volume from items
      let totalWeight = 0;
      let totalVolume = 0;
      for (const item of items) {
        const weight = item.estimatedWeightKg || categoryWeights[item.category] || 20;
        const volume = item.estimatedVolumeM3 || categoryVolumes[item.category] || 0.5;
        const qty = item.quantity || 1;
        totalWeight += weight * qty;
        totalVolume += volume * qty;
      }

      // Sort trucks by capacity ascending
      const sortedTrucks = [...pricing.truckPricing].sort((a, b) => a.capacityKg - b.capacityKg);
      const largestTruck = sortedTrucks[sortedTrucks.length - 1];

      // Helper: Get usable volume (apply usable factor, default 0.85)
      const getUsableVolume = (truck: any) => {
        const capacityM3 = parseFloat(truck.capacityM3?.toString() || '0');
        const usableFactor = parseFloat(truck.usableVolumeFactor?.toString() || '0.85');
        return capacityM3 * usableFactor;
      };

      // Get city-level mover rates for labor calculations
      const moverHourlyRate = parseFloat(pricing.moverHourlyRate?.toString() || '150');

      // Helper: Calculate cost for a truck combination
      const calculateTruckCost = (trucks: any[], distanceKm: number) => {
        let baseTruckCost = 0;
        let totalMovers = 0;
        let maxBaseHours = 0;
        
        // First pass: find max base hours and calculate base costs
        for (const truck of trucks) {
          const baseHours = parseFloat(truck.baseServiceHours?.toString() || '3');
          maxBaseHours = Math.max(maxBaseHours, baseHours);
        }
        
        // Second pass: calculate costs with hour synchronization
        let extraTruckHoursCost = 0;
        let extraMoverLaborCost = 0;
        const truckCostDetails: any[] = [];
        
        for (const truck of trucks) {
          const baseRate = parseFloat(truck.baseRate?.toString() || '1800');
          const perKmRate = parseFloat(truck.perKmRate?.toString() || '10');
          const hourlyRate = parseFloat(truck.hourlyRate?.toString() || '300');
          const baseHours = parseFloat(truck.baseServiceHours?.toString() || '3');
          const includedMovers = truck.includedMovers || 2;
          
          // Base cost (includes baseServiceHours of work)
          const truckBaseCost = baseRate + (distanceKm * perKmRate);
          baseTruckCost += truckBaseCost;
          totalMovers += includedMovers;
          
          // Calculate extra hours this truck needs to work to sync with longest job
          const extraHours = maxBaseHours - baseHours;
          
          // Extra truck hours cost (truck hourly rate for keeping the truck)
          const truckExtraHoursCost = extraHours > 0 ? extraHours * hourlyRate : 0;
          extraTruckHoursCost += truckExtraHoursCost;
          
          // Extra mover labor cost (mover hourly rate × movers × extra hours)
          // Trucks with 0 movers (self-service) have no mover labor to charge
          const moverExtraHoursCost = extraHours > 0 ? extraHours * moverHourlyRate * includedMovers : 0;
          extraMoverLaborCost += moverExtraHoursCost;
          
          truckCostDetails.push({
            name: truck.nameEs || truck.name,
            baseRate,
            perKmRate,
            hourlyRate,
            baseHours,
            extraHours,
            truckExtraHoursCost,
            moverExtraHoursCost,
            includedMovers,
            moverHourlyRate,
            distanceKm,
            subtotal: truckBaseCost + truckExtraHoursCost + moverExtraHoursCost
          });
        }
        
        const extraHoursCost = extraTruckHoursCost + extraMoverLaborCost;
        const totalCost = baseTruckCost + extraHoursCost;
        
        return { 
          totalCost, 
          totalMovers, 
          baseHours: maxBaseHours, 
          extraHoursCost,
          extraTruckHoursCost,
          extraMoverLaborCost,
          truckCostDetails 
        };
      };

      // === OPTIMAL TRUCK COMBINATION SELECTION ===
      // Priority: 1. Fewest trucks, 2. Smallest total capacity, 3. Lowest cost
      // Algorithm: Generate candidate fleets, pick best by priority
      
      let selectedTrucks: any[] = [];
      let constrainingFactor: 'weight' | 'volume' = 'volume';
      
      // Sort trucks by combined capacity score (volume + normalized weight)
      const allTrucks = pricing.truckPricing.map((t: any) => ({
        ...t,
        usableVolume: getUsableVolume(t),
        weightCapacity: t.capacityKg || 0
      })).filter((t: any) => t.usableVolume > 0 || t.weightCapacity > 0);
      
      // Sort by volume ascending for finding smallest fits
      const trucksByVolumeAsc = [...allTrucks].sort((a, b) => a.usableVolume - b.usableVolume);
      // Sort by volume descending for greedy filling
      const trucksByVolumeDesc = [...allTrucks].sort((a, b) => b.usableVolume - a.usableVolume);
      
      // Helper: Build a fleet using greedy algorithm starting with a specific truck type
      const buildFleetGreedy = (primaryTruck: any): any[] => {
        const fleet: any[] = [];
        let remVol = totalVolume;
        let remWeight = totalWeight;
        
        while (remVol > 0 || remWeight > 0) {
          // First check if any single truck can cover the remainder
          let finisherFound = false;
          for (const truck of trucksByVolumeAsc) {
            if (truck.usableVolume >= remVol && truck.weightCapacity >= remWeight) {
              fleet.push(truck);
              remVol = 0;
              remWeight = 0;
              finisherFound = true;
              break;
            }
          }
          if (finisherFound) break;
          
          // No single truck covers remainder, add the primary (large) truck
          fleet.push(primaryTruck);
          remVol -= primaryTruck.usableVolume;
          remWeight -= primaryTruck.weightCapacity;
        }
        return fleet;
      };
      
      // Generate candidate fleets: try each large truck as the primary
      const candidateFleets: any[][] = [];
      
      for (const primaryTruck of trucksByVolumeDesc) {
        const fleet = buildFleetGreedy(primaryTruck);
        if (fleet.length > 0) {
          candidateFleets.push(fleet);
        }
      }
      
      // Also try: uniform fleets of same truck type
      for (const truck of allTrucks) {
        if (truck.usableVolume <= 0 && truck.weightCapacity <= 0) continue;
        const countByVol = truck.usableVolume > 0 ? Math.ceil(totalVolume / truck.usableVolume) : Infinity;
        const countByWeight = truck.weightCapacity > 0 ? Math.ceil(totalWeight / truck.weightCapacity) : Infinity;
        const count = Math.max(countByVol, countByWeight);
        if (count !== Infinity && count > 0 && count <= 10) { // Sanity limit
          const fleet = Array(count).fill(truck);
          candidateFleets.push(fleet);
        }
      }
      
      // Score and select best fleet: 1. Fewest trucks, 2. Smallest total volume, 3. Lowest cost
      let bestFleet: any[] = [];
      let bestScore = { count: Infinity, totalVol: Infinity, cost: Infinity };
      
      for (const fleet of candidateFleets) {
        const count = fleet.length;
        const totalVol = fleet.reduce((sum: number, t: any) => sum + t.usableVolume, 0);
        const { totalCost } = calculateTruckCost(fleet, distanceKm);
        
        // Compare by priority: count first, then volume, then cost
        if (count < bestScore.count ||
            (count === bestScore.count && totalVol < bestScore.totalVol) ||
            (count === bestScore.count && totalVol === bestScore.totalVol && totalCost < bestScore.cost)) {
          bestScore = { count, totalVol, cost: totalCost };
          bestFleet = fleet;
        }
      }
      
      selectedTrucks = bestFleet.length > 0 ? bestFleet : (trucksByVolumeDesc[0] ? [trucksByVolumeDesc[0]] : []);
      
      // Debug logging for fleet selection
      console.log('[calculate-estimate] Load requirements:', { totalWeight, totalVolume });
      console.log('[calculate-estimate] Available trucks with volumes:', allTrucks.map((t: any) => ({
        name: t.name, usableVolume: t.usableVolume, weightCapacity: t.weightCapacity
      })));
      console.log('[calculate-estimate] Selected fleet:', selectedTrucks.map((t: any) => t.name));
      console.log('[calculate-estimate] Candidate fleets count:', candidateFleets.length, 'Best score:', bestScore);
      
      // Determine constraining factor
      const fleetTotalVolume = selectedTrucks.reduce((sum: number, t: any) => sum + (t.usableVolume || getUsableVolume(t)), 0);
      const fleetTotalWeight = selectedTrucks.reduce((sum: number, t: any) => sum + (t.weightCapacity || t.capacityKg || 0), 0);
      const volumeUtilization = totalVolume / fleetTotalVolume;
      const weightUtilization = totalWeight / fleetTotalWeight;
      constrainingFactor = volumeUtilization >= weightUtilization ? 'volume' : 'weight';

      // Calculate final costs and details from selected trucks
      const { totalCost: baseCost, totalMovers, baseHours, extraHoursCost, extraTruckHoursCost, extraMoverLaborCost, truckCostDetails } = calculateTruckCost(selectedTrucks, distanceKm);
      
      // Debug: Log cost calculation results
      console.log('[calculate-estimate] Cost calculation result:', {
        baseHours,
        extraHoursCost,
        extraTruckHoursCost,
        extraMoverLaborCost,
        truckCostDetails: truckCostDetails.map(t => ({
          name: t.name,
          baseHours: t.baseHours,
          extraHours: t.extraHours,
          truckExtraHoursCost: t.truckExtraHoursCost,
          moverExtraHoursCost: t.moverExtraHoursCost
        }))
      });
      
      const totalLow = baseCost;
      const complicatedMultiplier = parseFloat(pricing.complicatedMoveMultiplier?.toString() || '1.3');
      const totalHigh = totalLow * complicatedMultiplier;

      // Calculate total item count
      const totalItemCount = items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
      
      // Calculate total usable volume of all selected trucks
      const truckUsableVolumeM3 = selectedTrucks.reduce((sum, t) => sum + getUsableVolume(t), 0);

      // Build truck breakdown for response
      const truckBreakdown = selectedTrucks.reduce((acc: any[], truck) => {
        const existing = acc.find(t => t.name === (truck.nameEs || truck.name));
        if (existing) {
          existing.count++;
        } else {
          acc.push({
            name: truck.nameEs || truck.name,
            count: 1,
            capacityKg: truck.capacityKg,
            capacityM3: getUsableVolume(truck)
          });
        }
        return acc;
      }, []);

      const result = {
        estimatedCost: {
          low: Math.round(totalLow),
          high: Math.round(totalHigh),
          currency: pricing.currency || 'MXN'
        },
        truckRecommendation: {
          totalWeightKg: Math.round(totalWeight),
          totalVolumeM3: Math.round(totalVolume * 100) / 100,
          truckUsableVolumeM3: Math.round(truckUsableVolumeM3 * 100) / 100,
          totalItemCount,
          recommendedTruck: truckBreakdown.map(t => `${t.count}x ${t.name}`).join(' + '),
          truckBreakdown,
          truckCount: selectedTrucks.length,
          includedMovers: totalMovers,
          estimatedHours: Math.round(baseHours * 10) / 10,
          constrainingFactor,
          weightBasedTruckCount: selectedTrucks.length,
          volumeBasedTruckCount: selectedTrucks.length
        },
        distanceKm,
        distanceSource,
        distanceNote: distanceSource === 'google_maps' ? `Actual route distance from Google Maps` : 
                      distanceSource === 'stored' ? `Stored route distance` : 
                      "Distance estimated at 20km - actual may vary"
      };

      // Build pricing breakdown for transparency
      const pricingBreakdown = {
        baseTruckCost: Math.round(baseCost - extraHoursCost), // Base cost without extra hours
        extraHoursCost: Math.round(extraHoursCost), // Total cost for synchronizing hours
        extraTruckHoursCost: Math.round(extraTruckHoursCost), // Extra truck rental hours
        extraMoverLaborCost: Math.round(extraMoverLaborCost), // Extra mover labor costs
        synchronizedHours: baseHours, // All trucks work this many hours
        moverHourlyRate, // City-level mover hourly rate used
        baseTruckCostDetails: truckCostDetails.map(t => ({
          name: t.name,
          baseRate: t.baseRate,
          perKmRate: t.perKmRate,
          hourlyRate: t.hourlyRate,
          baseHours: t.baseHours,
          extraHours: t.extraHours,
          truckExtraHoursCost: Math.round(t.truckExtraHoursCost),
          moverExtraHoursCost: Math.round(t.moverExtraHoursCost),
          includedMovers: t.includedMovers,
          moverHourlyRate: t.moverHourlyRate,
          distanceKm: t.distanceKm,
          subtotal: Math.round(t.subtotal)
        })),
        subtotalBeforeMarkup: Math.round(totalLow),
        lowMarkupMultiplier: 1.0,
        highMarkupMultiplier: complicatedMultiplier,
        finalLowEstimate: Math.round(totalLow),
        finalHighEstimate: Math.round(totalHigh),
        currency: pricing.currency || 'MXN'
      };

      // Log calculation to activity_logs for debugging
      try {
        await storage.logActivity({
          action: 'estimate.calculated',
          entityType: 'calculation',
          details: {
            quoteSessionId: quoteSessionId || null,
            input: { 
              originCity, 
              originCountry, 
              itemCount: items.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0),
              lineItems: items.length,
              fromAddress: fromAddress || null,
              toAddress: toAddress || null,
            },
            distance: {
              km: distanceKm,
              source: distanceSource,
            },
            pricingSource: pricing.source,
            truckData: pricing.truckPricing.map((t: any) => ({
              name: t.name,
              capacityKg: t.capacityKg,
              capacityM3: t.capacityM3,
              usableVolumeFactor: t.usableVolumeFactor,
              usableVolumeCalc: parseFloat(t.capacityM3?.toString() || '0') * parseFloat(t.usableVolumeFactor?.toString() || '0.85')
            })),
            loadRequirements: { totalWeight, totalVolume },
            availableTrucks: allTrucks.map((t: any) => ({
              name: t.name, usableVolume: t.usableVolume, weightCapacity: t.weightCapacity
            })),
            selectedFleet: selectedTrucks.map((t: any) => t.name),
            candidateFleetsCount: candidateFleets.length,
            bestScore,
            pricingBreakdown,
            result: {
              recommendedTruck: result.truckRecommendation.recommendedTruck,
              truckCount: result.truckRecommendation.truckCount,
              constrainingFactor: result.truckRecommendation.constrainingFactor,
              estimatedCost: result.estimatedCost
            }
          }
        });
      } catch (logError) {
        console.error('[calculate-estimate] Failed to log calculation:', logError);
      }

      res.json(result);
    } catch (error: any) {
      console.error("Calculate estimate error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's quotes
  app.get("/api/quotes/user/:userId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const activeUserId = getActiveUserId(req);

      if (!activeUserId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      // Caller may only fetch their own quotes unless they are an admin
      if (activeUserId !== userId) {
        const hasAdminRole = await storage.hasRole(activeUserId, 'admin');
        const callerUser = await storage.getUser(activeUserId);
        if (!hasAdminRole && callerUser?.userType !== 'admin') {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const quotes = await storage.getQuotesByUser(userId);
      res.json({ quotes });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get quote by ID
  app.get("/api/quotes/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const activeUserId = getActiveUserId(req);

      if (!activeUserId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Verify ownership or admin access
      const isOwner = quote.userId === activeUserId;
      if (!isOwner) {
        const hasAdminRole = await storage.hasRole(activeUserId, 'admin');
        const callerUser = await storage.getUser(activeUserId);
        if (!hasAdminRole && callerUser?.userType !== 'admin') {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Get associated data
      const inventory = await storage.getInventoryByQuote(id);
      const selectedServices = await storage.getQuoteServices(id);
      const selectedAddOns = await storage.getQuoteAddOns(id);

      res.json({
        quote,
        inventory,
        services: selectedServices,
        addOns: selectedAddOns,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update quote (owner or admin only; admin-only fields are managed via /api/admin/quotes/*)
  app.patch("/api/quotes/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const activeUserId = getActiveUserId(req);

      if (!activeUserId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const existing = await storage.getQuote(id);
      if (!existing) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const isOwner = existing.userId === activeUserId;
      let isAdmin = false;
      if (!isOwner) {
        const hasAdminRole = await storage.hasRole(activeUserId, 'admin');
        const callerUser = await storage.getUser(activeUserId);
        isAdmin = hasAdminRole || callerUser?.userType === 'admin';
        if (!isAdmin) {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      // Non-admin callers may not touch privileged fields
      const ADMIN_ONLY_FIELDS = [
        'adminNotes', 'assignedMoverProfileId', 'suggestedPrice', 'finalPrice',
        'workflowStatus', 'biddingStatus', 'selectedBidId', 'partnerSelectedAt',
        'userId',
      ];
      if (!isAdmin) {
        for (const field of ADMIN_ONLY_FIELDS) {
          if (field in req.body) {
            return res.status(403).json({ message: `Field '${field}' can only be modified by admins` });
          }
        }
      }

      const branchSelection = endpointSelection(req.body);
      const {
        fromBranchId: _fromBranchId,
        toBranchId: _toBranchId,
        ...quoteUpdates
      } = req.body;
      const quote = await storage.updateQuote(id, { ...quoteUpdates, ...branchSelection });
      res.json({ quote });
    } catch (error: any) {
      if (sendQuoteEligibilityError(res, error)) return;
      res.status(500).json({ message: error.message });
    }
  });

  // ========== QUOTE PDF ROUTES ==========

  // Generate and save PDF for a quote
  app.post("/api/quotes/:id/pdf", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { language } = req.body;
      const activeUserId = getActiveUserId(req);

      if (!activeUserId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Verify ownership or admin access
      const isOwner = quote.userId === activeUserId;
      if (!isOwner) {
        const hasAdminRole = await storage.hasRole(activeUserId, 'admin');
        const callerUser = await storage.getUser(activeUserId);
        if (!hasAdminRole && callerUser?.userType !== 'admin') {
          return res.status(403).json({ message: "Not authorized to generate PDF for this quote" });
        }
      }
      
      const lang = language === 'en' ? 'en' : 'es';
      const doc = await saveQuotePdf(id, lang);
      
      res.json({ 
        success: true, 
        document: {
          id: doc.id,
          fileName: doc.fileName,
          mimeType: doc.mimeType,
          fileSize: doc.fileSize,
          version: doc.version,
          generatedAt: doc.generatedAt,
        }
      });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get list of PDF documents for a quote
  app.get("/api/quotes/:id/pdf", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);

      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const userRoles = await storage.getUserRoles(userId!);
      const isAdmin = userRoles.some(r => r.role === 'admin' && r.isActive);
      const isOwner = quote.userId === userId;

      if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: "Access denied" });
      }

      const documents = await storage.getQuoteDocuments(id);
      res.json({ 
        documents: documents.map(d => ({
          id: d.id,
          fileName: d.fileName,
          mimeType: d.mimeType,
          fileSize: d.fileSize,
          version: d.version,
          generatedAt: d.generatedAt,
        }))
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Download PDF document
  app.get("/api/quotes/:quoteId/pdf/:docId/download", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { quoteId, docId } = req.params;
      const userId = getUserId(req);
      
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Check authorization: user must be quote owner or admin
      const isOwner = quote.userId === userId;
      let isAdmin = false;
      if (userId) {
        const hasAdminRole = await storage.hasRole(userId, 'admin');
        const user = await storage.getUser(userId);
        isAdmin = hasAdminRole || user?.userType === 'admin';
      }
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to access this document" });
      }
      
      const doc = await storage.getQuoteDocument(docId);
      if (!doc || doc.quoteId !== quoteId) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (!doc.pdfData) {
        return res.status(404).json({ message: "PDF data not available" });
      }
      
      const pdfBuffer = getPdfBuffer(doc.pdfData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error downloading PDF:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Preview PDF (inline display)
  app.get("/api/quotes/:quoteId/pdf/:docId/preview", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { quoteId, docId } = req.params;
      const userId = getUserId(req);
      
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Check authorization: user must be quote owner or admin
      const isOwner = quote.userId === userId;
      let isAdmin = false;
      if (userId) {
        const hasAdminRole = await storage.hasRole(userId, 'admin');
        const user = await storage.getUser(userId);
        isAdmin = hasAdminRole || user?.userType === 'admin';
      }
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to access this document" });
      }
      
      const doc = await storage.getQuoteDocument(docId);
      if (!doc || doc.quoteId !== quoteId) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (!doc.pdfData) {
        return res.status(404).json({ message: "PDF data not available" });
      }
      
      const pdfBuffer = getPdfBuffer(doc.pdfData);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error previewing PDF:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate PDF on-the-fly (without saving)
  app.get("/api/quotes/:id/pdf/generate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const language = (req.query.language as string) === 'en' ? 'en' : 'es';
      const activeUserId = getActiveUserId(req);

      if (!activeUserId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Verify ownership or admin access
      const isOwner = quote.userId === activeUserId;
      if (!isOwner) {
        const hasAdminRole = await storage.hasRole(activeUserId, 'admin');
        const callerUser = await storage.getUser(activeUserId);
        if (!hasAdminRole && callerUser?.userType !== 'admin') {
          return res.status(403).json({ message: "Not authorized to access this PDF" });
        }
      }
      
      const pdfBuffer = await generateQuotePdf(id, language);
      const fileName = `Cotizacion_${quote.quoteNumber || quote.id}.pdf`;
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate PDF and send by email (requires authentication and authorization)
  app.post("/api/quotes/:id/pdf/send", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { email, language } = req.body;
      const userId = getUserId(req);
      
      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Check authorization: user must be quote owner or admin
      const isOwner = quote.userId === userId;
      let isAdmin = false;
      if (userId) {
        const hasAdminRole = await storage.hasRole(userId, 'admin');
        const user = await storage.getUser(userId);
        isAdmin = hasAdminRole || user?.userType === 'admin';
      }
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to send this quote" });
      }
      
      const targetEmail = email || quote.contactEmail;
      if (!targetEmail) {
        return res.status(400).json({ message: "No email address provided" });
      }

      if (isAdmin) {
        await assertQuoteOfferDeliverable(id);
      }
      
      const lang = language === 'en' ? 'en' : 'es';
      
      // Generate and save PDF
      const doc = await saveQuotePdf(id, lang);
      
      if (!doc.pdfData) {
        return res.status(500).json({ message: "Failed to generate PDF" });
      }
      
      // Get user name for personalization
      let recipientName = quote.contactName || '';
      if (quote.userId) {
        const user = await storage.getUser(quote.userId);
        if (user?.fullName) {
          recipientName = user.fullName;
        }
      }
      if (!recipientName) {
        recipientName = lang === 'es' ? 'Cliente' : 'Customer';
      }
      
      // Determine dashboard link
      const baseUrl = process.env.REPLIT_DEV_DOMAIN 
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : process.env.REPL_SLUG 
          ? `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`
          : 'https://ustoragego.com';
      const dashboardLink = `${baseUrl}/client/quotes/${id}`;
      
      // Send email with PDF attachment
      const success = await sendQuotePdfEmail(
        targetEmail,
        recipientName,
        quote.quoteNumber || id,
        doc.pdfData,
        doc.fileName,
        dashboardLink,
        lang,
        getStorageMoveContext(quote)
      );
      
      if (success) {
        if (isAdmin) {
          await markQuoteOfferDelivered({
            quoteId: id,
            actorId: userId || null,
            recipient: targetEmail,
          });
        }
        res.json({ 
          success: true, 
          message: lang === 'es' 
            ? `Cotización enviada a ${targetEmail}` 
            : `Quote sent to ${targetEmail}`,
          documentId: doc.id
        });
      } else {
        res.status(500).json({ message: "Failed to send email" });
      }
    } catch (error: any) {
      console.error('Error sending PDF email:', error);
      res.status(error?.status || 500).json({ message: error.message });
    }
  });

  // ========== SAVED ADDRESSES ROUTES ==========

  // Get user's saved addresses
  app.get("/api/addresses", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const addresses = await storage.getSavedAddresses(userId);
      res.json({ addresses });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create saved address
  app.post("/api/addresses", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const { label, fullAddress, city, state, zipCode, country } = req.body;
      const address = await storage.createSavedAddress({
        userId,
        label,
        fullAddress,
        city,
        state,
        zipCode,
        country,
      });
      res.json({ address });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update saved address - with ownership verification
  app.patch("/api/addresses/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      
      // Verify ownership
      const existingAddress = await storage.getSavedAddress(id);
      if (!existingAddress) {
        return res.status(404).json({ message: "Address not found" });
      }
      if (existingAddress.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { label, fullAddress, city, state, zipCode, country } = req.body;
      const address = await storage.updateSavedAddress(id, {
        label,
        fullAddress,
        city,
        state,
        zipCode,
        country,
      });
      res.json({ address });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete saved address - with ownership verification
  app.delete("/api/addresses/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      
      // Verify ownership
      const existingAddress = await storage.getSavedAddress(id);
      if (!existingAddress) {
        return res.status(404).json({ message: "Address not found" });
      }
      if (existingAddress.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      await storage.deleteSavedAddress(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Assisted sales quoting. This capability is deliberately narrower than the
  // quote module and never creates an account for walk-in/phone-only leads.
  const requireAssistedQuotes = requirePlatformPermission(PLATFORM_CAPABILITIES.ASSISTED_QUOTES);
  const assistedGuard = [isAuthenticated, requireAdmin, requirePlatformPermission("module:quotes"), requireAssistedQuotes] as any;
  const assistedEvent = (quoteId: string, actionType: string, actorId?: string, metadata: Record<string, unknown> = {}) =>
    storage.createQuoteActivityLog({ quoteId, actionType, actorType: "admin", actorId, description: actionType, metadata });
  app.get(["/api/admin/assisted-quotes/customers", "/api/admin/quotes/assisted/customers"], ...assistedGuard, async (req: Request, res: Response) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const email = normalizeEmail(req.query.email || query);
    const phone = normalizePhone(req.query.phone || query);
    if (query.length < 3 && !email && !phone) return res.status(400).json({ message: "Search query is required" });
    const normalizedQuery = query.toLocaleLowerCase();
    const allUsers = await storage.getAllUsers();
    const matches = allUsers.filter((user) => {
      if (user.userType !== "client") return false;
      const emailMatch = !!email && normalizeEmail(user.email) === email;
      const phoneMatch = !!phone && normalizePhone(user.phone) === phone;
      const nameMatch = normalizedQuery.length >= 3 && (user.fullName || "").toLocaleLowerCase().includes(normalizedQuery);
      return emailMatch || phoneMatch || nameMatch;
    }).map(({ password: _password, ...user }) => user);
    const exactMatches = matches.filter((user) =>
      (email && normalizeEmail(user.email) === email) || (phone && normalizePhone(user.phone) === phone),
    );
    res.json({ customers: matches, exactMatches });
  });

  app.get(["/api/admin/assisted-quotes/team-members", "/api/admin/quotes/assisted/team-members"], ...assistedGuard, async (_req: Request, res: Response) => {
    const users = await storage.getAllUsers();
    res.json({ teamMembers: users.filter((u: any) => u.userType === "admin").map(({ password: _password, ...u }: any) => u) });
  });

  app.patch(["/api/admin/assisted-quotes/drafts/:id/follow-up-owner", "/api/admin/quotes/assisted/drafts/:id/follow-up-owner"], ...assistedGuard, async (req: Request, res: Response) => {
    const quote = await storage.getQuote(req.params.id);
    const ownerId = typeof req.body?.followUpOwnerId === "string" ? req.body.followUpOwnerId : null;
    if (!quote || quote.quoteOrigin !== "assisted") return res.status(404).json({ message: "Assisted draft not found" });
    if (!ownerId) return res.status(400).json({ message: "followUpOwnerId is required" });
    const owner = await storage.getUser(ownerId);
    if (!owner || owner.userType !== "admin") return res.status(400).json({ message: "Follow-up owner must be an admin team member" });
    const previous = quote.followUpOwnerId;
    const updated = await storage.updateQuote(quote.id, { followUpOwnerId: ownerId });
    await assistedEvent(quote.id, previous ? "follow_up_reassigned" : "follow_up_assigned", getCallerUserId(req), { from: previous, to: ownerId });
    res.json({ quote: updated });
  });

  app.post(["/api/admin/assisted-quotes/drafts/:id/follow-ups", "/api/admin/quotes/assisted/drafts/:id/follow-ups"], ...assistedGuard, async (req: Request, res: Response) => {
    const quote = await storage.getQuote(req.params.id);
    if (!quote || quote.quoteOrigin !== "assisted") return res.status(404).json({ message: "Assisted quote not found" });
    if (quote.isPartial) return res.status(409).json({ message: "Submit the quote before recording follow-up" });
    const events = await storage.getQuoteActivityLog(quote.id);
    const isFirst = !events.some((event) => event.actionType === "first_follow_up_recorded");
    const actionType = isFirst ? "first_follow_up_recorded" : "follow_up_recorded";
    await assistedEvent(quote.id, actionType, getCallerUserId(req), {
      channel: typeof req.body?.channel === "string" ? req.body.channel : "unspecified",
    });
    res.status(201).json({ success: true, actionType });
  });

  app.get(["/api/admin/assisted-quotes/metrics", "/api/admin/quotes/assisted/metrics"], ...assistedGuard, async (_req: Request, res: Response) => {
    const quotes = (await storage.getAdminQuotesList()).filter((q: any) => q.quoteOrigin === "assisted");
    const durations = { startedToSubmittedMs: [] as number[], submittedToFirstFollowUpMs: [] as number[] };
    for (const quote of quotes) {
      const events = await storage.getQuoteActivityLog(quote.id);
      const started = events.find((e) => e.actionType === "assisted_started");
      const submitted = events.find((e) => e.actionType === "quote_submitted");
      const followUp = events.find((e) => e.actionType === "first_follow_up_recorded");
      if (started && submitted) durations.startedToSubmittedMs.push(new Date(submitted.createdAt).getTime() - new Date(started.createdAt).getTime());
      if (submitted && followUp) durations.submittedToFirstFollowUpMs.push(new Date(followUp.createdAt).getTime() - new Date(submitted.createdAt).getTime());
    }
    const average = (xs: number[]) => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    res.json({
      startedCount: quotes.length,
      submittedCount: durations.startedToSubmittedMs.length,
      firstFollowUpCount: durations.submittedToFirstFollowUpMs.length,
      startedToSubmitted: { count: durations.startedToSubmittedMs.length, averageMs: average(durations.startedToSubmittedMs) },
      submittedToFirstFollowUp: { count: durations.submittedToFirstFollowUpMs.length, averageMs: average(durations.submittedToFirstFollowUpMs) },
    });
  });

  app.get(["/api/admin/assisted-quotes/drafts", "/api/admin/quotes/assisted/drafts"], ...assistedGuard, async (_req: Request, res: Response) => {
    const quotes = (await storage.getAdminQuotesList()).filter((q: any) => q.quoteOrigin === "assisted" && q.isPartial);
    res.json({ drafts: quotes });
  });

  app.post(["/api/admin/assisted-quotes/drafts", "/api/admin/quotes/assisted/drafts"], ...assistedGuard, async (req: Request, res: Response) => {
    try {
      const actorId = getCallerUserId(req);
      const parsed = assistedQuoteDraftSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "Invalid assisted quote data", issues: parsed.error.issues });
      const body = parsed.data;
      const suppliedName = body.customerName || body.contactName;
      const suppliedEmail = body.customerEmail || body.contactEmail;
      const suppliedPhone = body.customerPhone || body.contactPhone;
      if (!suppliedName?.trim() || (!suppliedEmail && !suppliedPhone)) {
        return res.status(400).json({ message: "Customer name and at least one contact method are required" });
      }
      const selectedCustomerId = typeof body.customerId === "string" ? body.customerId : undefined;
      const existing = selectedCustomerId ? await storage.getUser(selectedCustomerId) : undefined;
      if (selectedCustomerId && (!existing || existing.userType !== "client")) return res.status(400).json({ message: "Customer not found" });
      const contactEmail = normalizeEmail(suppliedEmail ?? existing?.email);
      const contactPhone = normalizePhone(suppliedPhone ?? existing?.phone);
      const usersToCheck = (await storage.getAllUsers()).filter((user) => user.userType === "client");
      const duplicateMatches = usersToCheck
        .map((user) => duplicateMatch({ email: contactEmail, phone: contactPhone }, user))
        .filter((match) => match.email || match.phone);
      if (!existing && duplicateMatches.length > 0 && !body.confirmNewLead) {
        return res.status(409).json({ message: "Exact customer match found; associate it or confirm a new lead", duplicateMatches });
      }
      const quote = await storage.createQuote({
        userId: existing?.id,
        leadCustomerId: existing?.id,
        actingEmployeeId: actorId,
        createdByAdminId: actorId,
        followUpOwnerId: actorId,
        quoteOrigin: "assisted",
        contactName: suppliedName ?? existing?.fullName ?? null,
        contactEmail,
        contactPhone,
        isPartial: true,
        fromAddress: body.fromAddress || "Pending",
        toAddress: body.toAddress || "Pending",
        homeSize: body.homeSize || "Pending",
        storageOption: body.storageOption || "none",
        ...endpointSelection(body),
      }, { deferEligibility: true });
      await storage.createQuoteActivityLog({
        quoteId: quote.id, actionType: "assisted_draft_created", actorType: "admin",
        actorId, actorName: (req as any).dbUser?.fullName || undefined,
        description: "Assisted quote draft created", metadata: { duplicateMatches },
      });
      await assistedEvent(quote.id, "assisted_started", actorId);
      await assistedEvent(quote.id, existing ? "identity_associated" : "identity_selected", actorId, { matched: !!existing });
      await assistedEvent(quote.id, "draft_saved", actorId);
      res.status(201).json({ quote, duplicateMatches });
    } catch (error: any) {
      if (sendQuoteEligibilityError(res, error)) return;
      res.status(400).json({ message: error.message });
    }
  });

  app.get(["/api/admin/assisted-quotes/drafts/:id", "/api/admin/quotes/assisted/drafts/:id"], ...assistedGuard, async (req: Request, res: Response) => {
    const quote = await storage.getQuoteWithDetails(req.params.id);
    if (!quote || quote.quoteOrigin !== "assisted") return res.status(404).json({ message: "Assisted draft not found" });
    res.json({ quote });
  });

  app.patch(["/api/admin/assisted-quotes/drafts/:id", "/api/admin/quotes/assisted/drafts/:id"], ...assistedGuard, async (req: Request, res: Response) => {
    try {
      const actorId = getCallerUserId(req);
      const existing = await storage.getQuote(req.params.id);
      if (!existing || existing.quoteOrigin !== "assisted") return res.status(404).json({ message: "Assisted draft not found" });
      if (!existing.isPartial) return res.status(409).json({ message: "Quote is already finalized" });
      const parsed = assistedQuoteDraftSchema.safeParse(req.body || {});
      if (!parsed.success) return res.status(400).json({ message: "Invalid assisted quote data", issues: parsed.error.issues });
      const body = parsed.data;
      const allowed = [
        "fromAddress", "toAddress", "moveAvailabilityStart", "moveAvailabilityEnd",
        "preferredMoveDates", "blockedMoveDates", "homeSize", "storageOption",
        "needsInsurance", "needsPacking", "needsUnpacking", "needsBox", "clientNotes",
        "adminNotes", "estimatedCurrency", "partner", "utmSource", "utmMedium",
        "utmCampaign", "utmTerm", "utmContent", "landingPage", "referrerUrl",
        "storageSizeLabel", "storageAccepted", "storageContractStatus",
        "storageRentalIntent", "storageAvailabilityStatus", "storageSelectedUnitCode",
        "storageReservationStatus",
      ];
      const data: any = Object.fromEntries(Object.entries(body).filter(([key]) => allowed.includes(key)));
      if (body.moveDate !== undefined) data.moveDate = body.moveDate ? new Date(body.moveDate) : null;
      if (body.estimatedCost !== undefined) data.estimatedCost = body.estimatedCost?.toString() ?? null;
      if (body.estimatedCostHigh !== undefined) data.estimatedCostHigh = body.estimatedCostHigh?.toString() ?? null;
      if (body.storageSizeM2 !== undefined) data.storageSizeM2 = body.storageSizeM2?.toString() ?? null;
      if (body.storageSelectedUnitSnapshot !== undefined) data.storageSelectedUnitSnapshot = sanitizeUnitSnapshot(body.storageSelectedUnitSnapshot);
      if (body.storageAvailabilityCheckedAt !== undefined) data.storageAvailabilityCheckedAt = storageCheckedAtOrNull(body.storageAvailabilityCheckedAt);
      Object.assign(data, endpointSelection(body));
      Object.assign(data, {
        actingEmployeeId: existing.actingEmployeeId || actorId,
        contactName: body.customerName ?? body.contactName,
        contactEmail: body.customerEmail !== undefined || body.contactEmail !== undefined
          ? normalizeEmail(body.customerEmail ?? body.contactEmail) : undefined,
        contactPhone: body.customerPhone !== undefined || body.contactPhone !== undefined
          ? normalizePhone(body.customerPhone ?? body.contactPhone) : undefined,
      });
      for (const key of Object.keys(data)) if (data[key] === undefined) delete data[key];
      const quote = await storage.updateQuote(existing.id, data);
      if (body.inventoryItems !== undefined) {
        await storage.deleteInventoryByQuote(existing.id);
        for (const item of body.inventoryItems) {
          await storage.addInventoryItem({
            quoteId: existing.id,
            itemName: item.name,
            room: item.room || "unassigned",
            category: item.category || null,
            quantity: item.quantity,
            notes: item.notes || null,
          });
        }
      }
      await storage.createQuoteActivityLog({
        quoteId: quote.id, actionType: "assisted_draft_updated", actorType: "admin", actorId,
        description: "Assisted quote draft updated", metadata: { fields: Object.keys(data) },
      });
      await assistedEvent(quote.id, "draft_saved", actorId, { fields: Object.keys(data) });
      res.json({ quote });
    } catch (error: any) {
      if (sendQuoteEligibilityError(res, error)) return;
      res.status(400).json({ message: error.message });
    }
  });

  app.post(["/api/admin/assisted-quotes/drafts/:id/resume", "/api/admin/quotes/assisted/drafts/:id/resume"], ...assistedGuard, async (req: Request, res: Response) => {
    const quote = await storage.getQuoteWithDetails(req.params.id);
    if (!quote || quote.quoteOrigin !== "assisted") return res.status(404).json({ message: "Assisted draft not found" });
    await storage.createQuoteActivityLog({
      quoteId: quote.id, actionType: "assisted_draft_resumed", actorType: "admin", actorId: getCallerUserId(req),
      description: "Assisted quote draft resumed",
    });
    res.json({ quote });
  });

  app.post(["/api/admin/assisted-quotes/drafts/:id/finalize", "/api/admin/quotes/assisted/drafts/:id/finalize"], ...assistedGuard, async (req: Request, res: Response) => {
    try {
      const quote = await storage.getQuote(req.params.id);
      if (!quote || quote.quoteOrigin !== "assisted") return res.status(404).json({ message: "Assisted draft not found" });
      if (!quote.isPartial) return res.json({ quote });
      if (!quote.contactName || (!quote.contactEmail && !quote.contactPhone)) {
        return res.status(400).json({ message: "Customer name and contact method are required" });
      }
      if (!quote.fromAddress || quote.fromAddress === "Pending" || !quote.toAddress || quote.toAddress === "Pending" || !quote.moveAvailabilityStart || !quote.moveAvailabilityEnd) {
        return res.status(400).json({ message: "Complete route and availability before submitting" });
      }
      const finalized = await storage.updateQuote(quote.id, { isPartial: false, workflowStatus: "intake" });
      await storage.createQuoteActivityLog({
        quoteId: quote.id, actionType: "assisted_draft_finalized", actorType: "admin", actorId: getCallerUserId(req),
        description: "Assisted quote finalized",
      });
      await assistedEvent(quote.id, "quote_submitted", getCallerUserId(req));
      res.json({ quote: finalized });
    } catch (error: any) {
      if (sendQuoteEligibilityError(res, error)) return;
      res.status(400).json({ message: error.message });
    }
  });

  // Get all quotes (admin) - basic list
  app.get("/api/admin/quotes", isAuthenticated, requireAdmin, requirePlatformPermission("module:quotes"), async (req: Request, res: Response) => {
    try {
      const { status } = req.query;
      const quotes = await storage.getAdminQuotesList(status as string | undefined);
      res.json({ quotes });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/quotes/export.csv", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const status = typeof req.query.status === "string" && req.query.status !== "all"
        ? req.query.status
        : undefined;
      const quotes = await storage.getAdminQuotesList(status);
      const csv = quoteOperationsCsv(quotes);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="quote-operations-${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(`\uFEFF${csv}`);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create quote (admin) - manually add a quote request
  app.post("/api/admin/quotes", isAuthenticated, requireAdmin, requirePlatformPermission("module:quotes"), async (req: Request, res: Response) => {
    try {
      assertNoDerivedEligibilityFields(req.body);
      const branchSelection = endpointSelection(req.body);
      const { customerName, customerEmail, customerPhone, fromAddress, toAddress, moveDate, homeSize, storageOption, notes } = req.body;
      
      // Create or find user for this quote
      let userId: string | undefined;
      if (customerEmail) {
        let user = await storage.getUserByEmail(customerEmail);
        if (!user) {
          user = await storage.createUser({
            email: customerEmail,
            fullName: customerName,
            phone: customerPhone,
            userType: 'client',
          });
        }
        userId = user.id;
      }

      const quote = await storage.createQuote({
        userId,
        createdByAdminId: getCallerUserId(req),
        followUpOwnerId: getCallerUserId(req),
        fromAddress,
        toAddress,
        moveDate: moveDate ? new Date(moveDate) : null,
        homeSize,
        storageOption: storageOption || 'none',
        ...branchSelection,
      });

      // Add admin notes if provided
      if (notes) {
        await storage.updateQuoteWorkflow(quote.id, { adminNotes: notes }, getUserId(req), 'Quote created manually by admin');
      }

      res.json({ quote, success: true });
    } catch (error: any) {
      if (sendQuoteEligibilityError(res, error)) return;
      console.error("Error creating quote:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all users (admin) - for client reassignment dropdown
  app.get("/api/admin/users", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const users = await storage.getAllUsers();
      // Filter to only return clients (users with client role or userType)
      const allRoles = await storage.getUserRolesByUserIds(users.map(u => u.id));
      const clientUsers = users.filter(user => {
        const userRoles = allRoles.filter(r => r.userId === user.id && r.isActive);
        return user.userType === 'client' || userRoles.some(r => r.role === 'client');
      });
      
      // Get last activity for all users
      const lastActiveMap = await storage.getLastActiveByUserIds(clientUsers.map(u => u.id));
      
      // Don't include passwords in response, add lastActiveAt
      const safeUsers = clientUsers.map(({ password, ...rest }) => ({
        ...rest,
        lastActiveAt: lastActiveMap.get(rest.id)?.toISOString() || rest.lastLoginAt || rest.createdAt,
      }));
      res.json({ users: safeUsers });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create user (admin)
  app.post("/api/admin/users", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { fullName, email, phone, userType } = req.body;

      if (!email || !fullName) {
        return res.status(400).json({ message: "Email and full name are required" });
      }

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      const user = await storage.createUser({
        email,
        fullName,
        phone,
        userType: userType || 'client',
      });

      res.json({ user, success: true });
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get single user details (admin)
  app.get("/api/admin/users/:userId", isAuthenticated, requireAdmin, requireAdminPermission('canManageUsers'), async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...safeUser } = user;
      
      // Get last activity for this user
      const lastActiveMap = await storage.getLastActiveByUserIds([userId]);
      const lastActiveAt = lastActiveMap.get(userId)?.toISOString() || user.lastLoginAt || user.createdAt;
      
      res.json({ user: { ...safeUser, lastActiveAt } });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's quotes (admin)
  app.get("/api/admin/users/:userId/quotes", isAuthenticated, requireAdmin, requireAdminPermission('canManageUsers'), async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const quotes = await storage.getQuotesByUser(userId);
      res.json({ quotes });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's saved addresses (admin)
  app.get("/api/admin/users/:userId/addresses", isAuthenticated, requireAdmin, requireAdminPermission('canManageUsers'), async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const addresses = await storage.getSavedAddresses(userId);
      res.json({ addresses });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update user details (admin)
  app.patch("/api/admin/users/:userId", isAuthenticated, requireAdmin, requireAdminPermission('canManageUsers'), async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { fullName, email, phone, preferredLanguage, isActive } = req.body;

      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if target user is an admin - requires super admin
      const targetUserRoles = await storage.getUserRoles(userId);
      const targetIsAdmin = targetUserRoles.some(r => r.role === 'admin');
      
      if (targetIsAdmin) {
        const currentUserId = getUserId(req);
        if (!currentUserId) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        const currentUserPermissions = await storage.getAdminPermissions(currentUserId);
        if (!currentUserPermissions?.isSuperAdmin) {
          return res.status(403).json({ message: "Only super admins can update admin accounts" });
        }
      }

      // If email is being changed, check it's not taken
      if (email && email !== existingUser.email) {
        const emailUser = await storage.getUserByEmail(email);
        if (emailUser && emailUser.id !== userId) {
          return res.status(400).json({ message: "Email already in use" });
        }
      }

      const updatedUser = await storage.updateUser(userId, {
        fullName,
        email,
        phone,
        preferredLanguage,
        isActive,
      });

      res.json({ user: updatedUser, success: true });
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Create partner (admin) - creates user + mover profile
  app.post("/api/admin/partners", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { fullName, email, phone, companyName, businessEmail, contactPhone, taxId, fleetSize, crewSize } = req.body;

      if (!email || !companyName) {
        return res.status(400).json({ message: "Email and company name are required" });
      }

      // Check if user exists
      let user = await storage.getUserByEmail(email);
      if (user) {
        // Check if they already have a mover profile
        const existingProfile = await storage.getMoverProfile(user.id);
        if (existingProfile) {
          return res.status(400).json({ message: "This user already has a partner profile" });
        }
      } else {
        // Create new user
        user = await storage.createUser({
          email,
          fullName,
          phone,
          userType: 'mover',
        });
      }

      // Create mover profile
      const profile = await storage.createMoverProfile({
        userId: user.id,
        companyName,
        businessEmail: businessEmail || email,
        contactPhone: contactPhone || phone,
        taxId,
        fleetSize: fleetSize ? parseInt(fleetSize) : null,
        crewSize: crewSize ? parseInt(crewSize) : null,
        onboardingComplete: true, // Admin-created profiles are considered complete
      });

      res.json({ user, profile, success: true });
    } catch (error: any) {
      console.error("Error creating partner:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get quote with full details (admin)
  app.get("/api/admin/quotes/:id", isAuthenticated, requireAdmin, requireAdminPermission('canManageQuotes'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const quote = await storage.getQuoteWithDetails(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      res.json({ quote });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update quote workflow (admin)
  app.patch("/api/admin/quotes/:id/workflow", isAuthenticated, requireAdmin, requireAdminPermission('canManageQuotes'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { workflowStatus, suggestedPrice, adminNotes, biddingOpensAt, biddingClosesAt, note } = req.body;
      const userId = getUserId(req);
      const quote = await storage.updateQuoteWorkflow(
        id, 
        { workflowStatus, suggestedPrice, adminNotes, biddingOpensAt, biddingClosesAt },
        userId,
        note
      );
      res.json({ quote });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Open bidding for a quote (admin)
  app.post("/api/admin/quotes/:id/open-bidding", isAuthenticated, requireAdmin, requireAdminPermission('canManageQuotes'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { suggestedPrice, biddingClosesAt } = req.body;
      const userId = getUserId(req);
      const quote = await storage.updateQuoteWorkflow(
        id,
        { 
          workflowStatus: 'bidding_open', 
          suggestedPrice, 
          biddingOpensAt: new Date(),
          biddingClosesAt: biddingClosesAt ? new Date(biddingClosesAt) : null
        },
        userId,
        'Bidding opened for partners'
      );
      res.json({ quote });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Close bidding and start selection (admin)
  app.post("/api/admin/quotes/:id/close-bidding", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const quote = await storage.updateQuoteWorkflow(
        id,
        { workflowStatus: 'selection' },
        userId,
        'Bidding closed, selecting partner'
      );
      res.json({ quote });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Invite partner to quote (admin)
  app.post("/api/admin/quotes/:quoteId/invitations", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const { moverProfileId, message, dueAt } = req.body;
      const userId = getUserId(req);
      const invitation = await storage.createQuoteInvitation({
        quoteId,
        moverProfileId,
        invitedBy: userId,
        message,
        dueAt: dueAt ? new Date(dueAt) : null,
        status: 'invited',
      });

      // Send invitation email to mover
      const quote = await storage.getQuote(quoteId);
      const moverProfile = await storage.getMoverProfileById(moverProfileId);
      if (quote && moverProfile) {
        const moverUser = await storage.getUser(moverProfile.userId);
        if (moverUser?.email) {
          const baseUrl = `${req.protocol}://${req.get('host')}`;
          const dashboardLink = `${baseUrl}/partner/invitations/${invitation.id}`;
          const moveDate = quote.moveDate ? new Date(quote.moveDate).toLocaleDateString('es-ES', { 
            year: 'numeric', month: 'long', day: 'numeric' 
          }) : 'Por confirmar';
          const bidDeadline = dueAt ? new Date(dueAt).toLocaleDateString('es-ES', { 
            year: 'numeric', month: 'long', day: 'numeric' 
          }) : 'Sin fecha límite';
          
          sendQuoteInvitationEmail(
            moverUser.email,
            moverProfile.companyName || moverUser.fullName || 'Socio',
            quote.quoteNumber || quote.id,
            quote.fromAddress || 'No especificado',
            quote.toAddress || 'No especificado',
            moveDate,
            quote.homeSize || 'No estimado',
            bidDeadline,
            dashboardLink,
            moverUser.preferredLanguage || 'es',
            getStorageMoveContext(quote)
          ).catch(err => console.log('[EMAIL] Failed to send quote invitation:', err.message));
        }
      }

      res.json({ invitation });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get invitations for a quote (admin)
  app.get("/api/admin/quotes/:quoteId/invitations", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const invitations = await storage.getQuoteInvitations(quoteId);
      res.json({ invitations });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get bids for a quote (admin)
  app.get("/api/admin/quotes/:quoteId/bids", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const bids = await storage.getQuoteBids(quoteId);
      res.json({ bids });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Accept a bid (admin)
  app.post("/api/admin/bids/:bidId/accept", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { bidId } = req.params;
      const { quoteId } = req.body;
      const userId = getUserId(req);
      await storage.acceptBid(bidId, quoteId);
      await storage.addQuoteStatusHistory({
        quoteId,
        fromStatus: 'selection',
        toStatus: 'confirmed',
        actorType: 'admin',
        actorId: userId,
        note: 'Bid accepted, partner assigned',
      });

      // Send bid accepted email to mover
      const bid = await storage.getQuoteBid(bidId);
      const quote = await storage.getQuote(quoteId);
      if (bid && quote) {
        const moverProfile = await storage.getMoverProfileById(bid.moverProfileId);
        if (moverProfile) {
          const moverUser = await storage.getUser(moverProfile.userId);
          const clientUser = quote.userId ? await storage.getUser(quote.userId) : null;
          if (moverUser?.email) {
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            const dashboardLink = `${baseUrl}/partner/jobs/${quoteId}`;
            const moveDate = quote.moveDate ? new Date(quote.moveDate).toLocaleDateString('es-ES', { 
              year: 'numeric', month: 'long', day: 'numeric' 
            }) : 'Por confirmar';
            const formattedAmount = new Intl.NumberFormat('es-MX', { 
              style: 'currency', currency: 'USD' 
            }).format(Number(bid.amount) || 0);
            
            sendBidAcceptedEmail(
              moverUser.email,
              moverProfile.companyName || moverUser.fullName || 'Socio',
              quote.quoteNumber || quote.id,
              clientUser?.fullName || 'Cliente',
              quote.fromAddress || 'No especificado',
              quote.toAddress || 'No especificado',
              moveDate,
              formattedAmount,
              dashboardLink,
              moverUser.preferredLanguage || 'es',
              getStorageMoveContext(quote)
            ).catch(err => console.log('[EMAIL] Failed to send bid accepted email:', err.message));
          }
        }
      }

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Bulk invite partners to quote (admin) - sends invitations to multiple partners at once
  app.post("/api/admin/quotes/:quoteId/bulk-invitations", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const { moverProfileIds, message, dueAt, quotedAmount } = req.body;
      const userId = getUserId(req);

      if (!moverProfileIds || !Array.isArray(moverProfileIds) || moverProfileIds.length === 0) {
        return res.status(400).json({ message: "At least one partner must be selected" });
      }

      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Create bulk invitations
      const invitations = await storage.createBulkQuoteInvitations(
        moverProfileIds.map((moverProfileId: string) => ({
          quoteId,
          moverProfileId,
          invitedBy: userId,
          message,
          dueAt: dueAt ? new Date(dueAt) : null,
          quotedAmount: quotedAmount || quote.suggestedPrice || quote.estimatedCost,
          quotedCurrency: quote.estimatedCurrency || 'MXN',
          status: 'invited',
          emailStatus: 'pending',
        }))
      );

      // Log activity
      await storage.createQuoteActivityLog({
        quoteId,
        actionType: 'partner_invited',
        actorType: 'admin',
        actorId: userId,
        actorName: (await storage.getUser(userId || ''))?.fullName || 'Admin',
        description: `Invited ${invitations.length} partner(s) to bid on this quote`,
        descriptionEs: `Invitó a ${invitations.length} socio(s) a ofertar por esta cotización`,
        metadata: { partnerCount: invitations.length, dueAt },
      });
      // Send invitation emails to each partner
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const moveDate = quote.moveDate ? new Date(quote.moveDate).toLocaleDateString('es-ES', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      }) : 'Por confirmar';
      const bidDeadline = dueAt ? new Date(dueAt).toLocaleDateString('es-ES', { 
        year: 'numeric', month: 'long', day: 'numeric' 
      }) : 'Sin fecha límite';

      for (const invitation of invitations) {
        const moverProfile = await storage.getMoverProfileById(invitation.moverProfileId);
        if (moverProfile) {
          const moverUser = await storage.getUser(moverProfile.userId);
          if (moverUser?.email) {
            const dashboardLink = `${baseUrl}/partner/invitations/${invitation.id}`;
            sendQuoteInvitationEmail(
              moverUser.email,
              moverProfile.companyName || moverUser.fullName || 'Socio',
              quote.quoteNumber || quote.id,
              quote.fromAddress || 'No especificado',
              quote.toAddress || 'No especificado',
              moveDate,
              quote.homeSize || 'No estimado',
              bidDeadline,
              dashboardLink,
              moverUser.preferredLanguage || 'es',
              getStorageMoveContext(quote)
            ).then(async () => {
              await storage.updateQuoteInvitation(invitation.id, { 
                emailSentAt: new Date(), 
                emailStatus: 'sent' 
              });
            }).catch(async (err) => {
              console.log('[EMAIL] Failed to send invitation:', err.message);
              await storage.updateQuoteInvitation(invitation.id, { emailStatus: 'failed' });
            });
          }
        }
      }

      // Update quote workflow status and bidding deadline
      const updateData: any = {};
      
      // Set workflow status to bidding_open if not already in a later stage
      const nonBiddingStatuses = ['intake', 'admin_review', 'scheduled'];
      if (nonBiddingStatuses.includes(quote.workflowStatus || '')) {
        updateData.workflowStatus = 'bidding_open';
        updateData.biddingOpensAt = new Date();
      }
      
      // Always update the deadline if provided (allows changing deadline per quote)
      if (dueAt) {
        updateData.biddingClosesAt = new Date(dueAt);
      }
      
      if (Object.keys(updateData).length > 0) {
        await storage.updateQuote(quoteId, updateData);
      }

      res.json({ invitations, count: invitations.length });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Remove partner from bidding (admin)
  app.patch("/api/admin/invitations/:invitationId/withdraw", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { invitationId } = req.params;
      const { note } = req.body;
      const adminId = getUserId(req);

      const invitation = await storage.getQuoteInvitation(invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }

      // Update invitation status to withdrawn
      const updated = await storage.updateQuoteInvitation(invitationId, {
        status: 'withdrawn',
        declineReason: note || 'Removed by admin',
      });

      // Get mover profile for logging
      const moverProfile = await storage.getMoverProfileById(invitation.moverProfileId);
      const adminUser = adminId ? await storage.getUser(adminId) : null;

      // Log activity
      await storage.createQuoteActivityLog({
        quoteId: invitation.quoteId,
        actionType: 'partner_removed',
        actorType: 'admin',
        actorId: adminId,
        actorName: adminUser?.fullName || 'Admin',
        description: `Removed ${moverProfile?.companyName || 'Partner'} from bidding`,
        descriptionEs: `Removió a ${moverProfile?.companyName || 'Socio'} de la licitación`,
        metadata: { invitationId, moverProfileId: invitation.moverProfileId, note },
      });

      res.json({ invitation: updated });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update bidding deadline (admin)
  app.patch("/api/admin/quotes/:quoteId/bidding-deadline", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const { deadline, note } = req.body;
      const adminId = getUserId(req);

      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const oldDeadline = quote.biddingClosesAt;
      const newDeadline = deadline ? new Date(deadline) : null;

      // Update the deadline
      await storage.updateQuote(quoteId, {
        biddingClosesAt: newDeadline,
      });

      // Log activity
      const adminUser = adminId ? await storage.getUser(adminId) : null;
      await storage.createQuoteActivityLog({
        quoteId,
        actionType: 'bidding_deadline_updated',
        actorType: 'admin',
        actorId: adminId,
        actorName: adminUser?.fullName || 'Admin',
        description: `Updated bidding deadline to ${newDeadline ? newDeadline.toLocaleDateString() : 'no deadline'}`,
        descriptionEs: `Actualizó fecha límite de licitación a ${newDeadline ? newDeadline.toLocaleDateString('es-ES') : 'sin fecha'}`,
        metadata: { 
          oldDeadline: oldDeadline?.toISOString() || null, 
          newDeadline: newDeadline?.toISOString() || null, 
          note 
        },
      });

      res.json({ success: true, biddingClosesAt: newDeadline });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Close bidding manually (admin)
  app.post("/api/admin/quotes/:quoteId/close-bidding", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const { note } = req.body;
      const adminId = getUserId(req);

      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Update workflow and bidding status
      await storage.updateQuoteWorkflow(
        quoteId,
        { 
          workflowStatus: 'selection',
          biddingStatus: 'closed',
        },
        adminId,
        note || 'Bidding closed manually'
      );

      // Log activity
      const adminUser = adminId ? await storage.getUser(adminId) : null;
      await storage.createQuoteActivityLog({
        quoteId,
        actionType: 'bidding_closed',
        actorType: 'admin',
        actorId: adminId,
        actorName: adminUser?.fullName || 'Admin',
        description: 'Closed bidding manually',
        descriptionEs: 'Cerró la licitación manualmente',
        metadata: { note },
      });

      res.json({ success: true, message: 'Bidding closed successfully' });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin review bid (approve or reject)
  app.post("/api/admin/bids/:bidId/review", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { bidId } = req.params;
      const { status, note } = req.body;
      const adminId = getUserId(req);

      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
      }

      const bid = await storage.adminReviewBid(bidId, status, adminId || '', note);

      // Log activity
      const quote = await storage.getQuote(bid.quoteId);
      const moverProfile = await storage.getMoverProfileById(bid.moverProfileId);
      const adminUser = adminId ? await storage.getUser(adminId) : null;
      
      await storage.createQuoteActivityLog({
        quoteId: bid.quoteId,
        actionType: status === 'approved' ? 'bid_approved' : 'bid_rejected',
        actorType: 'admin',
        actorId: adminId,
        actorName: adminUser?.fullName || 'Admin',
        description: `${status === 'approved' ? 'Approved' : 'Rejected'} bid from ${moverProfile?.companyName || 'Partner'}`,
        descriptionEs: `${status === 'approved' ? 'Aprobó' : 'Rechazó'} oferta de ${moverProfile?.companyName || 'Socio'}`,
        metadata: { bidId, status, note, amount: bid.amount },
      });

      // If approved, send notification to client that new offer is available
      if (status === 'approved' && quote?.userId) {
        const clientUser = await storage.getUser(quote.userId);
        if (clientUser?.email) {
          // TODO: Send email to client about new approved offer
          console.log(`[EMAIL] New approved offer available for client: ${clientUser.email}`);
        }
      }

      res.json({ bid });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Client selects a bid
  app.post("/api/quotes/:quoteId/select-bid", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const { bidId } = req.body;
      const userId = getUserId(req);

      // Verify user owns this quote
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      if (quote.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to select bid for this quote" });
      }

      // Verify bid is approved
      const bid = await storage.getQuoteBid(bidId);
      if (!bid || bid.quoteId !== quoteId) {
        return res.status(404).json({ message: "Bid not found" });
      }
      if (bid.adminReviewStatus !== 'approved') {
        return res.status(400).json({ message: "This bid has not been approved yet" });
      }

      const updatedQuote = await storage.clientSelectBid(quoteId, bidId);

      // Log activity
      const clientUser = userId ? await storage.getUser(userId) : null;
      const moverProfile = await storage.getMoverProfileById(bid.moverProfileId);

      await storage.createQuoteActivityLog({
        quoteId,
        actionType: 'client_selected_bid',
        actorType: 'client',
        actorId: userId,
        actorName: clientUser?.fullName || 'Client',
        description: `Client selected bid from ${moverProfile?.companyName || 'Partner'}`,
        descriptionEs: `Cliente seleccionó oferta de ${moverProfile?.companyName || 'Socio'}`,
        metadata: { bidId, moverProfileId: bid.moverProfileId, amount: bid.amount },
      });

      res.json({ quote: updatedQuote });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get approved bids for client
  app.get("/api/quotes/:quoteId/approved-bids", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const userId = getUserId(req);

      // Verify user owns this quote
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      if (quote.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to view bids for this quote" });
      }

      const bids = await storage.getApprovedBidsForClient(quoteId);
      res.json({ bids });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin final approval of selected bid
  app.post("/api/admin/quotes/:quoteId/finalize-partner", isAuthenticated, requireAdmin, requireAdminPermission('canManageQuotes'), async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const adminId = getUserId(req);

      const updatedQuote = await storage.adminFinalApproval(quoteId, adminId || '');

      // Log activity
      const adminUser = adminId ? await storage.getUser(adminId) : null;
      const selectedBid = await storage.getQuoteBid(updatedQuote.selectedBidId || '');
      const moverProfile = selectedBid ? await storage.getMoverProfileById(selectedBid.moverProfileId) : null;

      await storage.createQuoteActivityLog({
        quoteId,
        actionType: 'partner_finalized',
        actorType: 'admin',
        actorId: adminId,
        actorName: adminUser?.fullName || 'Admin',
        description: `Finalized ${moverProfile?.companyName || 'Partner'} as the moving partner`,
        descriptionEs: `Finalizó a ${moverProfile?.companyName || 'Socio'} como el socio de mudanza`,
        metadata: { 
          bidId: updatedQuote.selectedBidId, 
          moverProfileId: moverProfile?.id,
          finalPrice: updatedQuote.finalPrice 
        },
      });

      // TODO: Send confirmation emails to client and partner

      res.json({ quote: updatedQuote });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get quote status history (admin)
  app.get("/api/admin/quotes/:quoteId/history", isAuthenticated, requireAdmin, requireAdminPermission('canManageQuotes'), async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const history = await storage.getQuoteStatusHistory(quoteId);
      res.json({ history });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get quote activity log (admin) - comprehensive tracking of all changes
  app.get("/api/admin/quotes/:quoteId/activity-log", isAuthenticated, requireAdmin, requireAdminPermission('canManageQuotes'), async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const activityLog = await storage.getQuoteActivityLog(quoteId);
      res.json({ activityLog });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update quote workflow status with note (admin)
  app.patch("/api/admin/quotes/:quoteId/workflow-status", isAuthenticated, requireAdmin, requireAdminPermission('canManageQuotes'), async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const { status, note } = req.body;
      const adminUserId = getUserId(req);
      const updatedQuote = await transitionQuoteStage({
        quoteId,
        toStage: status,
        actorId: adminUserId || null,
        reason: note,
        note,
      });
      res.json({ quote: updatedQuote, success: true });
    } catch (error: any) {
      res.status(error?.status || 500).json({ message: error.message });
    }
  });

  // Reassign quote to different client (admin)
  app.patch("/api/admin/quotes/:id/reassign", isAuthenticated, requireAdmin, requireAdminPermission('canManageQuotes'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { userId } = req.body;
      const adminUserId = getUserId(req);
      
      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Update the quote's userId
      const updatedQuote = await storage.updateQuote(id, { userId });
      
      // Log the activity
      if (adminUserId) {
        await storage.logActivity({
          userId: adminUserId,
          action: 'quote_reassigned',
          entityType: 'quote',
          entityId: id,
          details: { oldUserId: quote.userId, newUserId: userId },
        });
      }
      
      res.json({ quote: updatedQuote });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get quote documents (admin)
  app.get("/api/admin/quotes/:quoteId/documents", isAuthenticated, requireAdmin, requireAdminPermission('canManageQuotes'), async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const documents = await storage.getQuoteDocuments(quoteId);
      res.json({ documents });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reviewer workspace: one transactional, allowlisted mutation for intake,
  // inventory, and selected scope. Sent offers remain immutable revisions.
  const reviewAdmin = [isAuthenticated, requireAdmin, requirePlatformPermission("module:quotes"), requireAdminPermission("canManageQuotes")] as any;
  const reviewIntakeSchema = z.object({
    contactName: z.string().max(300).nullable().optional(),
    contactEmail: z.string().email().max(320).nullable().optional(),
    contactPhone: z.string().max(80).nullable().optional(),
    fromAddress: z.string().min(1).max(1000).optional(),
    toAddress: z.string().min(1).max(1000).optional(),
    moveDate: z.coerce.date().nullable().optional(),
    moveAvailabilityStart: z.string().max(100).nullable().optional(),
    moveAvailabilityEnd: z.string().max(100).nullable().optional(),
    preferredMoveDates: z.array(z.string().max(100)).max(100).optional(),
    blockedMoveDates: z.array(z.string().max(100)).max(100).optional(),
    homeSize: z.string().min(1).max(100).optional(),
    storageOption: z.string().max(200).nullable().optional(),
    needsInsurance: z.boolean().optional(),
    needsPacking: z.boolean().optional(),
    needsUnpacking: z.boolean().optional(),
    needsBox: z.boolean().optional(),
    clientNotes: z.string().max(10000).nullable().optional(),
  }).strict();
  const reviewItemSchema = z.object({
    id: z.string().min(1).optional(),
    itemName: z.string().trim().min(1).max(300),
    room: z.string().max(200).nullable().optional(),
    category: z.string().max(200).nullable().optional(),
    quantity: z.coerce.number().int().min(1).max(100000),
    notes: z.string().max(2000).nullable().optional(),
  }).strict();
  const reviewPatchSchema = z.object({
    expectedReviewVersion: z.coerce.number().int().min(0),
    reason: z.string().trim().max(2000).optional(),
    intake: reviewIntakeSchema.optional(),
    inventoryItems: z.array(reviewItemSchema).max(2000).optional(),
    serviceIds: z.array(z.string().min(1)).max(100).optional(),
    addOnIds: z.array(z.string().min(1)).max(100).optional(),
  }).strict();
  const supportedIntakeMime = new Set([
    "image/jpeg", "image/png", "image/webp", "application/pdf",
    "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv", "text/plain",
  ]);
  const attachmentSummary = (row: any) => ({
    id: row.id, quoteId: row.quoteId, fileName: row.fileName, mimeType: row.mimeType,
    fileSize: row.fileSize, status: row.status, uploadedBy: row.uploadedBy,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    contentUrl: `/api/admin/quotes/${row.quoteId}/attachments/${row.id}/content`,
  });
  const reviewQuote = async (quoteId: string) => {
    const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, quoteId) });
    if (!quote) return null;
    const service = await db.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, quoteId) });
    const attachments = await db.select().from(quoteIntakeAttachments).where(eq(quoteIntakeAttachments.quoteId, quoteId));
    const items = await db.select().from(inventoryItems).where(eq(inventoryItems.quoteId, quoteId));
    const selectedServices = await db.select({ id: services.id, name: services.name, nameEs: services.nameEs })
      .from(quoteServices).innerJoin(services, eq(quoteServices.serviceId, services.id)).where(eq(quoteServices.quoteId, quoteId));
    const selectedAddOns = await db.select({ id: addOns.id, name: addOns.name, nameEs: addOns.nameEs })
      .from(quoteAddOns).innerJoin(addOns, eq(quoteAddOns.addOnId, addOns.id)).where(eq(quoteAddOns.quoteId, quoteId));
    const stage = normalizeQuoteStage(quote.workflowStatus);
    const editable = ([QUOTE_STAGE.DRAFT, QUOTE_STAGE.UNDER_REVIEW] as string[]).includes(stage) && !service;
    return {
      quote: { ...quote, inventoryItems: items, services: selectedServices, addOns: selectedAddOns },
      editable,
      lockReason: editable ? null : service ? "Quote has an operational service" : `Quote is ${stage} and cannot be edited`,
      attachments: attachments.map(attachmentSummary),
    };
  };

  app.get("/api/admin/quotes/:quoteId/review-workspace", ...reviewAdmin, async (req, res) => {
    try {
      const workspace = await reviewQuote(req.params.quoteId);
      if (!workspace) return res.status(404).json({ message: "Quote not found" });
      res.json(workspace);
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.patch("/api/admin/quotes/:quoteId/review-workspace", ...reviewAdmin, async (req, res) => {
    try {
      const body = reviewPatchSchema.parse(req.body);
      const actorId = getActiveUserId(req);
      const actor = actorId ? await storage.getUser(actorId) : null;
      const result = await db.transaction(async tx => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${"quote:" + req.params.quoteId}, 0))`);
        const quote = await tx.query.quotes.findFirst({ where: eq(quotes.id, req.params.quoteId) });
        if (!quote) throw Object.assign(new Error("Quote not found"), { status: 404 });
        const service = await tx.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, quote.id) });
        const stage = normalizeQuoteStage(quote.workflowStatus);
        if (service || !([QUOTE_STAGE.DRAFT, QUOTE_STAGE.UNDER_REVIEW] as string[]).includes(stage)) {
          throw Object.assign(new Error(service ? "Quote has an operational service" : `Quote is ${stage} and cannot be edited`), { status: 409 });
        }
        if (quote.quoteReviewVersion !== body.expectedReviewVersion) {
          throw Object.assign(new Error("Quote changed while the workspace was open"), { status: 409 });
        }
        const before: Record<string, unknown> = {};
        const after: Record<string, unknown> = {};
        const changes: string[] = [];
        const patch: Record<string, unknown> = {};
        const intake = body.intake || {};
        for (const key of Object.keys(intake) as Array<keyof typeof intake>) {
          const previousValue = (quote as any)[key];
          const nextValue = (intake as any)[key];
          const valuesMatch = quoteReviewValuesMatch(previousValue, nextValue);
          if (!valuesMatch) {
            before[`intake.${String(key)}`] = (quote as any)[key] ?? null;
            after[`intake.${String(key)}`] = (intake as any)[key] ?? null;
            changes.push(`intake.${String(key)}`);
            patch[key as string] = (intake as any)[key];
          }
        }
        let pricingImpact = false;
        const pricingIntake = ["fromAddress", "toAddress", "moveDate", "moveAvailabilityStart", "moveAvailabilityEnd", "preferredMoveDates", "blockedMoveDates", "homeSize", "storageOption", "needsInsurance", "needsPacking", "needsUnpacking", "needsBox"];
        pricingImpact = changes.some(key => pricingIntake.includes(key.replace("intake.", "")));
        if (body.inventoryItems !== undefined) {
          const current = await tx.select().from(inventoryItems).where(eq(inventoryItems.quoteId, quote.id));
          const currentById = new Map(current.map(item => [item.id, item]));
          const seen = new Set<string>();
          let inventoryChanged = false;
          for (const item of body.inventoryItems) {
            if (item.id) {
              const existing = currentById.get(item.id);
              if (!existing) throw Object.assign(new Error("Inventory item does not belong to this quote"), { status: 400 });
              seen.add(item.id);
              const next = { itemName: item.itemName, room: item.room ?? null, category: item.category ?? null, quantity: item.quantity, notes: item.notes ?? null };
              if (JSON.stringify({ itemName: existing.itemName, room: existing.room, category: existing.category, quantity: existing.quantity, notes: existing.notes }) !== JSON.stringify(next)) {
                before[`inventory.${item.id}`] = existing;
                after[`inventory.${item.id}`] = next;
                await tx.update(inventoryItems).set(next).where(eq(inventoryItems.id, item.id));
                changes.push(`inventory.${item.id}`);
                inventoryChanged = true;
              }
            } else {
              const [created] = await tx.insert(inventoryItems).values({ quoteId: quote.id, ...item, room: item.room ?? null, category: item.category ?? null, notes: item.notes ?? null }).returning();
              after[`inventory.${created.id}`] = created;
              changes.push(`inventory.${created.id}`);
              inventoryChanged = true;
            }
          }
          for (const existing of current) if (!seen.has(existing.id) && !body.inventoryItems!.some(item => item.id === existing.id)) {
            before[`inventory.${existing.id}`] = existing;
            await tx.delete(inventoryItems).where(eq(inventoryItems.id, existing.id));
            changes.push(`inventory.${existing.id}`);
            inventoryChanged = true;
          }
          pricingImpact ||= inventoryChanged;
        }
        if (body.serviceIds !== undefined) {
          const current = await tx.select().from(quoteServices).where(eq(quoteServices.quoteId, quote.id));
          const currentIds = current.map(x => x.serviceId);
          const { requested: ids, removedIds, addedIds } = associationDiff(currentIds, body.serviceIds);
          const validAdded = addedIds.length
            ? await tx.select({ id: services.id }).from(services).where(and(inArray(services.id, addedIds), eq(services.active, true)))
            : [];
          if (validAdded.length !== addedIds.length) throw Object.assign(new Error("One or more services are unavailable"), { status: 400 });
          if (removedIds.length || addedIds.length) {
            before.services = currentIds;
            after.services = ids;
            changes.push("services");
            pricingImpact = true;
            if (removedIds.length) await tx.delete(quoteServices).where(and(eq(quoteServices.quoteId, quote.id), inArray(quoteServices.serviceId, removedIds)));
            if (addedIds.length) await tx.insert(quoteServices).values(addedIds.map(serviceId => ({ quoteId: quote.id, serviceId, createdByAdminId: actorId })));
          }
        }
        if (body.addOnIds !== undefined) {
          const current = await tx.select().from(quoteAddOns).where(eq(quoteAddOns.quoteId, quote.id));
          const currentIds = current.map(x => x.addOnId);
          const { requested: ids, removedIds, addedIds } = associationDiff(currentIds, body.addOnIds);
          const validAdded = addedIds.length
            ? await tx.select({ id: addOns.id }).from(addOns).where(and(inArray(addOns.id, addedIds), eq(addOns.active, true)))
            : [];
          if (validAdded.length !== addedIds.length) throw Object.assign(new Error("One or more add-ons are unavailable"), { status: 400 });
          if (removedIds.length || addedIds.length) {
            before.addOns = currentIds;
            after.addOns = ids;
            changes.push("addOns");
            pricingImpact = true;
            if (removedIds.length) await tx.delete(quoteAddOns).where(and(eq(quoteAddOns.quoteId, quote.id), inArray(quoteAddOns.addOnId, removedIds)));
            if (addedIds.length) await tx.insert(quoteAddOns).values(addedIds.map(addOnId => ({ quoteId: quote.id, addOnId })));
          }
        }
        if (!changes.length) return { quote, changes, pricingImpact };
        if (pricingImpact) Object.assign(patch, { estimatedCost: null, estimatedCostHigh: null, suggestedPrice: null, requiredVehicleWeightKg: null, requiredVehicleVolumeM3: null, requiredCrewCount: null });
        const now = new Date();
        const [updated] = await tx.update(quotes)
          .set({ ...patch, updatedAt: now, quoteReviewVersion: sql`${quotes.quoteReviewVersion} + 1` })
          .where(and(eq(quotes.id, quote.id), eq(quotes.quoteReviewVersion, body.expectedReviewVersion)))
          .returning();
        if (!updated) throw Object.assign(new Error("Quote changed while saving"), { status: 409 });
        await tx.insert(quoteActivityLog).values({
          quoteId: quote.id, actionType: "quote.review_workspace_updated", actorType: "admin", actorId: actorId || null,
          actorName: actor?.fullName || actor?.email || null,
          description: "Admin updated quote intake review workspace", descriptionEs: "Administrador actualizó el espacio de revisión de la cotización",
          metadata: { reason: body.reason || null, changes, before, after, pricingImpact, estimateInvalidated: pricingImpact, actorId, createdAt: now.toISOString() },
        });
        return { quote: updated, changes, pricingImpact };
      });
      res.json({ ...result, success: true });
    } catch (error: any) { res.status(error?.status || (error instanceof z.ZodError ? 400 : 500)).json({ message: error.message }); }
  });

  app.post("/api/admin/quotes/:quoteId/review-workspace/recalculate", ...reviewAdmin, async (req, res) => {
    try {
      const body = z.object({ expectedReviewVersion: z.coerce.number().int().min(0) }).strict().parse(req.body);
      const actorId = getActiveUserId(req);
      const actor = actorId ? await storage.getUser(actorId) : null;
      const result = await recalculateReviewedQuoteEstimate({
        quoteId: req.params.quoteId,
        expectedReviewVersion: body.expectedReviewVersion,
        actorId: actorId || null,
        actorName: actor?.fullName || actor?.email || null,
      });
      res.json(result);
    } catch (error: any) {
      res.status(error instanceof z.ZodError ? 400 : error?.status || 500).json({ message: error.message });
    }
  });

  app.get("/api/admin/quotes/:quoteId/attachments", ...reviewAdmin, async (req, res) => {
    try {
      const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, req.params.quoteId) });
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      const rows = await db.select().from(quoteIntakeAttachments).where(eq(quoteIntakeAttachments.quoteId, quote.id));
      res.json({ attachments: rows.map(attachmentSummary) });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.post("/api/admin/quotes/:quoteId/attachments", ...reviewAdmin, async (req, res) => {
    try {
      const body = z.object({ fileName: z.string().trim().min(1).max(255), mimeType: z.string().min(1).max(150), fileSize: z.coerce.number().int().positive().max(10 * 1024 * 1024), dataBase64: z.string().min(1) }).strict().parse(req.body);
      if (!supportedIntakeMime.has(body.mimeType.toLowerCase())) return res.status(415).json({ message: "Unsupported attachment type" });
      const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, req.params.quoteId) });
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      const stage = normalizeQuoteStage(quote.workflowStatus);
      const operational = await db.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, quote.id) });
      if (operational || !([QUOTE_STAGE.DRAFT, QUOTE_STAGE.UNDER_REVIEW] as string[]).includes(stage)) return res.status(409).json({ message: operational ? "Quote has an operational service" : "Quote attachments are locked at this stage" });
      const encoded = body.dataBase64.replace(/^data:[^;]+;base64,/, "");
      const bytes = Buffer.from(encoded, "base64");
      if (!bytes.length || bytes.length > 10 * 1024 * 1024 || bytes.length !== body.fileSize) return res.status(400).json({ message: "Attachment data does not match the declared size" });
      const safeName = body.fileName.replace(/[\\/\r\n"]/g, "_");
      const [row] = await db.insert(quoteIntakeAttachments).values({ quoteId: quote.id, fileName: safeName, mimeType: body.mimeType.toLowerCase(), fileSize: bytes.length, fileData: bytes.toString("base64"), status: "ready", uploadedBy: getActiveUserId(req) || null }).returning();
      const actorId = getActiveUserId(req);
      const actor = actorId ? await storage.getUser(actorId) : null;
      await storage.createQuoteActivityLog({ quoteId: quote.id, actionType: "quote.review_attachment_uploaded", actorType: "admin", actorId: actorId || null, actorName: actor?.fullName || actor?.email || null, description: "Admin uploaded customer intake attachment", descriptionEs: "Administrador cargó un archivo de intake", metadata: { attachmentId: row.id, fileName: row.fileName, mimeType: row.mimeType, fileSize: row.fileSize } });
      res.status(201).json({ attachment: attachmentSummary(row) });
    } catch (error: any) { res.status(error instanceof z.ZodError ? 400 : 500).json({ message: error.message }); }
  });

  app.get("/api/admin/quotes/:quoteId/attachments/:attachmentId/content", ...reviewAdmin, async (req, res) => {
    try {
      const [row] = await db.select().from(quoteIntakeAttachments).where(and(eq(quoteIntakeAttachments.id, req.params.attachmentId), eq(quoteIntakeAttachments.quoteId, req.params.quoteId))).limit(1);
      if (!row) return res.status(404).json({ message: "Attachment not found" });
      if (row.status !== "ready" || !row.fileData) return res.status(410).json({ message: "Attachment is unavailable" });
      res.setHeader("Content-Type", row.mimeType); res.setHeader("Content-Length", String(row.fileSize));
      const disposition = req.query.download === "1" ? "attachment" : "inline";
      res.setHeader("Content-Disposition", `${disposition}; filename="${row.fileName.replace(/[\\r\n"]/g, "_")}"`);
      res.send(Buffer.from(row.fileData, "base64"));
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  app.delete("/api/admin/quotes/:quoteId/attachments/:attachmentId", ...reviewAdmin, async (req, res) => {
    try {
      const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, req.params.quoteId) });
      if (!quote) return res.status(404).json({ message: "Quote not found" });
      const stage = normalizeQuoteStage(quote.workflowStatus);
      const operational = await db.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, quote.id) });
      if (operational || !([QUOTE_STAGE.DRAFT, QUOTE_STAGE.UNDER_REVIEW] as string[]).includes(stage)) return res.status(409).json({ message: operational ? "Quote has an operational service" : "Quote attachments are locked at this stage" });
      const [row] = await db.delete(quoteIntakeAttachments).where(and(eq(quoteIntakeAttachments.id, req.params.attachmentId), eq(quoteIntakeAttachments.quoteId, quote.id))).returning();
      if (!row) return res.status(404).json({ message: "Attachment not found" });
      const actorId = getActiveUserId(req);
      const actor = actorId ? await storage.getUser(actorId) : null;
      await storage.createQuoteActivityLog({ quoteId: quote.id, actionType: "quote.review_attachment_deleted", actorType: "admin", actorId: actorId || null, actorName: actor?.fullName || actor?.email || null, description: "Admin deleted customer intake attachment", descriptionEs: "Administrador eliminó un archivo de intake", metadata: { attachmentId: row.id, fileName: row.fileName } });
      res.json({ success: true });
    } catch (error: any) { res.status(500).json({ message: error.message }); }
  });

  // ========== MOVER QUOTE ROUTES ==========
  
  // Get mover's invitations with full quote details including inventory
  app.get("/api/mover/:moverProfileId/invitations", requireCompanyPermission("company:read"), async (req: Request, res: Response) => {
    try {
      const { moverProfileId } = req.params;
      if (moverProfileId !== (req as any).company.id) return res.status(403).json({ message: "Access denied" });
      const invitations = (await storage.getMoverInvitationsWithDetails(moverProfileId)).map((invitation) => ({ ...invitation, quote: { ...toPartnerSafeQuote(invitation.quote), inventoryItems: invitation.quote.inventoryItems } }));
      res.json({ invitations });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Mark invitation as viewed
  app.patch("/api/mover/invitations/:id/view", requireCompanyPermission("dispatch:manage"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const invitation = await storage.getQuoteInvitation(id);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      if (invitation.moverProfileId !== (req as any).company.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedInvitation = await storage.updateQuoteInvitation(id, {
        status: 'viewed',
        viewedAt: new Date(),
      });
      res.json({ invitation: updatedInvitation });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Decline invitation
  app.patch("/api/mover/invitations/:id/decline", requireCompanyPermission("dispatch:manage"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const invitation = await storage.getQuoteInvitation(id);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      if (invitation.moverProfileId !== (req as any).company.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const updatedInvitation = await storage.updateQuoteInvitation(id, {
        status: 'declined',
        respondedAt: new Date(),
      });
      res.json({ invitation: updatedInvitation });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Submit bid for a quote (partner responds to invitation)
  app.post("/api/mover/quotes/:quoteId/bids", requireCompanyPermission("dispatch:manage"), async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const userId = getUserId(req);
      const { 
        invitationId, moverProfileId, amount, 
        isOriginalPrice, adjustmentReason, proposedMoveDate,
        availabilityStart, availabilityEnd, 
        estimatedHours, crewSize, vehiclesNeeded,
        includedServices, extraFees, notes,
        validUntil
      } = req.body;
      const activeCompanyId = (req as any).company.id;

      if (moverProfileId && moverProfileId !== activeCompanyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const profile = await storage.getMoverProfileById(activeCompanyId);
      if (!profile) return res.status(404).json({ message: "Company not found" });

      // Get invitation and verify it belongs to this mover and this quote
      const invitation = await storage.getQuoteInvitation(invitationId);
      if (!invitation) {
        return res.status(404).json({ message: "Invitation not found" });
      }
      if (invitation.moverProfileId !== activeCompanyId) {
        return res.status(403).json({ message: "Access denied" });
      }
      if (invitation.quoteId !== quoteId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // If price is different from original, require adjustment reason
      const originalAmount = invitation.quotedAmount;
      const priceChanged = originalAmount && Number(amount) !== Number(originalAmount);
      if (priceChanged && !adjustmentReason) {
        return res.status(400).json({ 
          message: "Adjustment reason is required when changing the quoted price" 
        });
      }

      const bid = await storage.createQuoteBid({
        invitationId,
        quoteId,
        moverProfileId: activeCompanyId,
        originalAmount: originalAmount || null,
        amount,
        isOriginalPrice: !priceChanged,
        adjustmentReason: priceChanged ? adjustmentReason : null,
        proposedMoveDate: proposedMoveDate ? new Date(proposedMoveDate) : null,
        availabilityStart: availabilityStart ? new Date(availabilityStart) : null,
        availabilityEnd: availabilityEnd ? new Date(availabilityEnd) : null,
        estimatedHours,
        crewSize,
        vehiclesNeeded,
        includedServices,
        extraFees,
        notes,
        validUntil: validUntil ? new Date(validUntil) : null,
        status: 'submitted',
        adminReviewStatus: 'pending',
      });
      
      // Update submittedAt
      await storage.updateQuoteBid(bid.id, { submittedAt: new Date() });

      // Update invitation status
      await storage.updateQuoteInvitation(invitationId, {
        status: 'bid_submitted',
        respondedAt: new Date(),
      });

      // Log activity
      const quote = await storage.getQuote(quoteId);
      await storage.createQuoteActivityLog({
        quoteId,
        actionType: 'bid_received',
        actorType: 'mover',
        actorId: userId,
        actorName: profile.companyName || 'Partner',
        description: `Bid received from ${profile.companyName || 'Partner'} for ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(amount))}`,
        descriptionEs: `Oferta recibida de ${profile.companyName || 'Socio'} por ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(amount))}`,
        metadata: { 
          bidId: bid.id, 
          amount, 
          isOriginalPrice: !priceChanged,
          adjustmentReason: priceChanged ? adjustmentReason : null,
          companyId: activeCompanyId,
          membershipId: (req as any).companyMembership.id,
        },
      });

      // Send notification to admins about new bid
      // TODO: Send admin notification email

      res.json({ bid });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update bid
  app.patch("/api/mover/bids/:bidId", requireCompanyPermission("dispatch:manage"), async (req: Request, res: Response) => {
    try {
      const { bidId } = req.params;
      const existingBid = await storage.getQuoteBid(bidId);
      if (!existingBid) {
        return res.status(404).json({ message: "Bid not found" });
      }
      if (existingBid.moverProfileId !== (req as any).company.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Only allow movers to update operational bid fields; privileged workflow
      // fields (adminReviewStatus, adminReviewedAt, adminReviewedBy,
      // userSelectedAt, finalApprovalAt, finalApprovedBy, quoteId,
      // moverProfileId, invitationId) must never be writable by a mover.
      const {
        amount,
        isOriginalPrice,
        adjustmentReason,
        proposedMoveDate,
        availabilityStart,
        availabilityEnd,
        estimatedHours,
        crewSize,
        vehiclesNeeded,
        includedServices,
        extraFees,
        notes,
        validUntil,
      } = req.body;

      const allowedUpdate: Record<string, unknown> = {};
      if (amount !== undefined) allowedUpdate.amount = amount;
      if (isOriginalPrice !== undefined) allowedUpdate.isOriginalPrice = isOriginalPrice;
      if (adjustmentReason !== undefined) allowedUpdate.adjustmentReason = adjustmentReason;
      if (proposedMoveDate !== undefined) allowedUpdate.proposedMoveDate = proposedMoveDate ? new Date(proposedMoveDate) : null;
      if (availabilityStart !== undefined) allowedUpdate.availabilityStart = availabilityStart ? new Date(availabilityStart) : null;
      if (availabilityEnd !== undefined) allowedUpdate.availabilityEnd = availabilityEnd ? new Date(availabilityEnd) : null;
      if (estimatedHours !== undefined) allowedUpdate.estimatedHours = estimatedHours;
      if (crewSize !== undefined) allowedUpdate.crewSize = crewSize;
      if (vehiclesNeeded !== undefined) allowedUpdate.vehiclesNeeded = vehiclesNeeded;
      if (includedServices !== undefined) allowedUpdate.includedServices = includedServices;
      if (extraFees !== undefined) allowedUpdate.extraFees = extraFees;
      if (notes !== undefined) allowedUpdate.notes = notes;
      if (validUntil !== undefined) allowedUpdate.validUntil = validUntil ? new Date(validUntil) : null;

      const bid = await storage.updateQuoteBid(bidId, allowedUpdate);
      res.json({ bid });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Withdraw bid
  app.patch("/api/mover/bids/:bidId/withdraw", requireCompanyPermission("dispatch:manage"), async (req: Request, res: Response) => {
    try {
      const { bidId } = req.params;
      const existingBid = await storage.getQuoteBid(bidId);
      if (!existingBid) {
        return res.status(404).json({ message: "Bid not found" });
      }
      if (existingBid.moverProfileId !== (req as any).company.id) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const bid = await storage.updateQuoteBid(bidId, { status: 'withdrawn' });
      res.json({ bid });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get mover's bids with full quote details
  app.get("/api/mover/:moverProfileId/bids", requireCompanyPermission("company:read"), async (req: Request, res: Response) => {
    try {
      const { moverProfileId } = req.params;
      if (moverProfileId !== (req as any).company.id) return res.status(403).json({ message: "Access denied" });
      const bids = (await storage.getBidsByMoverWithDetails(moverProfileId)).map((bid) => ({ ...bid, quote: toPartnerSafeQuote(bid.quote) }));
      res.json({ bids });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== INVENTORY ROUTES ==========

  // Helper to check if quote is locked for editing
  const lockedStatuses = ['bidding_open', 'bidding_closed', 'selection', 'confirmed', 'scheduled', 'in_progress', 'completed', 'cancelled'];
  
  const isQuoteLocked = (workflowStatus: string | null): boolean => {
    return lockedStatuses.includes(workflowStatus || '');
  };

  // Helper to check if user can edit quote inventory
  const canEditQuoteInventory = async (userId: string | undefined, quote: { userId: string | null }): Promise<boolean> => {
    if (!userId) return false;
    
    // Check if user owns the quote
    if (quote.userId === userId) return true;
    
    // Check if user is admin
    const hasAdminRole = await storage.hasRole(userId, 'admin');
    if (hasAdminRole) return true;
    
    const user = await storage.getUser(userId);
    if (user?.userType === 'admin') return true;
    
    return false;
  };

  // Add inventory item
  app.post("/api/inventory", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const result = insertInventoryItemSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({
          message: fromZodError(result.error).message,
        });
      }

      // Check if quote exists
      const quote = await storage.getQuote(result.data.quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Check authorization
      if (!await canEditQuoteInventory(userId, quote)) {
        return res.status(403).json({ message: "Not authorized to modify this quote's inventory" });
      }
      
      if (isQuoteLocked(quote.workflowStatus)) {
        return res.status(403).json({ message: "Quote is locked for editing - bidding has started" });
      }

      const item = await storage.addInventoryItem(result.data);
      res.json({ item });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get inventory for quote
  app.get("/api/inventory/:quoteId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { quoteId } = req.params;
      const activeUserId = getActiveUserId(req);

      if (!activeUserId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Verify ownership or admin access
      const isOwner = quote.userId === activeUserId;
      if (!isOwner) {
        const hasAdminRole = await storage.hasRole(activeUserId, 'admin');
        const callerUser = await storage.getUser(activeUserId);
        if (!hasAdminRole && callerUser?.userType !== 'admin') {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      const items = await storage.getInventoryByQuote(quoteId);
      res.json({ items });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update inventory item
  app.patch("/api/inventory/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      const { quantity, itemName, category, room } = req.body;

      // Get the item to find the quote
      const existingItem = await storage.getInventoryItem(id);
      if (!existingItem) {
        return res.status(404).json({ message: "Inventory item not found" });
      }

      // Check if quote exists
      const quote = await storage.getQuote(existingItem.quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Check authorization
      if (!await canEditQuoteInventory(userId, quote)) {
        return res.status(403).json({ message: "Not authorized to modify this quote's inventory" });
      }
      
      if (isQuoteLocked(quote.workflowStatus)) {
        return res.status(403).json({ message: "Quote is locked for editing - bidding has started" });
      }

      const item = await storage.updateInventoryItem(id, { quantity, itemName, category, room });
      res.json({ item });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete inventory item
  app.delete("/api/inventory/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { id } = req.params;
      
      // Get the item to find the quote
      const existingItem = await storage.getInventoryItem(id);
      if (!existingItem) {
        return res.status(404).json({ message: "Inventory item not found" });
      }

      // Check if quote exists
      const quote = await storage.getQuote(existingItem.quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Check authorization
      if (!await canEditQuoteInventory(userId, quote)) {
        return res.status(403).json({ message: "Not authorized to modify this quote's inventory" });
      }
      
      if (isQuoteLocked(quote.workflowStatus)) {
        return res.status(403).json({ message: "Quote is locked for editing - bidding has started" });
      }

      await storage.deleteInventoryItem(id);
      res.json({ message: "Item deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Recalculate quote estimates based on current inventory
  app.post("/api/quotes/:id/recalculate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      
      const quote = await storage.getQuote(id);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Check authorization: must be quote owner or admin
      const isOwner = quote.userId === userId;
      let isAdmin = false;
      if (userId) {
        const hasAdminRole = await storage.hasRole(userId, 'admin');
        const user = await storage.getUser(userId);
        isAdmin = hasAdminRole || user?.userType === 'admin';
      }
      
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ message: "Not authorized to recalculate this quote" });
      }

      const operational = await db.query.operationalServices.findFirst({ where: eq(operationalServices.quoteId, id) });
      const stage = normalizeQuoteStage(quote.workflowStatus);
      if (operational || !([QUOTE_STAGE.DRAFT, QUOTE_STAGE.UNDER_REVIEW] as string[]).includes(stage)) {
        return res.status(409).json({ message: operational ? "Quote has an operational service" : `Quote is ${stage} and cannot be recalculated` });
      }

      // Get inventory items
      const items = await storage.getInventoryByQuote(id);
      
      // Get location-based pricing (extract city from address if possible)
      const originCity = quote.fromAddress?.split(',')[1]?.trim() || undefined;
      const originCountry = quote.fromAddress?.includes('México') ? 'México' : undefined;
      const pricing = await storage.getResolvedPricing(originCity, originCountry);
      
      // Get inventory categories for weight lookup
      const categories = await storage.getInventoryCategories();
      const categoryWeights: Record<string, number> = {};
      categories.forEach(c => {
        categoryWeights[c.key] = parseFloat(c.avgWeightKg?.toString() || '20');
      });

      // Calculate total weight from items
      let totalWeight = 0;
      for (const item of items) {
        const weight = categoryWeights[item.category || 'other'] || 20;
        totalWeight += weight * (item.quantity || 1);
      }

      // Sort trucks by capacity ascending
      const sortedTrucks = [...pricing.truckPricing].sort((a, b) => a.capacityKg - b.capacityKg);
      const largestTruck = sortedTrucks[sortedTrucks.length - 1];

      // Select optimal truck(s)
      let selectedTruck = sortedTrucks[0];
      let truckCount = 1;

      if (totalWeight <= (largestTruck?.capacityKg || 10000)) {
        for (const truck of sortedTrucks) {
          if (truck.capacityKg >= totalWeight) {
            selectedTruck = truck;
            break;
          }
        }
      } else {
        selectedTruck = largestTruck;
        truckCount = Math.ceil(totalWeight / (largestTruck?.capacityKg || 10000));
      }

      // Calculate base cost
      const baseCost = (selectedTruck?.baseRate || 3000) * truckCount;
      const movers = (selectedTruck?.includedMovers || 2) * truckCount;
      const hours = selectedTruck?.baseServiceHours || 4;
      const hourlyRate = selectedTruck?.hourlyRate || 200;

      const laborCost = hours * hourlyRate;
      const totalCost = baseCost + laborCost;

      // Apply variation for low/high estimates
      const lowEstimate = Math.round(totalCost * 0.9);
      const highEstimate = Math.round(totalCost * 1.3);

      // Update quote with new estimates
      const updatedQuote = await storage.updateQuote(id, {
        estimatedCost: totalCost.toFixed(2),
        estimatedCostHigh: highEstimate.toFixed(2),
        estimatedCurrency: pricing.currency || 'MXN',
      });
      const actor = userId ? await storage.getUser(userId) : null;
      await storage.createQuoteActivityLog({
        quoteId: id,
        actionType: "quote.estimate_recalculated",
        actorType: isAdmin ? "admin" : "client",
        actorId: userId || null,
        actorName: actor?.fullName || actor?.email || null,
        description: "Quote estimate recalculated from current inventory",
        descriptionEs: "Estimación recalculada con el inventario actual",
        metadata: {
          reviewVersion: quote.quoteReviewVersion,
          estimate: { low: lowEstimate, high: highEstimate, currency: pricing.currency || "MXN" },
          totalWeightKg: totalWeight,
          recalculatedAt: new Date().toISOString(),
        },
      });

      res.json({ 
        quote: updatedQuote,
        estimate: {
          low: lowEstimate,
          high: highEstimate,
          currency: pricing.currency || 'MXN',
        },
        truckRecommendation: {
          totalWeightKg: totalWeight,
          recommendedTruck: selectedTruck?.name || 'Standard Truck',
          truckCount,
          includedMovers: movers,
          estimatedHours: hours,
        }
      });
    } catch (error: any) {
      console.error('Recalculate quote error:', error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== SERVICES ROUTES ==========

  // Get active services
  app.get("/api/services", async (req: Request, res: Response) => {
    try {
      const services = await storage.getActiveServices();
      res.json({ services });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all services (admin)
  app.get("/api/admin/services", requireAdmin, async (req: Request, res: Response) => {
    try {
      const services = await storage.getAllServices();
      res.json({ services });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create service (admin)
  app.post("/api/admin/services", requireAdmin, async (req: Request, res: Response) => {
    try {
      const service = await storage.createService(req.body);
      res.json({ service });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update service (admin)
  app.patch("/api/admin/services/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const service = await storage.updateService(id, req.body);
      res.json({ service });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/admin/quote-services/:id/follow-up-owner", isAuthenticated, requireAdmin, requirePlatformPermission("module:quotes"), async (req: Request, res: Response) => {
    try {
      const ownerId = typeof req.body?.followUpOwnerId === "string" ? req.body.followUpOwnerId : null;
      if (!ownerId) return res.status(400).json({ message: "followUpOwnerId is required" });
      const owner = await storage.getUser(ownerId);
      if (!owner || owner.userType !== "admin") return res.status(400).json({ message: "Follow-up owner must be an admin team member" });
      await storage.updateQuoteServiceFollowUp(req.params.id, ownerId, getCallerUserId(req));
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Delete service (admin)
  app.delete("/api/admin/services/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteService(id);
      res.json({ message: "Service deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== ADD-ONS ROUTES ==========

  // Get active add-ons
  app.get("/api/addons", async (req: Request, res: Response) => {
    try {
      const addOns = await storage.getActiveAddOns();
      res.json({ addOns });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all add-ons (admin)
  app.get("/api/admin/addons", requireAdmin, async (req: Request, res: Response) => {
    try {
      const addOns = await storage.getAllAddOns();
      res.json({ addOns });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create add-on (admin)
  app.post("/api/admin/addons", requireAdmin, async (req: Request, res: Response) => {
    try {
      const addOn = await storage.createAddOn(req.body);
      res.json({ addOn });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update add-on (admin)
  app.patch("/api/admin/addons/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const addOn = await storage.updateAddOn(id, req.body);
      res.json({ addOn });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete add-on (admin)
  app.delete("/api/admin/addons/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteAddOn(id);
      res.json({ message: "Add-on deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== AI AGENT CONFIG ROUTES (Admin) ==========

  // Get AI agent config
  app.get("/api/admin/ai-config", requireAdmin, async (req: Request, res: Response) => {
    try {
      const config = await storage.getAiAgentConfig();
      res.json({ config: normalizeAiConfig(config) });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get AI agent config (alias for admin UI)
  app.get("/api/admin/ai-agent/config", requireAdmin, async (req: Request, res: Response) => {
    try {
      const config = await storage.getAiAgentConfig();
      res.json(normalizeAiConfig(config) || {});
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Simplified AI config endpoint for Settings page
  app.get("/api/admin/ai-agent-config", requireAdmin, async (req: Request, res: Response) => {
    try {
      const config = await storage.getAiAgentConfig();
      res.json(normalizeAiConfig(config) || { model: DEFAULT_AI_MODEL, temperature: '0.7', maxTokens: 2048 });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // LLM CONFIGURATION ROUTES
  // ============================================
  
  // Get provider connection status
  app.get("/api/admin/llm/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      res.json(await getAiProviderStatus());
    } catch {
      res.status(500).json({
        connected: false,
        error: "Unable to determine AI provider status",
      });
    }
  });
  
  // Update active AI model
  app.post("/api/admin/llm/model", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { model } = req.body;
      
      if (!model) {
        return res.status(400).json({ message: 'Model is required' });
      }
      
      if (!WRITABLE_AI_MODELS.has(model)) {
        return res.status(400).json({ message: `Invalid model. Valid options: ${Array.from(WRITABLE_AI_MODELS).join(', ')}` });
      }
      
      const config = await storage.updateAiAgentConfig({ model });
      res.json({ success: true, model: config.model });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // AI MODELS MANAGEMENT ROUTES
  // ============================================
  
  // Get all AI models
  app.get("/api/admin/ai-models", requireAdmin, async (req: Request, res: Response) => {
    try {
      const models = await storage.getAiModels();
      res.json(models);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create a new AI model
  app.post("/api/admin/ai-models", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { modelId, name, provider, description, descriptionEs, capabilities, isVisionCapable, isReasoningModel, isActive, sortOrder } = req.body;
      
      if (!modelId || !name || !provider) {
        return res.status(400).json({ message: 'modelId, name, and provider are required' });
      }
      if (!WRITABLE_AI_MODELS.has(modelId)) {
        return res.status(400).json({ message: `Unsupported model. Valid options: ${Array.from(WRITABLE_AI_MODELS).join(', ')}` });
      }
      
      // Check if model already exists
      const existing = await storage.getAiModelByModelId(modelId);
      if (existing) {
        return res.status(409).json({ message: `Model with ID "${modelId}" already exists` });
      }
      
      const model = await storage.createAiModel({
        modelId,
        name,
        provider,
        description,
        descriptionEs,
        capabilities: capabilities || [],
        isVisionCapable: isVisionCapable || false,
        isReasoningModel: isReasoningModel || false,
        isActive: isActive !== false,
        sortOrder: sortOrder || 0,
      });
      
      res.status(201).json(model);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update an AI model
  app.put("/api/admin/ai-models/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      if (Object.prototype.hasOwnProperty.call(req.body, "modelId") && !WRITABLE_AI_MODELS.has(req.body.modelId)) {
        return res.status(400).json({ message: `Unsupported model. Valid options: ${Array.from(WRITABLE_AI_MODELS).join(', ')}` });
      }
      if (req.body.isActive === true) {
        const existing = await storage.getAiModelById(id);
        const modelId = req.body.modelId || existing?.modelId;
        if (!modelId || !WRITABLE_AI_MODELS.has(modelId)) {
          return res.status(400).json({ message: `Cannot activate an unsupported model. Valid options: ${Array.from(WRITABLE_AI_MODELS).join(', ')}` });
        }
      }
      const model = await storage.updateAiModel(id, req.body);
      res.json(model);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete an AI model
  app.delete("/api/admin/ai-models/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      // Check if this model is currently active
      const aiConfig = await storage.getAiAgentConfig();
      const modelToDelete = await storage.getAiModelById(id);
      
      if (modelToDelete && aiConfig?.model === modelToDelete.modelId) {
        return res.status(400).json({ message: 'Cannot delete the currently active model. Please select a different active model first.' });
      }
      
      await storage.deleteAiModel(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update AI agent config
  app.patch("/api/admin/ai-config", requireAdmin, async (req: Request, res: Response) => {
    try {
      const modelError = validateAiConfigModelWrite(req.body);
      if (modelError) return res.status(400).json({ message: modelError });
      const config = await storage.updateAiAgentConfig(req.body);
      res.json({ config: normalizeAiConfig(config) });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update AI agent config (PUT alias for admin UI)
  app.put("/api/admin/ai-agent/config", requireAdmin, async (req: Request, res: Response) => {
    try {
      const modelError = validateAiConfigModelWrite(req.body);
      if (modelError) return res.status(400).json({ message: modelError });
      const config = await storage.updateAiAgentConfig(req.body);
      res.json(normalizeAiConfig(config));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Translate AI agent prompt to maintain consistency between languages
  app.post("/api/admin/ai-agent/translate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { field, fromLanguage, sourceText } = req.body;
      
      if (!field || !fromLanguage || !sourceText) {
        return res.status(400).json({ message: "Missing required fields: field, fromLanguage, sourceText" });
      }
      
      const targetLanguage = fromLanguage === 'en' ? 'es' : 'en';
      const targetLangName = targetLanguage === 'en' ? 'English' : 'Spanish';
      const sourceLangName = fromLanguage === 'en' ? 'English' : 'Spanish';
      
      const openai = createAiClient();
      
      // Get centralized AI config for model selection
      const config = await storage.getAiAgentConfig();
      
      const response = await openai.chat.completions.create({
        model: resolveAiModel(config?.model),
        messages: [
          {
            role: "system",
            content: `You are a professional translator specializing in technical and business translations between English and Spanish for a moving company platform.

CRITICAL RULES:
1. Preserve ALL placeholders exactly as they appear: {{CATEGORIES}}, {{ROOMS}}, {{CATALOG}}, {{CONTENT}}
2. Preserve Markdown formatting (bold, bullets, headers)
3. Maintain the same tone and technical accuracy
4. Do not add or remove any content - translate only
5. Return ONLY the translated text, no explanations or quotes`
          },
          {
            role: "user",
            content: `Translate the following ${sourceLangName} text to ${targetLangName}. This is a prompt configuration for an AI moving assistant named "Clara".

TEXT TO TRANSLATE:
${sourceText}`
          }
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });
      
      const translatedText = response.choices[0]?.message?.content?.trim() || '';
      
      if (!translatedText) {
        return res.status(502).json({ message: "Translation failed - empty response from AI" });
      }
      
      res.json({
        translatedText,
        targetLanguage,
        field
      });
    } catch (error: any) {
      console.error('Translation error:', error);
      res.status(502).json({ message: error.message || "Translation failed" });
    }
  });

  // ========== INVENTORY CATEGORIES AND ROOMS (for Clara AI) ==========

  // Get all inventory categories
  app.get("/api/admin/inventory-categories", requireAdmin, async (req: Request, res: Response) => {
    try {
      const categories = await storage.getInventoryCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create inventory category
  app.post("/api/admin/inventory-categories", requireAdmin, async (req: Request, res: Response) => {
    try {
      const category = await storage.createInventoryCategory(req.body);
      res.json(category);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update inventory category
  app.put("/api/admin/inventory-categories/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const category = await storage.updateInventoryCategory(req.params.id, req.body);
      res.json(category);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete inventory category
  app.delete("/api/admin/inventory-categories/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteInventoryCategory(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Generate AI weight estimates for all inventory categories
  app.post("/api/admin/inventory-categories/generate-weights", requireAdmin, async (req: Request, res: Response) => {
    try {
      const categories = await storage.getInventoryCategories();
      
      const openai = createAiClient();
      
      // Get centralized AI config for model selection
      const config = await storage.getAiAgentConfig();

      const categoriesForAI = categories.map(c => ({
        key: c.key,
        labelEn: c.labelEn,
        description: c.description
      }));

      const response = await openai.chat.completions.create({
        model: resolveAiModel(config?.model),
        messages: [
          {
            role: "system",
            content: `You are an expert in moving and logistics. Estimate the average weight in kilograms for household items. Be realistic and accurate based on typical items in each category. Return a JSON array with objects containing: key (category key), avgWeightKg (average weight per item in kg as number), minWeightKg (minimum typical weight as number), maxWeightKg (maximum typical weight as number). Only return valid JSON, no markdown or explanations.`
          },
          {
            role: "user",
            content: `Estimate weights for these moving inventory categories:\n${JSON.stringify(categoriesForAI, null, 2)}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const parsed = JSON.parse(content);
      const weights = parsed.categories || parsed.weights || parsed;
      
      // Update each category with the AI-generated weights
      const updates: any[] = [];
      for (const weight of (Array.isArray(weights) ? weights : [])) {
        const category = categories.find(c => c.key === weight.key);
        if (category) {
          const updated = await storage.updateInventoryCategory(category.id, {
            avgWeightKg: String(weight.avgWeightKg),
            minWeightKg: String(weight.minWeightKg),
            maxWeightKg: String(weight.maxWeightKg)
          });
          updates.push({ key: weight.key, ...weight, updated: true });
        }
      }

      res.json({ 
        success: true, 
        message: `Updated weights for ${updates.length} categories`,
        updates 
      });
    } catch (error: any) {
      console.error("Error generating weights:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get all inventory rooms
  app.get("/api/admin/inventory-rooms", requireAdmin, async (req: Request, res: Response) => {
    try {
      const rooms = await storage.getInventoryRooms();
      res.json(rooms);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create inventory room
  app.post("/api/admin/inventory-rooms", requireAdmin, async (req: Request, res: Response) => {
    try {
      const room = await storage.createInventoryRoom(req.body);
      res.json(room);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update inventory room
  app.put("/api/admin/inventory-rooms/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const room = await storage.updateInventoryRoom(req.params.id, req.body);
      res.json(room);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete inventory room
  app.delete("/api/admin/inventory-rooms/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteInventoryRoom(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== CATEGORY & ROOM KEYWORDS (for CSV/Document parsing inference) ==========

  // Get all category keywords
  app.get("/api/admin/category-keywords", requireAdmin, async (req: Request, res: Response) => {
    try {
      const keywords = await storage.getCategoryKeywords();
      res.json(keywords);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get category keywords by category key
  app.get("/api/admin/category-keywords/by-category/:categoryKey", requireAdmin, async (req: Request, res: Response) => {
    try {
      const keywords = await storage.getCategoryKeywordsByCategory(req.params.categoryKey);
      res.json(keywords);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create category keyword
  app.post("/api/admin/category-keywords", requireAdmin, async (req: Request, res: Response) => {
    try {
      const keyword = await storage.createCategoryKeyword(req.body);
      res.json(keyword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update category keyword
  app.put("/api/admin/category-keywords/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const keyword = await storage.updateCategoryKeyword(req.params.id, req.body);
      res.json(keyword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete category keyword
  app.delete("/api/admin/category-keywords/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteCategoryKeyword(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get all room keywords
  app.get("/api/admin/room-keywords", requireAdmin, async (req: Request, res: Response) => {
    try {
      const keywords = await storage.getRoomKeywords();
      res.json(keywords);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get room keywords by room key
  app.get("/api/admin/room-keywords/by-room/:roomKey", requireAdmin, async (req: Request, res: Response) => {
    try {
      const keywords = await storage.getRoomKeywordsByRoom(req.params.roomKey);
      res.json(keywords);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create room keyword
  app.post("/api/admin/room-keywords", requireAdmin, async (req: Request, res: Response) => {
    try {
      const keyword = await storage.createRoomKeyword(req.body);
      res.json(keyword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update room keyword
  app.put("/api/admin/room-keywords/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const keyword = await storage.updateRoomKeyword(req.params.id, req.body);
      res.json(keyword);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete room keyword
  app.delete("/api/admin/room-keywords/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteRoomKeyword(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== PRESET INVENTORIES (Admin) ==========
  
  // Get all preset inventory sets
  app.get("/api/admin/preset-inventories", requireAdmin, async (req: Request, res: Response) => {
    try {
      const sets = await storage.getAllPresetInventorySets();
      res.json(sets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get single preset inventory set with items
  app.get("/api/admin/preset-inventories/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const set = await storage.getPresetInventorySet(req.params.id);
      if (!set) {
        return res.status(404).json({ message: "Preset inventory not found" });
      }
      const items = await storage.getPresetInventoryItems(req.params.id);
      res.json({ ...set, items });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create preset inventory set
  app.post("/api/admin/preset-inventories", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { items, ...setData } = req.body;
      const set = await storage.createPresetInventorySet(setData);
      if (items && items.length > 0) {
        await storage.replacePresetInventoryItems(set.id, items);
      }
      res.json(set);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update preset inventory set
  app.put("/api/admin/preset-inventories/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { items, ...setData } = req.body;
      const set = await storage.updatePresetInventorySet(req.params.id, setData);
      if (items !== undefined) {
        await storage.replacePresetInventoryItems(req.params.id, items);
      }
      res.json(set);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete preset inventory set
  app.delete("/api/admin/preset-inventories/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deletePresetInventorySet(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create preset inventory item
  app.post("/api/admin/preset-inventory-items", requireAdmin, async (req: Request, res: Response) => {
    try {
      const item = await storage.createPresetInventoryItem(req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update preset inventory item
  app.put("/api/admin/preset-inventory-items/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const item = await storage.updatePresetInventoryItem(req.params.id, req.body);
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete preset inventory item
  app.delete("/api/admin/preset-inventory-items/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deletePresetInventoryItem(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Generate preset inventories using AI
  app.post("/api/admin/preset-inventories/generate", requireAdmin, async (req: Request, res: Response) => {
    try {
      const categories = await storage.getInventoryCategories();
      const rooms = await storage.getInventoryRooms();
      
      const openai = createAiClient();
      
      // Get centralized AI config for model selection
      const aiConfig = await storage.getAiAgentConfig();
      
      const homeSizes = ['studio', '1br', '2br', '3br', '4br'];
      const homeSizeLabels: Record<string, { en: string; es: string; desc_en: string; desc_es: string }> = {
        studio: { en: 'Studio', es: 'Estudio', desc_en: 'Compact studio apartment', desc_es: 'Departamento estudio compacto' },
        '1br': { en: '1 Bedroom', es: '1 Recámara', desc_en: 'One bedroom apartment', desc_es: 'Departamento de una recámara' },
        '2br': { en: '2 Bedrooms', es: '2 Recámaras', desc_en: 'Two bedroom apartment or small house', desc_es: 'Departamento de dos recámaras o casa pequeña' },
        '3br': { en: '3 Bedrooms', es: '3 Recámaras', desc_en: 'Three bedroom house', desc_es: 'Casa de tres recámaras' },
        '4br': { en: '4+ Bedrooms', es: '4+ Recámaras', desc_en: 'Large house with four or more bedrooms', desc_es: 'Casa grande con cuatro o más recámaras' },
      };
      
      const roomList = rooms.filter(r => r.isActive).map(r => `${r.key}: ${r.labelEn}`).join(', ');
      const categoryList = categories.filter(c => c.isActive).map(c => `${c.key}: ${c.labelEn}`).join(', ');
      
      const prompt = `Generate a typical furniture inventory for each of these home sizes: ${homeSizes.join(', ')}.

Available rooms: ${roomList}
Available furniture categories: ${categoryList}

For each home size, create a realistic inventory that a typical family or person would have. Consider:
- Studio: minimal furniture for one person
- 1BR: basic furniture for 1-2 people
- 2BR: furniture for small family or couple
- 3BR: furniture for family with children
- 4BR: larger family with more furniture

Return a JSON object with this exact structure:
{
  "studio": [
    { "itemName": "Queen Bed", "itemNameEs": "Cama Queen", "roomKey": "bedroom_1", "categoryKey": "beds_medium", "defaultQuantity": 1 },
    ...
  ],
  "1br": [...],
  "2br": [...],
  "3br": [...],
  "4br": [...]
}

Use realistic quantities. Include common items like sofas, beds, tables, chairs, refrigerator, washing machine, boxes, etc.
ONLY return valid JSON, no explanations.`;

      const response = await openai.chat.completions.create({
        model: resolveAiModel(aiConfig?.model),
        messages: [
          { role: "system", content: "You are a moving inventory expert. Generate realistic furniture inventories in JSON format." },
          { role: "user", content: prompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4000,
        validateJson: isPresetInventoryResponse,
      });
      
      const content = response.choices[0]?.message?.content || '{}';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("Invalid AI response format");
      }
      
      const inventories = JSON.parse(jsonMatch[0]);
      const createdSets = [];
      
      for (const homeSize of homeSizes) {
        const items = inventories[homeSize] || [];
        const labels = homeSizeLabels[homeSize];
        
        // Check if preset already exists
        const existing = await storage.getPresetInventorySetByKey(homeSize);
        
        if (existing) {
          // Update existing
          await storage.updatePresetInventorySet(existing.id, {
            generatedViaAi: true,
            aiPrompt: prompt,
          });
          await storage.replacePresetInventoryItems(existing.id, items);
          createdSets.push({ ...existing, items, updated: true });
        } else {
          // Create new
          const set = await storage.createPresetInventorySet({
            key: homeSize,
            titleEn: labels.en,
            titleEs: labels.es,
            descriptionEn: labels.desc_en,
            descriptionEs: labels.desc_es,
            homeSize: homeSize,
            sortOrder: homeSizes.indexOf(homeSize),
            isActive: true,
            generatedViaAi: true,
            aiPrompt: prompt,
          });
          await storage.replacePresetInventoryItems(set.id, items);
          createdSets.push({ ...set, items, created: true });
        }
      }
      
      res.json({ success: true, presets: createdSets });
    } catch (error: any) {
      console.error('AI generation error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Public endpoint for preset inventories (for Clara)
  app.get("/api/preset-inventories", async (req: Request, res: Response) => {
    try {
      const sets = await storage.getActivePresetInventorySets();
      res.json(sets);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Public endpoint to get preset inventory items by key
  app.get("/api/preset-inventories/:key/items", async (req: Request, res: Response) => {
    try {
      const set = await storage.getPresetInventorySetByKey(req.params.key);
      if (!set || !set.isActive) {
        return res.status(404).json({ message: "Preset inventory not found" });
      }
      const items = await storage.getPresetInventoryItems(set.id);
      res.json({ set, items });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== TRUCK TYPES MANAGEMENT (Admin) ==========

  // Get all truck types
  app.get("/api/admin/truck-types", requireAdmin, async (req: Request, res: Response) => {
    try {
      const trucks = await storage.getTruckTypes();
      res.json(trucks);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create truck type
  app.post("/api/admin/truck-types", requireAdmin, async (req: Request, res: Response) => {
    try {
      const truck = await storage.createTruckType(req.body);
      res.json(truck);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update truck type
  app.put("/api/admin/truck-types/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const truck = await storage.updateTruckType(req.params.id, req.body);
      res.json(truck);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete truck type
  app.delete("/api/admin/truck-types/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteTruckType(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint to get active truck types (for quotes)
  app.get("/api/truck-types", async (req: Request, res: Response) => {
    try {
      const trucks = await storage.getTruckTypes();
      res.json(trucks.filter(t => t.isActive));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== PRICING MANAGEMENT (Admin) ==========

  // Pricing Templates CRUD
  app.get("/api/admin/pricing-templates", requireAdmin, async (req: Request, res: Response) => {
    try {
      const templates = await storage.getAllPricingTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/pricing-templates", requireAdmin, async (req: Request, res: Response) => {
    try {
      const template = await storage.createPricingTemplate(req.body);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/pricing-templates/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const template = await storage.updatePricingTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/pricing-templates/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deletePricingTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Countries CRUD
  app.get("/api/admin/countries", requireAdmin, async (req: Request, res: Response) => {
    try {
      const countries = await storage.getAllCountries();
      res.json(countries);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/countries", requireAdmin, async (req: Request, res: Response) => {
    try {
      const country = await storage.createCountry(req.body);
      res.json(country);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/countries/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const country = await storage.updateCountry(req.params.id, req.body);
      res.json(country);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/countries/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteCountry(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Cities CRUD
  app.get("/api/admin/cities", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { countryId } = req.query;
      const cities = countryId 
        ? await storage.getCitiesByCountry(countryId as string)
        : await storage.getAllCities();
      res.json(cities);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/cities", requireAdmin, async (req: Request, res: Response) => {
    try {
      const city = await storage.createCity(req.body);
      res.json(city);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/cities/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const city = await storage.updateCity(req.params.id, req.body);
      res.json(city);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/cities/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteCity(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // City truck pricing routes
  app.get("/api/admin/cities/:cityId/truck-pricing", requireAdmin, async (req: Request, res: Response) => {
    try {
      const pricing = await storage.getCityTruckPricing(req.params.cityId);
      res.json(pricing);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/cities/:cityId/truck-pricing", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { truckTypeId, baseRate, hourlyRate, perKmRate, baseServiceHours, includedMovers, usableVolumeFactor } = req.body;
      const pricing = await storage.upsertCityTruckPricing({
        cityId: req.params.cityId,
        truckTypeId,
        baseRate,
        hourlyRate,
        perKmRate,
        baseServiceHours: baseServiceHours || '3.0',
        includedMovers: includedMovers || 2,
        usableVolumeFactor: usableVolumeFactor || '0.85',
      });
      res.json(pricing);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/cities/:cityId/truck-pricing/:truckTypeId", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteCityTruckPricing(req.params.cityId, req.params.truckTypeId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== TIMEZONE MANAGEMENT ==========
  
  // Get active timezones from cities (public endpoint for timezone pickers)
  app.get("/api/timezones/active", async (req: Request, res: Response) => {
    try {
      const timezones = await storage.getActiveTimezones();
      res.json(timezones);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update current user's timezone (auto-detected or manual)
  app.patch("/api/user/timezone", requireAuth, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const userId = user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { timezone, source } = req.body;
      
      if (!timezone || typeof timezone !== 'string') {
        return res.status(400).json({ message: "Timezone is required" });
      }
      
      // Validate timezone is a valid IANA timezone
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch {
        return res.status(400).json({ message: "Invalid timezone" });
      }
      
      const validSources = ['detected', 'manual', 'admin_override'];
      const timezoneSource = validSources.includes(source) ? source : 'detected';
      
      const updated = await storage.updateUser(userId, {
        timezone,
        timezoneSource,
        timezoneDetectedAt: new Date(),
      });
      
      res.json({ 
        timezone: updated.timezone, 
        timezoneSource: updated.timezoneSource,
        timezoneDetectedAt: updated.timezoneDetectedAt,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Resolve pricing for a location (public, used by Clara)
  app.get("/api/pricing/resolve", async (req: Request, res: Response) => {
    try {
      const { city, country } = req.query;
      const pricing = await storage.getResolvedPricing(
        city as string | undefined, 
        country as string | undefined
      );
      res.json(pricing);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== PRICING DEFAULTS (Admin) ==========
  
  app.get("/api/admin/pricing-defaults", requireAdmin, async (req: Request, res: Response) => {
    try {
      const defaults = await storage.getPricingDefaults();
      res.json(defaults || {});
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/pricing-defaults", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const defaults = await storage.updatePricingDefaults({
        ...req.body,
        updatedBy: user?.id,
      });
      res.json(defaults);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== PRICING FORMULA PARAMETERS (Admin) ==========
  
  app.get("/api/admin/pricing-formula-parameters", requireAdmin, async (req: Request, res: Response) => {
    try {
      const params = await storage.getAllPricingFormulaParameters();
      res.json(params);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/pricing-formula-parameters", requireAdmin, async (req: Request, res: Response) => {
    try {
      const param = await storage.createPricingFormulaParameter(req.body);
      res.json(param);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/pricing-formula-parameters/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const param = await storage.updatePricingFormulaParameter(req.params.id, req.body);
      res.json(param);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/pricing-formula-parameters/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deletePricingFormulaParameter(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== AI PRICING PROMPTS (Admin) ==========
  
  app.get("/api/admin/ai-pricing-prompts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const prompts = await storage.getAllAiPricingPrompts();
      res.json(prompts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/admin/ai-pricing-prompts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const prompt = await storage.getAiPricingPrompt(req.params.id);
      if (!prompt) {
        return res.status(404).json({ message: "Prompt not found" });
      }
      res.json(prompt);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/admin/ai-pricing-prompts", requireAdmin, async (req: Request, res: Response) => {
    try {
      const prompt = await storage.createAiPricingPrompt(req.body);
      res.json(prompt);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/ai-pricing-prompts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const prompt = await storage.updateAiPricingPrompt(req.params.id, req.body);
      res.json(prompt);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.delete("/api/admin/ai-pricing-prompts/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteAiPricingPrompt(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ============================================
  // STRIPE PAYMENTS ROUTES
  // ============================================
  
  // Helper to get current keys from a profile based on its active mode
  function getProfileKeys(profile: any): { secretKey?: string; publishableKey?: string } {
    const mode = profile.activeMode || 'sandbox';
    if (mode === 'live') {
      return {
        secretKey: profile.liveSecretKey || profile.secretKey,
        publishableKey: profile.livePublishableKey || profile.publishableKey,
      };
    }
    return {
      secretKey: profile.sandboxSecretKey || profile.secretKey,
      publishableKey: profile.sandboxPublishableKey || profile.publishableKey,
    };
  }
  
  // Helper to mask a key for display
  function maskKey(key?: string | null): string {
    if (!key) return '';
    return key.substring(0, 12) + '...' + key.slice(-4);
  }
  
  // Helper function to get active Stripe keys (profile > env vars)
  async function getActiveStripeKeys(): Promise<{ secretKey?: string; publishableKey?: string; profileId?: string; profileName?: string; mode?: string }> {
    const activeProfile = await storage.getActiveStripeProfile();
    if (activeProfile) {
      const keys = getProfileKeys(activeProfile);
      return {
        ...keys,
        profileId: activeProfile.id,
        profileName: activeProfile.name,
        mode: activeProfile.activeMode || 'sandbox',
      };
    }
    return {
      secretKey: process.env.STRIPE_SECRET_KEY,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    };
  }
  
  // Get all Stripe profiles
  app.get("/api/admin/stripe/profiles", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const profiles = await storage.getStripeProfiles();
      // Map profiles with masked keys and availability info
      const maskedProfiles = profiles.map(p => ({
        id: p.id,
        name: p.name,
        activeMode: p.activeMode || 'sandbox',
        accountId: p.accountId,
        accountName: p.accountName,
        isActive: p.isActive,
        createdAt: p.createdAt,
        // Show which key sets are configured
        hasSandboxKeys: !!(p.sandboxSecretKey || (p.secretKey?.startsWith('sk_test_'))),
        hasLiveKeys: !!(p.liveSecretKey || (p.secretKey?.startsWith('sk_live_'))),
        // Masked keys for display
        sandboxSecretKey: maskKey(p.sandboxSecretKey),
        sandboxPublishableKey: maskKey(p.sandboxPublishableKey),
        liveSecretKey: maskKey(p.liveSecretKey),
        livePublishableKey: maskKey(p.livePublishableKey),
        // Legacy masked keys (if still using old format)
        secretKey: maskKey(p.secretKey),
        publishableKey: maskKey(p.publishableKey),
      }));
      res.json(maskedProfiles);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create new Stripe profile with dual keys
  app.post("/api/admin/stripe/profiles", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { name, sandboxSecretKey, sandboxPublishableKey, liveSecretKey, livePublishableKey, isActive } = req.body;
      const userId = getActiveUserId(req);
      
      if (!name) {
        return res.status(400).json({ message: 'Profile name is required' });
      }
      
      // At least one set of keys required
      const hasSandbox = sandboxSecretKey && sandboxPublishableKey;
      const hasLive = liveSecretKey && livePublishableKey;
      
      if (!hasSandbox && !hasLive) {
        return res.status(400).json({ message: 'At least one set of keys (sandbox or production) is required' });
      }
      
      // Validate sandbox key formats if provided
      if (sandboxSecretKey && !sandboxSecretKey.startsWith('sk_test_')) {
        return res.status(400).json({ message: 'Sandbox secret key must start with sk_test_' });
      }
      if (sandboxPublishableKey && !sandboxPublishableKey.startsWith('pk_test_')) {
        return res.status(400).json({ message: 'Sandbox publishable key must start with pk_test_' });
      }
      
      // Validate live key formats if provided
      if (liveSecretKey && !liveSecretKey.startsWith('sk_live_')) {
        return res.status(400).json({ message: 'Production secret key must start with sk_live_' });
      }
      if (livePublishableKey && !livePublishableKey.startsWith('pk_live_')) {
        return res.status(400).json({ message: 'Production publishable key must start with pk_live_' });
      }
      
      // Verify at least one key works and get account info
      let accountId: string | undefined;
      let accountName: string | undefined;
      const keyToVerify = liveSecretKey || sandboxSecretKey;
      
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(keyToVerify);
        const account = await stripe.accounts.retrieve();
        accountId = account.id;
        accountName = account.business_profile?.name || account.settings?.dashboard?.display_name || undefined;
      } catch (stripeError: any) {
        return res.status(400).json({ message: `Invalid key: ${stripeError.message}` });
      }
      
      const profile = await storage.createStripeProfile({
        name,
        sandboxSecretKey: sandboxSecretKey || null,
        sandboxPublishableKey: sandboxPublishableKey || null,
        liveSecretKey: liveSecretKey || null,
        livePublishableKey: livePublishableKey || null,
        activeMode: hasLive ? 'live' : 'sandbox',
        accountId,
        accountName,
        isActive: isActive || false,
        createdBy: userId,
      });
      
      res.json({ 
        success: true, 
        message: 'Stripe profile created successfully',
        profile: {
          id: profile.id,
          name: profile.name,
          activeMode: profile.activeMode,
          hasSandboxKeys: !!profile.sandboxSecretKey,
          hasLiveKeys: !!profile.liveSecretKey,
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update Stripe profile with dual keys support
  app.patch("/api/admin/stripe/profiles/:id", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { name, sandboxSecretKey, sandboxPublishableKey, liveSecretKey, livePublishableKey } = req.body;
      
      const existing = await storage.getStripeProfile(id);
      if (!existing) {
        return res.status(404).json({ message: 'Profile not found' });
      }
      
      const updateData: any = {};
      if (name) updateData.name = name;
      
      // Update sandbox keys if provided
      if (sandboxSecretKey) {
        if (!sandboxSecretKey.startsWith('sk_test_')) {
          return res.status(400).json({ message: 'Sandbox secret key must start with sk_test_' });
        }
        updateData.sandboxSecretKey = sandboxSecretKey;
      }
      if (sandboxPublishableKey) {
        if (!sandboxPublishableKey.startsWith('pk_test_')) {
          return res.status(400).json({ message: 'Sandbox publishable key must start with pk_test_' });
        }
        updateData.sandboxPublishableKey = sandboxPublishableKey;
      }
      
      // Update live keys if provided
      if (liveSecretKey) {
        if (!liveSecretKey.startsWith('sk_live_')) {
          return res.status(400).json({ message: 'Production secret key must start with sk_live_' });
        }
        updateData.liveSecretKey = liveSecretKey;
      }
      if (livePublishableKey) {
        if (!livePublishableKey.startsWith('pk_live_')) {
          return res.status(400).json({ message: 'Production publishable key must start with pk_live_' });
        }
        updateData.livePublishableKey = livePublishableKey;
      }
      
      // Verify one of the new keys works if provided
      const keyToVerify = liveSecretKey || sandboxSecretKey;
      if (keyToVerify) {
        try {
          const Stripe = (await import('stripe')).default;
          const stripe = new Stripe(keyToVerify);
          const account = await stripe.accounts.retrieve();
          updateData.accountId = account.id;
          updateData.accountName = account.business_profile?.name || account.settings?.dashboard?.display_name;
        } catch (stripeError: any) {
          return res.status(400).json({ message: `Invalid key: ${stripeError.message}` });
        }
      }
      
      const profile = await storage.updateStripeProfile(id, updateData);
      
      res.json({ 
        success: true, 
        message: 'Profile updated successfully',
        profile: {
          id: profile.id,
          name: profile.name,
          activeMode: profile.activeMode,
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Toggle profile mode (sandbox <-> live)
  app.post("/api/admin/stripe/profiles/:id/toggle-mode", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { mode } = req.body;
      
      if (!mode || !['sandbox', 'live'].includes(mode)) {
        return res.status(400).json({ message: 'Mode must be "sandbox" or "live"' });
      }
      
      const profile = await storage.getStripeProfile(id);
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }
      
      // Check if the requested mode has keys configured
      if (mode === 'live') {
        const hasLiveKeys = profile.liveSecretKey || (profile.secretKey?.startsWith('sk_live_'));
        if (!hasLiveKeys) {
          return res.status(400).json({ message: 'Production keys not configured for this profile' });
        }
      } else {
        const hasSandboxKeys = profile.sandboxSecretKey || (profile.secretKey?.startsWith('sk_test_'));
        if (!hasSandboxKeys) {
          return res.status(400).json({ message: 'Sandbox keys not configured for this profile' });
        }
      }
      
      await storage.updateStripeProfile(id, { activeMode: mode });
      
      res.json({ 
        success: true, 
        message: mode === 'live' 
          ? 'Switched to production mode - real charges will be made'
          : 'Switched to sandbox mode - test transactions only'
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Set active Stripe profile
  app.post("/api/admin/stripe/profiles/:id/activate", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const profile = await storage.getStripeProfile(id);
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }
      
      await storage.setActiveStripeProfile(id);
      
      res.json({ 
        success: true, 
        message: `"${profile.name}" is now the active Stripe account`
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Deactivate all profiles (use env vars)
  app.post("/api/admin/stripe/profiles/deactivate-all", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const profiles = await storage.getStripeProfiles();
      for (const profile of profiles) {
        if (profile.isActive) {
          await storage.updateStripeProfile(profile.id, { isActive: false });
        }
      }
      
      res.json({ 
        success: true, 
        message: 'All profiles deactivated. Using environment configuration.'
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete Stripe profile
  app.delete("/api/admin/stripe/profiles/:id", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      
      const profile = await storage.getStripeProfile(id);
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }
      
      if (profile.isActive) {
        return res.status(400).json({ message: 'Cannot delete the active profile. Please activate another profile first.' });
      }
      
      await storage.deleteStripeProfile(id);
      
      res.json({ 
        success: true, 
        message: 'Profile deleted successfully'
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get Stripe connection status (uses active profile or env vars)
  app.get("/api/admin/stripe/status", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { secretKey, profileId, profileName } = await getActiveStripeKeys();
      
      if (!secretKey) {
        return res.json({
          connected: false,
          mode: 'none',
          source: 'none',
          lastChecked: new Date().toISOString(),
          error: 'No Stripe configuration. Add a profile or set environment variables.'
        });
      }
      
      const isLiveMode = secretKey.startsWith('sk_live_');
      const isSandboxMode = secretKey.startsWith('sk_test_');
      
      if (!isLiveMode && !isSandboxMode) {
        return res.json({
          connected: false,
          mode: 'none',
          source: profileId ? 'profile' : 'environment',
          profileId,
          profileName,
          lastChecked: new Date().toISOString(),
          error: 'Invalid Stripe key format'
        });
      }
      
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(secretKey);
        const account = await stripe.accounts.retrieve();
        
        res.json({
          connected: true,
          mode: isLiveMode ? 'live' : 'sandbox',
          source: profileId ? 'profile' : 'environment',
          profileId,
          profileName,
          accountId: account.id,
          accountName: account.business_profile?.name || account.settings?.dashboard?.display_name || undefined,
          lastChecked: new Date().toISOString()
        });
      } catch (stripeError: any) {
        res.json({
          connected: false,
          mode: 'none',
          source: profileId ? 'profile' : 'environment',
          profileId,
          profileName,
          lastChecked: new Date().toISOString(),
          error: stripeError.message || 'Failed to connect to Stripe'
        });
      }
    } catch (error: any) {
      res.status(500).json({ 
        connected: false,
        mode: 'none',
        source: 'none',
        lastChecked: new Date().toISOString(),
        error: error.message 
      });
    }
  });
  
  // Test Stripe connection
  app.post("/api/admin/stripe/test-connection", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { secretKey } = await getActiveStripeKeys();
      
      if (!secretKey) {
        return res.status(400).json({ 
          success: false,
          message: 'No Stripe configuration. Add a profile or set environment variables.' 
        });
      }
      
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(secretKey);
      
      const products = await stripe.products.list({ limit: 1 });
      
      res.json({ 
        success: true,
        message: `Connection successful! Found ${products.data.length > 0 ? 'products' : 'no products yet'} in your Stripe account.`
      });
    } catch (error: any) {
      res.status(400).json({ 
        success: false,
        message: `Connection failed: ${error.message}` 
      });
    }
  });
  
  // Get status for a specific profile
  app.get("/api/admin/stripe/profiles/:id/status", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { mode: queryMode } = req.query; // Optional: check specific mode
      const profile = await storage.getStripeProfile(id);
      
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }
      
      // Get the keys for the current (or requested) mode
      const checkMode = (queryMode as string) || profile.activeMode || 'sandbox';
      const keys = checkMode === 'live' 
        ? { secretKey: profile.liveSecretKey || profile.secretKey, publishableKey: profile.livePublishableKey || profile.publishableKey }
        : { secretKey: profile.sandboxSecretKey || profile.secretKey, publishableKey: profile.sandboxPublishableKey || profile.publishableKey };
      
      if (!keys.secretKey) {
        return res.json({
          connected: false,
          mode: checkMode,
          activeMode: profile.activeMode,
          hasSandboxKeys: !!(profile.sandboxSecretKey || profile.secretKey?.startsWith('sk_test_')),
          hasLiveKeys: !!(profile.liveSecretKey || profile.secretKey?.startsWith('sk_live_')),
          lastChecked: new Date().toISOString(),
          error: `No ${checkMode} keys configured`
        });
      }
      
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(keys.secretKey);
        const account = await stripe.accounts.retrieve();
        
        res.json({
          connected: true,
          mode: checkMode,
          activeMode: profile.activeMode,
          hasSandboxKeys: !!(profile.sandboxSecretKey || profile.secretKey?.startsWith('sk_test_')),
          hasLiveKeys: !!(profile.liveSecretKey || profile.secretKey?.startsWith('sk_live_')),
          accountId: account.id,
          accountName: account.business_profile?.name || account.settings?.dashboard?.display_name || undefined,
          country: account.country,
          email: account.email,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
          lastChecked: new Date().toISOString()
        });
      } catch (stripeError: any) {
        res.json({
          connected: false,
          mode: checkMode,
          activeMode: profile.activeMode,
          hasSandboxKeys: !!(profile.sandboxSecretKey || profile.secretKey?.startsWith('sk_test_')),
          hasLiveKeys: !!(profile.liveSecretKey || profile.secretKey?.startsWith('sk_live_')),
          lastChecked: new Date().toISOString(),
          error: stripeError.message || 'Failed to connect to Stripe'
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get transactions for a specific profile
  app.get("/api/admin/stripe/profiles/:id/transactions", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { limit = '10', starting_after } = req.query;
      
      const profile = await storage.getStripeProfile(id);
      
      if (!profile) {
        return res.status(404).json({ message: 'Profile not found' });
      }
      
      // Get keys based on active mode
      const keys = getProfileKeys(profile);
      
      if (!keys.secretKey) {
        return res.json({
          transactions: [],
          hasMore: false,
          message: 'No keys configured for current mode'
        });
      }
      
      try {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(keys.secretKey);
        
        const params: any = { limit: parseInt(limit as string) };
        if (starting_after) {
          params.starting_after = starting_after;
        }
        
        const charges = await stripe.charges.list(params);
        
        res.json({
          transactions: charges.data.map(charge => ({
            id: charge.id,
            amount: charge.amount / 100,
            currency: charge.currency.toUpperCase(),
            status: charge.status,
            description: charge.description,
            customerEmail: charge.billing_details?.email,
            created: new Date(charge.created * 1000).toISOString(),
            receiptUrl: charge.receipt_url,
          })),
          hasMore: charges.has_more,
          lastId: charges.data.length > 0 ? charges.data[charges.data.length - 1].id : null,
        });
      } catch (stripeError: any) {
        res.status(400).json({ 
          message: `Failed to fetch transactions: ${stripeError.message}`,
          transactions: []
        });
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint for inventory categories/rooms (for frontend display)
  app.get("/api/inventory-categories", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getInventoryCategories();
      res.json(categories.filter(c => c.isActive));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/inventory-rooms", async (req: Request, res: Response) => {
    try {
      const rooms = await storage.getInventoryRooms();
      res.json(rooms.filter(r => r.isActive));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public endpoint for inventory catalog items (for visual inventory picker)
  app.get("/api/inventory-catalog", async (req: Request, res: Response) => {
    try {
      const catalogItems = await storage.getCatalogItems();
      res.json(catalogItems);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== CLARA AI CHAT (Inventory Assistant) ==========

  // Clara chat endpoint for inventory collection and cost estimation
  app.post("/api/clara/chat", async (req: Request, res: Response) => {
    try {
      const { message, conversationHistory, inventory, language = 'es', originCity, originCountry } = req.body;
      
      // Log inventory stats for debugging
      const inventoryCount = (inventory || []).length;
      const totalQuantity = (inventory || []).reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);
      console.log(`[Clara] Received inventory: ${inventoryCount} unique items, ${totalQuantity} total quantity`);
      
      if (!message) {
        return res.status(400).json({ message: "Message is required" });
      }

      // Get AI agent config
      const config = await storage.getAiAgentConfig();
      if (!config || !config.active) {
        return res.status(503).json({ message: "AI assistant is currently unavailable" });
      }

      // Get location-based pricing (fallback to defaults if not found)
      const pricing = await storage.getResolvedPricing(originCity, originCountry);
      
      // Get active AI pricing prompt for additional instructions
      const aiPricingPrompt = await storage.getActiveAiPricingPrompt('global');

      const openai = createAiClient();

      // Build the system prompt
      const isSpanish = language === 'es';
      const mission = isSpanish ? config.missionEs : config.mission;
      const guardrails = isSpanish ? config.guardrailsEs : config.guardrails;
      const inventoryRules = isSpanish ? config.inventoryRulesEs : config.inventoryRules;
      const costRules = isSpanish ? config.costEstimationRulesEs : config.costEstimationRules;

      // Get dynamic categories, rooms, truck types, and catalog items from database
      const categories = await storage.getInventoryCategories();
      const rooms = await storage.getInventoryRooms();
      const truckTypes = await storage.getTruckTypes();
      const catalogItems = await storage.getCatalogItems();
      
      // Build categories with weight information for AI estimation
      const categoriesText = categories.filter(c => c.isActive).map(c => 
        `- ${c.key}: ${c.description || c.labelEs} (peso promedio: ${c.avgWeightKg || 20}kg, rango: ${c.minWeightKg || 5}-${c.maxWeightKg || 50}kg)`
      ).join('\n');
      
      const roomsText = rooms.filter(r => r.isActive).map(r => 
        `- ${r.key}: ${r.labelEs} / ${r.labelEn}`
      ).join('\n');

      // Sort trucks by capacity ascending and build reference for AI
      const sortedTrucks = [...pricing.truckPricing].sort((a, b) => a.capacityKg - b.capacityKg);
      const largestTruck = sortedTrucks[sortedTrucks.length - 1];
      
      const trucksText = sortedTrucks.map(t => {
        const capacityM3 = parseFloat(t.capacityM3?.toString() || '0');
        const usableFactor = parseFloat(t.usableVolumeFactor?.toString() || '0.85');
        const usableM3 = Math.round(capacityM3 * usableFactor * 10) / 10;
        return `- ${t.nameEs}: ${t.capacityKg}kg peso, ${capacityM3}m³ volumen (${usableM3}m³ útil), ${t.includedMovers} cargadores, ${t.baseServiceHours}hrs base, $${t.baseRate} base, $${t.hourlyRate}/hr extra, $${t.perKmRate}/km`;
      }).join('\n');

      // Build location context for pricing
      const locationContext = pricing.cityName 
        ? `Ciudad: ${pricing.cityName} (${pricing.countryCode || 'N/A'})`
        : pricing.countryCode 
          ? `País: ${pricing.countryCode}` 
          : 'Ubicación no especificada';

      // General pricing that applies to all trucks
      const generalPricingText = `
- Cargador adicional: $${pricing.extraMoverRate} por cargador extra
- Tarifa por hora por cargador: $${pricing.moverHourlyRate}/hr
- Multiplicador mudanza compleja: x${pricing.complicatedMoveMultiplier} del total
- Recargo por piso sin elevador: ${pricing.floorSurchargePercent || 10}% por piso`;

      const baseSystemPrompt = isSpanish ? (config.systemPromptEs || config.systemPrompt) : config.systemPrompt;
      const systemPrompt = `${baseSystemPrompt}

MISSION:
${mission || 'Help customers create a complete inventory of their move and provide accurate cost estimates.'}

GUARDRAILS:
${guardrails || '- Never provide final prices, only estimates\n- Always be helpful and friendly\n- Redirect legal or complex questions to human support'}

INVENTORY COLLECTION RULES:
${inventoryRules || '- Ask about each room systematically\n- Identify large furniture first\n- Ask about fragile items\n- Estimate box counts for small items'}

COST ESTIMATION RULES:
${costRules || '- Consider item weight and fragility\n- Add buffer for unforeseen items\n- Factor in floor level and access'}
${aiPricingPrompt ? `\nCUSTOM AI PRICING INSTRUCTIONS:\n${isSpanish && aiPricingPrompt.contentEs ? aiPricingPrompt.contentEs : aiPricingPrompt.content}` : ''}

LOCATION CONTEXT (${locationContext}):
- Currency: ${pricing.currency} (${pricing.currencySymbol})

TRUCK-BASED PRICING (city-specific rates):
${trucksText}

GENERAL PRICING (applies to all trucks):
${generalPricingText}

DUAL ESTIMATION LOGIC (Weight + Volume) - CONSERVATIVE APPROACH:
The trucks are listed above sorted by capacity (smallest to largest).
Largest truck: ${largestTruck?.nameEs || '10 Toneladas'} (${largestTruck?.capacityKg || 10000}kg capacity)

A. WEIGHT-BASED ESTIMATION:
1. Calculate totalWeight = sum of (quantity × avgWeightKg) for all inventory items
2. If totalWeight <= largest truck capacity (${largestTruck?.capacityKg || 10000}kg):
   - Select the SMALLEST truck that can carry totalWeight
   - weightBasedTruckCount = 1
3. If totalWeight > largest truck capacity:
   - weightBasedTruckCount = ceil(totalWeight / ${largestTruck?.capacityKg || 10000})
   - Use the largest truck type

B. VOLUME-BASED ESTIMATION:
1. Calculate totalVolume = sum of (quantity × avgVolumeM3) for all inventory items
2. usableVolume = capacityM3 × 0.85 (packing efficiency factor)
3. If totalVolume <= largest truck usable volume:
   - Select the SMALLEST truck with enough usable volume
   - volumeBasedTruckCount = 1
4. If totalVolume > largest truck usable volume:
   - volumeBasedTruckCount = ceil(totalVolume / largestTruckUsableVolume)
   - Use the largest truck type

C. FINAL SELECTION (CONSERVATIVE):
- truckCount = MAX(weightBasedTruckCount, volumeBasedTruckCount)
- Use whichever estimate requires MORE trucks
- constrainingFactor = 'weight' or 'volume' (whichever drove the decision)

4. totalMovers = truckCount × truck's includedMovers
5. estimatedHours = baseServiceHours + (0.5 × floor((totalWeight - 1000) / 500)) [minimum = baseServiceHours]

COST CALCULATION FORMULA:
Variables:
- truckCount = number of trucks needed (from step 2-3 above)
- totalMovers = truckCount × truck.includedMovers
- baseServiceHours = truck.baseServiceHours (same for each truck)

Cost components (in order):
1. truckBaseCost = truckCount × truck.baseRate
   (Each truck's baseRate includes: baseServiceHours of work + includedMovers labor for that truck)
2. extraHoursPerTruck = max(0, estimatedHours - baseServiceHours)
   (Each truck works the full estimatedHours, but only baseServiceHours is included in baseRate)
3. extraHoursCost = extraHoursPerTruck × truck.hourlyRate × truckCount
   (Each truck incurs extra hour charges independently)
4. distanceCost = distanceKm × truck.perKmRate × truckCount
   (IMPORTANT: Ask user for approximate distance between origin and destination)
5. extraMoversCost = numExtraMovers × $${pricing.extraMoverRate}
   (Only if customer requests more movers than included)

Final estimate calculation:
- If distance is known: Low = truckBaseCost + extraHoursCost + distanceCost
- If distance is unknown: Low = truckBaseCost + extraHoursCost (clearly note "distance not included")
- High estimate = Low × ${pricing.complicatedMoveMultiplier}
- ALWAYS ask user about distance if not provided before giving final estimate

STANDARDIZED FURNITURE CATEGORIES (use these exact category keys):
${categoriesText || `- sofas: Sofás, sillones, love seats
- beds: Camas (king, queen, individual, litera)
- tables: Mesas (comedor, centro, escritorio, noche)
- chairs: Sillas, bancos, mecedoras
- storage: Armarios, clósets, cómodas, libreros, estantes
- electronics: TVs, computadoras, consolas, equipos de audio
- appliances_large: Refrigeradores, lavadoras, secadoras, estufas, hornos
- appliances_small: Microondas, licuadoras, cafeteras
- boxes: Cajas (pequeñas, medianas, grandes)
- fragile: Espejos, cuadros, lámparas, cristalería
- outdoor: Muebles de jardín, parrillas, macetas grandes
- exercise: Equipos de ejercicio, bicicletas, pesas
- kids: Cunas, carriolas, juguetes grandes
- other: Otros artículos no categorizados`}

STANDARDIZED ROOMS (use these exact room keys):
${roomsText || `- sala: Sala / Living room
- comedor: Comedor / Dining room
- cocina: Cocina / Kitchen
- recamara_principal: Recámara principal / Master bedroom
- recamara: Recámara / Bedroom
- baño: Baño / Bathroom
- estudio: Estudio / Office
- garage: Garage
- patio: Patio / Jardín
- lavanderia: Lavandería / Laundry room`}

CURRENT INVENTORY STATUS (THIS IS THE ONLY SOURCE OF TRUTH):
Total unique items: ${(inventory || []).length}
Total quantity (sum of all items): ${(inventory || []).reduce((sum: number, item: any) => sum + (item.quantity || 1), 0)}
Total estimated weight: ${(inventory || []).reduce((sum: number, item: any) => sum + ((item.estimatedWeightKg || 20) * (item.quantity || 1)), 0)}kg
Total estimated volume: ${Math.round((inventory || []).reduce((sum: number, item: any) => sum + ((item.estimatedVolumeM3 || 0.5) * (item.quantity || 1)), 0) * 100) / 100}m³

CRITICAL RULE - SOURCE OF TRUTH:
The inventory list below is the ONLY real inventory. It comes directly from the UI.
You do NOT maintain your own inventory. You CANNOT "remember" adding items from previous messages.
If an item is NOT in the list below, it does NOT exist in the inventory - regardless of what was said in conversation history.
The ONLY way to add items is by including them in the "newItems" array in your JSON response.
If the user asks to add items, you MUST put them in "newItems" - EVERY SINGLE TIME, even if you think you already added them before.
NEVER say "I've added X" unless you are actually returning those items in "newItems" in THIS response.

Full inventory list (this is what the user sees right now):
${JSON.stringify(inventory || [], null, 2)}

IMPORTANT RESPONSE FORMAT:
You MUST respond with a valid JSON object containing:
{
  "message": "Your conversational response to the user",
  "newItems": [{"name": "Sofá 3 plazas", "room": "sala", "category": "sofas", "quantity": 1, "estimatedWeightKg": 65, "estimatedVolumeM3": 1.5}] or [],
  "removeItems": [] or [{"name": "Sofá 3 plazas"}] or "all" (to clear entire inventory),
  "truckRecommendation": {
    "totalWeightKg": 500,
    "totalVolumeM3": 8.5,
    "recommendedTruck": "1.5 Toneladas",
    "truckCount": 1,
    "includedMovers": 2,
    "estimatedHours": 3,
    "constrainingFactor": "weight" or "volume",
    "weightBasedTruckCount": 1,
    "volumeBasedTruckCount": 1
  },
  "estimatedCost": { "low": number, "high": number, "currency": "${pricing.currency}" },
  "isComplete": false (set to true only when user confirms inventory is complete)
}

REMOVING ITEMS:
- Use "removeItems": "all" when user wants to clear/restart the entire inventory
- Use "removeItems": [{"name": "item name"}] to remove specific items (matches by name, case-insensitive)
- Process removals BEFORE adding newItems
- Always confirm what was removed in your message

MANDATORY MESSAGE BEHAVIOR - FOLLOW THE INVENTORY COLLECTION RULES ABOVE:
When items are added or when user adds something new, your "message" MUST include:
1. Acknowledgment of what was just added
2. Current total count: "Ahora tienes X artículos en tu inventario"
3. Brief breakdown by room (e.g., "Sala: 3 items, Recámara: 5 items, Cocina: 2 items")
This helps the user track their progress. ALWAYS follow the INVENTORY COLLECTION RULES section above.

TRUCK-BASED COST ESTIMATION:
- ALWAYS provide estimatedCost when there are items in inventory
- Use the DUAL ESTIMATION LOGIC (Weight + Volume) and COST CALCULATION FORMULA above
- Low estimate = truckBaseCost + extraHoursCost (using formulas above)
- High estimate = Low × ${pricing.complicatedMoveMultiplier}
- ALWAYS include truckRecommendation: { totalWeightKg, totalVolumeM3, recommendedTruck, truckCount, includedMovers, estimatedHours, constrainingFactor, weightBasedTruckCount, volumeBasedTruckCount }
- Update estimates after EVERY inventory change

WEIGHT AND VOLUME ESTIMATION FOR newItems:
- ALWAYS include "estimatedWeightKg" for each new item (use avgWeightKg from category)
- ALWAYS include "estimatedVolumeM3" for each new item (use avgVolumeM3 from category)
- Example: sofá 3 plazas (sofa_3seat category) = ~65kg, ~1.5m³

RULES FOR newItems (CRITICAL - READ CAREFULLY):
- ALWAYS use the standardized category keys (sofas, beds, tables, etc.) - not translated names
- ALWAYS use the standardized room keys (sala, comedor, cocina, etc.) - not translated names
- "name" MUST use the EXACT names from the AVAILABLE ITEMS list below when possible
- Extract items from EVERY message the user sends that mentions furniture
- If user mentions "tengo un sofá y 2 sillas en la sala", add BOTH items with correct quantities
- NEVER return newItems: [] if the user asked you to add items. If they asked for items, those items MUST appear in newItems.
- Do NOT assume items are "already added" from conversation history. Check the CURRENT INVENTORY STATUS above.
- If an item the user wants is NOT in the current inventory list, it MUST go into newItems.
- Your conversation history may show you "added" items before, but if they are not in the current inventory list above, they were NOT actually added. Add them again in newItems.

AVAILABLE ITEMS (use these exact "name" values when adding items):
${(() => {
  // Group catalog items by room
  const byRoom = catalogItems.reduce((acc: Record<string, string[]>, item) => {
    if (!acc[item.roomKey]) acc[item.roomKey] = [];
    acc[item.roomKey].push(item.nameEs);
    return acc;
  }, {});
  return Object.entries(byRoom).map(([room, itemNames]) => 
    `${room.toUpperCase()}: ${itemNames.map(n => `"${n}"`).join(', ')}`
  ).join('\n');
})()}

Language: Respond in ${isSpanish ? 'Spanish' : 'English'}.`;

      // Build conversation messages
      const messages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
        { role: 'system', content: systemPrompt }
      ];

      // Add conversation history
      if (conversationHistory && Array.isArray(conversationHistory)) {
        for (const msg of conversationHistory.slice(-10)) {
          messages.push({
            role: msg.role === 'agent' ? 'assistant' : 'user',
            content: msg.content
          });
        }
      }

      // Add current message
      messages.push({ role: 'user', content: message });

      const response = await openai.chat.completions.create({
        model: resolveAiModel(config.model),
        messages,
        response_format: { type: "json_object" },
        max_tokens: config.maxTokens || 2048,
        validateJson: isClaraResponse,
      });

      const content = response.choices[0]?.message?.content || '{}';
      
      let parsed: {
        message?: string;
        newItems?: Array<{name: string; room: string; category: string; quantity: number; estimatedWeightKg?: number}>;
        removeItems?: 'all' | Array<{name: string}>;
        truckRecommendation?: {
          totalWeightKg: number;
          recommendedTruck: string;
          truckCount: number;
          includedMovers: number;
          estimatedHours: number;
        } | null;
        estimatedCost?: { low: number; high: number; currency: string } | null;
        isComplete?: boolean;
      };
      
      try {
        parsed = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse AI response:', content);
        parsed = { message: content };
      }

      // Validate newItems against catalog - use fuzzy matching to avoid silently dropping items
      let validatedItems = parsed.newItems || [];
      if (validatedItems.length > 0) {
        validatedItems = validatedItems.map(item => {
          const normalizedName = item.name.toLowerCase().trim();
          const exactMatch = catalogItems.find(catItem => 
            catItem.nameEs.toLowerCase() === normalizedName ||
            catItem.nameEn.toLowerCase() === normalizedName
          );
          if (exactMatch) {
            return { ...item, name: isSpanish ? exactMatch.nameEs : exactMatch.nameEn };
          }
          const partialMatch = catalogItems.find(catItem =>
            catItem.nameEs.toLowerCase().includes(normalizedName) ||
            catItem.nameEn.toLowerCase().includes(normalizedName) ||
            normalizedName.includes(catItem.nameEs.toLowerCase()) ||
            normalizedName.includes(catItem.nameEn.toLowerCase())
          );
          if (partialMatch) {
            console.log(`[Clara] Fuzzy matched "${item.name}" → "${isSpanish ? partialMatch.nameEs : partialMatch.nameEn}"`);
            return { ...item, name: isSpanish ? partialMatch.nameEs : partialMatch.nameEn };
          }
          console.log(`[Clara] No catalog match for "${item.name}" - keeping as-is with category "${item.category}"`);
          return item;
        });
      }

      // Safety check: detect when user asked to add items but AI returned empty newItems
      // Check based on USER intent (the original message), not AI phrasing
      if (validatedItems.length === 0 && message) {
        const userAddIntent = [
          /(?:add|agrega|añade|incluye|pon|mete|también|also|plus|and also|y también)/i,
          /(?:tengo|i have|there(?:'s| is| are)|hay|quiero|want)/i,
          /(?:table|chair|sofa|bed|desk|mesa|silla|sofá|cama|escritorio|refrigerador|lavadora|estufa|microondas|televisión|tv|armario|closet|cómoda|librero)/i,
          /(?:\d+\s*(?:x|×)?\s*(?:chairs?|sillas?|tables?|mesas?|boxes?|cajas?))/i,
        ];
        const userMentionsItems = userAddIntent.filter(p => p.test(message)).length >= 2;
        
        const aiClaimsAdded = parsed.message && [
          /(?:i'?ve|he|i have|hemos|ya|listo|done|ready|added|agregad)/i,
          /(?:added|agregado|añadido|incluido|incluí|listo|hecho)/i,
        ].some(p => p.test(parsed.message || ''));
        
        const shouldRetry = userMentionsItems || aiClaimsAdded;
        
        if (shouldRetry) {
          console.warn(`[Clara] WARNING: newItems is empty but user likely asked to add items. User msg: "${message.substring(0, 150)}" | AI claims added: ${!!aiClaimsAdded}`);
          console.warn(`[Clara] Attempting retry with explicit instruction...`);
          
          try {
            const retryMessages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = [
              { role: 'system', content: `${systemPrompt}\n\nCRITICAL CORRECTION: Your previous response had newItems: [] but the user asked to add items. You MUST include those items in the "newItems" array. The inventory list in the system prompt is the ONLY source of truth. If items the user mentioned are NOT in that list, they MUST go into "newItems". NEVER return newItems: [] when the user is asking to add items.` },
              ...messages.slice(1),
              { role: 'assistant', content: JSON.stringify(parsed) },
              { role: 'user', content: `ERROR: Your previous response had newItems: [] but I asked you to add items. Those items were NOT added. Please return the corrected JSON with the items in "newItems". Re-read my previous message and extract the items I asked for.` }
            ];
            
            const retryResponse = await openai.chat.completions.create({
              model: resolveAiModel(config.model),
              messages: retryMessages,
              response_format: { type: "json_object" },
              max_tokens: config.maxTokens || 2048,
              validateJson: isClaraResponse,
            });
            
            const retryContent = retryResponse.choices[0]?.message?.content || '{}';
            const retryParsed = JSON.parse(retryContent);
            
            if (retryParsed.newItems && retryParsed.newItems.length > 0) {
              console.log(`[Clara] Retry succeeded: ${retryParsed.newItems.length} items recovered`);
              validatedItems = retryParsed.newItems.map((item: any) => {
                const normalizedName = (item.name || '').toLowerCase().trim();
                const exactMatch = catalogItems.find(catItem => 
                  catItem.nameEs.toLowerCase() === normalizedName ||
                  catItem.nameEn.toLowerCase() === normalizedName
                );
                if (exactMatch) return { ...item, name: isSpanish ? exactMatch.nameEs : exactMatch.nameEn };
                const partialMatch = catalogItems.find(catItem =>
                  catItem.nameEs.toLowerCase().includes(normalizedName) ||
                  normalizedName.includes(catItem.nameEs.toLowerCase()) ||
                  catItem.nameEn.toLowerCase().includes(normalizedName) ||
                  normalizedName.includes(catItem.nameEn.toLowerCase())
                );
                if (partialMatch) return { ...item, name: isSpanish ? partialMatch.nameEs : partialMatch.nameEn };
                return item;
              });
              if (retryParsed.message) {
                parsed.message = retryParsed.message;
              }
            } else {
              console.warn(`[Clara] Retry also returned empty newItems - notifying user`);
              parsed.message = (parsed.message || '') + '\n\n' + (isSpanish 
                ? '⚠️ Hubo un problema al agregar los artículos. Por favor intenta de nuevo o usa el selector visual para agregarlos manualmente.'
                : '⚠️ There was an issue adding the items. Please try again or use the visual picker to add them manually.');
            }
          } catch (retryError) {
            console.error(`[Clara] Retry failed:`, retryError);
          }
        }
      }

      // Log AI response details for debugging
      console.log(`[Clara] AI returned: newItems=${validatedItems.length}, removeItems=${JSON.stringify(parsed.removeItems || [])}, isComplete=${parsed.isComplete}`);
      if (validatedItems.length > 0) {
        console.log(`[Clara] Items to add: ${validatedItems.map(i => `${i.quantity}x ${i.name} (${i.room})`).join(', ')}`);
      }

      // Response message from AI (inventory summary instructions are now in the system prompt)
      const responseMessage = parsed.message || content;

      // Calculate real estimate using actual inventory, not AI's mental math
      // Build the final inventory list by applying AI's changes to current inventory
      let finalInventory = [...(inventory || [])];
      
      // Apply removals if any
      if (parsed.removeItems === 'all') {
        finalInventory = [];
      } else if (Array.isArray(parsed.removeItems)) {
        const removeNames = parsed.removeItems.map(r => r.name.toLowerCase());
        finalInventory = finalInventory.filter(item => 
          !removeNames.includes((item.name || '').toLowerCase())
        );
      }
      
      // Apply additions
      if (validatedItems.length > 0) {
        for (const newItem of validatedItems) {
          // Check if item already exists in same room
          const existingIdx = finalInventory.findIndex(
            i => i.name?.toLowerCase() === newItem.name?.toLowerCase() && 
                 i.room === newItem.room
          );
          if (existingIdx >= 0) {
            // Update quantity
            finalInventory[existingIdx] = {
              ...finalInventory[existingIdx],
              quantity: (finalInventory[existingIdx].quantity || 1) + (newItem.quantity || 1)
            };
          } else {
            // Add new item with unique ID
            finalInventory.push({
              ...newItem,
              id: `clara-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            });
          }
        }
      }
      
      // Calculate real estimate using the formal calculation logic
      let realTruckRecommendation = null;
      let realEstimatedCost = null;
      
      if (finalInventory.length > 0) {
        try {
          // Get category data for weight/volume calculations
          const categoryWeights: Record<string, {weight: number, volume: number}> = {};
          for (const cat of categories) {
            categoryWeights[cat.key] = {
              weight: parseFloat(cat.avgWeightKg?.toString() || '20'),
              volume: parseFloat(cat.avgVolumeM3?.toString() || '0.3')
            };
          }
          
          // Calculate total weight and volume
          let totalWeight = 0;
          let totalVolume = 0;
          let totalItemCount = 0;
          
          for (const item of finalInventory) {
            const qty = item.quantity || 1;
            const catData = categoryWeights[item.category] || { weight: 20, volume: 0.3 };
            totalWeight += qty * catData.weight;
            totalVolume += qty * catData.volume;
            totalItemCount += qty;
          }
          
          // Use the same truck selection logic as calculate-estimate
          const getUsableVolume = (truck: any) => {
            const capacityM3 = parseFloat(truck.capacityM3?.toString() || '0');
            const usableFactor = parseFloat(truck.usableVolumeFactor?.toString() || '0.85');
            return capacityM3 * usableFactor;
          };
          
          // Sort trucks by capacity
          const allTrucks = [...pricing.truckPricing]
            .map(t => ({
              ...t,
              weightCapacity: t.capacityKg,
              usableVolume: getUsableVolume(t)
            }))
            .sort((a, b) => a.weightCapacity - b.weightCapacity);
          
          // Find optimal fleet (simplified greedy algorithm)
          let selectedTrucks: typeof allTrucks = [];
          let remainingWeight = totalWeight;
          let remainingVolume = totalVolume;
          
          // Use largest trucks first
          const largestTruck = allTrucks[allTrucks.length - 1];
          
          while (remainingWeight > 0 || remainingVolume > 0) {
            // Find smallest truck that can handle remaining load
            let selectedTruck = null;
            for (const truck of allTrucks) {
              if (truck.weightCapacity >= remainingWeight && truck.usableVolume >= remainingVolume) {
                selectedTruck = truck;
                break;
              }
            }
            
            // If no single truck fits, use largest
            if (!selectedTruck) {
              selectedTruck = largestTruck;
            }
            
            selectedTrucks.push(selectedTruck);
            remainingWeight -= selectedTruck.weightCapacity;
            remainingVolume -= selectedTruck.usableVolume;
          }
          
          // Build truck breakdown
          const truckCounts: Record<string, {truck: typeof allTrucks[0], count: number}> = {};
          for (const truck of selectedTrucks) {
            const key = truck.nameEs || truck.name;
            if (!truckCounts[key]) {
              truckCounts[key] = { truck, count: 0 };
            }
            truckCounts[key].count++;
          }
          
          const truckBreakdown = Object.values(truckCounts).map(({ truck, count }) => ({
            name: truck.nameEs || truck.name,
            count,
            capacityKg: truck.capacityKg || truck.weightCapacity,
            capacityM3: truck.usableVolume / 0.85 // approximate raw capacity from usable
          }));
          
          // Calculate cost
          const truckCount = selectedTrucks.length;
          const totalMovers = selectedTrucks.reduce((sum, t) => sum + (t.includedMovers || 2), 0);
          const baseHours = selectedTrucks[0]?.baseServiceHours || 4;
          const estimatedHours = Math.max(baseHours, baseHours + Math.floor((totalWeight - 1000) / 500) * 0.5);
          
          let totalCost = 0;
          for (const truck of selectedTrucks) {
            const baseCost = truck.baseRate || 5000;
            const extraHours = Math.max(0, estimatedHours - (truck.baseServiceHours || 4));
            const extraHoursCost = extraHours * (truck.hourlyRate || 500);
            totalCost += baseCost + extraHoursCost;
          }
          
          const complicatedMultiplier = pricing.complicatedMoveMultiplier || 1.3;
          
          realTruckRecommendation = {
            totalWeightKg: Math.round(totalWeight),
            totalVolumeM3: Math.round(totalVolume * 100) / 100,
            totalItemCount,
            recommendedTruck: truckBreakdown.map(t => `${t.count}x ${t.name}`).join(' + '),
            truckBreakdown,
            truckCount,
            includedMovers: totalMovers,
            estimatedHours: Math.round(estimatedHours),
            constrainingFactor: totalVolume / (selectedTrucks.reduce((s, t) => s + t.usableVolume, 0)) > 
                               totalWeight / (selectedTrucks.reduce((s, t) => s + t.weightCapacity, 0)) ? 'volume' : 'weight'
          };
          
          realEstimatedCost = {
            low: Math.round(totalCost),
            high: Math.round(totalCost * complicatedMultiplier),
            currency: pricing.currency || 'MXN'
          };
          
          console.log(`[Clara] Real calculation: ${totalItemCount} items, ${Math.round(totalWeight)}kg, ${Math.round(totalVolume*100)/100}m³ -> $${realEstimatedCost.low}-$${realEstimatedCost.high}`);
        } catch (calcError) {
          console.error('[Clara] Real calculation failed, using AI estimate:', calcError);
          // Fall back to AI's estimate if calculation fails
          realTruckRecommendation = parsed.truckRecommendation;
          realEstimatedCost = parsed.estimatedCost;
        }
      }

      res.json({
        response: responseMessage,
        newItems: validatedItems,
        removeItems: parsed.removeItems || null,
        truckRecommendation: realTruckRecommendation,
        estimatedCost: realEstimatedCost,
        isComplete: parsed.isComplete || false
      });
    } catch (error: any) {
      console.error('Clara chat error:', error);
      res.status(500).json({ message: error.message || "Chat failed" });
    }
  });

  // Get AI agent config for public use (greeting only)
  app.get("/api/clara/config", async (req: Request, res: Response) => {
    try {
      const config = await storage.getAiAgentConfig();
      if (!config) {
        return res.json({
          name: 'Clara',
          greeting: 'Hello! I\'m Clara, your moving assistant. Tell me about the items you need to move.',
          greetingEs: '¡Hola! Soy Clara, tu asistente de mudanzas. Cuéntame sobre los artículos que necesitas mover.',
          active: false
        });
      }
      res.json({
        name: config.name,
        greeting: config.greeting,
        greetingEs: config.greetingEs,
        active: config.active
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Clara inventory file upload endpoint
  app.post("/api/clara/inventory-upload", async (req: Request, res: Response) => {
    try {
      const multer = (await import('multer')).default;
      const upload = multer({ 
        storage: multer.memoryStorage(),
        limits: { fileSize: 25 * 1024 * 1024 } // 25MB limit
      }).single('file');

      upload(req, res, async (err: any) => {
        if (err) {
          return res.status(400).json({ message: err.message || 'File upload failed' });
        }

        const file = (req as any).file;
        if (!file) {
          return res.status(400).json({ message: 'No file uploaded' });
        }

        const language = req.body.language || 'es';
        const isSpanish = language === 'es';
        const fileName = file.originalname.toLowerCase();
        const mimeType = file.mimetype;
        
        // Determine file type category
        const documentExts = ['.csv', '.xlsx', '.pdf', '.docx', '.txt'];
        const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic'];
        const audioExts = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.aac'];
        const videoExts = ['.mp4', '.mov', '.avi', '.mkv'];
        
        const fileExt = '.' + fileName.split('.').pop();
        const isDocument = documentExts.some(ext => fileName.endsWith(ext));
        const isImage = imageExts.some(ext => fileName.endsWith(ext));
        const isAudio = audioExts.some(ext => fileName.endsWith(ext));
        const isVideo = videoExts.some(ext => fileName.endsWith(ext));

        // Load catalog data and AI config for processing
        const catalogItems = await storage.getCatalogItems();
        const rooms = await storage.getInventoryRooms();
        const categories = await storage.getInventoryCategories();
        const aiConfig = await storage.getAiAgentConfig();
        
        const catalogItemsText = catalogItems.map(i => `"${i.nameEs}" (${i.categoryKey}, ${i.roomKey})`).join(', ');
        const roomsText = rooms.filter(r => r.isActive).map(r => `${r.key}: ${r.labelEs}`).join(', ');
        const categoriesText = categories.filter(c => c.isActive).map(c => `${c.key}: ${c.labelEs} (${c.avgWeightKg}kg, ${c.avgVolumeM3}m³)`).join(', ');
        const validCategoryKeys = categories.filter(c => c.isActive).map(c => c.key);
        const validRoomKeys = rooms.filter(r => r.isActive).map(r => r.key);
        
        // Helper to replace placeholders in prompts
        const replacePlaceholders = (prompt: string, content?: string) => {
          return prompt
            .replace(/\{\{CATEGORIES\}\}/g, categoriesText)
            .replace(/\{\{ROOMS\}\}/g, roomsText)
            .replace(/\{\{CATALOG\}\}/g, catalogItemsText.substring(0, 500))
            .replace(/\{\{CONTENT\}\}/g, content ? content.substring(0, 8000) : '');
        };

        const openai = createAiClient();

        let extractedText = '';
        let parsedItems: any[] = [];

        try {
          // Process based on file type
          if (isImage) {
            // Image processing using the configured multimodal model
            const base64Image = file.buffer.toString('base64');
            const imageMediaType = mimeType || 'image/jpeg';
            
            // Use prompt from config or fallback to default
            const configPrompt = isSpanish ? aiConfig?.imageAnalysisPromptEs : aiConfig?.imageAnalysisPrompt;
            const defaultPrompt = `Analyze this image of a room or items for a moving inventory. Identify ALL furniture, appliances, electronics, and household items visible.

AVAILABLE CATEGORIES (assign each item to one):
{{CATEGORIES}}

AVAILABLE ROOMS (assign each item to one based on context):
{{ROOMS}}

For each item found, provide:
- name: Spanish item name
- quantity: Number visible (estimate if multiple)
- room: Room key from list above
- category: Category key from list above

Return ONLY a JSON array like:
[{"name": "Sofá 3 plazas", "quantity": 1, "room": "sala", "category": "sofas"}]

Be thorough - identify every piece of furniture and significant item visible. Return [] if no items found.`;
            const visionPrompt = replacePlaceholders(configPrompt || defaultPrompt);
            
            const visionResponse = await openai.chat.completions.create({
              model: resolveAiModel(aiConfig?.model),
              messages: [{
                role: 'user',
                content: [
                  { type: 'text', text: visionPrompt },
                  { type: 'image_url', image_url: { url: `data:${imageMediaType};base64,${base64Image}` } }
                ]
              }],
              response_format: { type: "json_object" },
              temperature: 0.3,
              max_tokens: 4000,
              jsonArray: true,
              validateJson: isInventoryParserResponse,
            });

            const visionContent = visionResponse.choices[0]?.message?.content || '[]';
            try {
              const jsonMatch = visionContent.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                parsedItems = JSON.parse(jsonMatch[0]);
              }
            } catch (parseErr) {
              console.error('Failed to parse vision response:', visionContent);
            }

          } else if (isAudio) {
            // Audio processing via Replit AI integration using gpt-4o-transcribe
            // (whisper-1 is not supported by the integration, but gpt-4o-transcribe is)
            const OpenAIDirectAudio = (await import('openai')).default;
            const transcriptionApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
            const transcriptionBaseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;

            if (!transcriptionApiKey) {
              return res.status(500).json({
                message: isSpanish
                  ? 'La transcripción de audio no está configurada. Contacte al administrador.'
                  : 'Audio transcription is not configured. Contact the administrator.'
              });
            }

            const whisperClient = new OpenAIDirectAudio({
              apiKey: transcriptionApiKey,
              baseURL: transcriptionBaseURL
            });

            const audioResponse = await whisperClient.audio.transcriptions.create({
              file: new File([file.buffer], fileName, { type: mimeType }),
              model: "gpt-4o-transcribe",
              language: language === 'es' ? 'es' : 'en',
              response_format: "json"
            });

            extractedText = audioResponse?.text || '';
            
            if (!extractedText || extractedText.trim().length < 10) {
              return res.status(400).json({ 
                message: isSpanish 
                  ? 'No se pudo transcribir el audio. Verifique que contenga voz clara.' 
                  : 'Could not transcribe audio. Please ensure it contains clear speech.'
              });
            }

          } else if (isVideo) {
            // Video processing - extract keyframes and analyze visually
            const { spawn } = await import('child_process');
            const fs = await import('fs');
            const path = await import('path');
            const os = await import('os');
            
            // Create temp directory for video and frames
            const tempDir = path.join(os.tmpdir(), `video-${Date.now()}`);
            fs.mkdirSync(tempDir, { recursive: true });
            
            const videoPath = path.join(tempDir, `input${fileExt}`);
            fs.writeFileSync(videoPath, file.buffer);
            
            try {
              // Extract frames using ffmpeg (1 frame every 3 seconds, max 10 frames)
              const framesPattern = path.join(tempDir, 'frame-%03d.jpg');
              
              await new Promise<void>((resolve, reject) => {
                const ffmpeg = spawn('ffmpeg', [
                  '-i', videoPath,
                  '-vf', 'fps=1/3,scale=1280:-1',  // 1 frame per 3 seconds, max width 1280px
                  '-frames:v', '10',                // Max 10 frames
                  '-q:v', '3',                      // Good quality JPEG
                  framesPattern
                ]);
                
                ffmpeg.on('close', (code) => {
                  if (code === 0) resolve();
                  else reject(new Error(`ffmpeg exited with code ${code}`));
                });
                ffmpeg.on('error', reject);
              });
              
              // Read extracted frames
              const frameFiles = fs.readdirSync(tempDir)
                .filter((f: string) => f.startsWith('frame-') && f.endsWith('.jpg'))
                .sort();
              
              if (frameFiles.length === 0) {
                throw new Error('No frames extracted from video');
              }
              
              // Process each frame with vision AI and collect items
              const allFrameItems: any[] = [];
              
              for (const frameFile of frameFiles) {
                const framePath = path.join(tempDir, frameFile);
                const frameBuffer = fs.readFileSync(framePath);
                const base64Frame = frameBuffer.toString('base64');
                
                // Use same image analysis prompt from config for video frames
                const frameConfigPrompt = isSpanish ? aiConfig?.imageAnalysisPromptEs : aiConfig?.imageAnalysisPrompt;
                const frameDefaultPrompt = `Analyze this video frame showing a room or items for moving inventory. Identify ALL furniture, appliances, electronics, and household items visible.

AVAILABLE CATEGORIES (assign each item to one):
{{CATEGORIES}}

AVAILABLE ROOMS (assign each item based on visible context):
{{ROOMS}}

For each item found:
- name: Spanish item name
- quantity: Number visible
- room: Room key from list
- category: Category key from list

Return ONLY a JSON array like:
[{"name": "Sofá 3 plazas", "quantity": 1, "room": "sala", "category": "sofas"}]

Be thorough - identify every piece of furniture visible. Return [] if no items found.`;
                const visionPrompt = replacePlaceholders(frameConfigPrompt || frameDefaultPrompt);
                
                try {
                  const visionResponse = await openai.chat.completions.create({
                    model: resolveAiModel(aiConfig?.model),
                    messages: [{
                      role: 'user',
                      content: [
                        { type: 'text', text: visionPrompt },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Frame}` } }
                      ]
                    }],
                    response_format: { type: "json_object" },
                    temperature: 0.3,
                    max_tokens: 2000,
                    jsonArray: true,
                    validateJson: isInventoryParserResponse,
                  });

                  const frameContent = visionResponse.choices[0]?.message?.content || '[]';
                  const jsonMatch = frameContent.match(/\[[\s\S]*\]/);
                  if (jsonMatch) {
                    const frameItems = JSON.parse(jsonMatch[0]);
                    allFrameItems.push(...frameItems);
                  }
                } catch (frameErr) {
                  console.error(`Error processing frame ${frameFile}:`, frameErr);
                }
              }
              
              // Deduplicate and merge items from all frames
              const itemMap = new Map<string, any>();
              for (const item of allFrameItems) {
                const key = `${item.name}-${item.room}-${item.category}`.toLowerCase();
                if (itemMap.has(key)) {
                  // Keep the higher quantity
                  const existing = itemMap.get(key);
                  existing.quantity = Math.max(existing.quantity || 1, item.quantity || 1);
                } else {
                  itemMap.set(key, { ...item, quantity: item.quantity || 1 });
                }
              }
              parsedItems = Array.from(itemMap.values());
              
              // Cleanup temp files
              fs.rmSync(tempDir, { recursive: true, force: true });
              
            } catch (videoErr: any) {
              // Cleanup on error
              const fs = await import('fs');
              try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
              
              console.error('Video processing error:', videoErr);
              return res.status(400).json({ 
                message: isSpanish 
                  ? 'No se pudo procesar el video. Verifique el formato.' 
                  : 'Could not process video. Please check the format.'
              });
            }

          } else if (isDocument) {
            // Document parsing - use deterministic parsing for CSV/Excel
            const isSpreadsheet = fileName.endsWith('.csv') || fileName.endsWith('.xlsx');
            
            if (isSpreadsheet) {
              // DETERMINISTIC CSV/EXCEL PARSING - parse rows directly, don't rely on AI
              let rows: string[][] = [];
              
              if (fileName.endsWith('.csv')) {
                const csvText = file.buffer.toString('utf-8');
                // Simple CSV parsing - handle quoted fields
                const lines = csvText.split(/\r?\n/).filter(line => line.trim());
                rows = lines.map(line => {
                  const result: string[] = [];
                  let current = '';
                  let inQuotes = false;
                  for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') {
                      inQuotes = !inQuotes;
                    } else if (char === ',' && !inQuotes) {
                      result.push(current.trim());
                      current = '';
                    } else {
                      current += char;
                    }
                  }
                  result.push(current.trim());
                  return result;
                });
              } else {
                // Excel parsing
                const excelJsModule = await import('exceljs');
                const ExcelJS = (excelJsModule as any).default ?? excelJsModule;
                const workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(file.buffer);
                const worksheet = workbook.worksheets[0];
                rows = [];
                worksheet.eachRow((row: any) => {
                  const values = (Array.isArray(row.values) ? row.values : []).slice(1);
                  rows.push(values.map((v: any) => v == null ? '' : String(v)));
                });
              }
              
              if (rows.length < 2) {
                return res.status(400).json({ 
                  message: isSpanish 
                    ? 'El archivo está vacío o no tiene datos.' 
                    : 'The file is empty or has no data.'
                });
              }
              
              // Find column indices from header row
              const header = rows[0].map(h => String(h || '').toLowerCase().trim());
              const nameIdx = header.findIndex(h => 
                h.includes('nombre') || h.includes('name') || h.includes('articulo') || h.includes('item') || h.includes('descripcion')
              );
              const qtyIdx = header.findIndex(h => 
                h.includes('cantidad') || h.includes('qty') || h.includes('quantity') || h.includes('cant')
              );
              const roomIdx = header.findIndex(h => 
                h.includes('habitacion') || h.includes('room') || h.includes('cuarto') || h.includes('ubicacion')
              );
              const categoryIdx = header.findIndex(h => 
                h.includes('categoria') || h.includes('category') || h.includes('tipo') || h.includes('type')
              );
              
              // If no name column found, use first column
              const effectiveNameIdx = nameIdx >= 0 ? nameIdx : 0;
              
              // Fetch keyword mappings from database (configurable via admin dashboard)
              const dbCategoryKeywords = await storage.getCategoryKeywords();
              const dbRoomKeywords = await storage.getRoomKeywords();
              
              // Build category keyword map from database
              const categoryKeywords: Record<string, string[]> = {};
              for (const kw of dbCategoryKeywords) {
                if (kw.isActive !== false) {
                  if (!categoryKeywords[kw.categoryKey]) {
                    categoryKeywords[kw.categoryKey] = [];
                  }
                  categoryKeywords[kw.categoryKey].push(kw.keyword.toLowerCase());
                }
              }
              
              // Build room keyword map from database
              const roomKeywords: Record<string, string[]> = {};
              for (const kw of dbRoomKeywords) {
                if (kw.isActive !== false) {
                  if (!roomKeywords[kw.roomKey]) {
                    roomKeywords[kw.roomKey] = [];
                  }
                  roomKeywords[kw.roomKey].push(kw.keyword.toLowerCase());
                }
              }
              
              // Valid canonical keys from database categories/rooms
              const dbCategories = await storage.getInventoryCategories();
              const dbRooms = await storage.getInventoryRooms();
              const validCategoryKeysCSV = dbCategories.map(c => c.key);
              validCategoryKeysCSV.push('other'); // Always include 'other' as fallback
              const validRoomKeysCSV = dbRooms.map(r => r.key);
              validRoomKeysCSV.push('otro'); // Always include 'otro' as fallback
              
              console.log(`Loaded ${Object.keys(categoryKeywords).length} category keyword groups, ${Object.keys(roomKeywords).length} room keyword groups from database`);
              
              // Helper to normalize category - first check canonical keys, then keyword match
              const inferCategoryFromName = (text: string): string => {
                const lower = text.toLowerCase().trim();
                
                // First check if it's already a valid canonical key
                if (validCategoryKeysCSV.includes(lower)) {
                  return lower;
                }
                
                // Also check without accents
                const normalized = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (validCategoryKeysCSV.includes(normalized)) {
                  return normalized;
                }
                
                // Then try keyword matching
                for (const [category, keywords] of Object.entries(categoryKeywords)) {
                  for (const keyword of keywords) {
                    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    if (normalized.includes(normalizedKeyword)) {
                      return category;
                    }
                  }
                }
                return 'other';
              };
              
              // Helper to infer room - first check canonical keys, then keyword match
              const inferRoomFromText = (text: string): string => {
                const lower = text.toLowerCase().trim();
                
                // First check if it's already a valid canonical key
                if (validRoomKeysCSV.includes(lower)) {
                  return lower;
                }
                
                // Also check without accents
                const normalized = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                if (validRoomKeysCSV.includes(normalized)) {
                  return normalized;
                }
                
                // Then try keyword matching
                for (const [room, keywords] of Object.entries(roomKeywords)) {
                  for (const keyword of keywords) {
                    const normalizedKeyword = keyword.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                    if (normalized.includes(normalizedKeyword)) {
                      return room;
                    }
                  }
                }
                return 'sin_habitacion'; // Default: no room assigned
              };
              
              // Parse data rows (skip header)
              const dataRows = rows.slice(1).filter(row => row.some(cell => cell && String(cell).trim()));
              
              let categorizedCount = 0;
              let uncategorizedCount = 0;
              
              for (const row of dataRows) {
                const name = String(row[effectiveNameIdx] || '').trim();
                if (!name) continue;
                
                const quantity = qtyIdx >= 0 ? Math.max(1, parseInt(String(row[qtyIdx])) || 1) : 1;
                
                // Try to get room from column, then infer from name
                let room = 'sin_habitacion'; // Default: no room assigned
                if (roomIdx >= 0 && row[roomIdx]) {
                  room = inferRoomFromText(String(row[roomIdx]));
                }
                if (room === 'sin_habitacion') {
                  // Also try to infer room from item name
                  room = inferRoomFromText(name);
                }
                
                // Try to get category from column, then ALWAYS infer from item name
                let category = 'other';
                if (categoryIdx >= 0 && row[categoryIdx]) {
                  category = inferCategoryFromName(String(row[categoryIdx]));
                }
                // If still 'other', try to infer from the item name itself
                if (category === 'other') {
                  category = inferCategoryFromName(name);
                }
                
                if (category !== 'other') {
                  categorizedCount++;
                } else {
                  uncategorizedCount++;
                }
                
                // Add to parsed items (will be aggregated later)
                parsedItems.push({
                  name,
                  quantity,
                  room,
                  category
                });
              }
              
              console.log(`Deterministic CSV parsing: ${dataRows.length} rows -> ${parsedItems.length} items (${categorizedCount} categorized, ${uncategorizedCount} as 'other')`);
              
              // AGGREGATE: Group items by (category + room) to preserve room-level granularity
              // User wants one row per category PER ROOM - if same category in 3 rooms, show 3 rows with room names
              const aggregatedMap = new Map<string, { name: string; quantity: number; room: string; category: string }>();
              for (const item of parsedItems) {
                const key = `${item.category}::${item.room}`; // Group by category AND room
                if (aggregatedMap.has(key)) {
                  const existing = aggregatedMap.get(key)!;
                  existing.quantity += item.quantity;
                } else {
                  // Use category label as name
                  const categoryInfo = dbCategories.find(c => c.key === item.category);
                  const categoryName = categoryInfo ? (isSpanish ? categoryInfo.labelEs : categoryInfo.labelEn) : item.category;
                  aggregatedMap.set(key, {
                    name: categoryName,
                    quantity: item.quantity,
                    room: item.room,
                    category: item.category
                  });
                }
              }
              
              // Replace parsed items with aggregated version
              parsedItems = Array.from(aggregatedMap.values());
              console.log(`Aggregated to ${parsedItems.length} category-room groups`);
              
            } else if (fileName.endsWith('.pdf')) {
              const pdfParse = (await import('pdf-parse')).default;
              const pdfData = await pdfParse(file.buffer);
              extractedText = pdfData.text;
            } else if (fileName.endsWith('.docx')) {
              const mammoth = await import('mammoth');
              const result = await mammoth.extractRawText({ buffer: file.buffer });
              extractedText = result.value;
            } else if (fileName.endsWith('.txt')) {
              extractedText = file.buffer.toString('utf-8');
            }

            if (!isSpreadsheet && (!extractedText || extractedText.trim().length < 10)) {
              return res.status(400).json({ 
                message: isSpanish 
                  ? 'No se pudo extraer contenido del archivo. Verifique que no esté vacío.' 
                  : 'Could not extract content from file. Please verify it is not empty.'
              });
            }
          } else {
            return res.status(400).json({ 
              message: isSpanish 
                ? 'Formato de archivo no soportado.' 
                : 'Unsupported file format.'
            });
          }

          // If we have text to parse (documents or audio transcription), use text-based AI
          if (extractedText && parsedItems.length === 0) {
            // Count lines in extracted text to set expectations for AI
            const textLines = extractedText.split(/\r?\n/).filter(line => line.trim().length > 0);
            const lineCount = textLines.length;
            
            // Try to detect if this looks like a structured list (numbered items, bullet points, etc.)
            const numberedLinePattern = /^\s*(\d+[\.\)\-]|\-|\•|\*)\s*/;
            const structuredLines = textLines.filter(line => numberedLinePattern.test(line));
            const isStructuredList = structuredLines.length > lineCount * 0.5; // More than 50% are list items
            
            console.log(`Document parsing: ${lineCount} lines detected, ${structuredLines.length} appear to be list items, structured=${isStructuredList}`);
            
            // Build prompt with explicit line count
            const expectedItemCount = isStructuredList ? structuredLines.length : lineCount;
            
            const docDefaultPrompt = `You are an expert inventory parser for a moving company. Extract EVERY SINGLE item from this document.

THIS DOCUMENT HAS EXACTLY ${lineCount} LINES. You MUST return approximately ${expectedItemCount} items (one per line/entry).

CRITICAL RULES - YOU MUST FOLLOW ALL:
1. CREATE ONE JSON OBJECT FOR EACH LINE/ENTRY - NEVER skip, merge, or summarize
2. If a line mentions a quantity (e.g., "3 chairs"), create 3 SEPARATE objects
3. NEVER group similar items - "Chair" on line 5 and "Chair" on line 10 are TWO separate items
4. Every numbered item, bullet point, or line is a SEPARATE item
5. Your output MUST have AT LEAST ${expectedItemCount} items - if you return fewer, you are WRONG
6. Use Spanish item names

AVAILABLE CATEGORIES (use one of these keys):
{{CATEGORIES}}

AVAILABLE ROOMS (use one of these keys):
{{ROOMS}}

DOCUMENT TO PARSE (${lineCount} LINES - RETURN ${expectedItemCount}+ ITEMS):
{{CONTENT}}

Return ONLY a valid JSON array. Each object must have:
- name: Spanish item name
- quantity: 1 (ALWAYS 1 - expand multi-quantity into separate entries)
- room: room key from above
- category: category key from above

CRITICAL: This document has ${lineCount} lines. You MUST return at least ${expectedItemCount} JSON objects. Returning fewer means you are summarizing/grouping which is FORBIDDEN.

Return [] if no items found. Return ONLY the JSON array.`;
            
            // Use config prompt if available, otherwise use our explicit prompt
            const docConfigPrompt = isSpanish ? aiConfig?.documentParsePromptEs : aiConfig?.documentParsePrompt;
            let parsePrompt = replacePlaceholders(docConfigPrompt || docDefaultPrompt, extractedText);
            
            // Always prepend the line count warning to any prompt
            if (docConfigPrompt) {
              parsePrompt = `IMPORTANT: This document has ${lineCount} lines. You MUST return at least ${expectedItemCount} items. One item per line - NO grouping.\n\n` + parsePrompt;
            }

            const completion = await openai.chat.completions.create({
              model: resolveAiModel(aiConfig?.model),
              messages: [{ role: 'user', content: parsePrompt }],
              response_format: { type: "json_object" },
              temperature: 0.2, // Lower temperature for more deterministic output
              max_tokens: 16000, // Increase for large documents
              jsonArray: true,
              validateJson: isInventoryParserResponse,
            });

            const responseContent = completion.choices[0]?.message?.content || '[]';
            
            try {
              const jsonMatch = responseContent.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                parsedItems = JSON.parse(jsonMatch[0]);
                
                // Validation: Log warning if AI returned significantly fewer items than expected
                if (parsedItems.length < expectedItemCount * 0.8) {
                  console.warn(`AI parsing returned ${parsedItems.length} items but document has ${lineCount} lines (expected ~${expectedItemCount}). Possible grouping occurred.`);
                } else {
                  console.log(`AI parsing successful: ${parsedItems.length} items from ${lineCount} lines`);
                }
              }
            } catch (parseErr) {
              console.error('Failed to parse AI response:', responseContent);
            }
          }

          // Validate and clean parsed items - strictly enforce valid categories/rooms
          const validItems = parsedItems
            .filter((item: any) => item.name && typeof item.name === 'string')
            .map((item: any, index: number) => {
              // Strictly validate category - default to 'other' only if invalid
              let category = item.category;
              if (!category || !validCategoryKeys.includes(category)) {
                category = 'other';
              }
              
              // Strictly validate room - default to 'sin_habitacion' if invalid
              let room = item.room;
              if (!room || !validRoomKeys.includes(room)) {
                room = 'sin_habitacion';
              }
              
              // Get weight/volume from the matched category
              const categoryData = categories.find(c => c.key === category);
              const estimatedWeightKg = categoryData?.avgWeightKg || 20;
              const estimatedVolumeM3 = categoryData?.avgVolumeM3 || 0.5;
              
              return {
                id: `upload-${Date.now()}-${index}`,
                name: item.name,
                quantity: Math.max(1, parseInt(item.quantity) || 1),
                room,
                category,
                estimatedWeightKg,
                estimatedVolumeM3
              };
            });

          res.json({
            success: true,
            items: validItems,
            message: isSpanish 
              ? `Se encontraron ${validItems.length} artículos en el archivo.`
              : `Found ${validItems.length} items in the file.`,
            fileName: file.originalname
          });

        } catch (parseError: any) {
          console.error('File parsing error:', parseError);
          res.status(500).json({ 
            message: isSpanish 
              ? 'Error al procesar el archivo. Intente con otro formato.' 
              : 'Error processing file. Please try a different format.'
          });
        }
      });
    } catch (error: any) {
      console.error('Upload error:', error);
      res.status(500).json({ message: error.message || 'Upload failed' });
    }
  });

  // ========== WEBSITE CONFIG ROUTES (Admin) ==========

  // Get website config (public)
  app.get("/api/website-config", async (req: Request, res: Response) => {
    try {
      const config = await storage.getWebsiteConfig();
      res.json({ config });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update website config (admin)
  app.patch("/api/admin/website-config", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const config = await storage.updateWebsiteConfig(req.body);
      res.json({ config });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== EMAIL SENDERS ROUTES (Admin) ==========

  // Get all email senders
  app.get("/api/admin/email-senders", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const senders = await storage.getEmailSenders();
      res.json(senders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new email sender
  app.post("/api/admin/email-senders", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { displayName, email, isDefault } = req.body;
      if (!displayName || !email) {
        return res.status(400).json({ message: 'Display name and email are required' });
      }
      const sender = await storage.createEmailSender({ displayName, email, isDefault: isDefault || false });
      res.status(201).json(sender);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update email sender
  app.put("/api/admin/email-senders/:id", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const sender = await storage.updateEmailSender(req.params.id, req.body);
      res.json(sender);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete email sender
  app.delete("/api/admin/email-senders/:id", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      await storage.deleteEmailSender(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Set default email sender
  app.patch("/api/admin/email-senders/:id/set-default", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const sender = await storage.setDefaultEmailSender(req.params.id);
      res.json(sender);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== EMAIL CONFIG ROUTES (Admin) ==========

  // Get email config
  app.get("/api/admin/email-config", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const config = await storage.getEmailConfig();
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update email config
  app.put("/api/admin/email-config", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const config = await storage.updateEmailConfig(req.body);
      res.json(config);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get email logs
  app.get("/api/admin/email-logs", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const channel = req.query.channel as string | undefined;
      const logs = await storage.getEmailLogs(limit, channel);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get email stats
  app.get("/api/admin/email-stats", requireAdmin, async (req: Request, res: Response) => {
    try {
      const channel = req.query.channel as string | undefined;
      const stats = await storage.getEmailStats(channel);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get Gmail connection status
  app.get("/api/admin/gmail-status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { checkGmailConnectionStatus } = await import('./emailService');
      const status = await checkGmailConnectionStatus();
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ 
        isConnected: false, 
        primaryEmail: null, 
        sendAsAddresses: [],
        error: error.message 
      });
    }
  });

  // ========== EMAIL TEMPLATES ROUTES (Admin) ==========

  // Get all email templates
  app.get("/api/admin/email-templates", requireAdmin, async (req: Request, res: Response) => {
    try {
      const templates = await storage.getAllEmailTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single email template
  app.get("/api/admin/email-templates/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create email template
  app.post("/api/admin/email-templates", requireAdmin, async (req: Request, res: Response) => {
    try {
      const template = await storage.createEmailTemplate(req.body);
      res.status(201).json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update email template
  app.put("/api/admin/email-templates/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const template = await storage.updateEmailTemplate(req.params.id, req.body);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete email template
  app.delete("/api/admin/email-templates/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteEmailTemplate(req.params.id);
      res.json({ message: "Template deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Translate template content from Spanish to English using AI
  app.post("/api/admin/translate-template", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { subjectEs, bodyHtmlEs } = req.body;
      if (!subjectEs && !bodyHtmlEs) {
        return res.status(400).json({ message: "No content to translate" });
      }
      
      const openai = createAiClient();
      
      // Get centralized AI config for model selection
      const aiConfig = await storage.getAiAgentConfig();

      const prompt = `Translate the following Spanish email template content to English. 
Preserve all HTML tags and {{variable}} placeholders exactly as they are.
Only translate the text content, not the HTML structure or variables.

${subjectEs ? `Subject (Spanish): ${subjectEs}` : ''}

${bodyHtmlEs ? `Body HTML (Spanish): ${bodyHtmlEs}` : ''}

Return the response as JSON with this exact format:
{"subjectEn": "translated subject if provided", "bodyHtmlEn": "translated body HTML if provided"}`;

      const response = await openai.chat.completions.create({
        model: resolveAiModel(aiConfig?.model),
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        max_tokens: 4096,
      });
      
      const content = response.choices[0]?.message?.content || '{}';
      
      let translated: { subjectEn?: string; bodyHtmlEn?: string };
      try {
        translated = JSON.parse(content);
      } catch (parseError) {
        console.error('Failed to parse AI response:', content);
        return res.status(500).json({ message: "Failed to parse translation response" });
      }
      
      if (!translated.subjectEn && !translated.bodyHtmlEn) {
        return res.status(500).json({ message: "Translation returned empty content" });
      }
      
      res.json({
        subjectEn: translated.subjectEn || '',
        bodyHtmlEn: translated.bodyHtmlEn || ''
      });
    } catch (error: any) {
      console.error('Translation error:', error);
      res.status(500).json({ message: error.message || "Translation failed" });
    }
  });

  // Preview email template with sample data
  app.post("/api/admin/email-templates/:id/preview", requireAdmin, async (req: Request, res: Response) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      const { language = 'es', sampleData = {} } = req.body;
      
      // Replace placeholders with sample data
      let subject = language === 'en' ? template.subjectEn : template.subjectEs;
      let body = language === 'en' ? template.bodyHtmlEn : template.bodyHtmlEs;
      
      Object.entries(sampleData).forEach(([key, value]) => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        subject = subject.replace(regex, String(value));
        body = body.replace(regex, String(value));
      });
      
      res.json({ subject, body, language });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Manual send email template to audience
  app.post("/api/admin/email-templates/send-manual", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { templateId, audience } = req.body;
      
      if (!templateId) {
        return res.status(400).json({ message: "Template ID is required" });
      }
      
      const template = await storage.getEmailTemplate(templateId);
      if (!template) {
        return res.status(404).json({ message: "Template not found" });
      }
      
      // Get recipients based on audience using role system
      let recipients: Array<{ email: string; name: string; language: string }> = [];
      
      // Helper to get users by role
      const getUsersByRole = async (role: string, defaultName: string) => {
        const result = await db.selectDistinct({
          email: users.email,
          name: sql<string>`COALESCE(${users.fullName}, COALESCE(${users.firstName}, '') || ' ' || COALESCE(${users.lastName}, ''))`,
          language: users.preferredLanguage,
        })
        .from(users)
        .innerJoin(userRoles, eq(users.id, userRoles.userId))
        .where(and(
          eq(userRoles.role, role),
          eq(userRoles.isActive, true),
          eq(users.isActive, true),
          isNotNull(users.email)
        ));
        return result.map(u => ({
          email: u.email!,
          name: u.name?.trim() || defaultName,
          language: u.language || 'es'
        }));
      };
      
      if (audience === 'clients' || audience === 'all_users') {
        const clients = await getUsersByRole('client', 'Cliente');
        recipients = [...recipients, ...clients];
      }
      
      if (audience === 'movers' || audience === 'all_users') {
        const movers = await getUsersByRole('mover', 'Socio');
        recipients = [...recipients, ...movers];
      }
      
      if (audience === 'admins' || audience === 'all_users') {
        const admins = await getUsersByRole('admin', 'Admin');
        recipients = [...recipients, ...admins];
      }
      
      if (recipients.length === 0) {
        return res.status(400).json({ message: "No recipients found for the selected audience" });
      }
      
      // Remove duplicates
      const uniqueRecipients = Array.from(
        new Map(recipients.map(r => [r.email, r])).values()
      );
      
      // Send emails
      let sentCount = 0;
      for (const recipient of uniqueRecipients) {
        try {
          const lang = recipient.language === 'en' ? 'en' : 'es';
          let subject = lang === 'en' ? template.subjectEn : template.subjectEs;
          let body = lang === 'en' ? template.bodyHtmlEn : template.bodyHtmlEs;
          
          // Replace placeholders
          subject = subject.replace(/{{userName}}/g, recipient.name);
          subject = subject.replace(/{{userEmail}}/g, recipient.email);
          body = body.replace(/{{userName}}/g, recipient.name);
          body = body.replace(/{{userEmail}}/g, recipient.email);
          
          await sendEmail(recipient.email, subject, body);
          
          // Log the email
          await storage.createEmailLog({
            templateKey: template.templateKey,
            recipientEmail: recipient.email,
            subject,
            category: template.category,
            status: 'sent',
            sentAt: new Date(),
          });
          
          sentCount++;
        } catch (emailError) {
          console.error(`Failed to send email to ${recipient.email}:`, emailError);
          await storage.createEmailLog({
            templateKey: template.templateKey,
            recipientEmail: recipient.email,
            subject: template.subjectEs,
            category: template.category,
            status: 'failed',
            errorMessage: String(emailError),
          });
        }
      }
      
      res.json({ 
        success: true, 
        recipientCount: uniqueRecipients.length,
        sentCount 
      });
    } catch (error: any) {
      console.error('Manual send error:', error);
      res.status(500).json({ message: error.message || "Failed to send emails" });
    }
  });

  // ========== EMAIL EVENT TYPES ROUTES (Admin) ==========

  // Get all email event types
  app.get("/api/admin/email-event-types", requireAdmin, async (req: Request, res: Response) => {
    try {
      const eventTypes = await storage.getAllEmailEventTypes();
      res.json(eventTypes);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== EMAIL TRIGGERS ROUTES (Admin) ==========

  // Get all email triggers
  app.get("/api/admin/email-triggers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const triggers = await storage.getAllEmailTriggers();
      res.json(triggers);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single email trigger
  app.get("/api/admin/email-triggers/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const trigger = await storage.getEmailTrigger(req.params.id);
      if (!trigger) {
        return res.status(404).json({ message: "Trigger not found" });
      }
      res.json(trigger);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create email trigger
  app.post("/api/admin/email-triggers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { eventTypeId, templateId, delayMinutes, recipientType } = req.body;
      
      // Get the event type to populate trigger fields
      const eventType = await storage.getEmailEventType(eventTypeId);
      if (!eventType) {
        return res.status(400).json({ message: "Invalid event type" });
      }
      
      const trigger = await storage.createEmailTrigger({
        eventTypeId,
        eventKey: eventType.eventKey,
        eventNameEn: eventType.nameEn,
        eventNameEs: eventType.nameEs,
        eventDescriptionEn: eventType.descriptionEn,
        eventDescriptionEs: eventType.descriptionEs,
        templateId: templateId || null,
        isEnabled: true,
        delayMinutes: delayMinutes || 0,
        recipientType: recipientType || eventType.defaultRecipientType,
      });
      res.status(201).json(trigger);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update email trigger
  app.put("/api/admin/email-triggers/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const trigger = await storage.updateEmailTrigger(req.params.id, req.body);
      res.json(trigger);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete email trigger
  app.delete("/api/admin/email-triggers/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteEmailTrigger(req.params.id);
      res.json({ message: "Trigger deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== EMAIL CAMPAIGNS ROUTES (Admin) ==========

  // Get all email campaigns
  app.get("/api/admin/email-campaigns", requireAdmin, async (req: Request, res: Response) => {
    try {
      const campaigns = await storage.getAllEmailCampaigns();
      res.json(campaigns);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single email campaign
  app.get("/api/admin/email-campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const campaign = await storage.getEmailCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create email campaign
  app.post("/api/admin/email-campaigns", requireAdmin, async (req: Request, res: Response) => {
    try {
      const campaign = await storage.createEmailCampaign(req.body);
      res.status(201).json(campaign);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update email campaign
  app.put("/api/admin/email-campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const campaign = await storage.updateEmailCampaign(req.params.id, req.body);
      res.json(campaign);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete email campaign
  app.delete("/api/admin/email-campaigns/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      await storage.deleteEmailCampaign(req.params.id);
      res.json({ message: "Campaign deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== SAVED ADDRESSES ROUTES ==========

  // Get saved addresses (caller must be the address owner)
  app.get("/api/addresses/:userId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const callerId = getUserId(req);
      if (callerId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      const addresses = await storage.getSavedAddresses(userId);
      res.json({ addresses });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create saved address
  app.post("/api/addresses", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const address = await storage.createSavedAddress(req.body);
      res.json({ address });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete saved address
  app.delete("/api/addresses/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteSavedAddress(id);
      res.json({ message: "Address deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== QUOTE SERVICE/ADDON ASSOCIATION ROUTES ==========

  // Add service to quote
  app.post("/api/quotes/:quoteId/services/:serviceId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { quoteId, serviceId } = req.params;
      const activeUserId = getActiveUserId(req);

      if (!activeUserId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const isOwner = quote.userId === activeUserId;
      if (!isOwner) {
        const hasAdminRole = await storage.hasRole(activeUserId, 'admin');
        const callerUser = await storage.getUser(activeUserId);
        if (!hasAdminRole && callerUser?.userType !== 'admin') {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.addServiceToQuote(quoteId, serviceId);
      res.json({ message: "Service added to quote" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Add add-on to quote
  app.post("/api/quotes/:quoteId/addons/:addOnId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { quoteId, addOnId } = req.params;
      const activeUserId = getActiveUserId(req);

      if (!activeUserId) {
        return res.status(401).json({ message: "Authentication required" });
      }

      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      const isOwner = quote.userId === activeUserId;
      if (!isOwner) {
        const hasAdminRole = await storage.hasRole(activeUserId, 'admin');
        const callerUser = await storage.getUser(activeUserId);
        if (!hasAdminRole && callerUser?.userType !== 'admin') {
          return res.status(403).json({ message: "Access denied" });
        }
      }

      await storage.addAddOnToQuote(quoteId, addOnId);
      res.json({ message: "Add-on added to quote" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== USER ROLES ROUTES (Admin) ==========

  // Get user roles
  app.get("/api/admin/users/:userId/roles", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const roles = await storage.getUserRoles(userId);
      const access = await getPlatformAdminAccess(userId);
      const assignedDefinitions = access.platformRoles.length
        ? await db.select().from(platformRoles).where(inArray(platformRoles.slug, access.platformRoles))
        : [];
      const assignedModules = assignedDefinitions.length
        ? await db.select().from(platformRoleModules).where(inArray(platformRoleModules.roleId, assignedDefinitions.map((role) => role.id)))
        : [];
      res.json({
        roles,
        platformRoles: assignedDefinitions.map((role) => ({
          ...role,
          modules: assignedModules.filter((module) => module.roleId === role.id).map((module) => module.moduleKey),
        })),
        effectivePermissions: access.effectivePermissions,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Add role to user
  app.post("/api/admin/users/:userId/roles", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const user = req.user as any;
      if (await isManagedPlatformRole(role)) {
        return res.status(400).json({ message: "Platform admin roles must be assigned from Admin management" });
      }

      if (role === 'admin') {
        return res.status(400).json({ message: "Use Admin management to grant administrator access and a workspace role" });
      }

      const newRole = await storage.addUserRole({
        userId,
        role,
        grantedBy: user?.id,
      });
      
      // If adding mover role, ensure mover profile exists
      if (role === 'mover') {
        await storage.ensureMoverProfile(userId);
      }
      
      // Log activity
      await storage.logActivity({
        userId: user?.id,
        actorRole: 'admin',
        action: 'user.role_added',
        entityType: 'user',
        entityId: userId,
        details: { role },
      });
      
      res.json({ role: newRole });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Remove role from user
  app.delete("/api/admin/users/:userId/roles/:role", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, role } = req.params;
      const user = req.user as any;
      if (await isManagedPlatformRole(role)) {
        return res.status(400).json({ message: "Platform admin roles must be changed from Admin management" });
      }

      // Removing the admin role requires super admin or canManageAdmins
      if (role === 'admin') {
        const currentUserId = getActiveUserId(req);
        if (!currentUserId) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        const callerPerms = await storage.getAdminPermissions(currentUserId);
        if (!callerPerms?.isSuperAdmin && !callerPerms?.canManageAdmins) {
          return res.status(403).json({ message: "Only super admins can remove the admin role" });
        }
      }

      await storage.removeUserRole(userId, role);
      
      // Log activity
      await storage.logActivity({
        userId: user?.id,
        actorRole: 'admin',
        action: 'user.role_removed',
        entityType: 'user',
        entityId: userId,
        details: { role },
      });
      
      res.json({ message: "Role removed" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Sync user roles (add/remove to match provided array)
  app.put("/api/admin/users/:userId/roles", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { roles } = req.body;
      const user = req.user as any;
      
      if (!Array.isArray(roles)) {
        return res.status(400).json({ message: "roles must be an array" });
      }
      
      // Validate roles
      const validRoles = ['client', 'mover', 'admin'];
      for (const role of roles) {
        if (!validRoles.includes(role)) {
          return res.status(400).json({ message: `Invalid role: ${role}` });
        }
      }
      
      // Check if adding admin role - requires super admin
      const currentRoles = await storage.getUserRoles(userId);
      const currentRoleNames = currentRoles.map(r => r.role);
      const addingAdmin = roles.includes('admin') && !currentRoleNames.includes('admin');
      const removingAdmin = !roles.includes('admin') && currentRoleNames.includes('admin');
      
      if (addingAdmin || removingAdmin) {
        return res.status(400).json({ message: "Use Admin management to change administrator access" });
      }
      
      const preservedPlatformRoles = (await getPlatformAdminAccess(userId)).platformRoles;
      await storage.syncUserRoles(userId, [...roles, ...preservedPlatformRoles], user?.id);
      
      // If mover role is included, ensure mover profile exists
      if (roles.includes('mover')) {
        await storage.ensureMoverProfile(userId);
      }
      
      // Log activity
      await storage.logActivity({
        userId: user?.id,
        actorRole: 'admin',
        action: 'user.roles_synced',
        entityType: 'user',
        entityId: userId,
        details: { roles },
      });
      
      const updatedRoles = await storage.getUserRoles(userId);
      res.json({ roles: updatedRoles });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get users by role
  app.get("/api/admin/roles/:role/users", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { role } = req.params;
      const users = await storage.getUsersByRole(role);
      
      // Get last activity for all users
      const lastActiveMap = await storage.getLastActiveByUserIds(users.map(u => u.id));
      
      const usersWithActivity = users.map(({ password: _, ...user }) => ({
        ...user,
        lastActiveAt: lastActiveMap.get(user.id)?.toISOString() || user.lastLoginAt || user.createdAt,
      }));
      res.json({ users: usersWithActivity });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== ADMIN MANAGEMENT ROUTES ==========

  const requireEffectiveSuperAdmin = async (req: Request, res: Response, next: any) => {
    const callerId = getCallerUserId(req);
    const access = callerId ? await getPlatformAdminAccess(callerId, (req as any).session?.activePlatformRole) : null;
    if (access?.activePlatformRole !== "super_admin") {
      return res.status(403).json({ message: "Only super admins can manage platform roles" });
    }
    next();
  };
  const isEffectiveSuperAdmin = async (userId: string | undefined) =>
    !!userId && (await getPlatformAdminAccess(userId)).platformRoles.includes("super_admin");

  app.get("/api/admin/workspace-layout", isAuthenticated, requireAdmin, async (_req: Request, res: Response) => {
    const saved = await db.select().from(adminWorkspaceSections).orderBy(adminWorkspaceSections.workspaceKey, adminWorkspaceSections.position);
    res.json({ layout: reconcileAdminWorkspaceLayout(saved) });
  });

  app.put("/api/admin/workspace-layout", isAuthenticated, requireAdmin, requireEffectiveSuperAdmin, async (req: Request, res: Response) => {
    const layout = Array.isArray(req.body?.layout) ? req.body.layout : [];
    const allowedRoutes = new Set(DEFAULT_ADMIN_WORKSPACE_LAYOUT.map((item) => item.href));
    const allowedWorkspaces = new Set<string>(ADMIN_WORKSPACE_DEFINITIONS.map((workspace) => workspace.key));
    const submittedRoutes = new Set(layout.map((item: any) => String(item?.href || "")));
    const valid = layout.length === allowedRoutes.size
      && submittedRoutes.size === allowedRoutes.size
      && [...allowedRoutes].every((route) => submittedRoutes.has(route))
      && layout.every((item: any) =>
        allowedRoutes.has(String(item?.href || ""))
        && allowedWorkspaces.has(String(item?.workspaceKey || ""))
        && Number.isInteger(item?.position)
        && item.position >= 0,
      );
    if (!valid) return res.status(400).json({ message: "A complete valid workspace layout is required" });

    const normalized = ADMIN_WORKSPACE_DEFINITIONS.flatMap((workspace) =>
      layout
        .filter((item: any) => item.workspaceKey === workspace.key)
        .sort((a: any, b: any) => a.position - b.position)
        .map((item: any, position: number) => ({
          href: item.href,
          workspaceKey: workspace.key as AdminWorkspaceKey,
          position,
        })),
    );
    await db.transaction(async (tx) => {
      await tx.delete(adminWorkspaceSections);
      await tx.insert(adminWorkspaceSections).values(normalized.map((item) => ({
        ...item,
        updatedBy: getCallerUserId(req),
      })));
    });
    await storage.logActivity({
      userId: getCallerUserId(req),
      actorRole: "admin",
      action: "admin.workspace_layout.updated",
      entityType: "workspace_layout",
      details: { layout: normalized },
    });
    res.json({ layout: normalized });
  });

  app.get("/api/admin/platform-roles", isAuthenticated, requireAdmin, requireEffectiveSuperAdmin, async (_req: Request, res: Response) => {
    const definitions = await db.select().from(platformRoles).orderBy(platformRoles.name);
    const modules = await db.select().from(platformRoleModules);
    const assignments = await db.select({ role: userRoles.role, count: sql<number>`count(*)` }).from(userRoles)
      .where(eq(userRoles.isActive, true)).groupBy(userRoles.role);
    const assignmentMap = new Map(assignments.map((row) => [row.role, Number(row.count)]));
    res.json({ roles: definitions.map((role) => ({
      ...role,
      modules: modules.filter((module) => module.roleId === role.id).map((module) => module.moduleKey),
      assignedUsers: assignmentMap.get(role.slug) || 0,
    })), availableModules: PLATFORM_ADMIN_ALL_MODULES.filter((module) => module !== "module:role_management") });
  });

  app.post("/api/admin/platform-roles", isAuthenticated, requireAdmin, requireEffectiveSuperAdmin, async (req: Request, res: Response) => {
    const slug = String(req.body?.slug || "").trim().toLowerCase();
    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim() || null;
    const validation = validatePlatformRoleModules(req.body?.modules ?? []);
    if (!/^[a-z][a-z0-9_]{1,63}$/.test(slug) || !name) return res.status(400).json({ message: "A valid role name and slug are required" });
    if (["admin", "client", "mover"].includes(slug)) return res.status(400).json({ message: "This role slug is reserved" });
    if (!validation.valid) return res.status(400).json({ message: validation.message });
    const modules = validation.modules;
    try {
      const role = await db.transaction(async (tx) => {
        const [created] = await tx.insert(platformRoles).values({ slug, name, description, createdBy: getCallerUserId(req), updatedBy: getCallerUserId(req) }).returning();
        if (modules.length) await tx.insert(platformRoleModules).values(modules.map((moduleKey: string) => ({ roleId: created.id, moduleKey })));
        return created;
      });
      await storage.logActivity(platformRoleAuditRecord({
        operation: "created",
        actorId: getCallerUserId(req),
        roleId: role.id,
        slug: role.slug,
        modules,
      }));
      res.status(201).json(role);
    } catch (error: any) {
      res.status(error?.code === "23505" ? 409 : 500).json({ message: error?.code === "23505" ? "A role with this slug already exists" : error.message });
    }
  });

  app.patch("/api/admin/platform-roles/:roleId", isAuthenticated, requireAdmin, requireEffectiveSuperAdmin, async (req: Request, res: Response) => {
    const [existing] = await db.select().from(platformRoles).where(eq(platformRoles.id, req.params.roleId));
    if (!existing) return res.status(404).json({ message: "Role not found" });
    const modulesSupplied = req.body?.modules !== undefined;
    const validation = modulesSupplied
      ? validatePlatformRoleModules(req.body.modules, { superAdmin: existing.slug === "super_admin" })
      : null;
    if (validation && !validation.valid) return res.status(400).json({ message: validation.message });
    const modules = validation?.valid ? validation.modules : null;
    const nextName = req.body.name === undefined ? existing.name : String(req.body.name).trim();
    if (!nextName) return res.status(400).json({ message: "A valid role name is required" });
    const role = await db.transaction(async (tx) => {
      const [updated] = await tx.update(platformRoles).set({
        name: nextName,
        description: req.body.description === undefined ? existing.description : String(req.body.description).trim() || null,
        isActive: existing.slug === "super_admin" ? true : req.body.isActive ?? existing.isActive,
        updatedBy: getCallerUserId(req), updatedAt: new Date(),
      }).where(eq(platformRoles.id, existing.id)).returning();
      if (modules) {
        await tx.delete(platformRoleModules).where(eq(platformRoleModules.roleId, existing.id));
        if (modules.length) await tx.insert(platformRoleModules).values(modules.map((moduleKey: string) => ({ roleId: existing.id, moduleKey })));
      }
      return updated;
    });
    await storage.logActivity(platformRoleAuditRecord({
      operation: "updated",
      actorId: getCallerUserId(req),
      roleId: existing.id,
      slug: existing.slug,
      modules: modules ?? undefined,
    }));
    res.json(role);
  });

  app.delete("/api/admin/platform-roles/:roleId", isAuthenticated, requireAdmin, requireEffectiveSuperAdmin, async (req: Request, res: Response) => {
    const [role] = await db.select().from(platformRoles).where(eq(platformRoles.id, req.params.roleId));
    if (!role) return res.status(404).json({ message: "Role not found" });
    if (role.isSystem) return res.status(400).json({ message: "System roles cannot be deleted" });
    const assigned = await db.select({ id: userRoles.id }).from(userRoles).where(and(eq(userRoles.role, role.slug), eq(userRoles.isActive, true)));
    if (assigned.length) return res.status(409).json({ message: "Reassign users before deleting this role", assignedUsers: assigned.length });
    await db.delete(platformRoles).where(eq(platformRoles.id, role.id));
    await storage.logActivity(platformRoleAuditRecord({
      operation: "deleted",
      actorId: getCallerUserId(req),
      roleId: role.id,
      slug: role.slug,
    }));
    res.json({ success: true });
  });

  // Get all admin users with permissions
  app.get("/api/admin/admins", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminsWithPerms = await storage.getAllAdminUsersWithPermissions();
      
      // Get last activity for all admin users
      const lastActiveMap = await storage.getLastActiveByUserIds(adminsWithPerms.map(a => a.id));
      
      const admins = await Promise.all(adminsWithPerms.map(async admin => {
        const { password: _, ...adminWithoutPassword } = admin;
        const lastActiveAt = lastActiveMap.get(admin.id)?.toISOString() || admin.lastLoginAt || admin.createdAt;
        const adminAccess = await getPlatformAdminAccess(admin.id);
        return {
          ...adminWithoutPassword,
          ...adminAccess,
          lastActiveAt,
          permissions: admin.permissions ? {
            canManageUsers: admin.permissions.canManageUsers,
            canManageMovers: admin.permissions.canManageMovers,
            canManageQuotes: admin.permissions.canManageQuotes,
            canManageSettings: admin.permissions.canManageSettings,
            canAccessDatabase: admin.permissions.canAccessDatabase,
            canManageAdmins: admin.permissions.canManageAdmins,
            isSuperAdmin: admin.permissions.isSuperAdmin,
          } : {
            canManageUsers: true,
            canManageMovers: true,
            canManageQuotes: true,
            canManageSettings: false,
            canAccessDatabase: false,
            canManageAdmins: false,
            isSuperAdmin: false,
          },
        };
      }));
      res.json({ admins });
    } catch (error: any) {
      console.error("Error fetching admins:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get single admin with permissions (admin)
  app.get("/api/admin/admins/:adminId", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { adminId } = req.params;
      const user = await storage.getUser(adminId);
      if (!user) {
        return res.status(404).json({ message: "Admin not found" });
      }
      
      // Check if user has admin role
      const roles = await storage.getUserRoles(adminId);
      const isAdmin = roles.some(r => r.role === 'admin' && r.isActive);
      if (!isAdmin) {
        return res.status(404).json({ message: "User is not an admin" });
      }
      
      const permissions = await storage.getAdminPermissions(adminId);
      const { password, ...safeUser } = user;
      
      // Get last activity for this admin
      const lastActiveMap = await storage.getLastActiveByUserIds([adminId]);
      const lastActiveAt = lastActiveMap.get(adminId)?.toISOString() || user.lastLoginAt || user.createdAt;
      
      res.json({ 
        admin: {
          ...safeUser,
          lastActiveAt,
          permissions: permissions ? {
            id: permissions.id,
            canManageUsers: permissions.canManageUsers,
            canManageMovers: permissions.canManageMovers,
            canManageQuotes: permissions.canManageQuotes,
            canManageSettings: permissions.canManageSettings,
            canAccessDatabase: permissions.canAccessDatabase,
            canManageAdmins: permissions.canManageAdmins,
            isSuperAdmin: permissions.isSuperAdmin,
          } : {
            canManageUsers: true,
            canManageMovers: true,
            canManageQuotes: true,
            canManageSettings: false,
            canAccessDatabase: false,
            canManageAdmins: false,
            isSuperAdmin: false,
          },
        }
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get non-admin users (for adding new admins)
  app.get("/api/admin/non-admin-users", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const nonAdmins = await storage.getNonAdminUsers();
      
      // Get last activity for all users
      const lastActiveMap = await storage.getLastActiveByUserIds(nonAdmins.map(u => u.id));
      
      const users = nonAdmins.map(user => {
        const { password: _, ...userWithoutPassword } = user;
        return {
          ...userWithoutPassword,
          lastActiveAt: lastActiveMap.get(user.id)?.toISOString() || user.lastLoginAt || user.createdAt,
        };
      });
      res.json({ users });
    } catch (error: any) {
      console.error("Error fetching non-admin users:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Add admin role to user
  app.post("/api/admin/admins", isAuthenticated, requireAdmin, requireAdminPermission('canManageAdmins'), async (req: Request, res: Response) => {
    try {
      const { userId, permissions } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Only super admins can grant super admin permission
      if (permissions?.isSuperAdmin) {
        const currentUserId = getCallerUserId(req);
        if (!currentUserId) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        if (!(await isEffectiveSuperAdmin(currentUserId))) {
          return res.status(403).json({ message: "Only super admins can grant super admin privileges" });
        }
      }

      // Add admin role
      const hasAdminRole = await storage.hasRole(userId, 'admin');
      if (!hasAdminRole) {
        await storage.addUserRole({
          userId,
          role: 'admin',
        });
      }
      if (!(await storage.hasRole(userId, "operations"))) {
        await storage.addUserRole({ userId, role: "operations", grantedBy: getCallerUserId(req) });
      }

      // Update user type
      await storage.updateUser(userId, { userType: 'admin' });

      // Create permissions (strip isSuperAdmin if caller is not super admin)
      if (permissions) {
        const currentUserId = getActiveUserId(req);
        const callerPerms = currentUserId ? await storage.getAdminPermissions(currentUserId) : null;
        const safePermissions = callerPerms?.isSuperAdmin
          ? permissions
          : { ...permissions, isSuperAdmin: false };
        await storage.upsertAdminPermissions(userId, safePermissions);
      }

      // Log activity
      await storage.logActivity({
        actorRole: 'admin',
        action: 'admin.added',
        entityType: 'user',
        entityId: userId,
        details: { permissions },
      });

      res.json({ message: "Admin added successfully" });
    } catch (error: any) {
      console.error("Error adding admin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/admin/admins/:userId/platform-role", isAuthenticated, requireAdmin, requireEffectiveSuperAdmin, async (req: Request, res: Response) => {
    try {
      const role = String(req.body?.role || "");
      const [roleDefinition] = await db.select().from(platformRoles).where(and(eq(platformRoles.slug, role), eq(platformRoles.isActive, true)));
      if (!roleDefinition) {
        return res.status(400).json({ message: "Invalid platform admin role" });
      }
      const callerId = getCallerUserId(req);
      const callerAccess = callerId ? await getPlatformAdminAccess(callerId, (req as any).session?.activePlatformRole) : null;
      const user = await storage.getUser(req.params.userId);
      if (!user) return res.status(404).json({ message: "User not found" });
      const targetAccess = await getPlatformAdminAccess(req.params.userId);
      const changesSuperAdmin = role === "super_admin" || targetAccess.platformRoles.includes("super_admin");
      if (changesSuperAdmin && !callerAccess?.platformRoles.includes("super_admin")) {
        return res.status(403).json({ message: "Only super admins can assign or remove the super admin role" });
      }
      if (!callerId) return res.status(401).json({ message: "Authentication required" });
      await assignPlatformAdminRole({
        targetUserId: req.params.userId,
        newRole: role,
        actorId: callerId,
      });
      res.json({ role, ...(await getPlatformAdminAccess(req.params.userId)) });
    } catch (error: any) {
      console.error("Error updating platform admin role:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Remove admin role from user
  app.delete("/api/admin/admins/:userId", isAuthenticated, requireAdmin, requireAdminPermission('canManageAdmins'), async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      // Check if user is a super admin - cannot remove super admins
      const perms = await storage.getAdminPermissions(userId);
      const targetAccess = await getPlatformAdminAccess(userId);
      if (perms?.isSuperAdmin || targetAccess.platformRoles.includes("super_admin")) {
        return res.status(403).json({ message: "Cannot remove super admin" });
      }

      // Remove both compatibility and canonical platform-admin roles.
      await storage.removeUserRole(userId, 'admin');
      for (const role of targetAccess.platformRoles) {
        await storage.removeUserRole(userId, role);
      }

      // Delete permissions
      await storage.deleteAdminPermissions(userId);

      // Update user type back to client if no other roles
      const remainingRoles = await storage.getUserRoles(userId);
      if (remainingRoles.length === 0 || remainingRoles.every((r: any) => r.role !== 'mover')) {
        await storage.updateUser(userId, { userType: 'client' });
      } else if (remainingRoles.some((r: any) => r.role === 'mover')) {
        await storage.updateUser(userId, { userType: 'mover' });
      }

      // Log activity
      await storage.logActivity({
        actorRole: 'admin',
        action: 'admin.removed',
        entityType: 'user',
        entityId: userId,
      });

      res.json({ message: "Admin removed successfully" });
    } catch (error: any) {
      console.error("Error removing admin:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update admin permissions
  app.put("/api/admin/admins/:userId/permissions", isAuthenticated, requireAdmin, requireAdminPermission('canManageAdmins'), async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const { permissions } = req.body;

      if (!permissions) {
        return res.status(400).json({ message: "Permissions are required" });
      }

      // Only super admins can set or change the isSuperAdmin flag
      if (permissions.isSuperAdmin !== undefined) {
        const currentUserId = getCallerUserId(req);
        if (!currentUserId) {
          return res.status(401).json({ message: "Not authenticated" });
        }
        if (!(await isEffectiveSuperAdmin(currentUserId))) {
          return res.status(403).json({ message: "Only super admins can modify super admin status" });
        }
      }

      // Strip isSuperAdmin from the payload for non-super-admin callers
      const currentUserId = getCallerUserId(req);
      const safePermissions = await isEffectiveSuperAdmin(currentUserId)
        ? permissions
        : { ...permissions, isSuperAdmin: false };

      const updated = await storage.upsertAdminPermissions(userId, safePermissions);

      // Log activity
      await storage.logActivity({
        actorRole: 'admin',
        action: 'admin.permissions_updated',
        entityType: 'user',
        entityId: userId,
        details: { permissions },
      });

      res.json({ permissions: updated });
    } catch (error: any) {
      console.error("Error updating permissions:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== ADMIN ACCESS REQUESTS (Public + Super Admin) ==========

  // Submit admin access request (public)
  app.post("/api/admin/access-requests", async (req: Request, res: Response) => {
    try {
      const { email, fullName, phone, company, justification } = req.body;

      if (!email || !fullName) {
        return res.status(400).json({ message: "Email and full name are required" });
      }

      // Check for existing pending request
      const existingRequest = await storage.getPendingRequestByEmail(email);
      if (existingRequest) {
        return res.status(400).json({ message: "A pending request already exists for this email" });
      }

      // Check if user already exists as admin
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        const isAdmin = await storage.hasRole(existingUser.id, 'admin');
        if (isAdmin) {
          return res.status(400).json({ message: "This email is already associated with an admin account" });
        }
      }

      const request = await storage.createAdminAccessRequest({
        email: email.toLowerCase(),
        fullName,
        phone,
        company,
        justification,
      });

      await storage.logActivity({
        actorRole: 'system',
        action: 'admin.access_requested',
        entityType: 'admin_access_request',
        entityId: request.id,
        details: { email, fullName },
      });

      res.status(201).json({ message: "Access request submitted successfully" });
    } catch (error: any) {
      console.error("Error submitting access request:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get admin access requests (super admin only)
  app.get("/api/admin/access-requests", isAuthenticated, requireAdmin, requireEffectiveSuperAdmin, async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const requests = await storage.getAdminAccessRequests(status);
      res.json({ requests });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Approve admin access request (super admin only)
  app.post("/api/admin/access-requests/:id/approve", isAuthenticated, requireAdmin, requireEffectiveSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { permissions } = req.body;
      const reviewerId = getCallerUserId(req)!;

      const request = await storage.getAdminAccessRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ message: "Request has already been processed" });
      }

      // Create or find user
      let user = await storage.getUserByEmail(request.email);
      if (!user) {
        user = await storage.createUser({
          email: request.email,
          fullName: request.fullName,
          phone: request.phone,
          userType: 'admin',
          isActive: true,
        });
      }

      // Add admin role
      await storage.addUserRole({
        userId: user.id,
        role: 'admin',
        grantedBy: reviewerId,
      });

      // Create admin permissions
      const defaultPerms = permissions || {
        canManageUsers: true,
        canManageMovers: true,
        canManageQuotes: true,
        canManageSettings: false,
        canAccessDatabase: false,
        canManageAdmins: false,
        isSuperAdmin: false,
      };
      await storage.upsertAdminPermissions(user.id, {
        ...defaultPerms,
        updatedBy: reviewerId,
      });

      // Generate password reset token
      const { randomBytes } = await import('crypto');
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days to set password
      await storage.createPasswordResetToken(user.id, token, expiresAt);

      // Update request
      await storage.updateAdminAccessRequest(id, {
        status: 'approved',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        userId: user.id,
      });

      await storage.logActivity({
        userId: reviewerId,
        actorRole: 'admin',
        action: 'admin.access_approved',
        entityType: 'admin_access_request',
        entityId: id,
        details: { approvedEmail: request.email, newUserId: user.id },
      });

      // Send approval email with password setup link
      const resetLink = `${process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/reset-password?token=${token}`;
      const emailSent = await sendAdminApprovalEmail(request.email, request.fullName, resetLink, 'es');
      if (!emailSent) {
        console.log(`[EMAIL FALLBACK] Admin access approved for ${request.email}. Password setup link: ${resetLink}`);
      }

      res.json({ 
        message: "Request approved successfully",
        passwordSetupLink: resetLink,
        emailSent,
      });
    } catch (error: any) {
      console.error("Error approving access request:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Deny admin access request (super admin only)
  app.post("/api/admin/access-requests/:id/deny", isAuthenticated, requireAdmin, requireEffectiveSuperAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const reviewerId = getCallerUserId(req)!;

      const request = await storage.getAdminAccessRequest(id);
      if (!request) {
        return res.status(404).json({ message: "Request not found" });
      }

      if (request.status !== 'pending') {
        return res.status(400).json({ message: "Request has already been processed" });
      }

      await storage.updateAdminAccessRequest(id, {
        status: 'denied',
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewNotes: reason,
      });

      await storage.logActivity({
        userId: reviewerId,
        actorRole: 'admin',
        action: 'admin.access_denied',
        entityType: 'admin_access_request',
        entityId: id,
        details: { deniedEmail: request.email, reason },
      });

      // Send denial notification email
      await sendAdminAccessDeniedEmail(request.email, request.fullName, reason, 'es');

      res.json({ message: "Request denied successfully" });
    } catch (error: any) {
      console.error("Error denying access request:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== QUOTE WORKFLOW STATUSES ==========

  // Get all workflow statuses (public - needed for quote display)
  app.get("/api/quote-workflow-statuses", async (req: Request, res: Response) => {
    try {
      const statuses = await storage.getQuoteWorkflowStatuses();
      res.json(statuses);
    } catch (error: any) {
      console.error("Error fetching workflow statuses:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get all workflow statuses
  app.get("/api/admin/quote-workflow-statuses", requireAdmin, async (req: Request, res: Response) => {
    try {
      const statuses = await storage.getQuoteWorkflowStatuses();
      res.json(statuses);
    } catch (error: any) {
      console.error("Error fetching workflow statuses:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Create workflow status
  app.post("/api/admin/quote-workflow-statuses", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { key, labelEs, labelEn, description, descriptionEs, color, bgColor, icon, sortOrder, isActive, isFinal, isDefault } = req.body;
      
      if (!key || !labelEs || !labelEn) {
        return res.status(400).json({ message: "key, labelEs, and labelEn are required" });
      }

      // Check for duplicate key
      const existing = await storage.getQuoteWorkflowStatusByKey(key);
      if (existing) {
        return res.status(400).json({ message: "A status with this key already exists" });
      }

      const status = await storage.createQuoteWorkflowStatus({
        key,
        labelEs,
        labelEn,
        description,
        descriptionEs,
        color,
        bgColor,
        icon,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
        isFinal: isFinal ?? false,
        isDefault: isDefault ?? false,
      });

      res.status(201).json(status);
    } catch (error: any) {
      console.error("Error creating workflow status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update workflow status
  app.patch("/api/admin/quote-workflow-statuses/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { key, labelEs, labelEn, description, descriptionEs, color, bgColor, icon, sortOrder, isActive, isFinal, isDefault } = req.body;

      const existing = await storage.getQuoteWorkflowStatus(id);
      if (!existing) {
        return res.status(404).json({ message: "Workflow status not found" });
      }

      // If key is being changed, check for duplicates
      if (key && key !== existing.key) {
        const duplicate = await storage.getQuoteWorkflowStatusByKey(key);
        if (duplicate) {
          return res.status(400).json({ message: "A status with this key already exists" });
        }
      }

      const updated = await storage.updateQuoteWorkflowStatus(id, {
        key,
        labelEs,
        labelEn,
        description,
        descriptionEs,
        color,
        bgColor,
        icon,
        sortOrder,
        isActive,
        isFinal,
        isDefault,
      });

      res.json(updated);
    } catch (error: any) {
      console.error("Error updating workflow status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Delete workflow status
  app.delete("/api/admin/quote-workflow-statuses/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const existing = await storage.getQuoteWorkflowStatus(id);
      if (!existing) {
        return res.status(404).json({ message: "Workflow status not found" });
      }

      // Check if any quotes are using this status
      const quotesWithStatus = await db.select({ count: sql`count(*)` })
        .from(quotes)
        .where(eq(quotes.workflowStatus, existing.key));
      
      const count = Number(quotesWithStatus[0]?.count || 0);
      if (count > 0) {
        return res.status(400).json({ 
          message: `Cannot delete: ${count} quote(s) are using this status. Please reassign them first.` 
        });
      }

      await storage.deleteQuoteWorkflowStatus(id);
      res.json({ message: "Status deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting workflow status:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Reorder workflow statuses
  app.post("/api/admin/quote-workflow-statuses/reorder", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { orderedIds } = req.body;
      
      if (!Array.isArray(orderedIds)) {
        return res.status(400).json({ message: "orderedIds must be an array" });
      }

      await storage.reorderQuoteWorkflowStatuses(orderedIds);
      const statuses = await storage.getQuoteWorkflowStatuses();
      res.json(statuses);
    } catch (error: any) {
      console.error("Error reordering workflow statuses:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== DOCUMENT TYPES MANAGEMENT ==========

  // Admin: Get all document types
  app.get("/api/admin/document-types", requireAdmin, async (req: Request, res: Response) => {
    try {
      const types = await storage.getDocumentTypes();
      res.json(types);
    } catch (error: any) {
      console.error("Error fetching document types:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Create document type
  app.post("/api/admin/document-types", requireAdmin, async (req: Request, res: Response) => {
    try {
      const docType = await storage.createDocumentType(req.body);
      res.status(201).json(docType);
    } catch (error: any) {
      console.error("Error creating document type:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update document type
  app.put("/api/admin/document-types/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const docType = await storage.updateDocumentType(id, req.body);
      res.json(docType);
    } catch (error: any) {
      console.error("Error updating document type:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Delete document type
  app.delete("/api/admin/document-types/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await storage.deleteDocumentType(id);
      res.json({ message: "Document type deleted" });
    } catch (error: any) {
      console.error("Error deleting document type:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== PARTNER DOCUMENTS MANAGEMENT ==========

  // Partner: Get active document types (for upload UI)
  app.get("/api/mover/document-types", requireCompanyPermission("company:read"), async (req: Request, res: Response) => {
    try {
      const types = await storage.getActiveDocumentTypes();
      res.json(types);
    } catch (error: any) {
      console.error("Error fetching document types:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Partner: Get my documents
  app.get("/api/mover/documents", requireCompanyPermission("company:read"), async (req: Request, res: Response) => {
    try {
      const documents = await storage.getPartnerDocumentsWithTypes((req as any).company.id);
      res.json(documents);
    } catch (error: any) {
      console.error("Error fetching partner documents:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Partner: Upload document
  app.post("/api/mover/documents", requireCompanyPermission("company:manage"), async (req: Request, res: Response) => {
    try {
      const companyId = (req as any).company.id;

      const { documentTypeId, fileName, fileType, fileSize, fileData } = req.body;

      if (!documentTypeId || !fileName || !fileData) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Check if document for this type already exists - update it
      const existing = await storage.getPartnerDocumentByType(companyId, documentTypeId);
      if (existing) {
        const updated = await storage.updatePartnerDocument(existing.id, {
          fileName,
          fileType,
          fileSize,
          fileData,
          status: 'submitted',
        });
        return res.json(updated);
      }

      const document = await storage.createPartnerDocument({
        moverProfileId: companyId,
        documentTypeId,
        fileName,
        fileType,
        fileSize,
        fileData,
        status: 'submitted',
      });

      res.status(201).json(document);
    } catch (error: any) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Partner: Delete my document
  app.delete("/api/mover/documents/:id", requireCompanyPermission("company:manage"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const doc = await storage.getPartnerDocument(id);
      if (!doc || doc.moverProfileId !== (req as any).company.id) {
        return res.status(404).json({ message: "Document not found" });
      }

      await storage.deletePartnerDocument(id);
      res.json({ message: "Document deleted" });
    } catch (error: any) {
      console.error("Error deleting document:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get partner documents for a mover
  app.get("/api/admin/movers/:moverId/documents", requireAdmin, requireAdminPermission('canManageMovers'), async (req: Request, res: Response) => {
    try {
      const { moverId } = req.params;
      const documents = await storage.getPartnerDocumentsWithTypes(moverId);
      res.json(documents);
    } catch (error: any) {
      console.error("Error fetching partner documents:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Review/approve/reject partner document
  app.put("/api/admin/documents/:id/review", requireAdmin, requireAdminPermission('canManageMovers'), async (req: Request, res: Response) => {
    try {
      const user = (req as any).dbUser as User;
      const { id } = req.params;
      const { status, reviewNote } = req.body;

      if (!status || !['approved', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
      }

      const doc = await storage.reviewPartnerDocument(id, user.id, status, reviewNote);
      res.json(doc);
    } catch (error: any) {
      console.error("Error reviewing document:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Download/view document file
  app.get("/api/admin/documents/:id/file", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const doc = await storage.getPartnerDocument(id);
      if (!doc || !doc.fileData) {
        return res.status(404).json({ message: "Document not found" });
      }

      const base64Data = doc.fileData;
      const buffer = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', doc.fileType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Partner: View own document file
  app.get("/api/mover/documents/:id/file", requireCompanyPermission("company:read"), async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const doc = await storage.getPartnerDocument(id);
      if (!doc || doc.moverProfileId !== (req as any).company.id || !doc.fileData) {
        return res.status(404).json({ message: "Document not found" });
      }

      const base64Data = doc.fileData;
      const buffer = Buffer.from(base64Data, 'base64');
      res.setHeader('Content-Type', doc.fileType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${doc.fileName}"`);
      res.send(buffer);
    } catch (error: any) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== SEO & MARKETING PUBLIC ROUTES ==========

  // Get public SEO settings (for frontend use)
  app.get("/api/seo/settings", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSeoSettings();
      res.json({
        defaultTitleTemplate: settings?.defaultTitleTemplate || '{{page}} | U-Storage Go',
        defaultTitleTemplateEs: settings?.defaultTitleTemplateEs || '{{page}} | U-Storage Go',
        defaultDescription: settings?.defaultDescription || 'Professional moving services in Latin America',
        defaultDescriptionEs: settings?.defaultDescriptionEs || 'Servicios profesionales de mudanza en Latinoamérica',
        defaultOgImage: settings?.defaultOgImage || '/opengraph.jpg',
        twitterHandle: settings?.twitterHandle || '@ustoragego',
        facebookAppId: settings?.facebookAppId,
        organizationName: settings?.organizationName || 'U-Storage Go',
        organizationLogo: settings?.organizationLogo,
        organizationPhone: settings?.organizationPhone,
        organizationEmail: settings?.organizationEmail,
        llmsTxtContent: settings?.llmsTxtContent,
        llmsFullTxtContent: settings?.llmsFullTxtContent,
        robotsTxtCustomRules: settings?.robotsTxtCustomRules,
        allowAiCrawlers: settings?.allowAiCrawlers ?? true,
        sitemapAutoUpdate: settings?.sitemapAutoUpdate ?? true,
        sitemapExcludePaths: settings?.sitemapExcludePaths,
        googleAnalyticsId: settings?.googleAnalyticsId,
        googleTagManagerId: settings?.googleTagManagerId,
        facebookPixelId: settings?.facebookPixelId,
      });
    } catch (error: any) {
      console.error("Error fetching SEO settings:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Serve llms.txt for AI assistants
  app.get("/llms.txt", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSeoSettings();
      const content = settings?.llmsTxtContent || `# U-Storage Go

> Professional moving and storage services for Mexico and Latin America — a U-Storage brand

## About
U-Storage Go provides professional moving services with its own crews and trucks. We move what you value, we care for what matters: clear quotes, identified crews, insurance and real-time tracking.

## Services
- Mudanzas (moving) with our own crews and trucks
- Bodega U-Storage (storage) in U-Storage facilities

## Contact
Website: https://ustoragego.com
`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(content);
    } catch (error: any) {
      console.error("Error serving llms.txt:", error);
      res.status(500).send("Error loading content");
    }
  });

  // Serve llms-full.txt for AI assistants (detailed documentation)
  app.get("/llms-full.txt", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSeoSettings();
      const content = settings?.llmsFullTxtContent || `# U-Storage Go - Complete Documentation

> Professional moving and storage services for Mexico and Latin America — a U-Storage brand

## Overview
U-Storage Go is a moving and storage service, born from U-Storage, operating with its own professional crews and trucks in Mexico. Our AI-powered inventory assistant helps estimate move costs instantly.

## How It Works
1. Enter your move details (origin, destination, date)
2. Use our AI assistant to catalog your belongings
3. Receive instant price estimates
4. Our team confirms a clear, transparent quote
5. Book and track your move

## Services
- **Mudanzas (Moving)**: Professional moves performed by U-Storage Go's own crews and trucks
- **Bodega U-Storage (Storage)**: Secure short and long-term storage in U-Storage facilities

## Coverage
Currently serving major cities in Mexico including Mexico City, Guadalajara, Monterrey, and more.

## Contact
- Website: https://ustoragego.com
- For Partners: https://ustoragego.com/mover
`;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(content);
    } catch (error: any) {
      console.error("Error serving llms-full.txt:", error);
      res.status(500).send("Error loading content");
    }
  });

  // Serve robots.txt with custom rules from database
  app.get("/robots.txt", async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSeoSettings();
      const allowAiCrawlers = settings?.allowAiCrawlers !== false;
      const customRules = settings?.robotsTxtCustomRules || '';
      
      let content = `# U-Storage Go robots.txt
User-agent: *
Allow: /
Disallow: /dashboard
Disallow: /admin
Disallow: /mover/dashboard
Disallow: /api/

# Sitemap
Sitemap: https://ustoragego.com/sitemap.xml
`;

      if (allowAiCrawlers) {
        content += `
# AI Crawlers - Allowed
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-Web
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Anthropic-AI
Allow: /
`;
      } else {
        content += `
# AI Crawlers - Blocked
User-agent: GPTBot
Disallow: /

User-agent: ChatGPT-User
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Anthropic-AI
Disallow: /
`;
      }

      if (customRules) {
        content += `
# Custom Rules
${customRules}
`;
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.send(content);
    } catch (error: any) {
      console.error("Error serving robots.txt:", error);
      res.status(500).send("Error loading content");
    }
  });

  // ========== PAGE VIEW TRACKING (Public) ==========
  
  // Track page view for marketing analytics
  app.post("/api/track/pageview", async (req: Request, res: Response) => {
    try {
      const { 
        pagePath, pageTitle, locale, 
        utmSource, utmMedium, utmCampaign, utmTerm, utmContent,
        partner, referrerUrl, sessionId
      } = req.body;
      
      if (!pagePath) {
        return res.status(400).json({ message: "pagePath is required" });
      }

      // Classify source type based on UTM params and referrer
      const classifySource = (
        utmSource?: string, 
        utmMedium?: string, 
        referrer?: string
      ): string => {
        if (utmMedium === 'cpc' || utmMedium === 'paid' || utmMedium === 'ppc') return 'paid';
        if (utmMedium === 'email' || utmSource === 'newsletter') return 'email';
        if (utmMedium === 'social' || ['facebook', 'twitter', 'instagram', 'linkedin', 'tiktok'].includes(utmSource?.toLowerCase() || '')) return 'social';
        if (referrer) {
          const refLower = referrer.toLowerCase();
          if (refLower.includes('google.com') || refLower.includes('bing.com') || refLower.includes('duckduckgo')) return 'organic';
          if (refLower.includes('facebook.com') || refLower.includes('instagram.com') || refLower.includes('twitter.com') || refLower.includes('linkedin.com')) return 'social';
          if (refLower.includes('chat.openai') || refLower.includes('claude.ai') || refLower.includes('perplexity.ai')) return 'ai';
          return 'referral';
        }
        if (utmSource) return 'referral';
        return 'direct';
      };

      const sourceType = classifySource(utmSource, utmMedium, referrerUrl);
      
      // Get user info from session if available
      const userId = getActiveUserId(req);
      const userAgent = req.headers['user-agent'] || undefined;
      
      await storage.createPageView({
        pagePath,
        pageTitle,
        locale: locale || 'es',
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        partner,
        referrerUrl,
        sourceType,
        userId: userId || undefined,
        sessionId,
        userAgent,
      });

      res.json({ success: true });
    } catch (error: any) {
      console.error("Page view tracking error:", error);
      // Don't fail the response for tracking errors
      res.json({ success: false });
    }
  });

  // ========== ANALYTICS ROUTES (Admin) ==========

  // Get analytics data for admin dashboard
  app.get("/api/admin/analytics", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      // Get quotes data
      const allQuotes = await storage.getAllQuotes();
      const allUsers = await storage.getAllUsers();
      
      // Calculate quotes over time (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const quotesOverTime: Record<string, number> = {};
      const usersOverTime: Record<string, number> = {};
      
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        quotesOverTime[dateStr] = 0;
        usersOverTime[dateStr] = 0;
      }
      
      allQuotes.forEach(quote => {
        const dateStr = new Date(quote.createdAt).toISOString().split('T')[0];
        if (quotesOverTime[dateStr] !== undefined) {
          quotesOverTime[dateStr]++;
        }
      });
      
      allUsers.forEach(user => {
        if (user.createdAt) {
          const dateStr = new Date(user.createdAt).toISOString().split('T')[0];
          if (usersOverTime[dateStr] !== undefined) {
            usersOverTime[dateStr]++;
          }
        }
      });
      
      // Convert to array format for charts
      const quotesOverTimeArray = Object.entries(quotesOverTime)
        .map(([date, count]) => ({ date: date.slice(5), count }))
        .reverse();
      
      const usersOverTimeArray = Object.entries(usersOverTime)
        .map(([date, count]) => ({ date: date.slice(5), count }))
        .reverse();
      
      // Quotes by status
      const statusCounts: Record<string, number> = {};
      allQuotes.forEach(quote => {
        const status = quote.workflowStatus || 'intake';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      const quotesByStatus = Object.entries(statusCounts)
        .map(([status, count]) => ({ status, count }));
      
      // Partner leads
      const partnerCounts: Record<string, number> = {};
      allQuotes.forEach(quote => {
        if (quote.partner) {
          partnerCounts[quote.partner] = (partnerCounts[quote.partner] || 0) + 1;
        }
      });
      const partnerLeads = Object.entries(partnerCounts)
        .map(([partner, count]) => ({ partner, count }))
        .sort((a, b) => b.count - a.count);
      
      // UTM sources
      const sourceCounts: Record<string, number> = {};
      allQuotes.forEach(quote => {
        if (quote.utmSource) {
          sourceCounts[quote.utmSource] = (sourceCounts[quote.utmSource] || 0) + 1;
        }
      });
      const utmSources = Object.entries(sourceCounts)
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count);
      
      // UTM campaigns
      const campaignCounts: Record<string, number> = {};
      allQuotes.forEach(quote => {
        if (quote.utmCampaign) {
          campaignCounts[quote.utmCampaign] = (campaignCounts[quote.utmCampaign] || 0) + 1;
        }
      });
      const utmCampaigns = Object.entries(campaignCounts)
        .map(([campaign, count]) => ({ campaign, count }))
        .sort((a, b) => b.count - a.count);
      
      // Landing pages
      const landingPageCounts: Record<string, number> = {};
      allQuotes.forEach(quote => {
        if (quote.landingPage) {
          const page = quote.landingPage.split('?')[0]; // Remove query params
          landingPageCounts[page] = (landingPageCounts[page] || 0) + 1;
        }
      });
      const landingPages = Object.entries(landingPageCounts)
        .map(([page, count]) => ({ page, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);
      
      // Calculate metrics
      const completedMoves = allQuotes.filter(q => q.workflowStatus === 'completed').length;
      const confirmedQuotes = allQuotes.filter(q => 
        ['confirmed', 'scheduled', 'in_progress', 'completed'].includes(q.workflowStatus || '')
      ).length;
      
      const totalRevenue = allQuotes
        .filter(q => q.finalPrice)
        .reduce((sum, q) => sum + parseFloat(q.finalPrice || '0'), 0);
      
      const avgValue = allQuotes.length > 0 
        ? allQuotes.filter(q => q.estimatedCost).reduce((sum, q) => sum + parseFloat(q.estimatedCost || '0'), 0) / allQuotes.filter(q => q.estimatedCost).length
        : 0;
      
      const conversionRate = allQuotes.length > 0 
        ? (confirmedQuotes / allQuotes.length) * 100 
        : 0;
      
      // Get ratings analytics
      const allRatings = await storage.getAllRatings();
      
      // Ratings over time (last 30 days)
      const ratingsOverTimeMap: Record<string, { total: number; count: number }> = {};
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        ratingsOverTimeMap[dateStr] = { total: 0, count: 0 };
      }
      
      allRatings.forEach(rating => {
        const dateStr = new Date(rating.createdAt).toISOString().split('T')[0];
        if (ratingsOverTimeMap[dateStr]) {
          ratingsOverTimeMap[dateStr].total += rating.starRating;
          ratingsOverTimeMap[dateStr].count++;
        }
      });
      
      const ratingsOverTime = Object.entries(ratingsOverTimeMap)
        .map(([date, { total, count }]) => ({
          date: date.slice(5),
          avgRating: count > 0 ? total / count : 0,
          count
        }))
        .reverse();
      
      // Rating distribution (1-5 stars)
      const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      allRatings.forEach(rating => {
        if (starCounts[rating.starRating] !== undefined) {
          starCounts[rating.starRating]++;
        }
      });
      const ratingDistribution = Object.entries(starCounts)
        .map(([stars, count]) => ({ stars: parseInt(stars), count }));
      
      // Top rated partners
      const partnerRatings: Record<string, { total: number; count: number; companyName: string }> = {};
      for (const rating of allRatings.filter(r => r.moverProfileId && r.direction === 'client_to_partner')) {
        if (rating.moverProfileId) {
          if (!partnerRatings[rating.moverProfileId]) {
            const profile = await storage.getMoverProfile(rating.moverProfileId);
            partnerRatings[rating.moverProfileId] = {
              total: 0,
              count: 0,
              companyName: profile?.companyName || 'Unknown'
            };
          }
          partnerRatings[rating.moverProfileId].total += rating.starRating;
          partnerRatings[rating.moverProfileId].count++;
        }
      }
      const topRatedPartners = Object.values(partnerRatings)
        .map(p => ({
          companyName: p.companyName,
          avgRating: p.count > 0 ? p.total / p.count : 0,
          totalRatings: p.count
        }))
        .sort((a, b) => b.avgRating - a.avgRating)
        .slice(0, 10);
      
      // Sentiment breakdown from AI tags
      const sentimentCounts: Record<string, number> = { positive: 0, negative: 0, neutral: 0 };
      for (const rating of allRatings) {
        const tags = await storage.getRatingAiTags(rating.id);
        if (tags.length > 0) {
          const hasPositive = tags.some(t => t.sentiment === 'positive');
          const hasNegative = tags.some(t => t.sentiment === 'negative');
          if (hasPositive && !hasNegative) sentimentCounts.positive++;
          else if (hasNegative && !hasPositive) sentimentCounts.negative++;
          else if (hasPositive && hasNegative) sentimentCounts.neutral++;
        }
      }
      const sentimentBreakdown = Object.entries(sentimentCounts)
        .filter(([_, count]) => count > 0)
        .map(([sentiment, count]) => ({ sentiment, count }));
      
      // Calculate average platform rating
      const totalRatings = allRatings.length;
      const averagePlatformRating = totalRatings > 0 
        ? allRatings.reduce((sum, r) => sum + r.starRating, 0) / totalRatings 
        : 0;
      
      res.json({
        quotesOverTime: quotesOverTimeArray,
        usersOverTime: usersOverTimeArray,
        quotesByStatus,
        partnerLeads,
        utmSources,
        utmCampaigns,
        landingPages,
        movesCompleted: completedMoves,
        totalRevenue,
        averageQuoteValue: Math.round(avgValue),
        conversionRate,
        totalQuotes: allQuotes.length,
        totalUsers: allUsers.length,
        totalPartners: Object.keys(partnerCounts).length,
        ratingsOverTime,
        ratingDistribution,
        topRatedPartners,
        sentimentBreakdown,
        totalRatings,
        averagePlatformRating,
      });
    } catch (error: any) {
      console.error("Analytics error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // ========== ACTIVITY LOGS ROUTES (Admin) ==========

  // Get recent activity logs
  app.get("/api/admin/activity-logs", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getRecentActivityLogs(limit);
      res.json({ logs });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get activity logs by user
  app.get("/api/admin/users/:userId/activity", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await storage.getUserActivityLogs(userId, limit);
      res.json({ logs });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's ratings (admin)
  app.get("/api/admin/users/:userId/ratings", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      // Get ratings where user is target (received ratings)
      const receivedRatings = await storage.getRatingsForUser(userId, true);
      // Get ratings where user is rater (given ratings)
      const givenRatings = await storage.getRatingsForUser(userId, false);
      res.json({ receivedRatings, givenRatings });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get activity logs by entity (e.g., quote, user)
  app.get("/api/admin/activity-logs/:entityType/:entityId", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const logs = await storage.getActivityLogsByEntity(entityType, entityId);
      res.json({ logs });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Link a calculation log to a quote (many-to-one: multiple calculations can link to one quote)
  app.patch("/api/admin/activity-logs/:logId/link-quote", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { logId } = req.params;
      const { quoteId, quoteNumber } = req.body;
      
      if (!quoteId) {
        return res.status(400).json({ message: "Quote ID is required" });
      }
      
      // Verify the quote exists
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Update the activity log details with the linked quote
      const updatedLog = await storage.updateActivityLogDetails(logId, {
        linkedQuoteId: quoteId,
        linkedQuoteNumber: quoteNumber || quote.quoteNumber,
        linkedAt: new Date().toISOString(),
      });
      
      res.json({ log: updatedLog });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Unlink a calculation log from a quote
  app.patch("/api/admin/activity-logs/:logId/unlink-quote", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { logId } = req.params;
      
      // Get existing log
      const existingLog = await storage.getActivityLog(logId);
      if (!existingLog) {
        return res.status(404).json({ message: "Activity log not found" });
      }
      
      // Remove the linked quote from details by setting them to null
      const updatedLog = await storage.updateActivityLogDetails(logId, {
        linkedQuoteId: null,
        linkedQuoteNumber: null,
        linkedAt: null,
      });
      
      res.json({ log: updatedLog });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Backfill calculation-to-quote links (find matches for unlinked calculations)
  app.post("/api/admin/activity-logs/backfill-links", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { dryRun = true } = req.body;
      
      // Find all unlinked calculation logs
      const unlinkedLogs = await storage.getUnlinkedCalculationLogs();
      
      const results: Array<{
        logId: string;
        quoteId: string | null;
        quoteNumber: string | null;
        matchType: string;
        applied: boolean;
      }> = [];
      
      let matchedBySession = 0;
      let matchedByProximity = 0;
      let noMatch = 0;

      for (const log of unlinkedLogs) {
        const details = (log.details as any) || {};
        const sessionId = details.quoteSessionId;
        
        let matchedQuote = null;
        let matchType = 'no_match';

        // Strategy 1: Match by session ID
        if (sessionId) {
          const quotesWithSameSession = await storage.getQuotesBySessionId(sessionId);
          if (quotesWithSameSession.length > 0) {
            matchedQuote = quotesWithSameSession[0];
            matchType = 'session_id';
          }
        }

        // Strategy 2: Match by user + time proximity (within 30 min)
        if (!matchedQuote && log.userId) {
          const windowMinutes = 30;
          const minTime = new Date(log.createdAt);
          const maxTime = new Date(log.createdAt.getTime() + windowMinutes * 60 * 1000);
          
          const nearbyQuotes = await storage.getQuotesByUserInTimeWindow(log.userId, minTime, maxTime);
          if (nearbyQuotes.length === 1) {
            matchedQuote = nearbyQuotes[0];
            matchType = 'user_time_proximity';
          }
        }

        if (matchedQuote) {
          if (matchType === 'session_id') matchedBySession++;
          else matchedByProximity++;

          if (!dryRun) {
            await storage.updateActivityLogDetails(log.id, {
              linkedQuoteId: matchedQuote.id,
              linkedQuoteNumber: matchedQuote.quoteNumber,
              linkedAt: new Date().toISOString(),
              autoLinked: true,
              backfillBatch: new Date().toISOString(),
            });
          }

          results.push({
            logId: log.id,
            quoteId: matchedQuote.id,
            quoteNumber: matchedQuote.quoteNumber,
            matchType,
            applied: !dryRun,
          });
        } else {
          noMatch++;
          results.push({
            logId: log.id,
            quoteId: null,
            quoteNumber: null,
            matchType: 'no_match',
            applied: false,
          });
        }
      }

      res.json({
        dryRun,
        totalUnlinked: unlinkedLogs.length,
        matchedBySession,
        matchedByProximity,
        noMatch,
        results,
      });
    } catch (error: any) {
      console.error("Backfill links error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get current user's roles (for any authenticated user)
  app.get("/api/user/roles", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      if (!user) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const roles = await storage.getUserRoles(user.id);
      res.json({ roles: roles.map(r => r.role) });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== ADMIN DATABASE MANAGEMENT ROUTES ==========

  // Get list of accessible tables with metadata
  app.get("/api/admin/db/tables", isAuthenticated, requireAdmin, requireAdminPermission('canAccessDatabase'), async (req: Request, res: Response) => {
    try {
      const tables = getAccessibleTables();
      const tablesWithCounts = await Promise.all(
        tables.map(async (tableName) => {
          const metadata = getTableMetadata(tableName);
          const count = await storage.getTableCount(tableName);
          return {
            name: tableName,
            displayName: metadata?.displayName,
            description: metadata?.description,
            category: metadata?.category,
            permissions: metadata?.permissions,
            rowCount: count,
          };
        })
      );
      res.json({ tables: tablesWithCounts });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get table metadata
  app.get("/api/admin/db/tables/:tableName/metadata", isAuthenticated, requireAdmin, requireAdminPermission('canAccessDatabase'), async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const metadata = getTableMetadata(tableName);
      if (!metadata) {
        return res.status(404).json({ message: "Table not found" });
      }
      res.json({ metadata });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get table rows with pagination
  app.get("/api/admin/db/tables/:tableName/rows", isAuthenticated, requireAdmin, requireAdminPermission('canAccessDatabase'), async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = Math.min(parseInt(req.query.pageSize as string) || 50, 100);
      const orderBy = req.query.orderBy as string | undefined;
      const orderDir = (req.query.orderDir as 'asc' | 'desc') || 'desc';

      const userId = getUserId(req);
      const result = await storage.getTableRows(tableName, page, pageSize, orderBy, orderDir);
      
      // Special handling for users table - hydrate with roles from user_roles
      if (tableName === 'users') {
        const userIds = result.rows.map((row: any) => row.id);
        const allRoles = await storage.getUserRolesByUserIds(userIds);
        result.rows = result.rows.map((row: any) => ({
          ...row,
          roles: allRoles.filter((r: any) => r.userId === row.id && r.isActive).map((r: any) => r.role),
        }));
      }
      
      // Log activity
      if (userId) {
        await storage.logActivity({
          userId,
          actorRole: 'admin',
          action: 'db.table_viewed',
          entityType: 'table',
          entityId: tableName,
          details: { page, pageSize },
        });
      }
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single row
  app.get("/api/admin/db/tables/:tableName/rows/:id", isAuthenticated, requireAdmin, requireAdminPermission('canAccessDatabase'), async (req: Request, res: Response) => {
    try {
      const { tableName, id } = req.params;
      let row = await storage.getTableRow(tableName, id);
      if (!row) {
        return res.status(404).json({ message: "Row not found" });
      }
      
      // Hydrate user with roles
      if (tableName === 'users') {
        const userRoles = await storage.getUserRolesByUserIds([id]);
        row = {
          ...row,
          roles: userRoles.filter((r: any) => r.isActive).map((r: any) => r.role),
        };
      }
      
      res.json({ row });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create new row
  app.post("/api/admin/db/tables/:tableName/rows", isAuthenticated, requireAdmin, requireAdminPermission('canAccessDatabase'), async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const data = req.body;
      const userId = getUserId(req);
      if (tableName === "user_roles" && (data.role === "admin" || await isManagedPlatformRole(data.role))) {
        return res.status(400).json({ message: "Platform admin roles cannot be created through the database browser" });
      }

      // Inserting an admin role via the generic DB browser must require the same
      // canManageAdmins permission that the dedicated admin-management routes enforce.
      if (tableName === 'user_roles' && data.role === 'admin') {
        const callerPerms = await storage.getAdminPermissions(getCallerUserId(req) ?? '');
        if (!callerPerms?.isSuperAdmin && !callerPerms?.canManageAdmins) {
          return res.status(403).json({ message: "Granting the admin role requires canManageAdmins permission" });
        }
      }
      
      const row = await storage.insertTableRow(tableName, data);
      
      // Log activity
      if (userId) {
        await storage.logActivity({
          userId,
          actorRole: 'admin',
          action: 'db.row_created',
          entityType: tableName,
          entityId: row.id,
          details: { data },
        });
      }
      
      res.json({ row, message: "Row created successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Update row
  app.patch("/api/admin/db/tables/:tableName/rows/:id", isAuthenticated, requireAdmin, requireAdminPermission('canAccessDatabase'), async (req: Request, res: Response) => {
    try {
      const { tableName, id } = req.params;
      const data = req.body;
      const userId = getUserId(req);

      if (tableName === "users" && (await isEffectiveSuperAdmin(id)) && !(await isEffectiveSuperAdmin(getCallerUserId(req)))) {
        return res.status(403).json({ message: "Only super admins can modify a super admin account" });
      }
      
      // Special handling for users table - manage roles separately
      if (tableName === 'users' && data.roles !== undefined) {
        const newRoles: string[] = data.roles || [];
        const managedRequested = newRoles.length ? await db.select({ slug: platformRoles.slug }).from(platformRoles).where(inArray(platformRoles.slug, newRoles)) : [];
        if (managedRequested.length) {
          return res.status(400).json({ message: "Platform admin roles cannot be changed through the database browser" });
        }

        // Granting or revoking the admin role via the generic DB browser must require
        // the same canManageAdmins permission enforced by the dedicated admin routes.
        if (newRoles.includes('admin')) {
          const callerPerms = await storage.getAdminPermissions(getCallerUserId(req) ?? '');
          if (!callerPerms?.isSuperAdmin && !callerPerms?.canManageAdmins) {
            return res.status(403).json({ message: "Granting the admin role requires canManageAdmins permission" });
          }
        } else {
          // Also check when 'admin' may be present in current roles and is being removed.
          const currentUserRoles = await storage.getUserRoles(id);
          const hasAdminNow = currentUserRoles.some((r: any) => r.role === 'admin' && r.isActive);
          if (hasAdminNow) {
            const callerPerms = await storage.getAdminPermissions(getCallerUserId(req) ?? '');
            if (!callerPerms?.isSuperAdmin && !callerPerms?.canManageAdmins) {
              return res.status(403).json({ message: "Revoking the admin role requires canManageAdmins permission" });
            }
          }
        }

        const currentUserRoles = await storage.getUserRoles(id);
        const canonicalRoles = (await getPlatformAdminAccess(id)).platformRoles;
        await storage.syncUserRoles(id, [...newRoles, ...canonicalRoles], userId);
        delete data.roles; // Remove from data to avoid trying to update a non-existent column
      }

      // Any modification to a user_roles row that currently holds the 'admin' role,
      // or that promotes a row to 'admin', requires canManageAdmins — regardless of
      // which fields are included in the request body. This prevents attackers from
      // reassigning the userId or reactivating dormant admin grants without the
      // required permission.
      if (tableName === 'user_roles') {
        const existingRow = await storage.getTableRow(tableName, id) as any;
        if ((existingRow?.role && await isManagedPlatformRole(existingRow.role)) || (data.role && await isManagedPlatformRole(data.role))) {
          return res.status(400).json({ message: "Platform admin roles cannot be changed through the database browser" });
        }
        const isAdminRow = existingRow?.role === 'admin' || data.role === 'admin';
        if (isAdminRow) {
          const callerPerms = await storage.getAdminPermissions(getCallerUserId(req) ?? '');
          if (!callerPerms?.isSuperAdmin && !callerPerms?.canManageAdmins) {
            return res.status(403).json({ message: "Modifying an admin role entry requires canManageAdmins permission" });
          }
        }
      }
      
      // Only update if there's remaining data
      let row;
      if (Object.keys(data).length > 0) {
        row = await storage.updateTableRow(tableName, id, data);
      } else {
        row = await storage.getTableRow(tableName, id);
      }
      
      // Hydrate user with updated roles
      if (tableName === 'users') {
        const userRoles = await storage.getUserRolesByUserIds([id]);
        row = {
          ...row,
          roles: userRoles.filter((r: any) => r.isActive).map((r: any) => r.role),
        };
      }
      
      // Log activity
      if (userId) {
        await storage.logActivity({
          userId,
          actorRole: 'admin',
          action: 'db.row_updated',
          entityType: tableName,
          entityId: id,
          details: { data },
        });
      }
      
      res.json({ row, message: "Row updated successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Delete row
  app.delete("/api/admin/db/tables/:tableName/rows/:id", isAuthenticated, requireAdmin, requireAdminPermission('canAccessDatabase'), async (req: Request, res: Response) => {
    try {
      const { tableName, id } = req.params;
      const userId = getUserId(req);

      // Deleting an admin role row must require canManageAdmins, matching the
      // parity enforced by the dedicated admin-management routes for role revocation.
      if (tableName === 'user_roles') {
        const existingRow = await storage.getTableRow(tableName, id) as any;
        if (existingRow?.role && await isManagedPlatformRole(existingRow.role)) {
          return res.status(400).json({ message: "Platform admin roles cannot be deleted through the database browser" });
        }
        if (existingRow?.role === 'admin') {
          const callerPerms = await storage.getAdminPermissions(getCallerUserId(req) ?? '');
          if (!callerPerms?.isSuperAdmin && !callerPerms?.canManageAdmins) {
            return res.status(403).json({ message: "Deleting an admin role entry requires canManageAdmins permission" });
          }
        }
      }

      await storage.deleteTableRow(tableName, id);
      
      // Log activity
      if (userId) {
        await storage.logActivity({
          userId,
          actorRole: 'admin',
          action: 'db.row_deleted',
          entityType: tableName,
          entityId: id,
          details: {},
        });
      }
      
      res.json({ message: "Row deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get exported configuration data for seeding
  app.get("/api/admin/seed-config", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const configPath = path.join(process.cwd(), "production-config.json");
      
      if (!fs.existsSync(configPath)) {
        return res.status(404).json({ message: "Configuration file not found. Run 'npx tsx server/productionSeed.ts export > production-config.json' first." });
      }
      
      const configData = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      res.json(configData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Seed production configuration data (for initial deployment)
  app.post("/api/admin/seed-config", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { seedProductionConfig } = await import("./productionSeed");
      const { seedAiAgentConfigFromDefaults } = await import("./seed");
      const configData = req.body;
      
      if (!configData || !configData.inventoryCategories) {
        return res.status(400).json({ message: "Invalid configuration data. Please provide the exported config JSON." });
      }
      
      await seedProductionConfig(configData);
      
      // Also update AI agent config from code defaults
      const aiResult = await seedAiAgentConfigFromDefaults();
      
      // Seed default AI models
      const { seedDefaultAiModels } = await import("./seed");
      const modelsResult = await seedDefaultAiModels(storage);
      
      res.json({ 
        message: "Configuration seeded successfully",
        summary: {
          inventoryCategories: configData.inventoryCategories?.length || 0,
          inventoryRooms: configData.inventoryRooms?.length || 0,
          services: configData.services?.length || 0,
          addOns: configData.addOns?.length || 0,
          truckTypes: configData.truckTypes?.length || 0,
          emailTemplates: configData.emailTemplates?.length || 0,
          aiAgentConfig: aiResult.updated ? 'updated from defaults' : 'unchanged',
          aiModels: modelsResult.created > 0 ? `${modelsResult.created} models added` : 'unchanged',
        }
      });
    } catch (error: any) {
      console.error("Seed config error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Seed AI agent config from development defaults (independent of full config seed)
  app.post("/api/admin/seed-ai-config", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { seedAiAgentConfigFromDefaults, getDefaultAiAgentConfig, seedDefaultAiModels } = await import("./seed");
      
      const result = await seedAiAgentConfigFromDefaults();
      const defaults = getDefaultAiAgentConfig();
      
      // Also seed default AI models
      const modelsResult = await seedDefaultAiModels(storage);
      
      res.json({
        success: result.updated,
        message: result.message,
        config: {
          name: defaults.name,
          model: defaults.model,
          systemPromptPreview: defaults.systemPrompt.substring(0, 200) + '...',
        },
        aiModels: modelsResult,
      });
    } catch (error: any) {
      console.error("Seed AI config error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get lookup values for a table (for FK dropdowns)
  app.get("/api/admin/db/tables/:tableName/lookup", isAuthenticated, requireAdmin, requireAdminPermission('canAccessDatabase'), async (req: Request, res: Response) => {
    try {
      const { tableName } = req.params;
      const displayColumn = req.query.displayColumn as string || 'id';
      const search = req.query.search as string || '';
      const limit = parseInt(req.query.limit as string) || 100;
      
      const metadata = getTableMetadata(tableName);
      if (!metadata) {
        return res.status(404).json({ message: "Table not found" });
      }
      
      // When searching, fetch all rows to ensure complete coverage
      // Otherwise limit to 200 for initial load performance
      const fetchLimit = search ? 10000 : 200;
      const { rows } = await storage.getTableRows(tableName, 1, fetchLimit, displayColumn, 'asc');
      
      // Filter by search term first, then limit results
      const searchLower = search.toLowerCase();
      const filteredRows = search 
        ? rows.filter((row: any) => {
            const displayValue = String(row[displayColumn] || '');
            const idValue = String(row[metadata.primaryKey] || '');
            return displayValue.toLowerCase().includes(searchLower) || 
                   idValue.toLowerCase().includes(searchLower);
          })
        : rows;
      
      const options = filteredRows.slice(0, limit).map((row: any) => ({
        value: row[metadata.primaryKey],
        label: row[displayColumn] || row[metadata.primaryKey],
      }));
      
      res.json({ options });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =====================================================
  // RATING SYSTEM ROUTES
  // =====================================================

  // Submit a new rating (both client-to-partner and partner-to-client)
  app.post("/api/ratings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      if (!userId) {
        return res.status(401).json({ message: "Authentication required" });
      }
      
      const { quoteId, targetUserId, moverProfileId, direction, starRating, excellenceCategories, improvementCategories, publicComment, privateComment } = req.body;
      
      if (!quoteId || !targetUserId || !direction || !starRating) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      if (starRating < 1 || starRating > 5) {
        return res.status(400).json({ message: "Star rating must be between 1 and 5" });
      }
      
      // Verify quote exists and user is involved
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }

      // Enforce that the caller is the actual participant on this quote for the given direction
      if (direction === 'client_to_partner') {
        // Only the quote's client may leave a client→partner review
        if (quote.userId !== userId) {
          return res.status(403).json({ message: "You are not the client on this quote" });
        }
        // The moverProfileId must be the mover actually assigned to this quote
        if (!quote.assignedMoverProfileId || moverProfileId !== quote.assignedMoverProfileId) {
          return res.status(403).json({ message: "The specified mover was not assigned to this quote" });
        }
        // targetUserId must belong to the assigned mover profile
        const assignedMoverProfile = await storage.getMoverProfileById(quote.assignedMoverProfileId);
        if (!assignedMoverProfile || targetUserId !== assignedMoverProfile.userId) {
          return res.status(403).json({ message: "Target user does not match the assigned mover on this quote" });
        }
      } else if (direction === 'partner_to_client') {
        // Only the assigned mover may leave a partner→client review
        const membership = await resolveActiveCompany(req);
        if (!membership || membership.company.id !== quote.assignedMoverProfileId) {
          return res.status(403).json({ message: "You are not the assigned mover on this quote" });
        }
        // targetUserId must be the quote's client
        if (targetUserId !== quote.userId) {
          return res.status(403).json({ message: "Target user does not match the client on this quote" });
        }
      } else {
        return res.status(400).json({ message: "Invalid direction" });
      }

      // Check if user already rated this quote
      const existingRating = await storage.getRatingByQuoteAndRater(quoteId, userId);
      if (existingRating) {
        return res.status(400).json({ message: "You have already rated this move" });
      }
      
      // Generate email token for tracking
      const emailToken = `rating_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create the rating
      const rating = await storage.createRating({
        quoteId,
        raterUserId: userId,
        targetUserId,
        moverProfileId: moverProfileId || null,
        direction,
        starRating,
        excellenceCategories: excellenceCategories || [],
        improvementCategories: improvementCategories || [],
        emailToken,
        submittedVia: 'platform',
      });
      
      // Create comment if provided
      if (publicComment || privateComment) {
        await storage.createRatingComment({
          ratingId: rating.id,
          publicComment: publicComment || null,
          privateComment: privateComment || null,
        });
        
        // Trigger AI analysis for comment tagging if there's a public comment
        if (publicComment) {
          // AI analysis will be done asynchronously - handled separately
          analyzeRatingComment(rating.id, publicComment).catch(err => {
            console.error("Failed to analyze rating comment:", err);
          });
        }
      }
      
      // Update mover profile rating if this is a client rating a partner
      if (direction === 'client_to_partner' && moverProfileId) {
        await storage.updateMoverProfileRating(moverProfileId);
      }
      
      // Log activity
      await storage.logActivity({
        userId,
        actorRole: direction === 'client_to_partner' ? 'client' : 'mover',
        action: 'rating.submitted',
        entityType: 'rating',
        entityId: rating.id,
        details: { quoteId, direction, starRating },
      });
      
      res.status(201).json({ rating, message: "Rating submitted successfully" });
    } catch (error: any) {
      console.error("Create rating error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Submit rating via email token (for email-based collection)
  app.post("/api/ratings/email/:token", async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const { starRating, excellenceCategories, improvementCategories, publicComment, privateComment } = req.body;
      
      // Find rating request by token
      const ratingRequest = await storage.getRatingRequestByToken(token);
      if (!ratingRequest) {
        return res.status(404).json({ message: "Invalid or expired rating link" });
      }
      
      if (ratingRequest.completedAt) {
        return res.status(400).json({ message: "Rating already submitted" });
      }
      
      if (ratingRequest.expiresAt && new Date(ratingRequest.expiresAt) < new Date()) {
        return res.status(400).json({ message: "Rating link has expired" });
      }
      
      if (!starRating || starRating < 1 || starRating > 5) {
        return res.status(400).json({ message: "Star rating must be between 1 and 5" });
      }
      
      // Get quote for context
      const quote = await storage.getQuote(ratingRequest.quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Create the rating
      const rating = await storage.createRating({
        quoteId: ratingRequest.quoteId,
        raterUserId: ratingRequest.userId, // userId is who should rate
        targetUserId: ratingRequest.targetUserId,
        moverProfileId: quote.assignedMoverProfileId || null,
        direction: ratingRequest.direction,
        starRating,
        excellenceCategories: excellenceCategories || [],
        improvementCategories: improvementCategories || [],
        emailToken: token,
        submittedVia: 'email',
      });
      
      // Create comment
      if (publicComment || privateComment) {
        await storage.createRatingComment({
          ratingId: rating.id,
          publicComment: publicComment || null,
          privateComment: privateComment || null,
        });
        
        if (publicComment) {
          analyzeRatingComment(rating.id, publicComment).catch(err => {
            console.error("Failed to analyze rating comment:", err);
          });
        }
      }
      
      // Update mover profile rating
      if (ratingRequest.direction === 'client_to_partner' && quote.assignedMoverProfileId) {
        await storage.updateMoverProfileRating(quote.assignedMoverProfileId);
      }
      
      // Mark request as completed
      await storage.updateRatingRequest(ratingRequest.id, {
        completedAt: new Date(),
        ratingId: rating.id,
      });
      
      res.status(201).json({ rating, message: "Rating submitted successfully" });
    } catch (error: any) {
      console.error("Email rating error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get ratings for a quote (access control based on role)
  app.get("/api/quotes/:quoteId/ratings", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = getUserId(req);
      const { quoteId } = req.params;
      
      const quote = await storage.getQuote(quoteId);
      if (!quote) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      const ratings = await storage.getRatingsForQuote(quoteId);
      
      // Check user role and filter accordingly
      const user = await storage.getUser(userId!);
      const userRoles = await storage.getUserRoles(userId!);
      const isAdmin = userRoles.some(r => r.role === 'admin' && r.isActive);
      
      // Check if user is the assigned mover (need to get mover profile)
      const membership = await resolveActiveCompany(req);
      const isPartnerOnQuote = membership && quote.assignedMoverProfileId === membership.company.id;
      const isClientOnQuote = quote.userId === userId;
      
      // Super admin can see everything
      const perms = isAdmin ? await storage.getAdminPermissions(userId!) : null;
      const isSuperAdmin = perms?.isSuperAdmin || false;
      
      // Enforce access control — only the quote client, assigned mover, or admin may view ratings
      if (!isAdmin && !isPartnerOnQuote && !isClientOnQuote) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Filter ratings based on access level
      const filteredRatings = ratings.map(rating => {
        const baseRating = {
          id: rating.id,
          starRating: rating.starRating,
          direction: rating.direction,
          createdAt: rating.createdAt,
          excellenceCategories: rating.excellenceCategories,
          improvementCategories: rating.improvementCategories,
        };
        
        // Super admin sees everything
        if (isSuperAdmin) {
          return rating;
        }
        
        // Admin sees public + private comments
        if (isAdmin) {
          return {
            ...baseRating,
            comments: rating.comments,
            aiTags: rating.aiTags,
          };
        }
        
        // Partner on this quote sees public comment only
        if (isPartnerOnQuote) {
          return {
            ...baseRating,
            comments: rating.comments ? {
              publicComment: rating.comments.publicComment,
            } : undefined,
            aiTags: rating.aiTags,
          };
        }
        
        // Client sees only their own ratings without comments visibility
        return baseRating;
      });
      
      res.json(filteredRatings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get public ratings for a mover profile (for display on profile)
  app.get("/api/mover-profiles/:moverProfileId/ratings", async (req: Request, res: Response) => {
    try {
      const { moverProfileId } = req.params;
      
      const profile = await storage.getMoverProfileById(moverProfileId);
      if (!profile) {
        return res.status(404).json({ message: "Mover profile not found" });
      }
      
      // Get summary statistics
      const summary = await storage.getPartnerRatingSummary(moverProfileId);
      
      // Get ratings (public view - star ratings and public comments only)
      const ratings = await storage.getRatingsForMoverProfile(moverProfileId);
      
      const publicRatings = ratings.map(r => ({
        id: r.id,
        starRating: r.starRating,
        excellenceCategories: r.excellenceCategories,
        createdAt: r.createdAt,
        publicComment: r.comments?.publicComment || null,
        raterName: r.rater?.fullName ? r.rater.fullName.split(' ')[0] + ' ' + (r.rater.fullName.split(' ')[1]?.[0] || '') + '.' : 'Anonymous',
      }));
      
      res.json({
        summary,
        ratings: publicRatings,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get user's rating summary (for their profile)
  app.get("/api/users/:userId/rating-summary", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const currentUserId = getUserId(req);
      
      // Users can only see their own summary, admins can see any
      const userRoles = await storage.getUserRoles(currentUserId!);
      const isAdmin = userRoles.some(r => r.role === 'admin' && r.isActive);
      
      if (userId !== currentUserId && !isAdmin) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const summary = await storage.getUserRatingSummary(userId);
      res.json(summary);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get all ratings with filters
  app.get("/api/admin/ratings", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { direction, limit } = req.query;
      
      const ratings = await storage.getAllRatings({
        direction: direction as string,
        limit: limit ? parseInt(limit as string) : 100,
      });
      
      // Admin sees all comments (public + private)
      res.json(ratings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get single rating with full details
  app.get("/api/admin/ratings/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const rating = await storage.getRating(id);
      
      if (!rating) {
        return res.status(404).json({ message: "Rating not found" });
      }
      
      const comments = await storage.getRatingComment(id);
      const aiTags = await storage.getRatingAiTags(id);
      
      res.json({
        ...rating,
        comments,
        aiTags,
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Super Admin: Edit a rating (for moderation)
  app.patch("/api/admin/ratings/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const { starRating, excellenceCategories, improvementCategories, publicComment, privateComment, editReason } = req.body;
      
      // Only super admins can edit ratings
      const perms = await storage.getAdminPermissions(userId!);
      if (!perms?.isSuperAdmin) {
        return res.status(403).json({ message: "Only super admins can edit ratings" });
      }
      
      const existingRating = await storage.getRating(id);
      if (!existingRating) {
        return res.status(404).json({ message: "Rating not found" });
      }
      
      // Update rating
      const updateData: Record<string, any> = {};
      if (starRating !== undefined) updateData.starRating = starRating;
      if (excellenceCategories !== undefined) updateData.excellenceCategories = excellenceCategories;
      if (improvementCategories !== undefined) updateData.improvementCategories = improvementCategories;
      
      const updatedRating = await storage.updateRating(id, updateData, userId!, editReason);
      
      // Update comments if provided
      if (publicComment !== undefined || privateComment !== undefined) {
        const existingComment = await storage.getRatingComment(id);
        if (existingComment) {
          await storage.updateRatingComment(id, {
            publicComment: publicComment !== undefined ? publicComment : existingComment.publicComment,
            privateComment: privateComment !== undefined ? privateComment : existingComment.privateComment,
          });
        } else if (publicComment || privateComment) {
          await storage.createRatingComment({
            ratingId: id,
            publicComment: publicComment || null,
            privateComment: privateComment || null,
          });
        }
      }
      
      // Update mover profile rating if needed
      if (existingRating.direction === 'client_to_partner' && existingRating.moverProfileId) {
        await storage.updateMoverProfileRating(existingRating.moverProfileId);
      }
      
      // Log activity
      await storage.logActivity({
        userId: userId!,
        actorRole: 'admin',
        action: 'rating.edited',
        entityType: 'rating',
        entityId: id,
        details: { editReason, changes: req.body },
      });
      
      res.json({ rating: updatedRating, message: "Rating updated successfully" });
    } catch (error: any) {
      console.error("Edit rating error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Super Admin: Delete a rating
  app.delete("/api/admin/ratings/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      const { deleteReason } = req.body;
      
      // Only super admins can delete ratings
      const perms = await storage.getAdminPermissions(userId!);
      if (!perms?.isSuperAdmin) {
        return res.status(403).json({ message: "Only super admins can delete ratings" });
      }
      
      const existingRating = await storage.getRating(id);
      if (!existingRating) {
        return res.status(404).json({ message: "Rating not found" });
      }
      
      // Delete rating (cascades to comments and tags)
      await storage.deleteRating(id);
      
      // Update mover profile rating
      if (existingRating.direction === 'client_to_partner' && existingRating.moverProfileId) {
        await storage.updateMoverProfileRating(existingRating.moverProfileId);
      }
      
      // Log activity
      await storage.logActivity({
        userId: userId!,
        actorRole: 'admin',
        action: 'rating.deleted',
        entityType: 'rating',
        entityId: id,
        details: { deleteReason },
      });
      
      res.json({ message: "Rating deleted successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create rating request (for email-based collection)
  app.post("/api/admin/rating-requests", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { quoteId, userId, targetUserId, direction } = req.body;
      
      if (!quoteId || !userId || !targetUserId || !direction) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Generate unique token
      const emailToken = `rate_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Set expiration (30 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);
      
      const request = await storage.createRatingRequest({
        quoteId,
        userId, // Who should rate
        targetUserId, // Who to rate
        direction,
        emailToken,
        expiresAt,
      });
      
      res.status(201).json({ request, message: "Rating request created" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =====================================================
  // SEO Settings & Marketing Analytics Admin Routes
  // =====================================================
  
  // Get SEO settings
  app.get("/api/admin/seo/settings", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const settings = await storage.getSeoSettings();
      res.json(settings || {});
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update SEO settings
  app.put("/api/admin/seo/settings", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const settings = await storage.updateSeoSettings(req.body, user?.id);
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Track page view (public endpoint for telemetry)
  app.post("/api/analytics/page-view", async (req: Request, res: Response) => {
    try {
      const { pagePath, pageTitle, locale, utmSource, utmMedium, utmCampaign, utmTerm, utmContent, partner, referrerUrl, sourceType, sessionId } = req.body;
      
      if (!pagePath) {
        return res.status(400).json({ message: "pagePath is required" });
      }
      
      // Get user ID if authenticated
      const user = req.user as any;
      
      await storage.createPageView({
        pagePath,
        pageTitle,
        locale: locale || 'es',
        utmSource,
        utmMedium,
        utmCampaign,
        utmTerm,
        utmContent,
        partner,
        referrerUrl,
        sourceType: sourceType || classifySourceType(utmSource, utmMedium, referrerUrl),
        userId: user?.id,
        sessionId,
        userAgent: req.headers['user-agent'],
        ipCountry: req.headers['cf-ipcountry'] as string || undefined,
        ipCity: req.headers['cf-ipcity'] as string || undefined,
      });
      
      res.status(201).json({ success: true });
    } catch (error: any) {
      // Don't fail the request if analytics fails
      console.error("Page view tracking error:", error);
      res.status(200).json({ success: false });
    }
  });
  
  // Get marketing analytics summary
  app.get("/api/admin/analytics/marketing", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      
      const analytics = await storage.getMarketingAnalyticsSummary(start, end);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Helper function to classify traffic source type
  function classifySourceType(utmSource?: string, utmMedium?: string, referrerUrl?: string): string {
    if (utmSource && utmMedium) {
      const medium = utmMedium.toLowerCase();
      if (medium === 'cpc' || medium === 'ppc' || medium === 'paid') return 'paid';
      if (medium === 'email') return 'email';
      if (medium === 'social') return 'social';
      if (medium === 'referral') return 'referral';
    }
    
    if (referrerUrl) {
      const ref = referrerUrl.toLowerCase();
      if (ref.includes('google') || ref.includes('bing') || ref.includes('yahoo')) return 'organic';
      if (ref.includes('facebook') || ref.includes('twitter') || ref.includes('linkedin') || ref.includes('instagram')) return 'social';
      if (ref.includes('chatgpt') || ref.includes('claude') || ref.includes('perplexity') || ref.includes('openai')) return 'ai';
      return 'referral';
    }
    
    return 'direct';
  }

  // =====================================================
  // BLOG MANAGEMENT ROUTES
  // =====================================================

  // Public: Get published blog posts
  app.get("/api/blog/posts", async (req: Request, res: Response) => {
    try {
      const posts = await storage.getPublishedBlogPosts();
      res.json({ posts });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public: Get blog post by slug
  app.get("/api/blog/posts/:slug", async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const post = await storage.getBlogPostBySlug(slug);
      
      if (!post || post.status !== 'published') {
        return res.status(404).json({ message: "Blog post not found" });
      }
      
      // Increment view count
      await storage.incrementBlogViewCount(post.id);
      
      res.json({ post });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Public: Get blog categories
  app.get("/api/blog/categories", async (req: Request, res: Response) => {
    try {
      const categories = await storage.getBlogCategories();
      res.json({ categories });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get all blog posts (including drafts)
  app.get("/api/admin/blog/posts", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status, featured, category } = req.query;
      const posts = await storage.getBlogPosts({
        status: status as string,
        featured: featured === 'true' ? true : featured === 'false' ? false : undefined,
        category: category as string,
      });
      res.json({ posts });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Get single blog post by ID
  app.get("/api/admin/blog/posts/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const post = await storage.getBlogPost(id);
      
      if (!post) {
        return res.status(404).json({ message: "Blog post not found" });
      }
      
      res.json({ post });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Create blog post
  app.post("/api/admin/blog/posts", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = req.user as any;
      const post = await storage.createBlogPost({
        ...req.body,
        createdBy: user?.id,
        updatedBy: user?.id,
      });
      
      await storage.logActivity({
        userId: user?.id,
        actorRole: 'admin',
        action: 'blog.created',
        entityType: 'blog_post',
        entityId: post.id,
        details: { title: post.titleEs, slug: post.slug },
      });
      
      res.status(201).json({ post });
    } catch (error: any) {
      if (error.message?.includes('unique constraint') || error.message?.includes('duplicate')) {
        return res.status(400).json({ message: "A blog post with this slug already exists" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Update blog post
  app.put("/api/admin/blog/posts/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      
      const existingPost = await storage.getBlogPost(id);
      if (!existingPost) {
        return res.status(404).json({ message: "Blog post not found" });
      }
      
      const post = await storage.updateBlogPost(id, {
        ...req.body,
        updatedBy: user?.id,
      });
      
      await storage.logActivity({
        userId: user?.id,
        actorRole: 'admin',
        action: 'blog.updated',
        entityType: 'blog_post',
        entityId: post.id,
        details: { title: post.titleEs, slug: post.slug },
      });
      
      res.json({ post });
    } catch (error: any) {
      if (error.message?.includes('unique constraint') || error.message?.includes('duplicate')) {
        return res.status(400).json({ message: "A blog post with this slug already exists" });
      }
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Delete blog post
  app.delete("/api/admin/blog/posts/:id", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      
      const existingPost = await storage.getBlogPost(id);
      if (!existingPost) {
        return res.status(404).json({ message: "Blog post not found" });
      }
      
      await storage.deleteBlogPost(id);
      
      await storage.logActivity({
        userId: user?.id,
        actorRole: 'admin',
        action: 'blog.deleted',
        entityType: 'blog_post',
        entityId: id,
        details: { title: existingPost.titleEs, slug: existingPost.slug },
      });
      
      res.json({ message: "Blog post deleted" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Publish blog post
  app.post("/api/admin/blog/posts/:id/publish", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      
      const post = await storage.publishBlogPost(id);
      
      await storage.logActivity({
        userId: user?.id,
        actorRole: 'admin',
        action: 'blog.published',
        entityType: 'blog_post',
        entityId: post.id,
        details: { title: post.titleEs, slug: post.slug },
      });
      
      res.json({ post });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Admin: Unpublish blog post
  app.post("/api/admin/blog/posts/:id/unpublish", isAuthenticated, requireAdmin, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const user = req.user as any;
      
      const post = await storage.unpublishBlogPost(id);
      
      await storage.logActivity({
        userId: user?.id,
        actorRole: 'admin',
        action: 'blog.unpublished',
        entityType: 'blog_post',
        entityId: post.id,
        details: { title: post.titleEs, slug: post.slug },
      });
      
      res.json({ post });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // AI comment analysis helper function
  async function analyzeRatingComment(ratingId: string, comment: string): Promise<void> {
    try {
      const openai = createAiClient();
      
      // Get centralized AI config for model selection
      const aiConfig = await storage.getAiAgentConfig();
      
      const response = await openai.chat.completions.create({
        model: resolveAiModel(aiConfig?.model),
        messages: [
          {
            role: "system",
            content: `You are a sentiment analysis assistant for a moving company review system. Analyze the customer review and extract:
1. Overall sentiment: "positive", "neutral", or "negative"
2. Key tags/themes (3-5 tags max) with their sentiment
3. Spanish translations of each tag

Respond in JSON format:
{
  "overallSentiment": "positive|neutral|negative",
  "tags": [
    { "tag": "English tag", "tagEs": "Spanish tag", "sentiment": "positive|neutral|negative", "confidence": 0.0-1.0 }
  ]
}`
          },
          {
            role: "user",
            content: comment
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });
      
      const result = JSON.parse(response.choices[0].message.content || '{}');
      
      if (result.tags && Array.isArray(result.tags)) {
        // Delete existing tags and add new ones
        await storage.deleteRatingAiTags(ratingId);
        
        for (const tag of result.tags) {
          await storage.createRatingAiTag({
            ratingId,
            tag: tag.tag,
            tagEs: tag.tagEs,
            sentiment: tag.sentiment,
            confidence: String(tag.confidence),
          });
        }
      }
    } catch (error) {
      console.error("AI comment analysis failed:", error);
      // Don't throw - this is a non-critical operation
    }
  }

  // ========== WHATSAPP WEBHOOK ROUTES (Unauthenticated) ==========

  app.post("/api/webhooks/whatsapp/inbound", async (req: Request, res: Response) => {
    try {
      const { parseInboundMessage, validateTwilioRequest, getAuthToken, buildCanonicalWebhookUrl } = await import('./services/whatsappService');

      const authToken = await getAuthToken();
      if (!authToken) {
        console.warn('[WHATSAPP] Rejecting inbound webhook: Twilio credentials not configured');
        return res.status(403).type('text/xml').send('<Response></Response>');
      }
      const signature = req.headers['x-twilio-signature'] as string;
      if (!signature) {
        console.warn('[WHATSAPP] Missing Twilio signature on inbound webhook');
        return res.status(403).type('text/xml').send('<Response></Response>');
      }
      const url = buildCanonicalWebhookUrl(req);
      const isValid = validateTwilioRequest(authToken, signature, url, req.body);
      if (!isValid) {
        console.warn('[WHATSAPP] Invalid Twilio signature on inbound webhook');
        return res.status(403).type('text/xml').send('<Response></Response>');
      }

      const inbound = parseInboundMessage(req.body);
      console.log(`[WHATSAPP] Inbound message from ${inbound.from}: ${inbound.body?.substring(0, 50)}`);

      let conversation = await storage.getConversationByPhone(inbound.from, 'whatsapp');

      if (!conversation) {
        let userId: string | null = null;
        let moverProfileId: string | null = null;
        let contactName = inbound.profileName || null;

        const userByPhone = await storage.getUserByPhone(inbound.from);
        if (userByPhone) {
          userId = userByPhone.id;
          contactName = contactName || userByPhone.fullName || null;
        }

        const partnerByPhone = await storage.getMoverProfileByPhone(inbound.from);
        if (partnerByPhone) {
          moverProfileId = partnerByPhone.id;
          if (!userId) {
            userId = partnerByPhone.userId;
          }
          if (!contactName) {
            contactName = partnerByPhone.companyName;
          }
        }

        conversation = await storage.createConversation({
          contactPhone: inbound.from,
          contactName,
          channel: 'whatsapp',
          status: 'open',
          userId,
          moverProfileId,
          quoteId: null,
          assignedAgentId: null,
          lastMessageAt: new Date(),
          lastMessagePreview: inbound.body?.substring(0, 100) || null,
          unreadCount: 1,
        });
        console.log(`[WHATSAPP] Created new conversation ${conversation.id} for ${inbound.from} (userId=${userId}, moverProfileId=${moverProfileId})`);
      } else {
        await storage.updateConversation(conversation.id, {
          lastMessageAt: new Date(),
          lastMessagePreview: inbound.body?.substring(0, 100) || null,
          unreadCount: (conversation.unreadCount || 0) + 1,
          status: 'open',
          contactName: inbound.profileName || conversation.contactName,
        });
      }

      await storage.createMessage({
        conversationId: conversation.id,
        twilioMessageSid: inbound.messageSid,
        direction: 'inbound',
        senderPhone: inbound.from,
        senderName: inbound.profileName || null,
        body: inbound.body,
        mediaUrls: inbound.mediaUrls.length > 0 ? inbound.mediaUrls : null,
        mediaContentTypes: inbound.mediaContentTypes.length > 0 ? inbound.mediaContentTypes : null,
        status: 'delivered',
        sentAt: new Date(),
        deliveredAt: new Date(),
      });

      res.status(200).type('text/xml').send('<Response></Response>');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[WHATSAPP] Error processing inbound message:', errorMsg);
      res.status(200).type('text/xml').send('<Response></Response>');
    }
  });

  app.post("/api/webhooks/whatsapp/status", async (req: Request, res: Response) => {
    try {
      const { parseStatusCallback, validateTwilioRequest, getAuthToken, buildCanonicalWebhookUrl } = await import('./services/whatsappService');

      const authToken = await getAuthToken();
      if (!authToken) {
        console.warn('[WHATSAPP] Rejecting status webhook: Twilio credentials not configured');
        return res.status(403).type('text/xml').send('<Response></Response>');
      }
      const signature = req.headers['x-twilio-signature'] as string;
      if (!signature) {
        console.warn('[WHATSAPP] Missing Twilio signature on status webhook');
        return res.status(403).type('text/xml').send('<Response></Response>');
      }
      const url = buildCanonicalWebhookUrl(req);
      const isValid = validateTwilioRequest(authToken, signature, url, req.body);
      if (!isValid) {
        console.warn('[WHATSAPP] Invalid Twilio signature on status webhook');
        return res.status(403).type('text/xml').send('<Response></Response>');
      }

      const callback = parseStatusCallback(req.body);
      console.log(`[WHATSAPP] Status update for ${callback.messageSid}: ${callback.messageStatus}`);

      if (callback.messageSid) {
        const updateData: Partial<import('@shared/schema').Message> = {
          status: callback.messageStatus,
        };

        if (callback.messageStatus === 'delivered') {
          updateData.deliveredAt = new Date();
        } else if (callback.messageStatus === 'read') {
          updateData.readAt = new Date();
        } else if (callback.messageStatus === 'failed' || callback.messageStatus === 'undelivered') {
          updateData.errorCode = callback.errorCode || null;
          updateData.errorMessage = callback.errorMessage || null;
        }

        await storage.updateMessageByTwilioSid(callback.messageSid, updateData);
      }

      res.status(200).type('text/xml').send('<Response></Response>');
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[WHATSAPP] Error processing status callback:', errorMsg);
      res.status(200).type('text/xml').send('<Response></Response>');
    }
  });

  // ========== WHATSAPP ADMIN ROUTES ==========

  app.get("/api/admin/whatsapp-config", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { getTwilioCredentials } = await import('./services/whatsappService');
      const config = await storage.getWhatsappConfig();
      const creds = await getTwilioCredentials();

      if (!config) {
        return res.json({
          isConfigured: false,
          whatsappNumber: null,
          isActive: false,
          connectionStatus: 'not_configured',
        });
      }
      res.json({
        isConfigured: !!creds,
        twilioAccountSid: creds ? `${creds.accountSid.substring(0, 8)}...` : null,
        whatsappNumber: config.whatsappNumber,
        isActive: config.isActive,
        connectionStatus: config.connectionStatus,
        lastConnectionCheck: config.lastConnectionCheck,
      });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: errorMsg });
    }
  });

  app.put("/api/admin/whatsapp-config", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { setTwilioCredentials } = await import('./services/whatsappService');
      const { twilioAccountSid, twilioAuthToken, whatsappNumber, isActive } = req.body;
      const userId = getActiveUserId(req);

      if (twilioAccountSid && twilioAuthToken) {
        await setTwilioCredentials(twilioAccountSid, twilioAuthToken, userId || undefined);
      }

      const updateData: Partial<import('@shared/schema').InsertWhatsappConfig> = { updatedBy: userId };

      if (whatsappNumber !== undefined) updateData.whatsappNumber = whatsappNumber;
      if (isActive !== undefined) updateData.isActive = isActive;

      const config = await storage.upsertWhatsappConfig(updateData);
      const { getTwilioCredentials } = await import('./services/whatsappService');
      const creds = await getTwilioCredentials();

      res.json({
        isConfigured: !!creds,
        twilioAccountSid: creds ? `${creds.accountSid.substring(0, 8)}...` : null,
        whatsappNumber: config.whatsappNumber,
        isActive: config.isActive,
        connectionStatus: config.connectionStatus,
      });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: errorMsg });
    }
  });

  app.get("/api/admin/whatsapp-status", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { checkConnectionStatus } = await import('./services/whatsappService');
      const status = await checkConnectionStatus();
      res.json(status);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({
        isConnected: false,
        whatsappNumber: null,
        accountSid: null,
        connectionStatus: 'error',
        lastChecked: null,
        error: errorMsg,
      });
    }
  });

  app.post("/api/admin/whatsapp/send", requireAdmin, requireAdminPermission('canManageSettings'), async (req: Request, res: Response) => {
    try {
      const { to, body, templateName, templateParams } = req.body;

      if (!to) {
        return res.status(400).json({ message: "Recipient phone number is required" });
      }

      let result;
      if (templateName) {
        const { sendTemplateMessage } = await import('./services/whatsappService');
        result = await sendTemplateMessage(to, templateName, templateParams || {});
      } else if (body) {
        const { sendTextMessage } = await import('./services/whatsappService');
        result = await sendTextMessage(to, body);
      } else {
        return res.status(400).json({ message: "Message body or template name is required" });
      }

      let conversation = await storage.getConversationByPhone(to, 'whatsapp');
      if (!conversation) {
        conversation = await storage.createConversation({
          contactPhone: to,
          contactName: null,
          channel: 'whatsapp',
          status: 'open',
          userId: null,
          moverProfileId: null,
          quoteId: null,
          assignedAgentId: null,
          lastMessageAt: new Date(),
          lastMessagePreview: body?.substring(0, 100) || `[Template: ${templateName}]`,
          unreadCount: 0,
        });
      } else {
        await storage.updateConversation(conversation.id, {
          lastMessageAt: new Date(),
          lastMessagePreview: body?.substring(0, 100) || `[Template: ${templateName}]`,
        });
      }

      const config = await storage.getWhatsappConfig();
      await storage.createMessage({
        conversationId: conversation.id,
        twilioMessageSid: result.sid,
        direction: 'outbound',
        senderPhone: config?.whatsappNumber || null,
        senderName: 'U-Storage Go',
        body: body || null,
        status: result.status,
        isTemplate: !!templateName,
        templateName: templateName || null,
        templateParams: templateParams || null,
        sentAt: new Date(),
      });

      res.json({ success: true, messageSid: result.sid, status: result.status });
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('[WHATSAPP] Send error:', errorMsg);
      res.status(500).json({ message: errorMsg });
    }
  });

  app.get("/api/admin/conversations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const status = req.query.status as string | undefined;
      const convos = await storage.getAllConversations(status);
      res.json(convos);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: errorMsg });
    }
  });

  app.get("/api/admin/conversations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const conv = await storage.getConversation(req.params.id);
      if (!conv) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json(conv);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: errorMsg });
    }
  });

  app.put("/api/admin/conversations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { quoteId, assignedAgentId, status } = req.body;
      const updateData: Partial<import('@shared/schema').InsertConversation> = {};

      if (quoteId !== undefined) updateData.quoteId = quoteId;
      if (assignedAgentId !== undefined) updateData.assignedAgentId = assignedAgentId;
      if (status !== undefined) updateData.status = status;

      const conv = await storage.updateConversation(req.params.id, updateData);
      res.json(conv);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: errorMsg });
    }
  });

  app.get("/api/admin/conversations/:id/messages", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string || '50', 10);
      const msgs = await storage.getMessagesByConversation(req.params.id, limit);
      res.json(msgs);
    } catch (error: unknown) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ message: errorMsg });
    }
  });

  // ========== WHATSAPP INBOX ROUTES ==========

  // Get all conversations with optional filters
  app.get("/api/admin/whatsapp/conversations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { status, assignedAgentId, unassigned } = req.query;
      const filters: any = {};
      if (status && status !== 'all') filters.status = status as string;
      if (assignedAgentId) filters.assignedAgentId = assignedAgentId as string;
      if (unassigned === 'true') filters.unassigned = true;

      const conversations = await storage.getWhatsappConversations(filters);

      // Enrich with agent names and linked entity info
      const enriched = await Promise.all(conversations.map(async (conv) => {
        let assignedAgent = null;
        if (conv.assignedAgentId) {
          const agent = await storage.getUser(conv.assignedAgentId);
          if (agent) assignedAgent = { id: agent.id, fullName: agent.fullName, email: agent.email };
        }
        let linkedUser = null;
        if (conv.linkedUserId) {
          const user = await storage.getUser(conv.linkedUserId);
          if (user) linkedUser = { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone };
        }
        let linkedMoverProfile = null;
        if (conv.linkedMoverProfileId) {
          const mp = await storage.getMoverProfileById(conv.linkedMoverProfileId);
          if (mp) linkedMoverProfile = { id: mp.id, companyName: mp.companyName };
        }
        let linkedQuote = null;
        if (conv.linkedQuoteId) {
          const q = await storage.getQuote(conv.linkedQuoteId);
          if (q) linkedQuote = { id: q.id, quoteNumber: q.quoteNumber, status: q.workflowStatus };
        }
        return { ...conv, assignedAgent, linkedUser, linkedMoverProfile, linkedQuote };
      }));

      res.json(enriched);
    } catch (error: any) {
      console.error("Error fetching WhatsApp conversations:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Get unread count for badge
  app.get("/api/admin/whatsapp/unread-count", requireAdmin, async (req: Request, res: Response) => {
    try {
      const count = await storage.getTotalUnreadCount();
      res.json({ count });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get single conversation with messages
  app.get("/api/admin/whatsapp/conversations/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const conv = await storage.getWhatsappConversation(req.params.id);
      if (!conv) return res.status(404).json({ message: "Conversation not found" });

      const messages = await storage.getWhatsappMessages(conv.id);

      // Enrich agent names on messages
      const enrichedMessages = await Promise.all(messages.map(async (msg) => {
        let agentName = null;
        if (msg.agentId) {
          const agent = await storage.getUser(msg.agentId);
          if (agent) agentName = agent.fullName || agent.email;
        }
        return { ...msg, agentName };
      }));

      // Linked entity details
      let assignedAgent = null;
      if (conv.assignedAgentId) {
        const agent = await storage.getUser(conv.assignedAgentId);
        if (agent) assignedAgent = { id: agent.id, fullName: agent.fullName, email: agent.email };
      }
      let linkedUser = null;
      if (conv.linkedUserId) {
        const user = await storage.getUser(conv.linkedUserId);
        if (user) linkedUser = { id: user.id, fullName: user.fullName, email: user.email, phone: user.phone };
      }
      let linkedMoverProfile = null;
      if (conv.linkedMoverProfileId) {
        const mp = await storage.getMoverProfileById(conv.linkedMoverProfileId);
        if (mp) linkedMoverProfile = { id: mp.id, companyName: mp.companyName, contactPhone: mp.contactPhone };
      }
      let linkedQuote = null;
      if (conv.linkedQuoteId) {
        const q = await storage.getQuote(conv.linkedQuoteId);
        if (q) linkedQuote = { id: q.id, quoteNumber: q.quoteNumber, status: q.workflowStatus, fromAddress: q.fromAddress, toAddress: q.toAddress };
      }

      // Mark as read
      if (conv.unreadCount > 0) {
        await storage.updateWhatsappConversation(conv.id, { unreadCount: 0 });
      }

      res.json({
        ...conv,
        unreadCount: 0,
        messages: enrichedMessages,
        assignedAgent,
        linkedUser,
        linkedMoverProfile,
        linkedQuote,
      });
    } catch (error: any) {
      console.error("Error fetching WhatsApp conversation:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Send a reply message
  app.post("/api/admin/whatsapp/conversations/:id/reply", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { body: messageBody } = req.body;
      if (!messageBody || !messageBody.trim()) {
        return res.status(400).json({ message: "Message body is required" });
      }

      const conv = await storage.getWhatsappConversation(req.params.id);
      if (!conv) return res.status(404).json({ message: "Conversation not found" });

      const agentId = getUserId(req);

      const message = await storage.createWhatsappMessage({
        conversationId: conv.id,
        direction: 'outbound',
        body: messageBody.trim(),
        agentId,
        status: 'sent',
      });

      // Update conversation
      await storage.updateWhatsappConversation(conv.id, {
        lastMessageAt: new Date(),
        lastMessagePreview: messageBody.trim().substring(0, 100),
      });

      let agentName = null;
      if (agentId) {
        const agent = await storage.getUser(agentId);
        if (agent) agentName = agent.fullName || agent.email;
      }

      res.json({ ...message, agentName });
    } catch (error: any) {
      console.error("Error sending WhatsApp reply:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Update conversation status
  app.patch("/api/admin/whatsapp/conversations/:id/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getWhatsappConversation(req.params.id);
      if (!existing) return res.status(404).json({ message: "Conversation not found" });

      const { status } = req.body;
      if (!['open', 'pending', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      const conv = await storage.updateWhatsappConversation(req.params.id, { status });
      res.json(conv);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Assign agent
  app.patch("/api/admin/whatsapp/conversations/:id/assign", requireAdmin, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getWhatsappConversation(req.params.id);
      if (!existing) return res.status(404).json({ message: "Conversation not found" });

      const { agentId } = req.body;
      if (agentId) {
        const agent = await storage.getUser(agentId);
        if (!agent) return res.status(400).json({ message: "Agent not found" });
      }
      const conv = await storage.updateWhatsappConversation(req.params.id, {
        assignedAgentId: agentId || null,
      });
      res.json(conv);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Link/unlink entities
  app.patch("/api/admin/whatsapp/conversations/:id/link", requireAdmin, async (req: Request, res: Response) => {
    try {
      const existing = await storage.getWhatsappConversation(req.params.id);
      if (!existing) return res.status(404).json({ message: "Conversation not found" });

      const { linkedUserId, linkedMoverProfileId, linkedQuoteId } = req.body;
      const updates: any = {};
      if (linkedUserId !== undefined) {
        if (linkedUserId) {
          const user = await storage.getUser(linkedUserId);
          if (!user) return res.status(400).json({ message: "User not found" });
        }
        updates.linkedUserId = linkedUserId || null;
      }
      if (linkedMoverProfileId !== undefined) {
        if (linkedMoverProfileId) {
          const mp = await storage.getMoverProfileById(linkedMoverProfileId);
          if (!mp) return res.status(400).json({ message: "Mover profile not found" });
        }
        updates.linkedMoverProfileId = linkedMoverProfileId || null;
      }
      if (linkedQuoteId !== undefined) {
        if (linkedQuoteId) {
          const q = await storage.getQuote(linkedQuoteId);
          if (!q) return res.status(400).json({ message: "Quote not found" });
        }
        updates.linkedQuoteId = linkedQuoteId || null;
      }

      const conv = await storage.updateWhatsappConversation(req.params.id, updates);
      res.json(conv);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Create a new conversation (for testing / manual creation)
  app.post("/api/admin/whatsapp/conversations", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { contactPhone, contactName } = req.body;
      if (!contactPhone) {
        return res.status(400).json({ message: "Contact phone is required" });
      }

      const existing = await storage.getWhatsappConversationByPhone(contactPhone);
      if (existing) {
        return res.json(existing);
      }

      const conv = await storage.createWhatsappConversation({
        contactPhone,
        contactName: contactName || null,
        status: 'open',
        unreadCount: 0,
      });
      res.json(conv);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Search users/partners/quotes for linking
  app.get("/api/admin/whatsapp/search", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { q, type } = req.query;
      const query = (q as string || '').toLowerCase();
      if (!query || query.length < 2) return res.json([]);

      if (type === 'user') {
        const allUsers = await storage.getAllUsers();
        const filtered = allUsers.filter(u =>
          (u.fullName?.toLowerCase().includes(query)) ||
          (u.email?.toLowerCase().includes(query)) ||
          (u.phone?.includes(query))
        ).slice(0, 10);
        res.json(filtered.map(u => ({ id: u.id, fullName: u.fullName, email: u.email, phone: u.phone })));
      } else if (type === 'partner') {
        const allMovers = await storage.getAllMoverProfiles();
        const filtered = allMovers.filter(m =>
          m.companyName?.toLowerCase().includes(query) ||
          m.contactPhone?.includes(query)
        ).slice(0, 10);
        res.json(filtered.map(m => ({ id: m.id, companyName: m.companyName, contactPhone: m.contactPhone })));
      } else if (type === 'quote') {
        const allQuotes = await storage.getAllQuotes();
        const filtered = allQuotes.filter(q =>
          q.quoteNumber?.toLowerCase().includes(query) ||
          q.contactName?.toLowerCase().includes(query) ||
          q.contactPhone?.includes(query)
        ).slice(0, 10);
        res.json(filtered.map(q => ({ id: q.id, quoteNumber: q.quoteNumber, contactName: q.contactName, status: q.workflowStatus })));
      } else {
        res.json([]);
      }
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get admin users for agent assignment
  app.get("/api/admin/whatsapp/agents", requireAdmin, async (req: Request, res: Response) => {
    try {
      const admins = await storage.getUsersByRole('admin');
      res.json(admins.map(a => ({ id: a.id, fullName: a.fullName, email: a.email })));
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  return httpServer;
}
