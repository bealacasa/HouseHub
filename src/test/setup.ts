import { cleanup, configure } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { setSupabaseForTests } from "@/lib/supabase";

// jsdom no implementa <dialog>.showModal()/close().
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.open = false;
};

// El registro del service worker no existe en jsdom.
vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: () => ({
    needRefresh: [false, vi.fn()],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: vi.fn(),
  }),
}));

// Las pantallas se cargan en diferido: margen para la primera carga.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  setSupabaseForTests(null);
  localStorage.clear();
});
