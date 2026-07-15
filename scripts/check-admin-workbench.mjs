import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const app = fs.readFileSync(path.join(root, "components", "marketplace-app.tsx"), "utf8");
const navigation = fs.readFileSync(path.join(root, "components", "marketplace", "navigation-state.ts"), "utf8");
const css = fs.readFileSync(path.join(root, "app", "globals.css"), "utf8");

const checks = [
  ["admin workspace route type", navigation.includes('AdminWorkspace = "overview"')],
  ["admin workspace URL state", navigation.includes('params.set("adminTab", adminWorkspace)')],
  ["admin sidebar navigation", app.includes('className="admin-sidebar"') && app.includes("adminWorkspaceItems.map")],
  ["admin overview", app.includes('className="admin-overview"') && app.includes("NEXT BEST ACTION")],
  ["listing review table", app.includes('className="admin-listing-table"') && app.includes("查看詳情")],
  ["listing detail drawer", app.includes('dialogClassName="admin-detail-drawer"') && app.includes("selectedAdminBook")],
  ["workspace responsive styles", css.includes(".admin-workbench") && css.includes("max-width: 860px")],
  ["no orange market underline", css.includes('.site-header .market-switch button.active::after { content: none; }')],
];

for (const [label, passed] of checks) {
  if (!passed) throw new Error(`FAIL: ${label}`);
  console.log(`PASS: ${label}`);
}

console.log(`Admin workbench checks passed (${checks.length}/${checks.length}).`);
