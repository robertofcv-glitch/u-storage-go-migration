import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, decimal, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_reset_tokens_token").on(table.token),
  index("idx_reset_tokens_user").on(table.userId),
]);

// User role types
export const USER_ROLES = {
  CLIENT: 'client',
  MOVER: 'mover',
  ADMIN: 'admin',
} as const;

// Users table - supports clients, movers, and admins with OAuth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").unique(),
  password: text("password"), // Optional for OAuth users
  fullName: text("full_name"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  profileImageUrl: text("profile_image_url"),
  userType: text("user_type").default('client'), // Legacy field - use userRoles for multi-role
  phone: text("phone"),
  preferredLanguage: text("preferred_language").default('es'), // 'es' or 'en'
  timezone: text("timezone"), // User's preferred timezone (null = use platform default America/Mexico_City)
  timezoneSource: text("timezone_source"), // 'detected' | 'manual' | 'admin_override' - how the timezone was set
  timezoneDetectedAt: timestamp("timezone_detected_at"), // Last time timezone was auto-detected
  lastLoginAt: timestamp("last_login_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User roles junction table - supports multiple roles per user
export const userRoles = pgTable("user_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text("role").notNull(), // 'client', 'mover', 'admin'
  grantedBy: varchar("granted_by").references(() => users.id), // Admin who granted the role
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true),
}, (table) => [
  index("idx_user_roles_user").on(table.userId),
  index("idx_user_roles_role").on(table.role),
]);

// Admin permissions - defines what each admin user can do
export const adminPermissions = pgTable("admin_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  canManageUsers: boolean("can_manage_users").default(true),
  canManageMovers: boolean("can_manage_movers").default(true),
  canManageQuotes: boolean("can_manage_quotes").default(true),
  canManageSettings: boolean("can_manage_settings").default(false),
  canAccessDatabase: boolean("can_access_database").default(false),
  canManageAdmins: boolean("can_manage_admins").default(false),
  isSuperAdmin: boolean("is_super_admin").default(false),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  index("idx_admin_permissions_user").on(table.userId),
]);

export const platformRoles = pgTable("platform_roles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("platform_roles_slug_unique").on(table.slug),
]);

export const platformRoleModules = pgTable("platform_role_modules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roleId: varchar("role_id").notNull().references(() => platformRoles.id, { onDelete: "cascade" }),
  moduleKey: text("module_key").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("platform_role_modules_role_module_unique").on(table.roleId, table.moduleKey),
  index("idx_platform_role_modules_role").on(table.roleId),
]);

export const adminWorkspaceSections = pgTable("admin_workspace_sections", {
  href: text("href").primaryKey(),
  workspaceKey: text("workspace_key").notNull(),
  position: integer("position").default(0).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  index("idx_admin_workspace_sections_workspace").on(table.workspaceKey, table.position),
]);

// Admin access request status
export const ADMIN_REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DENIED: 'denied',
} as const;

// Admin access requests - for users requesting admin access
export const adminAccessRequests = pgTable("admin_access_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  company: text("company"),
  justification: text("justification"), // Why they need admin access
  status: text("status").default('pending').notNull(), // pending, approved, denied
  reviewedBy: varchar("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"), // Notes from reviewer (especially for denial)
  userId: varchar("user_id").references(() => users.id), // Linked user after approval
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_admin_requests_email").on(table.email),
  index("idx_admin_requests_status").on(table.status),
]);

// Activity logs - tracks all user actions on the platform
export const activityLogs = pgTable("activity_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  actorRole: text("actor_role"), // Role user was acting as: 'client', 'mover', 'admin'
  action: text("action").notNull(), // e.g., 'quote.created', 'bid.submitted', 'login', 'user.registered'
  entityType: text("entity_type"), // 'quote', 'bid', 'user', 'mover_profile', etc.
  entityId: varchar("entity_id"), // ID of the affected entity
  details: jsonb("details"), // Additional action details as JSON
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  // Soft references keep this audit table compatible with historical databases.
  companyId: varchar("company_id"),
  membershipId: varchar("membership_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_activity_logs_user").on(table.userId),
  index("idx_activity_logs_action").on(table.action),
  index("idx_activity_logs_entity").on(table.entityType, table.entityId),
  index("idx_activity_logs_created").on(table.createdAt),
  index("idx_activity_logs_company").on(table.companyId, table.createdAt),
]);

// Mover profiles - additional info for moving companies
// Partner status enum - mirrors quote workflow pattern
export const PARTNER_STATUS = {
  PENDING: 'pending',           // Just registered, awaiting review
  DOCUMENTS_REVIEW: 'documents_review', // Documents uploaded, under review
  APPROVED: 'approved',         // Admin approved, onboarding in progress
  ACTIVE: 'active',             // Fully active, can receive invitations and bid
  SUSPENDED: 'suspended',       // Temporarily suspended
  INACTIVE: 'inactive',         // Deactivated by admin or partner
} as const;

export const moverProfiles = pgTable("mover_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyName: text("company_name").notNull(),
  isInternal: boolean("is_internal").default(false).notNull(),
  businessEmail: text("business_email"),
  contactPhone: text("contact_phone"),
  contactWhatsApp: text("contact_whatsapp"),
  website: text("website"),
  description: text("description"),
  taxId: text("tax_id"),
  insuranceInfo: text("insurance_info"),
  serviceAreas: text("service_areas").array(),
  moveTypes: text("move_types").array(),
  vehicleTypes: text("vehicle_types").array(),
  fleetSize: integer("fleet_size"),
  crewSize: integer("crew_size"),
  yearsInBusiness: integer("years_in_business"),
  operatingHours: text("operating_hours"),
  operatingTimezone: text("operating_timezone").default("America/Mexico_City"),
  operatingSchedule: jsonb("operating_schedule"),
  serviceCapabilities: text("service_capabilities").array(),
  travelBufferMinutes: integer("travel_buffer_minutes").default(60),
  turnaroundBufferMinutes: integer("turnaround_buffer_minutes").default(30),
  onboardingReadiness: jsonb("onboarding_readiness"),
  verified: boolean("verified").default(false),
  partnerStatus: text("partner_status").default('pending'),
  partnerStatusNote: text("partner_status_note"),
  partnerStatusUpdatedAt: timestamp("partner_status_updated_at"),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  totalJobs: integer("total_jobs").default(0),
  onboardingComplete: boolean("onboarding_complete").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Capability granted to sales operators in addition to read-only quote access. */
export const PLATFORM_CAPABILITIES = {
  ASSISTED_QUOTES: "capability:quotes:assisted",
} as const;

/** Generalized company identity. moverProfileId preserves legacy partner IDs. */
export const COMPANY_CLASSIFICATIONS = {
  CLIENT: "client", PARTNER: "partner", BOTH: "both",
} as const;
/** Legacy partner alias retained for existing partner APIs and historical FKs. */
export const partnerCompanies = moverProfiles;

export const COMPANY_MEMBER_ROLES = {
  OWNER: "owner", ADMIN: "admin", DISPATCHER: "dispatcher",
  FLEET_MANAGER: "fleet_manager", ACCOUNTANT: "accountant", VIEWER: "viewer",
} as const;
export const COMPANY_MEMBER_STATUSES = {
  INVITED: "invited", ACTIVE: "active", SUSPENDED: "suspended",
} as const;

export const partnerCompanyMemberships = pgTable("partner_company_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => moverProfiles.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email"),
  role: text("role").notNull().default(COMPANY_MEMBER_ROLES.VIEWER),
  status: text("status").notNull().default(COMPANY_MEMBER_STATUSES.INVITED),
  invitationTokenHash: text("invitation_token_hash"),
  invitationExpiresAt: timestamp("invitation_expires_at"),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  invitedBy: varchar("invited_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_company_memberships_company_status").on(table.companyId, table.status),
  index("idx_company_memberships_user_status").on(table.userId, table.status),
  index("idx_company_memberships_invited_email").on(table.invitedEmail),
  uniqueIndex("uq_company_memberships_company_user").on(table.companyId, table.userId),
  uniqueIndex("uq_company_memberships_company_invited_email").on(table.companyId, table.invitedEmail),
  uniqueIndex("uq_company_memberships_invitation_token").on(table.invitationTokenHash),
]);

// Partner status history - tracks all status changes like quote_status_history
export const partnerStatusHistory = pgTable("partner_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moverProfileId: varchar("mover_profile_id").notNull().references(() => moverProfiles.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  actorType: text("actor_type"), // 'admin', 'system', 'partner'
  actorId: varchar("actor_id"),
  actorName: text("actor_name"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Document status for partner documents
export const DOCUMENT_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

// Document types - admin-configurable types of documents partners must submit
export const documentTypes = pgTable("document_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  nameEs: text("name_es").notNull(),
  nameEn: text("name_en").notNull(),
  descriptionEs: text("description_es"),
  descriptionEn: text("description_en"),
  isRequired: boolean("is_required").default(true),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Partner documents - documents uploaded by partners
export const partnerDocuments = pgTable("partner_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moverProfileId: varchar("mover_profile_id").notNull().references(() => moverProfiles.id),
  documentTypeId: varchar("document_type_id").notNull().references(() => documentTypes.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  fileData: text("file_data"),
  status: text("status").default('pending').notNull(),
  reviewerId: varchar("reviewer_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNote: text("review_note"),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_partner_docs_mover").on(table.moverProfileId),
  index("idx_partner_docs_type").on(table.documentTypeId),
  index("idx_partner_docs_status").on(table.status),
]);

// Quote workflow statuses
export const QUOTE_WORKFLOW_STATUS = {
  INTAKE: 'intake',           // New quote received
  TRIAGE: 'triage',           // Admin reviewing details
  BIDDING_OPEN: 'bidding_open', // Partners can submit bids
  SELECTION: 'selection',     // Bidding closed, selecting partner
  CONFIRMED: 'confirmed',     // Partner assigned, awaiting execution
  SCHEDULED: 'scheduled',     // Move date confirmed
  IN_PROGRESS: 'in_progress', // Move underway
  COMPLETED: 'completed',     // Move finished
  CANCELLED: 'cancelled',     // Quote cancelled
} as const;

// Bidding status - tracks the lifecycle of bidding for a quote
export const BIDDING_STATUS = {
  PENDING: 'pending',         // Before bidding opens
  OPEN: 'open',               // Bidding is open
  CLOSED: 'closed',           // Bidding is closed (manually or by deadline)
  ASSIGNED: 'assigned',       // Partner has been assigned
  DISCARDED: 'discarded',     // Quote was discarded/cancelled
} as const;

// Quotes table
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteNumber: text("quote_number").unique(), // User-friendly identifier like RK-001234
  userId: varchar("user_id").references(() => users.id),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "set null" }),
  // Immutable provenance for assisted sales quoting. userId remains the customer
  // account (when one exists), while actingEmployeeId identifies the operator.
  quoteOrigin: text("quote_origin").default("public").notNull(), // public | self_service | assisted
  createdByAdminId: varchar("created_by_admin_id").references(() => users.id),
  followUpOwnerId: varchar("follow_up_owner_id").references(() => users.id),
  actingEmployeeId: varchar("acting_employee_id").references(() => users.id),
  leadCustomerId: varchar("lead_customer_id").references(() => users.id),
  // Lead capture fields (for quotes without account)
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  isPartial: boolean("is_partial").default(false), // True if quote wizard not completed
  quoteSessionId: text("quote_session_id"), // Client-generated session ID for idempotency
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  moveDate: timestamp("move_date"),
  moveAvailabilityStart: text("move_availability_start"),
  moveAvailabilityEnd: text("move_availability_end"),
  preferredMoveDates: jsonb("preferred_move_dates").$type<string[]>().default([]).notNull(),
  blockedMoveDates: jsonb("blocked_move_dates").$type<string[]>().default([]).notNull(),
  homeSize: text("home_size").notNull(),
  storageOption: text("storage_option"),
  needsInsurance: boolean("needs_insurance").default(false),
  needsPacking: boolean("needs_packing").default(false),
  needsUnpacking: boolean("needs_unpacking").default(false),
  needsBox: boolean("needs_box").default(false),
  clientNotes: text("client_notes"), // Additional notes and comments from the client
  status: text("status").default('pending'), // Legacy status for backwards compat
  workflowStatus: text("workflow_status").default('intake'), // New workflow status
  // Dispatch is versioned independently so historical bidding quotes remain readable.
  // Null is intentionally treated as legacy bidding data. New records are
  // explicitly stamped "dispatch" by storage.createQuote so adding this column
  // never silently converts historical production quotes.
  workflowMode: text("workflow_mode"), // dispatch | bidding | null (legacy)
  workflowVersion: integer("workflow_version").default(1).notNull(),
  quoteReviewVersion: integer("quote_review_version").default(0).notNull(),
  biddingStatus: text("bidding_status").default('pending'), // Bidding lifecycle: pending, open, closed, assigned, discarded
  estimatedCost: decimal("estimated_cost", { precision: 10, scale: 2 }), // Low estimate from Clara
  estimatedCostHigh: decimal("estimated_cost_high", { precision: 10, scale: 2 }), // High estimate from Clara
  requiredVehicleWeightKg: integer("required_vehicle_weight_kg"),
  requiredVehicleVolumeM3: decimal("required_vehicle_volume_m3", { precision: 8, scale: 2 }),
  requiredCrewCount: integer("required_crew_count"),
  estimatedCurrency: text("estimated_currency").default('MXN'), // Currency for estimates
  suggestedPrice: decimal("suggested_price", { precision: 10, scale: 2 }), // Admin target price
  finalPrice: decimal("final_price", { precision: 10, scale: 2 }), // Accepted bid price
  adminNotes: text("admin_notes"), // Internal notes
  assignedMoverProfileId: varchar("assigned_mover_profile_id").references(() => moverProfiles.id),
  biddingOpensAt: timestamp("bidding_opens_at"),
  biddingClosesAt: timestamp("bidding_closes_at"),
  clientConfirmedAt: timestamp("client_confirmed_at"),
  priceProposalAmount: decimal("price_proposal_amount", { precision: 10, scale: 2 }),
  priceProposalVersion: integer("price_proposal_version").default(0).notNull(),
  priceProposalCurrency: text("price_proposal_currency").default('MXN'),
  priceProposalNote: text("price_proposal_note"),
  priceProposedAt: timestamp("price_proposed_at"),
  priceProposedBy: varchar("price_proposed_by").references(() => users.id),
  priceClientRespondedAt: timestamp("price_client_responded_at"),
  priceClientResponse: text("price_client_response"), // accepted | change_requested
  priceClientChangeRequest: text("price_client_change_request"),
  // Partner selection workflow
  selectedBidId: varchar("selected_bid_id"), // Bid chosen by client (FK added after quoteBids defined)
  partnerSelectionStatus: text("partner_selection_status").default('pending'), // 'pending', 'client_selected', 'admin_approved', 'finalized'
  partnerSelectedAt: timestamp("partner_selected_at"), // When client made selection
  partnerFinalizedAt: timestamp("partner_finalized_at"), // When admin gave final approval
  // Marketing attribution fields
  partner: text("partner"), // Partner slug (e.g., 'u-storage')
  utmSource: text("utm_source"), // Traffic source (google, facebook, email)
  utmMedium: text("utm_medium"), // Traffic type (cpc, social, email)
  utmCampaign: text("utm_campaign"), // Campaign name
  utmTerm: text("utm_term"), // Keywords (for paid search)
  utmContent: text("utm_content"), // Ad variation
  landingPage: text("landing_page"), // URL path where user landed
  referrerUrl: text("referrer_url"), // Where the user came from
  // Distance calculation from Google Maps
  estimatedDistanceKm: decimal("estimated_distance_km", { precision: 10, scale: 2 }), // Actual route distance from Google
  distanceCalculatedAt: timestamp("distance_calculated_at"), // When distance was calculated
  // U-Storage branch matching / storage recommendation
  serviceMode: text("service_mode"), // branch_connected | general_point_to_point
  storageBranchId: varchar("storage_branch_id").references(() => ustorageBranches.id, { onDelete: "set null" }),
  storageMoveType: text("storage_move_type"), // 'into_storage' | 'out_of_storage' | null (regular move)
  storageBranchBrand: text("storage_branch_brand"),
  storageBranchGooglePlaceId: text("storage_branch_google_place_id"),
  storageBranchName: text("storage_branch_name"),
  storageBranchAddress: text("storage_branch_address"),
  storageBranchSnapshot: jsonb("storage_branch_snapshot"),
  eligibilityCheckedAt: timestamp("eligibility_checked_at"),
  eligibilityVersion: integer("eligibility_version").default(1).notNull(),
  storageBranchDistanceKm: decimal("storage_branch_distance_km", { precision: 10, scale: 2 }), // Distance from matched address to branch
  storageSizeLabel: text("storage_size_label"), // Suggested size tier label (e.g., "Mediana (7.5 m²)")
  storageSizeM2: decimal("storage_size_m2", { precision: 6, scale: 2 }), // Suggested size in m²
  storageAccepted: boolean("storage_accepted"), // null = not answered, true = accepted, false = declined
  storageAcceptedAt: timestamp("storage_accepted_at"),
  // Step 4 decision contract. These fields deliberately remain separate from
  // storageAccepted, which is retained for legacy quote integrations.
  storageContractStatus: text("storage_contract_status"), // existing | needs_unit | not_applicable
  storageRentalIntent: text("storage_rental_intent"), // reserve | no_reservation | null
  storageAvailabilityStatus: text("storage_availability_status"), // available | unavailable | rate_limited | format_error | wrong_branch | no_availability
  storageSelectedUnitCode: text("storage_selected_unit_code"),
  storageSelectedUnitSnapshot: jsonb("storage_selected_unit_snapshot"),
  storageReservationStatus: text("storage_reservation_status"), // not_started | handed_off | confirmed
  storageHandoffProvenance: text("storage_handoff_provenance"), // manual | ustorage_confirmed
  storageReservationRefHash: text("storage_reservation_ref_hash"),
  storageRentalStart: timestamp("storage_rental_start"),
  storageVerifiedFields: jsonb("storage_verified_fields").$type<string[]>().default([]).notNull(),
  storageRedemptionRef: text("storage_redemption_ref"),
  storageExchangeId: text("storage_exchange_id"),
  storageAvailabilityCheckedAt: timestamp("storage_availability_checked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quotes_workflow_status").on(table.workflowStatus, table.createdAt),
  index("idx_quotes_partner").on(table.partner),
  index("idx_quotes_service_mode").on(table.serviceMode),
  index("idx_quotes_storage_branch").on(table.storageBranchId),
  index("idx_quotes_storage_place").on(table.storageBranchGooglePlaceId),
  index("idx_quotes_utm_source").on(table.utmSource),
  index("idx_quotes_utm_campaign").on(table.utmCampaign),
]);

