import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useEnvMutations() {
  const qc = useQueryClient();

  const setEnv = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      let res = await apiFetch(
        "/api/env/set",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value }),
        },
        true
      );
      const result = await res.json();
      if (!result.success) {
        res = await apiFetch(
          "/api/env/add",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value }),
          },
          true
        );
        return res.json();
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["config"] });
    },
  });

  const deleteEnv = useMutation({
    mutationFn: (key: string) =>
      apiFetch(
        "/api/env/del",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key }),
        },
        false
      ),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["config"] }),
  });

  return { setEnv, deleteEnv };
}
