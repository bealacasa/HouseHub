import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { router } from "@/app/router";
import { installFakeSupabase } from "@/test/fakeSupabase";
import { contactInputSchema, telHref } from "./contacts";

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

describe("contactos y emergencias", () => {
  it("el teléfono se limpia y se valida; el enlace llama solo con cifras", () => {
    const base = { name: "Paco", role: "", note: "" };
    const ok = contactInputSchema.safeParse({ ...base, phone: " 600-123-456 " });
    expect(ok.success && ok.data.phone).toBe("600 123 456");
    expect(contactInputSchema.safeParse({ ...base, phone: "+34 600 123 456" }).success).toBe(true);
    expect(contactInputSchema.safeParse({ ...base, phone: "llámame" }).success).toBe(false);
    expect(contactInputSchema.safeParse({ ...base, phone: "12" }).success).toBe(false);
    expect(telHref("+34 600 123 456")).toBe("tel:+34600123456");
  });

  it("el 112 siempre está, aunque los contactos aún no estén activados", async () => {
    installFakeSupabase({
      signedIn: true,
      name: "Ana",
      house: "Casa",
      missingTables: ["house_contacts"],
    });
    renderAt("/contactos");
    const call = await screen.findByRole("link", { name: /Llamar al 112/ });
    expect(call.getAttribute("href")).toBe("tel:112");
    expect(screen.getByRole("link", { name: "Llamar a Guardia Civil" }).getAttribute("href")).toBe(
      "tel:062",
    );
    expect(await screen.findByText(/aún no están activados/)).toBeTruthy();
  });

  it("se añade un contacto y se llama con un toque; se cambia y se borra", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup();
    const memory = renderAt("/contactos/nuevo");
    await user.type(await screen.findByLabelText("Nombre"), "Paco");
    await user.type(screen.getByLabelText(/¿Qué es\?/), "Fontanero");
    await user.type(screen.getByLabelText("Teléfono"), "600-123-456");
    await user.click(screen.getByRole("button", { name: "Añadir contacto" }));

    await vi.waitFor(() => expect(memory.state.location.pathname).toBe("/contactos"));
    expect(fake.tables.house_contacts![0]).toMatchObject({
      name: "Paco",
      role: "Fontanero",
      phone: "600 123 456",
    });
    const call = await screen.findByRole("link", { name: "Llamar a Paco" });
    expect(call.getAttribute("href")).toBe("tel:600123456");

    await user.click(screen.getByRole("link", { name: "Paco" }));
    const name = await screen.findByLabelText("Nombre");
    await user.clear(name);
    await user.type(name, "Paco el fontanero");
    await user.click(screen.getByRole("button", { name: "Guardar cambios" }));
    await vi.waitFor(() =>
      expect(fake.tables.house_contacts![0]).toMatchObject({ name: "Paco el fontanero" }),
    );

    await user.click(await screen.findByRole("link", { name: "Paco el fontanero" }));
    await user.click(await screen.findByRole("button", { name: "Borrar el contacto" }));
    await user.click(await screen.findByRole("button", { name: "Sí, borrar" }));
    await vi.waitFor(() => expect(fake.tables.house_contacts).toHaveLength(0));
  });

  it("sin teléfono válido no se guarda y lo explica", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa" });
    const user = userEvent.setup();
    renderAt("/contactos/nuevo");
    await user.type(await screen.findByLabelText("Nombre"), "Paco");
    await user.type(screen.getByLabelText("Teléfono"), "no sé");
    await user.click(screen.getByRole("button", { name: "Añadir contacto" }));
    expect(await screen.findByText(/solo con números/)).toBeTruthy();
    expect(fake.tables.house_contacts).toHaveLength(0);
  });
});
