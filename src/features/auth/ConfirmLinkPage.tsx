import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ErrorMessage, buttonPrimary } from "@/components/ui";
import { verifyLink } from "./auth";

/** Llega desde el enlace del email: /acceso/confirmar?token_hash=… */
export function ConfirmLinkPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const tokenHash = params.get("token_hash") ?? "";

  useEffect(() => {
    let active = true;
    void verifyLink(tokenHash).then((result) => {
      if (!active) return;
      if (result.ok) navigate("/", { replace: true });
      else setError(result.error);
    });
    return () => {
      active = false;
    };
  }, [tokenHash, navigate]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-5">
      {error ? (
        <>
          <ErrorMessage>{error}</ErrorMessage>
          <Link to="/acceso" replace className={buttonPrimary}>
            Volver a entrar
          </Link>
        </>
      ) : (
        <p role="status" className="text-center text-2xl font-semibold">
          Entrando…
        </p>
      )}
    </main>
  );
}
