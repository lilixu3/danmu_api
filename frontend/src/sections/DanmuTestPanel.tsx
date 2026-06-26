import { useState, useMemo, useRef, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AnimeGrid, EpisodeList } from "@/components/shared/AnimeGrid";
import { useDanmuTestStore, type DanmuFilter } from "@/stores/danmuTestStore";
import { buildApiUrl, type DanmuAnime, type DanmuBangumi, type DanmuComment, type DanmuEpisode } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Search, FileSearch, Download } from "lucide-react";
import { formatDuration, decColorToHex, parseDanmuMode } from "@/lib/utils";

export function DanmuTestPanel() {
  return (
    <Tabs defaultValue="auto" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 sm:w-auto">
        <TabsTrigger value="auto">自动匹配测试</TabsTrigger>
        <TabsTrigger value="manual">手动匹配测试</TabsTrigger>
      </TabsList>
      <TabsContent value="auto">
        <AutoMatchPanel />
      </TabsContent>
      <TabsContent value="manual">
        <ManualMatchPanel />
      </TabsContent>
    </Tabs>
  );
}

function AutoMatchPanel() {
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const store = useDanmuTestStore();

  const handleMatch = async () => {
    if (!fileName.trim()) {
      toast.error("请输入文件名");
      return;
    }
    setLoading(true);
    store.reset();
    store.setMode("auto");
    try {
      const res = await fetch(buildApiUrl("/api/v2/match"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName }),
      });
      const data = await res.json();
      if (!data.success || !data.matches?.length) {
        toast.error("未找到匹配结果");
        return;
      }
      const match = data.matches[0];
      await fetchDanmu(match.episodeId, `${match.animeTitle} 第${match.episodeNumber}集`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "匹配失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm text-muted-foreground">
            模拟播放器自动匹配流程：输入文件名 → 匹配剧集 → 获取弹幕
          </p>
          <div className="flex gap-2">
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="示例: 生万物 S02E08, 无忧渡.S02E08.2160p.WEB-DL"
              onKeyDown={(e) => e.key === "Enter" && handleMatch()}
            />
            <Button onClick={handleMatch} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">开始匹配</span>
            </Button>
          </div>
        </CardContent>
      </Card>
      <DanmuResultArea />
    </div>
  );
}

function ManualMatchPanel() {
  const [keyword, setKeyword] = useState("");
  const [animes, setAnimes] = useState<DanmuAnime[]>([]);
  const [bangumi, setBangumi] = useState<DanmuBangumi | null>(null);
  const [loading, setLoading] = useState(false);
  const store = useDanmuTestStore();

  const search = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    store.reset();
    store.setMode("manual");
    setBangumi(null);
    try {
      const res = await fetch(
        buildApiUrl(`/api/v2/search/anime?keyword=${encodeURIComponent(keyword)}`)
      );
      const data = await res.json();
      if (data.success) setAnimes(data.animes);
      else toast.error("搜索失败");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "搜索失败");
    } finally {
      setLoading(false);
    }
  };

  const selectAnime = async (anime: DanmuAnime) => {
    setLoading(true);
    try {
      const res = await fetch(buildApiUrl(`/api/v2/bangumi/${anime.animeId}`));
      const data = await res.json();
      if (data.success) setBangumi(data.bangumi);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "获取番剧详情失败");
    } finally {
      setLoading(false);
    }
  };

  const selectEpisode = async (episode: DanmuEpisode) => {
    await fetchDanmu(episode.episodeId, episode.episodeTitle);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm text-muted-foreground">
            模拟播放器手动搜索流程：搜索动漫 → 选择番剧 → 选择剧集 → 获取弹幕
          </p>
          <div className="flex gap-2">
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="请输入动漫名称"
              onKeyDown={(e) => e.key === "Enter" && search()}
            />
            <Button onClick={search} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">搜索</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {animes.length > 0 && !bangumi && (
        <AnimeGrid animes={animes} onSelect={selectAnime} />
      )}

      {bangumi && (
        <EpisodeList
          episodes={bangumi.episodes || []}
          title={bangumi.animeTitle}
          onSelect={selectEpisode}
          onBack={() => setBangumi(null)}
        />
      )}

      <DanmuResultArea />
    </div>
  );
}

async function fetchDanmu(episodeId: number, title: string) {
  const store = useDanmuTestStore;
  try {
    const res = await fetch(
      buildApiUrl(`/api/v2/comment/${episodeId}?format=json&duration=true`)
    );
    const data = await res.json();
    if (!data.success) {
      toast.error("获取弹幕失败");
      return;
    }
    const comments: DanmuComment[] = data.comments || [];
    store.setState({
      allComments: comments,
      filteredComments: comments,
      displayedCount: Math.min(100, comments.length),
      currentEpisodeId: episodeId,
      currentTitle: title,
      duration: data.videoDuration || estimateDuration(comments),
    });
    toast.success(`已加载 ${comments.length} 条弹幕`);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "获取弹幕失败");
  }
}

