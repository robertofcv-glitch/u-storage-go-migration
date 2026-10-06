import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionQuoteStage,
  canTransitionServiceStage,
  normalizeQuoteStage,
  normalizeServiceStage,
  isQuoteStage,
  QUOTE_STAGE,
  QUOTE_STAGE_TRANSITIONS,
  SERVICE_STAGE_V2,
} from "./workflowStages";

test("normalizes legacy quote stages into the commercial lifecycle", () => {
  assert.equal(normalizeQuoteStage("intake"), QUOTE_STAGE.DRAFT);
  assert.equal(normalizeQuoteStage("price_awaiting_client"), QUOTE_STAGE.AWAITING_DECISION);
  assert.equal(normalizeQuoteStage("completed"), QUOTE_STAGE.CLOSED_WON);
  assert.equal(normalizeQuoteStage("bidding_open"), QUOTE_STAGE.SENT);
});

test("normalizes legacy service stages into the operational lifecycle", () => {
  assert.equal(normalizeServiceStage("pre_service"), SERVICE_STAGE_V2.SCHEDULED);
  assert.equal(normalizeServiceStage("ready"), SERVICE_STAGE_V2.TEAM_ASSIGNED);
  assert.equal(normalizeServiceStage("post_service"), SERVICE_STAGE_V2.FINISHED);
  assert.equal(normalizeServiceStage("exception"), SERVICE_STAGE_V2.ON_HOLD);
});

test("enforces separate quote and service transition graphs", () => {
  assert.equal(canTransitionQuoteStage("draft", "under_review"), true);
  assert.equal(canTransitionQuoteStage("accepted_pending_booking_payment", "closed_won"), true);
  assert.equal(canTransitionQuoteStage("closed_won", "in_progress"), false);
  assert.equal(canTransitionServiceStage("confirmed", "scheduled"), true);
  assert.equal(canTransitionServiceStage("team_assigned", "en_route"), true);
  assert.equal(canTransitionServiceStage("confirmed", "in_progress"), false);
  assert.equal(canTransitionServiceStage("finished", "confirmed"), false);
});

test("every canonical quote transition is explicit and terminal stages are locked", () => {
  for (const [from, targets] of Object.entries(QUOTE_STAGE_TRANSITIONS)) {
    for (const target of Object.values(QUOTE_STAGE)) {
      assert.equal(
        canTransitionQuoteStage(from, target),
        targets.includes(target),
        `${from} -> ${target}`,
      );
    }
  }
  for (const terminal of [QUOTE_STAGE.CLOSED_WON, QUOTE_STAGE.CLOSED_LOST, QUOTE_STAGE.CANCELLED, QUOTE_STAGE.EXPIRED]) {
    assert.deepEqual(QUOTE_STAGE_TRANSITIONS[terminal], []);
  }
});

test("distinguishes canonical values from legacy values before persistence", () => {
  assert.equal(isQuoteStage(QUOTE_STAGE.AWAITING_DECISION), true);
  assert.equal(isQuoteStage("price_awaiting_client"), false);
  assert.equal(isQuoteStage("in_progress"), false);
});