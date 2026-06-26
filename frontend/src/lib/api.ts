import { useAppStore } from "@/stores/appStore";

export const API_TOKEN =
  (typeof window !== "undefined" && window.__DANMU_API_TOKEN__) || "";

export function parseTokenFromPath(): string {
  if (typeof window === "undefined") return "";
  let path = window.location.pathname;
  const base = useAppStore.getState().reverseProxy;
  if (base) {
    const basePath = base.startsWith("http")
      ? new URL(base).pathname
      : base;
    const cleanBase = basePath.replace(/\/$/, "");
    if (cleanBase && path.startsWith(cleanBase)) {
      path = path.slice(cleanBase.length);
    }
  }
  const parts = path.split("/").filter(Boolean);
  return parts[0] || "";
}

export function buildApiUrl(path: string, isSystemPath = false): string {
  const state = useAppStore.getState();
  let token = state.token;
  if (isSystemPath && state.adminToken) {
    token = state.adminToken;
  }
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const prefix = token ? `/${token}` : "";
  if (state.reverseProxy) {
    return `${state.reverseProxy}${prefix}${cleanPath}`;
  }
  return `${prefix}${cleanPath}`;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
  isSystemPath = false
): Promise<Response> {
  const res = await fetch(buildApiUrl(path, isSystemPath), options);
  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res;
}

export interface EnvVarItem {
  key: string;
  value: string;
  description: string;
  type: "text" | "boolean" | "number" | "select" | "multi-select" | "map";
  min?: number;
  max?: number;
  options?: string[];
  sources?: string[] | null;
}

export interface EnvVarConfig {
  category: string;
  type: EnvVarItem["type"];
  description: string;
  min?: number;
  max?: number;
  options?: string[];
  sources?: string[] | null;
}

export interface ApiConfig {
  message: string;
  version: string;
  envs: Record<string, unknown>;
  categorizedEnvVars: Record<string, EnvVarItem[]>;
  envVarConfig: Record<string, EnvVarConfig>;
  originalEnvVars: Record<string, string>;
  hasAdminToken: boolean;
  repository: string;
  description: string;
  notice: string;
}

export interface RequestRecord {
  interface: string;
  params: Record<string, unknown> | null;
  timestamp: string;
  method: string;
  clientIp: string;
}

export interface DanmuComment {
  p: string;
  m: string;
}

export interface DanmuBangumi {
  animeId: number;
  animeTitle: string;
  episodeCount?: number;
  episodes?: DanmuEpisode[];
}

export interface DanmuEpisode {
  episodeId: number;
  episodeNumber: string;
  episodeTitle: string;
}

export interface DanmuAnime {
  animeId: number;
  animeTitle: string;
  episodeCount: number;
  imageUrl?: string;
}
