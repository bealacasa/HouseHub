import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Link } from "react-router";
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
import { toKey } from "@/features/calendar/stays";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage } from "@/features/house/house";
import {
  CHECKLISTS,
  ChecklistsNotReadyError,
  itemTextSchema,
  loadTicks,
  saveTicks,
  useAddItems,
  useChecklist,
  useFinishRun,
  useLastRun,
  useRemoveItem,
  useSwapItems,
  type ChecklistItem,
  type ChecklistKind,
} from "./checklists";

export const LeaveChecklistPage = () => <ChecklistPage kind="leave" />;

/** Lista para irse: tachar una a una y «Terminado»; o cambiar la lista. */
function ChecklistPage({ kind }: { kind: ChecklistKind }) {
  const info = CHECKLISTS[kind];
  const items = useChecklist(kind);
  const [editing, setEditing] = useState(false);

  const header = (
    <>
      <Link to="/casa" className={backLink}>
        ← Casa
      </Link>
      <PageTitle title={info.title} />
    </>
  );

  if (items.error instanceof ChecklistsNotReadyError) {
    return (
      <>
        {header}
        <Card>
          <h2 className="text-2xl font-bold">Muy pronto</h2>
          <p className="mt-2 text-lg">
            Las listas aún no están activadas. Quien administra la casa tiene que terminar de
            prepararlas.
          </p>
          <Link to="/casa" className={`${buttonSecondary} mt-4`}>
            Volver a Casa
          </Link>
        </Card>
      </>
    );
  }
  if (items.isPending) return header;
  if (items.isError) {
    return (
      <>
        {header}
        <ErrorMessage>No se ha podido cargar la lista.</ErrorMessage>
      </>
    );
  }

  const list = items.data;
  return (
    <>
      {header}
      <LastRun kind={kind} />
      {editing || list.length === 0 ? (
        <EditList kind={kind} items={list} onDone={() => setEditing(false)} />
      ) : (
        <>
          <DoList kind={kind} items={list} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`${buttonSecondary} mt-6`}
          >
            ✏️ Cambiar la lista
          </button>
        </>
      )}
    </>
  );
}

/** «Última vez: Ana cerró la casa el lunes 26 de octubre (7 de 7)». */
function LastRun({ kind }: { kind: ChecklistKind }) {
  const { members } = useHouse();
  const last = useLastRun(kind);
  if (!last.data) return null;
  const who = members.find((m) => m.userId === last.data?.userId)?.displayName ?? "Alguien";
  const when = format(parseISO(last.data.at), "EEEE d 'de' MMMM", { locale: es });
  const complete = last.data.checked === last.data.total;
  return (
    <p className="mb-5 rounded-2xl bg-surface-2 px-4 py-3 text-lg">
      <span className="font-semibold">Última vez:</span> {who} {CHECKLISTS[kind].lastVerb} el {when}{" "}
      <span className={complete ? "text-muted" : "font-semibold text-danger"}>
        ({complete ? "✓ todo" : `${last.data.checked} de ${last.data.total}`})
      </span>
    </p>
  );
}

function DoList({ kind, items }: { kind: ChecklistKind; items: ChecklistItem[] }) {
  const { house } = useHouse();
  const today = toKey(new Date());
  const [ticked, setTicked] = useState<string[]>(() => loadTicks(kind, today));
  const [finished, setFinished] = useState(false);
  const finish = useFinishRun(house.id, kind);
  const [dialog, confirm] = useConfirm();
  const valid = ticked.filter((id) => items.some((i) => i.id === id));
  const missing = items.length - valid.length;

  function toggle(id: string, on: boolean) {
    const next = on ? [...valid, id] : valid.filter((x) => x !== id);
    setTicked(next);
    saveTicks(kind, today, next);
    setFinished(false);
  }

  async function onFinish() {
    if (missing > 0) {
      const ok = await confirm({
        title: missing === 1 ? "Falta 1 cosa por tachar" : `Faltan ${missing} cosas por tachar`,
        message: "¿Terminar igualmente?",
        confirmLabel: "Sí, terminar",
      });
      if (!ok) return;
    }
    finish.mutate(
      { checked: valid.length, total: items.length },
      {
        onSuccess: () => {
          setTicked([]);
          saveTicks(kind, today, []);
          setFinished(true);
        },
      },
    );
  }

  return (
    <>
      <p className="mb-3 text-lg font-semibold text-muted" aria-live="polite">
        {valid.length} de {items.length} hechas
      </p>
      <ol className="space-y-2">
        {items.map((item) => {
          const on = valid.includes(item.id);
          return (
            <li key={item.id}>
              <label
                className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border bg-surface p-4 shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-focus ${
                  on ? "border-accent bg-accent-soft!" : "border-border"
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={(e) => toggle(item.id, e.target.checked)}
                  className="size-8 shrink-0 accent-[var(--accent)]"
                />
                <span className={`text-xl ${on ? "line-through opacity-70" : "font-semibold"}`}>
                  {item.text}
                </span>
              </label>
            </li>
          );
        })}
      </ol>
      {finish.isError && (
        <div className="mt-4">
          <ErrorMessage>{errorMessage(finish.error)}</ErrorMessage>
        </div>
      )}
      {finished ? (
        <div className="mt-6">
          <SuccessMessage>{CHECKLISTS[kind].done} Queda apuntado.</SuccessMessage>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void onFinish()}
          disabled={finish.isPending}
          className={`${buttonPrimary} mt-6`}
        >
          ✓ Terminado
        </button>
      )}
      {dialog}
    </>
  );
}

