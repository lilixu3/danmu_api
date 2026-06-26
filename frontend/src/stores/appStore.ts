import { create } from "zustand";
import { persist } from "zustand/middleware";
import { API_TOKEN } from "@/lib/api";
import type { TabId } from "@/lib/constants";

interface AppState {
  currentTab: TabId;
  theme: "light" | "dark" | "system";
  token: string;
  adminToken: string;
  reverseProxy: string;
  setCurrentTab: (tab: TabId) => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setAdminToken: (token: string) => void;
  setReverseProxy: (url: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentTab: "preview",
      theme: "system",
      token: API_TOKEN,
      adminToken: "",
      reverseProxy: "",
      setCurrentTab: (tab) => set({ currentTab: tab }),
      setTheme: (theme) => set({ theme }),
      setAdminToken: (adminToken) => set({ adminToken }),
      setReverseProxy: (reverseProxy) => set({ reverseProxy }),
    }),
    {
      name: "danmu-api-ui",
      partialize: (state) => ({
        theme: state.theme,
        reverseProxy: state.reverseProxy,
      }),
    }
  )
);
