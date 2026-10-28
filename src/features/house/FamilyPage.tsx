import { useState } from "react";
import { Link } from "react-router";
import { Avatar } from "@/components/Avatar";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Card,
  ErrorMessage,
  PageTitle,
  SuccessMessage,
  backLink,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/ui";
import {
  errorMessage,
  inviteLink,
  isPending,
  useAddMember,
  useCreateInvitation,
  useInvitations,
  useRemoveMember,
  useRevokeInvitation,
  useUpdateMember,
  type Member,
  type Role,
} from "./house";
import { AvatarPicker } from "./AvatarPicker";
import { useHouse } from "./HouseGate";

/** La familia: quién está en la casa. Los administradores invitan y gestionan. */
export function FamilyPage() {
  const { house, members, me, isAdmin } = useHouse();
  return (
    <>
      <Link to="/cuenta" className={backLink}>
        ← Familia y ajustes
      </Link>
      <PageTitle title="La familia" subtitle={`Quién está en ${house.name}.`} />
      <div className="space-y-4">
        <Card>
          <ul className="divide-y-2 divide-border">
            {members.map((m) => (
              <MemberRow key={m.id} member={m} isMe={m.id === me.id} canManage={isAdmin} />
            ))}
          </ul>
        </Card>
        {isAdmin && <InviteCard houseId={house.id} members={members} />}
        {isAdmin && <AddWithoutAccount houseId={house.id} />}
        {isAdmin && <InvitationsList members={members} />}
      </div>
    </>
  );
}

const ROLE_LABEL: Record<Role, string> = { admin: "Administra", member: "Miembro" };

function MemberRow({
  member,
  isMe,
  canManage,
}: {
  member: Member;
  isMe: boolean;
  canManage: boolean;
}) {
  const { members } = useHouse();
  const [editing, setEditing] = useState(false);
  return (
    <li className="py-4">
      <div className="flex items-center gap-3">
        <Avatar member={member} members={members} />
        <span className="min-w-0 flex-1">
          <span className="block text-xl font-bold">
            {member.displayName}
            {isMe && <span className="font-normal text-muted"> (tú)</span>}
          </span>
          <span className="block text-lg text-muted">
            {ROLE_LABEL[member.role]}
            {member.userId === null && " · sin cuenta"}
          </span>
        </span>
        {canManage && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-12 rounded-xl border-2 border-border px-4 text-lg font-semibold"
          >
            Cambiar
          </button>
        )}
      </div>
      {editing && <EditMember member={member} isMe={isMe} onDone={() => setEditing(false)} />}
    </li>
  );
}

function EditMember({
  member,
  isMe,
  onDone,
}: {
  member: Member;
  isMe: boolean;
  onDone: () => void;
}) {
  const [name, setName] = useState(member.displayName);
  const [role, setRole] = useState<Role>(member.role);
  const update = useUpdateMember();
  const remove = useRemoveMember();
  const [dialog, confirm] = useConfirm();
  const { house, members } = useHouse();
  const error = update.error ?? remove.error;

  async function onRemove() {
    const ok = await confirm({
      title: `¿Quitar a ${member.displayName} de la casa?`,
      message: "Dejará de ver la casa. Podrás volver a invitarle cuando quieras.",
      confirmLabel: "Sí, quitar",
    });
    if (ok) remove.mutate(member.id, { onSuccess: onDone });
  }

  return (
    <form
      noValidate
      className="mt-4 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({ id: member.id, displayName: name, role }, { onSuccess: onDone });
      }}
    >
      <AvatarPicker houseId={house.id} member={member} members={members} />
      <label htmlFor={`name-${member.id}`} className="block text-lg font-semibold">
        Nombre
      </label>
      <input
        id={`name-${member.id}`}
        maxLength={60}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
      />
      <fieldset>
        <legend className="text-lg font-semibold">Qué puede hacer</legend>
        <div className="mt-2 grid gap-2">
          {(["member", "admin"] as const).map((r) => (
            <label
              key={r}
              className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border px-4 text-lg has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input
                type="radio"
                name={`role-${member.id}`}
                checked={role === r}
                onChange={() => setRole(r)}
                className="size-6"
              />
              {r === "admin" ? "Administra (invita y cambia la casa)" : "Miembro (usa la app)"}
            </label>
          ))}
        </div>
      </fieldset>
      {error && <ErrorMessage>{errorMessage(error)}</ErrorMessage>}
      <button type="submit" disabled={update.isPending} className={buttonPrimary}>
        Guardar
      </button>
      <button type="button" onClick={onDone} className={buttonSecondary}>
        Cancelar
      </button>
      {!isMe && (
        <button
          type="button"
          onClick={() => void onRemove()}
          className="min-h-12 w-full text-lg font-semibold text-danger underline"
        >
          Quitar de la casa
        </button>
      )}
      {dialog}
    </form>
  );
}

