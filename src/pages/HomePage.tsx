import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router";
import { Avatar } from "@/components/Avatar";
import { UsersIcon } from "@/components/icons";
import { Card, buttonSecondary } from "@/components/ui";
import { useMe } from "@/features/auth/RequireAuth";
import { StayCard } from "@/features/calendar/CalendarPage";
import { staysOn, toKey, useStays } from "@/features/calendar/stays";
import { useHouse } from "@/features/house/HouseGate";
import { useHousePhotoUrl } from "@/features/house/photo";
import { useNotes } from "@/features/notes/notes";
import { InstallCard } from "@/pwa/InstallCard";

/** Inicio. En las próximas fases: «Llego / Me voy», avisos y saldo. */
export function HomePage() {
  const { profile } = useMe();
  const { house, members, isAdmin } = useHouse();
  const photo = useHousePhotoUrl(house.photoPath);
  const onlyMe = members.length === 1;

  return (
    <>
      <header className="mb-6">
        <p className="text-lg font-semibold text-muted first-letter:uppercase">
          {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
        </p>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
          Hola, {profile.displayName}
        </h1>
      </header>
      <div className="space-y-5">
        {photo.data && (
          <img
            src={photo.data}
            alt={`Foto de ${house.name}`}
            className="aspect-[16/10] w-full rounded-3xl object-cover shadow-lg"
          />
        )}
        {isAdmin && onlyMe && (
          <Card className="border-accent/40 bg-accent-soft">
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-accent-contrast"
              >
                <UsersIcon />
              </span>
              <div>
                <h2 className="text-2xl font-bold">Invita a la familia</h2>
                <p className="mt-1 text-lg">
                  Manda un enlace por WhatsApp a cada persona para que entre en {house.name}.
                </p>
              </div>
            </div>
            <Link to="/familia" className={`${buttonSecondary} mt-4 bg-surface`}>
              Invitar a alguien
            </Link>
          </Card>
        )}
        <WhoIsGoing />
        <PendingNotes />
        {house.notes && (
          <Card>
            <h2 className="text-2xl font-bold">📝 Notas de la casa</h2>
            <p className="mt-2 whitespace-pre-line text-lg">{house.notes}</p>
          </Card>
        )}
        <InstallCard />
      </div>
    </>
  );
}

/** Quién está ahora en la casa y quién va a ir (las 2 próximas reservas). */
function WhoIsGoing() {
  const { members } = useHouse();
  const stays = useStays();
  const today = toKey(new Date());
  const all = stays.data ?? [];
  const now = staysOn(all, today);
  const next = all.filter((s) => s.start > today).slice(0, 2);
  if (stays.isPending) return null;
  const present = members.filter((m) => now.some((s) => s.memberId === m.id));

  return (
    <section aria-labelledby="quien-va" className="space-y-3">
      <Card>
        <h2 id="quien-va" className="text-2xl font-bold">
          ¿Quién está en la casa?
        </h2>
        {present.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-3">
            {present.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-4"
              >
                <Avatar member={m} members={members} size="sm" />
                <span className="text-lg font-bold">{m.displayName}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-lg text-muted">Ahora mismo no hay nadie.</p>
        )}
      </Card>
      {next.length > 0 && (
        <>
          <h3 className="px-1 pt-2 text-xl font-bold">Próximamente</h3>
          <ul className="space-y-3">
            {next.map((s) => (
              <li key={s.id}>
                <StayCard stay={s} members={members} />
              </li>
            ))}
          </ul>
        </>
      )}
      <Link to="/calendario" className={buttonSecondary}>
        Ver el calendario
      </Link>
    </section>
  );
}

/** Notas pendientes («falta aceite»…), las 3 últimas. */
function PendingNotes() {
  const notes = useNotes();
  const pending = (notes.data ?? []).filter((n) => !n.done);
  if (!notes.isSuccess) return null;
  return (
    <Card>
      <h2 className="text-2xl font-bold">
        Notas de la casa{" "}
        {pending.length > 0 && <span className="text-muted">({pending.length})</span>}
      </h2>
      {pending.length === 0 ? (
        <p className="mt-2 text-lg text-muted">No hay nada pendiente.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-lg">
          {pending.slice(0, 3).map((n) => (
            <li key={n.id} className="flex gap-2">
              <span aria-hidden="true" className="text-accent">
                •
              </span>
              {n.text}
            </li>
          ))}
        </ul>
      )}
      <Link to="/notas" className={`${buttonSecondary} mt-4`}>
        {pending.length > 0 ? "Ver y tachar" : "Añadir una nota"}
      </Link>
    </Card>
  );
}