// Quote invitations - invites sent to partners
export const quoteInvitations = pgTable("quote_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  moverProfileId: varchar("mover_profile_id").notNull().references(() => moverProfiles.id),
  invitedBy: varchar("invited_by").references(() => users.id), // Admin who invited
  status: text("status").default('invited'), // 'invited', 'viewed', 'declined', 'bid_submitted', 'accepted', 'rejected'
  message: text("message"), // Optional message to the mover
  dueAt: timestamp("due_at"), // Deadline to respond
  // Quote details sent with invitation
  quotedAmount: decimal("quoted_amount", { precision: 10, scale: 2 }), // Price shown to partner (AI estimate + admin adjustment)
  quotedCurrency: text("quoted_currency").default('MXN'),
  // Email tracking
  emailSentAt: timestamp("email_sent_at"),
  emailStatus: text("email_status"), // 'pending', 'sent', 'delivered', 'failed'
  // Response tracking
  viewedAt: timestamp("viewed_at"),
  respondedAt: timestamp("responded_at"),
  declineReason: text("decline_reason"), // If partner declines
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const DISPATCH_STATUS = {
  SOLICITED: 'solicited',
  PRICE_AWAITING_CLIENT: 'price_awaiting_client',
  DISPATCH_PLANNING: 'dispatch_planning',
  ASSIGNMENT_PENDING_PARTNER: 'assignment_pending_partner',
  CONFIRMED: 'confirmed',
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

export const DISPATCH_ASSIGNMENT_STATUS = {
  PROPOSED: 'proposed',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  CANCELLED: 'cancelled',
  REASSIGNED: 'reassigned',
} as const;

export const RESERVATION_STATUS = {
  TENTATIVE: 'tentative',
  CONFIRMED: 'confirmed',
  RELEASED: 'released',
} as const;

export const SERVICE_STAGE = {
  PLANNING: "planning",
  AWAITING_COLLECTION: "awaiting_collection",
  CONFIRMED: "confirmed",
  PRE_SERVICE: "pre_service",
  READY: "ready",
  IN_PROGRESS: "in_progress",
  POST_SERVICE: "post_service",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  EXCEPTION: "exception",
} as const;

export const COLLECTION_STATUS = {
  PENDING: "pending",
  AWAITING_VALIDATION: "awaiting_validation",
  VERIFIED: "verified",
  FAILED: "failed",
  REJECTED: "rejected",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
  WAIVED: "waived",
  DEFERRED: "deferred",
} as const;

export const SERVICE_CHECKLIST_KEYS = [
  "contact", "addresses", "scope", "access", "date", "pricing_payment",
  "fleet", "crew", "notes_evidence",
] as const;

// Individual fleet assets (rather than a vehicle count on a partner profile).
export const partnerVehicles = pgTable("partner_vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moverProfileId: varchar("mover_profile_id").notNull().references(() => moverProfiles.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  registration: text("registration"),
  vehicleType: text("vehicle_type"),
  capacity: text("capacity"),
  truckTypeId: varchar("truck_type_id").references(() => truckTypes.id, { onDelete: "restrict" }),
  legacyCapacityNeedsReview: boolean("legacy_capacity_needs_review").default(false).notNull(),
  legacyCapacityNote: text("legacy_capacity_note"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_partner_vehicles_partner").on(table.moverProfileId),
  index("idx_partner_vehicles_truck_type").on(table.truckTypeId),
]);

export const partnerCrews = pgTable("partner_crews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moverProfileId: varchar("mover_profile_id").notNull().references(() => moverProfiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  role: text("role").default("crew"),
  memberUserId: varchar("member_user_id").references(() => users.id, { onDelete: "set null" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [index("idx_partner_crews_partner").on(table.moverProfileId)]);
export const vehicleAvailabilityWindows = pgTable("vehicle_availability_windows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleId: varchar("vehicle_id").notNull().references(() => partnerVehicles.id, { onDelete: 'cascade' }),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  label: text("label"), // optional morning/afternoon display label; boundaries are authoritative
  isAvailable: boolean("is_available").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [index("idx_vehicle_availability_vehicle_time").on(table.vehicleId, table.startsAt, table.endsAt)]);

export const dispatchAssignments = pgTable("dispatch_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  moverProfileId: varchar("mover_profile_id").notNull().references(() => moverProfiles.id),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  status: text("status").default('proposed').notNull(),
  proposedBy: varchar("proposed_by").references(() => users.id),
  respondedAt: timestamp("responded_at"),
  responseNote: text("response_note"),
  crewCountRequired: integer("crew_count_required"),
  vehicleWeightRequiredKg: integer("vehicle_weight_required_kg"),
  vehicleVolumeRequiredM3: decimal("vehicle_volume_required_m3", { precision: 8, scale: 2 }),
  vehicleTypeSnapshot: jsonb("vehicle_type_snapshot"),
  crewSnapshot: jsonb("crew_snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_dispatch_assignments_quote").on(table.quoteId),
  index("idx_dispatch_assignments_partner_status").on(table.moverProfileId, table.status),
]);

// Operational handoff. Quotes remain the commercial source record; this
// aggregate is the record operators execute and complete.
export const operationalServices = pgTable("operational_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "restrict" }).unique(),
  assignmentId: varchar("assignment_id").references(() => dispatchAssignments.id, { onDelete: "set null" }),
  customerId: varchar("customer_id").references(() => users.id, { onDelete: "set null" }),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "set null" }),
  stage: text("stage").notNull().default("confirmed"),
  snapshot: jsonb("snapshot").notNull(),
  startedAt: timestamp("started_at"),
  finishedAt: timestamp("finished_at"),
  completedAt: timestamp("completed_at"),
  cancelledAt: timestamp("cancelled_at"),
  cancellationReason: text("cancellation_reason"),
  exceptionReason: text("exception_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_operational_services_stage").on(table.stage, table.updatedAt),
  index("idx_operational_services_quote").on(table.quoteId),
  index("idx_operational_services_date").on(sql`(${table.snapshot}->>'moveDate')`),
]);

export const quoteOfferRevisions = pgTable("quote_offer_revisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  version: integer("version").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("MXN"),
  terms: text("terms"),
  paymentTerms: text("payment_terms"),
  deadline: timestamp("deadline"),
  note: text("note"),
  sentBy: varchar("sent_by").references(() => users.id),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_quote_offer_revisions_quote_version").on(table.quoteId, table.version),
]);

export const quoteCustomerDecisions = pgTable("quote_customer_decisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  offerRevisionId: varchar("offer_revision_id").references(() => quoteOfferRevisions.id),
  decision: text("decision").notNull(), // accepted | rejected | change_requested
  note: text("note"),
  actorId: varchar("actor_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const serviceCollections = pgTable("service_collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => operationalServices.id, { onDelete: "cascade" }).unique(),
  method: text("method").notNull(), // hosted_link | bank_transfer | manual
  status: text("status").notNull().default(COLLECTION_STATUS.PENDING),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").notNull().default("MXN"),
  deadline: timestamp("deadline"),
  provider: text("provider"),
  externalReference: text("external_reference"),
  evidenceReference: text("evidence_reference"),
  notes: text("notes"),
  submittedAt: timestamp("submitted_at"),
  verifiedAt: timestamp("verified_at"),
  rejectedAt: timestamp("rejected_at"),
  expiredAt: timestamp("expired_at"),
  refundedAt: timestamp("refunded_at"),
  actorId: varchar("actor_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_service_collections_status_deadline").on(table.status, table.deadline),
]);

export const serviceCollectionEvents = pgTable("service_collection_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  collectionId: varchar("collection_id").notNull().references(() => serviceCollections.id, { onDelete: "cascade" }),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  method: text("method"),
  provider: text("provider"),
  externalReference: text("external_reference"),
  evidenceReference: text("evidence_reference"),
  notes: text("notes"),
  actorId: varchar("actor_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const serviceChecklistItems = pgTable("service_checklist_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => operationalServices.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  required: boolean("required").notNull().default(true),
  completed: boolean("completed").notNull().default(false),
  completedBy: varchar("completed_by").references(() => users.id),
  completedAt: timestamp("completed_at"),
  note: text("note"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_service_checklist_service_key").on(table.serviceId, table.key),
]);

export const serviceTimelineEvents = pgTable("service_timeline_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => operationalServices.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  fromStage: text("from_stage"),
  toStage: text("to_stage"),
  note: text("note"),
  evidenceReference: text("evidence_reference"),
  metadata: jsonb("metadata"),
  actorId: varchar("actor_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_service_timeline_service_created").on(table.serviceId, table.createdAt),
]);

export const serviceFeedbackRequests = pgTable("service_feedback_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => operationalServices.id, { onDelete: "cascade" }).unique(),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  ratingId: varchar("rating_id").references(() => ratings.id, { onDelete: "set null" }),
});

