import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type Vercel = { headers: { source: string; headers: { key: string; value: string }[] }[] };
const vercel = JSON.parse(readFileSync("vercel.json", "utf8")) as Vercel;
const global = new Map(
  vercel.headers.find((h) => h.source === "/(.*)")?.headers.map((h) => [h.key, h.value]),
);
const csp = global.get("Content-Security-Policy") ?? "";
const directive = (name: string) =>
  csp
    .split(";")
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `));

describe("cabeceras de seguridad (vercel.json)", () => {
  it("CSP estricta: sin inline ni eval, sin marcos y solo nuestro Supabase", () => {
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|\*/);
    expect(directive("script-src")).toBe("script-src 'self'");
    expect(directive("style-src")).toBe("style-src 'self'");
    expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive("object-src")).toBe("object-src 'none'");
    expect(directive("connect-src")).toBe(
      "connect-src 'self' https://mqszfxwnlhbbkonmfjqn.supabase.co",
    );
  });

  it("HSTS, nosniff, Referrer-Policy, Permissions-Policy y anti-iframe", () => {
    expect(global.get("Strict-Transport-Security")).toMatch(/max-age=63072000; includeSubDomains/);
    expect(global.get("X-Content-Type-Options")).toBe("nosniff");
    expect(global.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(global.get("Permissions-Policy")).toMatch(/geolocation=\(\)/);
    expect(global.get("Permissions-Policy")).toMatch(/publickey-credentials-get=\(self\)/);
    expect(global.get("X-Frame-Options")).toBe("DENY");
  });

  it("ningún secreto en los archivos de ejemplo", () => {
    const example = readFileSync(".env.example", "utf8");
    expect(example).not.toMatch(/sb_secret_[A-Za-z0-9]|eyJhbGci/);
  });
});
