import { useMutation } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export function useDeployment() {
  return useMutation({
    mutationFn: () => apiFetch("/api/deploy", { method: "POST" }, true),
  });
}
