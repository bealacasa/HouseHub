import type { Session } from "@supabase/supabase-js";
import { createContext, use, useState } from "react";
import { Navigate } from "react-router";
import { ErrorMessage, buttonPrimary, buttonSecondary, inputClass } from "@/components/ui";
import { PASSKEY_ASKED, passkeysSupported, registerPasskey, useSession } from "./auth";
import { useProfile, useSaveName, type Profile } from "./profile";

type Me = { session: Session; profile: Profile };
const MeContext = createContext<Me | null>(null);

/** Usuario con sesión y su perfil (solo dentro de RequireAuth). */
export function useMe(): Me {
  const me = use(MeContext);
  if (!me) throw new Error("useMe fuera de RequireAuth");
  return me;
}

/**
 * Protege las pantallas privadas. Sin sesión → /acceso. La primera vez pregunta el nombre
 * y ofrece entrar con la cara o la huella (passkey) para no tener que pedir más códigos.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  if (loading) return <FullScreenMessage text="Cargando…" />;
  if (!session) return <Navigate to="/acceso" replace />;
  return <WithProfile session={session}>{children}</WithProfile>;
}

function WithProfile({ session, children }: { session: Session; children: React.ReactNode }) {
  const profile = useProfile(session.user.id);
  const [passkeyAsked, setPasskeyAsked] = useState(() => readFlag(PASSKEY_ASKED));

  if (profile.isPending) return <FullScreenMessage text="Cargando…" />;
  if (profile.isError) {
    return (
      <FullScreenMessage text="No se ha podido cargar. Comprueba que tienes internet y vuelve a abrir la app." />
    );
  }
  if (!profile.data.displayName) return <AskName userId={session.user.id} />;
  if (!passkeyAsked && passkeysSupported()) {
    return (
      <OfferPasskey
        onDone={() => {
          writeFlag(PASSKEY_ASKED);
          setPasskeyAsked(true);
        }}
      />
    );
  }
  return <MeContext value={{ session, profile: profile.data }}>{children}</MeContext>;
}

function AskName({ userId }: { userId: string }) {
  const [name, setName] = useState("");
  const save = useSaveName(userId);
  return (
    <Centered>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(name);
        }}
      >
        <h1 className="text-3xl font-extrabold">¡Bienvenido!</h1>
        <div>
          <label htmlFor="name" className="text-xl font-semibold">
            ¿Cómo te llamas?
          </label>
          <p className="text-muted">Así te verá la familia. Por ejemplo: «Abuela Carmen».</p>
          <input
            id="name"
            autoComplete="given-name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`${inputClass} mt-2`}
          />
        </div>
        {save.isError && <ErrorMessage>Escribe tu nombre (máximo 60 letras).</ErrorMessage>}
        <button type="submit" disabled={save.isPending} className={buttonPrimary}>
          Continuar
        </button>
      </form>
    </Centered>
  );
}

/**
 * Se ofrece una sola vez por móvil, justo después de entrar con el código. Si ya entraste
 * con la cara o la huella, no aparece. Al aceptarla, sigue sola al inicio.
 */
function OfferPasskey({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Centered>
      <div className="space-y-5 text-center">
        <span
          aria-hidden="true"
          className="mx-auto grid size-24 place-items-center rounded-full bg-linear-to-br from-accent to-accent-2 text-5xl text-accent-contrast shadow-lg"
        >
          🙂
        </span>
        <h1 className="text-3xl font-extrabold leading-tight">
          ¿Quieres entrar con tu cara o tu huella?
        </h1>
        <p className="text-xl">
          Así, la próxima vez <strong>no tendrás que esperar el código del correo</strong>: solo
          mirar el móvil o poner el dedo.
        </p>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void registerPasskey().then((r) => {
              setBusy(false);
              if (r.ok) onDone();
              else setError(r.error);
            });
          }}
          className={buttonPrimary}
        >
          {busy ? "Un momento…" : "Sí, usar mi cara o huella"}
        </button>
        <button type="button" onClick={onDone} className={buttonSecondary}>
          No, prefiero el código
        </button>
        <p className="text-lg text-muted">Puedes cambiarlo cuando quieras en Más → Mi cuenta.</p>
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

function FullScreenMessage({ text }: { text: string }) {
  return (
    <Centered>
      <p role="status" className="text-center text-2xl font-semibold">
        {text}
      </p>
    </Centered>
  );
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Sin almacenamiento: se volverá a ofrecer, sin más.
  }
}
