import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";

/*
 * La casa (solo hay una en toda la app), sus miembros y las invitaciones.
 * Toda la seguridad la imponen las políticas RLS y las funciones de Postgres: aquí solo
 * se valida para dar mensajes claros antes de llamar.
 */

export type Role = "admin" | "member";

export type House = {
  id: string;
  name: string;
  address: string;
  notes: string;
  photoPath: string | null;
  thermostatUrl: string | null;
};

export type Member = {
  id: string;
  userId: string | null;
  displayName: string;
  role: Role;
};

export type Invitation = {
  id: string;
  role: Role;
  memberId: string | null;
  createdAt: string;
  expiresAt: string;
  usedAt: string | null;
  revokedAt: string | null;
};

const houseRow = z.object({
  id: z.uuid(),
  name: z.string(),
  address: z.string(),
  notes: z.string(),
  photo_path: z.string().nullable(),
  thermostat_url: z.string().nullable(),
});

const memberRow = z.object({
  id: z.uuid(),
  user_id: z.uuid().nullable(),
  display_name: z.string(),
  role: z.enum(["admin", "member"]),
});

const invitationRow = z.object({
  id: z.uuid(),
  role: z.enum(["admin", "member"]),
  member_id: z.uuid().nullable(),
  created_at: z.string(),
  expires_at: z.string(),
  used_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
});

export const NOTES_WARNING =
  "No escribas aquí números de tarjeta, cuentas bancarias, códigos de alarma ni combinaciones.";

export const houseInputSchema = z.object({
  name: z.string().trim().min(1, "Ponle un nombre a la casa.").max(80, "Máximo 80 letras."),
  address: z.string().trim().max(200, "Máximo 200 letras."),
  notes: z.string().trim().max(2000, "Máximo 2000 letras."),
  thermostatUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "El enlace debe empezar por https://"),
});
export type HouseInput = z.input<typeof houseInputSchema>;

export const memberNameSchema = z
  .string()
  .trim()
  .min(1, "Escribe el nombre.")
  .max(60, "Máximo 60 letras.");

/** Token de invitación: 43 caracteres base64url (256 bits aleatorios). */
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export type HouseState =
  | { kind: "member"; house: House; members: Member[]; me: Member }
  /** No eres miembro y la casa aún no existe: puedes crearla. */
  | { kind: "no-house" }
  /** No eres miembro y la casa ya existe: necesitas una invitación. */
  | { kind: "not-invited" };

export const houseKey = ["house"] as const;

function toHouse(raw: unknown): House {
  const r = houseRow.parse(raw);
  return {
    id: r.id,
    name: r.name,
    address: r.address,
    notes: r.notes,
    photoPath: r.photo_path,
    thermostatUrl: r.thermostat_url,
  };
}

function toMember(raw: unknown): Member {
  const r = memberRow.parse(raw);
  return { id: r.id, userId: r.user_id, displayName: r.display_name, role: r.role };
}

export async function fetchHouseState(userId: string): Promise<HouseState> {
  const supabase = getSupabase();
  const { data: houses, error } = await supabase
    .from("houses")
    .select("id, name, address, notes, photo_path, thermostat_url")
    .limit(1);
  if (error) throw error;
  const house = houses?.[0];
  if (!house) {
    const { data: exists, error: rpcError } = await supabase.rpc("house_exists");
    if (rpcError) throw rpcError;
    return exists ? { kind: "not-invited" } : { kind: "no-house" };
  }
  const { data: rows, error: membersError } = await supabase
    .from("house_members")
    .select("id, user_id, display_name, role")
    .order("display_name");
  if (membersError) throw membersError;
  const members = (rows ?? []).map(toMember);
  const me = members.find((m) => m.userId === userId);
  if (!me) return { kind: "not-invited" };
  return { kind: "member", house: toHouse(house), members, me };
}

export function useHouseState(userId: string) {
  return useQuery({ queryKey: houseKey, queryFn: () => fetchHouseState(userId) });
}

/** Mensaje claro a partir de un error de Supabase (los de negocio ya vienen en español). */
export function errorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Revisa los datos.";
  const e = error as { code?: string; message?: string } | null;
  if (e?.code === "P0001" && e.message) return e.message;
  return "No se pudo guardar. Comprueba que tienes internet e inténtalo de nuevo.";
}

function useHouseMutation<T>(fn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: houseKey }),
  });
}

export function useCreateHouse() {
  return useHouseMutation(async (rawName: string) => {
    const name = houseInputSchema.shape.name.parse(rawName);
    const { error } = await getSupabase().rpc("create_house", { p_name: name });
    if (error) throw error;
  });
}

export function useUpdateHouse(houseId: string) {
  return useHouseMutation(async (input: HouseInput) => {
    const data = houseInputSchema.parse(input);
    const { error } = await getSupabase()
      .from("houses")
      .update({
        name: data.name,
        address: data.address,
        notes: data.notes,
        thermostat_url: data.thermostatUrl || null,
      })
      .eq("id", houseId);
    if (error) throw error;
  });
}

