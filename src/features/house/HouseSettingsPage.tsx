import { useId, useState } from "react";
import { Link } from "react-router";
import {
  backLink,
  Card,
  ErrorMessage,
  PageTitle,
  SuccessMessage,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/ui";
import { ImageError } from "@/lib/image";
import { PrivacyHint } from "@/components/form";
import { errorMessage, useUpdateHouse } from "./house";
import { useHouse } from "./HouseGate";
import { useHousePhotoUrl, useSetHousePhoto } from "./photo";

/** Datos de la casa. Los miembros los ven; solo los administradores los cambian. */
export function HouseSettingsPage() {
  const { house, isAdmin } = useHouse();
  return (
    <>
      <Link to="/mas" className={backLink}>
        ← Más
      </Link>
      <PageTitle title="La casa" />
      <div className="space-y-4">
        <PhotoCard />
        {isAdmin ? (
          <HouseForm />
        ) : (
          <Card>
            <h2 className="text-2xl font-bold">{house.name}</h2>
            {house.address && <p className="mt-2 text-lg">{house.address}</p>}
            {house.notes && <p className="mt-3 whitespace-pre-line text-lg">{house.notes}</p>}
          </Card>
        )}
      </div>
    </>
  );
}

function PhotoCard() {
  const { house, isAdmin } = useHouse();
  const url = useHousePhotoUrl(house.photoPath);
  const setPhoto = useSetHousePhoto(house.id, house.photoPath);
  const inputId = useId();
  const error =
    setPhoto.error instanceof ImageError
      ? setPhoto.error.message
      : setPhoto.error
        ? errorMessage(setPhoto.error)
        : null;

  if (!isAdmin && !house.photoPath) return null;
  return (
    <Card>
      {url.data ? (
        <img
          src={url.data}
          alt={`Foto de ${house.name}`}
          className="aspect-[4/3] w-full rounded-2xl object-cover"
        />
      ) : (
        <p className="text-lg text-muted">Aún no hay foto de la casa.</p>
      )}
      {isAdmin && (
        <div className="mt-4 space-y-3">
          <label htmlFor={inputId} className={`${buttonSecondary} cursor-pointer`}>
            {setPhoto.isPending
              ? "Subiendo…"
              : house.photoPath
                ? "Cambiar la foto"
                : "Poner una foto"}
          </label>
          <input
            id={inputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) setPhoto.mutate(file);
              e.target.value = "";
            }}
          />
          <p className="text-muted">
            La ubicación y otros datos ocultos de la foto se borran al subirla.
          </p>
          {error && <ErrorMessage>{error}</ErrorMessage>}
        </div>
      )}
    </Card>
  );
}

function HouseForm() {
  const { house } = useHouse();
  const [name, setName] = useState(house.name);
  const [address, setAddress] = useState(house.address);
  const [notes, setNotes] = useState(house.notes);
  const update = useUpdateHouse(house.id);

  return (
    <Card>
      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          update.mutate({ name, address, notes });
        }}
      >
        <Field id="h-name" label="Nombre">
          <input
            id="h-name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field id="h-address" label="Dirección (opcional)">
          <input
            id="h-address"
            maxLength={200}
            autoComplete="street-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field id="h-notes" label="Notas para la familia (opcional)">
          <textarea
            id="h-notes"
            rows={5}
            maxLength={2000}
            aria-describedby="h-notes-hint"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} py-3`}
          />
          <PrivacyHint id="h-notes-hint" />
        </Field>
        {update.isError && <ErrorMessage>{errorMessage(update.error)}</ErrorMessage>}
        {update.isSuccess && <SuccessMessage>Guardado.</SuccessMessage>}
        <button type="submit" disabled={update.isPending} className={buttonPrimary}>
          Guardar
        </button>
      </form>
    </Card>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-lg font-semibold">
        {label}
      </label>
      {children}
    </div>
  );
}