export const assignmentVehicles = pgTable("assignment_vehicles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => dispatchAssignments.id, { onDelete: 'cascade' }),
  vehicleId: varchar("vehicle_id").notNull().references(() => partnerVehicles.id),
}, (table) => [index("idx_assignment_vehicles_assignment").on(table.assignmentId), uniqueIndex("uq_assignment_vehicles_assignment_vehicle").on(table.assignmentId, table.vehicleId)]);

export const assignmentCrews = pgTable("assignment_crews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => dispatchAssignments.id, { onDelete: "cascade" }),
  crewId: varchar("crew_id").notNull().references(() => partnerCrews.id),
}, (table) => [index("idx_assignment_crews_assignment").on(table.assignmentId), uniqueIndex("uq_assignment_crews_assignment_crew").on(table.assignmentId, table.crewId)]);
export const assignmentReservations = pgTable("assignment_reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => dispatchAssignments.id, { onDelete: 'cascade' }),
  vehicleId: varchar("vehicle_id").notNull().references(() => partnerVehicles.id),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  status: text("status").default('tentative').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  releasedAt: timestamp("released_at"),
}, (table) => [
  index("idx_assignment_reservations_vehicle_time").on(table.vehicleId, table.startsAt, table.endsAt),
]);

export const crewAssignmentReservations = pgTable("crew_assignment_reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  assignmentId: varchar("assignment_id").notNull().references(() => dispatchAssignments.id, { onDelete: "cascade" }),
  crewId: varchar("crew_id").notNull().references(() => partnerCrews.id),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  status: text("status").default("tentative").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  releasedAt: timestamp("released_at"),
}, (table) => [index("idx_crew_reservations_crew_time").on(table.crewId, table.startsAt, table.endsAt)]);
export const quoteBids = pgTable("quote_bids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invitationId: varchar("invitation_id").notNull().references(() => quoteInvitations.id),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  moverProfileId: varchar("mover_profile_id").notNull().references(() => moverProfiles.id),
  // Pricing
  originalAmount: decimal("original_amount", { precision: 10, scale: 2 }), // Original quoted price from admin
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(), // Partner's bid amount
  currency: text("currency").default('MXN'),
  isOriginalPrice: boolean("is_original_price").default(true), // Did partner accept original price?
  adjustmentReason: text("adjustment_reason"), // Required if price differs - explanation for change
  // Availability
  availabilityStart: timestamp("availability_start"), // When they can do the move
  availabilityEnd: timestamp("availability_end"),
  proposedMoveDate: timestamp("proposed_move_date"), // Partner's proposed date if different
  // Resources
  estimatedHours: integer("estimated_hours"),
  crewSize: integer("crew_size"),
  vehiclesNeeded: integer("vehicles_needed"),
  includedServices: jsonb("included_services"), // Array of service IDs included
  extraFees: jsonb("extra_fees"), // Array of { name, amount } for additional charges
  notes: text("notes"), // Mover's comments
  // Bid status workflow
  status: text("status").default('draft'), // 'draft', 'submitted', 'withdrawn', 'accepted', 'rejected'
  submittedAt: timestamp("submitted_at"),
  validUntil: timestamp("valid_until"), // When this offer expires
  // Admin review
  adminReviewStatus: text("admin_review_status").default('pending'), // 'pending', 'approved', 'rejected'
  adminReviewedAt: timestamp("admin_reviewed_at"),
  adminReviewedBy: varchar("admin_reviewed_by").references(() => users.id),
  adminReviewNote: text("admin_review_note"),
  // Client selection
  userSelectedAt: timestamp("user_selected_at"), // When client chose this bid
  // Client preference ranking
  clientPreferenceRank: integer("client_preference_rank"), // Client's preference order (1 = most preferred)
  clientPreferenceUpdatedAt: timestamp("client_preference_updated_at"), // When client set preference
  // Final approval
  finalApprovalAt: timestamp("final_approval_at"),
  finalApprovedBy: varchar("final_approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Quote status history - audit trail
export const quoteStatusHistory = pgTable("quote_status_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  actorType: text("actor_type"), // 'admin', 'mover', 'client', 'system'
  actorId: varchar("actor_id"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quote activity log - comprehensive tracking of all quote changes
export const quoteActivityLog = pgTable("quote_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  actionType: text("action_type").notNull(), // Stable event key; legacy action keys remain supported.
  actorType: text("actor_type"), // 'admin', 'mover', 'client', 'system'
  actorId: varchar("actor_id"),
  actorName: text("actor_name"), // Denormalized for display
  description: text("description").notNull(), // Human-readable description
  descriptionEs: text("description_es"), // Spanish version
  metadata: jsonb("metadata"), // Flexible JSON for action-specific details (before/after values, etc.)
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quote_activity_log_quote").on(table.quoteId),
  index("idx_quote_activity_log_action").on(table.actionType),
  index("idx_quote_activity_log_event_key").on(table.actionType),
  index("idx_quote_activity_log_created").on(table.createdAt),
]);

// Quote PDF documents
export const quoteDocuments = pgTable("quote_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").default('application/pdf'),
  fileSize: integer("file_size"),
  pdfData: text("pdf_data"), // Base64 encoded PDF data
  version: integer("version").default(1),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quote_documents_quote").on(table.quoteId),
]);

// Inventory items for quotes
// Private customer intake evidence. Generated quote PDFs use quoteDocuments;
// these files are only available through authenticated quote-scoped routes.
export const quoteIntakeAttachments = pgTable("quote_intake_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileData: text("file_data"),
  status: text("status").notNull().default("ready"),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_quote_intake_attachments_quote").on(table.quoteId, table.createdAt),
]);

export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  itemName: text("item_name").notNull(),
  room: text("room"),
  category: text("category"),
  quantity: integer("quantity").default(1),
  notes: text("notes"),
});

