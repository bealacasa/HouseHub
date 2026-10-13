import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Escribe tu nombre.")
  .max(60, "Máximo 60 letras.");

export type Profile = { id: string; displayName: string };

const profileRow = z.object({ id: z.uuid(), display_name: z.string() });

export const profileKey = (userId: string) => ["profile", userId] as const;

/** Perfil del usuario con sesión (nombre que ve la familia). */
export function useProfile(userId: string) {
  return useQuery({
    queryKey: profileKey(userId),
    queryFn: async (): Promise<Profile> => {
      const { data, error } = await getSupabase()
        .from("profiles")
        .select("id, display_name")
        .eq("id", userId)
        .single();
      if (error) throw error;
      const row = profileRow.parse(data);
      return { id: row.id, displayName: row.display_name };
    },
  });
}

export function useSaveName(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rawName: string) => {
      const name = displayNameSchema.parse(rawName);
      const { error } = await getSupabase()
        .from("profiles")
        .update({ display_name: name })
        .eq("id", userId);
      if (error) throw error;
      return name;
    },
    onSuccess: (name) =>
      queryClient.setQueryData<Profile>(profileKey(userId), { id: userId, displayName: name }),
  });
}
