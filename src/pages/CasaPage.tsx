import { BookIcon, HomeIcon, ListIcon } from "@/components/icons";
import { HubGrid } from "@/components/HubGrid";
import { Card, PageTitle } from "@/components/ui";
import { useHouse } from "@/features/house/HouseGate";

const ITEMS = [
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
      {house.address && (
        <Card className="mt-5">
          <h2 className="text-xl font-bold">Dirección</h2>
          <p className="mt-1 text-lg">{house.address}</p>
        </Card>
      )}
    </>
  );
}
