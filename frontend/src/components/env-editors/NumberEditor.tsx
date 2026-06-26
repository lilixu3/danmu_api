import { useEffect, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { EnvEditorProps } from "@/components/env-editors/EnvModal";

export function NumberEditor({ item, value, onChange }: EnvEditorProps) {
  const min = item.min ?? 0;
  const max = item.max ?? 100;
  const [num, setNum] = useState(Number(value) || min);

  useEffect(() => {
    setNum(Number(value) || min);
  }, [value, min]);

  const update = (n: number) => {
    const clamped = Math.max(min, Math.min(max, n));
    setNum(clamped);
    onChange(String(clamped));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => update(num - 1)}>
          -
        </Button>
        <Input
          type="number"
          min={min}
          max={max}
          value={num}
          onChange={(e) => update(Number(e.target.value))}
          className="w-24 text-center"
        />
        <Button variant="outline" size="icon" onClick={() => update(num + 1)}>
          +
        </Button>
      </div>
      <Slider
        value={[num]}
        min={min}
        max={max}
        step={1}
        onValueChange={([v]) => update(v)}
      />
    </div>
  );
}
