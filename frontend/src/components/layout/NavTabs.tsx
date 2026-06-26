import { TABS, type TabId } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface NavTabsProps {
  currentTab: TabId;
  onChange: (tab: TabId) => void;
}

export function NavTabs({ currentTab, onChange }: NavTabsProps) {
  return (
    <nav className="mt-4 flex overflow-x-auto rounded-xl bg-muted p-1 no-scrollbar">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative flex-1 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all",
            currentTab === tab.id
              ? "bg-background text-foreground shadow"
              : "text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground"
          )}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
