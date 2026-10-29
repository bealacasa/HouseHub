import { useState } from "react";
import { Link } from "react-router";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Card,
  ErrorMessage,
  PageTitle,
  backLink,
  buttonPrimary,
  inputClass,
} from "@/components/ui";
import { PrivacyHint } from "@/components/form";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage } from "@/features/house/house";
import {
  useAddNote,
  useDeleteNotes,
  useNotes,
  useSetImportant,
  useToggleNote,
  type Note,
} from "./notes";

/** Notas de la casa: una lista compartida para tachar («falta aceite», «acordarse de…»). */
export function NotesPage() {
  const { house } = useHouse();
  const notes = useNotes();
  const add = useAddNote(house.id);
  const remove = useDeleteNotes();
  const [text, setText] = useState("");
  const [important, setImportant] = useState(false);
  const [dialog, confirm] = useConfirm();
  const all = notes.data?.items ?? [];
  const canMarkImportant = notes.data?.canMarkImportant ?? false;
  const pending = all.filter((n) => !n.done);
  const done = all.filter((n) => n.done);

  async function clearDone() {
    const ok = await confirm({
      title: "¿Borrar las notas tachadas?",
      message: `Se borrarán ${done.length} ${done.length === 1 ? "nota" : "notas"} ya hechas.`,
      confirmLabel: "Sí, borrarlas",
    });
    if (ok) remove.mutate(done.map((n) => n.id));
  }

  return (
    <>
      <Link to="/casa" className={backLink}>
        ← Casa
      </Link>
      <PageTitle title="Notas de la casa" subtitle="Lo que falta o hay que recordar." />

      <Card className="mb-5">
        <form
          noValidate
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(
              { text, important: canMarkImportant && important },
              {
                onSuccess: () => {
                  setText("");
                  setImportant(false);
                },
              },
            );
          }}
        >
          <label htmlFor="new-note" className="block text-xl font-semibold">
            Nueva nota
          </label>
          <input
            id="new-note"
            maxLength={200}
            placeholder="Por ejemplo: falta aceite"
            aria-describedby="note-hint"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={inputClass}
          />
          <PrivacyHint id="note-hint" />
          {canMarkImportant && (
            <label className="flex min-h-12 cursor-pointer items-center gap-3 text-lg font-semibold">
              <input
                type="checkbox"
                checked={important}
                onChange={(e) => setImportant(e.target.checked)}
                className="size-7 shrink-0 accent-[var(--accent)]"
              />
              <span>
                <span aria-hidden="true">⭐ </span>Es importante{" "}
                <span className="font-normal text-muted">(sale en el inicio)</span>
              </span>
            </label>
          )}
          {add.isError && <ErrorMessage>{errorMessage(add.error)}</ErrorMessage>}
          <button type="submit" disabled={add.isPending} className={buttonPrimary}>
            Añadir nota
          </button>
        </form>
      </Card>

      {notes.isError && <ErrorMessage>No se han podido cargar las notas.</ErrorMessage>}
      {pending.length === 0 && done.length === 0 && notes.isSuccess && (
        <p className="rounded-3xl border-2 border-dashed border-border p-5 text-center text-lg text-muted">
          No hay notas. ¡Todo en orden!
        </p>
      )}
      {pending.length > 0 && (
        <NoteList notes={pending} title="Pendientes" canMarkImportant={canMarkImportant} />
      )}
      {done.length > 0 && (
        <section className="mt-6">
          <NoteList notes={done} title="Hechas" canMarkImportant={false} />
          <button
            type="button"
            onClick={() => void clearDone()}
            className="mt-3 min-h-12 w-full text-lg font-semibold text-danger underline"
          >
            Borrar las tachadas
          </button>
        </section>
      )}
      {dialog}
    </>
  );
}

function NoteList({
  notes,
  title,
  canMarkImportant,
}: {
  notes: Note[];
  title: string;
  canMarkImportant: boolean;
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-xl font-bold">
        {title} <span className="text-muted">({notes.length})</span>
      </h2>
      <ul className="space-y-2">
        {notes.map((n) => (
          <li key={n.id}>
            <NoteRow note={n} canMarkImportant={canMarkImportant} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function NoteRow({ note, canMarkImportant }: { note: Note; canMarkImportant: boolean }) {
  const { members } = useHouse();
  const toggle = useToggleNote();
  const star = useSetImportant();
  const author = members.find((m) => m.userId === note.createdBy)?.displayName;
  const highlighted = note.important && !note.done;
  return (
    <div
      className={`flex min-h-16 items-center gap-2 rounded-2xl border bg-surface p-2 pl-4 shadow-sm ${
        highlighted ? "border-amber-500 bg-amber-50! dark:bg-amber-950/40!" : "border-border"
      } ${note.done ? "opacity-70" : ""}`}
    >
      <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-4 rounded-xl has-focus-visible:ring-3 has-focus-visible:ring-focus">
        <input
          type="checkbox"
          checked={note.done}
          disabled={toggle.isPending}
          onChange={(e) => toggle.mutate({ id: note.id, done: e.target.checked })}
          className="size-8 shrink-0 accent-[var(--accent)]"
        />
        <span className="min-w-0 flex-1">
          <span className={`block text-xl ${note.done ? "line-through" : "font-semibold"}`}>
            {note.text}
          </span>
          {highlighted && (
            <span className="block text-base font-semibold text-amber-900 dark:text-amber-200">
              ⭐ Importante · sale en el inicio
            </span>
          )}
          {author && <span className="block text-base text-muted">Lo apuntó {author}</span>}
        </span>
      </label>
      {canMarkImportant && (
        <button
          type="button"
          aria-pressed={note.important}
          aria-label={
            note.important ? `Quitar importante: ${note.text}` : `Marcar importante: ${note.text}`
          }
          disabled={star.isPending}
          onClick={() => star.mutate({ id: note.id, important: !note.important })}
          className={`grid min-h-12 min-w-12 shrink-0 place-items-center rounded-xl border-2 text-2xl ${
            note.important ? "border-amber-500 bg-amber-100 dark:bg-amber-900" : "border-border"
          }`}
        >
          <span aria-hidden="true">{note.important ? "⭐" : "☆"}</span>
        </button>
      )}
    </div>
  );
}
