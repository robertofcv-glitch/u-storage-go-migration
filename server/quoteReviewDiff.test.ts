import assert from "node:assert/strict";
import test from "node:test";
import { associationDiff, quoteReviewValuesMatch } from "./quoteReviewDiff";

test("matches unchanged dates by timestamp rather than object identity", () => {
  assert.equal(
    quoteReviewValuesMatch(new Date("2026-09-27T00:00:00.000Z"), new Date("2026-09-27T00:00:00.000Z")),
    true,
  );
});

test("treats nullable empty review values consistently", () => {
  assert.equal(quoteReviewValuesMatch(null, null), true);
  assert.equal(quoteReviewValuesMatch(null, ""), false);
});

test("preserves unchanged service assignments and only diffs real changes", () => {
  assert.deepEqual(associationDiff(["service-a", "service-b"], ["service-b", "service-a"]), {
    requested: ["service-b", "service-a"],
    addedIds: [],
    removedIds: [],
  });
  assert.deepEqual(associationDiff(["service-a"], ["service-a", "service-b", "service-b"]), {
    requested: ["service-a", "service-b"],
    addedIds: ["service-b"],
    removedIds: [],
  });
});