/** Familiar sin cuenta (p. ej. el abuelo sin móvil): cuenta en gastos y estancias. */
export function useAddMember(houseId: string) {
  return useHouseMutation(async (rawName: string) => {
    const name = memberNameSchema.parse(rawName);
    const { error } = await getSupabase()
      .from("house_members")
      .insert({ house_id: houseId, display_name: name, role: "member" });
    if (error) throw error;
  });
}

export function useUpdateMember() {
  return useHouseMutation(
    async ({ id, displayName, role }: { id: string; displayName: string; role: Role }) => {
      const name = memberNameSchema.parse(displayName);
      const { error } = await getSupabase()
        .from("house_members")
        .update({ display_name: name, role })
        .eq("id", id);
      if (error) throw error;
    },
  );
}

export function useRemoveMember() {
  return useHouseMutation(async (id: string) => {
    const { error } = await getSupabase().from("house_members").delete().eq("id", id);
    if (error) throw error;
  });
}

// ---------------------------------------------------------------------------
// Invitaciones
// ---------------------------------------------------------------------------

export const invitationsKey = ["invitations"] as const;

export function useInvitations(enabled: boolean) {
  return useQuery({
    queryKey: invitationsKey,
    enabled,
    queryFn: async (): Promise<Invitation[]> => {
      const { data, error } = await getSupabase()
        .from("invitations")
        .select("id, role, member_id, created_at, expires_at, used_at, revoked_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []).map((raw) => {
        const r = invitationRow.parse(raw);
        return {
          id: r.id,
          role: r.role,
          memberId: r.member_id,
          createdAt: r.created_at,
          expiresAt: r.expires_at,
          usedAt: r.used_at,
          revokedAt: r.revoked_at,
        };
      });
    },
  });
}

/** Una invitación sigue abierta si no se ha usado, ni anulado, ni ha caducado. */
export const isPending = (inv: Invitation, now = Date.now()) =>
  !inv.usedAt && !inv.revokedAt && new Date(inv.expiresAt).getTime() > now;

/** Enlace para compartir. El token va tras «#»: el navegador nunca lo envía a ningún servidor. */
export function inviteLink(token: string, origin = window.location.origin): string {
  return `${origin}/invitacion#t=${token}`;
}

export function useCreateInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ role, memberId }: { role: Role; memberId: string | null }) => {
      const { data, error } = await getSupabase().rpc("create_invitation", {
        p_role: role,
        p_member: memberId,
      });
      if (error) throw error;
      return inviteTokenSchema.parse(data);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsKey }),
  });
}

export function useRevokeInvitation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase()
        .from("invitations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsKey }),
  });
}

// Invitación pendiente de aceptar (se recibió el enlace antes de iniciar sesión).
const PENDING_INVITE = "househub:invite";

export function savePendingInvite(token: string): void {
  try {
    localStorage.setItem(PENDING_INVITE, token);
  } catch {
    // Sin almacenamiento: tendrá que volver a abrir el enlace tras entrar.
  }
}

/** Invitación guardada (sin borrarla todavía), o null. */
export function peekPendingInvite(): string | null {
  try {
    const token = localStorage.getItem(PENDING_INVITE);
    return token && inviteTokenSchema.safeParse(token).success ? token : null;
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(PENDING_INVITE);
  } catch {
    // Nada que borrar.
  }
}

// Una sola llamada por token aunque la pantalla se monte dos veces.
const inFlight = new Map<string, ReturnType<typeof acceptInvitation>>();

/** Acepta la invitación pendiente (una vez) y la borra del móvil. */
export function acceptPendingInvite(token: string): ReturnType<typeof acceptInvitation> {
  let promise = inFlight.get(token);
  if (!promise) {
    promise = acceptInvitation(token).finally(clearPendingInvite);
    inFlight.set(token, promise);
  }
  return promise;
}
/** Acepta la invitación a través de la Edge Function (que valida y la gasta). */
export async function acceptInvitation(
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!inviteTokenSchema.safeParse(token).success) {
    return { ok: false, error: "El enlace de invitación no es válido." };
  }
  const { data, error } = await getSupabase().functions.invoke("accept-invite", {
    body: { token },
  });
  if (error) {
    // El cuerpo del error trae el mensaje en español (caducada, ya usada…).
    const context = (error as { context?: Response }).context;
    const body = context ? await context.json().catch(() => null) : null;
    const message = z.object({ error: z.string() }).safeParse(body);
    return {
      ok: false,
      error: message.success ? message.data.error : "No se pudo aceptar la invitación.",
    };
  }
  return data ? { ok: true } : { ok: false, error: "No se pudo aceptar la invitación." };
}
