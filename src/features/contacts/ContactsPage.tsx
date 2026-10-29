import { Link } from "react-router";
import {
  Card,
  ErrorMessage,
  PageTitle,
  backLink,
  buttonPrimary,
  buttonSecondary,
} from "@/components/ui";
import { useHouse } from "@/features/house/HouseGate";
import {
  ContactsNotReadyError,
  EMERGENCY_NUMBERS,
  telHref,
  useContacts,
  type Contact,
} from "./contacts";

const [MAIN, ...OTHERS] = EMERGENCY_NUMBERS;

/** Emergencias (siempre) y contactos de la casa, con «Llamar» de un toque. */
export function ContactsPage() {
  const { house } = useHouse();
  const contacts = useContacts();
  const notReady = contacts.error instanceof ContactsNotReadyError;
  const all = contacts.data ?? [];

  return (
    <>
      <Link to="/casa" className={backLink}>
        ← Casa
      </Link>
      <PageTitle title="Contactos" subtitle="Emergencias y teléfonos de la casa." />

      <section aria-labelledby="emergencias" className="mb-8">
        <h2 id="emergencias" className="mb-3 text-2xl font-bold">
          <span aria-hidden="true">🚨 </span>Emergencias
        </h2>
        <a
          href={telHref(MAIN.phone)}
          className="flex min-h-20 items-center justify-center gap-3 rounded-3xl bg-danger px-4 text-3xl font-extrabold text-white shadow-lg active:scale-[0.99] dark:text-black"
        >
          <span aria-hidden="true">📞</span> Llamar al {MAIN.phone}
        </a>
        <p className="mt-2 text-center text-lg text-muted">{MAIN.hint}</p>
        {house.address && (
          <Card className="mt-4 bg-surface-2!">
            <p className="text-base font-semibold text-muted">Dirección para decir por teléfono</p>
            <p className="mt-1 text-xl font-bold">{house.address}</p>
          </Card>
        )}
        <ul className="mt-4 space-y-2">
          {OTHERS.map((n) => (
            <li key={n.phone}>
              <PhoneRow name={n.name} detail={n.hint} phone={n.phone} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="de-la-casa">
        <h2 id="de-la-casa" className="mb-3 text-2xl font-bold">
          De la casa
        </h2>
        {notReady ? (
          <Card>
            <p className="text-lg">
              <strong>Muy pronto.</strong> Los contactos de la casa aún no están activados. Quien
              administra la casa tiene que terminar de prepararlos.
            </p>
          </Card>
        ) : (
          <>
            {contacts.isError && (
              <ErrorMessage>No se han podido cargar los contactos.</ErrorMessage>
            )}
            {contacts.isSuccess && all.length === 0 && (
              <p className="mb-3 rounded-3xl border-2 border-dashed border-border p-5 text-center text-lg text-muted">
                Aún no hay contactos. Por ejemplo: el fontanero o la vecina que tiene llave.
              </p>
            )}
            <ul className="space-y-2">
              {all.map((c) => (
                <li key={c.id}>
                  <ContactRow contact={c} />
                </li>
              ))}
            </ul>
            <Link to="/contactos/nuevo" className={`${buttonPrimary} mt-4`}>
              <span aria-hidden="true" className="text-2xl leading-none">
                +
              </span>
              Añadir un contacto
            </Link>
          </>
        )}
      </section>
    </>
  );
}

/** Nombre y teléfono, con un botón «Llamar» bien grande. */
function PhoneRow({
  name,
  detail,
  phone,
  editTo,
}: {
  name: string;
  detail?: string;
  phone: string;
  editTo?: string;
}) {
  return (
    <Card className="flex items-center gap-3 py-3!">
      <div className="min-w-0 flex-1">
        {editTo ? (
          <Link to={editTo} className="block text-xl font-bold underline-offset-4 active:underline">
            {name}
          </Link>
        ) : (
          <p className="text-xl font-bold">{name}</p>
        )}
        {detail && <p className="text-base text-muted">{detail}</p>}
        <p className="text-lg font-semibold tabular-nums">{phone}</p>
      </div>
      <a
        href={telHref(phone)}
        aria-label={`Llamar a ${name}`}
        className={`${buttonSecondary} w-auto! shrink-0 px-4`}
      >
        <span aria-hidden="true">📞</span> Llamar
      </a>
    </Card>
  );
}

function ContactRow({ contact }: { contact: Contact }) {
  return (
    <PhoneRow
      name={contact.name}
      detail={[contact.role, contact.note].filter(Boolean).join(" · ") || undefined}
      phone={contact.phone}
      editTo={`/contactos/${contact.id}`}
    />
  );
}
