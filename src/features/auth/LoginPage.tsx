import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router";
import { ErrorMessage, buttonPrimary, buttonSecondary, inputClass } from "@/components/ui";
import { passkeysSupported, sendCode, signInWithPasskey, useSession, verifyCode } from "./auth";

/**
 * Entrar: 1) escribe tu correo, 2) teclea el código de 6 números que te llega.
 * Si ya activaste la cara o la huella (passkey), un solo botón.
 */
export function LoginPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hasInvite] = useState(() => {
    try {
      return localStorage.getItem("househub:invite") !== null;
    } catch {
      return false;
    }
  });
  const navigate = useNavigate();
  const { session } = useSession();
  // Al entrar (código o huella), al inicio. Si ya había sesión, directamente.
  const goHome = () => navigate("/", { replace: true });

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, onOk?: () => void) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) setError(result.error ?? "Algo ha fallado. Inténtalo de nuevo.");
    else onOk?.();
  }

  if (session) return <Navigate to="/" replace />;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(2rem+env(safe-area-inset-top))]">
      <div className="mb-8 text-center">
        <img src="/favicon.svg" alt="" className="mx-auto size-20 rounded-3xl" />
        <h1 className="mt-4 text-4xl font-extrabold">House Hub</h1>
        <p className="mt-2 text-xl text-muted">La casa de la familia, en tu móvil.</p>
      </div>
      {hasInvite && (
        <p role="status" className="mb-6 rounded-2xl bg-accent-soft p-4 text-xl font-semibold">
          🎉 Te han invitado a la casa. Entra con tu correo y quedará aceptada.
        </p>
      )}

      {step === "email" ? (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(
              () => sendCode(email),
              () => setStep("code"),
            );
          }}
        >
          <div>
            <label htmlFor="email" className="text-xl font-semibold">
              Tu correo electrónico
            </label>
            <input
              id="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`${inputClass} mt-2`}
            />
          </div>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <button type="submit" disabled={busy} className={buttonPrimary}>
            {busy ? "Enviando…" : "Enviarme un código"}
          </button>
          {passkeysSupported() && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(signInWithPasskey, goHome)}
              className={buttonSecondary}
            >
              Entrar con mi cara o huella
            </button>
          )}
        </form>
      ) : (
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void run(() => verifyCode(email, code), goHome);
          }}
        >
          <p className="text-xl">
            Te hemos enviado un correo a <strong className="break-all">{email.trim()}</strong> con
            un código de 6 números. Mira también en «Correo no deseado».
          </p>
          <div>
            <label htmlFor="code" className="text-xl font-semibold">
              Escribe el código
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={7}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} mt-2 text-center text-3xl font-bold tracking-[0.4em]`}
            />
          </div>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          <button type="submit" disabled={busy} className={buttonPrimary}>
            {busy ? "Comprobando…" : "Entrar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
            className={buttonSecondary}
          >
            Cambiar el correo o pedir otro código
          </button>
        </form>
      )}

      <p className="mt-8 text-center">
        <Link to="/privacidad" className="text-lg font-semibold text-accent underline">
          Privacidad
        </Link>
      </p>
    </main>
  );
}
