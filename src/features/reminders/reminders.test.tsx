import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays } from "date-fns";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { router } from "@/app/router";
import { toKey } from "@/features/calendar/stays";
import { installFakeSupabase } from "@/test/fakeSupabase";
import { dueLabel, sortReminders, type Reminder } from "./reminders";

function renderAt(path: string) {
  localStorage.setItem("househub:passkey-asked", "1");
  const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={memory} />
    </QueryClientProvider>,
  );
  return memory;
}

describe("mis recordatorios", () => {
  it("dicen con palabras para cuándo son", () => {
    const today = "2026-10-30";
    expect(dueLabel(null, today)).toBeNull();
    expect(dueLabel("2026-10-30", today)).toBe("Hoy");
    expect(dueLabel("2026-10-31", today)).toBe("Mañana");
    expect(dueLabel("2026-10-29", today)).toBe("Era para ayer");
    expect(dueLabel("2026-10-20", today)).toBe("Era para el mar 20 oct");
    expect(dueLabel("2026-11-06", today)).toBe("vie 6 nov");
  });

  it("primero los de fecha más cercana; los sin fecha y los hechos, al final", () => {
    const r = (id: string, due: string | null, done = false): Reminder => ({
      id,
      text: id,
      due,
      done,
      createdAt: "2026-10-01T00:00:00Z",
    });
    const sorted = sortReminders([
      r("sin", null),
      r("hecho", "2026-10-01", true),
      r("luego", "2026-11-10"),
      r("pasado", "2026-10-20"),
    ]);
    expect(sorted.map((x) => x.id)).toEqual(["pasado", "luego", "sin", "hecho"]);
  });

  it("se añade uno para mañana, se ve con su fecha y se tacha", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup();
    renderAt("/recordatorios");
    expect(await screen.findByText("Solo los ves tú.")).toBeTruthy();
    await user.type(screen.getByLabelText("Nuevo recordatorio"), "Pedir cita de la ITV");
    await user.click(screen.getByRole("radio", { name: "Mañana" }));
    await user.click(screen.getByRole("button", { name: "Añadir recordatorio" }));

    await vi.waitFor(() => expect(fake.tables.personal_reminders).toHaveLength(1));
    expect(fake.tables.personal_reminders![0]).toMatchObject({
      text: "Pedir cita de la ITV",
      due_date: toKey(addDays(new Date(), 1)),
    });
    const box = await screen.findByRole("checkbox", { name: /Pedir cita de la ITV/ });
    expect(screen.getByText("Mañana", { selector: "span" })).toBeTruthy();
    await user.click(box);
    await vi.waitFor(() => expect(fake.tables.personal_reminders![0]!.done_at).not.toBeNull());
  });

  it("sin texto no se guarda y lo explica", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup();
    renderAt("/recordatorios");
    await user.click(await screen.findByRole("button", { name: "Añadir recordatorio" }));
    expect(await screen.findByText("Escribe el recordatorio.")).toBeTruthy();
    expect(fake.tables.personal_reminders).toHaveLength(0);
  });

  it("si falta el SQL en Supabase, avisa con calma", async () => {
    installFakeSupabase({
      signedIn: true,
      name: "Ana",
      house: "Casa",
      missingTables: ["personal_reminders"],
    });
    renderAt("/recordatorios");
    expect(await screen.findByText(/aún no están activados/)).toBeTruthy();
    expect(screen.queryByLabelText("Nuevo recordatorio")).toBeNull();
  });

  it("están en la pestaña Casa", async () => {
    installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    renderAt("/casa");
    expect(await screen.findByRole("link", { name: /Mis recordatorios/ })).toBeTruthy();
  });
});