const small =
  "min-h-12 rounded-xl border-2 border-field px-3 text-lg font-semibold disabled:opacity-40";

function EditList({
  kind,
  items,
  onDone,
}: {
  kind: ChecklistKind;
  items: ChecklistItem[];
  onDone: () => void;
}) {
  const { house } = useHouse();
  const add = useAddItems(house.id, kind);
  const remove = useRemoveItem(kind);
  const swap = useSwapItems(kind);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const last = items.at(-1)?.position ?? 0;
  const busy = add.isPending || remove.isPending || swap.isPending;
  const failure = add.error ?? remove.error ?? swap.error;

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const parsed = itemTextSchema.safeParse(text);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa el texto.");
      return;
    }
    setError(null);
    add.mutate({ texts: [parsed.data], after: last }, { onSuccess: () => setText("") });
  }

  return (
    <>
      {items.length === 0 && (
        <Card className="mb-5 bg-accent-soft!">
          <p className="text-lg">
            La lista está vacía. Empieza con las cosas típicas y luego quita o añade lo que haga
            falta.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => add.mutate({ texts: [...CHECKLISTS[kind].defaults], after: 0 })}
            className={`${buttonPrimary} mt-4`}
          >
            Poner las típicas
          </button>
        </Card>
      )}
      {items.length > 0 && (
        <ol className="space-y-2">
          {items.map((item, i) => (
            <li key={item.id}>
              <Card className="py-3!">
                <p className="text-xl font-semibold">
                  <span className="text-muted">{i + 1}.</span> {item.text}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || i === 0}
                    onClick={() => {
                      const prev = items[i - 1];
                      if (prev) swap.mutate({ a: item, b: prev });
                    }}
                    aria-label={`Subir «${item.text}»`}
                    className={small}
                  >
                    ↑ Subir
                  </button>
                  <button
                    type="button"
                    disabled={busy || i === items.length - 1}
                    onClick={() => {
                      const next = items[i + 1];
                      if (next) swap.mutate({ a: item, b: next });
                    }}
                    aria-label={`Bajar «${item.text}»`}
                    className={small}
                  >
                    ↓ Bajar
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove.mutate(item.id)}
                    aria-label={`Quitar «${item.text}»`}
                    className={`${small} border-danger text-danger`}
                  >
                    Quitar
                  </button>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}
      <Card className="mt-5">
        <form noValidate onSubmit={onAdd} className="space-y-3">
          <label htmlFor={`new-item-${kind}`} className="block text-xl font-semibold">
            Añadir a la lista
          </label>
          <input
            id={`new-item-${kind}`}
            maxLength={150}
            placeholder="Por ejemplo: regar las plantas"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={inputClass}
          />
          {(error || failure) && <ErrorMessage>{error ?? errorMessage(failure)}</ErrorMessage>}
          <button type="submit" disabled={busy} className={buttonSecondary}>
            + Añadir
          </button>
        </form>
      </Card>
      {items.length > 0 && (
        <button type="button" onClick={onDone} className={`${buttonPrimary} mt-6`}>
          Listo, volver a la lista
        </button>
      )}
    </>
  );
}
