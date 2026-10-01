import { describe, expect, it } from "vitest";
import { readSupabaseConfig } from "./config";

function jwtWithRole(role: string): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role })}.signature`;
}

const validEnv = {
  SUPABASE_URL: "https://abcd.supabase.co",
  SUPABASE_ANON_KEY: jwtWithRole("anon"),
};

describe("readSupabaseConfig", () => {
  it("returns the config when URL and anon key are present", () => {
    expect(readSupabaseConfig(validEnv)).toEqual({
      ok: true,
      url: validEnv.SUPABASE_URL,
      anonKey: validEnv.SUPABASE_ANON_KEY,
    });
  });

  it("accepts a publishable key", () => {
    const result = readSupabaseConfig({
      ...validEnv,
      SUPABASE_ANON_KEY: "sb_publishable_abc123",
    });
    expect(result.ok).toBe(true);
  });

  it("reports every missing variable", () => {
    expect(readSupabaseConfig({})).toEqual({
      ok: false,
      reason: "missing",
      missing: ["SUPABASE_URL", "SUPABASE_ANON_KEY"],
    });
  });

  it("treats blank values as missing", () => {
    const result = readSupabaseConfig({ ...validEnv, SUPABASE_URL: "  " });
    expect(result).toEqual({
      ok: false,
      reason: "missing",
      missing: ["SUPABASE_URL"],
    });
  });

  it("rejects non-HTTPS URLs to protect data in transit", () => {
    const result = readSupabaseConfig({
      ...validEnv,
      SUPABASE_URL: "http://abcd.supabase.co",
    });
    expect(result).toEqual({ ok: false, reason: "insecure-url" });
  });

  it("rejects a malformed URL", () => {
    const result = readSupabaseConfig({ ...validEnv, SUPABASE_URL: "not a url" });
    expect(result).toEqual({ ok: false, reason: "insecure-url" });
  });

  it("rejects a legacy service_role key", () => {
    const result = readSupabaseConfig({
      ...validEnv,
      SUPABASE_ANON_KEY: jwtWithRole("service_role"),
    });
    expect(result).toEqual({ ok: false, reason: "privileged-key" });
  });

  it("rejects a secret key", () => {
    const result = readSupabaseConfig({
      ...validEnv,
      SUPABASE_ANON_KEY: "sb_secret_abc123",
    });
    expect(result).toEqual({ ok: false, reason: "privileged-key" });
  });
});