/** Crear una invitación y compartirla por WhatsApp (o copiarla). */
function InviteCard({ members }: { houseId: string; members: Member[] }) {
  const create = useCreateInvitation();
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [role, setRole] = useState<Role>("member");
  const [memberId, setMemberId] = useState("");
  const withoutAccount = members.filter((m) => m.userId === null);

  const text = (url: string) =>
    `Te invito a nuestra casa en House Hub. Toca este enlace para entrar (vale 3 días y solo una vez): ${url}`;

  async function share(url: string) {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Invitación a House Hub", text: text(url) });
        return;
      }
      await navigator.clipboard.writeText(text(url));
      setCopied(true);
    } catch {
      // Si se cierra el menú de compartir no pasa nada.
    }
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold">Invitar a alguien</h2>
      <p className="mt-2 text-lg">
        Se crea un enlace para mandar por WhatsApp. Vale <strong>3 días</strong> y para{" "}
        <strong>una sola persona</strong>.
      </p>
      {link ? (
        <div className="mt-4 space-y-3">
          <SuccessMessage>Invitación creada.</SuccessMessage>
          <button type="button" onClick={() => void share(link)} className={buttonPrimary}>
            Enviar por WhatsApp…
          </button>
          <a
            href={`https://wa.me/?text=${encodeURIComponent(text(link))}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonSecondary}
          >
            Abrir WhatsApp
          </a>
          {copied && <SuccessMessage>Copiada: pégala en WhatsApp.</SuccessMessage>}
          <p className="text-muted">
            Por seguridad, el enlace solo se muestra ahora. Si lo pierdes, crea otro.
          </p>
          <button
            type="button"
            onClick={() => {
              setLink(null);
              setCopied(false);
            }}
            className="min-h-12 w-full text-lg font-semibold text-accent underline"
          >
            Crear otra invitación
          </button>
        </div>
      ) : (
        <form
          noValidate
          className="mt-4 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(
              { role, memberId: memberId || null },
              { onSuccess: (token) => setLink(inviteLink(token)) },
            );
          }}
        >
          {withoutAccount.length > 0 && (
            <div>
              <label htmlFor="invite-member" className="block text-lg font-semibold">
                ¿Es para alguien que ya está en la lista?
              </label>
              <select
                id="invite-member"
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className={`${inputClass} mt-2`}
              >
                <option value="">No, es alguien nuevo</option>
                {withoutAccount.map((m) => (
                  <option key={m.id} value={m.id}>
                    Sí, para {m.displayName}
                  </option>
                ))}
              </select>
            </div>
          )}
          <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-border px-4 text-lg">
            <input
              type="checkbox"
              checked={role === "admin"}
              onChange={(e) => setRole(e.target.checked ? "admin" : "member")}
              className="size-6"
            />
            También podrá administrar
          </label>
          {create.isError && <ErrorMessage>{errorMessage(create.error)}</ErrorMessage>}
          <button type="submit" disabled={create.isPending} className={buttonPrimary}>
            {create.isPending ? "Creando…" : "Crear invitación"}
          </button>
        </form>
      )}
    </Card>
  );
}

/** Familiares que no usan la app (cuentan en gastos y estancias). */
function AddWithoutAccount({ houseId }: { houseId: string }) {
  const [name, setName] = useState("");
  const add = useAddMember(houseId);
  return (
    <Card>
      <form
        noValidate
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate(name, { onSuccess: () => setName("") });
        }}
      >
        <h2 className="text-2xl font-bold">Añadir sin cuenta</h2>
        <p className="text-lg">
          Para quien no usa el móvil (por ejemplo, el abuelo). Contará en los gastos y en el
          calendario. Si un día quiere usar la app, invítale desde arriba.
        </p>
        <label htmlFor="new-member" className="block text-lg font-semibold">
          Nombre
        </label>
        <input
          id="new-member"
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
        {add.isError && <ErrorMessage>{errorMessage(add.error)}</ErrorMessage>}
        <button type="submit" disabled={add.isPending} className={buttonSecondary}>
          Añadir a la familia
        </button>
      </form>
    </Card>
  );
}

function InvitationsList({ members }: { members: Member[] }) {
  const invitations = useInvitations(true);
  const revoke = useRevokeInvitation();
  const pending = (invitations.data ?? []).filter((inv) => isPending(inv));
  if (pending.length === 0) return null;
  const nameOf = (id: string | null) => members.find((m) => m.id === id)?.displayName;
  const until = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Card>
      <h2 className="text-2xl font-bold">Invitaciones sin usar</h2>
      <ul className="mt-3 divide-y-2 divide-border">
        {pending.map((inv) => (
          <li key={inv.id} className="flex items-center gap-3 py-3">
            <span className="flex-1 text-lg">
              {nameOf(inv.memberId) ? `Para ${nameOf(inv.memberId)}` : "Para alguien nuevo"}
              <span className="block text-muted">
                Vale hasta el {until.format(new Date(inv.expiresAt))}
              </span>
            </span>
            <button
              type="button"
              onClick={() => revoke.mutate(inv.id)}
              className="min-h-12 rounded-xl border-2 border-danger px-4 text-lg font-semibold text-danger"
            >
              Anular
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
