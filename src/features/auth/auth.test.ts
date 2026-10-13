import { describe, expect, it } from "vitest";
import { installFakeSupabase } from "@/test/fakeSupabase";
import { codeSchema, emailSchema, sendCode, signOut, verifyCode, verifyLink } from "./auth";

describe("validación de acceso", () => {
  it("normaliza el correo y rechaza los no válidos", () => {
    expect(emailSchema.parse("  Ana@Gmail.COM ")).toBe("ana@gmail.com");
    expect(emailSchema.safeParse("ana@").success).toBe(false);
    expect(emailSchema.safeParse("").success).toBe(false);
  });

  it("acepta el código con espacios o guiones, solo 6 cifras", () => {
    expect(codeSchema.parse("123 456")).toBe("123456");
    expect(codeSchema.parse("123-456")).toBe("123456");
    expect(codeSchema.safeParse("12345").success).toBe(false);
    expect(codeSchema.safeParse("12345a").success).toBe(false);
  });
});

describe("acceso con código", () => {
  it("envía el código creando la cuenta si no existe", async () => {
    const { auth } = installFakeSupabase();
    expect(await sendCode(" Ana@example.com")).toEqual({ ok: true });
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "ana@example.com",
      options: { shouldCreateUser: true },
    });
  });

  it("explica el exceso de intentos y no llama a Supabase con un correo malo", async () => {
    const { auth } = installFakeSupabase();
    expect((await sendCode("no-es-correo")).ok).toBe(false);
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
    auth.signInWithOtp.mockResolvedValueOnce({ data: {}, error: { status: 429 } } as never);
    expect(await sendCode("ana@example.com")).toEqual({
      ok: false,
      error: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
    });
  });

  it("verifica el código y el enlace; los erróneos dan un mensaje claro", async () => {
    installFakeSupabase();
    expect((await verifyCode("ana@example.com", "000000")).ok).toBe(false);
    expect(await verifyCode("ana@example.com", "123 456")).toEqual({ ok: true });
    expect((await verifyLink("<script>")).ok).toBe(false);
    expect(await verifyLink("hash-valido-123")).toEqual({ ok: true });
  });

  it("cierra sesión en este dispositivo o en todos", async () => {
    const { auth } = installFakeSupabase({ signedIn: true });
    await signOut();
    expect(auth.signOut).toHaveBeenLastCalledWith({ scope: "local" });
    await signOut(true);
    expect(auth.signOut).toHaveBeenLastCalledWith({ scope: "global" });
  });
});