// Services table - configurable moving services
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameEs: text("name_es"),
  description: text("description").notNull(),
  descriptionEs: text("description_es"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add-ons table - additional services
export const addOns = pgTable("add_ons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameEs: text("name_es"),
  description: text("description").notNull(),
  descriptionEs: text("description_es"),
  price: decimal("price", { precision: 10, scale: 2 }),
  active: boolean("active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Quote services - many-to-many relationship
export const quoteServices = pgTable("quote_services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  serviceId: varchar("service_id").notNull().references(() => services.id),
  createdByAdminId: varchar("created_by_admin_id").references(() => users.id),
  followUpOwnerId: varchar("follow_up_owner_id").references(() => users.id),
});

export const serviceActivityLog = pgTable("service_activity_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteServiceId: varchar("quote_service_id").notNull().references(() => quoteServices.id, { onDelete: "cascade" }),
  actionType: text("action_type").notNull(),
  actorType: text("actor_type"),
  actorId: varchar("actor_id"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("service_activity_quote_service_idx").on(table.quoteServiceId),
  index("service_activity_event_idx").on(table.actionType),
]);

// Quote add-ons - many-to-many relationship
export const quoteAddOns = pgTable("quote_add_ons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  addOnId: varchar("add_on_id").notNull().references(() => addOns.id),
});

// Inventory categories for Clara AI - configurable standardized list
export const inventoryCategories = pgTable("inventory_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // e.g., "sofas", "beds", "tables"
  labelEs: text("label_es").notNull(), // Spanish display name
  labelEn: text("label_en").notNull(), // English display name
  description: text("description"), // Examples of items in this category
  icon: text("icon").default('box'), // Lucide icon name
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  avgWeightKg: decimal("avg_weight_kg", { precision: 8, scale: 2 }), // Average weight in kg for estimation
  minWeightKg: decimal("min_weight_kg", { precision: 8, scale: 2 }), // Minimum typical weight
  maxWeightKg: decimal("max_weight_kg", { precision: 8, scale: 2 }), // Maximum typical weight
  avgVolumeM3: decimal("avg_volume_m3", { precision: 8, scale: 3 }), // Average volume in cubic meters
  minVolumeM3: decimal("min_volume_m3", { precision: 8, scale: 3 }), // Minimum typical volume
  maxVolumeM3: decimal("max_volume_m3", { precision: 8, scale: 3 }), // Maximum typical volume
  estDensityKgPerM3: decimal("est_density_kg_per_m3", { precision: 8, scale: 2 }), // Estimated density (kg/m³)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Truck types - preset truck configurations for pricing
export const truckTypes = pgTable("truck_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "0.75 Ton", "1.5 Ton"
  nameEs: text("name_es").notNull(),
  capacityTons: decimal("capacity_tons", { precision: 5, scale: 2 }).notNull(), // 0.75, 1.5, 2.5, 3.5, 5, 10
  capacityKg: integer("capacity_kg").notNull(), // 750, 1500, 2500, 3500, 5000, 10000
  // Volume capacity fields for volume-based quoting
  capacityM3: decimal("capacity_m3", { precision: 6, scale: 2 }), // Estimated volume capacity in cubic meters
  capacityM3Low: decimal("capacity_m3_low", { precision: 6, scale: 2 }), // Low estimate for volume capacity
  capacityM3High: decimal("capacity_m3_high", { precision: 6, scale: 2 }), // High estimate for volume capacity
  usableVolumeFactor: decimal("usable_volume_factor", { precision: 4, scale: 2 }).default('0.85'), // Factor for usable volume (accounts for stacking efficiency)
  includedMovers: integer("included_movers").notNull().default(2), // Number of movers included
  baseServiceHours: decimal("base_service_hours", { precision: 4, scale: 1 }).notNull().default('3.0'), // Base hours including commute
  baseRate: decimal("base_rate", { precision: 10, scale: 2 }).notNull(), // Base price for this truck
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(), // Additional hourly rate
  perKmRate: decimal("per_km_rate", { precision: 10, scale: 2 }).notNull(), // Rate per km for distance
  extraMoverRate: decimal("extra_mover_rate", { precision: 10, scale: 2 }).default('200.00'), // Cost per additional mover
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Inventory rooms for Clara AI - configurable standardized list
export const inventoryRooms = pgTable("inventory_rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // e.g., "sala", "comedor", "cocina"
  labelEs: text("label_es").notNull(), // Spanish display name
  labelEn: text("label_en").notNull(), // English display name
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Inventory category keywords - for CSV/document parsing category inference
export const inventoryCategoryKeywords = pgTable("inventory_category_keywords", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryKey: text("category_key").notNull(), // References inventoryCategories.key (sofas, beds, boxes, etc.)
  keyword: text("keyword").notNull(), // The keyword to match (e.g., "caja", "carton", "box")
  language: text("language").notNull().default('es'), // 'es' or 'en'
  priority: integer("priority").default(0), // Higher priority = checked first
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_category_keywords_category").on(table.categoryKey),
  index("idx_category_keywords_keyword").on(table.keyword),
]);

// Inventory room keywords - for CSV/document parsing room inference
export const inventoryRoomKeywords = pgTable("inventory_room_keywords", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  roomKey: text("room_key").notNull(), // References inventoryRooms.key (sala, comedor, cocina, etc.)
  keyword: text("keyword").notNull(), // The keyword to match (e.g., "living", "estancia")
  language: text("language").notNull().default('es'), // 'es' or 'en'
  priority: integer("priority").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_room_keywords_room").on(table.roomKey),
  index("idx_room_keywords_keyword").on(table.keyword),
]);

export type InventoryCategoryKeyword = typeof inventoryCategoryKeywords.$inferSelect;
export type InsertInventoryCategoryKeyword = typeof inventoryCategoryKeywords.$inferInsert;
export type InventoryRoomKeyword = typeof inventoryRoomKeywords.$inferSelect;
export type InsertInventoryRoomKeyword = typeof inventoryRoomKeywords.$inferInsert;

export type InventoryCategory = typeof inventoryCategories.$inferSelect;
export type InsertInventoryCategory = typeof inventoryCategories.$inferInsert;
export type InventoryRoom = typeof inventoryRooms.$inferSelect;
export type InsertInventoryRoom = typeof inventoryRooms.$inferInsert;
export type TruckType = typeof truckTypes.$inferSelect;
export type InsertTruckType = typeof truckTypes.$inferInsert;
export type QuoteDocument = typeof quoteDocuments.$inferSelect;
export type InsertQuoteDocument = typeof quoteDocuments.$inferInsert;

// Canonical inventory catalog - unique items for visual picker and AI
export const inventoryCatalogItems = pgTable("inventory_catalog_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // e.g., "sala-sofa_grande"
  nameEn: text("name_en").notNull(),
  nameEs: text("name_es").notNull(),
  roomKey: text("room_key").notNull(), // Reference to inventory room key
  categoryKey: text("category_key").notNull(), // Reference to inventory category key
  iconKey: text("icon_key").default('box'), // Icon identifier for display
  estimatedWeightKg: decimal("estimated_weight_kg", { precision: 8, scale: 2 }),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InventoryCatalogItem = typeof inventoryCatalogItems.$inferSelect;
export type InsertInventoryCatalogItem = typeof inventoryCatalogItems.$inferInsert;
export const insertInventoryCatalogItemSchema = createInsertSchema(inventoryCatalogItems).omit({ id: true, createdAt: true });

// Preset inventory sets - sample inventories for different home sizes
export const presetInventorySets = pgTable("preset_inventory_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // e.g., "studio", "1br", "2br", "3br", "4br"
  titleEs: text("title_es").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionEs: text("description_es"),
  descriptionEn: text("description_en"),
  homeSize: text("home_size").notNull(), // studio, 1br, 2br, 3br, 4br
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  generatedViaAi: boolean("generated_via_ai").default(false),
  aiPrompt: text("ai_prompt"), // Store the AI prompt used to generate
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Preset inventory items - items within a preset set
export const presetInventoryItems = pgTable("preset_inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  presetSetId: varchar("preset_set_id").notNull().references(() => presetInventorySets.id, { onDelete: 'cascade' }),
  itemName: text("item_name").notNull(),
  itemNameEs: text("item_name_es").notNull(),
  roomKey: text("room_key").notNull(), // Reference to inventory room key
  categoryKey: text("category_key").notNull(), // Reference to inventory category key
  defaultQuantity: integer("default_quantity").notNull().default(1),
  notes: text("notes"),
  sortOrder: integer("sort_order").default(0),
});

export type PresetInventorySet = typeof presetInventorySets.$inferSelect;
export type InsertPresetInventorySet = typeof presetInventorySets.$inferInsert;
export type PresetInventoryItem = typeof presetInventoryItems.$inferSelect;
export type InsertPresetInventoryItem = typeof presetInventoryItems.$inferInsert;

// Relations for preset inventories
export const presetInventorySetsRelations = relations(presetInventorySets, ({ many }) => ({
  items: many(presetInventoryItems),
}));

export const presetInventoryItemsRelations = relations(presetInventoryItems, ({ one }) => ({
  presetSet: one(presetInventorySets, {
    fields: [presetInventoryItems.presetSetId],
    references: [presetInventorySets.id],
  }),
}));

// AI Agent configuration
export const aiAgentConfig = pgTable("ai_agent_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().default('Clara'),
  greeting: text("greeting").notNull(),
  greetingEs: text("greeting_es").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  systemPromptEs: text("system_prompt_es"), // Spanish version of system prompt
  mission: text("mission"), // Agent's purpose/mission statement
  missionEs: text("mission_es"),
  guardrails: text("guardrails"), // Safety rules and restrictions
  guardrailsEs: text("guardrails_es"),
  inventoryRules: text("inventory_rules"), // Rules for inventory collection
  inventoryRulesEs: text("inventory_rules_es"),
  costEstimationRules: text("cost_estimation_rules"), // Rules for cost estimation
  costEstimationRulesEs: text("cost_estimation_rules_es"),
  // File processing prompts - templates for AI to analyze uploads (use {{CATEGORIES}}, {{ROOMS}}, {{CATALOG}} placeholders)
  imageAnalysisPrompt: text("image_analysis_prompt"), // Prompt for analyzing images/video frames
  imageAnalysisPromptEs: text("image_analysis_prompt_es"),
  documentParsePrompt: text("document_parse_prompt"), // Prompt for parsing documents/audio transcriptions
  documentParsePromptEs: text("document_parse_prompt_es"),
  // Prompt consistency tracking - JSONB object tracking which prompt pairs are consistent
  // Keys: greeting, systemPrompt, mission, guardrails, inventoryRules, imageAnalysisPrompt, documentParsePrompt
  // Values: true (consistent) or false (not consistent)
  promptConsistency: jsonb("prompt_consistency").$type<Record<string, boolean>>().default({}),
  baseCostPerKm: decimal("base_cost_per_km", { precision: 10, scale: 2 }).default('5.00'),
  baseCostPerItem: decimal("base_cost_per_item", { precision: 10, scale: 2 }).default('50.00'),
  laborCostPerHour: decimal("labor_cost_per_hour", { precision: 10, scale: 2 }).default('200.00'),
  model: text("model").default('claude-sonnet-4-6'),
  temperature: decimal("temperature", { precision: 2, scale: 1 }).default('0.7'),
  maxTokens: integer("max_tokens").default(2048),
  active: boolean("active").default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// AI Models - available AI models for the platform (OpenAI, Anthropic, Google, xAI, etc.)
export const aiModels = pgTable("ai_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  modelId: text("model_id").notNull().unique(), // API identifier (e.g., "claude-sonnet-4-6", "gpt-5", "gemini-pro")
  name: text("name").notNull(), // Display name (e.g., "Claude Sonnet 4.6", "GPT-5")
  provider: text("provider").notNull(), // Provider name (OpenAI, Anthropic, Google, xAI, etc.)
  description: text("description"), // Brief description of model capabilities
  descriptionEs: text("description_es"), // Spanish description
  capabilities: jsonb("capabilities").$type<string[]>().default([]), // ["text", "vision", "reasoning", etc.]
  isVisionCapable: boolean("is_vision_capable").default(false),
  isReasoningModel: boolean("is_reasoning_model").default(false),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ai_models_provider").on(table.provider),
  index("idx_ai_models_active").on(table.isActive),
]);

export const insertAiModelSchema = createInsertSchema(aiModels).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiModel = z.infer<typeof insertAiModelSchema>;
export type AiModel = typeof aiModels.$inferSelect;

// Pricing templates - global default pricing configurations
export const pricingTemplates = pgTable("pricing_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // e.g., "Default", "Premium", "Economy"
  nameEs: text("name_es").notNull(),
  description: text("description"),
  descriptionEs: text("description_es"),
  currency: text("currency").notNull().default('MXN'), // ISO 4217 currency code
  baseCostPerKm: decimal("base_cost_per_km", { precision: 10, scale: 2 }).notNull().default('5.00'),
  baseCostPerItem: decimal("base_cost_per_item", { precision: 10, scale: 2 }).notNull().default('50.00'),
  laborCostPerHour: decimal("labor_cost_per_hour", { precision: 10, scale: 2 }).notNull().default('200.00'),
  // Category-specific pricing multipliers (optional)
  largeFurnitureMultiplier: decimal("large_furniture_multiplier", { precision: 4, scale: 2 }).default('1.50'),
  fragileItemMultiplier: decimal("fragile_item_multiplier", { precision: 4, scale: 2 }).default('1.25'),
  floorSurchargePercent: decimal("floor_surcharge_percent", { precision: 4, scale: 2 }).default('10.00'),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Countries - countries where service is available
export const countries = pgTable("countries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // ISO 3166-1 alpha-2 (e.g., "MX", "CO", "AR")
  name: text("name").notNull(), // English name
  nameEs: text("name_es").notNull(), // Spanish name
  currency: text("currency").notNull(), // ISO 4217 (e.g., "MXN", "COP", "ARS")
  currencySymbol: text("currency_symbol").notNull().default('$'),
  pricingTemplateId: varchar("pricing_template_id").references(() => pricingTemplates.id),
  // Optional country-specific overrides (null = use template values)
  baseCostPerKm: decimal("base_cost_per_km", { precision: 10, scale: 2 }),
  baseCostPerItem: decimal("base_cost_per_item", { precision: 10, scale: 2 }),
  laborCostPerHour: decimal("labor_cost_per_hour", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_countries_code").on(table.code),
]);

// Cities - cities within countries with optional pricing overrides
export const cities = pgTable("cities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  countryId: varchar("country_id").notNull().references(() => countries.id, { onDelete: 'cascade' }),
  name: text("name").notNull(), // City name (usually same in both languages)
  nameEs: text("name_es"), // Spanish name if different
  state: text("state"), // State/Province name
  stateCode: text("state_code"), // State abbreviation (e.g., "CDMX", "NL", "JAL")
  // Optional city-specific overrides (null = use country values)
  baseCostPerKm: decimal("base_cost_per_km", { precision: 10, scale: 2 }),
  baseCostPerItem: decimal("base_cost_per_item", { precision: 10, scale: 2 }),
  laborCostPerHour: decimal("labor_cost_per_hour", { precision: 10, scale: 2 }),
  // General pricing - applies to all trucks in this city
  timezone: text("timezone"), // City's timezone for scheduling and display (null = use country default)
  extraMoverRate: decimal("extra_mover_rate", { precision: 10, scale: 2 }).default('200.00'), // Cost per additional mover
  moverHourlyRate: decimal("mover_hourly_rate", { precision: 10, scale: 2 }).default('150.00'), // Fee per hour per mover
  complicatedMoveMultiplier: decimal("complicated_move_multiplier", { precision: 4, scale: 2 }).default('1.30'), // Multiplier for stairs, difficult access (e.g., 1.30 = 30% extra)
  defaultDistanceKm: decimal("default_distance_km", { precision: 10, scale: 2 }).default('20.00'), // Default distance when Google Maps unavailable
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_cities_country").on(table.countryId),
  index("idx_cities_name").on(table.name),
]);

// City truck pricing - pricing for each truck type within a city
// This is the AUTHORITATIVE source for all pricing - truck_types only has specs (weight/volume)
export const cityTruckPricing = pgTable("city_truck_pricing", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cityId: varchar("city_id").notNull().references(() => cities.id, { onDelete: 'cascade' }),
  truckTypeId: varchar("truck_type_id").notNull().references(() => truckTypes.id, { onDelete: 'cascade' }),
  baseRate: decimal("base_rate", { precision: 10, scale: 2 }).notNull(), // Base price for this truck in this city
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(), // Additional hourly rate for the service
  perKmRate: decimal("per_km_rate", { precision: 10, scale: 2 }).notNull(), // Rate per km for distance
  baseServiceHours: decimal("base_service_hours", { precision: 4, scale: 1 }).notNull().default('3.0'), // Base hours included in base rate
  includedMovers: integer("included_movers").notNull().default(2), // Number of movers included in base rate
  // usableVolumeFactor is a truck spec (on truck_types), not a city pricing field
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_city_truck_pricing_city").on(table.cityId),
  index("idx_city_truck_pricing_truck").on(table.truckTypeId),
]);

export type CityTruckPricing = typeof cityTruckPricing.$inferSelect;
export type InsertCityTruckPricing = typeof cityTruckPricing.$inferInsert;

// Pricing formula parameters - editable global parameters for quote calculation
export const pricingFormulaParameters = pgTable("pricing_formula_parameters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // e.g., "defaultDistanceKm", "extraHoursBufferPercent"
  value: decimal("value", { precision: 10, scale: 4 }).notNull(),
  labelEn: text("label_en").notNull(),
  labelEs: text("label_es").notNull(),
  descriptionEn: text("description_en"),
  descriptionEs: text("description_es"),
  unit: text("unit"), // e.g., "km", "%", "hours"
  minValue: decimal("min_value", { precision: 10, scale: 4 }),
  maxValue: decimal("max_value", { precision: 10, scale: 4 }),
  category: text("category").default('general'), // 'general', 'distance', 'time', 'ai'
  sortOrder: integer("sort_order").default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export type PricingFormulaParameter = typeof pricingFormulaParameters.$inferSelect;
export type InsertPricingFormulaParameter = typeof pricingFormulaParameters.$inferInsert;

// AI pricing prompts - versioned AI instructions for cost estimation
export const aiPricingPrompts = pgTable("ai_pricing_prompts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  scope: text("scope").notNull().default('global'), // 'global' or city-specific
  scopeId: varchar("scope_id"), // null for global, city ID for city-specific
  name: text("name").notNull(), // e.g., "Main Estimation Prompt"
  content: text("content").notNull(), // The prompt text
  contentEs: text("content_es"), // Spanish version
  versionTag: text("version_tag"), // e.g., "v1.0", "v1.1"
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export type AiPricingPrompt = typeof aiPricingPrompts.$inferSelect;
export type InsertAiPricingPrompt = typeof aiPricingPrompts.$inferInsert;

// Relations for pricing hierarchy
export const pricingTemplatesRelations = relations(pricingTemplates, ({ many }) => ({
  countries: many(countries),
}));

export const countriesRelations = relations(countries, ({ one, many }) => ({
  pricingTemplate: one(pricingTemplates, {
    fields: [countries.pricingTemplateId],
    references: [pricingTemplates.id],
  }),
  cities: many(cities),
}));

export const citiesRelations = relations(cities, ({ one }) => ({
  country: one(countries, {
    fields: [cities.countryId],
    references: [countries.id],
  }),
}));

// Website configuration
export const websiteConfig = pgTable("website_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  siteName: text("site_name").default('U-Storage Go'),
  domain: text("domain").default('ustoragego.com'),
  primaryColor: text("primary_color").default('#0E3A49'),
  secondaryColor: text("secondary_color").default('#627685'),
  accentColor: text("accent_color").default('#4FA2B7'),
  logoUrl: text("logo_url"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  metaDescription: text("meta_description"),
  metaDescriptionEs: text("meta_description_es"),
  maintenanceMode: boolean("maintenance_mode").default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Platform secrets - for admin-configurable API keys (takes precedence over env vars)
export const platformSecrets = pgTable("platform_secrets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(), // e.g., 'stripe_secret_key', 'stripe_publishable_key'
  value: text("value").notNull(), // The encrypted/stored value
  provider: text("provider").notNull(), // e.g., 'stripe', 'openai', etc.
  description: text("description"),
  lastUpdatedBy: varchar("last_updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Stripe profiles - multiple Stripe accounts that can be switched
export const stripeProfiles = pgTable("stripe_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // Friendly name like "U-Storage Go Principal", "Cuenta MX", etc.
  // Sandbox/Test keys
  sandboxSecretKey: text("sandbox_secret_key"), // sk_test_...
  sandboxPublishableKey: text("sandbox_publishable_key"), // pk_test_...
  // Production/Live keys
  liveSecretKey: text("live_secret_key"), // sk_live_...
  livePublishableKey: text("live_publishable_key"), // pk_live_...
  // Legacy fields (kept for backward compatibility during migration)
  secretKey: text("secret_key"), // deprecated - use sandboxSecretKey or liveSecretKey
  publishableKey: text("publishable_key"), // deprecated - use sandboxPublishableKey or livePublishableKey
  // Current active mode for this profile
  activeMode: text("active_mode").notNull().default('sandbox'), // 'live' or 'sandbox'
  mode: text("mode").default('sandbox'), // deprecated - kept for migration
  accountId: text("account_id"), // Stripe account ID (retrieved from API)
  accountName: text("account_name"), // Business name from Stripe
  isActive: boolean("is_active").default(false).notNull(), // Only one can be active
  createdBy: varchar("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  // Partial unique index: only one profile can have isActive=true
  index("idx_stripe_profiles_active").on(table.isActive).where(sql`is_active = true`),
]);

// Pricing fallback defaults - used when city/truck values are missing
export const pricingDefaults = pgTable("pricing_defaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Truck pricing defaults
  truckBaseRate: decimal("truck_base_rate", { precision: 10, scale: 2 }).default('1800.00'),
  truckHourlyRate: decimal("truck_hourly_rate", { precision: 10, scale: 2 }).default('300.00'),
  truckPerKmRate: decimal("truck_per_km_rate", { precision: 10, scale: 2 }).default('10.00'),
  truckBaseServiceHours: decimal("truck_base_service_hours", { precision: 4, scale: 1 }).default('3.0'),
  truckIncludedMovers: integer("truck_included_movers").default(2),
  truckUsableVolumeFactor: decimal("truck_usable_volume_factor", { precision: 4, scale: 2 }).default('0.85'),
  // City-level defaults
  moverHourlyRate: decimal("mover_hourly_rate", { precision: 10, scale: 2 }).default('150.00'),
  complicatedMoveMultiplier: decimal("complicated_move_multiplier", { precision: 4, scale: 2 }).default('1.30'),
  defaultDistanceKm: decimal("default_distance_km", { precision: 10, scale: 2 }).default('20.00'),
  floorSurchargePercent: decimal("floor_surcharge_percent", { precision: 5, scale: 2 }).default('10.00'),
  defaultCurrency: text("default_currency").default('MXN'),
  // Inventory category defaults
  categoryAvgWeightKg: decimal("category_avg_weight_kg", { precision: 10, scale: 2 }).default('20.00'),
  categoryAvgVolumeM3: decimal("category_avg_volume_m3", { precision: 10, scale: 3 }).default('0.500'),
  // Metadata
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export type PricingDefaults = typeof pricingDefaults.$inferSelect;
export type InsertPricingDefaults = typeof pricingDefaults.$inferInsert;

// Email sender addresses - available email addresses for sending
export const emailSenders = pgTable("email_senders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  displayName: text("display_name").notNull(), // e.g., "Clara", "Soporte U-Storage Go"
  email: text("email").notNull().unique(), // e.g., "hola@ustoragego.com"
  isDefault: boolean("is_default").default(false), // Only one can be default
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_senders_email").on(table.email),
  index("idx_email_senders_default").on(table.isDefault),
]);

// Email/Communications configuration
export const emailConfig = pgTable("email_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").default('gmail'), // 'gmail', 'sendgrid', 'resend', 'smtp'
  isConfigured: boolean("is_configured").default(false),
  defaultSenderId: varchar("default_sender_id").references(() => emailSenders.id), // Reference to default sender
  senderName: text("sender_name").default('U-Storage Go'), // Legacy field
  senderEmail: text("sender_email"), // Legacy field
  replyToEmail: text("reply_to_email"),
  // Email category toggles
  functionalEmailsEnabled: boolean("functional_emails_enabled").default(true), // Password reset, confirmations
  transactionalEmailsEnabled: boolean("transactional_emails_enabled").default(true), // Quote updates, bid notifications
  marketingEmailsEnabled: boolean("marketing_emails_enabled").default(false), // Promotions, newsletters
  // Provider-specific settings stored as JSON
  providerSettings: jsonb("provider_settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Email templates for different notification types
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateKey: text("template_key").notNull().unique(), // e.g., 'password_reset', 'quote_received', 'bid_accepted'
  nameEn: text("name_en"), // Human readable template name in English
  nameEs: text("name_es"), // Human readable template name in Spanish
  category: text("category").notNull(), // 'functional', 'transactional', 'marketing'
  channel: text("channel").default('email').notNull(), // 'email' or 'whatsapp'
  sendMode: text("send_mode").default('manual'), // 'manual', 'automated', 'both'
  triggerId: varchar("trigger_id"), // Link to trigger event (optional)
  senderId: varchar("sender_id").references(() => emailSenders.id), // Link to sender address
  subjectEn: text("subject_en").notNull(),
  subjectEs: text("subject_es").notNull(),
  bodyHtmlEn: text("body_html_en").notNull(),
  bodyHtmlEs: text("body_html_es").notNull(),
  bodyTextEn: text("body_text_en"),
  bodyTextEs: text("body_text_es"),
  twilioContentSid: text("twilio_content_sid"), // Twilio Content Template SID for WhatsApp
  mediaUrl: text("media_url"), // Media attachment URL for WhatsApp messages
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_templates_category").on(table.category),
  index("idx_email_templates_channel").on(table.channel),
  index("idx_email_templates_sender").on(table.senderId),
  index("idx_email_templates_send_mode").on(table.sendMode),
]);

// Email campaigns for scheduled/targeted email sends
export const emailCampaigns = pgTable("email_campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull().default('marketing'), // 'functional', 'transactional', 'marketing'
  channel: text("channel").default('email').notNull(), // 'email' or 'whatsapp'
  templateId: varchar("template_id").references(() => emailTemplates.id),
  senderId: varchar("sender_id").references(() => emailSenders.id),
  status: text("status").notNull().default('draft'), // 'draft', 'scheduled', 'running', 'completed', 'paused'
  targetSegment: text("target_segment"), // 'all_users', 'clients', 'movers', 'inactive_users', etc.
  scheduledAt: timestamp("scheduled_at"), // When to send (null = manual trigger)
  lastRunAt: timestamp("last_run_at"),
  recipientCount: integer("recipient_count").default(0),
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0), // WhatsApp delivery confirmations
  readCount: integer("read_count").default(0), // WhatsApp read receipts
  openCount: integer("open_count").default(0),
  clickCount: integer("click_count").default(0),
  failedCount: integer("failed_count").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_campaigns_status").on(table.status),
  index("idx_email_campaigns_channel").on(table.channel),
  index("idx_email_campaigns_scheduled").on(table.scheduledAt),
]);

// Email event types catalog - available events that can trigger emails
export const emailEventTypes = pgTable("email_event_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventKey: text("event_key").notNull().unique(), // e.g., 'user.registered', 'quote.created'
  nameEn: text("name_en").notNull(),
  nameEs: text("name_es").notNull(),
  descriptionEn: text("description_en"),
  descriptionEs: text("description_es"),
  category: text("category").notNull().default('system'), // 'user', 'quote', 'bid', 'admin', 'system'
  defaultRecipientType: text("default_recipient_type").notNull().default('user'), // 'user', 'admin', 'mover', 'client'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_event_types_key").on(table.eventKey),
  index("idx_email_event_types_category").on(table.category),
]);

// Email triggers - links database events to email templates
export const emailTriggers = pgTable("email_triggers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventTypeId: varchar("event_type_id").references(() => emailEventTypes.id), // Reference to event type
  eventKey: text("event_key").notNull(), // e.g., 'user.registered', 'quote.created', 'bid.submitted'
  eventNameEn: text("event_name_en").notNull(), // Human readable event name
  eventNameEs: text("event_name_es").notNull(),
  eventDescriptionEn: text("event_description_en"),
  eventDescriptionEs: text("event_description_es"),
  channel: text("channel").default('email').notNull(), // 'email' or 'whatsapp'
  templateId: varchar("template_id").references(() => emailTemplates.id),
  isEnabled: boolean("is_enabled").default(true),
  delayMinutes: integer("delay_minutes").default(0), // Optional delay before sending
  recipientType: text("recipient_type").notNull().default('user'), // 'user', 'admin', 'mover', 'client'
  metadata: jsonb("metadata"), // Additional trigger-specific configuration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_triggers_event").on(table.eventKey),
  index("idx_email_triggers_channel").on(table.channel),
  index("idx_email_triggers_template").on(table.templateId),
  index("idx_email_triggers_event_type").on(table.eventTypeId),
]);

// Email send log for tracking and debugging
export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateKey: text("template_key"),
  channel: text("channel").default('email').notNull(), // 'email' or 'whatsapp'
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"), // Phone number for WhatsApp messages
  recipientUserId: varchar("recipient_user_id").references(() => users.id),
  subject: text("subject").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default('pending'), // 'pending', 'sent', 'failed', 'delivered', 'bounced', 'read' (WhatsApp)
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"), // WhatsApp delivery confirmation
  readAt: timestamp("read_at"), // WhatsApp read receipt
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_logs_recipient").on(table.recipientEmail),
  index("idx_email_logs_channel").on(table.channel),
  index("idx_email_logs_status").on(table.status),
  index("idx_email_logs_created").on(table.createdAt),
]);

// Saved addresses for clients
export const savedAddresses = pgTable("saved_addresses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  companyId: varchar("company_id").references(() => companies.id, { onDelete: "set null" }),
  label: text("label").notNull(), // 'Home', 'Office', etc.
  fullAddress: text("full_address").notNull(),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  country: text("country").default('Mexico'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  quotes: many(quotes),
  moverProfile: one(moverProfiles, {
    fields: [users.id],
    references: [moverProfiles.userId],
  }),
  savedAddresses: many(savedAddresses),
  roles: many(userRoles),
  activityLogs: many(activityLogs),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
  grantedByUser: one(users, {
    fields: [userRoles.grantedBy],
    references: [users.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const quotesRelations = relations(quotes, ({ one, many }) => ({
  user: one(users, {
    fields: [quotes.userId],
    references: [users.id],
  }),
  assignedMover: one(moverProfiles, {
    fields: [quotes.assignedMoverProfileId],
    references: [moverProfiles.id],
  }),
  inventoryItems: many(inventoryItems),
  quoteServices: many(quoteServices),
  quoteAddOns: many(quoteAddOns),
  invitations: many(quoteInvitations),
  bids: many(quoteBids),
  statusHistory: many(quoteStatusHistory),
}));

export const quoteInvitationsRelations = relations(quoteInvitations, ({ one, many }) => ({
  quote: one(quotes, {
    fields: [quoteInvitations.quoteId],
    references: [quotes.id],
  }),
  moverProfile: one(moverProfiles, {
    fields: [quoteInvitations.moverProfileId],
    references: [moverProfiles.id],
  }),
  inviter: one(users, {
    fields: [quoteInvitations.invitedBy],
    references: [users.id],
  }),
  bids: many(quoteBids),
}));

export const quoteBidsRelations = relations(quoteBids, ({ one }) => ({
  invitation: one(quoteInvitations, {
    fields: [quoteBids.invitationId],
    references: [quoteInvitations.id],
  }),
  quote: one(quotes, {
    fields: [quoteBids.quoteId],
    references: [quotes.id],
  }),
  moverProfile: one(moverProfiles, {
    fields: [quoteBids.moverProfileId],
    references: [moverProfiles.id],
  }),
}));

export const quoteStatusHistoryRelations = relations(quoteStatusHistory, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteStatusHistory.quoteId],
    references: [quotes.id],
  }),
}));

export const quoteActivityLogRelations = relations(quoteActivityLog, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteActivityLog.quoteId],
    references: [quotes.id],
  }),
}));

