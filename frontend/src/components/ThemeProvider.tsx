import { useEffect } from "react";
import { useAppStore } from "@/stores/appStore";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme);

  useEffect(() => {
    const root = window.document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = theme === "dark" || (theme === "system" && systemDark);
    root.classList.toggle("dark", isDark);
  }, [theme]);

  return <>{children}</>;
}
