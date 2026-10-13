import type { SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";
import { setSupabaseForTests } from "@/lib/supabase";

type Profile = { id: string; display_name: string };

/**
 * Supabase simulado para los tests: auth (código por email, sesión) y la tabla profiles.
 * Nunca se usa el proyecto real en los tests unitarios.
 */
export function installFakeSupabase(options: { signedIn?: boolean; name?: string } = {}) {
  const user = { id: "11111111-1111-4111-8111-111111111111", email: "ana@example.com" };
  let session = options.signedIn ? { user, access_token: "t" } : null;
  const listeners = new Set<(event: string, s: typeof session) => void>();
  const profiles = new Map<string, Profile>([
    [user.id, { id: user.id, display_name: options.name ?? "" }],
  ]);
  const emit = () => listeners.forEach((l) => l("SIGNED_IN", session));

  const auth = {
    getSession: vi.fn(async () => ({ data: { session }, error: null })),
    onAuthStateChange: vi.fn((listener: (event: string, s: typeof session) => void) => {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe: () => listeners.delete(listener) } } };
    }),
    signInWithOtp: vi.fn(async (..._args: unknown[]) => ({ data: {}, error: null })),
    verifyOtp: vi.fn(async (args: { token?: string; token_hash?: string }) => {
      if (args.token !== "123456" && args.token_hash !== "hash-valido-123") {
        return { data: {}, error: { status: 403, message: "invalid" } };
      }
      session = { user, access_token: "t" };
      emit();
      return { data: { session }, error: null };
    }),
    signOut: vi.fn(async (..._args: unknown[]) => {
      session = null;
      emit();
      return { error: null };
    }),
    signInWithPasskey: vi.fn(async () => ({ data: {}, error: null })),
    registerPasskey: vi.fn(async () => ({ data: {}, error: null })),
  };

  const from = (table: string) => {
    if (table !== "profiles") throw new Error(`tabla no simulada: ${table}`);
    return {
      select: () => ({
        eq: (_col: string, id: string) => ({
          single: async () => {
            const row = profiles.get(id);
            return row ? { data: row, error: null } : { data: null, error: { message: "404" } };
          },
        }),
      }),
      update: (changes: Partial<Profile>) => ({
        eq: async (_col: string, id: string) => {
          const row = profiles.get(id);
          if (row) profiles.set(id, { ...row, ...changes });
          return { error: null };
        },
      }),
    };
  };

  setSupabaseForTests({ auth, from } as unknown as SupabaseClient);
  return { auth, profiles, user };
}
