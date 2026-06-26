import { useState, useEffect } from "react";
import { useApiConfig } from "@/hooks/useApiConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { AnimeGrid } from "@/components/shared/AnimeGrid";
import { buildApiUrl, type DanmuAnime, type DanmuBangumi, type DanmuEpisode } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Send, Search } from "lucide-react";

export function PushDanmuSection() {
  const { data: config } = useApiConfig();
  const [pushUrl, setPushUrl] = useState("");
  const [keyword, setKeyword] = useState("");
  const [animes, setAnimes] = useState<DanmuAnime[]>([]);
  const [bangumi, setBangumi] = useState<DanmuBangumi | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (config?.originalEnvVars?.DANMU_PUSH_URL && !pushUrl) {
      setPushUrl(config.originalEnvVars.DANMU_PUSH_URL);
    }
  }, [config, pushUrl]);

  const search = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
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

  const pushDanmu = async (episode: DanmuEpisode) => {
    if (!pushUrl.trim()) {
      toast.error("请输入推送地址");
      return;
    }
    const commentUrl =
      window.location.origin +
      buildApiUrl(`/api/v2/comment/${episode.episodeId}?format=xml`);
    try {
      await fetch(pushUrl + encodeURIComponent(commentUrl), {
        method: "GET",
        mode: "no-cors",
      });
      toast.success(`弹幕推送成功: ${episode.episodeTitle || `第${episode.episodeNumber}集`}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "推送失败");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div>
            <Label>推送地址</Label>
            <Input
              value={pushUrl}
              onChange={(e) => setPushUrl(e.target.value)}
              placeholder="例如: http://127.0.0.1:9978/action?do=refresh&type=danmaku&path="
            />
            <p className="mt-1 text-xs text-muted-foreground">
              支持 OK 影视等播放器，两端需要在同一局域网或使用公网 IP
            </p>
          </div>
          <div>
            <Label>搜索关键字</Label>
            <div className="flex gap-2">
              <Input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="请输入搜索关键字"
                onKeyDown={(e) => e.key === "Enter" && search()}
              />
              <Button onClick={search} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2 hidden sm:inline">搜索</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {animes.length > 0 && !bangumi && (
        <AnimeGrid animes={animes} onSelect={selectAnime} />
      )}

      {bangumi && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBangumi(null)}
              className="text-sm text-primary hover:underline"
            >
              返回
            </button>
            <h3 className="font-semibold">{bangumi.animeTitle}</h3>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bangumi.episodes?.map((ep) => (
              <Card key={ep.episodeId} className="overflow-hidden">
                <CardContent className="flex items-center justify-between p-3">
                  <div>
                    <div className="font-semibold">第 {ep.episodeNumber} 集</div>
                    <div className="text-sm text-muted-foreground line-clamp-1">{ep.episodeTitle}</div>
                  </div>
                  <Button size="sm" onClick={() => pushDanmu(ep)}>
                    <Send className="mr-1 h-3 w-3" /> 推送
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
