import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { processImage } from "@/lib/image";
import { getSupabase } from "@/lib/supabase";
import { houseKey } from "./house";

const BUCKET = "house-photos";
/** Las URLs firmadas caducan pronto: si alguien las reenvía, dejan de valer. */
const SIGNED_URL_SECONDS = 300;

/** URL temporal (5 min) de la foto de la casa, o null si no tiene. */
export function useHousePhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ["house-photo", path],
    enabled: path !== null,
    staleTime: (SIGNED_URL_SECONDS - 60) * 1000,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .storage.from(BUCKET)
        .createSignedUrl(path ?? "", SIGNED_URL_SECONDS);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** Sube una foto nueva (procesada en el móvil) y borra la anterior. */
export function useSetHousePhoto(houseId: string, previous: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File | null) => {
      const supabase = getSupabase();
      let path: string | null = null;
      if (file) {
        const blob = await processImage(file);
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        path = `${houseId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from(BUCKET)
          .upload(path, blob, { contentType: blob.type, upsert: false });
        if (error) throw error;
      }
      const { error } = await supabase
        .from("houses")
        .update({ photo_path: path })
        .eq("id", houseId);
      if (error) throw error;
      if (previous) await supabase.storage.from(BUCKET).remove([previous]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: houseKey }),
  });
}
