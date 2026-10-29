import { TINTS } from "@/components/tints";
import {
  BellIcon,
  BookIcon,
  CameraIcon,
  DoorIcon,
  HomeIcon,
  ListIcon,
  PhoneIcon,
} from "@/components/icons";
import { HubGrid } from "@/components/HubGrid";
import { Card, PageTitle } from "@/components/ui";
import { Link } from "react-router";
import { useHouse } from "@/features/house/HouseGate";
import { useHousePhotoUrl } from "@/features/house/photo";

const ITEMS = [
  {
    to: "/irse",
    Icon: DoorIcon,
    label: "Al irse",
    hint: "Cerrar la casa",
    tint: TINTS.leave,
  },
  {
    to: "/instrucciones",
    Icon: BookIcon,
    label: "Instrucciones",
    hint: "Caldera, placa…",
    tint: TINTS.guides,
  },
  {
    to: "/notas",
    Icon: ListIcon,
    label: "Notas",
    hint: "Lo que falta",
    tint: TINTS.notes,
  },
  {
    to: "/recordatorios",
    Icon: BellIcon,
    label: "Mis recordatorios",
    hint: "🔒 Solo los ves tú",
    tint: TINTS.reminders,
  },
  {
    to: "/contactos",
    Icon: PhoneIcon,
    label: "Contactos",
    hint: "Emergencias y teléfonos",
    tint: TINTS.contacts,
  },
  {
    to: "/casa/datos",
    Icon: HomeIcon,
    label: "Datos de la casa",
    hint: "Foto, dirección…",
    tint: TINTS.houseData,
  },
] as const;

/**
 * La foto de la casa, grande y con su nombre: es lo que hace que la app se sienta vuestra.
 * Sin foto, una invitación a ponerla (cualquiera de la familia puede).
 */
function HousePhoto() {
  const { house } = useHouse();
  const photo = useHousePhotoUrl(house.photoPath);
  if (house.photoPath && !photo.data) return null;
  if (photo.data) {
    return (
      <Link
        to="/casa/datos"
        className="relative mb-5 block overflow-hidden rounded-3xl shadow-lg active:scale-[0.99]"
      >
        <img
          src={photo.data}
          alt={`Foto de ${house.name}`}
          className="aspect-[16/10] w-full object-cover"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent"
        />
        <span className="absolute inset-x-0 bottom-0 p-5 text-2xl font-extrabold text-white">
          {house.name}
        </span>
      </Link>
    );
  }
  return (
    <Link
      to="/casa/datos"
      className="mb-5 flex min-h-20 items-center gap-4 rounded-3xl border-2 border-dashed border-field p-4 active:scale-[0.99]"
    >
      <span
        aria-hidden="true"
        className={`grid size-14 shrink-0 place-items-center rounded-2xl ${TINTS.houseData}`}
      >
        <CameraIcon />
      </span>
      <span>
        <span className="block text-xl font-bold">Pon una foto de la casa</span>
        <span className="block text-base text-muted">Saldrá aquí y en el inicio.</span>
      </span>
    </Link>
  );
}

/** Pestaña «Casa»: todo lo de dentro de la casa. */
export function CasaPage() {
  const { house } = useHouse();
  return (
    <>
      <PageTitle title="La casa" subtitle="Cómo funciona y qué falta." />
      <HousePhoto />
      <HubGrid items={ITEMS} label="La casa" />
      {(house.address || house.notes) && (
        <Card className="mt-5 space-y-3">
          <h2 className="text-2xl font-bold">
            <span aria-hidden="true">ℹ️ </span>Información de la casa
          </h2>
          {house.address && <p className="text-lg font-semibold">{house.address}</p>}
          {house.notes && <p className="whitespace-pre-line text-lg">{house.notes}</p>}
        </Card>
      )}
    </>
  );
}
