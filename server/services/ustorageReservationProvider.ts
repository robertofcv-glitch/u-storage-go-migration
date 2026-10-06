import crypto from "crypto";

export type ReservationConfirmation = {
  status: "confirmed";
  audience: string;
  issuedAt: Date;
  expiresAt: Date;
  nonce: string;
  redemptionRef: string;
  reservationRef: string;
  rentalStart: Date;
  consent: { version: string; acceptedAt: Date };
  branchExternalId: string | null;
  branchGooglePlaceId: string | null;
  branchName: string | null;
  branchAddress: string | null;
  branchInternalId: string | null;
  customer: { name: string | null; email: string | null; phone: string | null };
  unit: { code: string | null; size: number | null; height: number | null; capacity: number | null; dimensions: string | null; floor: string | null; sizeLabel: string | null };
  locale: string | null;
};

export type ReservationProviderResult =
  | { ok: true; confirmation: ReservationConfirmation }
  | { ok: false; reason: "unavailable" | "invalid" | "expired" | "wrong_branch" };

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;
const text = (v: unknown, max = 200) => typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null;
const date = (v: unknown) => { const d = new Date(String(v ?? "")); return Number.isNaN(d.getTime()) ? null : d; };

/** The only boundary allowed to see the opaque reservation code. */
export function createUStorageReservationProvider(options: {
  endpoint?: string;
  credential?: string;
  audience?: string;
  fetcher?: Fetcher;
  now?: () => Date;
} = {}) {
  const endpoint = options.endpoint ?? process.env.U_STORAGE_RESERVATION_REDEEM_URL;
  const credential = options.credential ?? process.env.U_STORAGE_RESERVATION_CREDENTIAL;
  const audience = options.audience ?? process.env.U_STORAGE_RESERVATION_AUDIENCE ?? "rentar-konect";
  const fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  return {
    async redeem(code: string, expectedBranch?: { externalId?: string | null; googlePlaceId?: string | null }): Promise<ReservationProviderResult> {
      if (!endpoint || !credential || !code || code.length > 1000) return { ok: false, reason: "unavailable" };
      try {
        const response = await fetcher(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${credential}` },
          body: JSON.stringify({ code }),
        });
        if (!response.ok) return { ok: false, reason: response.status >= 500 ? "unavailable" : "invalid" };
        const root = await response.json().catch(() => null) as Record<string, unknown> | null;
        if (!root || text(root.status, 30)?.toLowerCase() !== "confirmed") return { ok: false, reason: "invalid" };
        const consent = root.consent && typeof root.consent === "object" ? root.consent as Record<string, unknown> : null;
        const issuedAt = date(root.issuedAt ?? root.issued_at);
        const expiresAt = date(root.expiresAt ?? root.expires_at);
        const acceptedAt = date(consent?.acceptedAt ?? consent?.accepted_at);
        const nonce = text(root.nonce, 200);
        const redemptionRef = text(root.redemptionRef ?? root.redemption_ref, 200);
        const reservationRef = text(root.reservationRef ?? root.reservation_ref ?? root.id, 200);
        const rentalStart = date(root.rentalStart ?? root.rental_start);
        const consentVersion = text(consent?.version, 80);
        const responseAudience = text(root.audience, 120);
        const branch = root.branch && typeof root.branch === "object" ? root.branch as Record<string, unknown> : root;
        const externalId = text(branch.externalId ?? branch.external_id, 100);
        const googlePlaceId = text(branch.googlePlaceId ?? branch.google_place_id ?? branch.placeId, 200);
        const customerRoot = root.customer && typeof root.customer === "object" ? root.customer as Record<string, unknown> : root;
        const unitRoot = root.unit && typeof root.unit === "object" ? root.unit as Record<string, unknown> : root;
        const numeric = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
        const now = (options.now ?? (() => new Date()))();
        const isExpired = !!expiresAt && expiresAt <= now;
        if (!issuedAt || !expiresAt || !acceptedAt || !nonce || !redemptionRef || !reservationRef || !rentalStart ||
            !consentVersion || !responseAudience || responseAudience !== audience || isExpired || issuedAt > now ||
            acceptedAt > now || !externalId && !googlePlaceId) return { ok: false, reason: isExpired ? "expired" : "invalid" };
        if (!expiresAt) return { ok: false, reason: "invalid" };
        if (expectedBranch && !(
          (expectedBranch.externalId && externalId === expectedBranch.externalId) ||
          (expectedBranch.googlePlaceId && googlePlaceId === expectedBranch.googlePlaceId)
        )) return { ok: false, reason: "wrong_branch" };
        return { ok: true, confirmation: { status: "confirmed", audience: responseAudience, issuedAt, expiresAt, nonce, redemptionRef, reservationRef, rentalStart, consent: { version: consentVersion, acceptedAt }, branchExternalId: externalId, branchGooglePlaceId: googlePlaceId,
          branchName: text(branch.name, 200), branchAddress: text(branch.address, 400), branchInternalId: text(branch.internalId ?? branch.id, 100),
          customer: { name: text(customerRoot.name ?? customerRoot.fullName, 200), email: text(customerRoot.email, 240), phone: text(customerRoot.phone ?? customerRoot.phoneNumber, 80) },
          unit: { code: text(unitRoot.code ?? unitRoot.unitCode, 100), size: numeric(unitRoot.size ?? unitRoot.sizeM2 ?? unitRoot.usableSizeM2), height: numeric(unitRoot.height ?? unitRoot.heightM), capacity: numeric(unitRoot.capacity ?? unitRoot.capacityM3), dimensions: text(unitRoot.dimensions, 200), floor: text(unitRoot.floor, 80), sizeLabel: text(unitRoot.sizeLabel ?? unitRoot.label, 120) },
          locale: text(root.locale, 20) } };
      } catch {
        return { ok: false, reason: "unavailable" };
      }
    },
  };
}

export function hashReservationReference(reference: string): string {
  return crypto.createHash("sha256").update(reference).digest("hex");
}