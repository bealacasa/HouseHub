import type { SupabaseClient } from "@supabase/supabase-js";
import { vi } from "vitest";
import { setSupabaseForTests } from "@/lib/supabase";

const HOUSE_ID = "33333333-3333-4333-8333-333333333333";

type Profile = { id: string; display_name: string };

/**
 * Supabase simulado para los tests: auth (código por email, sesión) y la tabla profiles.
 * Nunca se usa el proyecto real en los tests unitarios.
 */
export function installFakeSupabase(
  options: { signedIn?: boolean; name?: string; house?: string } = {},
) {
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

  // --- Casa, miembros e invitaciones (sin RLS: eso se prueba en supabase/tests) ---
  type Row = Record<string, unknown>;
  const tables: Record<string, Row[]> = {
    houses: [],
    house_members: [],
    invitations: [],
    stays: [],
    house_notes: [],
    village_events: [],
    guides: [],
  };
  const uid = () => crypto.randomUUID();
  const ok = (data: unknown) => ({ data, error: null });

  function rows(table: string) {
    const list = tables[table];
    if (!list) throw new Error(`tabla no simulada: ${table}`);
    return list;
  }

  /** Consulta encadenable mínima: select/eq/order/limit/single; await devuelve {data}. */
  function query(table: string) {
    let filter: [string, unknown] | null = null;
    const run = () => rows(table).filter((r) => !filter || r[filter[0]] === filter[1]);
    const builder = {
      eq(col: string, value: unknown) {
        filter = [col, value];
        return builder;
      },
      gte: () => builder,
      order: () => builder,
      limit: () => builder,
      single: async () => ok(run()[0] ?? null),
      select: () => builder,
      then<T>(resolve: (v: { data: Row[]; error: null }) => T) {
        return Promise.resolve(ok(run()) as { data: Row[]; error: null }).then(resolve);
      },
    };
    return builder;
  }

  if (options.house) {
    tables.houses!.push({
      id: HOUSE_ID,
      name: options.house,
      address: "",
      notes: "",
      photo_path: null,
      thermostat_url: null,
    });
    tables.house_members!.push({
      id: "22222222-2222-4222-8222-222222222222",
      house_id: HOUSE_ID,
      user_id: user.id,
      display_name: options.name ?? "Ana",
      role: "admin",
    });
  }

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown> = {}) => {
    if (fn === "house_exists") return ok(tables.houses!.length > 0);
    if (fn === "create_house") {
      if (tables.houses!.length > 0) {
        return {
          data: null,
          error: { code: "P0001", message: "La casa ya existe: pide una invitación." },
        };
      }
      const id = uid();
      tables.houses!.push({
        id,
        name: args.p_name,
        address: "",
        notes: "",
        photo_path: null,
        thermostat_url: null,
      });
      tables.house_members!.push({
        id: uid(),
        house_id: id,
        user_id: session?.user.id ?? user.id,
        display_name: profiles.get(user.id)?.display_name || "Administrador",
        role: "admin",
      });
      return ok(id);
    }
    if (fn === "create_invitation") {
      tables.invitations!.push({
        id: uid(),
        role: args.p_role,
        member_id: args.p_member ?? null,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 72 * 3600_000).toISOString(),
        used_at: null,
        revoked_at: null,
      });
      return ok("A".repeat(43));
    }
    throw new Error(`rpc no simulada: ${fn}`);
  });

  const functions = {
    invoke: vi.fn(async (_name: string, _opts: unknown) => ok({ houseId: "h" })),
  };

  const from = (table: string) => {
    if (table !== "profiles") {
      return {
        select: () => query(table),
        insert: (row: Row) => {
          // Valores por defecto como en Postgres (las columnas que sobran se ignoran).
          const created: Row = {
            id: uid(),
            user_id: null,
            done_at: null,
            created_by: user.id,
            created_at: new Date().toISOString(),
            ...row,
          };
          rows(table).push(created);
          // Se puede esperar directamente o encadenar .select().single() como en supabase-js.
          return {
            select: () => ({ single: async () => ok({ id: created.id }) }),
            then<T>(resolve: (v: { error: null }) => T) {
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
        },
        update: (changes: Row) => ({
          eq: async (col: string, value: unknown) => {
            for (const r of rows(table)) if (r[col] === value) Object.assign(r, changes);
            return { error: null };
          },
        }),
        delete: () => ({
          eq: async (col: string, value: unknown) => {
            tables[table] = rows(table).filter((r) => r[col] !== value);
            return { error: null };
          },
        }),
      };
    }
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

  setSupabaseForTests({ auth, from, rpc, functions } as unknown as SupabaseClient);
  return { auth, profiles, user, tables, rpc, functions };
}
