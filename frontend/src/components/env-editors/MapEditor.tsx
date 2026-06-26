import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X } from "lucide-react";
import type { EnvEditorProps } from "@/components/env-editors/EnvModal";

export function MapEditor({ value, onChange }: EnvEditorProps) {
  const pairs = value
    ? value.split(";").map((pair) => {
        const [left = "", right = ""] = pair.split("->");
        return { left, right };
      })
    : [];

  const update = (next: { left: string; right: string }[]) => {
    onChange(
      next
        .filter((p) => p.left && p.right)
        .map((p) => `${p.left}->${p.right}`)
        .join(";")
    );
  };

  const setPair = (idx: number, field: "left" | "right", v: string) => {
    const next = [...pairs];
    next[idx] = { ...next[idx], [field]: v };
    update(next);
  };

  const addPair = () => update([...pairs, { left: "", right: "" }]);
  const removePair = (idx: number) => update(pairs.filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      {pairs.map((pair, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            value={pair.left}
            onChange={(e) => setPair(idx, "left", e.target.value)}
            placeholder="键"
          />
          <span className="text-muted-foreground">-&gt;</span>
          <Input
            value={pair.right}
            onChange={(e) => setPair(idx, "right", e.target.value)}
            placeholder="值"
          />
          <Button variant="ghost" size="icon" onClick={() => removePair(idx)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addPair}>
        添加映射
      </Button>
    </div>
  );
}
