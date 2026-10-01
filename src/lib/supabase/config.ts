export type SupabaseConfig =
  | { ok: true; url: string; anonKey: string }
  | { ok: false; reason: "missing"; missing: string[] }
  | { ok: false; reason: "insecure-url" }
  | { ok: false; reason: "privileged-key" };

type Env = Record<string, string | undefined>;

const REQUIRED_VARS = ["SUPABASE_URL", "SUPABASE_ANON_KEY"] as const;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function jwtRole(token: string): string | undefined {
  const payload = token.split(".")[1];
  if (!payload) return undefined;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).role;
  } catch {
    return undefined;
  }
}

// Only low-privilege keys (anon / publishable) may be used by the dashboard;
// access to data must be governed by Row Level Security in Supabase.
function isPrivilegedKey(key: string): boolean {
  return key.startsWith("sb_secret_") || jwtRole(key) === "service_role";
}

export function readSupabaseConfig(env: Env): SupabaseConfig {
  const missing = REQUIRED_VARS.filter((name) => !env[name]?.trim());
  if (missing.length > 0) return { ok: false, reason: "missing", missing };

  const url = env.SUPABASE_URL!.trim();
  const anonKey = env.SUPABASE_ANON_KEY!.trim();

  if (!isHttpsUrl(url)) return { ok: false, reason: "insecure-url" };
  if (isPrivilegedKey(anonKey)) return { ok: false, reason: "privileged-key" };

  return { ok: true, url, anonKey };
}
