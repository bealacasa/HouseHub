import {
  BellIcon,
  BookIcon,
  DoorIcon,
  HomeIcon,
  KeyIcon,
  ListIcon,
  PhoneIcon,
} from "@/components/icons";
import { HubGrid } from "@/components/HubGrid";
import { Card, PageTitle } from "@/components/ui";
import { useHouse } from "@/features/house/HouseGate";

const ITEMS = [
  {
    to: "/llegar",
    Icon: KeyIcon,
    label: "Al llegar",
    hint: "Abrir la casa",
    tint: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  {
    to: "/irse",
    Icon: DoorIcon,
    label: "Al irse",
    hint: "Cerrar la casa",
    tint: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  },
  {
    to: "/instrucciones",
    Icon: BookIcon,
    label: "Instrucciones",
    hint: "Caldera, placa…",
    tint: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  },
  {
    to: "/notas",
    Icon: ListIcon,
    label: "Notas",
    hint: "Lo que falta",
    tint: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  {
    to: "/recordatorios",
    Icon: BellIcon,
    label: "Mis recordatorios",
    hint: "🔒 Solo los ves tú",
    tint: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  },
  {
    to: "/contactos",
    Icon: PhoneIcon,
    label: "Contactos",
    hint: "Emergencias y teléfonos",
    tint: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  },
  {
    to: "/casa/datos",
    Icon: HomeIcon,
    label: "Datos de la casa",
    hint: "Foto, dirección…",
    tint: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
] as const;

/** Pestaña «Casa»: todo lo de dentro de la casa. */
export function CasaPage() {
  const { house } = useHouse();
  return (
    <>
      <PageTitle title="La casa" subtitle="Cómo funciona y qué falta." />
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
