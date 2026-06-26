import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { EnvEditorProps } from "@/components/env-editors/EnvModal";

export function CustomMergeRulesEditor({ item, value, onChange }: EnvEditorProps) {
  const [secondary, setSecondary] = useState("");
  const [primary, setPrimary] = useState("");
  const [action, setAction] = useState("->");
  const [route, setRoute] = useState("");
  const [focus, setFocus] = useState<"secondary" | "primary">("secondary");

  const availableSources = item.sources || [];

  const appendSource = (source: string) => {
    if (focus === "secondary") setSecondary((v) => (v ? `${v}@${source}` : `@${source}`));
    else setPrimary((v) => (v ? `${v}@${source}` : `@${source}`));
  };

  const appendRule = () => {
    if (!secondary.trim() || !primary.trim()) return;
    let rule = `${secondary.trim()} ${action} ${primary.trim()}`;
    if (action === "->" && route.trim()) rule += ` | ${route.trim()}`;
    onChange(value ? `${value};${rule}` : rule);
    setSecondary("");
    setPrimary("");
    setRoute("");
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
        <h4 className="mb-3 font-medium">添加合并/屏蔽规则</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>副源实体</Label>
            <Input
              value={secondary}
              onChange={(e) => setSecondary(e.target.value)}
              onFocus={() => setFocus("secondary")}
              placeholder="副源番剧名"
            />
          </div>
          <div>
            <Label>关系</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="->">合并到主源</SelectItem>
                <SelectItem value="×">屏蔽</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>主源实体</Label>
            <Input
              value={primary}
              onChange={(e) => setPrimary(e.target.value)}
              onFocus={() => setFocus("primary")}
              placeholder="主源番剧名"
            />
          </div>
          {action === "->" && (
            <div>
              <Label>路由规则 (可选)</Label>
              <Input
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                placeholder="E01>E01,E25~E35>E25~E35"
              />
            </div>
          )}
        </div>
        <div className="mt-3">
          <Label>快捷追加来源</Label>
          <div className="mt-1 flex flex-wrap gap-2">
            {availableSources.map((s) => (
              <Badge
                key={s}
                variant="outline"
                className="cursor-pointer hover:bg-secondary"
                onClick={() => appendSource(s)}
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
