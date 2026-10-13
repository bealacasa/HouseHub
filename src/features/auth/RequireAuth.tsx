import type { Session } from "@supabase/supabase-js";
import { createContext, use, useState } from "react";
import { Navigate } from "react-router";
import {
  ErrorMessage,
  SuccessMessage,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/ui";
import { passkeysSupported, registerPasskey, useSession } from "./auth";
import { useProfile, useSaveName, type Profile } from "./profile";

type Me = { session: Session; profile: Profile };
const MeContext = createContext<Me | null>(null);

/** Usuario con sesión y su perfil (solo dentro de RequireAuth). */
export function useMe(): Me {
  const me = use(MeContext);
  if (!me) throw new Error("useMe fuera de RequireAuth");
  return me;
}

const PASSKEY_ASKED = "househub:passkey-asked";

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

function OfferPasskey({ onDone }: { onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  return (
    <Centered>
      <div className="space-y-4">
        <h1 className="text-3xl font-extrabold">Entra más fácil la próxima vez</h1>
        <p className="text-xl">
          Puedes entrar con <strong>tu cara o tu huella</strong>, sin esperar ningún correo.
        </p>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        {done ? (
          <>
            <SuccessMessage>
              ¡Listo! La próxima vez pulsa «Entrar con mi cara o huella».
            </SuccessMessage>
            <button type="button" onClick={onDone} className={buttonPrimary}>
              Continuar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() =>
                void registerPasskey().then((r) => (r.ok ? setDone(true) : setError(r.error)))
              }
              className={buttonPrimary}
            >
              Sí, activar
            </button>
            <button type="button" onClick={onDone} className={buttonSecondary}>
              Ahora no
            </button>
          </>
        )}
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
