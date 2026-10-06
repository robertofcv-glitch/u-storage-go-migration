/**
 * Salesforce CRM Lead Mirroring Service
 *
 * Mirrors partner leads (e.g. partner=u-storage) into the partner's Salesforce CRM.
 *
 * Architecture: outbox pattern.
 * - Every eligible lead gets a durable `crm_outbox` row with the exact mapped payload.
 * - A background worker delivers pending rows with retry/backoff.
 * - When Salesforce credentials are NOT configured, the worker runs in "dry-run" mode:
 *   entries are marked `dry_run` (payload preserved for review) and are automatically
 *   picked up and delivered for real once credentials become available.
 *
 * Credentials (in priority order):
 * 1. Replit Salesforce connector (user connects the u-storage Salesforce org via
 *    Replit's integrations panel) - provides instance URL + OAuth access token.
 * 2. Environment secrets (Replit Secrets):
 *    - SALESFORCE_INSTANCE_URL (e.g. https://ustorage.my.salesforce.com)
 *    - SALESFORCE_CLIENT_ID + SALESFORCE_CLIENT_SECRET (OAuth2 Client Credentials flow)
 *
 * See docs/salesforce-ustorage-integration.md for the full credential checklist.
 */

import { storage } from '../storage';
import type { Quote, InventoryItem, CrmOutbox } from '@shared/schema';
import { getStorageMoveContext } from '@shared/storageMoveContext';

const SALESFORCE_API_VERSION = 'v59.0';
const MAX_ATTEMPTS = 8;
const MIRRORED_PARTNERS = ['u-storage'];

// ============================================================
// Credentials
// ============================================================

interface SalesforceCredentials {
  instanceUrl: string;
  accessToken: string;
  source: 'replit_connector' | 'env_secrets';
}

let cachedEnvToken: { accessToken: string; instanceUrl: string; expiresAt: number } | null = null;

/**
 * Try to fetch credentials from the Replit Salesforce connector.
 * Returns null when the connector is not set up (expected until u-storage connects).
 */
async function getConnectorCredentials(): Promise<SalesforceCredentials | null> {
  try {
    const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
    if (!hostname) return null;

    const xReplitToken = process.env.REPL_IDENTITY
      ? 'repl ' + process.env.REPL_IDENTITY
      : process.env.WEB_REPL_RENEWAL
      ? 'depl ' + process.env.WEB_REPL_RENEWAL
      : null;
    if (!xReplitToken) return null;

    const response = await fetch(
      'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=salesforce',
      {
        headers: {
          'Accept': 'application/json',
          'X_REPLIT_TOKEN': xReplitToken,
        },
      }
    );
    if (!response.ok) return null;

    const data = await response.json();
    const connection = data.items?.[0];
    if (!connection) return null;

    const settings = connection.settings || {};
    const accessToken = settings.access_token || settings.oauth?.credentials?.access_token;
    const instanceUrl = settings.instance_url || settings.oauth?.credentials?.instance_url || settings.metadata?.instance_url;

    if (!accessToken || !instanceUrl) return null;

    return { instanceUrl, accessToken, source: 'replit_connector' };
  } catch {
    return null;
  }
}

/**
 * Try OAuth2 Client Credentials flow using env secrets.
 * Returns null when secrets are not configured (expected until u-storage provides them).
 */
