import { useState } from "react";
import { Link } from "react-router";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Card,
  ErrorMessage,
  PageTitle,
  SuccessMessage,
  buttonDanger,
  buttonPrimary,
  backLink,
  buttonSecondary,
  inputClass,
} from "@/components/ui";
import { passkeysSupported, registerPasskey, signOut } from "@/features/auth/auth";
import { useSaveName } from "@/features/auth/profile";
import { useMe } from "@/features/auth/RequireAuth";
import { AvatarPicker } from "@/features/house/AvatarPicker";
import { useHouse } from "@/features/house/HouseGate";

export function SettingsPage() {
  const { session, profile } = useMe();
  const { house, members, me } = useHouse();
  const [dialog, confirm] = useConfirm();

  async function signOutEverywhere() {
    const ok = await confirm({
      title: "¿Cerrar sesión en todos tus dispositivos?",
      message:
        "Tendrás que volver a entrar en cada móvil, tablet u ordenador. Úsalo si has perdido un móvil.",
      confirmLabel: "Sí, cerrar en todos",
    });
    if (ok) await signOut(true);
  }

  return (
    <>
      <Link to="/mas" className={backLink}>
        ← Más
      </Link>
      <PageTitle title="Mi cuenta" subtitle={session.user.email ?? undefined} />
      <div className="space-y-4">
        <Card>
          <h2 className="mb-4 text-2xl font-bold">Tu foto</h2>
          <AvatarPicker houseId={house.id} member={me} members={members} />
        </Card>
        <NameCard userId={session.user.id} current={profile.displayName} />
        {passkeysSupported() && <PasskeyCard />}
        <Card>
          <h2 className="text-2xl font-bold">Salir</h2>
          <div className="mt-4 space-y-3">
            <button type="button" onClick={() => void signOut()} className={buttonSecondary}>
              Cerrar sesión en este móvil
            </button>
            <button type="button" onClick={() => void signOutEverywhere()} className={buttonDanger}>
              Cerrar sesión en todos mis dispositivos
            </button>
          </div>
        </Card>
      </div>
      {dialog}
    </>
  );
}

function NameCard({ userId, current }: { userId: string; current: string }) {
  const [name, setName] = useState(current);
  const save = useSaveName(userId);
  return (
    <Card>
      <form
        noValidate
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate(name);
        }}
      >
        <label htmlFor="settings-name" className="text-2xl font-bold">
          Tu nombre
        </label>
        <input
          id="settings-name"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        {save.isError && <ErrorMessage>Escribe tu nombre (máximo 60 letras).</ErrorMessage>}
        {save.isSuccess && <SuccessMessage>Nombre guardado.</SuccessMessage>}
        <button type="submit" disabled={save.isPending} className={buttonPrimary}>
          Guardar nombre
        </button>
      </form>
    </Card>
  );
}

function PasskeyCard() {
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Card>
      <h2 className="text-2xl font-bold">Entrar con tu cara o huella</h2>
      <p className="mt-2 text-lg">
        Actívalo en cada móvil que uses y no tendrás que esperar el correo con el código.
      </p>
      {result &&
        (result.ok ? (
          <div className="mt-3">
            <SuccessMessage>{result.text}</SuccessMessage>
          </div>
        ) : (
          <div className="mt-3">
            <ErrorMessage>{result.text}</ErrorMessage>
          </div>
        ))}
      <button
        type="button"
        onClick={() =>
          void registerPasskey().then((r) =>
            setResult(
              r.ok ? { ok: true, text: "Activado en este móvil." } : { ok: false, text: r.error },
            ),
          )
        }
        className={`${buttonSecondary} mt-4`}
      >
        Activar en este móvil
      </button>
    </Card>
  );
}
