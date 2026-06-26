import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch, buildApiUrl } from "@/lib/api";

export interface LogEntry {
  timestamp: string;
  type: string;
  message: string;
}

export function parseLogs(text: string): LogEntry[] {
  return text
    .split("\n")
    .filter((line) => line.trim() !== "")
    .map((line) => {
      const match = line.match(/\[([^\]]+)\]\s+(\w+):\s+(.*)/);
      if (match) {
        return { timestamp: match[1], type: match[2].toLowerCase(), message: match[3] };
      }
      return { timestamp: new Date().toLocaleTimeString(), type: "info", message: line };
    });
}

export function getLogCategory(message: string): string {
  const prefixMatch = message.match(/^(?:\s*\[[^\]]+\])+/);
  if (!prefixMatch) return "_inherit_";
  const tags = prefixMatch[0]
    .match(/\[([^\]]+)\]/g)
    ?.map((t) => t.replace(/[\[\]]/g, "").trim()) || [];

  if (
    tags.some((t) =>
      ["匹配", "落单", "补全", "合集", "略过", "Merge-Check"].some((k) =>
        t.includes(k)
      )
    )
  ) {
    return "merge";
  }

  const validTags = tags.filter(
    (t) =>
      !/^\d{4}-\d{2}-\d{2}[T ]/.test(t) &&
      !/^\d{2}:\d{2}(:\d{2})?$/.test(t) &&
      !t.includes("08:00") &&
      t !== "请求模拟" &&
      t !== "网络请求"
  );

  if (validTags.length === 0) return "_inherit_";

  let category = validTags[0].toLowerCase();
  const normalization: Record<string, string> = {
    "vod fastest mode": "vod",
    "custom source": "custom",
    "bilibili-proxy": "bilibili",
    "tmdb-source": "tmdb",
    "path check": "system",
    "path fix": "system",
    base: "system",
    fongmi: "system",
  };
  return normalization[category] || category;
}

export function useLogs() {
  return useQuery<LogEntry[]>({
    queryKey: ["logs"],
    queryFn: async () => {
      const res = await fetch(buildApiUrl("/api/logs"));
      if (!res.ok) throw new Error("无法获取日志");
      const text = await res.text();
      return parseLogs(text);
    },
  });
}

export function useClearLogs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch("/api/logs/clear", { method: "POST" }, true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["logs"] }),
  });
}
