import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionService } from "./serviceOperations";

test("service lifecycle protects execution order and terminal stages", () => {
  assert.equal(canTransitionService("confirmed", "scheduled"), true);
  assert.equal(canTransitionService("scheduled", "team_assigned"), true);
  assert.equal(canTransitionService("team_assigned", "en_route"), true);
  assert.equal(canTransitionService("en_route", "in_progress"), true);
  assert.equal(canTransitionService("in_progress", "finished"), true);
  assert.equal(canTransitionService("confirmed", "on_hold"), true);
  assert.equal(canTransitionService("on_hold", "confirmed"), true);
  assert.equal(canTransitionService("confirmed", "team_assigned"), false);
  assert.equal(canTransitionService("finished", "confirmed"), false);
});