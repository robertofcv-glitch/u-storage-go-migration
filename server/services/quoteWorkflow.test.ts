import assert from "node:assert/strict";
import test from "node:test";
import { assertQuoteTransition, canTransitionQuote } from "./quoteWorkflow";

test("quote workflow keeps execution stages out of commercial transitions", () => {
  assert.equal(canTransitionQuote("draft", "under_review"), true);
  assert.equal(canTransitionQuote("accepted_pending_booking_payment", "closed_won"), true);
  assert.equal(canTransitionQuote("closed_won", "in_progress"), false);
  assert.throws(() => assertQuoteTransition("closed_won", "in_progress"), /Cannot transition quote/);
});