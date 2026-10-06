# Ruku Move - Moving Services Marketplace

## Overview

Ruku Move is a full-stack web application designed to connect customers with professional moving and storage companies. It features a multi-user system for clients, movers, and administrators, and includes "Rukuberto," an AI-powered inventory assistant for move estimations. The platform aims to streamline the moving process by offering quote requests, bid management, and comprehensive administrative tools.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework:** React 18 with TypeScript, Vite for build.
- **Routing:** Wouter.
- **State Management:** TanStack Query for server state, React hooks for UI state, React Hook Form + Zod for forms.
- **UI/Styling:** Tailwind CSS v4, Shadcn/ui (New York style), Radix UI, Framer Motion. Custom brand colors: Deep Ocean, Slate Mist, Frost Blue, Horizon Teal.
- **Admin settings layout:** Use tabs when a dense settings page has distinct topics that may grow. Within a topic, use cards only for meaningful groups of related controls, and use progressive disclosure for advanced options.
- **Internationalization:** i18next (English/Spanish).
- **Timezone Handling:** Centralized timezone utilities (`shared/timezone.ts`) with `useTimezone` hook. Default timezone: `America/Mexico_City`. Dates stored in UTC, converted to local timezone for display. Uses `date-fns-tz` with dynamic offset calculation via `Intl.DateTimeFormat` (DST-aware). Schema supports per-user and per-city timezone overrides (nullable, falls back to platform default). User timezone auto-detected from browser on login (24h throttle) via `useTimezoneDetection` hook. Admins can switch between active city timezones via Settings page. Active timezone list derived from cities table (isActive=true). User fields: `timezone`, `timezoneSource` (detected|manual|admin_override), `timezoneDetectedAt`.

