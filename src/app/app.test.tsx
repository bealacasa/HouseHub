import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";
import { installFakeSupabase } from "@/test/fakeSupabase";
import { router } from "./router";

function renderAt(path: string) {
  const memory = createMemoryRouter(router.routes, { initialEntries: [path] });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={memory} />
    </QueryClientProvider>,
  );
  return memory;
}

describe("acceso a la app", () => {
  it("sin sesión lleva a entrar; con el código entra y pide el nombre", async () => {
    const fake = installFakeSupabase();
    const user = userEvent.setup();
    const memory = renderAt("/");

    await user.type(await screen.findByLabelText("Tu correo electrónico"), "ana@example.com");
    await user.click(screen.getByRole("button", { name: "Enviarme un código" }));
    expect(memory.state.location.pathname).toBe("/acceso");

    await user.type(await screen.findByLabelText("Escribe el código"), "111111");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByRole("alert")).toBeTruthy();

    await user.clear(screen.getByLabelText("Escribe el código"));
    await user.type(screen.getByLabelText("Escribe el código"), "123456");
    await user.click(screen.getByRole("button", { name: "Entrar" }));

    // Entra solo (sin navegar a mano) y el inicio pide el nombre la primera vez.
    await user.type(await screen.findByLabelText("¿Cómo te llamas?"), "Abuela Carmen");
    await user.click(screen.getByRole("button", { name: "Continuar" }));
    await screen.findByText(/Entra más fácil|Vamos a crear la casa/);
    expect(fake.profiles.get(fake.user.id)?.display_name).toBe("Abuela Carmen");
  });

  it("con sesión y nombre, muestra el inicio y las 5 pestañas con texto", async () => {
    installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa del pueblo" });
    localStorage.setItem("househub:passkey-asked", "1");
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Hola, Ana" })).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: "Secciones" });
    expect([...nav.querySelectorAll("a")].map((a) => a.textContent)).toEqual([
      "Inicio",
      "Calendario",
      "Gastos",
      "Casa",
      "Pueblo",
    ]);
    expect(nav.querySelector('[aria-current="page"]')?.textContent).toBe("Inicio");
    expect(screen.getByRole("link", { name: /Ajustes/ }).getAttribute("href")).toBe("/cuenta");
  });

  it("cerrar sesión en todos los dispositivos pide confirmación", async () => {
    const fake = installFakeSupabase({ signedIn: true, name: "Ana", house: "Casa del pueblo" });
    localStorage.setItem("househub:passkey-asked", "1");
    const user = userEvent.setup();
    renderAt("/ajustes");
    await user.click(
      await screen.findByRole("button", { name: "Cerrar sesión en todos mis dispositivos" }),
    );
    expect(fake.auth.signOut).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Sí, cerrar en todos" }));
    expect(fake.auth.signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("la privacidad se puede leer sin entrar", async () => {
    installFakeSupabase();
    renderAt("/privacidad");
    expect(await screen.findByRole("heading", { name: "Privacidad", level: 1 })).toBeTruthy();
  });
});
