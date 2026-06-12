import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const noNetwork = process.argv.includes("--no-network");
const timeoutMs = 8_000;
const results = [];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const values = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }
    values[match[1]] = value;
  }
  return values;
}

const fileEnv = {
  ...parseEnvFile(path.join(root, ".env")),
  ...parseEnvFile(path.join(root, ".env.local")),
};
const env = { ...fileEnv, ...process.env };

function add(status, area, message, fix = "") {
  results.push({ status, area, message, fix });
}

function required(name, area) {
  const value = env[name]?.trim();
  if (!value) {
    add("FAIL", area, `${name} 未設定。`, `請在 .env.local 加上 ${name}=...`);
    return "";
  }
  add("PASS", area, `${name} 已設定。`);
  return value;
}

function optionalWhenDisabled(name, area) {
  const value = env[name]?.trim();
  if (value) {
    add("PASS", area, `${name} 已設定。`);
  } else {
    add("WARN", area, `${name} 未設定；目前通知信停用時不影響網站。`, "啟用通知信前必須補上。");
  }
  return value || "";
}

function parseUrl(value) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function sourceContains(file, needles, area, label) {
  const filePath = path.join(root, file);
  if (!fs.existsSync(filePath)) {
    add("FAIL", area, `缺少 ${file}。`, `還原或建立 ${label} 所需檔案。`);
    return;
  }
  const source = fs.readFileSync(filePath, "utf8");
  const missing = needles.filter((needle) => !source.includes(needle));
  if (missing.length) {
    add("FAIL", area, `${file} 缺少必要內容：${missing.join(", ")}。`, `確認 ${label} migration/程式碼版本。`);
  } else {
    add("PASS", area, `${label} 的專案檔案已具備。`);
  }
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function checkSupabaseRemote(supabaseUrl, anonKey, serviceRoleKey) {
  if (noNetwork || !supabaseUrl || !anonKey || !parseUrl(supabaseUrl)) return;

  const base = supabaseUrl.replace(/\/+$/, "");
  const anonHeaders = {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  };

  try {
    const settings = await fetchWithTimeout(`${base}/auth/v1/settings`, {
      headers: { apikey: anonKey },
    });
    if (!settings.ok) {
      add("FAIL", "Supabase 連線", `Auth settings 回應 HTTP ${settings.status}。`, "確認 Supabase URL、anon key 與專案狀態。");
    } else {
      const data = await settings.json().catch(() => ({}));
      add("PASS", "Supabase 連線", "Auth API 可連線，anon key 可用。");
      if (data?.external?.email === false) {
        add("FAIL", "Auth Email", "Supabase Email provider 顯示為停用。", "到 Authentication > Providers > Email 啟用 Email provider。");
      } else if (data?.external?.email === true) {
        add("PASS", "Auth Email", "Supabase Email provider 已啟用。");
      } else {
        add("MANUAL", "Auth Email", "API 未回傳可判讀的 Email provider 狀態。", "到 Authentication > Providers > Email 確認已啟用。");
      }
    }
  } catch (error) {
    add("FAIL", "Supabase 連線", `無法連線 Auth API：${error instanceof Error ? error.message : String(error)}`, "確認網路、Supabase URL 與專案是否暫停。");
  }

  const probes = [
    {
      area: "管理員 OTP",
      label: "is_verified_admin() RPC",
      url: `${base}/rest/v1/rpc/is_verified_admin`,
      options: { method: "POST", headers: { ...anonHeaders, "Content-Type": "application/json" }, body: "{}" },
      missingCodes: ["PGRST202"],
    },
    {
      area: "通知 Email",
      label: "notifications table",
      url: `${base}/rest/v1/notifications?select=id&limit=0`,
      options: { headers: anonHeaders },
      missingCodes: ["PGRST205"],
    },
  ];

  if (serviceRoleKey) {
    probes.push({
      area: "管理員 OTP",
      label: "admin_login_verifications table",
      url: `${base}/rest/v1/admin_login_verifications?select=session_id&limit=0`,
      options: { headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` } },
      missingCodes: ["PGRST205"],
    });
  }

  for (const probe of probes) {
    try {
      const response = await fetchWithTimeout(probe.url, probe.options);
      const body = await response.text();
      let code = "";
      try {
        code = JSON.parse(body)?.code || "";
      } catch {
        // A non-JSON success response is still enough for this existence probe.
      }
      if (response.ok) {
        add("PASS", probe.area, `遠端 ${probe.label} 可用。`);
      } else if (probe.missingCodes.includes(code) || response.status === 404) {
        add("FAIL", probe.area, `遠端缺少 ${probe.label}。`, "執行對應的 supabase migration 後再檢查。");
      } else {
        add("FAIL", probe.area, `${probe.label} 探測失敗（HTTP ${response.status}${code ? `, ${code}` : ""}）。`, "確認 migration、API 權限與 key 是否正確。");
      }
    } catch (error) {
      add("FAIL", probe.area, `${probe.label} 無法探測：${error instanceof Error ? error.message : String(error)}`, "確認網路與 Supabase 專案狀態。");
    }
  }
}

function emailAddress(from) {
  const bracketed = from.match(/<([^<>]+)>/);
  const candidate = (bracketed?.[1] || from).trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) ? candidate : "";
}

async function checkResendRemote(apiKey, from) {
  if (noNetwork || !apiKey) return;
  try {
    const response = await fetchWithTimeout("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      add("FAIL", "Resend", `Resend API key 驗證失敗（HTTP ${response.status}）。`, "確認 RESEND_API_KEY 正確且仍有效。");
      return;
    }

    add("PASS", "Resend", "Resend API key 可用。");
    const data = await response.json().catch(() => ({}));
    const address = emailAddress(from);
    const domain = address.split("@")[1]?.toLowerCase();
    if (!domain) return;
    if (domain === "resend.dev") {
      add("WARN", "Resend", "寄件人使用 resend.dev 測試網域，通常只能寄到帳號擁有者。", "正式通知請改用已驗證的自有網域。");
      return;
    }

    const match = Array.isArray(data?.data)
      ? data.data.find((item) => String(item?.name || "").toLowerCase() === domain)
      : null;
    if (!match) {
      add("FAIL", "Resend", `寄件網域 ${domain} 不在這個 Resend 帳號中。`, "先在 Resend Domains 新增並驗證此網域。");
    } else if (match.status !== "verified") {
      add("FAIL", "Resend", `寄件網域 ${domain} 狀態為 ${match.status || "unknown"}。`, "完成 Resend DNS 驗證後再啟用通知信。");
    } else {
      add("PASS", "Resend", `寄件網域 ${domain} 已驗證。`);
    }
  } catch (error) {
    add("FAIL", "Resend", `無法驗證 Resend：${error instanceof Error ? error.message : String(error)}`, "確認網路連線後重試。");
  }
}

console.log("\nBookFlow setup health check");
console.log(`模式：${noNetwork ? "僅本機" : "本機 + 唯讀遠端探測"}\n`);

const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL", "Supabase env");
const anonKey = required("NEXT_PUBLIC_SUPABASE_ANON_KEY", "Supabase env");
const serviceRoleKey = required("SUPABASE_SERVICE_ROLE_KEY", "管理員 OTP");
const cronSecret = required("CRON_SECRET", "刊登生命週期");
if (cronSecret && cronSecret.length < 24) {
  add("WARN", "刊登生命週期", "CRON_SECRET 長度偏短。", "請使用至少 24 個隨機字元。");
}

const parsedSupabaseUrl = parseUrl(supabaseUrl);
if (supabaseUrl && (!parsedSupabaseUrl || parsedSupabaseUrl.protocol !== "https:")) {
  add("FAIL", "Supabase env", "NEXT_PUBLIC_SUPABASE_URL 必須是有效的 https URL。", "使用 Supabase Project Settings > API 顯示的 Project URL。");
}
if (anonKey && serviceRoleKey && anonKey === serviceRoleKey) {
  add("FAIL", "Supabase env", "anon key 與 service role key 不可相同。", "重新複製正確的兩把 key；service role key 不可放到 NEXT_PUBLIC_ 變數。");
}

const enabledRaw = env.EMAIL_NOTIFICATIONS_ENABLED?.trim();
const emailEnabled = enabledRaw === "true";
if (!["true", "false"].includes(enabledRaw)) {
  add("FAIL", "通知 Email", "EMAIL_NOTIFICATIONS_ENABLED 必須明確設為 true 或 false。", "尚未準備寄信時設為 false。");
} else {
  add(emailEnabled ? "PASS" : "INFO", "通知 Email", `通知 Email 目前${emailEnabled ? "已啟用" : "停用"}。`);
}

const resendKey = emailEnabled
  ? required("RESEND_API_KEY", "Resend env")
  : optionalWhenDisabled("RESEND_API_KEY", "Resend env");
const resendFrom = emailEnabled
  ? required("RESEND_FROM_EMAIL", "Resend env")
  : optionalWhenDisabled("RESEND_FROM_EMAIL", "Resend env");
const appUrl = emailEnabled
  ? required("APP_URL", "通知 Email")
  : optionalWhenDisabled("APP_URL", "通知 Email");

if (resendKey && !resendKey.startsWith("re_")) {
  add("WARN", "Resend env", "RESEND_API_KEY 格式不像 Resend API key。", "確認使用的是 Resend 建立的 re_... key。");
}
if (resendFrom && !emailAddress(resendFrom)) {
  add("FAIL", "Resend env", "RESEND_FROM_EMAIL 不是有效的 email 或「名稱 <email>」格式。", "例如：BookFlow <notifications@example.com>");
}
if (resendFrom && /your-domain\.example|你的網域|example\.com/i.test(resendFrom)) {
  add("FAIL", "Resend env", "RESEND_FROM_EMAIL 仍是範例/佔位網域。", "改成 Resend 已驗證網域的寄件地址。");
}

const parsedAppUrl = parseUrl(appUrl);
if (appUrl && (!parsedAppUrl || !["http:", "https:"].includes(parsedAppUrl.protocol))) {
  add("FAIL", "通知 Email", "APP_URL 不是有效的 http/https URL。", "本機可用 http://localhost:3000；正式環境必須使用 https 網址。");
} else if (parsedAppUrl && parsedAppUrl.hostname !== "localhost" && parsedAppUrl.protocol !== "https:") {
  add("FAIL", "通知 Email", "正式 APP_URL 必須使用 https。", "改成已部署網站的 https 網址。");
}

sourceContains(
  "app/api/auth/admin-otp/verify/route.ts",
  ["auth.verifyOtp", "admin_login_verifications", "SUPABASE_SERVICE_ROLE_KEY"],
  "管理員 OTP",
  "管理員 OTP API",
);
sourceContains(
  "supabase/admin-login-verification.sql",
  ["admin_login_verifications", "is_verified_admin"],
  "管理員 OTP",
  "管理員 OTP migration",
);
sourceContains(
  "app/api/notifications/email/route.ts",
  ["deliverNotificationEmails", "SUPABASE_SERVICE_ROLE_KEY"],
  "通知 Email",
  "通知 Email API",
);
sourceContains(
  "lib/server/notification-email.ts",
  ["EMAIL_NOTIFICATIONS_ENABLED", "RESEND_API_KEY", "APP_URL", "email_sent_at", "email_next_attempt_at"],
  "通知 Email",
  "通知 Email 佇列",
);
sourceContains(
  "supabase/transactions-and-notifications.sql",
  ["create table if not exists public.notifications", "email_sent_at"],
  "通知 Email",
  "通知 migration",
);
sourceContains(
  "supabase/email-templates/confirm-signup.html",
  ["{{ .Token }}"],
  "Auth Email",
  "註冊驗證信範本",
);
sourceContains(
  "app/api/cron/listing-lifecycle/route.ts",
  ["CRON_SECRET", "process_listing_lifecycle", "deliverNotificationEmails"],
  "刊登生命週期",
  "每日排程 API",
);
sourceContains(
  "supabase/listing-lifecycle.sql",
  ["lifecycle_state", "record_user_activity", "process_listing_lifecycle", "review_archived_listings"],
  "刊登生命週期",
  "刊登生命週期 migration",
);
sourceContains(
  "supabase/listing-lifecycle-rollback.sql",
  ["reset_confirmation_after_new_listing", "lifecycle_emergency_neutralized"],
  "刊登生命週期",
  "非破壞性回復腳本",
);
sourceContains(
  "vercel.json",
  ["/api/cron/listing-lifecycle", "15 1 * * *"],
  "刊登生命週期",
  "Vercel Cron 設定",
);

const redirectUrls = new Set(["http://localhost:3000"]);
if (parsedAppUrl) redirectUrls.add(parsedAppUrl.origin);
add(
  "MANUAL",
  "Auth redirect",
  `Supabase Dashboard 無法用 anon key 驗證 Redirect URLs。必要值：${[...redirectUrls].join(", ")}。`,
  "到 Authentication > URL Configuration：正式網址設為 Site URL，並把本機與正式網址加入 Redirect URLs。",
);
add(
  "MANUAL",
  "Auth Email",
  "請確認 Email provider、Confirm email，以及 Confirm signup/Magic Link 範本含 {{ .Token }}；Password recovery 範本保留 {{ .ConfirmationURL }}。",
  "到 Authentication > Providers 與 Email Templates 人工確認。",
);

await checkSupabaseRemote(supabaseUrl, anonKey, serviceRoleKey);
if (emailEnabled) await checkResendRemote(resendKey, resendFrom);
if (noNetwork) {
  add("INFO", "遠端探測", "已依 --no-network 略過 Supabase 與 Resend 遠端驗證。");
}

const icons = { PASS: "PASS", FAIL: "FAIL", WARN: "WARN", MANUAL: "TODO", INFO: "INFO" };
for (const result of results) {
  console.log(`[${icons[result.status]}] ${result.area}: ${result.message}`);
  if (result.fix) console.log(`       -> ${result.fix}`);
}

const counts = Object.fromEntries(
  ["PASS", "FAIL", "WARN", "MANUAL", "INFO"].map((status) => [
    status,
    results.filter((result) => result.status === status).length,
  ]),
);
console.log(`\n總結：${counts.PASS} 通過，${counts.FAIL} 失敗，${counts.WARN} 警告，${counts.MANUAL} 項需人工確認。`);
if (counts.FAIL) {
  console.log("結果：尚未具備完整執行條件。請依 FAIL 項目補齊後重跑。");
  process.exitCode = 1;
} else {
  console.log("結果：自動檢查通過；上線前仍需完成 TODO 人工確認。");
}