export const inventoryItemsRelations = relations(inventoryItems, ({ one }) => ({
  quote: one(quotes, {
    fields: [inventoryItems.quoteId],
    references: [quotes.id],
  }),
}));

export const servicesRelations = relations(services, ({ many }) => ({
  quoteServices: many(quoteServices),
}));

export const addOnsRelations = relations(addOns, ({ many }) => ({
  quoteAddOns: many(quoteAddOns),
}));

export const quoteServicesRelations = relations(quoteServices, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteServices.quoteId],
    references: [quotes.id],
  }),
  service: one(services, {
    fields: [quoteServices.serviceId],
    references: [services.id],
  }),
}));

export const quoteAddOnsRelations = relations(quoteAddOns, ({ one }) => ({
  quote: one(quotes, {
    fields: [quoteAddOns.quoteId],
    references: [quotes.id],
  }),
  addOn: one(addOns, {
    fields: [quoteAddOns.addOnId],
    references: [addOns.id],
  }),
}));

export const moverProfilesRelations = relations(moverProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [moverProfiles.userId],
    references: [users.id],
  }),
  invitations: many(quoteInvitations),
  bids: many(quoteBids),
  assignedQuotes: many(quotes),
}));

export const savedAddressesRelations = relations(savedAddresses, ({ one }) => ({
  user: one(users, {
    fields: [savedAddresses.userId],
    references: [users.id],
  }),
}));

// ===========================================
// RATING AND FEEDBACK SYSTEM
// ===========================================

// Rating categories for excellence
export const RATING_EXCELLENCE_CATEGORIES = {
  PUNCTUALITY: 'punctuality',           // On-time arrival
  CARE_OF_ITEMS: 'care_of_items',       // Careful handling
  PROFESSIONALISM: 'professionalism',   // Professional behavior
  COMMUNICATION: 'communication',        // Clear communication
  VALUE: 'value',                        // Good value for money
  SPEED: 'speed',                        // Efficient work
  CLEANLINESS: 'cleanliness',           // Left place clean
} as const;

// Rating categories for improvement
export const RATING_IMPROVEMENT_CATEGORIES = {
  DELAYS: 'delays',                      // Late arrival or delays
  DAMAGED_ITEMS: 'damaged_items',        // Items were damaged
  POOR_COMMUNICATION: 'poor_communication', // Hard to reach
  UNPROFESSIONAL: 'unprofessional',     // Unprofessional behavior
  HIDDEN_FEES: 'hidden_fees',           // Unexpected charges
  SLOW_SERVICE: 'slow_service',         // Took too long
  MESSY: 'messy',                        // Left mess behind
} as const;

// Rating direction type
export const RATING_DIRECTION = {
  CLIENT_TO_PARTNER: 'client_to_partner',  // Client rates the mover
  PARTNER_TO_CLIENT: 'partner_to_client',  // Mover rates the client
} as const;

