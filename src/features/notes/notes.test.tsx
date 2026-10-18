import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { router } from "@/app/router";
import { toKey } from "@/features/calendar/stays";
import { eventInputSchema } from "@/features/events/events";
import { installFakeSupabase } from "@/test/fakeSupabase";
import { sortNotes, type Note } from "./notes";

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

describe("notas de la casa", () => {
  it("se añade una nota y se puede tachar", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup();
    renderAt("/notas");
    await user.type(await screen.findByLabelText("Nueva nota"), "Falta aceite");
    await user.click(screen.getByRole("button", { name: "Añadir nota" }));
    expect(fake.tables.house_notes![0]).toMatchObject({ text: "Falta aceite" });

    const box = await screen.findByRole("checkbox", { name: /Falta aceite/ });
    expect(screen.getByText("Lo apuntó Ana")).toBeTruthy();
    await user.click(box);
    await vi.waitFor(() => expect(fake.tables.house_notes![0]!.done_at).not.toBeNull());
  });

  it("las pendientes van antes que las hechas", () => {
    const note = (id: string, done: boolean, createdAt: string): Note => ({
      id,
      text: id,
      done,
      createdBy: null,
      createdAt,
    });
    const sorted = sortNotes([
      note("hecha", true, "2026-10-18"),
      note("vieja", false, "2026-10-01"),
      note("nueva", false, "2026-10-17"),
    ]);
    expect(sorted.map((n) => n.id)).toEqual(["nueva", "vieja", "hecha"]);
  });
});

describe("eventos del pueblo", () => {
  it("valida nombre y que el fin no sea antes del inicio", () => {
    const base = { title: "Fiestas", start: "2026-08-14", end: "2026-08-16", place: "", note: "" };
    expect(eventInputSchema.safeParse(base).success).toBe(true);
    expect(eventInputSchema.safeParse({ ...base, end: "2026-08-13" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...base, start: "" }).success).toBe(false);
    expect(eventInputSchema.safeParse({ ...base, title: " " }).success).toBe(false);
  });

  it("aparecen en el calendario con su tarjeta y en su lista", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const day = toKey(new Date());
    fake.tables.village_events!.push({
      id: "66666666-6666-4666-8666-666666666666",
      title: "Mercado",
      start_date: day,
      end_date: day,
      place: "La plaza",
      note: "",
      created_by: null,
    });
    const memory = renderAt(`/calendario?dia=${day}`);
    expect(await screen.findByRole("link", { name: /Mercado\..*en La plaza/ })).toBeTruthy();
    await memory.navigate("/eventos");
    expect(await screen.findByRole("heading", { name: "Eventos del pueblo" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Mercado/ })).toBeTruthy();
  });
});
