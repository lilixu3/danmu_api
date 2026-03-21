import test from "node:test";
import assert from "node:assert/strict";
import { mainJsContent } from "./ui/js/main.js";
import { logviewJsContent } from "./ui/js/logview.js";
import { systemSettingsJsContent } from "./ui/js/systemsettings.js";

test("protected UI should not eagerly fetch logs without auth guard", () => {
  assert.match(mainJsContent, /function hasProtectedUiAccessToken\(\)/);
  assert.match(mainJsContent, /if \(hasProtectedUiAccessToken\(\)\) \{\n\s*fetchRealLogs\(\);/);
  assert.match(
    logviewJsContent,
    /if \(typeof hasProtectedUiAccessToken === 'function' && !hasProtectedUiAccessToken\(\)\) \{\n\s*return;/
  );
});

test("deployment health check should use config endpoint instead of logs endpoint", () => {
  assert.ok(systemSettingsJsContent.includes("fetch(buildApiUrl('/api/config', true))"));
  assert.ok(!systemSettingsJsContent.includes("fetch(buildApiUrl('/api/logs'))"));
});