// Main ratings table
export const ratings = pgTable("ratings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  raterUserId: varchar("rater_user_id").notNull().references(() => users.id),
  targetUserId: varchar("target_user_id").notNull().references(() => users.id),
  moverProfileId: varchar("mover_profile_id").references(() => moverProfiles.id),
  direction: text("direction").notNull(), // 'client_to_partner' or 'partner_to_client'
  starRating: integer("star_rating").notNull(), // 1-5 stars
  excellenceCategories: text("excellence_categories").array(), // Selected positive categories
  improvementCategories: text("improvement_categories").array(), // Selected negative categories
  submittedVia: text("submitted_via").default('platform'), // 'platform' or 'email'
  emailToken: varchar("email_token"), // Token for email-based submission
  isEdited: boolean("is_edited").default(false),
  editedBy: varchar("edited_by").references(() => users.id), // Super admin who edited
  editedAt: timestamp("edited_at"),
  editReason: text("edit_reason"), // Why the rating was modified
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ratings_quote").on(table.quoteId),
  index("idx_ratings_rater").on(table.raterUserId),
  index("idx_ratings_target").on(table.targetUserId),
  index("idx_ratings_mover_profile").on(table.moverProfileId),
  index("idx_ratings_direction").on(table.direction),
  index("idx_ratings_email_token").on(table.emailToken),
]);

// Rating comments table - supports public/private visibility
export const ratingComments = pgTable("rating_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ratingId: varchar("rating_id").notNull().references(() => ratings.id, { onDelete: 'cascade' }),
  publicComment: text("public_comment"), // Visible to partners
  privateComment: text("private_comment"), // Only visible to admins
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_rating_comments_rating").on(table.ratingId),
]);

// AI-generated tags from comments
export const ratingAiTags = pgTable("rating_ai_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ratingId: varchar("rating_id").notNull().references(() => ratings.id, { onDelete: 'cascade' }),
  tag: text("tag").notNull(), // The tag itself (e.g., "friendly", "late arrival")
  tagEs: text("tag_es"), // Spanish translation
  sentiment: text("sentiment").notNull(), // 'positive', 'negative', 'neutral'
  confidence: decimal("confidence", { precision: 4, scale: 3 }), // AI confidence 0-1
  source: text("source").default('public'), // 'public' or 'private' - which comment it came from
  aiModel: text("ai_model"), // Model used (e.g., 'claude-sonnet-4-6')
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_rating_ai_tags_rating").on(table.ratingId),
  index("idx_rating_ai_tags_sentiment").on(table.sentiment),
  index("idx_rating_ai_tags_tag").on(table.tag),
]);

// Rating requests tracking - for email-based collection
export const ratingRequests = pgTable("rating_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteId: varchar("quote_id").notNull().references(() => quotes.id),
  userId: varchar("user_id").notNull().references(() => users.id), // Who should rate
  targetUserId: varchar("target_user_id").notNull().references(() => users.id), // Who to rate
  direction: text("direction").notNull(), // 'client_to_partner' or 'partner_to_client'
  emailToken: varchar("email_token").notNull().unique(), // Unique token for email link
  emailSentAt: timestamp("email_sent_at"),
  reminderSentAt: timestamp("reminder_sent_at"),
  completedAt: timestamp("completed_at"),
  ratingId: varchar("rating_id").references(() => ratings.id), // Linked after completion
  expiresAt: timestamp("expires_at").notNull(), // Token expiration
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_rating_requests_quote").on(table.quoteId),
  index("idx_rating_requests_user").on(table.userId),
  index("idx_rating_requests_token").on(table.emailToken),
]);

// Relations for ratings
export const ratingsRelations = relations(ratings, ({ one, many }) => ({
  quote: one(quotes, {
    fields: [ratings.quoteId],
    references: [quotes.id],
  }),
  rater: one(users, {
    fields: [ratings.raterUserId],
    references: [users.id],
    relationName: 'raterUser',
  }),
  target: one(users, {
    fields: [ratings.targetUserId],
    references: [users.id],
    relationName: 'targetUser',
  }),
  moverProfile: one(moverProfiles, {
    fields: [ratings.moverProfileId],
    references: [moverProfiles.id],
  }),
  comments: one(ratingComments),
  aiTags: many(ratingAiTags),
}));

export const ratingCommentsRelations = relations(ratingComments, ({ one }) => ({
  rating: one(ratings, {
    fields: [ratingComments.ratingId],
    references: [ratings.id],
  }),
}));

export const ratingAiTagsRelations = relations(ratingAiTags, ({ one }) => ({
  rating: one(ratings, {
    fields: [ratingAiTags.ratingId],
    references: [ratings.id],
  }),
}));

