import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useConfirm } from "@/components/ConfirmDialog";
import { FormSection, fieldLabel } from "@/components/form";
import {
  ErrorMessage,
  PageTitle,
  backLink,
  buttonDanger,
  buttonPrimary,
  inputClass,
} from "@/components/ui";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage } from "@/features/house/house";
import {
  contactInputSchema,
  useContacts,
  useDeleteContact,
  useSaveContact,
  type Contact,
} from "./contacts";

/** Añadir (/contactos/nuevo) o cambiar (/contactos/:id) un contacto de la casa. */
export function ContactFormPage() {
  const { id } = useParams();
  const contacts = useContacts();
  if (contacts.isPending) return null;
  const contact = id ? (contacts.data ?? []).find((c) => c.id === id) : undefined;
  if (id && !contact) {
    return (
      <>
        <PageTitle title="Contacto no encontrado" />
        <Link to="/contactos" className={buttonPrimary}>
          Volver a los contactos
        </Link>
      </>
    );
  }
  return <ContactForm key={id ?? "nuevo"} contact={contact} />;
}

function ContactForm({ contact }: { contact?: Contact }) {
  const { house } = useHouse();
  const navigate = useNavigate();
  const [dialog, confirm] = useConfirm();
  const [name, setName] = useState(contact?.name ?? "");
  const [role, setRole] = useState(contact?.role ?? "");
  const [phone, setPhone] = useState(contact?.phone ?? "");
  const [note, setNote] = useState(contact?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = useSaveContact(house.id);
  const remove = useDeleteContact();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = { name, role, phone, note };
    const parsed = contactInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    setError(null);
    save.mutate(
      { id: contact?.id, input },
      { onSuccess: () => navigate("/contactos", { replace: true }) },
    );
  }

  async function onDelete() {
    if (!contact) return;
    const ok = await confirm({
      title: "¿Borrar este contacto?",
      message: contact.name,
      confirmLabel: "Sí, borrar",
    });
    if (ok)
      remove.mutate(contact.id, { onSuccess: () => navigate("/contactos", { replace: true }) });
  }

  return (
    <>
      <Link to="/contactos" className={backLink}>
        ← Contactos
      </Link>
      <PageTitle title={contact ? "Cambiar el contacto" : "Nuevo contacto"} />
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        <FormSection>
          <div>
            <label htmlFor="ct-name" className={fieldLabel}>
              Nombre
            </label>
            <input
              id="ct-name"
              maxLength={80}
              autoComplete="off"
              placeholder="Por ejemplo: Paco"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputClass} text-xl font-semibold`}
            />
          </div>
          <div>
            <label htmlFor="ct-role" className={fieldLabel}>
              ¿Qué es? <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id="ct-role"
              maxLength={80}
              placeholder="Por ejemplo: fontanero, vecina con llave…"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="ct-phone" className={fieldLabel}>
              Teléfono
            </label>
            <input
              id="ct-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              maxLength={20}
              placeholder="600 123 456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={`${inputClass} text-xl tabular-nums`}
            />
          </div>
          <div>
            <label htmlFor="ct-note" className={fieldLabel}>
              Nota <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id="ct-note"
              maxLength={200}
              placeholder="Por ejemplo: mejor por la mañana"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={inputClass}
            />
          </div>
        </FormSection>

        {(error || save.error || remove.error) && (
          <ErrorMessage>{error ?? errorMessage(save.error ?? remove.error)}</ErrorMessage>
        )}
        <button type="submit" disabled={save.isPending} className={buttonPrimary}>
          {save.isPending ? "Guardando…" : contact ? "Guardar cambios" : "Añadir contacto"}
        </button>
        {contact && (
          <button type="button" onClick={() => void onDelete()} className={buttonDanger}>
            Borrar el contacto
          </button>
        )}
      </form>
      {dialog}
    </>
  );
}
