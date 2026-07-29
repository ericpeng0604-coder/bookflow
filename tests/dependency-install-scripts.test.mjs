import assert from "node:assert/strict";
import test from "node:test";
import { validateLock } from "../scripts/check-dependency-install-scripts.mjs";

test("dependency install-script guard accepts the audited lockfile shape", () => {
  assert.doesNotThrow(() =>
    validateLock({
      lockfileVersion: 3,
      packages: {
        "": {},
        "node_modules/sharp": {
          version: "0.35.3",
          resolved: "https://registry.npmjs.org/sharp/-/sharp-0.35.3.tgz",
          integrity: "sha512-test",
          hasInstallScript: true,
        },
      },
    }),
  );
});

test("dependency install-script guard blocks a newly introduced lifecycle package", () => {
  assert.throws(
    () =>
      validateLock({
        lockfileVersion: 3,
        packages: {
          "": {},
          "node_modules/compromised-package": {
            version: "1.0.0",
            resolved: "https://registry.npmjs.org/compromised-package/-/compromised-package-1.0.0.tgz",
            integrity: "sha512-test",
            hasInstallScript: true,
          },
        },
      }),
    /unexpected lifecycle-script package: compromised-package/,
  );
});