export const ratingRequestsRelations = relations(ratingRequests, ({ one }) => ({
  quote: one(quotes, {
    fields: [ratingRequests.quoteId],
    references: [quotes.id],
  }),
  user: one(users, {
    fields: [ratingRequests.userId],
    references: [users.id],
  }),
  rating: one(ratings, {
    fields: [ratingRequests.ratingId],
    references: [ratings.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertMoverProfileSchema = createInsertSchema(moverProfiles).omit({
  id: true,
  createdAt: true,
  verified: true,
  rating: true,
  totalJobs: true,
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true,
  workflowStatus: true,
  estimatedCost: true,
  suggestedPrice: true,
  finalPrice: true,
  adminNotes: true,
  assignedMoverProfileId: true,
  biddingOpensAt: true,
  biddingClosesAt: true,
  clientConfirmedAt: true,
  serviceMode: true,
  storageBranchId: true,
  storageMoveType: true,
  storageBranchBrand: true,
  storageBranchGooglePlaceId: true,
  storageBranchName: true,
  storageBranchAddress: true,
  storageBranchSnapshot: true,
  eligibilityCheckedAt: true,
  eligibilityVersion: true,
  storageContractStatus: true,
  storageRentalIntent: true,
  storageAvailabilityStatus: true,
  storageSelectedUnitCode: true,
  storageSelectedUnitSnapshot: true,
  storageReservationStatus: true,
  storageAvailabilityCheckedAt: true,
});

export const insertQuoteInvitationSchema = createInsertSchema(quoteInvitations).omit({
  id: true,
  createdAt: true,
  viewedAt: true,
  respondedAt: true,
});

export const insertQuoteBidSchema = createInsertSchema(quoteBids).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
});

export const insertQuoteStatusHistorySchema = createInsertSchema(quoteStatusHistory).omit({
  id: true,
  createdAt: true,
});

export const insertPartnerStatusHistorySchema = createInsertSchema(partnerStatusHistory).omit({
  id: true,
  createdAt: true,
});

export const insertQuoteActivityLogSchema = createInsertSchema(quoteActivityLog).omit({
  id: true,
  createdAt: true,
});

export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({
  id: true,
});

export const insertServiceSchema = createInsertSchema(services).omit({
  id: true,
  createdAt: true,
});

export const insertAddOnSchema = createInsertSchema(addOns).omit({
  id: true,
  createdAt: true,
});

export const insertAiAgentConfigSchema = createInsertSchema(aiAgentConfig).omit({
  id: true,
  updatedAt: true,
});

export const insertWebsiteConfigSchema = createInsertSchema(websiteConfig).omit({
  id: true,
  updatedAt: true,
});

export const insertPlatformSecretSchema = createInsertSchema(platformSecrets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertStripeProfileSchema = createInsertSchema(stripeProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedAddressSchema = createInsertSchema(savedAddresses).omit({
  id: true,
  createdAt: true,
});

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true,
  grantedAt: true,
});

export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({
  id: true,
  createdAt: true,
});

export const insertEmailSenderSchema = createInsertSchema(emailSenders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailConfigSchema = createInsertSchema(emailConfig).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailCampaignSchema = createInsertSchema(emailCampaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertEmailLogSchema = createInsertSchema(emailLogs).omit({
  id: true,
  createdAt: true,
});

export const insertEmailEventTypeSchema = createInsertSchema(emailEventTypes).omit({
  id: true,
  createdAt: true,
});

export const insertEmailTriggerSchema = createInsertSchema(emailTriggers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAdminPermissionsSchema = createInsertSchema(adminPermissions).omit({
  id: true,
  updatedAt: true,
});

export const insertAdminAccessRequestSchema = createInsertSchema(adminAccessRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPricingTemplateSchema = createInsertSchema(pricingTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCountrySchema = createInsertSchema(countries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCitySchema = createInsertSchema(cities).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertQuoteDocumentSchema = createInsertSchema(quoteDocuments).omit({
  id: true,
  createdAt: true,
});

// Rating system insert schemas
export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isEdited: true,
  editedBy: true,
  editedAt: true,
  editReason: true,
});

export const insertRatingCommentSchema = createInsertSchema(ratingComments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRatingAiTagSchema = createInsertSchema(ratingAiTags).omit({
  id: true,
  createdAt: true,
});

export const insertRatingRequestSchema = createInsertSchema(ratingRequests).omit({
  id: true,
  createdAt: true,
  emailSentAt: true,
  reminderSentAt: true,
  completedAt: true,
  ratingId: true,
});

// Export types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

export type InsertMoverProfile = z.infer<typeof insertMoverProfileSchema>;
export type MoverProfile = typeof moverProfiles.$inferSelect;
export type PartnerCompany = MoverProfile;
export const insertPartnerCompanyMembershipSchema = createInsertSchema(partnerCompanyMemberships);
export type InsertPartnerCompanyMembership = z.infer<typeof insertPartnerCompanyMembershipSchema>;
export type PartnerCompanyMembership = typeof partnerCompanyMemberships.$inferSelect;

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;

export type InsertService = z.infer<typeof insertServiceSchema>;
export type Service = typeof services.$inferSelect;

export type InsertAddOn = z.infer<typeof insertAddOnSchema>;
export type AddOn = typeof addOns.$inferSelect;

export type InsertAiAgentConfig = z.infer<typeof insertAiAgentConfigSchema>;
export type AiAgentConfig = typeof aiAgentConfig.$inferSelect;

export type InsertWebsiteConfig = z.infer<typeof insertWebsiteConfigSchema>;
export type WebsiteConfig = typeof websiteConfig.$inferSelect;

export type InsertPlatformSecret = z.infer<typeof insertPlatformSecretSchema>;
export type PlatformSecret = typeof platformSecrets.$inferSelect;

export type InsertStripeProfile = z.infer<typeof insertStripeProfileSchema>;
export type StripeProfile = typeof stripeProfiles.$inferSelect;

export type InsertSavedAddress = z.infer<typeof insertSavedAddressSchema>;
export type SavedAddress = typeof savedAddresses.$inferSelect;

export type InsertQuoteInvitation = z.infer<typeof insertQuoteInvitationSchema>;
export type QuoteInvitation = typeof quoteInvitations.$inferSelect;

export type InsertQuoteBid = z.infer<typeof insertQuoteBidSchema>;
export type QuoteBid = typeof quoteBids.$inferSelect;

export type InsertQuoteStatusHistory = z.infer<typeof insertQuoteStatusHistorySchema>;
export type QuoteStatusHistory = typeof quoteStatusHistory.$inferSelect;

export type InsertPartnerStatusHistory = z.infer<typeof insertPartnerStatusHistorySchema>;
export type PartnerStatusHistory = typeof partnerStatusHistory.$inferSelect;

export type InsertQuoteActivityLog = z.infer<typeof insertQuoteActivityLogSchema>;
export type QuoteActivityLog = typeof quoteActivityLog.$inferSelect;

export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type UserRole = typeof userRoles.$inferSelect;

export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogs.$inferSelect;

export type InsertEmailSender = z.infer<typeof insertEmailSenderSchema>;
export type EmailSender = typeof emailSenders.$inferSelect;

export type InsertEmailConfig = z.infer<typeof insertEmailConfigSchema>;
export type EmailConfig = typeof emailConfig.$inferSelect;

export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

export type InsertEmailCampaign = z.infer<typeof insertEmailCampaignSchema>;
export type EmailCampaign = typeof emailCampaigns.$inferSelect;

export type InsertEmailLog = z.infer<typeof insertEmailLogSchema>;
export type EmailLog = typeof emailLogs.$inferSelect;

export type InsertEmailEventType = z.infer<typeof insertEmailEventTypeSchema>;
export type EmailEventType = typeof emailEventTypes.$inferSelect;

export type InsertEmailTrigger = z.infer<typeof insertEmailTriggerSchema>;
export type EmailTrigger = typeof emailTriggers.$inferSelect;

export type InsertAdminPermissions = z.infer<typeof insertAdminPermissionsSchema>;
export type AdminPermissions = typeof adminPermissions.$inferSelect;

export type InsertAdminAccessRequest = z.infer<typeof insertAdminAccessRequestSchema>;
export type AdminAccessRequest = typeof adminAccessRequests.$inferSelect;

export type InsertPricingTemplate = z.infer<typeof insertPricingTemplateSchema>;
export type PricingTemplate = typeof pricingTemplates.$inferSelect;

export type InsertCountry = z.infer<typeof insertCountrySchema>;
export type Country = typeof countries.$inferSelect;

export type InsertCity = z.infer<typeof insertCitySchema>;
export type City = typeof cities.$inferSelect;

// Rating system types
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratings.$inferSelect;

export type InsertRatingComment = z.infer<typeof insertRatingCommentSchema>;
export type RatingComment = typeof ratingComments.$inferSelect;

export type InsertRatingAiTag = z.infer<typeof insertRatingAiTagSchema>;
export type RatingAiTag = typeof ratingAiTags.$inferSelect;

export type InsertRatingRequest = z.infer<typeof insertRatingRequestSchema>;
export type RatingRequest = typeof ratingRequests.$inferSelect;

// Rating with full details
export interface RatingWithDetails extends Rating {
  comments?: RatingComment | null;
  aiTags?: RatingAiTag[];
  rater?: User | null;
  target?: User | null;
  moverProfile?: MoverProfile | null;
  quote?: Quote | null;
}

// Partner rating summary for dashboard
export interface PartnerRatingSummary {
  averageRating: number;
  totalRatings: number;
  ratingBreakdown: { stars: number; count: number }[];
  excellenceCategories: { category: string; count: number }[];
  improvementCategories: { category: string; count: number }[];
  recentPositiveTags: { tag: string; tagEs?: string; count: number }[];
  recentNegativeTags: { tag: string; tagEs?: string; count: number }[];
}

// User rating summary (limited view)
export interface UserRatingSummary {
  averageRating: number;
  totalRatings: number;
}

// Truck pricing for a specific city
export interface TruckPricingInfo {
  truckTypeId: string;
  name: string;
  nameEs: string;
  capacityKg: number;
  includedMovers: number;
  baseServiceHours: number;
  baseRate: number;
  hourlyRate: number;
  perKmRate: number;
}

// Resolved pricing for a location (city -> country -> template fallback)
export interface ResolvedPricing {
  currency: string;
  currencySymbol: string;
  // General pricing (applies to all trucks)
  extraMoverRate: number;
  moverHourlyRate: number;
  complicatedMoveMultiplier: number;
  floorSurchargePercent?: number;
  defaultDistanceKm: number; // Default distance when Google Maps unavailable
  // Truck-specific pricing (array of trucks with their rates)
  truckPricing: TruckPricingInfo[];
  source: 'city' | 'country' | 'template' | 'default';
  countryCode?: string;
  cityName?: string;
  cityId?: string;
}

// Quote with full details for admin view
export interface QuoteWithDetails extends Quote {
  user?: User | null;
  creator?: User | null;
  followUpOwner?: User | null;
  inventoryItems?: InventoryItem[];
  quoteServices?: { id: string; service: Service; createdByAdminId?: string | null; followUpOwnerId?: string | null; creator?: User | null; followUpOwner?: User | null }[];
  quoteAddOns?: { addOn: AddOn }[];
  invitations?: (QuoteInvitation & { moverProfile: MoverProfile })[];
  bids?: (QuoteBid & { moverProfile: MoverProfile })[];
  assignedMover?: MoverProfile | null;
}

// SEO Settings table - stores configurable SEO and digital marketing settings
export const seoSettings = pgTable("seo_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Meta tag templates
  defaultTitleTemplate: text("default_title_template").default('{{page}} | U-Storage Go'),
  defaultTitleTemplateEs: text("default_title_template_es").default('{{page}} | U-Storage Go'),
  defaultDescription: text("default_description"),
  defaultDescriptionEs: text("default_description_es"),
  // Social sharing defaults
  defaultOgImage: text("default_og_image"),
  twitterHandle: text("twitter_handle").default('@ustoragego'),
  facebookAppId: text("facebook_app_id"),
  // Structured data settings
  organizationName: text("organization_name").default('U-Storage Go'),
  organizationLogo: text("organization_logo"),
  organizationPhone: text("organization_phone"),
  organizationEmail: text("organization_email"),
  // LLM discoverability
  llmsTxtContent: text("llms_txt_content"),
  llmsFullTxtContent: text("llms_full_txt_content"),
  // robots.txt customization
  robotsTxtCustomRules: text("robots_txt_custom_rules"),
  allowAiCrawlers: boolean("allow_ai_crawlers").default(true),
  // Sitemap settings
  sitemapAutoUpdate: boolean("sitemap_auto_update").default(true),
  sitemapExcludePaths: text("sitemap_exclude_paths").array(),
  // Analytics settings
  googleAnalyticsId: text("google_analytics_id"),
  googleTagManagerId: text("google_tag_manager_id"),
  facebookPixelId: text("facebook_pixel_id"),
  // Timestamps
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const insertSeoSettingsSchema = createInsertSchema(seoSettings).omit({ id: true, updatedAt: true });
export type InsertSeoSettings = z.infer<typeof insertSeoSettingsSchema>;
export type SeoSettings = typeof seoSettings.$inferSelect;

// Marketing Page Views - tracks page visits for analytics
export const marketingPageViews = pgTable("marketing_page_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Page info
  pagePath: text("page_path").notNull(),
  pageTitle: text("page_title"),
  locale: text("locale").default('es'),
  // Attribution data
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmTerm: text("utm_term"),
  utmContent: text("utm_content"),
  partner: text("partner"),
  referrerUrl: text("referrer_url"),
  // Source type classification
  sourceType: text("source_type"), // 'organic', 'paid', 'social', 'email', 'referral', 'ai', 'direct'
  // User info (optional)
  userId: varchar("user_id").references(() => users.id),
  sessionId: text("session_id"),
  userAgent: text("user_agent"),
  ipCountry: text("ip_country"),
  ipCity: text("ip_city"),
  // Timestamp
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_page_views_path").on(table.pagePath),
  index("idx_page_views_created").on(table.createdAt),
  index("idx_page_views_source").on(table.sourceType),
  index("idx_page_views_utm").on(table.utmSource, table.utmMedium, table.utmCampaign),
  index("idx_page_views_partner").on(table.partner),
]);

export const insertMarketingPageViewSchema = createInsertSchema(marketingPageViews).omit({ id: true, createdAt: true });
export type InsertMarketingPageView = z.infer<typeof insertMarketingPageViewSchema>;
export type MarketingPageView = typeof marketingPageViews.$inferSelect;

// Marketing analytics summary interface
export interface MarketingAnalyticsSummary {
  totalPageViews: number;
  uniqueVisitors: number;
  topPages: { path: string; views: number }[];
  sourceBreakdown: { source: string; views: number; percentage: number }[];
  utmPerformance: { campaign: string; source: string; medium: string; views: number; conversions: number }[];
  partnerPerformance: { partner: string; views: number; quotes: number; conversionRate: number }[];
  aiReferrals: { source: string; views: number }[];
  trendData: { date: string; views: number }[];
}

// Quote Workflow Statuses - configurable funnel stages for quote management
export const quoteWorkflowStatuses = pgTable("quote_workflow_statuses", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  labelEs: text("label_es").notNull(),
  labelEn: text("label_en").notNull(),
  description: text("description"),
  descriptionEs: text("description_es"),
  color: text("color").default('#6B7280'),
  bgColor: text("bg_color").default('#F3F4F6'),
  icon: text("icon"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isFinal: boolean("is_final").notNull().default(false),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertQuoteWorkflowStatusSchema = createInsertSchema(quoteWorkflowStatuses).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQuoteWorkflowStatus = z.infer<typeof insertQuoteWorkflowStatusSchema>;
export type QuoteWorkflowStatus = typeof quoteWorkflowStatuses.$inferSelect;

// Document Types schemas
export const insertDocumentTypeSchema = createInsertSchema(documentTypes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDocumentType = z.infer<typeof insertDocumentTypeSchema>;
export type DocumentType = typeof documentTypes.$inferSelect;

// Partner Documents schemas
export const insertPartnerDocumentSchema = createInsertSchema(partnerDocuments).omit({ id: true, uploadedAt: true, updatedAt: true });
export type InsertPartnerDocument = z.infer<typeof insertPartnerDocumentSchema>;
export type PartnerDocument = typeof partnerDocuments.$inferSelect;

// Blog Post Status
export const BLOG_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  SCHEDULED: 'scheduled',
  ARCHIVED: 'archived',
} as const;

// Blog Posts - SEO-optimized bilingual blog entries
export const blogPosts = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // URL and identification
  slug: text("slug").notNull().unique(),
  // Bilingual content
  titleEs: text("title_es").notNull(),
  titleEn: text("title_en").notNull(),
  excerptEs: text("excerpt_es"),
  excerptEn: text("excerpt_en"),
  contentEs: text("content_es").notNull(),
  contentEn: text("content_en").notNull(),
  categoryEs: text("category_es"),
  categoryEn: text("category_en"),
  // Author and attribution
  author: text("author").notNull(),
  authorId: varchar("author_id").references(() => users.id),
  // Media
  heroImage: text("hero_image"),
  heroImageAlt: text("hero_image_alt"),
  // Publishing
  status: text("status").default('draft').notNull(),
  publishedAt: timestamp("published_at"),
  scheduledAt: timestamp("scheduled_at"),
  featured: boolean("featured").default(false),
  estimatedReadMinutes: integer("estimated_read_minutes").default(5),
  // SEO Meta Fields
  metaTitleEs: text("meta_title_es"),
  metaTitleEn: text("meta_title_en"),
  metaDescriptionEs: text("meta_description_es"),
  metaDescriptionEn: text("meta_description_en"),
  focusKeywordsEs: text("focus_keywords_es").array(),
  focusKeywordsEn: text("focus_keywords_en").array(),
  canonicalUrl: text("canonical_url"),
  // Open Graph / Social
  ogTitleEs: text("og_title_es"),
  ogTitleEn: text("og_title_en"),
  ogDescriptionEs: text("og_description_es"),
  ogDescriptionEn: text("og_description_en"),
  ogImage: text("og_image"),
  // Structured Data (JSON-LD)
  structuredData: jsonb("structured_data"),
  // Analytics
  viewCount: integer("view_count").default(0),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: varchar("created_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
}, (table) => [
  index("idx_blog_slug").on(table.slug),
  index("idx_blog_status").on(table.status),
  index("idx_blog_published").on(table.status, table.publishedAt),
  index("idx_blog_featured").on(table.featured),
  index("idx_blog_category_es").on(table.categoryEs),
  index("idx_blog_category_en").on(table.categoryEn),
]);

export const insertBlogPostSchema = createInsertSchema(blogPosts).omit({ id: true, createdAt: true, updatedAt: true, viewCount: true });
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type BlogPost = typeof blogPosts.$inferSelect;

// ========== WHATSAPP / TWILIO INTEGRATION ==========

export const CONVERSATION_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  ARCHIVED: 'archived',
} as const;

export const CONVERSATION_CHANNEL = {
  WHATSAPP: 'whatsapp',
  SMS: 'sms',
} as const;

export const MESSAGE_DIRECTION = {
  INBOUND: 'inbound',
  OUTBOUND: 'outbound',
} as const;

export const MESSAGE_STATUS = {
  QUEUED: 'queued',
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'read',
  FAILED: 'failed',
  UNDELIVERED: 'undelivered',
} as const;

export const whatsappConfig = pgTable("whatsapp_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  whatsappNumber: text("whatsapp_number"),
  isActive: boolean("is_active").default(false).notNull(),
  lastConnectionCheck: timestamp("last_connection_check"),
  connectionStatus: text("connection_status").default('not_configured'),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: varchar("updated_by").references(() => users.id),
});

export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactPhone: text("contact_phone").notNull(),
  contactName: text("contact_name"),
  channel: text("channel").default('whatsapp').notNull(),
  status: text("status").default('open').notNull(),
  userId: varchar("user_id").references(() => users.id),
  moverProfileId: varchar("mover_profile_id").references(() => moverProfiles.id),
  quoteId: varchar("quote_id").references(() => quotes.id),
  assignedAgentId: varchar("assigned_agent_id").references(() => users.id),
  lastMessageAt: timestamp("last_message_at"),
  lastMessagePreview: text("last_message_preview"),
  unreadCount: integer("unread_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_conversations_phone").on(table.contactPhone),
  index("idx_conversations_status").on(table.status),
  index("idx_conversations_user").on(table.userId),
  index("idx_conversations_mover").on(table.moverProfileId),
  index("idx_conversations_quote").on(table.quoteId),
  index("idx_conversations_agent").on(table.assignedAgentId),
  index("idx_conversations_last_msg").on(table.lastMessageAt),
]);

export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  twilioMessageSid: text("twilio_message_sid"),
  direction: text("direction").notNull(),
  senderPhone: text("sender_phone"),
  senderName: text("sender_name"),
  body: text("body"),
  mediaUrls: text("media_urls").array(),
  mediaContentTypes: text("media_content_types").array(),
  status: text("status").default('queued').notNull(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  isTemplate: boolean("is_template").default(false),
  templateName: text("template_name"),
  templateParams: jsonb("template_params"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_messages_conversation").on(table.conversationId),
  index("idx_messages_twilio_sid").on(table.twilioMessageSid),
  index("idx_messages_direction").on(table.direction),
  index("idx_messages_status").on(table.status),
  index("idx_messages_created").on(table.createdAt),
]);

export const conversationAssignments = pgTable("conversation_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  agentId: varchar("agent_id").notNull().references(() => users.id),
  assignedBy: varchar("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  unassignedAt: timestamp("unassigned_at"),
  note: text("note"),
}, (table) => [
  index("idx_conv_assignments_conv").on(table.conversationId),
  index("idx_conv_assignments_agent").on(table.agentId),
]);

export const insertWhatsappConfigSchema = createInsertSchema(whatsappConfig).omit({ id: true, updatedAt: true });
export type InsertWhatsappConfig = z.infer<typeof insertWhatsappConfigSchema>;
export type WhatsappConfig = typeof whatsappConfig.$inferSelect;

export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const insertConversationAssignmentSchema = createInsertSchema(conversationAssignments).omit({ id: true, assignedAt: true });
export type InsertConversationAssignment = z.infer<typeof insertConversationAssignmentSchema>;
export type ConversationAssignment = typeof conversationAssignments.$inferSelect;

// ========== WHATSAPP ADMIN INBOX ==========

export const WHATSAPP_CONVERSATION_STATUS = {
  OPEN: 'open',
  PENDING: 'pending',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
} as const;

export const whatsappConversations = pgTable("whatsapp_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contactPhone: text("contact_phone").notNull(),
  contactName: text("contact_name"),
  status: text("status").default('open').notNull(),
  assignedAgentId: varchar("assigned_agent_id").references(() => users.id),
  linkedUserId: varchar("linked_user_id").references(() => users.id),
  linkedMoverProfileId: varchar("linked_mover_profile_id").references(() => moverProfiles.id),
  linkedQuoteId: varchar("linked_quote_id").references(() => quotes.id),
  lastMessageAt: timestamp("last_message_at"),
  lastMessagePreview: text("last_message_preview"),
  unreadCount: integer("unread_count").default(0).notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_wa_conv_status").on(table.status),
  index("idx_wa_conv_agent").on(table.assignedAgentId),
  index("idx_wa_conv_phone").on(table.contactPhone),
  index("idx_wa_conv_last_msg").on(table.lastMessageAt),
  index("idx_wa_conv_user").on(table.linkedUserId),
]);

export const whatsappMessages = pgTable("whatsapp_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => whatsappConversations.id, { onDelete: 'cascade' }),
  direction: text("direction").notNull(),
  body: text("body").notNull(),
  senderPhone: text("sender_phone"),
  senderName: text("sender_name"),
  agentId: varchar("agent_id").references(() => users.id),
  twilioSid: text("twilio_sid"),
  mediaUrl: text("media_url"),
  mediaType: text("media_type"),
  status: text("status").default('sent'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_wa_msg_conv").on(table.conversationId),
  index("idx_wa_msg_created").on(table.createdAt),
]);

export const insertWhatsappConversationSchema = createInsertSchema(whatsappConversations).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertWhatsappConversation = z.infer<typeof insertWhatsappConversationSchema>;
export type WhatsappConversation = typeof whatsappConversations.$inferSelect;

export const insertWhatsappMessageSchema = createInsertSchema(whatsappMessages).omit({ id: true, createdAt: true });
export type InsertWhatsappMessage = z.infer<typeof insertWhatsappMessageSchema>;
export type WhatsappMessage = typeof whatsappMessages.$inferSelect;

// ========== CRM OUTBOX (Salesforce lead mirroring for partners) ==========

// Delivery status lifecycle:
// - pending: waiting to be delivered (credentials configured or not yet attempted)
// - dry_run: credentials absent; payload recorded for review, will auto-deliver once credentials are set
// - sent: successfully delivered to the CRM
// - failed: exhausted retries; admin can manually retry
export const CRM_OUTBOX_STATUS = {
  PENDING: 'pending',
  DRY_RUN: 'dry_run',
  SENT: 'sent',
  FAILED: 'failed',
} as const;

export const crmOutbox = pgTable("crm_outbox", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").default('salesforce').notNull(), // CRM provider (currently only 'salesforce')
  partner: text("partner").notNull(), // Partner slug this lead belongs to (e.g., 'u-storage')
  quoteId: varchar("quote_id").notNull().references(() => quotes.id, { onDelete: 'cascade' }),
  eventType: text("event_type").default('lead.created').notNull(), // 'lead.created' | 'lead.updated'
  payload: jsonb("payload").notNull(), // Mapped CRM lead payload (exactly what will be / was sent)
  status: text("status").default('pending').notNull(), // pending | dry_run | sent | failed
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  nextAttemptAt: timestamp("next_attempt_at").defaultNow(),
  externalId: text("external_id"), // Salesforce record ID after successful delivery
  sentAt: timestamp("sent_at"),
  dryRunAt: timestamp("dry_run_at"), // Last time this entry was evaluated in dry-run mode
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_crm_outbox_status").on(table.status),
  index("idx_crm_outbox_quote").on(table.quoteId),
  index("idx_crm_outbox_partner").on(table.partner),
  index("idx_crm_outbox_next_attempt").on(table.nextAttemptAt),
]);

export const insertCrmOutboxSchema = createInsertSchema(crmOutbox).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCrmOutbox = z.infer<typeof insertCrmOutboxSchema>;
export type CrmOutbox = typeof crmOutbox.$inferSelect;

// ========== APPROVED STORAGE BRANCH CATALOG ==========

export const ustorageBranches = pgTable("ustorage_branches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  externalId: text("external_id").notNull().unique(), // Preserves legacy U-Storage identifiers
  googlePlaceId: text("google_place_id").unique(), // Stable geographic identifier from the official catalog
  brand: text("brand").default("U-Storage").notNull(),
  name: text("name").notNull(),
  region: text("region"),
  address: text("address"),
  url: text("url"),
  mapsUrl: text("maps_url"),
  lat: decimal("lat", { precision: 10, scale: 7 }),
  lng: decimal("lng", { precision: 10, scale: 7 }),
  verificationNote: text("verification_note"),
  sourceVersion: text("source_version"),
  sourceImportedAt: timestamp("source_imported_at"),
  catalogStatus: text("catalog_status").default("official").notNull(), // official | missing
  priceFromMxn: decimal("price_from_mxn", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(false).notNull(), // Launch decision; new branches are always inactive
  lastScrapedAt: timestamp("last_scraped_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ustorage_branches_active").on(table.isActive),
  index("idx_ustorage_branches_public").on(table.catalogStatus, table.isActive),
  index("idx_ustorage_branches_brand").on(table.brand),
]);

export const insertUstorageBranchSchema = createInsertSchema(ustorageBranches).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUstorageBranch = z.infer<typeof insertUstorageBranchSchema>;
export type UstorageBranch = typeof ustorageBranches.$inferSelect;

// Single-row settings for the U-Storage storage-move feature
export const ustorageSettings = pgTable("ustorage_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  branchMovesEnabled: boolean("branch_moves_enabled").default(true).notNull(),
  generalMovesEnabled: boolean("general_moves_enabled").default(false).notNull(),
  intoStorageEnabled: boolean("into_storage_enabled").default(true), // Recommend storage when destination is near a branch
  outOfStorageEnabled: boolean("out_of_storage_enabled").default(true), // Flag moves whose origin is near a branch
  matchRadiusKm: decimal("match_radius_km", { precision: 6, scale: 2 }).default('2.00'), // Max distance to consider a branch "at/near" an address
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUstorageSettingsSchema = createInsertSchema(ustorageSettings).omit({ id: true, updatedAt: true });

export const insertPartnerVehicleSchema = createInsertSchema(partnerVehicles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertVehicleAvailabilityWindowSchema = createInsertSchema(vehicleAvailabilityWindows).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDispatchAssignmentSchema = createInsertSchema(dispatchAssignments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAssignmentVehicleSchema = createInsertSchema(assignmentVehicles).omit({ id: true });
export const insertAssignmentReservationSchema = createInsertSchema(assignmentReservations).omit({ id: true, createdAt: true, releasedAt: true });

export type PartnerVehicle = typeof partnerVehicles.$inferSelect;
export type InsertPartnerVehicle = typeof partnerVehicles.$inferInsert;
export type VehicleAvailabilityWindow = typeof vehicleAvailabilityWindows.$inferSelect;
export type InsertVehicleAvailabilityWindow = typeof vehicleAvailabilityWindows.$inferInsert;
export type DispatchAssignment = typeof dispatchAssignments.$inferSelect;
export type InsertDispatchAssignment = typeof dispatchAssignments.$inferInsert;
export type AssignmentVehicle = typeof assignmentVehicles.$inferSelect;
export type InsertAssignmentVehicle = typeof assignmentVehicles.$inferInsert;
export type AssignmentReservation = typeof assignmentReservations.$inferSelect;
export type InsertAssignmentReservation = typeof assignmentReservations.$inferInsert;

export const partnerVehiclesRelations = relations(partnerVehicles, ({ one, many }) => ({
  partner: one(moverProfiles, { fields: [partnerVehicles.moverProfileId], references: [moverProfiles.id] }),
  availability: many(vehicleAvailabilityWindows),
  assignments: many(assignmentVehicles),
}));
export const vehicleAvailabilityWindowsRelations = relations(vehicleAvailabilityWindows, ({ one }) => ({
  vehicle: one(partnerVehicles, { fields: [vehicleAvailabilityWindows.vehicleId], references: [partnerVehicles.id] }),
}));
export const dispatchAssignmentsRelations = relations(dispatchAssignments, ({ one, many }) => ({
  quote: one(quotes, { fields: [dispatchAssignments.quoteId], references: [quotes.id] }),
  partner: one(moverProfiles, { fields: [dispatchAssignments.moverProfileId], references: [moverProfiles.id] }),
  vehicles: many(assignmentVehicles),
  reservations: many(assignmentReservations),
}));
export const assignmentVehiclesRelations = relations(assignmentVehicles, ({ one }) => ({
  assignment: one(dispatchAssignments, { fields: [assignmentVehicles.assignmentId], references: [dispatchAssignments.id] }),
  vehicle: one(partnerVehicles, { fields: [assignmentVehicles.vehicleId], references: [partnerVehicles.id] }),
}));
export const assignmentReservationsRelations = relations(assignmentReservations, ({ one }) => ({
  assignment: one(dispatchAssignments, { fields: [assignmentReservations.assignmentId], references: [dispatchAssignments.id] }),
  vehicle: one(partnerVehicles, { fields: [assignmentReservations.vehicleId], references: [partnerVehicles.id] }),
}));
export type InsertUstorageSettings = z.infer<typeof insertUstorageSettingsSchema>;
export type UstorageSettings = typeof ustorageSettings.$inferSelect;

// U-Storage unit size guide tiers (from their public size guide; heights ~2.4-2.8m).
// Volume capacity approximated as m² × 2.4m usable height.
export const USTORAGE_SIZE_TIERS: Array<{ key: string; labelEs: string; labelEn: string; m2: number; volumeM3: number; example: string }> = [
  { key: 'xs', labelEs: 'Mini (1.5 m²)', labelEn: 'Mini (1.5 m²)', m2: 1.5, volumeM3: 3.6, example: 'Cajas y artículos pequeños' },
  { key: 's', labelEs: 'Chica (3 m²)', labelEn: 'Small (3 m²)', m2: 3, volumeM3: 7.2, example: 'Contenido de un estudio' },
  { key: 'm', labelEs: 'Mediana (5 m²)', labelEn: 'Medium (5 m²)', m2: 5, volumeM3: 12, example: 'Depto de 1 recámara' },
  { key: 'l', labelEs: 'Grande (7.5 m²)', labelEn: 'Large (7.5 m²)', m2: 7.5, volumeM3: 18, example: 'Depto de 2 recámaras' },
  { key: 'xl', labelEs: 'Extra grande (10 m²)', labelEn: 'Extra large (10 m²)', m2: 10, volumeM3: 24, example: 'Casa de 2-3 recámaras' },
  { key: 'xxl', labelEs: 'Bodega 14 m²', labelEn: 'Warehouse 14 m²', m2: 14, volumeM3: 33.6, example: 'Casa de 3 recámaras' },
  { key: 'xxxl', labelEs: 'Bodega 18 m²', labelEn: 'Warehouse 18 m²', m2: 18, volumeM3: 43.2, example: 'Casa grande / oficina' },
];

export function suggestStorageTier(volumeM3: number) {
  for (const tier of USTORAGE_SIZE_TIERS) {
    if (volumeM3 <= tier.volumeM3) return tier;
  }
  return USTORAGE_SIZE_TIERS[USTORAGE_SIZE_TIERS.length - 1];
}

export const companies = pgTable("companies", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  classification: text("classification").notNull().default("client"),
  moverProfileId: varchar("mover_profile_id").unique().references(() => moverProfiles.id, { onDelete: "set null" }),
  ownerUserId: varchar("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_companies_classification").on(table.classification),
  index("idx_companies_name").on(table.name),
  index("idx_companies_mover_profile").on(table.moverProfileId),
]);

export const companyMemberships = pgTable("company_memberships", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  companyId: varchar("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email"),
  role: text("role").notNull().default("viewer"),
  status: text("status").notNull().default("invited"),
  invitationTokenHash: text("invitation_token_hash"),
  invitationExpiresAt: timestamp("invitation_expires_at"),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  acceptedAt: timestamp("accepted_at"),
  invitedBy: varchar("invited_by").references(() => users.id),
  updatedBy: varchar("updated_by").references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_company_memberships_v2_company").on(table.companyId, table.status),
  index("idx_company_memberships_v2_user").on(table.userId, table.status),
  uniqueIndex("uq_company_memberships_v2_user").on(table.companyId, table.userId),
  uniqueIndex("uq_company_memberships_v2_invited_email").on(table.companyId, table.invitedEmail),
  uniqueIndex("uq_company_memberships_v2_invitation").on(table.invitationTokenHash),
]);

export type Company = typeof companies.$inferSelect;

export type InsertCompany = typeof companies.$inferInsert;

export type CompanyMembership = typeof companyMemberships.$inferSelect;

export type InsertCompanyMembership = typeof companyMemberships.$inferInsert;

export const partnerCalendarExceptions = pgTable("partner_calendar_exceptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moverProfileId: varchar("mover_profile_id").notNull().references(() => moverProfiles.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  kind: text("kind").notNull().default("blackout"),
  label: text("label"),
  timezone: text("timezone").notNull().default("America/Mexico_City"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [index("idx_partner_calendar_exception_time").on(table.moverProfileId, table.startsAt, table.endsAt)]);

export const partnerOperatingSchedules = pgTable("partner_operating_schedules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  moverProfileId: varchar("mover_profile_id").notNull().references(() => moverProfiles.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  timezone: text("timezone").notNull().default("America/Mexico_City"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [index("idx_partner_schedule_partner_day").on(table.moverProfileId, table.dayOfWeek)]);

export const crewAvailabilityWindows = pgTable("crew_availability_windows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  crewId: varchar("crew_id").notNull().references(() => partnerCrews.id, { onDelete: "cascade" }),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  isAvailable: boolean("is_available").default(true).notNull(),
  label: text("label"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [index("idx_crew_availability_crew_time").on(table.crewId, table.startsAt, table.endsAt)]);
