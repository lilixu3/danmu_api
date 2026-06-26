import { create } from "zustand";
import type { DanmuComment } from "@/lib/api";

export type DanmuFilter = "all" | "scroll" | "top" | "bottom";

export interface DanmuTestState {
  mode: "auto" | "manual";
  allComments: DanmuComment[];
  filteredComments: DanmuComment[];
  filter: DanmuFilter;
  displayedCount: number;
  pageSize: number;
  currentEpisodeId: number | null;
  currentTitle: string;
  duration: number;
  setMode: (mode: "auto" | "manual") => void;
  setComments: (comments: DanmuComment[], duration: number) => void;
  setFilter: (filter: DanmuFilter) => void;
  loadMore: () => void;
  reset: () => void;
}

export const useDanmuTestStore = create<DanmuTestState>((set) => ({
  mode: "auto",
  allComments: [],
  filteredComments: [],
  filter: "all",
  displayedCount: 0,
  pageSize: 100,
  currentEpisodeId: null,
  currentTitle: "",
  duration: 0,
  setMode: (mode) => set({ mode }),
  setComments: (comments, duration) => {
    const filtered = comments;
    set({
      allComments: comments,
      filteredComments: filtered,
      displayedCount: Math.min(100, filtered.length),
      duration,
    });
  },
  setFilter: (filter) =>
    set((state) => {
      let filtered = state.allComments;
      if (filter !== "all") {
        filtered = state.allComments.filter((c) => {
          const parts = c.p.split(",");
          const mode = parseInt(parts[1] || "1", 10);
          if (filter === "top") return mode === 5;
          if (filter === "bottom") return mode === 4;
          return mode !== 4 && mode !== 5;
        });
      }
      return {
        filter,
        filteredComments: filtered,
        displayedCount: Math.min(state.pageSize, filtered.length),
      };
    }),
  loadMore: () =>
    set((state) => ({
      displayedCount: Math.min(
        state.displayedCount + state.pageSize,
        state.filteredComments.length
      ),
    })),
  reset: () =>
    set({
      allComments: [],
      filteredComments: [],
      filter: "all",
      displayedCount: 0,
      currentEpisodeId: null,
      currentTitle: "",
      duration: 0,
    }),
}));
