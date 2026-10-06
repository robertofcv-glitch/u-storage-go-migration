import {
  type User,
  type InsertUser,
  type UpsertUser,
  type Quote,
  type InsertQuote,
  type InventoryItem,
  type InsertInventoryItem,
  type Service,
  type InsertService,
  type AddOn,
  type InsertAddOn,
  type AiAgentConfig,
  type InsertAiAgentConfig,
  type WebsiteConfig,
  type InsertWebsiteConfig,
  type SavedAddress,
  type InsertSavedAddress,
  type MoverProfile,
  type InsertMoverProfile,
  type QuoteInvitation,
  type InsertQuoteInvitation,
  type QuoteBid,
  type InsertQuoteBid,
  type QuoteStatusHistory,
  type InsertQuoteStatusHistory,
  type QuoteActivityLog,
  type InsertQuoteActivityLog,
  type QuoteWithDetails,
  type UserRole,
  type InsertUserRole,
  type PartnerCompanyMembership,
  type InsertPartnerCompanyMembership,
  type ActivityLog,
  type InsertActivityLog,
  type EmailSender,
  type InsertEmailSender,
  type EmailConfig,
  type InsertEmailConfig,
  type EmailLog,
  type InsertEmailLog,
  type EmailTemplate,
  type InsertEmailTemplate,
  type EmailCampaign,
  type InsertEmailCampaign,
  type EmailTrigger,
  type InsertEmailTrigger,
  type EmailEventType,
  type InsertEmailEventType,
  type AdminPermissions,
  type InsertAdminPermissions,
  type InventoryCategory,
  type InsertInventoryCategory,
  type InventoryRoom,
  type InsertInventoryRoom,
  type InventoryCategoryKeyword,
  type InsertInventoryCategoryKeyword,
  type InventoryRoomKeyword,
  type InsertInventoryRoomKeyword,
  type PricingTemplate,
  type InsertPricingTemplate,
  type Country,
  type InsertCountry,
  type City,
  type InsertCity,
  type CityTruckPricing,
  type InsertCityTruckPricing,
  type ResolvedPricing,
  type PricingFormulaParameter,
  type InsertPricingFormulaParameter,
  type AiPricingPrompt,
  type InsertAiPricingPrompt,
  type PresetInventorySet,
  type InsertPresetInventorySet,
  type PresetInventoryItem,
  type InsertPresetInventoryItem,
  type Rating,
  type InsertRating,
  type RatingComment,
  type InsertRatingComment,
  type RatingAiTag,
  type InsertRatingAiTag,
  type RatingRequest,
  type InsertRatingRequest,
  type RatingWithDetails,
  type PartnerRatingSummary,
  type UserRatingSummary,
  type SeoSettings,
  type InsertSeoSettings,
  type MarketingPageView,
  type InsertMarketingPageView,
  type MarketingAnalyticsSummary,
  type QuoteWorkflowStatus,
  type InsertQuoteWorkflowStatus,
  type DocumentType,
  type InsertDocumentType,
  type PartnerDocument,
  type InsertPartnerDocument,
  type BlogPost,
  type InsertBlogPost,
  type AiModel,
  type InsertAiModel,
} from "@shared/schema";
import { db } from "./db";
import {
  users,
  quotes,
  inventoryItems,
  services, serviceActivityLog,
  addOns,
  aiAgentConfig,
  websiteConfig,
  savedAddresses,
  moverProfiles,
  quoteServices,
  quoteAddOns,
  quoteInvitations,
  quoteBids,
  quoteStatusHistory,
  userRoles,
  activityLogs,
  passwordResetTokens,
  emailSenders,
  emailConfig,
  emailLogs,
  emailTemplates,
  emailCampaigns,
  emailTriggers,
  emailEventTypes,
  adminPermissions,
  partnerCompanyMemberships,
  companies,
  companyMemberships,
  adminAccessRequests,
  inventoryCategories,
  inventoryRooms,
  inventoryCategoryKeywords,
  inventoryRoomKeywords,
  truckTypes,
  partnerVehicles,
  pricingTemplates,
  countries,
  cities,
  cityTruckPricing,
  pricingFormulaParameters,
  aiPricingPrompts,
} from "@shared/schema";
import type { TruckType, InsertTruckType, QuoteDocument, InsertQuoteDocument } from "@shared/schema";
import { quoteDocuments, presetInventorySets, presetInventoryItems, inventoryCatalogItems, ratings, ratingComments, ratingAiTags, ratingRequests, seoSettings, marketingPageViews, quoteWorkflowStatuses, quoteActivityLog, partnerStatusHistory, documentTypes, partnerDocuments, blogPosts, aiModels, platformSecrets, stripeProfiles, whatsappConversations, whatsappMessages } from "@shared/schema";
import type { StripeProfile, InsertStripeProfile } from "@shared/schema";
import type { PartnerStatusHistory, InsertPartnerStatusHistory } from "@shared/schema";
import type { InventoryCatalogItem, InsertInventoryCatalogItem } from "@shared/schema";
import type { WhatsappConfig, InsertWhatsappConfig, Conversation, InsertConversation, Message, InsertMessage, ConversationAssignment, InsertConversationAssignment } from "@shared/schema";
import { whatsappConfig, conversations, messages as messagesTable, conversationAssignments } from "@shared/schema";
import type { WhatsappConversation, InsertWhatsappConversation, WhatsappMessage, InsertWhatsappMessage } from "@shared/schema";
import type { CrmOutbox, InsertCrmOutbox } from "@shared/schema";
import { crmOutbox } from "@shared/schema";
import type { UstorageBranch, InsertUstorageBranch, UstorageSettings, InsertUstorageSettings } from "@shared/schema";
import { ustorageBranches, ustorageSettings } from "@shared/schema";
import { eq, and, or, isNull, desc, inArray, sql, asc, gte, lte } from "drizzle-orm";
import { tableMetadataConfig, getTableMetadata } from "@shared/tableMetadata";
import {
  assertNoDerivedEligibilityFields,
  QuoteEligibilityError,
  resolveQuoteEligibility,
  shouldRecalculateEligibility,
  type QuoteEndpointSelection,
} from "./services/quoteEligibilityService";

type QuoteStep4DecisionInput = Pick<Quote,
  | "storageContractStatus"
  | "storageRentalIntent"
  | "storageAvailabilityStatus"
  | "storageSelectedUnitCode"
  | "storageSelectedUnitSnapshot"
  | "storageReservationStatus"
  | "storageAvailabilityCheckedAt"
>;
type QuoteCreateInput = InsertQuote & QuoteEndpointSelection & Partial<QuoteStep4DecisionInput>;
type QuoteUpdateInput = Partial<Quote> & QuoteEndpointSelection;