function estimateDuration(comments: DanmuComment[]): number {
  if (!comments.length) return 0;
  const times = comments.map((c) => parseFloat(c.p.split(",")[0])).sort((a, b) => a - b);
  const max = times[times.length - 1];
  const p99 = times[Math.floor(times.length * 0.99)];
  return Math.min(Math.max(p99, times[Math.floor(times.length * 0.95)]), max + 60);
}

function DanmuResultArea() {
  const store = useDanmuTestStore();
  const comments = store.filteredComments;
  const displayed = comments.slice(0, store.displayedCount);

  const stats = useMemo(() => {
    const total = comments.length;
    const top = comments.filter((c) => parseInt(c.p.split(",")[1], 10) === 5).length;
    const bottom = comments.filter((c) => parseInt(c.p.split(",")[1], 10) === 4).length;
    const colored = comments.filter((c) => parseInt(c.p.split(",")[2], 10) !== 16777215).length;
    return { total, top, bottom, colored };
  }, [comments]);

  const heatmap = useMemo(() => {
    if (!store.duration || !comments.length) return [];
    const bucketCount = Math.min(60, Math.max(20, Math.ceil(store.duration / 30)));
    const bucketSize = store.duration / bucketCount;
    const buckets = Array.from({ length: bucketCount }, () => 0);
    comments.forEach((c) => {
      const t = parseFloat(c.p.split(",")[0]);
      const idx = Math.min(Math.floor(t / bucketSize), bucketCount - 1);
      buckets[idx]++;
    });
    const max = Math.max(...buckets, 1);
    return buckets.map((count) => count / max);
  }, [comments, store.duration]);

  const exportDanmu = async (format: "json" | "xml") => {
    if (!store.currentEpisodeId) return;
    try {
      const res = await fetch(
        buildApiUrl(`/api/v2/comment/${store.currentEpisodeId}?format=${format}`)
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `danmu_${store.currentEpisodeId}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error("导出失败");
    }
  };

  if (!store.currentEpisodeId) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-lg">弹幕结果: {store.currentTitle}</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => exportDanmu("json")}>
              <Download className="mr-1 h-3 w-3" /> JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportDanmu("xml")}>
              <Download className="mr-1 h-3 w-3" /> XML
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCard label="弹幕数" value={stats.total} />
          <StatCard label="时长" value={formatDuration(store.duration)} />
          <StatCard label="顶部/底部" value={`${stats.top}/${stats.bottom}`} />
          <StatCard label="彩色占比" value={`${stats.total ? Math.round((stats.colored / stats.total) * 100) : 0}%`} />
        </div>

        {heatmap.length > 0 && <Heatmap bars={heatmap} duration={store.duration} />}

        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
          {(["all", "scroll", "top", "bottom"] as DanmuFilter[]).map((f) => (
            <Badge
              key={f}
              variant={store.filter === f ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => store.setFilter(f)}
            >
              {f === "all" && "全部"}
              {f === "scroll" && "滚动"}
              {f === "top" && "顶部"}
              {f === "bottom" && "底部"}
            </Badge>
          ))}
        </div>

        <ScrollArea className="h-[400px] rounded-lg border">
          <div className="space-y-1 p-3 font-mono text-sm">
            {displayed.map((c, idx) => {
              const parts = c.p.split(",");
              const time = parseFloat(parts[0]);
              const mode = parseInt(parts[1], 10);
              const color = parseInt(parts[2], 10);
              return (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-muted-foreground w-16 shrink-0">{formatDuration(time)}</span>
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: decColorToHex(color) }}
                  />
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {parseDanmuMode(mode)}
                  </Badge>
                  <span className="truncate">{c.m}</span>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {store.displayedCount < comments.length && (
          <Button variant="outline" className="w-full" onClick={() => store.loadMore()}>
            加载更多 ({comments.length - store.displayedCount} 条)
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted p-3 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function Heatmap({ bars, duration }: { bars: number[]; duration: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ index: number; x: number; y: number } | null>(null);

  const handleMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const idx = Math.min(
        bars.length - 1,
        Math.max(0, Math.floor((x / rect.width) * bars.length))
      );
      setTooltip({ index: idx, x: e.clientX, y: e.clientY });
    },
    [bars.length]
  );

  const getColor = (intensity: number) => {
    const hue = 240 - intensity * 240;
    return `hsl(${hue}, 80%, 55%)`;
  };

  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">弹幕密度热力图</div>
      <div
        ref={containerRef}
        className="relative flex h-24 items-end gap-px rounded-lg bg-muted p-2"
        onPointerMove={handleMove}
        onPointerLeave={() => setTooltip(null)}
      >
        {bars.map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all hover:opacity-80"
            style={{
              height: `${Math.max(h * 100, 5)}%`,
              backgroundColor: getColor(h),
            }}
          />
        ))}
      </div>
      {tooltip && (
        <div
          className="fixed z-50 rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow"
          style={{ left: tooltip.x + 8, top: tooltip.y - 28 }}
        >
          {formatDuration((tooltip.index / bars.length) * duration)} -{" "}
          {formatDuration(((tooltip.index + 1) / bars.length) * duration)}
        </div>
      )}
    </div>
  );
}
