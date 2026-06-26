import { useQuery } from "@tanstack/react-query";
import { buildApiUrl, type ApiConfig } from "@/lib/api";

export function useApiConfig() {
  return useQuery<ApiConfig>({
    queryKey: ["config"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/config", true));
      if (!res.ok) throw new Error("无法获取配置");
      return res.json();
    },
    retry: 1,
  });
}
