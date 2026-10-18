import { useQueryClient } from "@tanstack/react-query";
import { createContext, use, useEffect, useState } from "react";
import { ErrorMessage, buttonPrimary, buttonSecondary, inputClass } from "@/components/ui";
import { signOut } from "@/features/auth/auth";
import { useMe } from "@/features/auth/RequireAuth";
import {
  acceptPendingInvite,
  errorMessage,
  houseKey,
  peekPendingInvite,
  useCreateHouse,
  useHouseState,
  type House,
  type Member,
} from "./house";

type HouseContextValue = { house: House; members: Member[]; me: Member; isAdmin: boolean };
const HouseContext = createContext<HouseContextValue | null>(null);

/** La casa, sus miembros y quién eres tú en ella (solo dentro de HouseGate). */
export function useHouse(): HouseContextValue {
  const value = use(HouseContext);
  if (!value) throw new Error("useHouse fuera de HouseGate");
  return value;
}

/**
 * Tras iniciar sesión: si te invitaron, acepta la invitación; si eres miembro, entra; si
 * la casa aún no existe, ofrece crearla (el primero que entra la administra); si existe y
 * no eres miembro, explica que hace falta una invitación.
 */
export function HouseGate({ children }: { children: React.ReactNode }) {
  const { session } = useMe();
  const queryClient = useQueryClient();
  const [inviteError, setInviteError] = useState<string | null>(null);
  // Invitación recibida antes de entrar: se toma una sola vez y se acepta.
  const [pendingToken] = useState(peekPendingInvite);
  const [accepting, setAccepting] = useState(pendingToken !== null);

  useEffect(() => {
    if (!pendingToken) return;
    let active = true;
    void acceptPendingInvite(pendingToken).then(async (result) => {
      if (!result.ok && active) setInviteError(result.error);
      await queryClient.invalidateQueries({ queryKey: houseKey });
      if (active) setAccepting(false);
    });
    return () => {
      active = false;
    };
  }, [pendingToken, queryClient]);

  const state = useHouseState(session.user.id);

  if (accepting) return <Screen>Aceptando la invitación…</Screen>;
  if (state.isPending) return <Screen>Cargando…</Screen>;
  if (state.isError) {
    return (
      <Screen>
        No se ha podido cargar. Comprueba que tienes internet y vuelve a abrir la app.
      </Screen>
    );
  }
  const data = state.data;
  if (data.kind === "no-house") return <CreateHouse />;
  if (data.kind === "not-invited") return <NotInvited error={inviteError} />;
  return (
    <HouseContext
      value={{
        house: data.house,
        members: data.members,
        me: data.me,
        isAdmin: data.me.role === "admin",
      }}
    >
      {inviteError && (
        <div className="mx-auto max-w-xl px-4 pt-4">
          <ErrorMessage>{inviteError}</ErrorMessage>
        </div>
      )}
      {children}
    </HouseContext>
  );
}

function CreateHouse() {
  const [name, setName] = useState("");
  const create = useCreateHouse();
  return (
    <Centered>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(name);
        }}
      >
        <h1 className="text-3xl font-extrabold">Vamos a crear la casa</h1>
        <p className="text-xl">
          Eres la primera persona en entrar: tú la administrarás e invitarás a la familia.
        </p>
        <div>
          <label htmlFor="house-name" className="text-xl font-semibold">
            ¿Cómo la llamáis?
          </label>
          <p className="text-muted">Por ejemplo: «Casa del pueblo».</p>
          <input
            id="house-name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputClass} mt-2`}
          />
        </div>
        {create.isError && <ErrorMessage>{errorMessage(create.error)}</ErrorMessage>}
        <button type="submit" disabled={create.isPending} className={buttonPrimary}>
          {create.isPending ? "Creando…" : "Crear la casa"}
        </button>
      </form>
    </Centered>
  );
}

function NotInvited({ error }: { error: string | null }) {
  return (
    <Centered>
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold">Necesitas una invitación</h1>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <p className="text-xl">
          Pide a quien administra la casa que te mande un enlace de invitación por WhatsApp y ábrelo
          en este móvil.
        </p>
        <button type="button" onClick={() => void signOut()} className={buttonSecondary}>
          Salir
        </button>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))]">
      {children}
    </main>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <Centered>
      <p role="status" className="text-center text-2xl font-semibold">
        {children}
      </p>
    </Centered>
  );
}