### Backend
- **Runtime & Framework:** Node.js with Express.js for REST API, TypeScript, ESM modules.
- **Authentication:** Dual system: Replit OAuth (OpenID Connect) and email/password (bcrypt). Express sessions stored in PostgreSQL. Role-based access control (client, mover, admin). Security features include session regeneration on login, centralized middleware (`authMiddleware.ts`) with `requireAuth`, `requireRole`, `requireMover`, `requireClient`, `requireAdmin`, and `verifyResourceOwnership` helpers. Frontend route protection via `ProtectedRoute` component. Impersonation endpoints restricted to admin users only.
- **API Design:** RESTful endpoints, Zod for schema validation, middleware for authentication.
- **Database Layer:** Drizzle ORM for type-safe operations, Neon serverless PostgreSQL driver.
- **Core Features:**
    - **Admin Database Management:** CRUD operations on platform tables via `/admin/dashboard/database` with role-based security.
    - **Email Integration:** Gmail service via Replit connector for various notifications (password reset, admin approvals), email campaigns, and event-based triggers. Supports multiple senders and bilingual templates.
    - **Admin Quote Details:** Comprehensive view of quotes including client info, inventory, pricing, partner bids, and status history at `/admin/dashboard/quotes/:quoteId`. Includes client reassignment and PDF management.
    - **Admin Access Request System:** Workflow for requesting and managing admin access via `/admin` with approval/denial emails.
    - **Truck-Based Pricing System:** Dual estimation methodology using both weight AND volume calculations. Trucks include capacityKg, capacityM3, and usableVolumeFactor (0.85 default for packing efficiency). Inventory categories include avgWeightKg and avgVolumeM3. Response includes constrainingFactor ('weight' or 'volume') for transparency. Admin interface for managing truck capacities, pricing, and regional overrides.
      - **Optimal Truck Selection Algorithm:** Priority order: (1) Fewest trucks, (2) Smallest sizes that fit, (3) Lowest cost. Algorithm generates candidate fleets using two strategies: greedy (largest trucks first + smallest remainder) and uniform (same truck type). For each fleet, validates both weight AND volume constraints are satisfied. Selects fleet with minimum truck count, then minimum total capacity, then minimum cost. Example: 50m³ load → 1× 10-ton (40.8m³) + 1× 1.5-ton (9.9m³) = 2 trucks.
      - **Truck Breakdown Display:** Response includes `truckBreakdown` array with each truck type and count. Frontend displays separate tags for each truck type (e.g., "🚛 1× 10 Toneladas" + "🚛 1× 1.5 Toneladas") for clear visibility.
    - **Partner Landing Pages:** Custom branded landing pages (e.g., `/u-storage`) that integrate with the core quote functionality while maintaining partner-specific branding.
    - **Quote PDF Generation:** Server-side PDF generation using PDFKit, storing documents in the database, and providing download/preview/email functionalities.
    - **Lead Attribution Tracking:** Marketing attribution system that captures and persists UTM parameters, partner sources, landing pages, and referrer URLs. Stored in localStorage with 30-day TTL and saved to quotes table for analytics. Supports tracking leads from digital campaigns, partner landing pages, and organic traffic.
    - **SEO & Digital Marketing:** Dynamic meta tags (OG, Twitter Cards) via SEO component, canonical URLs, hreflang alternates (es/en), noindex on dashboard routes, sitemap.xml with language alternates, structured data (Organization, WebSite, Article, FAQ schemas), robots.txt allowing AI crawlers, llms.txt/llms-full.txt for AI assistants. Admin portal at `/admin/dashboard/seo-marketing` with Configuration (meta tags, social media, AI discoverability, analytics tracking, structured data, robots.txt) and Analytics (page views, traffic sources, UTM campaigns, partner performance, AI referrals) tabs.
    - **Page View Tracking:** Client-side telemetry via `usePageTracking` hook captures page visits with UTM attribution, referrer URLs, and session IDs. Stored in `marketing_page_views` table for analytics dashboard.
    - **Partner Status Lifecycle:** Complete partner status management system mirroring the quote workflow pattern. Status states: pending → documents_review → approved → active (can bid) | suspended | inactive. Includes admin UI with status dropdown, notes, and timeline history at `/admin/dashboard/movers/:moverId`. Only partners with 'active' status can be invited to bid on quotes. Status changes are tracked in `partner_status_history` table with actor information.
    - **Partner Document Management:** Allows partners to upload required documents (Tax ID/Constancia de Situación Fiscal, Insurance/Seguro) via `/mover/documents`. Admin can review and approve/reject documents with notes at `/admin/dashboard/movers/:moverId`. Document status flow: pending → submitted → approved/rejected. Documents stored as base64 in database. Document types are admin-configurable with Spanish/English names. Verification progress shown via progress bar in partner dashboard.
    - **Blog Management System:** SEO-optimized bilingual blog with admin CRUD interface at `/admin/dashboard/blog`. Features include: status workflow (draft/published/scheduled/archived), featured posts, bilingual content (ES/EN for all fields), comprehensive SEO meta fields (meta title, description, focus keywords, canonical URL), Open Graph social tags, view count tracking, estimated read time, and activity logging. Public blog at `/blog` with individual articles at `/blog/:slug`. Initial content seeded from static data.
    - **Salesforce Lead Mirroring (U-Storage):** Leads with `partner='u-storage'` are durably captured in a `crm_outbox` table and mirrored to Salesforce as Lead records via a background worker (60s interval, exponential backoff retry, max 8 attempts). Runs in dry-run mode when credentials are absent (payloads recorded, auto-delivered once credentials arrive — no rework). Credentials: Replit Salesforce connector (preferred) or env secrets (SALESFORCE_INSTANCE_URL/CLIENT_ID/CLIENT_SECRET, OAuth2 client credentials). Service in `server/services/salesforceService.ts`. Admin visibility: "CRM Sync" card on quote details + endpoints under `/api/admin/crm/`. Docs: `docs/salesforce-ustorage-integration.md`.
    - **WhatsApp Sales & Support Inbox:** Admin shared inbox at `/admin/dashboard/whatsapp-inbox` for managing WhatsApp conversations. Features: conversation list with filters (all/mine/unassigned/open/resolved), chat-style message thread, agent assignment, conversation status management (open/pending/resolved/closed), entity linking (users/partners/quotes), unread count badge on sidebar, and manual conversation creation. Data stored in `whatsapp_conversations` and `whatsapp_messages` tables. API endpoints under `/api/admin/whatsapp/`. Polling-based refresh (15s conversations, 10s messages, 30s unread badge). Bilingual UI (EN/ES).
    - **AI Prompt Configuration:** All AI prompts stored in `aiAgentConfig` table and editable via admin panel at `/admin/dashboard/rukuberto-ai`. Includes:
      - `imageAnalysisPrompt` / `imageAnalysisPromptEs`: For vision analysis of photos/video frames
      - `documentParsePrompt` / `documentParsePromptEs`: For parsing documents and audio transcriptions
      - Placeholder system: `{{CATEGORIES}}`, `{{ROOMS}}`, `{{CATALOG}}`, `{{CONTENT}}` get replaced at runtime with actual data
      - Admin "Sembrar Configuración" button updates prompts from `DEFAULT_AI_AGENT_CONFIG` in `server/seed.ts`
      - Multimodal File Processing: Chat and vision use Claude Sonnet 4.6 with GPT-5 fallback through Replit-managed AI integrations; audio uses the separate `gpt-4o-transcribe` speech-to-text model through Replit-managed OpenAI; video extracts frames with ffmpeg. Do not request or use personal Anthropic/OpenAI API keys for these features.
      - **Bilingual Consistency Management:** All 7 prompt pairs (greeting, systemPrompt, mission, guardrails, inventoryRules, imageAnalysisPrompt, documentParsePrompt) have side-by-side EN/ES editing with consistency tracking. `promptConsistency` JSONB field tracks sync status. On field blur, prompts user to auto-translate via the configured AI provider with placeholder preservation. Amber badges appear when translations are out of sync, with click-to-fix dialog for choosing base language. Translation endpoint: `POST /api/admin/ai-agent/translate`.

