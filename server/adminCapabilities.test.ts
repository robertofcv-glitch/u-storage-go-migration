import test from "node:test";
import assert from "node:assert/strict";
import { ADMIN_CAPABILITY_MATRIX, capabilityForRoute } from "@shared/adminCapabilities";

test("admin capability matrix covers canonical organization routes", () => {
  assert.equal(capabilityForRoute("/api/admin/organization/companies")?.module, "module:companies");
  assert.equal(capabilityForRoute("/api/admin/organization/users")?.module, "module:users");
  assert.equal(capabilityForRoute("/api/admin/organization/reconciliation")?.module, "module:companies");
  const companies = capabilityForRoute("/api/admin/companies/abc");
  assert.equal(companies?.module, "module:companies");
  assert.ok(companies?.actions.includes("lifecycle"));
  assert.ok(companies?.destructiveActions.includes("company.delete"));
  assert.equal(capabilityForRoute("/api/admin/movers/abc")?.legacy, true);
  assert.equal(capabilityForRoute("/api/admin/companies/users/abc")?.module, "module:users");
});

test("capability entries declare an audit contract", () => {
  assert.ok(ADMIN_CAPABILITY_MATRIX.length >= 5);
  for (const entry of ADMIN_CAPABILITY_MATRIX) {
    assert.ok(entry.route.startsWith("/api/admin/"));
    assert.ok(entry.module.startsWith("module:"));
    assert.ok(entry.auditEvents.length > 0);
  }
});