import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUStorageReservationProvider } from "./ustorageReservationProvider";

const payload = (overrides: Record<string, unknown> = {}) => ({
  status: "confirmed", audience: "rentar-konect", issuedAt: "2025-01-01T00:00:00Z",
  expiresAt: "2025-01-02T00:00:00Z", nonce: "n", redemptionRef: "r", reservationRef: "safe",
  rentalStart: "2025-01-10T00:00:00Z", consent: { version: "v1", acceptedAt: "2025-01-01T00:00:00Z" },
  branch: { externalId: "b1", googlePlaceId: "g1" }, ...overrides,
});
const fetcher = (body: unknown) => async () => new Response(JSON.stringify(body), { status: 200 });

describe("U-Storage reservation provider", () => {
  it("normalizes a confirmed response", async () => {
    const result = await createUStorageReservationProvider({ credential: "secret", endpoint: "https://provider", fetcher: fetcher(payload()), now: () => new Date("2025-01-01T12:00:00Z") }).redeem("opaque", { externalId: "b1" });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.confirmation.reservationRef, "safe");
  });
  it("fails safely for expiry, audience, branch and unavailable", async () => {
    const now = () => new Date("2025-01-01T12:00:00Z");
    const expired = await createUStorageReservationProvider({ credential: "x", endpoint: "x", fetcher: fetcher(payload({ expiresAt: "2024-01-01T00:00:00Z" })), now }).redeem("x");
    assert.equal(expired.ok, false);
    if (!expired.ok) assert.equal(expired.reason, "expired");
    const audience = await createUStorageReservationProvider({ credential: "x", endpoint: "x", fetcher: fetcher(payload({ audience: "other" })), now }).redeem("x");
    assert.equal(audience.ok, false);
    const mismatch = await createUStorageReservationProvider({ credential: "x", endpoint: "x", fetcher: fetcher(payload()), now }).redeem("x", { externalId: "other" });
    assert.equal(mismatch.ok, false);
    if (!mismatch.ok) assert.equal(mismatch.reason, "wrong_branch");
    const unavailable = await createUStorageReservationProvider({}).redeem("x");
    assert.equal(unavailable.ok, false);
    if (!unavailable.ok) assert.equal(unavailable.reason, "unavailable");
  });
});