import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { isMissingInDatabase } from "@/lib/dbErrors";
import { getSupabase } from "@/lib/supabase";
import { expectChanged } from "@/lib/write";

/** Contacto de la casa: fontanero, vecina con llave, centro de salud… */
export type Contact = { id: string; name: string; role: string; phone: string; note: string };

/** Teléfonos de emergencia de España (fijos: no hace falta apuntarlos). */
export const EMERGENCY_NUMBERS = [
  { name: "Emergencias", hint: "Ambulancia, bomberos, policía", phone: "112", main: true },
  { name: "Guardia Civil", hint: "En pueblos y carreteras", phone: "062", main: false },
  { name: "Policía Nacional", hint: "En ciudades", phone: "091", main: false },
  {
    name: "Información Toxicológica",
    hint: "Si alguien se intoxica",
    phone: "915 620 420",
    main: false,
  },
] as const;

/** Enlace para llamar: solo cifras y el «+» inicial. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, "")}`;

export const contactInputSchema = z.object({
  name: z.string().trim().min(1, "Escribe el nombre.").max(80, "Máximo 80 letras."),
  role: z.string().trim().max(80, "Máximo 80 letras."),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[-.()]/g, " ").replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .regex(
          /^\+?[0-9 ]{3,20}$/,
          "Escribe el teléfono solo con números (por ejemplo: 600 123 456).",
        ),
    ),
  note: z.string().trim().max(200, "Máximo 200 letras."),
});
export type ContactInput = z.input<typeof contactInputSchema>;

const contactRow = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.string(),
  phone: z.string(),
  note: z.string(),
});

/** Falta ejecutar la migración de contactos: la sección enseña «Muy pronto». */
export class ContactsNotReadyError extends Error {
  constructor() {
    super("Los contactos aún no están activados.");
  }
}
const notReadyOr = (error: unknown) =>
  isMissingInDatabase(error) ? new ContactsNotReadyError() : error;

export const contactsKey = ["contacts"] as const;

export function useContacts() {
  return useQuery({
    queryKey: contactsKey,
    retry: (count, error) => !(error instanceof ContactsNotReadyError) && count < 2,
    queryFn: async (): Promise<Contact[]> => {
      const { data, error } = await getSupabase()
        .from("house_contacts")
        .select("id, name, role, phone, note")
        .order("name");
      if (error) throw notReadyOr(error);
      return (data ?? [])
        .map((raw) => contactRow.parse(raw))
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
    },
  });
}

export function useSaveContact(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ContactInput }) => {
      const c = contactInputSchema.parse(input);
      const row = { name: c.name, role: c.role, phone: c.phone, note: c.note };
      const supabase = getSupabase();
      if (id) {
        const result = await supabase.from("house_contacts").update(row).eq("id", id).select("id");
        if (result.error) throw notReadyOr(result.error);
        expectChanged(result);
        return;
      }
      const { error } = await supabase.from("house_contacts").insert({ house_id: houseId, ...row });
      if (error) throw notReadyOr(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contactsKey }),
  });
}

export function useDeleteContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      expectChanged(await getSupabase().from("house_contacts").delete().eq("id", id).select("id"));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: contactsKey }),
  });
}
