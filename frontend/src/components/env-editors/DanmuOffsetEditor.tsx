import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { EnvEditorProps } from "@/components/env-editors/EnvModal";

export function DanmuOffsetEditor({ item, value, onChange }: EnvEditorProps) {
  const [anime, setAnime] = useState("");
  const [season, setSeason] = useState("");
  const [episode, setEpisode] = useState("");
  const [seconds, setSeconds] = useState("");
  const [percent, setPercent] = useState(false);
  const [sources, setSources] = useState<string[]>([]);

  const availableSources = item.sources || [];

  const appendRule = () => {
    if (!anime.trim() || seconds.trim() === "") return;
    let path = anime.trim();
    if (season.trim()) path += `/S${season.trim().replace(/^S/i, "")}`;
    if (episode.trim()) {
      if (!season.trim()) return alert("填写集时必须同时填写季");
      path += `/E${episode.trim().replace(/^E/i, "")}`;
    }
    if (sources.length) path += `@${sources.join("&")}`;
    if (percent) path += "%";
    path += `:${seconds.trim()}`;
    onChange(value ? `${value},${path}` : path);
    setAnime("");
    setSeason("");
    setEpisode("");
    setSeconds("");
    setSources([]);
  };

  return (
    <div className="space-y-4">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-md border bg-transparent px-3 py-2 font-mono text-sm"
      />
      <div className="rounded-lg border p-4">
        <h4 className="mb-3 font-medium">添加偏移规则</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>剧名</Label>
            <Input value={anime} onChange={(e) => setAnime(e.target.value)} placeholder="剧名" />
          </div>
          <div>
            <Label>季 (如 S01)</Label>
            <Input value={season} onChange={(e) => setSeason(e.target.value)} placeholder="01" />
          </div>
          <div>
            <Label>集 (如 E01)</Label>
            <Input value={episode} onChange={(e) => setEpisode(e.target.value)} placeholder="01" />
          </div>
          <div>
            <Label>偏移秒数</Label>
            <Input
              type="number"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              placeholder="正数延后，负数提前"
            />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Switch id="percent" checked={percent} onCheckedChange={setPercent} />
          <Label htmlFor="percent">百分比模式 (%)</Label>
        </div>
        <div className="mt-3">
          <Label>来源 (可选)</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {availableSources.map((s) => (
              <Badge
                key={s}
                variant={sources.includes(s) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() =>
                  setSources((prev) =>
                    prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
                  )
                }
              >
                {s}
              </Badge>
            ))}
          </div>
        </div>
        <Button className="mt-3" size="sm" onClick={appendRule}>
          添加规则
        </Button>
      </div>
    </div>
  );
}