const tableSchemas: Record<string, any> = {
  users,
  user_roles: userRoles,
  mover_profiles: moverProfiles,
  quotes,
  quote_invitations: quoteInvitations,
  quote_bids: quoteBids,
  inventory_items: inventoryItems,
  services,
  add_ons: addOns,
  saved_addresses: savedAddresses,
  activity_logs: activityLogs,
  email_logs: emailLogs,
  email_config: emailConfig,
  website_config: websiteConfig,
  ai_agent_config: aiAgentConfig,
};

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  findOrCreatePlaceholderUser(email?: string, phone?: string, name?: string): Promise<User>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Mover profile operations
  getMoverProfile(userId: string): Promise<MoverProfile | undefined>;
  getMoverProfileById(id: string): Promise<MoverProfile | undefined>;
  updateMoverProfileById(id: string, data: Partial<MoverProfile>): Promise<MoverProfile>;
  getBidsByMoverProfileId(moverProfileId: string): Promise<QuoteBid[]>;
  getRatingsByMoverProfileId(moverProfileId: string): Promise<RatingWithDetails[]>;
  getAllMoverProfiles(): Promise<Array<MoverProfile & { user: User }>>;
  createMoverProfile(profile: InsertMoverProfile): Promise<MoverProfile>;
  updateMoverProfile(userId: string, data: Partial<MoverProfile>): Promise<MoverProfile>;
  getCompanyMemberships(userId: string): Promise<PartnerCompanyMembership[]>;
  ensureCompanyOwnerMembership(companyId: string, userId: string): Promise<PartnerCompanyMembership>;
  ensureMoverCompanyMemberships(): Promise<number>;
  ensureClientCompany(userId: string): Promise<import("@shared/schema").Company>;
  
  // Partner status operations
  updatePartnerStatus(moverProfileId: string, status: string, actorType: string, actorId?: string, actorName?: string, note?: string): Promise<MoverProfile>;
  getPartnerStatusHistory(moverProfileId: string): Promise<PartnerStatusHistory[]>;
  getActivePartners(): Promise<Array<MoverProfile & { user: User }>>;

  // Quote operations
  getQuote(id: string): Promise<Quote | undefined>;
  getQuotesByUser(userId: string): Promise<Quote[]>;
  getAllQuotes(): Promise<Quote[]>;
  createQuote(quote: QuoteCreateInput, options?: { deferEligibility?: boolean }): Promise<Quote>;
  updateQuote(id: string, data: QuoteUpdateInput): Promise<Quote>;
  deleteQuote(id: string): Promise<void>;

  // Inventory operations
  getInventoryByQuote(quoteId: string): Promise<InventoryItem[]>;
  addInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  updateInventoryItem(id: string, data: Partial<InsertInventoryItem>): Promise<InventoryItem>;
  deleteInventoryItem(id: string): Promise<void>;
  deleteInventoryByQuote(quoteId: string): Promise<void>;

  // Service operations
  getAllServices(): Promise<Service[]>;
  getActiveServices(): Promise<Service[]>;
  getService(id: string): Promise<Service | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, data: Partial<Service>): Promise<Service>;
  deleteService(id: string): Promise<void>;

  // Add-on operations
  getAllAddOns(): Promise<AddOn[]>;
  getActiveAddOns(): Promise<AddOn[]>;
  getAddOn(id: string): Promise<AddOn | undefined>;
  createAddOn(addOn: InsertAddOn): Promise<AddOn>;
  updateAddOn(id: string, data: Partial<AddOn>): Promise<AddOn>;
  deleteAddOn(id: string): Promise<void>;

  // Quote services and add-ons
  addServiceToQuote(quoteId: string, serviceId: string): Promise<void>;
  addAddOnToQuote(quoteId: string, addOnId: string): Promise<void>;
  getQuoteServices(quoteId: string): Promise<Service[]>;
  getQuoteServiceAssignments(quoteId: string): Promise<Array<{ id: string; service: Service; createdByAdminId: string | null; followUpOwnerId: string | null }>>;
  updateQuoteServiceFollowUp(id: string, followUpOwnerId: string, actorId?: string): Promise<void>;
  getQuoteAddOns(quoteId: string): Promise<AddOn[]>;

  // AI Agent config
  getAiAgentConfig(): Promise<AiAgentConfig | undefined>;
  updateAiAgentConfig(data: Partial<AiAgentConfig>): Promise<AiAgentConfig>;

  // AI Models management
  getAiModels(): Promise<AiModel[]>;
  getAiModelById(id: string): Promise<AiModel | undefined>;
  getAiModelByModelId(modelId: string): Promise<AiModel | undefined>;
  createAiModel(data: InsertAiModel): Promise<AiModel>;
  updateAiModel(id: string, data: Partial<InsertAiModel>): Promise<AiModel>;
  deleteAiModel(id: string): Promise<void>;

  // Inventory categories and rooms (for Clara AI)
  getInventoryCategories(): Promise<InventoryCategory[]>;
  createInventoryCategory(data: InsertInventoryCategory): Promise<InventoryCategory>;
  updateInventoryCategory(id: string, data: Partial<InsertInventoryCategory>): Promise<InventoryCategory>;
  deleteInventoryCategory(id: string): Promise<void>;
  getInventoryRooms(): Promise<InventoryRoom[]>;
  createInventoryRoom(data: InsertInventoryRoom): Promise<InventoryRoom>;
  updateInventoryRoom(id: string, data: Partial<InsertInventoryRoom>): Promise<InventoryRoom>;
  deleteInventoryRoom(id: string): Promise<void>;
  
  // Inventory category keywords (for CSV/document parsing)
  getCategoryKeywords(): Promise<InventoryCategoryKeyword[]>;
  getCategoryKeywordsByCategory(categoryKey: string): Promise<InventoryCategoryKeyword[]>;
  createCategoryKeyword(data: InsertInventoryCategoryKeyword): Promise<InventoryCategoryKeyword>;
  updateCategoryKeyword(id: string, data: Partial<InsertInventoryCategoryKeyword>): Promise<InventoryCategoryKeyword>;
  deleteCategoryKeyword(id: string): Promise<void>;
  
  // Inventory room keywords (for CSV/document parsing)
  getRoomKeywords(): Promise<InventoryRoomKeyword[]>;
  getRoomKeywordsByRoom(roomKey: string): Promise<InventoryRoomKeyword[]>;
  createRoomKeyword(data: InsertInventoryRoomKeyword): Promise<InventoryRoomKeyword>;
  updateRoomKeyword(id: string, data: Partial<InsertInventoryRoomKeyword>): Promise<InventoryRoomKeyword>;
  deleteRoomKeyword(id: string): Promise<void>;

  // Truck types
  getTruckTypes(): Promise<TruckType[]>;
  getTruckType(id: string): Promise<TruckType | undefined>;
  createTruckType(data: InsertTruckType): Promise<TruckType>;
  updateTruckType(id: string, data: Partial<InsertTruckType>): Promise<TruckType>;
  deleteTruckType(id: string): Promise<void>;

  // Website config
  getWebsiteConfig(): Promise<WebsiteConfig | undefined>;
  updateWebsiteConfig(data: Partial<WebsiteConfig>): Promise<WebsiteConfig>;

  // Platform secrets (admin-configurable API keys)
  getPlatformSecret(key: string): Promise<string | undefined>;
  setPlatformSecret(key: string, value: string, provider: string, userId?: string): Promise<void>;
  deletePlatformSecret(key: string): Promise<void>;
  getPlatformSecretsByProvider(provider: string): Promise<{ key: string; lastUpdated: Date }[]>;

  // Stripe profiles (multiple accounts)
  getStripeProfiles(): Promise<StripeProfile[]>;
  getStripeProfile(id: string): Promise<StripeProfile | undefined>;
  getActiveStripeProfile(): Promise<StripeProfile | undefined>;
  createStripeProfile(data: InsertStripeProfile): Promise<StripeProfile>;
  updateStripeProfile(id: string, data: Partial<InsertStripeProfile>): Promise<StripeProfile>;
  deleteStripeProfile(id: string): Promise<void>;
  setActiveStripeProfile(id: string): Promise<void>;

  // Pricing defaults
  getPricingDefaults(): Promise<import("@shared/schema").PricingDefaults | undefined>;
  updatePricingDefaults(data: Partial<import("@shared/schema").PricingDefaults>): Promise<import("@shared/schema").PricingDefaults>;

  // Saved addresses
  getSavedAddresses(userId: string): Promise<SavedAddress[]>;
  getSavedAddress(id: string): Promise<SavedAddress | undefined>;
  createSavedAddress(address: InsertSavedAddress): Promise<SavedAddress>;
  updateSavedAddress(id: string, data: Partial<InsertSavedAddress>): Promise<SavedAddress>;
  deleteSavedAddress(id: string): Promise<void>;

  // Quote management for admin
  getAdminQuotesList(status?: string): Promise<QuoteWithDetails[]>;
  getQuoteWithDetails(id: string): Promise<QuoteWithDetails | undefined>;
  updateQuoteWorkflow(id: string, data: Partial<Quote>, actorId?: string, note?: string): Promise<Quote>;
  
  // Quote invitations
  getQuoteInvitation(id: string): Promise<QuoteInvitation | undefined>;
  getQuoteInvitations(quoteId: string): Promise<(QuoteInvitation & { moverProfile: MoverProfile })[]>;
  createQuoteInvitation(invitation: InsertQuoteInvitation): Promise<QuoteInvitation>;
  createBulkQuoteInvitations(invitations: InsertQuoteInvitation[]): Promise<QuoteInvitation[]>;
  updateQuoteInvitation(id: string, data: Partial<QuoteInvitation>): Promise<QuoteInvitation>;
  getMoverInvitations(moverProfileId: string): Promise<(QuoteInvitation & { quote: Quote })[]>;
  getMoverInvitationsWithDetails(moverProfileId: string): Promise<(QuoteInvitation & { quote: Quote & { inventoryItems?: any[] } })[]>;
  
  // Quote bids
  getQuoteBid(id: string): Promise<QuoteBid | undefined>;
  getQuoteBids(quoteId: string): Promise<(QuoteBid & { moverProfile: MoverProfile })[]>;
  getApprovedBidsForClient(quoteId: string): Promise<(QuoteBid & { moverProfile: MoverProfile })[]>;
  createQuoteBid(bid: InsertQuoteBid): Promise<QuoteBid>;
  updateQuoteBid(id: string, data: Partial<QuoteBid>): Promise<QuoteBid>;
  getBidsByMover(moverProfileId: string): Promise<QuoteBid[]>;
  getBidsByMoverWithDetails(moverProfileId: string): Promise<(QuoteBid & { quote: Quote })[]>;
  acceptBid(bidId: string, quoteId: string): Promise<void>;
  adminReviewBid(bidId: string, status: 'approved' | 'rejected', adminId: string, note?: string): Promise<QuoteBid>;
  clientSelectBid(quoteId: string, bidId: string): Promise<Quote>;
  adminFinalApproval(quoteId: string, adminId: string): Promise<Quote>;
  
  // Quote status history
  addQuoteStatusHistory(entry: InsertQuoteStatusHistory): Promise<QuoteStatusHistory>;
  getQuoteStatusHistory(quoteId: string): Promise<QuoteStatusHistory[]>;
  
  // Quote activity log - comprehensive tracking
  createQuoteActivityLog(log: InsertQuoteActivityLog): Promise<QuoteActivityLog>;
  getQuoteActivityLog(quoteId: string): Promise<QuoteActivityLog[]>;
  
  // User roles - multi-role support
  getUserRoles(userId: string): Promise<UserRole[]>;
  addUserRole(role: InsertUserRole): Promise<UserRole>;
  removeUserRole(userId: string, role: string): Promise<void>;
  hasRole(userId: string, role: string): Promise<boolean>;
  getUsersByRole(role: string): Promise<User[]>;
  getUserRolesByUserIds(userIds: string[]): Promise<UserRole[]>;
  syncUserRoles(userId: string, newRoles: string[], grantedBy?: string | null): Promise<void>;
  
  // Activity logs - platform-wide tracking
  logActivity(log: InsertActivityLog): Promise<ActivityLog>;
  getUserActivityLogs(userId: string, limit?: number): Promise<ActivityLog[]>;
  getActivityLogsByEntity(entityType: string, entityId: string): Promise<ActivityLog[]>;
  getRecentActivityLogs(limit?: number): Promise<(ActivityLog & { user?: User })[]>;
  getLastActiveByUserIds(userIds: string[]): Promise<Map<string, Date>>;
  updateActivityLogDetails(id: string, details: Record<string, any>): Promise<ActivityLog>;
  getActivityLog(id: string): Promise<ActivityLog | undefined>;
  getCalculationLogsBySessionId(sessionId: string): Promise<ActivityLog[]>;
  getUnlinkedCalculationLogs(): Promise<ActivityLog[]>;
  getQuotesBySessionId(sessionId: string): Promise<Quote[]>;
  getQuotesByUserInTimeWindow(userId: string, minTime: Date, maxTime: Date): Promise<Quote[]>;
  
  // Password reset tokens
  createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  getValidPasswordResetToken(token: string): Promise<{ id: string; userId: string; expiresAt: Date } | undefined>;
  markPasswordResetTokenUsed(token: string): Promise<void>;
  revokeAllPasswordResetTokens(userId: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  
  // Generic database CRUD for admin
  getTableRows(tableName: string, page: number, pageSize: number, orderBy?: string, orderDir?: 'asc' | 'desc'): Promise<{ rows: any[]; total: number }>;
  getTableRow(tableName: string, id: string): Promise<any | undefined>;
  insertTableRow(tableName: string, data: Record<string, any>): Promise<any>;
  updateTableRow(tableName: string, id: string, data: Record<string, any>): Promise<any>;
  deleteTableRow(tableName: string, id: string): Promise<void>;
  getTableCount(tableName: string): Promise<number>;
  
  // Admin access requests
  createAdminAccessRequest(request: { email: string; fullName: string; phone?: string; company?: string; justification?: string }): Promise<any>;
  getAdminAccessRequests(status?: string): Promise<any[]>;
  getAdminAccessRequest(id: string): Promise<any | undefined>;
  updateAdminAccessRequest(id: string, data: { status?: string; reviewedBy?: string; reviewedAt?: Date; reviewNotes?: string; userId?: string }): Promise<any>;
  getPendingRequestByEmail(email: string): Promise<any | undefined>;
  
  // Email templates
  getAllEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplateByKey(templateKey: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, data: Partial<EmailTemplate>): Promise<EmailTemplate>;
  deleteEmailTemplate(id: string): Promise<void>;
  
  // Email event types
  getAllEmailEventTypes(): Promise<EmailEventType[]>;
  getEmailEventType(id: string): Promise<EmailEventType | undefined>;
  getEmailEventTypeByKey(eventKey: string): Promise<EmailEventType | undefined>;
  createEmailEventType(eventType: InsertEmailEventType): Promise<EmailEventType>;
  updateEmailEventType(id: string, data: Partial<EmailEventType>): Promise<EmailEventType>;
  
  // Email triggers
  getAllEmailTriggers(): Promise<EmailTrigger[]>;
  getEmailTrigger(id: string): Promise<EmailTrigger | undefined>;
  getEmailTriggerByEvent(eventKey: string): Promise<EmailTrigger | undefined>;
  createEmailTrigger(trigger: InsertEmailTrigger): Promise<EmailTrigger>;
  updateEmailTrigger(id: string, data: Partial<EmailTrigger>): Promise<EmailTrigger>;
  deleteEmailTrigger(id: string): Promise<void>;
  
  // Email campaigns
  getAllEmailCampaigns(): Promise<EmailCampaign[]>;
  getEmailCampaign(id: string): Promise<EmailCampaign | undefined>;
  createEmailCampaign(campaign: InsertEmailCampaign): Promise<EmailCampaign>;
  updateEmailCampaign(id: string, data: Partial<EmailCampaign>): Promise<EmailCampaign>;
  deleteEmailCampaign(id: string): Promise<void>;
  
  // Pricing templates
  getAllPricingTemplates(): Promise<PricingTemplate[]>;
  getPricingTemplate(id: string): Promise<PricingTemplate | undefined>;
  getDefaultPricingTemplate(): Promise<PricingTemplate | undefined>;
  createPricingTemplate(template: InsertPricingTemplate): Promise<PricingTemplate>;
  updatePricingTemplate(id: string, data: Partial<PricingTemplate>): Promise<PricingTemplate>;
  deletePricingTemplate(id: string): Promise<void>;
  
  // Countries
  getAllCountries(): Promise<Country[]>;
  getCountry(id: string): Promise<Country | undefined>;
  getCountryByCode(code: string): Promise<Country | undefined>;
  createCountry(country: InsertCountry): Promise<Country>;
  updateCountry(id: string, data: Partial<Country>): Promise<Country>;
  deleteCountry(id: string): Promise<void>;
  
  // Cities
  getAllCities(): Promise<City[]>;
  getCitiesByCountry(countryId: string): Promise<City[]>;
  getCity(id: string): Promise<City | undefined>;
  getCityByName(name: string, countryId?: string): Promise<City | undefined>;
  createCity(city: InsertCity): Promise<City>;
  updateCity(id: string, data: Partial<City>): Promise<City>;
  deleteCity(id: string): Promise<void>;
  getActiveTimezones(): Promise<{ timezone: string; cityName: string; countryName: string }[]>;
  
  // City truck pricing
  getCityTruckPricing(cityId: string): Promise<CityTruckPricing[]>;
  upsertCityTruckPricing(data: InsertCityTruckPricing): Promise<CityTruckPricing>;
  deleteCityTruckPricing(cityId: string, truckTypeId: string): Promise<void>;
  
  // Resolved pricing (hierarchy: city -> country -> template -> default)
  getResolvedPricing(cityName?: string, countryCode?: string): Promise<ResolvedPricing>;
  
  // Pricing formula parameters
  getAllPricingFormulaParameters(): Promise<PricingFormulaParameter[]>;
  getPricingFormulaParameter(id: string): Promise<PricingFormulaParameter | undefined>;
  getPricingFormulaParameterByKey(key: string): Promise<PricingFormulaParameter | undefined>;
  createPricingFormulaParameter(param: InsertPricingFormulaParameter): Promise<PricingFormulaParameter>;
  updatePricingFormulaParameter(id: string, data: Partial<PricingFormulaParameter>): Promise<PricingFormulaParameter>;
  deletePricingFormulaParameter(id: string): Promise<void>;
  
  // AI pricing prompts
  getAllAiPricingPrompts(): Promise<AiPricingPrompt[]>;
  getAiPricingPrompt(id: string): Promise<AiPricingPrompt | undefined>;
  getActiveAiPricingPrompt(scope?: string, scopeId?: string): Promise<AiPricingPrompt | undefined>;
  createAiPricingPrompt(prompt: InsertAiPricingPrompt): Promise<AiPricingPrompt>;
  updateAiPricingPrompt(id: string, data: Partial<AiPricingPrompt>): Promise<AiPricingPrompt>;
  deleteAiPricingPrompt(id: string): Promise<void>;
  
  // Quote documents (PDF quotes)
  getQuoteDocument(id: string): Promise<QuoteDocument | undefined>;
  getQuoteDocuments(quoteId: string): Promise<QuoteDocument[]>;
  getLatestQuoteDocument(quoteId: string): Promise<QuoteDocument | undefined>;
  createQuoteDocument(doc: InsertQuoteDocument): Promise<QuoteDocument>;
  deleteQuoteDocument(id: string): Promise<void>;
  
  // Preset inventory sets
  getAllPresetInventorySets(): Promise<PresetInventorySet[]>;
  getActivePresetInventorySets(): Promise<PresetInventorySet[]>;
  getPresetInventorySet(id: string): Promise<PresetInventorySet | undefined>;
  getPresetInventorySetByKey(key: string): Promise<PresetInventorySet | undefined>;
  createPresetInventorySet(data: InsertPresetInventorySet): Promise<PresetInventorySet>;
  updatePresetInventorySet(id: string, data: Partial<InsertPresetInventorySet>): Promise<PresetInventorySet>;
  deletePresetInventorySet(id: string): Promise<void>;
  
  // Preset inventory items
  getPresetInventoryItems(presetSetId: string): Promise<PresetInventoryItem[]>;
  createPresetInventoryItem(data: InsertPresetInventoryItem): Promise<PresetInventoryItem>;
  updatePresetInventoryItem(id: string, data: Partial<InsertPresetInventoryItem>): Promise<PresetInventoryItem>;
  deletePresetInventoryItem(id: string): Promise<void>;
  deletePresetInventoryItemsBySet(presetSetId: string): Promise<void>;
  replacePresetInventoryItems(presetSetId: string, items: InsertPresetInventoryItem[]): Promise<PresetInventoryItem[]>;
  getCatalogItems(): Promise<Array<{ key: string; nameEn: string; nameEs: string; roomKey: string; categoryKey: string }>>;
  
  // Inventory catalog items (canonical catalog for visual picker)
  getAllCatalogItems(): Promise<InventoryCatalogItem[]>;
  getActiveCatalogItems(): Promise<InventoryCatalogItem[]>;
  getCatalogItem(id: string): Promise<InventoryCatalogItem | undefined>;
  createCatalogItem(data: InsertInventoryCatalogItem): Promise<InventoryCatalogItem>;
  updateCatalogItem(id: string, data: Partial<InsertInventoryCatalogItem>): Promise<InventoryCatalogItem>;
  deleteCatalogItem(id: string): Promise<void>;
  
  // Rating system operations
  getRating(id: string): Promise<Rating | undefined>;
  getRatingByQuoteAndRater(quoteId: string, raterUserId: string): Promise<Rating | undefined>;
  getRatingByEmailToken(token: string): Promise<Rating | undefined>;
  getRatingsForUser(userId: string, asTarget?: boolean): Promise<RatingWithDetails[]>;
  getRatingsForMoverProfile(moverProfileId: string): Promise<RatingWithDetails[]>;
  getRatingsForQuote(quoteId: string): Promise<RatingWithDetails[]>;
  getAllRatings(filters?: { direction?: string; limit?: number }): Promise<RatingWithDetails[]>;
  createRating(rating: InsertRating): Promise<Rating>;
  updateRating(id: string, data: Partial<Rating>, editedBy?: string, editReason?: string): Promise<Rating>;
  deleteRating(id: string): Promise<void>;
  
  // Rating comments
  getRatingComment(ratingId: string): Promise<RatingComment | undefined>;
  createRatingComment(comment: InsertRatingComment): Promise<RatingComment>;
  updateRatingComment(ratingId: string, data: Partial<RatingComment>): Promise<RatingComment>;
  
  // Rating AI tags
  getRatingAiTags(ratingId: string): Promise<RatingAiTag[]>;
  createRatingAiTag(tag: InsertRatingAiTag): Promise<RatingAiTag>;
  deleteRatingAiTags(ratingId: string): Promise<void>;
  getTopTagsForMoverProfile(moverProfileId: string, sentiment?: string): Promise<{ tag: string; tagEs?: string; count: number }[]>;
  
  // Rating requests
  getRatingRequest(id: string): Promise<RatingRequest | undefined>;
  getRatingRequestByToken(token: string): Promise<RatingRequest | undefined>;
  getPendingRatingRequests(quoteId: string): Promise<RatingRequest[]>;
  createRatingRequest(request: InsertRatingRequest): Promise<RatingRequest>;
  updateRatingRequest(id: string, data: Partial<RatingRequest>): Promise<RatingRequest>;
  
  // Rating summaries
  getPartnerRatingSummary(moverProfileId: string): Promise<PartnerRatingSummary>;
  getUserRatingSummary(userId: string): Promise<UserRatingSummary>;
  updateMoverProfileRating(moverProfileId: string): Promise<void>;
  
  // SEO Settings
  getSeoSettings(): Promise<SeoSettings | undefined>;
  updateSeoSettings(data: Partial<InsertSeoSettings>, updatedBy?: string): Promise<SeoSettings>;
  
  // Quote Workflow Statuses
  getQuoteWorkflowStatuses(): Promise<QuoteWorkflowStatus[]>;
  getQuoteWorkflowStatus(id: string): Promise<QuoteWorkflowStatus | undefined>;
  getQuoteWorkflowStatusByKey(key: string): Promise<QuoteWorkflowStatus | undefined>;
  createQuoteWorkflowStatus(data: InsertQuoteWorkflowStatus): Promise<QuoteWorkflowStatus>;
  updateQuoteWorkflowStatus(id: string, data: Partial<InsertQuoteWorkflowStatus>): Promise<QuoteWorkflowStatus>;
  deleteQuoteWorkflowStatus(id: string): Promise<void>;
  reorderQuoteWorkflowStatuses(orderedIds: string[]): Promise<void>;
  
  // Marketing Page Views
  createPageView(data: InsertMarketingPageView): Promise<MarketingPageView>;
  getMarketingAnalyticsSummary(startDate?: Date, endDate?: Date): Promise<MarketingAnalyticsSummary>;
  
  // Document Types
  getDocumentTypes(): Promise<DocumentType[]>;
  getActiveDocumentTypes(): Promise<DocumentType[]>;
  getDocumentType(id: string): Promise<DocumentType | undefined>;
  getDocumentTypeByKey(key: string): Promise<DocumentType | undefined>;
  createDocumentType(data: InsertDocumentType): Promise<DocumentType>;
  updateDocumentType(id: string, data: Partial<InsertDocumentType>): Promise<DocumentType>;
  deleteDocumentType(id: string): Promise<void>;
  
  // Partner Documents
  getPartnerDocuments(moverProfileId: string): Promise<PartnerDocument[]>;
  getPartnerDocument(id: string): Promise<PartnerDocument | undefined>;
  getPartnerDocumentByType(moverProfileId: string, documentTypeId: string): Promise<PartnerDocument | undefined>;
  createPartnerDocument(data: InsertPartnerDocument): Promise<PartnerDocument>;
  updatePartnerDocument(id: string, data: Partial<PartnerDocument>): Promise<PartnerDocument>;
  deletePartnerDocument(id: string): Promise<void>;
  reviewPartnerDocument(id: string, reviewerId: string, status: string, reviewNote?: string): Promise<PartnerDocument>;
  getPartnerDocumentsWithTypes(moverProfileId: string): Promise<Array<PartnerDocument & { documentType: DocumentType }>>;

  // Mover profile by phone (for WhatsApp matching)
  getMoverProfileByPhone(phone: string): Promise<MoverProfile | undefined>;

  // WhatsApp config
  getWhatsappConfig(): Promise<WhatsappConfig | undefined>;
  upsertWhatsappConfig(data: Partial<InsertWhatsappConfig>): Promise<WhatsappConfig>;

  // Conversations (Twilio)
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByPhone(phone: string, channel?: string): Promise<Conversation | undefined>;
  getAllConversations(status?: string): Promise<Conversation[]>;
  createConversation(data: InsertConversation): Promise<Conversation>;
  updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation>;

  // Messages (Twilio)
  getMessage(id: string): Promise<Message | undefined>;
  getMessageByTwilioSid(sid: string): Promise<Message | undefined>;
  getMessagesByConversation(conversationId: string, limit?: number): Promise<Message[]>;
  createMessage(data: InsertMessage): Promise<Message>;
  updateMessage(id: string, data: Partial<Message>): Promise<Message>;
  updateMessageByTwilioSid(sid: string, data: Partial<Message>): Promise<Message | undefined>;

  // Conversation assignments
  getConversationAssignments(conversationId: string): Promise<ConversationAssignment[]>;
  createConversationAssignment(data: InsertConversationAssignment): Promise<ConversationAssignment>;
  endConversationAssignment(id: string): Promise<ConversationAssignment>;

  // WhatsApp Admin Inbox conversations
  getWhatsappConversations(filters?: { status?: string; assignedAgentId?: string; unassigned?: boolean }): Promise<WhatsappConversation[]>;
  getWhatsappConversation(id: string): Promise<WhatsappConversation | undefined>;
  createWhatsappConversation(data: InsertWhatsappConversation): Promise<WhatsappConversation>;
  updateWhatsappConversation(id: string, data: Partial<WhatsappConversation>): Promise<WhatsappConversation>;
  getWhatsappConversationByPhone(phone: string): Promise<WhatsappConversation | undefined>;
  getTotalUnreadCount(): Promise<number>;

  // WhatsApp Admin Inbox messages
  getWhatsappMessages(conversationId: string): Promise<WhatsappMessage[]>;
  createWhatsappMessage(data: InsertWhatsappMessage): Promise<WhatsappMessage>;

  // CRM outbox (Salesforce lead mirroring)
  createCrmOutboxEntry(data: InsertCrmOutbox): Promise<CrmOutbox>;
  getCrmOutboxEntry(id: string): Promise<CrmOutbox | undefined>;
  getCrmOutboxEntries(filters?: { status?: string; partner?: string; limit?: number }): Promise<Array<CrmOutbox & { quote?: Quote }>>;
  getCrmOutboxByQuote(quoteId: string): Promise<CrmOutbox[]>;
  getUnsentCrmOutboxByQuote(quoteId: string): Promise<CrmOutbox | undefined>;
  getDeliverableCrmOutboxEntries(limit: number, includeDryRun: boolean): Promise<CrmOutbox[]>;
  updateCrmOutboxEntry(id: string, data: Partial<CrmOutbox>): Promise<CrmOutbox>;
  getCrmOutboxStats(): Promise<{ pending: number; dryRun: number; sent: number; failed: number }>;

  // U-Storage branches
  getUstorageBranches(): Promise<UstorageBranch[]>;
  getUstorageBranch(id: string): Promise<UstorageBranch | undefined>;
  getUstorageBranchByExternalId(externalId: string): Promise<UstorageBranch | undefined>;
  getUstorageBranchByGooglePlaceId(googlePlaceId: string): Promise<UstorageBranch | undefined>;
  createUstorageBranch(data: InsertUstorageBranch): Promise<UstorageBranch>;
  updateUstorageBranch(id: string, data: Partial<InsertUstorageBranch> & { lastScrapedAt?: Date }): Promise<UstorageBranch>;
  getUstorageSettings(): Promise<UstorageSettings>;
  updateUstorageSettings(data: Partial<InsertUstorageSettings>): Promise<UstorageSettings>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    if (!phone) return undefined;
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || undefined;
  }

  async findOrCreatePlaceholderUser(email?: string, phone?: string, name?: string): Promise<User> {
    // Security: never reuse an existing user record based on email/phone lookup.
    //
    // Reusing existing placeholders is dangerous: an attacker can submit a quote
    // with a victim's email, get a quoteSessionId linked to the victim's placeholder,
    // and then call /api/auth/register with that same email + quoteSessionId to upgrade
    // the victim's account without proving email ownership.
    //
    // Instead, always create a fresh placeholder. Contact details (email, phone, name)
    // are stored on the quote record itself, so the placeholder is only a session anchor.
    // If the real email is already taken (existing user or prior placeholder) we use a
    // synthetic email to satisfy the unique constraint.

    let placeholderEmail: string;
    if (email) {
      const conflict = await this.getUserByEmail(email);
      placeholderEmail = conflict
        ? `placeholder_${Date.now()}_${Math.random().toString(36).slice(2)}@ustoragego.temp`
        : email;
    } else {
      placeholderEmail = `placeholder_${Date.now()}_${Math.random().toString(36).slice(2)}@ustoragego.temp`;
    }

    const placeholderUser: InsertUser = {
      email: placeholderEmail,
      fullName: name || '',
      phone: phone || '',
      userType: 'client',
      preferredLanguage: 'es',
      isActive: true,
    };
    
    const user = await this.createUser(placeholderUser);
    
    // Add client role for the placeholder user
    await this.addUserRole({ userId: user.id, role: 'client' });
    await this.ensureClientCompany(user.id);
    
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  /** Returns the user's durable personal client company, creating it once. */
  async ensureClientCompany(userId: string): Promise<import("@shared/schema").Company> {
    return db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
      const existing = await tx.select({ company: companies }).from(companyMemberships)
        .innerJoin(companies, eq(companyMemberships.companyId, companies.id))
        .where(and(eq(companyMemberships.userId, userId), eq(companyMemberships.status, "active")));
      const client = existing.find(({ company }) =>
        company.isActive && !company.moverProfileId && (company.classification === "client" || company.classification === "both"));
      if (client) return client.company;
      const user = await tx.select().from(users).where(eq(users.id, userId)).then(rows => rows[0]);
      const [company] = await tx.insert(companies).values({
        name: user?.fullName || user?.email || "Client",
        classification: "client", ownerUserId: userId,
      }).returning();
      await tx.insert(companyMemberships).values({
        companyId: company.id, userId, role: "owner", status: "active",
        acceptedAt: new Date(), invitedBy: userId, updatedBy: userId,
      });
      return company;
    });
  }

  // Mover profile operations
  async getMoverProfile(userId: string): Promise<MoverProfile | undefined> {
    const [profile] = await db
      .select()
      .from(moverProfiles)
      .where(eq(moverProfiles.userId, userId));
    return profile || undefined;
  }

  async getMoverProfileById(id: string): Promise<MoverProfile | undefined> {
    const [profile] = await db
      .select()
      .from(moverProfiles)
      .where(eq(moverProfiles.id, id));
    return profile || undefined;
  }

  async getAllMoverProfiles(): Promise<Array<MoverProfile & { user: User }>> {
    const results = await db
      .select({
        profile: moverProfiles,
        user: users,
      })
      .from(moverProfiles)
      .innerJoin(users, eq(moverProfiles.userId, users.id));
    
    return results.map(r => ({
      ...r.profile,
      user: r.user,
    }));
  }

  async createMoverProfile(profile: InsertMoverProfile): Promise<MoverProfile> {
    return db.transaction(async tx => {
      const [moverProfile] = await tx.insert(moverProfiles).values(profile).returning();
      await tx.insert(companies).values({
        id: moverProfile.id, name: moverProfile.companyName, classification: "partner",
        moverProfileId: moverProfile.id, ownerUserId: moverProfile.userId,
        createdAt: moverProfile.createdAt, updatedAt: moverProfile.updatedAt,
      });
      // Legacy first so the compatibility trigger creates a generalized
      // membership with the exact same durable ID.
      await tx.insert(partnerCompanyMemberships).values({
        companyId: moverProfile.id, userId: moverProfile.userId, role: "owner",
        status: "active", acceptedAt: new Date(), invitedBy: moverProfile.userId,
        updatedBy: moverProfile.userId,
      });
      return moverProfile;
    });
  }

  async getCompanyMemberships(userId: string): Promise<PartnerCompanyMembership[]> {
    return db.select().from(partnerCompanyMemberships)
      .where(and(eq(partnerCompanyMemberships.userId, userId), eq(partnerCompanyMemberships.status, "active")));
  }

  async ensureCompanyOwnerMembership(companyId: string, userId: string): Promise<PartnerCompanyMembership> {
    return db.transaction(async tx => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${companyId}))`);
      const [profile] = await tx.select().from(moverProfiles).where(eq(moverProfiles.id, companyId));
      if (!profile) throw new Error("Mover profile not found");
      await tx.insert(companies).values({
        id: profile.id, name: profile.companyName, classification: "partner",
        moverProfileId: profile.id, ownerUserId: userId, isActive: true,
        createdAt: profile.createdAt, updatedAt: profile.updatedAt,
      }).onConflictDoNothing();
      const [existing] = await tx.select().from(partnerCompanyMemberships)
        .where(and(eq(partnerCompanyMemberships.companyId, companyId), eq(partnerCompanyMemberships.userId, userId)));
      if (existing) {
        await tx.insert(companyMemberships).values({
          id: existing.id, companyId, userId: existing.userId, invitedEmail: existing.invitedEmail,
          role: existing.role, status: existing.status, invitationTokenHash: existing.invitationTokenHash,
          acceptedAt: existing.acceptedAt, invitedAt: existing.invitedAt,
          invitedBy: existing.invitedBy, updatedBy: existing.updatedBy, updatedAt: existing.updatedAt,
        }).onConflictDoNothing();
        return existing;
      }
      const [membership] = await tx.insert(partnerCompanyMemberships).values({
        companyId, userId, role: "owner", status: "active", acceptedAt: new Date(), invitedBy: userId, updatedBy: userId,
      }).returning();
      return membership;
    });
  }

  /** Idempotent compatibility backfill: every legacy profile owner gets ownership. */
  async ensureMoverCompanyMemberships(): Promise<number> {
    const profiles = await db.select({ id: moverProfiles.id, userId: moverProfiles.userId }).from(moverProfiles);
    let created = 0;
    for (const profile of profiles) {
      const membership = await db.select({ id: partnerCompanyMemberships.id }).from(partnerCompanyMemberships)
        .where(and(eq(partnerCompanyMemberships.companyId, profile.id), eq(partnerCompanyMemberships.userId, profile.userId)));
      if (!membership.length) {
        await this.ensureCompanyOwnerMembership(profile.id, profile.userId);
        created++;
      }
    }
    return created;
  }

  /**
   * Ensures a mover profile exists for a user. Creates one if it doesn't exist.
   * This is idempotent - safe to call multiple times.
   * @param userId - The user ID to ensure has a mover profile
   * @param defaults - Optional default values for creating the profile
   * @returns The existing or newly created mover profile
   */
  async ensureMoverProfile(
    userId: string,
    defaults?: {
      companyName?: string;
      partnerStatus?: string;
    }
  ): Promise<MoverProfile> {
    // Check if profile already exists
    const existingProfile = await this.getMoverProfile(userId);
    if (existingProfile) {
      return existingProfile;
    }
    
    // Get user to populate defaults
    const user = await this.getUser(userId);
    const companyName = defaults?.companyName || user?.fullName || user?.email || 'Nuevo Socio';
    
    // Create new profile
    const newProfile = await this.createMoverProfile({
      userId,
      companyName,
      partnerStatus: defaults?.partnerStatus || 'pending',
    });
    await this.ensureCompanyOwnerMembership(newProfile.id, userId);
    
    console.log(`[Storage] Created mover profile for user ${userId}: ${newProfile.id}`);
    return newProfile;
  }

  /**
   * Backfill mover profiles for all users with mover role but no profile.
   * @returns Array of created profiles with user info
   */
  async backfillMoverProfiles(): Promise<Array<{ userId: string; profileId: string; companyName: string }>> {
    const createdProfiles: Array<{ userId: string; profileId: string; companyName: string }> = [];
    
    // Get all users with mover role
    const moverUsers = await this.getUsersByRole('mover');
    
    for (const user of moverUsers) {
      // Check if they already have a profile
      const existingProfile = await this.getMoverProfile(user.id);
      if (!existingProfile) {
        const profile = await this.ensureMoverProfile(user.id);
        createdProfiles.push({
          userId: user.id,
          profileId: profile.id,
          companyName: profile.companyName,
        });
      }
    }
    
    console.log(`[Storage] Backfill complete: created ${createdProfiles.length} mover profiles`);
    return createdProfiles;
  }

  async updateMoverProfile(
    userId: string,
    data: Partial<MoverProfile>
  ): Promise<MoverProfile> {
    const [profile] = await db
      .update(moverProfiles)
      .set(data)
      .where(eq(moverProfiles.userId, userId))
      .returning();
    return profile;
  }

  async updateMoverProfileById(
    id: string,
    data: Partial<MoverProfile>
  ): Promise<MoverProfile> {
    const [profile] = await db
      .update(moverProfiles)
      .set(data)
      .where(eq(moverProfiles.id, id))
      .returning();
    return profile;
  }

  async updatePartnerStatus(
    moverProfileId: string,
    status: string,
    actorType: string,
    actorId?: string,
    actorName?: string,
    note?: string
  ): Promise<MoverProfile> {
    const currentProfile = await this.getMoverProfileById(moverProfileId);
    const fromStatus = currentProfile?.partnerStatus || null;
    
    const [updatedProfile] = await db
      .update(moverProfiles)
      .set({
        partnerStatus: status,
        partnerStatusNote: note || null,
        partnerStatusUpdatedAt: new Date(),
        verified: status === 'active',
      })
      .where(eq(moverProfiles.id, moverProfileId))
      .returning();
    
    await db.insert(partnerStatusHistory).values({
      moverProfileId,
      fromStatus,
      toStatus: status,
      actorType,
      actorId: actorId || null,
      actorName: actorName || null,
      note: note || null,
    });
    
    return updatedProfile;
  }

  async getPartnerStatusHistory(moverProfileId: string): Promise<PartnerStatusHistory[]> {
    return db
      .select()
      .from(partnerStatusHistory)
      .where(eq(partnerStatusHistory.moverProfileId, moverProfileId))
      .orderBy(desc(partnerStatusHistory.createdAt));
  }

  async getActivePartners(): Promise<Array<MoverProfile & { user: User }>> {
    const results = await db
      .select({
        profile: moverProfiles,
        user: users,
      })
      .from(moverProfiles)
      .innerJoin(users, eq(moverProfiles.userId, users.id))
      .where(eq(moverProfiles.partnerStatus, 'active'));
    
    return results.map(r => ({ ...r.profile, user: r.user }));
  }

  async getBidsByMoverProfileId(moverProfileId: string): Promise<QuoteBid[]> {
    return db
      .select()
      .from(quoteBids)
      .where(eq(quoteBids.moverProfileId, moverProfileId))
      .orderBy(desc(quoteBids.createdAt));
  }

  async getRatingsByMoverProfileId(moverProfileId: string): Promise<RatingWithDetails[]> {
    const results = await db.select({
      rating: ratings,
      comments: ratingComments,
      rater: users,
    })
      .from(ratings)
      .leftJoin(ratingComments, eq(ratings.id, ratingComments.ratingId))
      .leftJoin(users, eq(ratings.raterUserId, users.id))
      .where(eq(ratings.moverProfileId, moverProfileId))
      .orderBy(desc(ratings.createdAt));
    
    // Get AI tags for each rating
    const ratingIds = results.map(r => r.rating.id);
    const allTags = ratingIds.length > 0 
      ? await db.select().from(ratingAiTags).where(inArray(ratingAiTags.ratingId, ratingIds))
      : [];
    
    return results.map(r => ({
      ...r.rating,
      comments: r.comments || undefined,
      aiTags: allTags.filter(t => t.ratingId === r.rating.id),
      rater: r.rater || undefined,
    }));
  }

  // Quote operations
  async getQuote(id: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.id, id));
    return quote || undefined;
  }

  async getQuoteBySessionId(quoteSessionId: string): Promise<Quote | undefined> {
    const [quote] = await db.select().from(quotes).where(eq(quotes.quoteSessionId, quoteSessionId));
    return quote || undefined;
  }

  async getQuotesByUser(userId: string): Promise<Quote[]> {
    return db.select({ quote: quotes }).from(quotes).leftJoin(companies, eq(quotes.companyId, companies.id))
      .where(and(eq(quotes.userId, userId), or(isNull(quotes.companyId), eq(companies.classification, "client"), eq(companies.classification, "both"))))
      .orderBy(desc(quotes.createdAt)).then(rows => rows.map(row => row.quote));
  }

  async getAllQuotes(): Promise<Quote[]> {
    return db.select().from(quotes).orderBy(desc(quotes.createdAt));
  }

  async createQuote(quote: QuoteCreateInput, options: { deferEligibility?: boolean } = {}): Promise<Quote> {
    assertNoDerivedEligibilityFields(quote);
    const { fromBranchId: _fromBranchId, toBranchId: _toBranchId, ...persistableQuote } = quote;
    // Generate a sequential quote number
    const quoteNumber = await this.generateQuoteNumber();
    let companyId = persistableQuote.companyId;
    if (!companyId && persistableQuote.userId) {
      companyId = (await this.ensureClientCompany(persistableQuote.userId)).id;
    }
    return db.transaction(async (tx) => {
      const eligibility = options.deferEligibility
        ? { serviceMode: "general_point_to_point" }
        : await resolveQuoteEligibility(quote, undefined, tx, true);
      const [newQuote] = await tx.insert(quotes).values({
        ...persistableQuote,
        ...eligibility,
        companyId,
        workflowMode: persistableQuote.workflowMode || "dispatch",
        quoteNumber,
      }).returning();
      return newQuote;
    });
  }

  private async generateQuoteNumber(): Promise<string> {
    // Ensure sequence exists (idempotent - creates if not exists)
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'quote_number_seq') THEN
          CREATE SEQUENCE quote_number_seq START WITH 1 INCREMENT BY 1;
        END IF;
      END $$;
    `);
    // Use PostgreSQL sequence for race-safe sequential numbers
    const result = await db.execute(sql`SELECT nextval('quote_number_seq') as seq_num`);
    const seqNum = Number((result.rows[0] as any)?.seq_num || 1);
    // Format: RK-XXXXXX (6 digits, zero-padded)
    return `RK-${seqNum.toString().padStart(6, '0')}`;
  }

  async updateQuote(id: string, data: QuoteUpdateInput): Promise<Quote> {
    assertNoDerivedEligibilityFields(data);
    const { fromBranchId: _fromBranchId, toBranchId: _toBranchId, ...persistableData } = data;
    return db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(quotes)
        .where(eq(quotes.id, id))
        .for("update");
      if (!existing) throw new Error("Quote not found");
      if (!existing.isPartial && data.isPartial === true) {
        throw new QuoteEligibilityError(
          "CONTEXT_LOCKED",
          "A submitted quote cannot be reopened as a draft",
        );
      }
      if (!existing.isPartial && shouldRecalculateEligibility(data, existing)) {
        throw new QuoteEligibilityError(
          "CONTEXT_LOCKED",
          "Origin, destination, and storage branch cannot be changed after the quote is submitted",
        );
      }
      const eligibility = shouldRecalculateEligibility(data, existing)
        ? await resolveQuoteEligibility(data, existing, tx, true)
        : {};
      const [quote] = await tx
        .update(quotes)
        .set({ ...persistableData, ...eligibility, updatedAt: new Date() })
        .where(eq(quotes.id, id))
        .returning();
      return quote;
    });
  }

  async deleteQuote(id: string): Promise<void> {
    await db.delete(quotes).where(eq(quotes.id, id));
  }

  // Inventory operations
  async getInventoryByQuote(quoteId: string): Promise<InventoryItem[]> {
    return db
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.quoteId, quoteId));
  }

  async addInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const [newItem] = await db
      .insert(inventoryItems)
      .values(item)
      .returning();
    return newItem;
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return item || undefined;
  }

  async updateInventoryItem(id: string, data: Partial<InsertInventoryItem>): Promise<InventoryItem> {
    const [item] = await db
      .update(inventoryItems)
      .set(data)
      .where(eq(inventoryItems.id, id))
      .returning();
    return item;
  }

  async deleteInventoryItem(id: string): Promise<void> {
    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  }

  async deleteInventoryByQuote(quoteId: string): Promise<void> {
    await db.delete(inventoryItems).where(eq(inventoryItems.quoteId, quoteId));
  }

  // Service operations
  async getAllServices(): Promise<Service[]> {
    return db.select().from(services);
  }

  async getActiveServices(): Promise<Service[]> {
    return db.select().from(services).where(eq(services.active, true));
  }

  async getService(id: string): Promise<Service | undefined> {
    const [service] = await db
      .select()
      .from(services)
      .where(eq(services.id, id));
    return service || undefined;
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: string, data: Partial<Service>): Promise<Service> {
    const [service] = await db
      .update(services)
      .set(data)
      .where(eq(services.id, id))
      .returning();
    return service;
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  // Add-on operations
  async getAllAddOns(): Promise<AddOn[]> {
    return db.select().from(addOns);
  }

  async getActiveAddOns(): Promise<AddOn[]> {
    return db.select().from(addOns).where(eq(addOns.active, true));
  }

  async getAddOn(id: string): Promise<AddOn | undefined> {
    const [addOn] = await db.select().from(addOns).where(eq(addOns.id, id));
    return addOn || undefined;
  }

  async createAddOn(addOn: InsertAddOn): Promise<AddOn> {
    const [newAddOn] = await db.insert(addOns).values(addOn).returning();
    return newAddOn;
  }

  async updateAddOn(id: string, data: Partial<AddOn>): Promise<AddOn> {
    const [addOn] = await db
      .update(addOns)
      .set(data)
      .where(eq(addOns.id, id))
      .returning();
    return addOn;
  }

  async deleteAddOn(id: string): Promise<void> {
    await db.delete(addOns).where(eq(addOns.id, id));
  }

  // Quote services and add-ons
  async addServiceToQuote(quoteId: string, serviceId: string): Promise<void> {
    const quote = await this.getQuote(quoteId);
    const creatorId = quote?.createdByAdminId || null;
    const [assignment] = await db.insert(quoteServices).values({
      quoteId,
      serviceId,
      createdByAdminId: creatorId,
      followUpOwnerId: quote?.followUpOwnerId || creatorId,
    }).returning();
    if (creatorId) {
      await db.insert(serviceActivityLog).values({
        quoteServiceId: assignment.id,
        actionType: "service_created",
        actorType: "admin",
        actorId: creatorId,
        metadata: { quoteId },
      });
    }
  }

  async addAddOnToQuote(quoteId: string, addOnId: string): Promise<void> {
    await db.insert(quoteAddOns).values({ quoteId, addOnId });
  }

  async getQuoteServices(quoteId: string): Promise<Service[]> {
    const result = await db
      .select({ service: services })
      .from(quoteServices)
      .innerJoin(services, eq(quoteServices.serviceId, services.id))
      .where(eq(quoteServices.quoteId, quoteId));
    return result.map((r) => r.service);
  }

  async getQuoteServiceAssignments(quoteId: string) {
    return db
      .select({
        id: quoteServices.id,
        service: services,
        createdByAdminId: quoteServices.createdByAdminId,
        followUpOwnerId: quoteServices.followUpOwnerId,
      })
      .from(quoteServices)
      .innerJoin(services, eq(quoteServices.serviceId, services.id))
      .where(eq(quoteServices.quoteId, quoteId));
  }

  async updateQuoteServiceFollowUp(id: string, followUpOwnerId: string, actorId?: string): Promise<void> {
    const [before] = await db.select().from(quoteServices).where(eq(quoteServices.id, id));
    if (!before) throw new Error("Quote service not found");
    await db.update(quoteServices).set({ followUpOwnerId }).where(eq(quoteServices.id, id));
    await db.insert(serviceActivityLog).values({
      quoteServiceId: id,
      actionType: before.followUpOwnerId ? "service_follow_up_reassigned" : "service_follow_up_assigned",
      actorType: "admin",
      actorId,
      metadata: { from: before.followUpOwnerId, to: followUpOwnerId, quoteId: before.quoteId },
    });
  }

  async getQuoteAddOns(quoteId: string): Promise<AddOn[]> {
    const result = await db
      .select({ addOn: addOns })
      .from(quoteAddOns)
      .innerJoin(addOns, eq(quoteAddOns.addOnId, addOns.id))
      .where(eq(quoteAddOns.quoteId, quoteId));
    return result.map((r) => r.addOn);
  }

  // AI Agent config
  async getAiAgentConfig(): Promise<AiAgentConfig | undefined> {
    const [config] = await db.select().from(aiAgentConfig).limit(1);
    return config || undefined;
  }

  async updateAiAgentConfig(
    data: Partial<AiAgentConfig>
  ): Promise<AiAgentConfig> {
    // Get existing config or create if doesn't exist
    const existing = await this.getAiAgentConfig();
    if (existing) {
      const [config] = await db
        .update(aiAgentConfig)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(aiAgentConfig.id, existing.id))
        .returning();
      return config;
    } else {
      // Create default config
      const [config] = await db
        .insert(aiAgentConfig)
        .values({
          name: "Clara",
          greeting:
            "Hi! I'm Clara, your AI moving assistant. How can I help you today?",
          greetingEs:
            "¡Hola! Soy Clara, tu asistente de mudanzas con IA. ¿En qué puedo ayudarte hoy?",
          systemPrompt:
            "You are Clara, a helpful AI assistant for U-Storage Go. Help users with moving-related questions and inventory management.",
          ...data,
        })
        .returning();
      return config;
    }
  }

  // AI Models Management
  async getAiModels(): Promise<AiModel[]> {
    return await db.select().from(aiModels).orderBy(asc(aiModels.sortOrder), asc(aiModels.name));
  }

  async getAiModelById(id: string): Promise<AiModel | undefined> {
    const [model] = await db.select().from(aiModels).where(eq(aiModels.id, id));
    return model;
  }

  async getAiModelByModelId(modelId: string): Promise<AiModel | undefined> {
    const [model] = await db.select().from(aiModels).where(eq(aiModels.modelId, modelId));
    return model;
  }

  async createAiModel(data: InsertAiModel): Promise<AiModel> {
    const [model] = await db.insert(aiModels).values(data).returning();
    return model;
  }

  async updateAiModel(id: string, data: Partial<InsertAiModel>): Promise<AiModel> {
    const updateData: any = { ...data, updatedAt: new Date() };
    const [model] = await db
      .update(aiModels)
      .set(updateData)
      .where(eq(aiModels.id, id))
      .returning();
    return model;
  }

  async deleteAiModel(id: string): Promise<void> {
    await db.delete(aiModels).where(eq(aiModels.id, id));
  }

  // Inventory Categories
  async getInventoryCategories(): Promise<InventoryCategory[]> {
    return await db.select().from(inventoryCategories).orderBy(asc(inventoryCategories.sortOrder));
  }

  async createInventoryCategory(data: InsertInventoryCategory): Promise<InventoryCategory> {
    const [category] = await db.insert(inventoryCategories).values(data).returning();
    return category;
  }

  async updateInventoryCategory(id: string, data: Partial<InsertInventoryCategory>): Promise<InventoryCategory> {
    const [category] = await db
      .update(inventoryCategories)
      .set(data)
      .where(eq(inventoryCategories.id, id))
      .returning();
    return category;
  }

  async deleteInventoryCategory(id: string): Promise<void> {
    await db.delete(inventoryCategories).where(eq(inventoryCategories.id, id));
  }

  // Inventory Rooms
  async getInventoryRooms(): Promise<InventoryRoom[]> {
    return await db.select().from(inventoryRooms).orderBy(asc(inventoryRooms.sortOrder));
  }

  async createInventoryRoom(data: InsertInventoryRoom): Promise<InventoryRoom> {
    const [room] = await db.insert(inventoryRooms).values(data).returning();
    return room;
  }

  async updateInventoryRoom(id: string, data: Partial<InsertInventoryRoom>): Promise<InventoryRoom> {
    const [room] = await db
      .update(inventoryRooms)
      .set(data)
      .where(eq(inventoryRooms.id, id))
      .returning();
    return room;
  }

  async deleteInventoryRoom(id: string): Promise<void> {
    await db.delete(inventoryRooms).where(eq(inventoryRooms.id, id));
  }

  // Category Keywords (for CSV/document parsing inference)
  async getCategoryKeywords(): Promise<InventoryCategoryKeyword[]> {
    return await db.select().from(inventoryCategoryKeywords).orderBy(desc(inventoryCategoryKeywords.priority));
  }

  async getCategoryKeywordsByCategory(categoryKey: string): Promise<InventoryCategoryKeyword[]> {
    return await db.select().from(inventoryCategoryKeywords)
      .where(eq(inventoryCategoryKeywords.categoryKey, categoryKey))
      .orderBy(desc(inventoryCategoryKeywords.priority));
  }

  async createCategoryKeyword(data: InsertInventoryCategoryKeyword): Promise<InventoryCategoryKeyword> {
    const [keyword] = await db.insert(inventoryCategoryKeywords).values(data).returning();
    return keyword;
  }

  async updateCategoryKeyword(id: string, data: Partial<InsertInventoryCategoryKeyword>): Promise<InventoryCategoryKeyword> {
    const [keyword] = await db
      .update(inventoryCategoryKeywords)
      .set(data)
      .where(eq(inventoryCategoryKeywords.id, id))
      .returning();
    return keyword;
  }

  async deleteCategoryKeyword(id: string): Promise<void> {
    await db.delete(inventoryCategoryKeywords).where(eq(inventoryCategoryKeywords.id, id));
  }

  // Room Keywords (for CSV/document parsing inference)
  async getRoomKeywords(): Promise<InventoryRoomKeyword[]> {
    return await db.select().from(inventoryRoomKeywords).orderBy(desc(inventoryRoomKeywords.priority));
  }

  async getRoomKeywordsByRoom(roomKey: string): Promise<InventoryRoomKeyword[]> {
    return await db.select().from(inventoryRoomKeywords)
      .where(eq(inventoryRoomKeywords.roomKey, roomKey))
      .orderBy(desc(inventoryRoomKeywords.priority));
  }

  async createRoomKeyword(data: InsertInventoryRoomKeyword): Promise<InventoryRoomKeyword> {
    const [keyword] = await db.insert(inventoryRoomKeywords).values(data).returning();
    return keyword;
  }

  async updateRoomKeyword(id: string, data: Partial<InsertInventoryRoomKeyword>): Promise<InventoryRoomKeyword> {
    const [keyword] = await db
      .update(inventoryRoomKeywords)
      .set(data)
      .where(eq(inventoryRoomKeywords.id, id))
      .returning();
    return keyword;
  }

  async deleteRoomKeyword(id: string): Promise<void> {
    await db.delete(inventoryRoomKeywords).where(eq(inventoryRoomKeywords.id, id));
  }

  // Truck types
  async getTruckTypes(): Promise<TruckType[]> {
    return await db.select().from(truckTypes).orderBy(asc(truckTypes.sortOrder));
  }

  async getTruckType(id: string): Promise<TruckType | undefined> {
    const [truck] = await db.select().from(truckTypes).where(eq(truckTypes.id, id));
    return truck || undefined;
  }

  async createTruckType(data: InsertTruckType): Promise<TruckType> {
    const [truck] = await db.insert(truckTypes).values(data).returning();
    return truck;
  }

  async updateTruckType(id: string, data: Partial<InsertTruckType>): Promise<TruckType> {
    const [truck] = await db
      .update(truckTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(truckTypes.id, id))
      .returning();
    return truck;
  }

  async deleteTruckType(id: string): Promise<void> {
    const referenced = await db.select({ id: partnerVehicles.id }).from(partnerVehicles).where(eq(partnerVehicles.truckTypeId, id)).limit(1);
    if (referenced.length) throw new Error("Truck type is referenced by fleet history and cannot be deleted; deactivate it instead");
    await db.delete(truckTypes).where(eq(truckTypes.id, id));
  }

  // Website config
  async getWebsiteConfig(): Promise<WebsiteConfig | undefined> {
    const [config] = await db.select().from(websiteConfig).limit(1);
    return config || undefined;
  }

  async updateWebsiteConfig(
    data: Partial<WebsiteConfig>
  ): Promise<WebsiteConfig> {
    const existing = await this.getWebsiteConfig();
    if (existing) {
      const [config] = await db
        .update(websiteConfig)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(websiteConfig.id, existing.id))
        .returning();
      return config;
    } else {
      // Create default config
      const [config] = await db
        .insert(websiteConfig)
        .values({
          siteName: "U-Storage Go",
          domain: "ustoragego.com",
          primaryColor: "#1A1A1A",
          secondaryColor: "#627685",
          accentColor: "#EF7521",
          ...data,
        })
        .returning();
      return config;
    }
  }

  // Platform secrets (admin-configurable API keys)
  async getPlatformSecret(key: string): Promise<string | undefined> {
    const [secret] = await db
      .select()
      .from(platformSecrets)
      .where(eq(platformSecrets.key, key))
      .limit(1);
    return secret?.value;
  }

  async setPlatformSecret(key: string, value: string, provider: string, userId?: string): Promise<void> {
    const existing = await db
      .select()
      .from(platformSecrets)
      .where(eq(platformSecrets.key, key))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(platformSecrets)
        .set({ value, provider, lastUpdatedBy: userId, updatedAt: new Date() })
        .where(eq(platformSecrets.key, key));
    } else {
      await db
        .insert(platformSecrets)
        .values({ key, value, provider, lastUpdatedBy: userId });
    }
  }

  async deletePlatformSecret(key: string): Promise<void> {
    await db.delete(platformSecrets).where(eq(platformSecrets.key, key));
  }

  async getPlatformSecretsByProvider(provider: string): Promise<{ key: string; lastUpdated: Date }[]> {
    const secrets = await db
      .select({ key: platformSecrets.key, lastUpdated: platformSecrets.updatedAt })
      .from(platformSecrets)
      .where(eq(platformSecrets.provider, provider));
    return secrets.map(s => ({ key: s.key, lastUpdated: s.lastUpdated }));
  }

  // Stripe profiles (multiple accounts)
  async getStripeProfiles(): Promise<StripeProfile[]> {
    return await db.select().from(stripeProfiles).orderBy(desc(stripeProfiles.isActive), asc(stripeProfiles.name));
  }

  async getStripeProfile(id: string): Promise<StripeProfile | undefined> {
    const [profile] = await db.select().from(stripeProfiles).where(eq(stripeProfiles.id, id)).limit(1);
    return profile;
  }

  async getActiveStripeProfile(): Promise<StripeProfile | undefined> {
    const [profile] = await db.select().from(stripeProfiles).where(eq(stripeProfiles.isActive, true)).limit(1);
    return profile;
  }

  async createStripeProfile(data: InsertStripeProfile): Promise<StripeProfile> {
    // If this is the first profile or marked as active, deactivate others
    if (data.isActive) {
      await db.update(stripeProfiles).set({ isActive: false });
    }
    const [profile] = await db.insert(stripeProfiles).values(data).returning();
    return profile;
  }

  async updateStripeProfile(id: string, data: Partial<InsertStripeProfile>): Promise<StripeProfile> {
    // If setting as active, deactivate others first
    if (data.isActive) {
      await db.update(stripeProfiles).set({ isActive: false });
    }
    const [profile] = await db
      .update(stripeProfiles)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(stripeProfiles.id, id))
      .returning();
    return profile;
  }

  async deleteStripeProfile(id: string): Promise<void> {
    await db.delete(stripeProfiles).where(eq(stripeProfiles.id, id));
  }

  async setActiveStripeProfile(id: string): Promise<void> {
    // Deactivate all profiles first
    await db.update(stripeProfiles).set({ isActive: false });
    // Activate the selected one
    await db.update(stripeProfiles).set({ isActive: true, updatedAt: new Date() }).where(eq(stripeProfiles.id, id));
  }

  // Pricing defaults
  async getPricingDefaults(): Promise<import("@shared/schema").PricingDefaults | undefined> {
    const { pricingDefaults } = await import("@shared/schema");
    const [defaults] = await db.select().from(pricingDefaults).limit(1);
    return defaults || undefined;
  }

  async updatePricingDefaults(
    data: Partial<import("@shared/schema").PricingDefaults>
  ): Promise<import("@shared/schema").PricingDefaults> {
    const { pricingDefaults } = await import("@shared/schema");
    const existing = await this.getPricingDefaults();
    if (existing) {
      const [defaults] = await db
        .update(pricingDefaults)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(pricingDefaults.id, existing.id))
        .returning();
      return defaults;
    } else {
      const [defaults] = await db
        .insert(pricingDefaults)
        .values({
          ...data,
        })
        .returning();
      return defaults;
    }
  }

  // Saved addresses
  async getSavedAddresses(userId: string): Promise<SavedAddress[]> {
    return db.select({ address: savedAddresses }).from(savedAddresses)
      .leftJoin(companies, eq(savedAddresses.companyId, companies.id))
      .where(and(eq(savedAddresses.userId, userId), or(isNull(savedAddresses.companyId), eq(companies.classification, "client"), eq(companies.classification, "both"))))
      .then(rows => rows.map(row => row.address));
  }

  async getSavedAddress(id: string): Promise<SavedAddress | undefined> {
    const [address] = await db
      .select()
      .from(savedAddresses)
      .where(eq(savedAddresses.id, id));
    return address;
  }

  async createSavedAddress(address: InsertSavedAddress): Promise<SavedAddress> {
    let companyId = address.companyId;
    if (!companyId) companyId = (await this.ensureClientCompany(address.userId)).id;
    const [newAddress] = await db
      .insert(savedAddresses)
      .values({ ...address, companyId })
      .returning();
    return newAddress;
  }

  async updateSavedAddress(id: string, data: Partial<InsertSavedAddress>): Promise<SavedAddress> {
    const [updated] = await db
      .update(savedAddresses)
      .set(data)
      .where(eq(savedAddresses.id, id))
      .returning();
    return updated;
  }

  async deleteSavedAddress(id: string): Promise<void> {
    await db.delete(savedAddresses).where(eq(savedAddresses.id, id));
  }

  // Quote management for admin
  async getAdminQuotesList(status?: string): Promise<QuoteWithDetails[]> {
    const baseQuery = db
      .select({
        quote: quotes,
        user: users,
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.userId, users.id))
      .orderBy(desc(quotes.createdAt));
    
    const results = status 
      ? await baseQuery.where(eq(quotes.workflowStatus, status))
      : await baseQuery;
    
    const quotesWithDetails: QuoteWithDetails[] = [];
    
    for (const r of results) {
      const [inventoryList, serviceAssignments, addOnsList, invitationsList, bidsList, creator, followUpOwner] = await Promise.all([
        this.getInventoryByQuote(r.quote.id),
        this.getQuoteServiceAssignments(r.quote.id),
        this.getQuoteAddOns(r.quote.id),
        this.getQuoteInvitations(r.quote.id),
        this.getQuoteBids(r.quote.id),
        r.quote.createdByAdminId ? this.getUser(r.quote.createdByAdminId) : Promise.resolve(undefined),
        r.quote.followUpOwnerId ? this.getUser(r.quote.followUpOwnerId) : Promise.resolve(undefined),
      ]);
      
      let assignedMover: MoverProfile | null = null;
      if (r.quote.assignedMoverProfileId) {
        const [mover] = await db
          .select()
          .from(moverProfiles)
          .where(eq(moverProfiles.id, r.quote.assignedMoverProfileId));
        assignedMover = mover || null;
      }
      
      quotesWithDetails.push({
        ...r.quote,
        user: r.user,
        creator,
        followUpOwner,
        inventoryItems: inventoryList,
        quoteServices: serviceAssignments,
        quoteAddOns: addOnsList.map(a => ({ addOn: a })),
        invitations: invitationsList,
        bids: bidsList,
        assignedMover,
      });
    }
    
    return quotesWithDetails;
  }

  async getQuoteWithDetails(id: string): Promise<QuoteWithDetails | undefined> {
    const [result] = await db
      .select({
        quote: quotes,
        user: users,
      })
      .from(quotes)
      .leftJoin(users, eq(quotes.userId, users.id))
      .where(eq(quotes.id, id));
    
    if (!result) return undefined;
    
    const [inventoryList, serviceAssignments, addOnsList, invitationsList, bidsList, creator, followUpOwner] = await Promise.all([
      this.getInventoryByQuote(id),
      this.getQuoteServiceAssignments(id),
      this.getQuoteAddOns(id),
      this.getQuoteInvitations(id),
      this.getQuoteBids(id),
      result.quote.createdByAdminId ? this.getUser(result.quote.createdByAdminId) : Promise.resolve(undefined),
      result.quote.followUpOwnerId ? this.getUser(result.quote.followUpOwnerId) : Promise.resolve(undefined),
    ]);
    const servicePeople = await Promise.all(serviceAssignments.map(async (assignment) => ({
      ...assignment,
      creator: assignment.createdByAdminId ? await this.getUser(assignment.createdByAdminId) : undefined,
      followUpOwner: assignment.followUpOwnerId ? await this.getUser(assignment.followUpOwnerId) : undefined,
    })));
    
    let assignedMover: MoverProfile | null = null;
    if (result.quote.assignedMoverProfileId) {
      const [mover] = await db
        .select()
        .from(moverProfiles)
        .where(eq(moverProfiles.id, result.quote.assignedMoverProfileId));
      assignedMover = mover || null;
    }
    
    return {
      ...result.quote,
      user: result.user,
      creator,
      followUpOwner,
      inventoryItems: inventoryList,
      quoteServices: servicePeople,
      quoteAddOns: addOnsList.map(a => ({ addOn: a })),
      invitations: invitationsList,
      bids: bidsList,
      assignedMover,
    };
  }

  async updateQuoteWorkflow(id: string, data: Partial<Quote>, actorId?: string, note?: string): Promise<Quote> {
    const existing = await this.getQuote(id);
    const fromStatus = existing?.workflowStatus;
    
    // Sync biddingStatus based on workflowStatus changes
    const updateData = { ...data, updatedAt: new Date() };
    if (data.workflowStatus) {
      if (data.workflowStatus === 'bidding_open') {
        updateData.biddingStatus = 'open';
      } else if (data.workflowStatus === 'selection') {
        updateData.biddingStatus = 'closed';
      } else if (data.workflowStatus === 'confirmed' || data.workflowStatus === 'scheduled' || data.workflowStatus === 'in_progress' || data.workflowStatus === 'completed') {
        updateData.biddingStatus = 'assigned';
      } else if (data.workflowStatus === 'cancelled') {
        updateData.biddingStatus = 'discarded';
      }
    }
    
    const [quote] = await db
      .update(quotes)
      .set(updateData)
      .where(eq(quotes.id, id))
      .returning();
    
    if (data.workflowStatus && data.workflowStatus !== fromStatus) {
      await this.addQuoteStatusHistory({
        quoteId: id,
        fromStatus,
        toStatus: data.workflowStatus,
        actorType: actorId ? 'admin' : 'system',
        actorId,
        note,
      });
    }
    
    return quote;
  }

  // Get single quote invitation by ID
  async getQuoteInvitation(id: string): Promise<QuoteInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(quoteInvitations)
      .where(eq(quoteInvitations.id, id));
    return invitation || undefined;
  }

  // Quote invitations
  async getQuoteInvitations(quoteId: string): Promise<(QuoteInvitation & { moverProfile: MoverProfile })[]> {
    const results = await db
      .select({
        invitation: quoteInvitations,
        moverProfile: moverProfiles,
      })
      .from(quoteInvitations)
      .innerJoin(moverProfiles, eq(quoteInvitations.moverProfileId, moverProfiles.id))
      .where(eq(quoteInvitations.quoteId, quoteId))
      .orderBy(desc(quoteInvitations.createdAt));
    
    return results.map(r => ({
      ...r.invitation,
      moverProfile: r.moverProfile,
    }));
  }

  async createQuoteInvitation(invitation: InsertQuoteInvitation): Promise<QuoteInvitation> {
    const [newInvitation] = await db
      .insert(quoteInvitations)
      .values(invitation)
      .returning();
    return newInvitation;
  }

  async updateQuoteInvitation(id: string, data: Partial<QuoteInvitation>): Promise<QuoteInvitation> {
    const [invitation] = await db
      .update(quoteInvitations)
      .set(data)
      .where(eq(quoteInvitations.id, id))
      .returning();
    return invitation;
  }

  async getMoverInvitations(moverProfileId: string): Promise<(QuoteInvitation & { quote: Quote })[]> {
    const results = await db
      .select({
        invitation: quoteInvitations,
        quote: quotes,
      })
      .from(quoteInvitations)
      .innerJoin(quotes, eq(quoteInvitations.quoteId, quotes.id))
      .where(eq(quoteInvitations.moverProfileId, moverProfileId))
      .orderBy(desc(quoteInvitations.createdAt));
    
    return results.map(r => ({
      ...r.invitation,
      quote: r.quote,
    }));
  }

  // Get single quote bid by ID
  async getQuoteBid(id: string): Promise<QuoteBid | undefined> {
    const [bid] = await db
      .select()
      .from(quoteBids)
      .where(eq(quoteBids.id, id));
    return bid || undefined;
  }

  // Quote bids
  async getQuoteBids(quoteId: string): Promise<(QuoteBid & { moverProfile: MoverProfile })[]> {
    const results = await db
      .select({
        bid: quoteBids,
        moverProfile: moverProfiles,
      })
      .from(quoteBids)
      .innerJoin(moverProfiles, eq(quoteBids.moverProfileId, moverProfiles.id))
      .where(eq(quoteBids.quoteId, quoteId))
      .orderBy(desc(quoteBids.createdAt));
    
    return results.map(r => ({
      ...r.bid,
      moverProfile: r.moverProfile,
    }));
  }

  async createQuoteBid(bid: InsertQuoteBid): Promise<QuoteBid> {
    const [newBid] = await db
      .insert(quoteBids)
      .values(bid)
      .returning();
    return newBid;
  }

  async updateQuoteBid(id: string, data: Partial<QuoteBid>): Promise<QuoteBid> {
    const [bid] = await db
      .update(quoteBids)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(quoteBids.id, id))
      .returning();
    return bid;
  }

  async getBidsByMover(moverProfileId: string): Promise<QuoteBid[]> {
    return db
      .select()
      .from(quoteBids)
      .where(eq(quoteBids.moverProfileId, moverProfileId))
      .orderBy(desc(quoteBids.createdAt));
  }

  async getBidsByMoverWithDetails(moverProfileId: string): Promise<(QuoteBid & { quote: Quote })[]> {
    const results = await db
      .select({
        bid: quoteBids,
        quote: quotes,
      })
      .from(quoteBids)
      .innerJoin(quotes, eq(quoteBids.quoteId, quotes.id))
      .where(eq(quoteBids.moverProfileId, moverProfileId))
      .orderBy(desc(quoteBids.createdAt));
    
    return results.map(r => ({
      ...r.bid,
      quote: r.quote,
    }));
  }

  async acceptBid(bidId: string, quoteId: string): Promise<void> {
    const [acceptedBid] = await db
      .select()
      .from(quoteBids)
      .where(eq(quoteBids.id, bidId));
    
    if (!acceptedBid) throw new Error('Bid not found');
    
    await db
      .update(quoteBids)
      .set({ status: 'accepted', updatedAt: new Date() })
      .where(eq(quoteBids.id, bidId));
    
    await db
      .update(quoteBids)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(and(
        eq(quoteBids.quoteId, quoteId),
        eq(quoteBids.status, 'submitted')
      ));
    
    await db
      .update(quotes)
      .set({
        assignedMoverProfileId: acceptedBid.moverProfileId,
        finalPrice: acceptedBid.amount,
        workflowStatus: 'confirmed',
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId));
    
    await db
      .update(quoteInvitations)
      .set({ status: 'accepted' })
      .where(and(
        eq(quoteInvitations.quoteId, quoteId),
        eq(quoteInvitations.moverProfileId, acceptedBid.moverProfileId)
      ));
  }

  // Bulk create invitations for multiple partners
  async createBulkQuoteInvitations(invitations: InsertQuoteInvitation[]): Promise<QuoteInvitation[]> {
    if (invitations.length === 0) return [];
    const newInvitations = await db
      .insert(quoteInvitations)
      .values(invitations)
      .returning();
    return newInvitations;
  }

  // Get invitations with full quote details for partner dashboard
  async getMoverInvitationsWithDetails(moverProfileId: string): Promise<(QuoteInvitation & { quote: Quote & { inventoryItems?: any[] } })[]> {
    const results = await db
      .select({
        invitation: quoteInvitations,
        quote: quotes,
      })
      .from(quoteInvitations)
      .innerJoin(quotes, eq(quoteInvitations.quoteId, quotes.id))
      .where(eq(quoteInvitations.moverProfileId, moverProfileId))
      .orderBy(desc(quoteInvitations.createdAt));
    
    // Fetch inventory items for each quote
    const enrichedResults = await Promise.all(
      results.map(async (r) => {
        const items = await db
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.quoteId, r.quote.id));
        return {
          ...r.invitation,
          quote: {
            ...r.quote,
            inventoryItems: items,
          },
        };
      })
    );
    
    return enrichedResults;
  }

  // Get approved bids for client to select from
  async getApprovedBidsForClient(quoteId: string): Promise<(QuoteBid & { moverProfile: MoverProfile })[]> {
    const results = await db
      .select({
        bid: quoteBids,
        moverProfile: moverProfiles,
      })
      .from(quoteBids)
      .innerJoin(moverProfiles, eq(quoteBids.moverProfileId, moverProfiles.id))
      .where(and(
        eq(quoteBids.quoteId, quoteId),
        eq(quoteBids.adminReviewStatus, 'approved'),
        eq(quoteBids.status, 'submitted')
      ))
      .orderBy(quoteBids.amount);
    
    return results.map(r => ({
      ...r.bid,
      moverProfile: r.moverProfile,
    }));
  }

  // Admin reviews a bid (approve or reject)
  async adminReviewBid(bidId: string, status: 'approved' | 'rejected', adminId: string, note?: string): Promise<QuoteBid> {
    const [bid] = await db
      .update(quoteBids)
      .set({
        adminReviewStatus: status,
        adminReviewedAt: new Date(),
        adminReviewedBy: adminId,
        adminReviewNote: note,
        updatedAt: new Date(),
      })
      .where(eq(quoteBids.id, bidId))
      .returning();
    return bid;
  }

  // Client selects a bid
  async clientSelectBid(quoteId: string, bidId: string): Promise<Quote> {
    const [updatedQuote] = await db
      .update(quotes)
      .set({
        selectedBidId: bidId,
        partnerSelectionStatus: 'client_selected',
        partnerSelectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId))
      .returning();
    
    // Mark the bid as selected by user
    await db
      .update(quoteBids)
      .set({
        userSelectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(quoteBids.id, bidId));
    
    return updatedQuote;
  }

  // Admin gives final approval to finalize the partner
  async adminFinalApproval(quoteId: string, adminId: string): Promise<Quote> {
    const [quote] = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, quoteId));
    
    if (!quote || !quote.selectedBidId) {
      throw new Error('No bid selected for this quote');
    }
    
    const [selectedBid] = await db
      .select()
      .from(quoteBids)
      .where(eq(quoteBids.id, quote.selectedBidId));
    
    if (!selectedBid) {
      throw new Error('Selected bid not found');
    }
    
    // Update the bid with final approval
    await db
      .update(quoteBids)
      .set({
        status: 'accepted',
        finalApprovalAt: new Date(),
        finalApprovedBy: adminId,
        updatedAt: new Date(),
      })
      .where(eq(quoteBids.id, quote.selectedBidId));
    
    // Reject all other bids
    await db
      .update(quoteBids)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(and(
        eq(quoteBids.quoteId, quoteId),
        sql`${quoteBids.id} != ${quote.selectedBidId}`,
        eq(quoteBids.status, 'submitted')
      ));
    
    // Update the quote with finalized partner
    const [updatedQuote] = await db
      .update(quotes)
      .set({
        partnerSelectionStatus: 'finalized',
        partnerFinalizedAt: new Date(),
        assignedMoverProfileId: selectedBid.moverProfileId,
        finalPrice: selectedBid.amount,
        workflowStatus: 'confirmed',
        updatedAt: new Date(),
      })
      .where(eq(quotes.id, quoteId))
      .returning();
    
    // Update invitations
    await db
      .update(quoteInvitations)
      .set({ status: 'accepted' })
      .where(and(
        eq(quoteInvitations.quoteId, quoteId),
        eq(quoteInvitations.moverProfileId, selectedBid.moverProfileId)
      ));
    
    await db
      .update(quoteInvitations)
      .set({ status: 'rejected' })
      .where(and(
        eq(quoteInvitations.quoteId, quoteId),
        sql`${quoteInvitations.moverProfileId} != ${selectedBid.moverProfileId}`
      ));
    
    return updatedQuote;
  }

  // Quote status history
  async addQuoteStatusHistory(entry: InsertQuoteStatusHistory): Promise<QuoteStatusHistory> {
    const [history] = await db
      .insert(quoteStatusHistory)
      .values(entry)
      .returning();
    return history;
  }

  async getQuoteStatusHistory(quoteId: string): Promise<QuoteStatusHistory[]> {
    return db
      .select()
      .from(quoteStatusHistory)
      .where(eq(quoteStatusHistory.quoteId, quoteId))
      .orderBy(desc(quoteStatusHistory.createdAt));
  }

  // Quote activity log - comprehensive tracking
  async createQuoteActivityLog(log: InsertQuoteActivityLog): Promise<QuoteActivityLog> {
    const [result] = await db.insert(quoteActivityLog).values(log).returning();
    return result;
  }

  async getQuoteActivityLog(quoteId: string): Promise<QuoteActivityLog[]> {
    return db
      .select()
      .from(quoteActivityLog)
      .where(eq(quoteActivityLog.quoteId, quoteId))
      .orderBy(desc(quoteActivityLog.createdAt));
  }

  // User roles - multi-role support
  async getUserRoles(userId: string): Promise<UserRole[]> {
    return db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true)));
  }

  async addUserRole(role: InsertUserRole): Promise<UserRole> {
    // Check if role already exists for user
    const [existing] = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, role.userId), eq(userRoles.role, role.role)));
    
    if (existing) {
      // Reactivate if inactive
      if (!existing.isActive) {
        const [updated] = await db
          .update(userRoles)
          .set({ isActive: true, grantedBy: role.grantedBy, grantedAt: new Date() })
          .where(eq(userRoles.id, existing.id))
          .returning();
        return updated;
      }
      return existing;
    }
    
    const [newRole] = await db.insert(userRoles).values(role).returning();
    return newRole;
  }

  async removeUserRole(userId: string, role: string): Promise<void> {
    await db
      .update(userRoles)
      .set({ isActive: false })
      .where(and(eq(userRoles.userId, userId), eq(userRoles.role, role)));
  }

  async hasRole(userId: string, role: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(userRoles)
      .where(and(
        eq(userRoles.userId, userId),
        eq(userRoles.role, role),
        eq(userRoles.isActive, true)
      ));
    return !!result;
  }

  async getUsersByRole(role: string): Promise<User[]> {
    const results = await db
      .select({ user: users })
      .from(userRoles)
      .innerJoin(users, eq(userRoles.userId, users.id))
      .where(and(eq(userRoles.role, role), eq(userRoles.isActive, true)));
    return results.map(r => r.user);
  }

  async getUserRolesByUserIds(userIds: string[]): Promise<UserRole[]> {
    if (userIds.length === 0) return [];
    return db
      .select()
      .from(userRoles)
      .where(inArray(userRoles.userId, userIds));
  }

  async syncUserRoles(userId: string, newRoles: string[], grantedBy?: string | null): Promise<void> {
    const currentRoles = await this.getUserRoles(userId);
    const currentRoleNames = currentRoles.map(r => r.role);
    
    // Add new roles
    for (const role of newRoles) {
      if (!currentRoleNames.includes(role)) {
        await this.addUserRole({ userId, role, grantedBy: grantedBy || null });
      }
    }
    
    // Remove roles that are no longer selected
    for (const role of currentRoleNames) {
      if (!newRoles.includes(role)) {
        await this.removeUserRole(userId, role);
      }
    }
  }

  // Activity logs - platform-wide tracking
  async logActivity(log: InsertActivityLog): Promise<ActivityLog> {
    const [activity] = await db.insert(activityLogs).values(log).returning();
    return activity;
  }

  async getUserActivityLogs(userId: string, limit: number = 50): Promise<ActivityLog[]> {
    return db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.userId, userId))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
  }

  async getActivityLogsByEntity(entityType: string, entityId: string): Promise<ActivityLog[]> {
    return db
      .select()
      .from(activityLogs)
      .where(and(eq(activityLogs.entityType, entityType), eq(activityLogs.entityId, entityId)))
      .orderBy(desc(activityLogs.createdAt));
  }

  async getRecentActivityLogs(limit: number = 100): Promise<(ActivityLog & { user?: User })[]> {
    const results = await db
      .select({ log: activityLogs, user: users })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.userId, users.id))
      .orderBy(desc(activityLogs.createdAt))
      .limit(limit);
    return results.map(r => ({ ...r.log, user: r.user || undefined }));
  }

  async getLastActiveByUserIds(userIds: string[]): Promise<Map<string, Date>> {
    if (userIds.length === 0) return new Map();
    
    // Get the most recent activity for each user
    const results = await db
      .select({
        userId: activityLogs.userId,
        lastActive: sql<Date>`MAX(${activityLogs.createdAt})`.as('last_active'),
      })
      .from(activityLogs)
      .where(inArray(activityLogs.userId, userIds))
      .groupBy(activityLogs.userId);
    
    const map = new Map<string, Date>();
    for (const row of results) {
      if (row.userId && row.lastActive) {
        map.set(row.userId, new Date(row.lastActive));
      }
    }
    return map;
  }

  async updateActivityLogDetails(id: string, details: Record<string, any>): Promise<ActivityLog> {
    // Merge new details with existing details
    const existing = await this.getActivityLog(id);
    if (!existing) {
      throw new Error(`Activity log not found: ${id}`);
    }
    const mergedDetails = { ...((existing.details as Record<string, any>) || {}), ...details };
    const [updated] = await db
      .update(activityLogs)
      .set({ details: mergedDetails })
      .where(eq(activityLogs.id, id))
      .returning();
    return updated;
  }

  async getActivityLog(id: string): Promise<ActivityLog | undefined> {
    const [result] = await db
      .select()
      .from(activityLogs)
      .where(eq(activityLogs.id, id));
    return result;
  }

  async getCalculationLogsBySessionId(sessionId: string): Promise<ActivityLog[]> {
    const results = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.action, 'estimate.calculated'),
          sql`${activityLogs.details}->>'quoteSessionId' = ${sessionId}`
        )
      )
      .orderBy(desc(activityLogs.createdAt));
    return results;
  }

  async getUnlinkedCalculationLogs(): Promise<ActivityLog[]> {
    const results = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.action, 'estimate.calculated'),
          sql`${activityLogs.details}->>'linkedQuoteId' IS NULL`
        )
      )
      .orderBy(desc(activityLogs.createdAt));
    return results;
  }

  async getQuotesBySessionId(sessionId: string): Promise<Quote[]> {
    const linkedLogs = await db
      .select()
      .from(activityLogs)
      .where(
        and(
          eq(activityLogs.action, 'estimate.calculated'),
          sql`${activityLogs.details}->>'quoteSessionId' = ${sessionId}`,
          sql`${activityLogs.details}->>'linkedQuoteId' IS NOT NULL`
        )
      )
      .limit(1);
    
    if (linkedLogs.length === 0) return [];
    
    const quoteId = (linkedLogs[0].details as any)?.linkedQuoteId;
    if (!quoteId) return [];
    
    const result = await db
      .select()
      .from(quotes)
      .where(eq(quotes.id, quoteId));
    
    return result;
  }

  async getQuotesByUserInTimeWindow(userId: string, minTime: Date, maxTime: Date): Promise<Quote[]> {
    const results = await db
      .select()
      .from(quotes)
      .where(
        and(
          eq(quotes.userId, userId),
          gte(quotes.createdAt, minTime),
          lte(quotes.createdAt, maxTime)
        )
      )
      .orderBy(quotes.createdAt);
    return results;
  }

  // Password reset tokens
  async getRecentPasswordResetToken(userId: string, windowMs: number): Promise<boolean> {
    const since = new Date(Date.now() - windowMs);
    const [result] = await db
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          sql`${passwordResetTokens.createdAt} > ${since.toISOString()}`,
          sql`${passwordResetTokens.usedAt} IS NULL`
        )
      )
      .limit(1);
    return !!result;
  }

  async createPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    // Revoke all existing unused tokens for this user before issuing a new one
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          sql`${passwordResetTokens.usedAt} IS NULL`
        )
      );
    await db.insert(passwordResetTokens).values({
      userId,
      token,
      expiresAt,
    });
  }

  async getValidPasswordResetToken(token: string): Promise<{ id: string; userId: string; expiresAt: Date } | undefined> {
    const [result] = await db
      .select()
      .from(passwordResetTokens)
      .where(and(
        eq(passwordResetTokens.token, token),
        sql`${passwordResetTokens.expiresAt} > NOW()`,
        sql`${passwordResetTokens.usedAt} IS NULL`
      ));
    return result ? { id: result.id, userId: result.userId, expiresAt: result.expiresAt } : undefined;
  }

  async markPasswordResetTokenUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.token, token));
  }

  async revokeAllPasswordResetTokens(userId: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          sql`${passwordResetTokens.usedAt} IS NULL`
        )
      );
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(sql`${passwordResetTokens.expiresAt} < NOW()`);
  }

  // Email senders management
  async getEmailSenders(): Promise<EmailSender[]> {
    return db.select().from(emailSenders).orderBy(desc(emailSenders.isDefault), asc(emailSenders.displayName));
  }

  async getEmailSenderById(id: string): Promise<EmailSender | null> {
    const [sender] = await db.select().from(emailSenders).where(eq(emailSenders.id, id));
    return sender || null;
  }

  async getDefaultEmailSender(): Promise<EmailSender | null> {
    const [sender] = await db.select().from(emailSenders).where(eq(emailSenders.isDefault, true)).limit(1);
    return sender || null;
  }

  async createEmailSender(data: InsertEmailSender): Promise<EmailSender> {
    // If this is set as default, unset other defaults first
    if (data.isDefault) {
      await db.update(emailSenders).set({ isDefault: false }).where(eq(emailSenders.isDefault, true));
    }
    const [sender] = await db.insert(emailSenders).values(data).returning();
    return sender;
  }

  async updateEmailSender(id: string, data: Partial<InsertEmailSender>): Promise<EmailSender> {
    // If setting as default, unset other defaults first
    if (data.isDefault) {
      await db.update(emailSenders).set({ isDefault: false }).where(eq(emailSenders.isDefault, true));
    }
    const [updated] = await db.update(emailSenders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailSenders.id, id))
      .returning();
    return updated;
  }

  async deleteEmailSender(id: string): Promise<void> {
    await db.delete(emailSenders).where(eq(emailSenders.id, id));
  }

  async setDefaultEmailSender(id: string): Promise<EmailSender> {
    // Unset all defaults first
    await db.update(emailSenders).set({ isDefault: false }).where(eq(emailSenders.isDefault, true));
    // Set the new default
    const [updated] = await db.update(emailSenders)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(emailSenders.id, id))
      .returning();
    return updated;
  }

  // Email configuration
  async getEmailConfig(): Promise<EmailConfig | null> {
    const [config] = await db.select().from(emailConfig).limit(1);
    if (!config) {
      // Create default config if none exists
      const [newConfig] = await db.insert(emailConfig).values({
        provider: 'gmail',
        isConfigured: false,
        senderName: 'U-Storage Go',
        functionalEmailsEnabled: true,
        transactionalEmailsEnabled: true,
        marketingEmailsEnabled: false,
      }).returning();
      return newConfig;
    }
    return config;
  }

  async updateEmailConfig(data: Partial<InsertEmailConfig>): Promise<EmailConfig> {
    const existing = await this.getEmailConfig();
    if (!existing) {
      throw new Error('Email config not found');
    }
    const [updated] = await db
      .update(emailConfig)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailConfig.id, existing.id))
      .returning();
    return updated;
  }

  async getEmailLogs(limit: number = 50, channel?: string): Promise<EmailLog[]> {
    const conditions = [];
    if (channel && channel !== 'all') {
      conditions.push(eq(emailLogs.channel, channel));
    }
    return db
      .select()
      .from(emailLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(emailLogs.createdAt))
      .limit(limit);
  }

  async createEmailLog(log: InsertEmailLog): Promise<EmailLog> {
    const [created] = await db.insert(emailLogs).values(log).returning();
    return created;
  }

  async updateEmailLogStatus(id: string, status: string, errorMessage?: string): Promise<void> {
    await db
      .update(emailLogs)
      .set({ 
        status, 
        errorMessage,
        sentAt: status === 'sent' ? new Date() : undefined,
      })
      .where(eq(emailLogs.id, id));
  }

  async getEmailStats(channel?: string): Promise<{ total: number; sent: number; pending: number; failed: number; delivered: number; read: number }> {
    const conditions = [];
    if (channel && channel !== 'all') {
      conditions.push(eq(emailLogs.channel, channel));
    }
    const result = await db
      .select({
        status: emailLogs.status,
        count: sql<number>`count(*)::int`,
      })
      .from(emailLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(emailLogs.status);
    
    const stats = { total: 0, sent: 0, pending: 0, failed: 0, delivered: 0, read: 0 };
    for (const row of result) {
      stats.total += row.count;
      if (row.status === 'sent') {
        stats.sent += row.count;
      } else if (row.status === 'delivered') {
        stats.delivered += row.count;
      } else if (row.status === 'read') {
        stats.read += row.count;
      } else if (row.status === 'pending') {
        stats.pending += row.count;
      } else if (row.status === 'failed' || row.status === 'bounced') {
        stats.failed += row.count;
      }
    }
    return stats;
  }

  // Email templates
  async getAllEmailTemplates(): Promise<EmailTemplate[]> {
    return db.select().from(emailTemplates).orderBy(emailTemplates.templateKey);
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return template;
  }

  async getEmailTemplateByKey(templateKey: string): Promise<EmailTemplate | undefined> {
    const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, templateKey));
    return template;
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const [created] = await db.insert(emailTemplates).values(template).returning();
    return created;
  }

  async updateEmailTemplate(id: string, data: Partial<EmailTemplate>): Promise<EmailTemplate> {
    const [updated] = await db
      .update(emailTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    await db.delete(emailTemplates).where(eq(emailTemplates.id, id));
  }

  // Email event types
  async getAllEmailEventTypes(): Promise<EmailEventType[]> {
    return db.select().from(emailEventTypes).orderBy(emailEventTypes.eventKey);
  }

  async getEmailEventType(id: string): Promise<EmailEventType | undefined> {
    const [eventType] = await db.select().from(emailEventTypes).where(eq(emailEventTypes.id, id));
    return eventType;
  }

  async getEmailEventTypeByKey(eventKey: string): Promise<EmailEventType | undefined> {
    const [eventType] = await db.select().from(emailEventTypes).where(eq(emailEventTypes.eventKey, eventKey));
    return eventType;
  }

  async createEmailEventType(eventType: InsertEmailEventType): Promise<EmailEventType> {
    const [created] = await db.insert(emailEventTypes).values(eventType).returning();
    return created;
  }

  async updateEmailEventType(id: string, data: Partial<EmailEventType>): Promise<EmailEventType> {
    const [updated] = await db
      .update(emailEventTypes)
      .set(data)
      .where(eq(emailEventTypes.id, id))
      .returning();
    return updated;
  }

  // Email triggers
  async getAllEmailTriggers(): Promise<EmailTrigger[]> {
    return db.select().from(emailTriggers).orderBy(emailTriggers.eventKey);
  }

  async getEmailTrigger(id: string): Promise<EmailTrigger | undefined> {
    const [trigger] = await db.select().from(emailTriggers).where(eq(emailTriggers.id, id));
    return trigger;
  }

  async getEmailTriggerByEvent(eventKey: string): Promise<EmailTrigger | undefined> {
    const [trigger] = await db.select().from(emailTriggers).where(eq(emailTriggers.eventKey, eventKey));
    return trigger;
  }

  async createEmailTrigger(trigger: InsertEmailTrigger): Promise<EmailTrigger> {
    const [created] = await db.insert(emailTriggers).values(trigger).returning();
    return created;
  }

  async updateEmailTrigger(id: string, data: Partial<EmailTrigger>): Promise<EmailTrigger> {
    const [updated] = await db
      .update(emailTriggers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailTriggers.id, id))
      .returning();
    return updated;
  }

  async deleteEmailTrigger(id: string): Promise<void> {
    await db.delete(emailTriggers).where(eq(emailTriggers.id, id));
  }

  // Email campaigns
  async getAllEmailCampaigns(): Promise<EmailCampaign[]> {
    return db.select().from(emailCampaigns).orderBy(desc(emailCampaigns.createdAt));
  }

  async getEmailCampaign(id: string): Promise<EmailCampaign | undefined> {
    const [campaign] = await db.select().from(emailCampaigns).where(eq(emailCampaigns.id, id));
    return campaign;
  }

  async createEmailCampaign(campaign: InsertEmailCampaign): Promise<EmailCampaign> {
    const [created] = await db.insert(emailCampaigns).values(campaign).returning();
    return created;
  }

  async updateEmailCampaign(id: string, data: Partial<EmailCampaign>): Promise<EmailCampaign> {
    const [updated] = await db
      .update(emailCampaigns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(emailCampaigns.id, id))
      .returning();
    return updated;
  }

  async deleteEmailCampaign(id: string): Promise<void> {
    await db.delete(emailCampaigns).where(eq(emailCampaigns.id, id));
  }

  // Generic database CRUD for admin
  async getTableRows(tableName: string, page: number = 1, pageSize: number = 50, orderBy?: string, orderDir: 'asc' | 'desc' = 'desc'): Promise<{ rows: any[]; total: number }> {
    const metadata = getTableMetadata(tableName);
    if (!metadata || !metadata.permissions.read) {
      throw new Error(`Table ${tableName} not accessible`);
    }
    const table = tableSchemas[tableName];
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }

    const offset = (page - 1) * pageSize;
    const countResult = await db.select({ count: sql<number>`count(*)::int` }).from(table);
    const total = countResult[0]?.count || 0;

    let rows: any[];
    if (orderBy && table[orderBy]) {
      rows = await db.select().from(table)
        .orderBy(orderDir === 'asc' ? asc(table[orderBy]) : desc(table[orderBy]))
        .limit(pageSize).offset(offset);
    } else if (table.createdAt) {
      rows = await db.select().from(table)
        .orderBy(desc(table.createdAt))
        .limit(pageSize).offset(offset);
    } else {
      rows = await db.select().from(table).limit(pageSize).offset(offset);
    }
    
    const hiddenColumns = metadata.columns.filter(c => c.hidden).map(c => c.name);
    const sanitizedRows = rows.map((row: any) => {
      const sanitized = { ...row };
      hiddenColumns.forEach(col => {
        if (col in sanitized) {
          delete sanitized[col];
        }
      });
      return sanitized;
    });

    return { rows: sanitizedRows, total };
  }

  async getTableRow(tableName: string, id: string): Promise<any | undefined> {
    const table = tableSchemas[tableName];
    const metadata = getTableMetadata(tableName);
    if (!table || !metadata || !metadata.permissions.read) {
      throw new Error(`Table ${tableName} not accessible`);
    }

    const primaryKey = metadata.primaryKey;
    const [row] = await db.select().from(table).where(eq(table[primaryKey], id));
    
    if (!row) return undefined;

    const hiddenColumns = metadata.columns.filter(c => c.hidden).map(c => c.name);
    const sanitized = { ...row };
    hiddenColumns.forEach(col => {
      if (col in sanitized) {
        delete sanitized[col];
      }
    });

    return sanitized;
  }

  async insertTableRow(tableName: string, data: Record<string, any>): Promise<any> {
    const table = tableSchemas[tableName];
    const metadata = getTableMetadata(tableName);
    if (!table || !metadata || !metadata.permissions.create) {
      throw new Error(`Cannot create in table ${tableName}`);
    }

    const nonEditableColumns = metadata.columns.filter(c => !c.editable).map(c => c.name);
    const cleanData = { ...data };
    nonEditableColumns.forEach(col => {
      if (col !== metadata.primaryKey) {
        delete cleanData[col];
      }
    });
    delete cleanData[metadata.primaryKey];

    const result = await db.insert(table).values(cleanData).returning();
    return Array.isArray(result) ? result[0] : result;
  }

  async updateTableRow(tableName: string, id: string, data: Record<string, any>): Promise<any> {
    const table = tableSchemas[tableName];
    const metadata = getTableMetadata(tableName);
    if (!table || !metadata || !metadata.permissions.update) {
      throw new Error(`Cannot update table ${tableName}`);
    }

    const nonEditableColumns = metadata.columns.filter(c => !c.editable).map(c => c.name);
    const cleanData = { ...data };
    nonEditableColumns.forEach(col => {
      delete cleanData[col];
    });
    delete cleanData[metadata.primaryKey];

    const primaryKey = metadata.primaryKey;
    const [row] = await db.update(table).set(cleanData).where(eq(table[primaryKey], id)).returning();
    return row;
  }

  async deleteTableRow(tableName: string, id: string): Promise<void> {
    const table = tableSchemas[tableName];
    const metadata = getTableMetadata(tableName);
    if (!table || !metadata || !metadata.permissions.delete) {
      throw new Error(`Cannot delete from table ${tableName}`);
    }

    const primaryKey = metadata.primaryKey;
    await db.delete(table).where(eq(table[primaryKey], id));
  }

  async getTableCount(tableName: string): Promise<number> {
    const metadata = getTableMetadata(tableName);
    if (!metadata) {
      throw new Error(`Table ${tableName} not accessible`);
    }
    const table = tableSchemas[tableName];
    if (!table) {
      throw new Error(`Table ${tableName} not found`);
    }
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(table);
    return result[0]?.count || 0;
  }

  // Admin Permissions methods
  async getAdminPermissions(userId: string): Promise<AdminPermissions | null> {
    const [perms] = await db.select().from(adminPermissions).where(eq(adminPermissions.userId, userId));
    return perms || null;
  }

  async upsertAdminPermissions(userId: string, permissions: Partial<InsertAdminPermissions>): Promise<AdminPermissions> {
    const existing = await this.getAdminPermissions(userId);
    if (existing) {
      const [updated] = await db
        .update(adminPermissions)
        .set({ ...permissions, updatedAt: new Date() })
        .where(eq(adminPermissions.userId, userId))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(adminPermissions)
        .values({ userId, ...permissions })
        .returning();
      return created;
    }
  }

  async deleteAdminPermissions(userId: string): Promise<void> {
    await db.delete(adminPermissions).where(eq(adminPermissions.userId, userId));
  }

  async getAllAdminUsersWithPermissions(): Promise<(User & { permissions: AdminPermissions | null })[]> {
    const adminRoles = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.role, 'admin'), eq(userRoles.isActive, true)));
    
    const adminUserIds = adminRoles.map(r => r.userId);
    if (adminUserIds.length === 0) return [];

    const adminUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, adminUserIds));

    const perms = await db
      .select()
      .from(adminPermissions)
      .where(inArray(adminPermissions.userId, adminUserIds));

    const permsMap = new Map(perms.map(p => [p.userId, p]));

    return adminUsers.map(user => ({
      ...user,
      permissions: permsMap.get(user.id) || null,
    }));
  }

  async getNonAdminUsers(): Promise<User[]> {
    const adminRoles = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(and(eq(userRoles.role, 'admin'), eq(userRoles.isActive, true)));
    
    const adminUserIds = adminRoles.map(r => r.userId);
    
    if (adminUserIds.length === 0) {
      return db.select().from(users).orderBy(asc(users.fullName));
    }

    const allUsers = await db.select().from(users).orderBy(asc(users.fullName));
    return allUsers.filter(u => !adminUserIds.includes(u.id));
  }

  // Admin access request methods
  async createAdminAccessRequest(request: { email: string; fullName: string; phone?: string; company?: string; justification?: string }): Promise<any> {
    const [created] = await db
      .insert(adminAccessRequests)
      .values(request)
      .returning();
    return created;
  }

  async getAdminAccessRequests(status?: string): Promise<any[]> {
    if (status) {
      return await db
        .select()
        .from(adminAccessRequests)
        .where(eq(adminAccessRequests.status, status))
        .orderBy(desc(adminAccessRequests.createdAt));
    }
    return await db
      .select()
      .from(adminAccessRequests)
      .orderBy(desc(adminAccessRequests.createdAt));
  }

  async getAdminAccessRequest(id: string): Promise<any | undefined> {
    const [request] = await db
      .select()
      .from(adminAccessRequests)
      .where(eq(adminAccessRequests.id, id));
    return request || undefined;
  }

  async updateAdminAccessRequest(id: string, data: { status?: string; reviewedBy?: string; reviewedAt?: Date; reviewNotes?: string; userId?: string }): Promise<any> {
    const [updated] = await db
      .update(adminAccessRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(adminAccessRequests.id, id))
      .returning();
    return updated;
  }

  async getPendingRequestByEmail(email: string): Promise<any | undefined> {
    const [request] = await db
      .select()
      .from(adminAccessRequests)
      .where(and(
        eq(adminAccessRequests.email, email),
        eq(adminAccessRequests.status, 'pending')
      ));
    return request || undefined;
  }

  // Pricing templates
  async getAllPricingTemplates(): Promise<PricingTemplate[]> {
    return await db.select().from(pricingTemplates).orderBy(asc(pricingTemplates.name));
  }

  async getPricingTemplate(id: string): Promise<PricingTemplate | undefined> {
    const [template] = await db.select().from(pricingTemplates).where(eq(pricingTemplates.id, id));
    return template || undefined;
  }

  async getDefaultPricingTemplate(): Promise<PricingTemplate | undefined> {
    const [template] = await db
      .select()
      .from(pricingTemplates)
      .where(and(eq(pricingTemplates.isDefault, true), eq(pricingTemplates.isActive, true)));
    return template || undefined;
  }

  async createPricingTemplate(template: InsertPricingTemplate): Promise<PricingTemplate> {
    // If this is set as default, unset other defaults
    if (template.isDefault) {
      await db.update(pricingTemplates).set({ isDefault: false }).where(eq(pricingTemplates.isDefault, true));
    }
    const [created] = await db.insert(pricingTemplates).values(template).returning();
    return created;
  }

  async updatePricingTemplate(id: string, data: Partial<PricingTemplate>): Promise<PricingTemplate> {
    // If setting as default, unset other defaults
    if (data.isDefault) {
      await db.update(pricingTemplates).set({ isDefault: false }).where(eq(pricingTemplates.isDefault, true));
    }
    const [updated] = await db
      .update(pricingTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pricingTemplates.id, id))
      .returning();
    return updated;
  }

  async deletePricingTemplate(id: string): Promise<void> {
    await db.delete(pricingTemplates).where(eq(pricingTemplates.id, id));
  }

  // Countries
  async getAllCountries(): Promise<Country[]> {
    return await db.select().from(countries).orderBy(asc(countries.name));
  }

  async getCountry(id: string): Promise<Country | undefined> {
    const [country] = await db.select().from(countries).where(eq(countries.id, id));
    return country || undefined;
  }

  async getCountryByCode(code: string): Promise<Country | undefined> {
    const [country] = await db.select().from(countries).where(eq(countries.code, code.toUpperCase()));
    return country || undefined;
  }

  async createCountry(country: InsertCountry): Promise<Country> {
    const [created] = await db.insert(countries).values({ ...country, code: country.code.toUpperCase() }).returning();
    return created;
  }

  async updateCountry(id: string, data: Partial<Country>): Promise<Country> {
    const updateData = { ...data, updatedAt: new Date() };
    if (data.code) updateData.code = data.code.toUpperCase();
    const [updated] = await db.update(countries).set(updateData).where(eq(countries.id, id)).returning();
    return updated;
  }

  async deleteCountry(id: string): Promise<void> {
    await db.delete(countries).where(eq(countries.id, id));
  }

  // Cities
  async getAllCities(): Promise<City[]> {
    return await db.select().from(cities).orderBy(asc(cities.name));
  }

  async getCitiesByCountry(countryId: string): Promise<City[]> {
    return await db.select().from(cities).where(eq(cities.countryId, countryId)).orderBy(asc(cities.name));
  }

  async getCity(id: string): Promise<City | undefined> {
    const [city] = await db.select().from(cities).where(eq(cities.id, id));
    return city || undefined;
  }

  async getCityByName(name: string, countryId?: string): Promise<City | undefined> {
    const normalizedName = name.toLowerCase().trim();
    const allCities = countryId 
      ? await db.select().from(cities).where(eq(cities.countryId, countryId))
      : await db.select().from(cities);
    
    // Find city with fuzzy matching
    const city = allCities.find(c => 
      c.name.toLowerCase().includes(normalizedName) || 
      normalizedName.includes(c.name.toLowerCase()) ||
      (c.nameEs && c.nameEs.toLowerCase().includes(normalizedName))
    );
    return city || undefined;
  }

  async createCity(city: InsertCity): Promise<City> {
    const [created] = await db.insert(cities).values(city).returning();
    return created;
  }

  async updateCity(id: string, data: Partial<City>): Promise<City> {
    const [updated] = await db
      .update(cities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(cities.id, id))
      .returning();
    return updated;
  }

  async deleteCity(id: string): Promise<void> {
    await db.delete(cities).where(eq(cities.id, id));
  }

  async getActiveTimezones(): Promise<{ timezone: string; cityName: string; countryName: string }[]> {
    const activeCities = await db
      .select({
        timezone: cities.timezone,
        cityName: cities.name,
        countryName: countries.name,
      })
      .from(cities)
      .innerJoin(countries, eq(cities.countryId, countries.id))
      .where(and(eq(cities.isActive, true), eq(countries.isActive, true)));
    
    const uniqueTimezones = new Map<string, { timezone: string; cityName: string; countryName: string }>();
    const defaultTimezone = 'America/Mexico_City';
    
    for (const city of activeCities) {
      const tz = city.timezone || defaultTimezone;
      if (!uniqueTimezones.has(tz)) {
        uniqueTimezones.set(tz, {
          timezone: tz,
          cityName: city.cityName,
          countryName: city.countryName,
        });
      }
    }
    
    if (uniqueTimezones.size === 0) {
      uniqueTimezones.set(defaultTimezone, {
        timezone: defaultTimezone,
        cityName: 'Ciudad de México',
        countryName: 'México',
      });
    }
    
    return Array.from(uniqueTimezones.values()).sort((a, b) => a.timezone.localeCompare(b.timezone));
  }

  // City truck pricing
  async getCityTruckPricing(cityId: string): Promise<CityTruckPricing[]> {
    return await db.select().from(cityTruckPricing).where(eq(cityTruckPricing.cityId, cityId));
  }

  async upsertCityTruckPricing(data: InsertCityTruckPricing): Promise<CityTruckPricing> {
    // Check if exists
    const [existing] = await db.select().from(cityTruckPricing)
      .where(and(
        eq(cityTruckPricing.cityId, data.cityId),
        eq(cityTruckPricing.truckTypeId, data.truckTypeId)
      ));
    
    if (existing) {
      const [updated] = await db.update(cityTruckPricing)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(cityTruckPricing.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(cityTruckPricing).values(data).returning();
      return created;
    }
  }

  async deleteCityTruckPricing(cityId: string, truckTypeId: string): Promise<void> {
    await db.delete(cityTruckPricing).where(
      and(
        eq(cityTruckPricing.cityId, cityId),
        eq(cityTruckPricing.truckTypeId, truckTypeId)
      )
    );
  }

  // Resolved pricing with fallback hierarchy
  async getResolvedPricing(cityName?: string, countryCode?: string): Promise<ResolvedPricing> {
    // Get all truck types for building truck pricing
    const allTruckTypes = await this.getTruckTypes();
    const activeTrucks = allTruckTypes.filter(t => t.isActive);

    // Build default truck pricing from truck_types table
    const buildDefaultTruckPricing = () => activeTrucks.map(t => ({
      truckTypeId: t.id,
      name: t.name,
      nameEs: t.nameEs,
      capacityKg: t.capacityKg,
      capacityM3: parseFloat(t.capacityM3?.toString() || '0'),
      usableVolumeFactor: parseFloat(t.usableVolumeFactor?.toString() || '0.85'),
      includedMovers: t.includedMovers,
      baseServiceHours: parseFloat(t.baseServiceHours?.toString() || '3'),
      baseRate: parseFloat(t.baseRate?.toString() || '1500'),
      hourlyRate: parseFloat(t.hourlyRate?.toString() || '300'),
      perKmRate: parseFloat(t.perKmRate?.toString() || '10'),
    }));

    // Default pricing if nothing is configured
    const defaultPricing: ResolvedPricing = {
      currency: 'MXN',
      currencySymbol: '$',
      extraMoverRate: 250,
      moverHourlyRate: 180,
      complicatedMoveMultiplier: 1.3,
      floorSurchargePercent: 10,
      defaultDistanceKm: 20,
      truckPricing: buildDefaultTruckPricing(),
      source: 'default',
    };

    // Try to find city first
    if (cityName) {
      const city = await this.getCityByName(cityName);
      if (city) {
        const country = await this.getCountry(city.countryId);
        if (country) {
          // Get city-specific truck pricing
          const cityTruckPricingData = await this.getCityTruckPricing(city.id);
          const cityTruckPricingMap = new Map(cityTruckPricingData.map(p => [p.truckTypeId, p]));

          // Build truck pricing: city_truck_pricing is the AUTHORITATIVE source for all cost fields
          // Only trucks WITH city pricing are included (no city pricing = truck not available in this city)
          const truckPricing = activeTrucks
            .filter(t => cityTruckPricingMap.has(t.id)) // Only include trucks with city pricing configured
            .map(t => {
              const cityPrice = cityTruckPricingMap.get(t.id)!;
              return {
                truckTypeId: t.id,
                name: t.name,
                nameEs: t.nameEs,
                // Specs from truck_types (physical characteristics, including usableVolumeFactor)
                capacityKg: t.capacityKg,
                capacityM3: parseFloat(t.capacityM3?.toString() || '0'),
                usableVolumeFactor: parseFloat(t.usableVolumeFactor?.toString() || '0.85'),
                // Pricing/service fields from city_truck_pricing (the authoritative source)
                includedMovers: cityPrice.includedMovers || 2,
                baseServiceHours: parseFloat(cityPrice.baseServiceHours?.toString() || '3'),
                baseRate: parseFloat(cityPrice.baseRate?.toString() || '1500'),
                hourlyRate: parseFloat(cityPrice.hourlyRate?.toString() || '300'),
                perKmRate: parseFloat(cityPrice.perKmRate?.toString() || '10'),
              };
            });

          return {
            currency: country.currency,
            currencySymbol: country.currencySymbol,
            extraMoverRate: parseFloat(city.extraMoverRate?.toString() || '250'),
            moverHourlyRate: parseFloat(city.moverHourlyRate?.toString() || '180'),
            complicatedMoveMultiplier: parseFloat(city.complicatedMoveMultiplier?.toString() || '1.3'),
            floorSurchargePercent: 10,
            defaultDistanceKm: parseFloat(city.defaultDistanceKm?.toString() || '20'),
            truckPricing,
            source: 'city',
            countryCode: country.code,
            cityName: city.name,
            cityId: city.id,
          };
        }
      }
    }

    // Try to find country (use default truck pricing)
    if (countryCode) {
      const country = await this.getCountryByCode(countryCode);
      if (country) {
        return {
          currency: country.currency,
          currencySymbol: country.currencySymbol,
          extraMoverRate: 250,
          moverHourlyRate: 180,
          complicatedMoveMultiplier: 1.3,
          floorSurchargePercent: 10,
          defaultDistanceKm: 20,
          truckPricing: buildDefaultTruckPricing(),
          source: 'country',
          countryCode: country.code,
        };
      }
    }

    return defaultPricing;
  }
  
  // Pricing formula parameters
  async getAllPricingFormulaParameters(): Promise<PricingFormulaParameter[]> {
    return db.select().from(pricingFormulaParameters).orderBy(asc(pricingFormulaParameters.sortOrder));
  }
  
  async getPricingFormulaParameter(id: string): Promise<PricingFormulaParameter | undefined> {
    const [param] = await db.select().from(pricingFormulaParameters).where(eq(pricingFormulaParameters.id, id));
    return param || undefined;
  }
  
  async getPricingFormulaParameterByKey(key: string): Promise<PricingFormulaParameter | undefined> {
    const [param] = await db.select().from(pricingFormulaParameters).where(eq(pricingFormulaParameters.key, key));
    return param || undefined;
  }
  
  async createPricingFormulaParameter(param: InsertPricingFormulaParameter): Promise<PricingFormulaParameter> {
    const [newParam] = await db.insert(pricingFormulaParameters).values(param).returning();
    return newParam;
  }
  
  async updatePricingFormulaParameter(id: string, data: Partial<PricingFormulaParameter>): Promise<PricingFormulaParameter> {
    const [param] = await db.update(pricingFormulaParameters)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pricingFormulaParameters.id, id))
      .returning();
    return param;
  }
  
  async deletePricingFormulaParameter(id: string): Promise<void> {
    await db.delete(pricingFormulaParameters).where(eq(pricingFormulaParameters.id, id));
  }
  
  // AI pricing prompts
  async getAllAiPricingPrompts(): Promise<AiPricingPrompt[]> {
    return db.select().from(aiPricingPrompts).orderBy(desc(aiPricingPrompts.updatedAt));
  }
  
  async getAiPricingPrompt(id: string): Promise<AiPricingPrompt | undefined> {
    const [prompt] = await db.select().from(aiPricingPrompts).where(eq(aiPricingPrompts.id, id));
    return prompt || undefined;
  }
  
  async getActiveAiPricingPrompt(scope: string = 'global', scopeId?: string): Promise<AiPricingPrompt | undefined> {
    if (scopeId) {
      const [prompt] = await db.select().from(aiPricingPrompts)
        .where(and(
          eq(aiPricingPrompts.scope, scope),
          eq(aiPricingPrompts.scopeId, scopeId),
          eq(aiPricingPrompts.isActive, true)
        ));
      if (prompt) return prompt;
    }
    // Fall back to global
    const [globalPrompt] = await db.select().from(aiPricingPrompts)
      .where(and(
        eq(aiPricingPrompts.scope, 'global'),
        eq(aiPricingPrompts.isActive, true)
      ));
    return globalPrompt || undefined;
  }
  
  async createAiPricingPrompt(prompt: InsertAiPricingPrompt): Promise<AiPricingPrompt> {
    const [newPrompt] = await db.insert(aiPricingPrompts).values(prompt).returning();
    return newPrompt;
  }
  
  async updateAiPricingPrompt(id: string, data: Partial<AiPricingPrompt>): Promise<AiPricingPrompt> {
    const [prompt] = await db.update(aiPricingPrompts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiPricingPrompts.id, id))
      .returning();
    return prompt;
  }
  
  async deleteAiPricingPrompt(id: string): Promise<void> {
    await db.delete(aiPricingPrompts).where(eq(aiPricingPrompts.id, id));
  }
  
  // Quote documents (PDF quotes)
  async getQuoteDocument(id: string): Promise<QuoteDocument | undefined> {
    const [doc] = await db.select().from(quoteDocuments).where(eq(quoteDocuments.id, id));
    return doc || undefined;
  }
  
  async getQuoteDocuments(quoteId: string): Promise<QuoteDocument[]> {
    return db.select().from(quoteDocuments)
      .where(eq(quoteDocuments.quoteId, quoteId))
      .orderBy(desc(quoteDocuments.version));
  }
  
  async getLatestQuoteDocument(quoteId: string): Promise<QuoteDocument | undefined> {
    const [doc] = await db.select().from(quoteDocuments)
      .where(eq(quoteDocuments.quoteId, quoteId))
      .orderBy(desc(quoteDocuments.version))
      .limit(1);
    return doc || undefined;
  }
  
  async createQuoteDocument(doc: InsertQuoteDocument): Promise<QuoteDocument> {
    const [newDoc] = await db.insert(quoteDocuments).values(doc).returning();
    return newDoc;
  }
  
  async deleteQuoteDocument(id: string): Promise<void> {
    await db.delete(quoteDocuments).where(eq(quoteDocuments.id, id));
  }
  
  // Preset inventory sets
  async getAllPresetInventorySets(): Promise<PresetInventorySet[]> {
    return db.select().from(presetInventorySets).orderBy(asc(presetInventorySets.sortOrder));
  }
  
  async getActivePresetInventorySets(): Promise<PresetInventorySet[]> {
    return db.select().from(presetInventorySets)
      .where(eq(presetInventorySets.isActive, true))
      .orderBy(asc(presetInventorySets.sortOrder));
  }
  
  async getPresetInventorySet(id: string): Promise<PresetInventorySet | undefined> {
    const [set] = await db.select().from(presetInventorySets).where(eq(presetInventorySets.id, id));
    return set || undefined;
  }
  
  async getPresetInventorySetByKey(key: string): Promise<PresetInventorySet | undefined> {
    const [set] = await db.select().from(presetInventorySets).where(eq(presetInventorySets.key, key));
    return set || undefined;
  }
  
  async createPresetInventorySet(data: InsertPresetInventorySet): Promise<PresetInventorySet> {
    const [set] = await db.insert(presetInventorySets).values(data).returning();
    return set;
  }
  
  async updatePresetInventorySet(id: string, data: Partial<InsertPresetInventorySet>): Promise<PresetInventorySet> {
    const [set] = await db.update(presetInventorySets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(presetInventorySets.id, id))
      .returning();
    return set;
  }
  
  async deletePresetInventorySet(id: string): Promise<void> {
    await db.delete(presetInventorySets).where(eq(presetInventorySets.id, id));
  }
  
  // Preset inventory items
  async getPresetInventoryItems(presetSetId: string): Promise<PresetInventoryItem[]> {
    return db.select().from(presetInventoryItems)
      .where(eq(presetInventoryItems.presetSetId, presetSetId))
      .orderBy(asc(presetInventoryItems.sortOrder));
  }
  
  async createPresetInventoryItem(data: InsertPresetInventoryItem): Promise<PresetInventoryItem> {
    const [item] = await db.insert(presetInventoryItems).values(data).returning();
    return item;
  }
  
  async updatePresetInventoryItem(id: string, data: Partial<InsertPresetInventoryItem>): Promise<PresetInventoryItem> {
    const [item] = await db.update(presetInventoryItems)
      .set(data)
      .where(eq(presetInventoryItems.id, id))
      .returning();
    return item;
  }
  
  async deletePresetInventoryItem(id: string): Promise<void> {
    await db.delete(presetInventoryItems).where(eq(presetInventoryItems.id, id));
  }
  
  async deletePresetInventoryItemsBySet(presetSetId: string): Promise<void> {
    await db.delete(presetInventoryItems).where(eq(presetInventoryItems.presetSetId, presetSetId));
  }
  
  async replacePresetInventoryItems(presetSetId: string, items: InsertPresetInventoryItem[]): Promise<PresetInventoryItem[]> {
    await this.deletePresetInventoryItemsBySet(presetSetId);
    if (items.length === 0) return [];
    
    const itemsWithSetId = items.map((item, index) => ({
      ...item,
      presetSetId,
      sortOrder: index,
    }));
    
    return db.insert(presetInventoryItems).values(itemsWithSetId).returning();
  }

  // Get all catalog items from the canonical catalog table (for visual inventory picker and AI)
  async getCatalogItems(): Promise<Array<{
    key: string;
    nameEn: string;
    nameEs: string;
    roomKey: string;
    categoryKey: string;
  }>> {
    const items = await db.select()
      .from(inventoryCatalogItems)
      .where(eq(inventoryCatalogItems.isActive, true))
      .orderBy(asc(inventoryCatalogItems.roomKey), asc(inventoryCatalogItems.sortOrder), asc(inventoryCatalogItems.nameEs));
    
    return items.map(item => ({
      key: item.key,
      nameEn: item.nameEn,
      nameEs: item.nameEs,
      roomKey: item.roomKey,
      categoryKey: item.categoryKey,
    }));
  }
  
  // Inventory catalog items CRUD
  async getAllCatalogItems(): Promise<InventoryCatalogItem[]> {
    return db.select().from(inventoryCatalogItems).orderBy(asc(inventoryCatalogItems.roomKey), asc(inventoryCatalogItems.sortOrder));
  }
  
  async getActiveCatalogItems(): Promise<InventoryCatalogItem[]> {
    return db.select().from(inventoryCatalogItems)
      .where(eq(inventoryCatalogItems.isActive, true))
      .orderBy(asc(inventoryCatalogItems.roomKey), asc(inventoryCatalogItems.sortOrder));
  }
  
  async getCatalogItem(id: string): Promise<InventoryCatalogItem | undefined> {
    const [item] = await db.select().from(inventoryCatalogItems).where(eq(inventoryCatalogItems.id, id));
    return item || undefined;
  }
  
  async createCatalogItem(data: InsertInventoryCatalogItem): Promise<InventoryCatalogItem> {
    const [item] = await db.insert(inventoryCatalogItems).values(data).returning();
    return item;
  }
  
  async updateCatalogItem(id: string, data: Partial<InsertInventoryCatalogItem>): Promise<InventoryCatalogItem> {
    const [item] = await db.update(inventoryCatalogItems).set(data).where(eq(inventoryCatalogItems.id, id)).returning();
    return item;
  }
  
  async deleteCatalogItem(id: string): Promise<void> {
    await db.delete(inventoryCatalogItems).where(eq(inventoryCatalogItems.id, id));
  }

  // ===========================================
  // RATING SYSTEM OPERATIONS
  // ===========================================

  // Rating operations
  async getRating(id: string): Promise<Rating | undefined> {
    const [rating] = await db.select().from(ratings).where(eq(ratings.id, id));
    return rating || undefined;
  }

  async getRatingByQuoteAndRater(quoteId: string, raterUserId: string): Promise<Rating | undefined> {
    const [rating] = await db.select().from(ratings)
      .where(and(eq(ratings.quoteId, quoteId), eq(ratings.raterUserId, raterUserId)));
    return rating || undefined;
  }

  async getRatingByEmailToken(token: string): Promise<Rating | undefined> {
    const [rating] = await db.select().from(ratings).where(eq(ratings.emailToken, token));
    return rating || undefined;
  }

  async getRatingsForUser(userId: string, asTarget: boolean = false): Promise<RatingWithDetails[]> {
    const condition = asTarget 
      ? eq(ratings.targetUserId, userId)
      : eq(ratings.raterUserId, userId);
    
    const results = await db.select({
      rating: ratings,
      comments: ratingComments,
      rater: users,
    })
      .from(ratings)
      .leftJoin(ratingComments, eq(ratings.id, ratingComments.ratingId))
      .leftJoin(users, eq(ratings.raterUserId, users.id))
      .where(condition)
      .orderBy(desc(ratings.createdAt));
    
    // Get AI tags for each rating
    const ratingIds = results.map(r => r.rating.id);
    const allTags = ratingIds.length > 0 
      ? await db.select().from(ratingAiTags).where(inArray(ratingAiTags.ratingId, ratingIds))
      : [];
    
    return results.map(r => ({
      ...r.rating,
      comments: r.comments || undefined,
      aiTags: allTags.filter(t => t.ratingId === r.rating.id),
      rater: r.rater || undefined,
    }));
  }

  async getRatingsForMoverProfile(moverProfileId: string): Promise<RatingWithDetails[]> {
    const results = await db.select({
      rating: ratings,
      comments: ratingComments,
      rater: users,
      quote: quotes,
    })
      .from(ratings)
      .leftJoin(ratingComments, eq(ratings.id, ratingComments.ratingId))
      .leftJoin(users, eq(ratings.raterUserId, users.id))
      .leftJoin(quotes, eq(ratings.quoteId, quotes.id))
      .where(and(eq(ratings.moverProfileId, moverProfileId), eq(ratings.direction, 'client_to_partner')))
      .orderBy(desc(ratings.createdAt));
    
    const ratingIds = results.map(r => r.rating.id);
    const allTags = ratingIds.length > 0 
      ? await db.select().from(ratingAiTags).where(inArray(ratingAiTags.ratingId, ratingIds))
      : [];
    
    return results.map(r => ({
      ...r.rating,
      comments: r.comments || undefined,
      aiTags: allTags.filter(t => t.ratingId === r.rating.id),
      rater: r.rater || undefined,
      quote: r.quote || undefined,
    }));
  }

  async getRatingsForQuote(quoteId: string): Promise<RatingWithDetails[]> {
    const results = await db.select({
      rating: ratings,
      comments: ratingComments,
      rater: users,
    })
      .from(ratings)
      .leftJoin(ratingComments, eq(ratings.id, ratingComments.ratingId))
      .leftJoin(users, eq(ratings.raterUserId, users.id))
      .where(eq(ratings.quoteId, quoteId))
      .orderBy(desc(ratings.createdAt));
    
    const ratingIds = results.map(r => r.rating.id);
    const allTags = ratingIds.length > 0 
      ? await db.select().from(ratingAiTags).where(inArray(ratingAiTags.ratingId, ratingIds))
      : [];
    
    return results.map(r => ({
      ...r.rating,
      comments: r.comments || undefined,
      aiTags: allTags.filter(t => t.ratingId === r.rating.id),
      rater: r.rater || undefined,
    }));
  }

  async getAllRatings(filters?: { direction?: string; limit?: number }): Promise<RatingWithDetails[]> {
    let query = db.select({
      rating: ratings,
      comments: ratingComments,
      rater: users,
    })
      .from(ratings)
      .leftJoin(ratingComments, eq(ratings.id, ratingComments.ratingId))
      .leftJoin(users, eq(ratings.raterUserId, users.id))
      .orderBy(desc(ratings.createdAt))
      .$dynamic();
    
    if (filters?.direction) {
      query = query.where(eq(ratings.direction, filters.direction));
    }
    
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    
    const results = await query;
    
    const ratingIds = results.map(r => r.rating.id);
    const allTags = ratingIds.length > 0 
      ? await db.select().from(ratingAiTags).where(inArray(ratingAiTags.ratingId, ratingIds))
      : [];
    
    return results.map(r => ({
      ...r.rating,
      comments: r.comments || undefined,
      aiTags: allTags.filter(t => t.ratingId === r.rating.id),
      rater: r.rater || undefined,
    }));
  }

  async createRating(rating: InsertRating): Promise<Rating> {
    const [newRating] = await db.insert(ratings).values(rating).returning();
    return newRating;
  }

  async updateRating(id: string, data: Partial<Rating>, editedBy?: string, editReason?: string): Promise<Rating> {
    const updateData: Partial<Rating> = {
      ...data,
      updatedAt: new Date(),
    };
    
    // If super admin is editing, track the edit
    if (editedBy) {
      updateData.isEdited = true;
      updateData.editedBy = editedBy;
      updateData.editedAt = new Date();
      updateData.editReason = editReason || 'Admin modification';
    }
    
    const [updated] = await db.update(ratings)
      .set(updateData)
      .where(eq(ratings.id, id))
      .returning();
    return updated;
  }

  async deleteRating(id: string): Promise<void> {
    await db.delete(ratings).where(eq(ratings.id, id));
  }

  // Rating comments
  async getRatingComment(ratingId: string): Promise<RatingComment | undefined> {
    const [comment] = await db.select().from(ratingComments).where(eq(ratingComments.ratingId, ratingId));
    return comment || undefined;
  }

  async createRatingComment(comment: InsertRatingComment): Promise<RatingComment> {
    const [newComment] = await db.insert(ratingComments).values(comment).returning();
    return newComment;
  }

  async updateRatingComment(ratingId: string, data: Partial<RatingComment>): Promise<RatingComment> {
    const [updated] = await db.update(ratingComments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ratingComments.ratingId, ratingId))
      .returning();
    return updated;
  }

  // Rating AI tags
  async getRatingAiTags(ratingId: string): Promise<RatingAiTag[]> {
    return db.select().from(ratingAiTags).where(eq(ratingAiTags.ratingId, ratingId));
  }

  async createRatingAiTag(tag: InsertRatingAiTag): Promise<RatingAiTag> {
    const [newTag] = await db.insert(ratingAiTags).values(tag).returning();
    return newTag;
  }

  async deleteRatingAiTags(ratingId: string): Promise<void> {
    await db.delete(ratingAiTags).where(eq(ratingAiTags.ratingId, ratingId));
  }

  async getTopTagsForMoverProfile(moverProfileId: string, sentiment?: string): Promise<{ tag: string; tagEs?: string; count: number }[]> {
    // Get all ratings for this mover profile
    const moverRatings = await db.select({ id: ratings.id })
      .from(ratings)
      .where(and(eq(ratings.moverProfileId, moverProfileId), eq(ratings.direction, 'client_to_partner')));
    
    if (moverRatings.length === 0) return [];
    
    const ratingIds = moverRatings.map(r => r.id);
    
    // Get tags grouped by tag name
    const tagsQuery = db.select({
      tag: ratingAiTags.tag,
      tagEs: ratingAiTags.tagEs,
    })
      .from(ratingAiTags)
      .where(inArray(ratingAiTags.ratingId, ratingIds))
      .$dynamic();
    
    if (sentiment) {
      const allTags = await db.select()
        .from(ratingAiTags)
        .where(and(inArray(ratingAiTags.ratingId, ratingIds), eq(ratingAiTags.sentiment, sentiment)));
      
      // Count manually
      const tagCounts: Record<string, { tag: string; tagEs?: string; count: number }> = {};
      for (const t of allTags) {
        if (!tagCounts[t.tag]) {
          tagCounts[t.tag] = { tag: t.tag, tagEs: t.tagEs || undefined, count: 0 };
        }
        tagCounts[t.tag].count++;
      }
      return Object.values(tagCounts).sort((a, b) => b.count - a.count).slice(0, 10);
    }
    
    const allTags = await tagsQuery;
    const tagCounts: Record<string, { tag: string; tagEs?: string; count: number }> = {};
    for (const t of allTags) {
      if (!tagCounts[t.tag]) {
        tagCounts[t.tag] = { tag: t.tag, tagEs: t.tagEs || undefined, count: 0 };
      }
      tagCounts[t.tag].count++;
    }
    return Object.values(tagCounts).sort((a, b) => b.count - a.count).slice(0, 10);
  }

  // Rating requests
  async getRatingRequest(id: string): Promise<RatingRequest | undefined> {
    const [request] = await db.select().from(ratingRequests).where(eq(ratingRequests.id, id));
    return request || undefined;
  }

  async getRatingRequestByToken(token: string): Promise<RatingRequest | undefined> {
    const [request] = await db.select().from(ratingRequests).where(eq(ratingRequests.emailToken, token));
    return request || undefined;
  }

  async getPendingRatingRequests(quoteId: string): Promise<RatingRequest[]> {
    return db.select().from(ratingRequests)
      .where(and(eq(ratingRequests.quoteId, quoteId), sql`${ratingRequests.completedAt} IS NULL`));
  }

  async createRatingRequest(request: InsertRatingRequest): Promise<RatingRequest> {
    const [newRequest] = await db.insert(ratingRequests).values(request).returning();
    return newRequest;
  }

  async updateRatingRequest(id: string, data: Partial<RatingRequest>): Promise<RatingRequest> {
    const [updated] = await db.update(ratingRequests)
      .set(data)
      .where(eq(ratingRequests.id, id))
      .returning();
    return updated;
  }

  // Rating summaries
  async getPartnerRatingSummary(moverProfileId: string): Promise<PartnerRatingSummary> {
    // Get all ratings for this partner
    const partnerRatings = await db.select()
      .from(ratings)
      .where(and(eq(ratings.moverProfileId, moverProfileId), eq(ratings.direction, 'client_to_partner')));
    
    if (partnerRatings.length === 0) {
      return {
        averageRating: 0,
        totalRatings: 0,
        ratingBreakdown: [1, 2, 3, 4, 5].map(stars => ({ stars, count: 0 })),
        excellenceCategories: [],
        improvementCategories: [],
        recentPositiveTags: [],
        recentNegativeTags: [],
      };
    }
    
    const totalRatings = partnerRatings.length;
    const averageRating = partnerRatings.reduce((sum, r) => sum + r.starRating, 0) / totalRatings;
    
    // Rating breakdown
    const ratingBreakdown = [1, 2, 3, 4, 5].map(stars => ({
      stars,
      count: partnerRatings.filter(r => r.starRating === stars).length,
    }));
    
    // Excellence categories count
    const excellenceCounts: Record<string, number> = {};
    for (const r of partnerRatings) {
      if (r.excellenceCategories) {
        for (const cat of r.excellenceCategories) {
          excellenceCounts[cat] = (excellenceCounts[cat] || 0) + 1;
        }
      }
    }
    const excellenceCategories = Object.entries(excellenceCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    
    // Improvement categories count
    const improvementCounts: Record<string, number> = {};
    for (const r of partnerRatings) {
      if (r.improvementCategories) {
        for (const cat of r.improvementCategories) {
          improvementCounts[cat] = (improvementCounts[cat] || 0) + 1;
        }
      }
    }
    const improvementCategories = Object.entries(improvementCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
    
    // Get top tags
    const recentPositiveTags = await this.getTopTagsForMoverProfile(moverProfileId, 'positive');
    const recentNegativeTags = await this.getTopTagsForMoverProfile(moverProfileId, 'negative');
    
    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalRatings,
      ratingBreakdown,
      excellenceCategories,
      improvementCategories,
      recentPositiveTags,
      recentNegativeTags,
    };
  }

  async getUserRatingSummary(userId: string): Promise<UserRatingSummary> {
    // Get ratings where this user is the target (partner rating the client)
    const userRatings = await db.select()
      .from(ratings)
      .where(and(eq(ratings.targetUserId, userId), eq(ratings.direction, 'partner_to_client')));
    
    if (userRatings.length === 0) {
      return { averageRating: 0, totalRatings: 0 };
    }
    
    const totalRatings = userRatings.length;
    const averageRating = userRatings.reduce((sum, r) => sum + r.starRating, 0) / totalRatings;
    
    return {
      averageRating: Math.round(averageRating * 10) / 10,
      totalRatings,
    };
  }

  async updateMoverProfileRating(moverProfileId: string): Promise<void> {
    // Calculate the new average rating
    const partnerRatings = await db.select({ starRating: ratings.starRating })
      .from(ratings)
      .where(and(eq(ratings.moverProfileId, moverProfileId), eq(ratings.direction, 'client_to_partner')));
    
    if (partnerRatings.length === 0) return;
    
    const avgRating = partnerRatings.reduce((sum, r) => sum + r.starRating, 0) / partnerRatings.length;
    
    // Update the mover profile
    await db.update(moverProfiles)
      .set({ 
        rating: avgRating.toFixed(2),
        totalJobs: partnerRatings.length,
      })
      .where(eq(moverProfiles.id, moverProfileId));
  }

  // SEO Settings
  async getSeoSettings(): Promise<SeoSettings | undefined> {
    const [settings] = await db.select().from(seoSettings).limit(1);
    return settings || undefined;
  }

  async updateSeoSettings(data: Partial<InsertSeoSettings>, updatedBy?: string): Promise<SeoSettings> {
    const existing = await this.getSeoSettings();
    
    if (existing) {
      const [updated] = await db
        .update(seoSettings)
        .set({ ...data, updatedAt: new Date(), updatedBy })
        .where(eq(seoSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(seoSettings)
        .values({ ...data, updatedBy })
        .returning();
      return created;
    }
  }

  // Quote Workflow Statuses
  async getQuoteWorkflowStatuses(): Promise<QuoteWorkflowStatus[]> {
    return await db.select().from(quoteWorkflowStatuses).orderBy(asc(quoteWorkflowStatuses.sortOrder));
  }

  async getQuoteWorkflowStatus(id: string): Promise<QuoteWorkflowStatus | undefined> {
    const [status] = await db.select().from(quoteWorkflowStatuses).where(eq(quoteWorkflowStatuses.id, id));
    return status || undefined;
  }

  async getQuoteWorkflowStatusByKey(key: string): Promise<QuoteWorkflowStatus | undefined> {
    const [status] = await db.select().from(quoteWorkflowStatuses).where(eq(quoteWorkflowStatuses.key, key));
    return status || undefined;
  }

  async createQuoteWorkflowStatus(data: InsertQuoteWorkflowStatus): Promise<QuoteWorkflowStatus> {
    const [status] = await db.insert(quoteWorkflowStatuses).values(data).returning();
    return status;
  }

  async updateQuoteWorkflowStatus(id: string, data: Partial<InsertQuoteWorkflowStatus>): Promise<QuoteWorkflowStatus> {
    const [updated] = await db
      .update(quoteWorkflowStatuses)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(quoteWorkflowStatuses.id, id))
      .returning();
    return updated;
  }

  async deleteQuoteWorkflowStatus(id: string): Promise<void> {
    await db.delete(quoteWorkflowStatuses).where(eq(quoteWorkflowStatuses.id, id));
  }

  async reorderQuoteWorkflowStatuses(orderedIds: string[]): Promise<void> {
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(quoteWorkflowStatuses)
        .set({ sortOrder: i, updatedAt: new Date() })
        .where(eq(quoteWorkflowStatuses.id, orderedIds[i]));
    }
  }

  // Marketing Page Views
  async createPageView(data: InsertMarketingPageView): Promise<MarketingPageView> {
    const [pageView] = await db
      .insert(marketingPageViews)
      .values(data)
      .returning();
    return pageView;
  }

  async getMarketingAnalyticsSummary(startDate?: Date, endDate?: Date): Promise<MarketingAnalyticsSummary> {
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    // Total page views
    const pageViewsResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(marketingPageViews)
      .where(and(
        sql`${marketingPageViews.createdAt} >= ${start}`,
        sql`${marketingPageViews.createdAt} <= ${end}`
      ));
    const totalPageViews = pageViewsResult[0]?.count || 0;

    // Unique visitors (by sessionId)
    const uniqueVisitorsResult = await db
      .select({ count: sql<number>`count(distinct ${marketingPageViews.sessionId})::int` })
      .from(marketingPageViews)
      .where(and(
        sql`${marketingPageViews.createdAt} >= ${start}`,
        sql`${marketingPageViews.createdAt} <= ${end}`
      ));
    const uniqueVisitors = uniqueVisitorsResult[0]?.count || 0;

    // Top pages
    const topPagesResult = await db
      .select({
        path: marketingPageViews.pagePath,
        views: sql<number>`count(*)::int`,
      })
      .from(marketingPageViews)
      .where(and(
        sql`${marketingPageViews.createdAt} >= ${start}`,
        sql`${marketingPageViews.createdAt} <= ${end}`
      ))
      .groupBy(marketingPageViews.pagePath)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    // Source breakdown
    const sourceBreakdownResult = await db
      .select({
        source: sql<string>`coalesce(${marketingPageViews.sourceType}, 'direct')`,
        views: sql<number>`count(*)::int`,
      })
      .from(marketingPageViews)
      .where(and(
        sql`${marketingPageViews.createdAt} >= ${start}`,
        sql`${marketingPageViews.createdAt} <= ${end}`
      ))
      .groupBy(sql`coalesce(${marketingPageViews.sourceType}, 'direct')`)
      .orderBy(sql`count(*) desc`);

    const sourceBreakdown = sourceBreakdownResult.map(s => ({
      source: s.source,
      views: s.views,
      percentage: totalPageViews > 0 ? Math.round((s.views / totalPageViews) * 100) : 0,
    }));

    // UTM performance
    const utmPerformanceResult = await db
      .select({
        campaign: sql<string>`coalesce(${marketingPageViews.utmCampaign}, 'none')`,
        source: sql<string>`coalesce(${marketingPageViews.utmSource}, 'none')`,
        medium: sql<string>`coalesce(${marketingPageViews.utmMedium}, 'none')`,
        views: sql<number>`count(*)::int`,
      })
      .from(marketingPageViews)
      .where(and(
        sql`${marketingPageViews.createdAt} >= ${start}`,
        sql`${marketingPageViews.createdAt} <= ${end}`,
        sql`${marketingPageViews.utmSource} is not null`
      ))
      .groupBy(marketingPageViews.utmCampaign, marketingPageViews.utmSource, marketingPageViews.utmMedium)
      .orderBy(sql`count(*) desc`)
      .limit(20);

    // Partner performance
    const partnerPerformanceResult = await db
      .select({
        partner: sql<string>`coalesce(${marketingPageViews.partner}, 'organic')`,
        views: sql<number>`count(*)::int`,
      })
      .from(marketingPageViews)
      .where(and(
        sql`${marketingPageViews.createdAt} >= ${start}`,
        sql`${marketingPageViews.createdAt} <= ${end}`
      ))
      .groupBy(marketingPageViews.partner)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    // Get quote counts by partner for conversion rate
    const partnerQuotesResult = await db
      .select({
        partner: sql<string>`coalesce(${quotes.partner}, 'organic')`,
        quotes: sql<number>`count(*)::int`,
      })
      .from(quotes)
      .where(and(
        sql`${quotes.createdAt} >= ${start}`,
        sql`${quotes.createdAt} <= ${end}`
      ))
      .groupBy(quotes.partner);

    const partnerQuotesMap = new Map(partnerQuotesResult.map(p => [p.partner, p.quotes]));
    const partnerPerformance = partnerPerformanceResult.map(p => ({
      partner: p.partner,
      views: p.views,
      quotes: partnerQuotesMap.get(p.partner) || 0,
      conversionRate: p.views > 0 ? Math.round(((partnerQuotesMap.get(p.partner) || 0) / p.views) * 100) : 0,
    }));

    // AI referrals
    const aiReferralsResult = await db
      .select({
        source: sql<string>`coalesce(${marketingPageViews.referrerUrl}, 'unknown')`,
        views: sql<number>`count(*)::int`,
      })
      .from(marketingPageViews)
      .where(and(
        sql`${marketingPageViews.createdAt} >= ${start}`,
        sql`${marketingPageViews.createdAt} <= ${end}`,
        eq(marketingPageViews.sourceType, 'ai')
      ))
      .groupBy(marketingPageViews.referrerUrl)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    // Trend data (daily views)
    const trendDataResult = await db
      .select({
        date: sql<string>`date(${marketingPageViews.createdAt})::text`,
        views: sql<number>`count(*)::int`,
      })
      .from(marketingPageViews)
      .where(and(
        sql`${marketingPageViews.createdAt} >= ${start}`,
        sql`${marketingPageViews.createdAt} <= ${end}`
      ))
      .groupBy(sql`date(${marketingPageViews.createdAt})`)
      .orderBy(sql`date(${marketingPageViews.createdAt})`);

    return {
      totalPageViews,
      uniqueVisitors,
      topPages: topPagesResult.map(p => ({ path: p.path, views: p.views })),
      sourceBreakdown,
      utmPerformance: utmPerformanceResult.map(u => ({ ...u, conversions: 0 })),
      partnerPerformance,
      aiReferrals: aiReferralsResult.map(a => ({ source: a.source, views: a.views })),
      trendData: trendDataResult.map(t => ({ date: t.date, views: t.views })),
    };
  }

  // Document Types
  async getDocumentTypes(): Promise<DocumentType[]> {
    return await db.select().from(documentTypes).orderBy(asc(documentTypes.sortOrder));
  }

  async getActiveDocumentTypes(): Promise<DocumentType[]> {
    return await db.select().from(documentTypes)
      .where(eq(documentTypes.isActive, true))
      .orderBy(asc(documentTypes.sortOrder));
  }

  async getDocumentType(id: string): Promise<DocumentType | undefined> {
    const [docType] = await db.select().from(documentTypes).where(eq(documentTypes.id, id));
    return docType || undefined;
  }

  async getDocumentTypeByKey(key: string): Promise<DocumentType | undefined> {
    const [docType] = await db.select().from(documentTypes).where(eq(documentTypes.key, key));
    return docType || undefined;
  }

  async createDocumentType(data: InsertDocumentType): Promise<DocumentType> {
    const [docType] = await db.insert(documentTypes).values(data).returning();
    return docType;
  }

  async updateDocumentType(id: string, data: Partial<InsertDocumentType>): Promise<DocumentType> {
    const [docType] = await db.update(documentTypes)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(documentTypes.id, id))
      .returning();
    return docType;
  }

  async deleteDocumentType(id: string): Promise<void> {
    await db.delete(documentTypes).where(eq(documentTypes.id, id));
  }

  // Partner Documents
  async getPartnerDocuments(moverProfileId: string): Promise<PartnerDocument[]> {
    return await db.select().from(partnerDocuments)
      .where(eq(partnerDocuments.moverProfileId, moverProfileId))
      .orderBy(desc(partnerDocuments.uploadedAt));
  }

  async getPartnerDocument(id: string): Promise<PartnerDocument | undefined> {
    const [doc] = await db.select().from(partnerDocuments).where(eq(partnerDocuments.id, id));
    return doc || undefined;
  }

  async getPartnerDocumentByType(moverProfileId: string, documentTypeId: string): Promise<PartnerDocument | undefined> {
    const [doc] = await db.select().from(partnerDocuments)
      .where(and(
        eq(partnerDocuments.moverProfileId, moverProfileId),
        eq(partnerDocuments.documentTypeId, documentTypeId)
      ));
    return doc || undefined;
  }

  async createPartnerDocument(data: InsertPartnerDocument): Promise<PartnerDocument> {
    const [doc] = await db.insert(partnerDocuments).values(data).returning();
    return doc;
  }

  async updatePartnerDocument(id: string, data: Partial<PartnerDocument>): Promise<PartnerDocument> {
    const [doc] = await db.update(partnerDocuments)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(partnerDocuments.id, id))
      .returning();
    return doc;
  }

  async deletePartnerDocument(id: string): Promise<void> {
    await db.delete(partnerDocuments).where(eq(partnerDocuments.id, id));
  }

  async reviewPartnerDocument(id: string, reviewerId: string, status: string, reviewNote?: string): Promise<PartnerDocument> {
    const [doc] = await db.update(partnerDocuments)
      .set({
        status,
        reviewerId,
        reviewedAt: new Date(),
        reviewNote: reviewNote || null,
        updatedAt: new Date(),
      })
      .where(eq(partnerDocuments.id, id))
      .returning();
    return doc;
  }

  async getPartnerDocumentsWithTypes(moverProfileId: string): Promise<Array<PartnerDocument & { documentType: DocumentType }>> {
    const docs = await db.select({
      document: partnerDocuments,
      documentType: documentTypes,
    })
    .from(partnerDocuments)
    .leftJoin(documentTypes, eq(partnerDocuments.documentTypeId, documentTypes.id))
    .where(eq(partnerDocuments.moverProfileId, moverProfileId))
    .orderBy(desc(partnerDocuments.uploadedAt));

    return docs.map(row => ({
      ...row.document,
      documentType: row.documentType!,
    }));
  }

  // Blog Posts
  async getBlogPosts(filters?: { status?: string; featured?: boolean; category?: string; search?: string }): Promise<BlogPost[]> {
    let query = db.select().from(blogPosts);
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(blogPosts.status, filters.status));
    }
    if (filters?.featured !== undefined) {
      conditions.push(eq(blogPosts.featured, filters.featured));
    }
    if (filters?.category) {
      conditions.push(sql`(${blogPosts.categoryEs} = ${filters.category} OR ${blogPosts.categoryEn} = ${filters.category})`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return await query.orderBy(desc(blogPosts.publishedAt), desc(blogPosts.createdAt));
  }

  async getPublishedBlogPosts(): Promise<BlogPost[]> {
    return await db.select().from(blogPosts)
      .where(eq(blogPosts.status, 'published'))
      .orderBy(desc(blogPosts.publishedAt));
  }

  async getBlogPost(id: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.id, id));
    return post || undefined;
  }

  async getBlogPostBySlug(slug: string): Promise<BlogPost | undefined> {
    const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
    return post || undefined;
  }

  async createBlogPost(data: InsertBlogPost): Promise<BlogPost> {
    const [post] = await db.insert(blogPosts).values(data).returning();
    return post;
  }

  async updateBlogPost(id: string, data: Partial<InsertBlogPost>): Promise<BlogPost> {
    const [post] = await db.update(blogPosts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return post;
  }

  async deleteBlogPost(id: string): Promise<void> {
    await db.delete(blogPosts).where(eq(blogPosts.id, id));
  }

  async publishBlogPost(id: string): Promise<BlogPost> {
    const [post] = await db.update(blogPosts)
      .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return post;
  }

  async unpublishBlogPost(id: string): Promise<BlogPost> {
    const [post] = await db.update(blogPosts)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(eq(blogPosts.id, id))
      .returning();
    return post;
  }

  async incrementBlogViewCount(id: string): Promise<void> {
    await db.update(blogPosts)
      .set({ viewCount: sql`${blogPosts.viewCount} + 1` })
      .where(eq(blogPosts.id, id));
  }

  async getBlogCategories(): Promise<{ categoryEs: string; categoryEn: string; count: number }[]> {
    const result = await db.select({
      categoryEs: blogPosts.categoryEs,
      categoryEn: blogPosts.categoryEn,
      count: sql<number>`count(*)::int`,
    })
    .from(blogPosts)
    .where(eq(blogPosts.status, 'published'))
    .groupBy(blogPosts.categoryEs, blogPosts.categoryEn);
    
    return result.filter(r => r.categoryEs || r.categoryEn) as { categoryEs: string; categoryEn: string; count: number }[];
  }

  // ========== Mover Profile by Phone ==========
  async getMoverProfileByPhone(phone: string): Promise<MoverProfile | undefined> {
    if (!phone) return undefined;
    const [profile] = await db.select().from(moverProfiles)
      .where(
        sql`${moverProfiles.contactPhone} = ${phone} OR ${moverProfiles.contactWhatsApp} = ${phone}`
      );
    return profile || undefined;
  }

  // ========== WhatsApp Config ==========
  async getWhatsappConfig(): Promise<WhatsappConfig | undefined> {
    const [config] = await db.select().from(whatsappConfig);
    return config || undefined;
  }

  async upsertWhatsappConfig(data: Partial<InsertWhatsappConfig>): Promise<WhatsappConfig> {
    const existing = await this.getWhatsappConfig();
    if (existing) {
      const [updated] = await db.update(whatsappConfig)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(whatsappConfig.id, existing.id))
        .returning();
      return updated;
    }
    const insertData: InsertWhatsappConfig = {
      whatsappNumber: data.whatsappNumber ?? null,
      isActive: data.isActive ?? false,
      lastConnectionCheck: data.lastConnectionCheck ?? null,
      connectionStatus: data.connectionStatus ?? 'not_configured',
      updatedBy: data.updatedBy ?? null,
    };
    const [created] = await db.insert(whatsappConfig)
      .values(insertData)
      .returning();
    return created;
  }

  // ========== Conversations (Twilio) ==========
  async getConversation(id: string): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(conversations).where(eq(conversations.id, id));
    return conv || undefined;
  }

  async getConversationByPhone(phone: string, channel: string = 'whatsapp'): Promise<Conversation | undefined> {
    const [conv] = await db.select().from(conversations)
      .where(and(eq(conversations.contactPhone, phone), eq(conversations.channel, channel)));
    return conv || undefined;
  }

  async getAllConversations(status?: string): Promise<Conversation[]> {
    if (status) {
      return db.select().from(conversations)
        .where(eq(conversations.status, status))
        .orderBy(desc(conversations.lastMessageAt));
    }
    return db.select().from(conversations)
      .orderBy(desc(conversations.lastMessageAt));
  }

  async createConversation(data: InsertConversation): Promise<Conversation> {
    const [conv] = await db.insert(conversations).values(data).returning();
    return conv;
  }

  async updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation> {
    const [updated] = await db.update(conversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    return updated;
  }

  // ========== Messages (Twilio) ==========
  async getMessage(id: string): Promise<Message | undefined> {
    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
    return msg || undefined;
  }

  async getMessageByTwilioSid(sid: string): Promise<Message | undefined> {
    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.twilioMessageSid, sid));
    return msg || undefined;
  }

  async getMessagesByConversation(conversationId: string, limit: number = 50): Promise<Message[]> {
    return db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, conversationId))
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit);
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [msg] = await db.insert(messagesTable).values(data).returning();
    return msg;
  }

  async updateMessage(id: string, data: Partial<Message>): Promise<Message> {
    const [updated] = await db.update(messagesTable)
      .set(data)
      .where(eq(messagesTable.id, id))
      .returning();
    return updated;
  }

  async updateMessageByTwilioSid(sid: string, data: Partial<Message>): Promise<Message | undefined> {
    const [updated] = await db.update(messagesTable)
      .set(data)
      .where(eq(messagesTable.twilioMessageSid, sid))
      .returning();
    return updated || undefined;
  }

  // ========== Conversation Assignments ==========
  async getConversationAssignments(conversationId: string): Promise<ConversationAssignment[]> {
    return db.select().from(conversationAssignments)
      .where(eq(conversationAssignments.conversationId, conversationId))
      .orderBy(desc(conversationAssignments.assignedAt));
  }

  async createConversationAssignment(data: InsertConversationAssignment): Promise<ConversationAssignment> {
    const [assignment] = await db.insert(conversationAssignments).values(data).returning();
    return assignment;
  }

  async endConversationAssignment(id: string): Promise<ConversationAssignment> {
    const [updated] = await db.update(conversationAssignments)
      .set({ unassignedAt: new Date() })
      .where(eq(conversationAssignments.id, id))
      .returning();
    return updated;
  }

  // ========== WhatsApp Admin Inbox Conversations ==========
  async getWhatsappConversations(filters?: { status?: string; assignedAgentId?: string; unassigned?: boolean }): Promise<WhatsappConversation[]> {
    const conditions = [];
    if (filters?.status) {
      conditions.push(eq(whatsappConversations.status, filters.status));
    }
    if (filters?.assignedAgentId) {
      conditions.push(eq(whatsappConversations.assignedAgentId, filters.assignedAgentId));
    }
    if (filters?.unassigned) {
      conditions.push(sql`${whatsappConversations.assignedAgentId} IS NULL`);
    }

    const query = db.select().from(whatsappConversations).orderBy(desc(whatsappConversations.lastMessageAt));
    if (conditions.length > 0) {
      return query.where(and(...conditions));
    }
    return query;
  }

  async getWhatsappConversation(id: string): Promise<WhatsappConversation | undefined> {
    const [conv] = await db.select().from(whatsappConversations).where(eq(whatsappConversations.id, id));
    return conv || undefined;
  }

  async createWhatsappConversation(data: InsertWhatsappConversation): Promise<WhatsappConversation> {
    const [conv] = await db.insert(whatsappConversations).values(data).returning();
    return conv;
  }

  async updateWhatsappConversation(id: string, data: Partial<WhatsappConversation>): Promise<WhatsappConversation> {
    const [conv] = await db.update(whatsappConversations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(whatsappConversations.id, id))
      .returning();
    return conv;
  }

  async getWhatsappConversationByPhone(phone: string): Promise<WhatsappConversation | undefined> {
    const [conv] = await db.select().from(whatsappConversations).where(eq(whatsappConversations.contactPhone, phone));
    return conv || undefined;
  }

  async getTotalUnreadCount(): Promise<number> {
    const [result] = await db.select({
      total: sql<number>`COALESCE(SUM(${whatsappConversations.unreadCount}), 0)::int`,
    }).from(whatsappConversations)
      .where(sql`${whatsappConversations.status} != 'closed'`);
    return result?.total || 0;
  }

  // ========== WhatsApp Admin Inbox Messages ==========
  async getWhatsappMessages(conversationId: string): Promise<WhatsappMessage[]> {
    return db.select().from(whatsappMessages)
      .where(eq(whatsappMessages.conversationId, conversationId))
      .orderBy(asc(whatsappMessages.createdAt));
  }

  async createWhatsappMessage(data: InsertWhatsappMessage): Promise<WhatsappMessage> {
    const [msg] = await db.insert(whatsappMessages).values(data).returning();
    return msg;
  }

  // ========== CRM Outbox (Salesforce lead mirroring) ==========
  async createCrmOutboxEntry(data: InsertCrmOutbox): Promise<CrmOutbox> {
    const [entry] = await db.insert(crmOutbox).values(data).returning();
    return entry;
  }

  async getCrmOutboxEntry(id: string): Promise<CrmOutbox | undefined> {
    const [entry] = await db.select().from(crmOutbox).where(eq(crmOutbox.id, id));
    return entry || undefined;
  }

  async getCrmOutboxEntries(filters?: { status?: string; partner?: string; limit?: number }): Promise<Array<CrmOutbox & { quote?: Quote }>> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(crmOutbox.status, filters.status));
    if (filters?.partner) conditions.push(eq(crmOutbox.partner, filters.partner));

    const rows = await db.select({
      outbox: crmOutbox,
      quote: quotes,
    })
      .from(crmOutbox)
      .leftJoin(quotes, eq(crmOutbox.quoteId, quotes.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(crmOutbox.createdAt))
      .limit(filters?.limit || 200);

    return rows.map(r => ({ ...r.outbox, quote: r.quote || undefined }));
  }

  async getCrmOutboxByQuote(quoteId: string): Promise<CrmOutbox[]> {
    return db.select().from(crmOutbox)
      .where(eq(crmOutbox.quoteId, quoteId))
      .orderBy(desc(crmOutbox.createdAt));
  }

  async getUnsentCrmOutboxByQuote(quoteId: string): Promise<CrmOutbox | undefined> {
    const [entry] = await db.select().from(crmOutbox)
      .where(and(
        eq(crmOutbox.quoteId, quoteId),
        inArray(crmOutbox.status, ['pending', 'dry_run']),
      ))
      .orderBy(desc(crmOutbox.createdAt))
      .limit(1);
    return entry || undefined;
  }

  async getDeliverableCrmOutboxEntries(limit: number, includeDryRun: boolean): Promise<CrmOutbox[]> {
    // Pending entries respect their backoff schedule (nextAttemptAt).
    // Dry-run entries (only included once credentials are configured) are
    // immediately eligible regardless of nextAttemptAt, so the backlog drains
    // as soon as credentials arrive.
    const pendingCondition = and(
      eq(crmOutbox.status, 'pending'),
      sql`(${crmOutbox.nextAttemptAt} IS NULL OR ${crmOutbox.nextAttemptAt} <= NOW())`,
    );
    const condition = includeDryRun
      ? sql`(${pendingCondition} OR ${eq(crmOutbox.status, 'dry_run')})`
      : pendingCondition;
    return db.select().from(crmOutbox)
      .where(condition)
      .orderBy(asc(crmOutbox.createdAt))
      .limit(limit);
  }

  async updateCrmOutboxEntry(id: string, data: Partial<CrmOutbox>): Promise<CrmOutbox> {
    const [entry] = await db.update(crmOutbox)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(crmOutbox.id, id))
      .returning();
    return entry;
  }

  async getCrmOutboxStats(): Promise<{ pending: number; dryRun: number; sent: number; failed: number }> {
    const rows = await db.select({
      status: crmOutbox.status,
      count: sql<number>`COUNT(*)::int`,
    }).from(crmOutbox).groupBy(crmOutbox.status);

    const stats = { pending: 0, dryRun: 0, sent: 0, failed: 0 };
    for (const row of rows) {
      if (row.status === 'pending') stats.pending = row.count;
      else if (row.status === 'dry_run') stats.dryRun = row.count;
      else if (row.status === 'sent') stats.sent = row.count;
      else if (row.status === 'failed') stats.failed = row.count;
    }
    return stats;
  }

  // ========== U-Storage branches ==========

  async getUstorageBranches(): Promise<UstorageBranch[]> {
    return db.select().from(ustorageBranches).orderBy(asc(ustorageBranches.region), asc(ustorageBranches.name));
  }

  async getUstorageBranch(id: string): Promise<UstorageBranch | undefined> {
    const [branch] = await db.select().from(ustorageBranches).where(eq(ustorageBranches.id, id));
    return branch || undefined;
  }

  async getUstorageBranchByExternalId(externalId: string): Promise<UstorageBranch | undefined> {
    const [branch] = await db.select().from(ustorageBranches).where(eq(ustorageBranches.externalId, externalId));
    return branch || undefined;
  }

  async getUstorageBranchByGooglePlaceId(googlePlaceId: string): Promise<UstorageBranch | undefined> {
    const [branch] = await db.select().from(ustorageBranches).where(eq(ustorageBranches.googlePlaceId, googlePlaceId));
    return branch || undefined;
  }

  async createUstorageBranch(data: InsertUstorageBranch): Promise<UstorageBranch> {
    const [branch] = await db.insert(ustorageBranches).values(data).returning();
    return branch;
  }

  async updateUstorageBranch(id: string, data: Partial<InsertUstorageBranch> & { lastScrapedAt?: Date }): Promise<UstorageBranch> {
    const [branch] = await db.update(ustorageBranches)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ustorageBranches.id, id))
      .returning();
    return branch;
  }

  async getUstorageSettings(): Promise<UstorageSettings> {
    const [existing] = await db.select().from(ustorageSettings).limit(1);
    if (existing) return existing;
    const [created] = await db.insert(ustorageSettings).values({}).returning();
    return created;
  }

  async updateUstorageSettings(data: Partial<InsertUstorageSettings>): Promise<UstorageSettings> {
    const current = await this.getUstorageSettings();
    const [updated] = await db.update(ustorageSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(ustorageSettings.id, current.id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
