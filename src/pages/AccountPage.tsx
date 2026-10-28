import { Link } from "react-router";
import { LockIcon, UserIcon, UsersIcon } from "@/components/icons";
import { HubGrid } from "@/components/HubGrid";
import { PageTitle } from "@/components/ui";

const ITEMS = [
  {
    to: "/familia",
    Icon: UsersIcon,
    label: "La familia",
    hint: "Invitar a alguien",
    tint: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  {
    to: "/ajustes",
    Icon: UserIcon,
    label: "Mi cuenta",
    hint: "Foto, cara o huella",
    tint: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  },
] as const;

/** «Familia y ajustes» (botón de arriba a la derecha): personas y tu cuenta. */
export function AccountPage() {
  return (
    <>
      <PageTitle title="Familia y ajustes" />
      <HubGrid items={ITEMS} label="Familia y ajustes" />
      <Link
        to="/privacidad"
        className="mt-5 flex min-h-14 items-center justify-center gap-2 rounded-2xl text-lg font-semibold text-muted"
      >
        <LockIcon className="size-5" />
        Privacidad
      </Link>
    </>
  );
}
