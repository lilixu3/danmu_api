import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useCacheAnimes() {
  return useQuery({
    queryKey: ["cache-animes"],
    queryFn: async () => {
      const res = await apiFetch("/api/cache/animes", {}, true);
      return res.json();
    },
  });
}