async function getEnvCredentials(): Promise<SalesforceCredentials | null> {
  const instanceUrl = process.env.SALESFORCE_INSTANCE_URL;
  const clientId = process.env.SALESFORCE_CLIENT_ID;
  const clientSecret = process.env.SALESFORCE_CLIENT_SECRET;

  if (!instanceUrl || !clientId || !clientSecret) return null;

  // Reuse cached token if still valid (with 60s safety margin)
  if (cachedEnvToken && cachedEnvToken.expiresAt > Date.now() + 60_000) {
    return { instanceUrl: cachedEnvToken.instanceUrl, accessToken: cachedEnvToken.accessToken, source: 'env_secrets' };
  }

  try {
    const tokenUrl = `${instanceUrl.replace(/\/$/, '')}/services/oauth2/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Salesforce] Token request failed:', response.status, errText.slice(0, 300));
      return null;
    }

    const data = await response.json();
    if (!data.access_token) return null;

    const resolvedInstanceUrl = data.instance_url || instanceUrl;
    cachedEnvToken = {
      accessToken: data.access_token,
      instanceUrl: resolvedInstanceUrl,
      // Salesforce client_credentials tokens typically last ~2h; refresh conservatively
      expiresAt: Date.now() + 30 * 60 * 1000,
    };

    return { instanceUrl: resolvedInstanceUrl, accessToken: data.access_token, source: 'env_secrets' };
  } catch (error) {
    console.error('[Salesforce] Token request error:', error instanceof Error ? error.message : error);
    return null;
  }
}

export async function getSalesforceCredentials(): Promise<SalesforceCredentials | null> {
  return (await getConnectorCredentials()) || (await getEnvCredentials());
}

export async function isSalesforceConfigured(): Promise<boolean> {
  return (await getSalesforceCredentials()) !== null;
}

// ============================================================
// Lead mapping
// ============================================================

export interface SalesforceLeadPayload {
  FirstName: string;
  LastName: string;
  Email: string | null;
  Phone: string | null;
  Company: string;
  LeadSource: string;
  Description: string;
  /** Explicit, snapshot-safe move context fields shared with partner dispatch. */
  ServiceMode: string;
  MoveDirection: string | null;
  StorageBranchId: string | null;
  StorageBranchExternalId: string | null;
  StorageBranchBrand: string | null;
  StorageBranchName: string | null;
  StorageBranchAddress: string | null;
  StorageBranchGooglePlaceId: string | null;
  MoveContext: string;
  QuoteNumber: string | null;
  MoveDate: string | null;
  HomeSize: string | null;
  FromAddress: string;
  ToAddress: string;
  StorageAccepted: string | null;
  StorageSizeLabel: string | null;
  EstimatedCost: string | null;
  EstimatedCostHigh: string | null;
  EstimatedCurrency: string | null;
  [key: string]: string | null;
}

export type SalesforceApiLeadPayload = Pick<SalesforceLeadPayload,
  "FirstName" | "LastName" | "Email" | "Phone" | "Company" | "LeadSource" | "Description"
>;

/**
 * Only standard Lead fields are sent directly to Salesforce. Canonical storage
 * fields remain explicit in the durable outbox payload and are also embedded
 * in Description until the target org provides its custom-field API names.
 */
export function toSalesforceApiPayload(payload: SalesforceLeadPayload): SalesforceApiLeadPayload {
  const { FirstName, LastName, Email, Phone, Company, LeadSource, Description } = payload;
  return { FirstName, LastName, Email, Phone, Company, LeadSource, Description };
}

function splitName(fullName: string | null | undefined): { firstName: string; lastName: string } {
  const name = (fullName || '').trim();
  if (!name) return { firstName: '', lastName: 'Sin Nombre' };
  const parts = name.split(/\s+/);
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

/**
 * Map a U-Storage Go quote (lead) to the Salesforce standard Lead object shape.
 * Custom fields on u-storage's side can be added here once they share their object model.
 */
export function mapQuoteToSalesforceLead(quote: Quote, inventoryItems: InventoryItem[] = []): SalesforceLeadPayload {
  const { firstName, lastName } = splitName(quote.contactName);
  // The quote's persisted branch snapshot is the source of truth. Do not
  // rehydrate a branch from the live catalog while mapping or retrying.
  const moveContext = getStorageMoveContext(quote);
  const branch = moveContext.branch;
  const moveDate = quote.moveDate ? new Date(quote.moveDate).toISOString().split('T')[0] : null;

  const descriptionLines = [
    `Cotización U-Storage Go: ${quote.quoteNumber || quote.id}`,
    `Origen: ${quote.fromAddress || 'N/D'}`,
    `Destino: ${quote.toAddress || 'N/D'}`,
    `Fecha de mudanza: ${moveDate || 'N/D'}`,
    `Tamaño de hogar: ${quote.homeSize || 'N/D'}`,
    `Almacenamiento: ${quote.storageOption || 'No solicitado'}`,
    `Modo de servicio: ${moveContext.labels.serviceEs} (${moveContext.serviceMode})`,
    moveContext.direction ? `Dirección: ${moveContext.labels.directionEs} (${moveContext.direction})` : null,
    branch ? `Bodega: ${branch.brand} · ${branch.name} · ${branch.address}` : null,
    branch ? `Bodega ID: ${branch.id}${branch.externalId ? ` / ${branch.externalId}` : ''}` : null,
    branch ? `Google Place ID: ${branch.googlePlaceId}` : null,
    quote.storageMoveType ? `Tipo de mudanza con bodega: ${quote.storageMoveType === 'into_storage' ? 'Hacia bodega U-Storage' : 'Desde bodega U-Storage'}` : null,
    quote.storageAccepted === true ? `Bodega U-Storage ACEPTADA${quote.storageSizeLabel ? ` - Tamaño sugerido: ${quote.storageSizeLabel}` : ''}` : null,
    quote.storageAccepted === false && quote.storageMoveType ? 'Recomendación de bodega mostrada pero no aceptada' : null,
    quote.estimatedCost ? `Estimado: ${quote.estimatedCost}${quote.estimatedCostHigh ? ` - ${quote.estimatedCostHigh}` : ''} ${quote.estimatedCurrency || 'MXN'}` : null,
    inventoryItems.length > 0 ? `Artículos de inventario: ${inventoryItems.reduce((sum, i) => sum + (i.quantity || 1), 0)}` : null,
    quote.utmSource ? `UTM: ${[quote.utmSource, quote.utmMedium, quote.utmCampaign].filter(Boolean).join(' / ')}` : null,
    quote.landingPage ? `Página de aterrizaje: ${quote.landingPage}` : null,
  ].filter(Boolean);

  return {
    FirstName: firstName,
    LastName: lastName,
    Email: quote.contactEmail || null,
    Phone: quote.contactPhone || null,
    Company: quote.contactName || 'Particular',
    LeadSource: 'U-Storage Go - U-Storage',
    Description: descriptionLines.join('\n'),
    ServiceMode: moveContext.serviceMode,
    MoveDirection: moveContext.direction,
    StorageBranchId: branch?.id || null,
    StorageBranchExternalId: branch?.externalId || null,
    StorageBranchBrand: branch?.brand || null,
    StorageBranchName: branch?.name || null,
    StorageBranchAddress: branch?.address || null,
    StorageBranchGooglePlaceId: branch?.googlePlaceId || null,
    // Keep the complete canonical contract available to Salesforce consumers.
    MoveContext: JSON.stringify(moveContext),
    QuoteNumber: quote.quoteNumber || null,
    MoveDate: moveDate,
    HomeSize: quote.homeSize || null,
    FromAddress: quote.fromAddress,
    ToAddress: quote.toAddress,
    StorageAccepted: quote.storageAccepted == null ? null : String(quote.storageAccepted),
    StorageSizeLabel: quote.storageSizeLabel || null,
    EstimatedCost: quote.estimatedCost || null,
    EstimatedCostHigh: quote.estimatedCostHigh || null,
    EstimatedCurrency: quote.estimatedCurrency || null,
  };
}

// ============================================================
// Enqueue (outbox capture)
// ============================================================

export function isMirroredPartner(partner: string | null | undefined): boolean {
  return !!partner && MIRRORED_PARTNERS.includes(partner);
}

/**
 * Capture a lead into the CRM outbox. Never throws - lead creation must not break.
 * If an unsent entry already exists for this quote, its payload is refreshed instead
 * of creating a duplicate (partial quotes get saved multiple times as users type).
 */
export async function enqueueCrmLead(quote: Quote, eventType: 'lead.created' | 'lead.updated' | 'storage.accepted' = 'lead.created'): Promise<void> {
  try {
    if (!isMirroredPartner(quote.partner)) return;

    const existingEntries = await storage.getCrmOutboxByQuote(quote.id);

    if (eventType === 'storage.accepted') {
      // Storage acceptance must be mirrored even after the original lead was
      // delivered: it updates the existing Salesforce Lead instead of creating
      // a duplicate. Idempotent: one storage.accepted entry per quote.
      const storageEntries = existingEntries.filter(e => e.eventType === 'storage.accepted');
      if (storageEntries.some(e => e.status === 'sent')) return;

      const leadSent = existingEntries.some(e => e.eventType !== 'storage.accepted' && e.status === 'sent');
      if (!leadSent) {
        // Original lead not delivered yet: its (pending/dry_run) payload will be
        // refreshed below with the acceptance fields — no separate event needed.
        const unsentLead = existingEntries.find(e => e.eventType !== 'storage.accepted' && (e.status === 'pending' || e.status === 'dry_run'));
        if (unsentLead) {
          const inventoryItems = await storage.getInventoryByQuote(quote.id).catch(() => []);
          await storage.updateCrmOutboxEntry(unsentLead.id, {
            payload: mapQuoteToSalesforceLead(quote, inventoryItems) as any,
            status: 'pending',
            nextAttemptAt: new Date(),
          });
          processCrmOutbox().catch(err =>
            console.error('[Salesforce] Outbox kick failed:', err instanceof Error ? err.message : err)
          );
          return;
        }
        // No lead entry at all — fall through to create one via the standard path.
      } else {
        const inventoryItems = await storage.getInventoryByQuote(quote.id).catch(() => []);
        const payload = mapQuoteToSalesforceLead(quote, inventoryItems);
        const unsentStorage = storageEntries.find(e => e.status === 'pending' || e.status === 'dry_run');
        if (unsentStorage) {
          await storage.updateCrmOutboxEntry(unsentStorage.id, {
            payload: payload as any,
            status: 'pending',
            nextAttemptAt: new Date(),
          });
        } else {
          await storage.createCrmOutboxEntry({
            provider: 'salesforce',
            partner: quote.partner!,
            quoteId: quote.id,
            eventType: 'storage.accepted',
            payload: payload as any,
            status: 'pending',
            attempts: 0,
            nextAttemptAt: new Date(),
          });
          console.log(`[Salesforce] Enqueued storage.accepted outbox entry for quote ${quote.id}`);
        }
        processCrmOutbox().catch(err =>
          console.error('[Salesforce] Outbox kick failed:', err instanceof Error ? err.message : err)
        );
        return;
      }
    }

    // Idempotency: once a quote's lead has been delivered, routine quote updates
    // must NOT create a new outbox row (would produce duplicate Salesforce Leads).
    if (existingEntries.some(e => e.eventType !== 'storage.accepted' && e.status === 'sent')) {
      return;
    }

    const inventoryItems = await storage.getInventoryByQuote(quote.id).catch(() => []);
    const payload = mapQuoteToSalesforceLead(quote, inventoryItems);

    const existing = existingEntries.find(e => e.eventType !== 'storage.accepted' && (e.status === 'pending' || e.status === 'dry_run'));
    if (existing) {
      await storage.updateCrmOutboxEntry(existing.id, {
        payload: payload as any,
        // Re-eligible for delivery immediately with the refreshed payload
        status: 'pending',
        nextAttemptAt: new Date(),
      });
      console.log(`[Salesforce] Refreshed outbox entry ${existing.id} for quote ${quote.id}`);
    } else {
      const entry = await storage.createCrmOutboxEntry({
        provider: 'salesforce',
        partner: quote.partner!,
        quoteId: quote.id,
        eventType,
        payload: payload as any,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
      });
      console.log(`[Salesforce] Enqueued outbox entry ${entry.id} for quote ${quote.id} (partner: ${quote.partner})`);
    }

    // Kick the worker so delivery/dry-run happens promptly (fire and forget)
    processCrmOutbox().catch(err =>
      console.error('[Salesforce] Outbox kick failed:', err instanceof Error ? err.message : err)
    );
  } catch (error) {
    // Never let CRM mirroring break lead creation
    console.error('[Salesforce] Failed to enqueue CRM lead:', error instanceof Error ? error.message : error);
  }
}

// ============================================================
// Delivery
// ============================================================

interface DeliveryResult {
  success: boolean;
  externalId?: string;
  error?: string;
  retryable: boolean;
}

async function deliverLead(payload: SalesforceLeadPayload, creds: SalesforceCredentials): Promise<DeliveryResult> {
  try {
    const url = `${creds.instanceUrl.replace(/\/$/, '')}/services/data/${SALESFORCE_API_VERSION}/sobjects/Lead`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toSalesforceApiPayload(payload)),
    });

    const data = await response.json().catch(() => null);

    if (response.ok && data?.id) {
      return { success: true, externalId: data.id, retryable: false };
    }

    const errorDetail = Array.isArray(data)
      ? data.map((e: any) => `${e.errorCode}: ${e.message}`).join('; ')
      : JSON.stringify(data)?.slice(0, 500) || `HTTP ${response.status}`;

    // 4xx errors (except 401/408/429) are permanent mapping/validation problems - don't hammer retries
    const retryable = response.status >= 500 || response.status === 401 || response.status === 408 || response.status === 429;

    return { success: false, error: errorDetail, retryable };
  } catch (error) {
    // Network errors are retryable
    return { success: false, error: error instanceof Error ? error.message : 'Unknown network error', retryable: true };
  }
}

/** Update an existing Salesforce Lead in place (used for storage.accepted events). */
async function deliverLeadUpdate(leadId: string, payload: SalesforceLeadPayload, creds: SalesforceCredentials): Promise<DeliveryResult> {
  try {
    const url = `${creds.instanceUrl.replace(/\/$/, '')}/services/data/${SALESFORCE_API_VERSION}/sobjects/Lead/${leadId}`;
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toSalesforceApiPayload(payload)),
    });

    if (response.status === 204 || response.ok) {
      return { success: true, externalId: leadId, retryable: false };
    }

    const data = await response.json().catch(() => null);
    const errorDetail = Array.isArray(data)
      ? data.map((e: any) => `${e.errorCode}: ${e.message}`).join('; ')
      : JSON.stringify(data)?.slice(0, 500) || `HTTP ${response.status}`;
    const retryable = response.status >= 500 || response.status === 401 || response.status === 408 || response.status === 429;
    return { success: false, error: errorDetail, retryable };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown network error', retryable: true };
  }
}

function backoffDelayMs(attempts: number): number {
  // 1min, 2min, 4min, ..., capped at 60min
  return Math.min(60, Math.pow(2, attempts - 1)) * 60 * 1000;
}

// ============================================================
// Worker
// ============================================================

let workerRunning = false;

/**
 * Process deliverable outbox entries.
 * - Credentials configured: delivers pending AND previously dry-run entries for real.
 * - No credentials: marks pending entries as dry_run (payload preserved, nothing lost).
 */
export async function processCrmOutbox(): Promise<{ processed: number; sent: number; dryRun: number; failed: number }> {
  const result = { processed: 0, sent: 0, dryRun: 0, failed: 0 };
  if (workerRunning) return result;
  workerRunning = true;

  try {
    const creds = await getSalesforceCredentials();
    const configured = creds !== null;

    // When configured, also pick up entries previously parked in dry_run
    const entries = await storage.getDeliverableCrmOutboxEntries(25, configured);
    if (entries.length === 0) return result;

    console.log(`[Salesforce] Processing ${entries.length} outbox entries (mode: ${configured ? 'live' : 'dry-run'})`);

    for (const entry of entries) {
      result.processed++;

      if (!configured) {
        // Dry-run: record what would be sent. Entries in dry_run status are not
        // re-processed while unconfigured, and become immediately deliverable
        // (regardless of nextAttemptAt) once credentials arrive.
        await storage.updateCrmOutboxEntry(entry.id, {
          status: 'dry_run',
          dryRunAt: new Date(),
          lastError: null,
        });
        result.dryRun++;
        continue;
      }

      let delivery: DeliveryResult;
      if (entry.eventType === 'storage.accepted') {
        // Update the already-delivered Lead instead of creating a duplicate.
        const siblings = await storage.getCrmOutboxByQuote(entry.quoteId);
        const sentLead = siblings.find(e => e.eventType !== 'storage.accepted' && e.status === 'sent' && e.externalId);
        if (sentLead?.externalId) {
          delivery = await deliverLeadUpdate(sentLead.externalId, entry.payload as SalesforceLeadPayload, creds!);
        } else {
          // Original lead not delivered (yet) — retry later so ordering holds.
          delivery = { success: false, error: 'Original lead not yet delivered; deferring storage.accepted update', retryable: true };
        }
      } else {
        delivery = await deliverLead(entry.payload as SalesforceLeadPayload, creds!);
      }
      const attempts = (entry.attempts || 0) + 1;

      if (delivery.success) {
        await storage.updateCrmOutboxEntry(entry.id, {
          status: 'sent',
          attempts,
          externalId: delivery.externalId,
          sentAt: new Date(),
          lastError: null,
        });
        result.sent++;
        console.log(`[Salesforce] Sent lead for quote ${entry.quoteId} -> Salesforce ID ${delivery.externalId}`);
      } else if (delivery.retryable && attempts < MAX_ATTEMPTS) {
        await storage.updateCrmOutboxEntry(entry.id, {
          status: 'pending',
          attempts,
          lastError: delivery.error || 'Unknown error',
          nextAttemptAt: new Date(Date.now() + backoffDelayMs(attempts)),
        });
        console.warn(`[Salesforce] Delivery failed for outbox ${entry.id} (attempt ${attempts}/${MAX_ATTEMPTS}): ${delivery.error}`);
      } else {
        await storage.updateCrmOutboxEntry(entry.id, {
          status: 'failed',
          attempts,
          lastError: delivery.error || 'Unknown error',
          nextAttemptAt: null,
        });
        result.failed++;
        console.error(`[Salesforce] Delivery permanently failed for outbox ${entry.id}: ${delivery.error}`);
      }
    }
  } catch (error) {
    console.error('[Salesforce] Outbox worker error:', error instanceof Error ? error.message : error);
  } finally {
    workerRunning = false;
  }

  return result;
}

/**
 * Reset a failed/stuck entry so the worker retries it (admin action).
 */
export async function retryCrmOutboxEntry(id: string): Promise<CrmOutbox | { alreadySent: true } | undefined> {
  const entry = await storage.getCrmOutboxEntry(id);
  if (!entry) return undefined;

  // Never re-send an already delivered lead (would duplicate the Salesforce record)
  if (entry.status === 'sent') {
    return { alreadySent: true };
  }

  const updated = await storage.updateCrmOutboxEntry(id, {
    status: 'pending',
    attempts: 0,
    lastError: null,
    nextAttemptAt: new Date(),
  });

  processCrmOutbox().catch(err =>
    console.error('[Salesforce] Outbox kick failed:', err instanceof Error ? err.message : err)
  );

  return updated;
}

let workerInterval: NodeJS.Timeout | null = null;

/**
 * Start the periodic outbox worker (call once at server startup).
 */
export function startCrmOutboxWorker(intervalMs: number = 60_000): void {
  if (workerInterval) return;
  workerInterval = setInterval(() => {
    processCrmOutbox().catch(err =>
      console.error('[Salesforce] Scheduled outbox run failed:', err instanceof Error ? err.message : err)
    );
  }, intervalMs);
  // Run once shortly after startup to drain any backlog
  setTimeout(() => {
    processCrmOutbox().catch(err =>
      console.error('[Salesforce] Startup outbox run failed:', err instanceof Error ? err.message : err)
    );
  }, 10_000);
  console.log('[Salesforce] CRM outbox worker started');
}
