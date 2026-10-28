import { CalendarIcon, MapIcon } from "@/components/icons";
import { HubGrid } from "@/components/HubGrid";
import { PageTitle } from "@/components/ui";

const ITEMS = [
  {
    to: "/eventos",
    Icon: CalendarIcon,
    label: "Eventos del pueblo",
    hint: "Fiestas, mercado",
    tint: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  },
  {
    to: "/excursiones",
    Icon: MapIcon,
    label: "Excursiones",
    hint: "Sitios cerca",
    tint: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
  },
] as const;

/** Pestaña «Pueblo»: lo que hay fuera de casa. */
export function PuebloPage() {
  return (
    <>
      <PageTitle title="El pueblo" subtitle="Qué hacer por la zona." />
      <HubGrid items={ITEMS} label="El pueblo" />
    </>
  );
}