### Database Schema Design
- **Key Tables:** `users`, `user_roles`, `mover_profiles`, `quotes`, `quote_invitations`, `quote_bids`, `quote_status_history`, `partner_status_history`, `inventory_items`, `inventory_categories`, `inventory_rooms`, `inventory_catalog_items`, `inventory_category_keywords`, `inventory_room_keywords`, `services`, `add_ons`, `saved_addresses`, `sessions`, `ai_agent_config`, `website_config`, `activity_logs`, `admin_access_requests`, `truck_types`, `quote_documents`, `email_config`, `email_logs`, `email_senders`, `email_campaigns`, `email_templates`, `email_triggers`, `seo_settings`, `marketing_page_views`, `document_types`, `partner_documents`, `blog_posts`, `whatsapp_config`, `conversations`, `messages`, `conversation_assignments`, `whatsapp_conversations`, `whatsapp_messages`.
- **Inventory System:** 20 inventory categories (sofas, beds, tables, chairs, storage, electronics, appliances, boxes, fragile, outdoor, exercise, kids, other, tv_grande, tv_pequeña) with weight AND volume specifications (avgWeightKg, avgVolumeM3) for dual-methodology truck estimation. Categories are seeded from `server/seed.ts` and updated on app restart.
- **Configurable Keyword Matching:** CSV/Excel parsing uses database-stored keywords (tables `inventory_category_keywords` and `inventory_room_keywords`) instead of hardcoded values. Admins can add/remove keywords via "Keywords" tab in Admin > Inventory Management. ~190 default category keywords and ~60 room keywords seeded for Spanish/English. Keywords have language and priority fields for future optimization. Parsing fetches keywords at runtime and builds matching maps dynamically.
- **Attribution Fields on Quotes:** `partner`, `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`, `landingPage`, `referrerUrl` - indexed for efficient campaign analytics.
- **Relationships:** Extensive relational model supporting multi-user roles, quote lifecycle, and detailed tracking.
- **Schema Management:** Drizzle Kit for migrations.

## External Dependencies

- **Database:** Neon PostgreSQL (via `@neondatabase/serverless`).
- **Authentication:** Replit OAuth/OIDC (via `openid-client`, `passport`).
- **Development Tools (Replit-specific):**
    - `@replit/vite-plugin-runtime-error-modal`
    - `@replit/vite-plugin-cartographer`
    - `@replit/vite-plugin-dev-banner`
- **Email Service:** Gmail (via Replit connector).
- **WhatsApp Integration:** Twilio WhatsApp Business API (`twilio` npm package). Admin-configurable credentials stored in `whatsapp_config` table. Webhook endpoints at `/api/webhooks/whatsapp/inbound` and `/api/webhooks/whatsapp/status`. Service layer in `server/services/whatsappService.ts`. Conversations auto-created on new inbound messages with phone-to-user matching.
- **PDF Generation:** PDFKit library.
- **Key Packages:** `drizzle-orm`, `drizzle-kit`, `zod`, `zod-validation-error`, `bcryptjs`, `nanoid`, `date-fns`, `ws`, `twilio`.