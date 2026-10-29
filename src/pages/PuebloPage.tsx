import { TINTS } from "@/components/tints";
import { CalendarIcon, MapIcon } from "@/components/icons";
import { HubGrid } from "@/components/HubGrid";
import { PageTitle } from "@/components/ui";

const ITEMS = [
  {
    to: "/eventos",
    Icon: CalendarIcon,
    label: "Eventos del pueblo",
    hint: "Fiestas, mercado",
    tint: TINTS.events,
  },
  {
    to: "/excursiones",
    Icon: MapIcon,
    label: "Excursiones",
    hint: "Sitios cerca",
    tint: TINTS.excursions,
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
