import { useMemo, useState } from "react";
import { useLogs, useClearLogs, getLogCategory } from "@/hooks/useLogs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { RefreshCw, Trash2 } from "lucide-react";
import { LOG_CATEGORY_ORDER } from "@/lib/constants";
import { cn, escapeHtml } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

export function LogsSection() {
  const { data: logs = [], isLoading, refetch } = useLogs();
  const { mutate: clearLogs, isPending: isClearing } = useClearLogs();
  const [filter, setFilter] = useState<string>("ALL");
  const qc = useQueryClient();

  const categories = useMemo(() => {
    const set = new Set<string>();
    let last = "system";
    logs.forEach((log) => {
      const cat = getLogCategory(log.message);
      if (cat === "_inherit_") {
        set.add(last);
      } else {
        set.add(cat);
        last = cat;
      }
    });
    return [...set].sort((a, b) => {
      const ai = LOG_CATEGORY_ORDER.indexOf(a);
      const bi = LOG_CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }, [logs]);

  const filtered = useMemo(() => {
    if (filter === "ALL") return logs;
    let last = "system";
    return logs.filter((log) => {
      const cat = getLogCategory(log.message);
      const effective = cat === "_inherit_" ? last : cat;
      if (cat !== "_inherit_") last = cat;
      return effective === filter;
    });
  }, [logs, filter]);

  const renderMessage = (message: string) => {
    const prefixMatch = message.match(/^(?:\s*\[[^\]]+\])+/);
    if (!prefixMatch) return <span>{escapeHtml(message)}</span>;
    const prefix = prefixMatch[0];
    const rest = message.slice(prefix.length);
    const colored = prefix.replace(
      /\[([^\]]+)\]/g,
      '<span class="text-yellow-400">[$1]</span>'
    );
    return (
      <span>
        <span dangerouslySetInnerHTML={{ __html: colored }} />
        {escapeHtml(rest)}
      </span>
    );
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "error":
        return "text-red-400";
      case "warn":
        return "text-yellow-400";
      case "success":
        return "text-green-400";
      default:
        return "text-blue-300";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">日志查看</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
            刷新日志
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                清空日志
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认清空日志</AlertDialogTitle>
                <AlertDialogDescription>
                  确定要清空所有日志吗？此操作不可恢复。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    clearLogs(undefined, {
                      onSuccess: () => qc.invalidateQueries({ queryKey: ["logs"] }),
                    })
                  }
                  disabled={isClearing}
                >
                  确认
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">分类筛选</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={filter === "ALL" ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilter("ALL")}
            >
              ALL
            </Badge>
            {categories.map((cat) => (
              <Badge
                key={cat}
                variant={filter === cat ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setFilter(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 bg-slate-950 text-slate-50 dark:bg-black">
        <CardContent className="p-0">
          <ScrollArea className="h-[500px] w-full">
            <div className="space-y-0 p-4 font-mono text-sm">
              {filtered.map((log, idx) => (
                <div
                  key={idx}
                  className={cn("border-b border-slate-800 py-1.5", getTypeColor(log.type))}
                >
                  <span className="opacity-70">[{escapeHtml(log.timestamp)}]</span>{" "}
                  {renderMessage(log.message)}
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="py-8 text-center text-slate-500">暂无日志</div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
