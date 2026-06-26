import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { X, Plus, Shuffle, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { hslToDecimal, decColorToHex } from "@/lib/utils";
import type { EnvEditorProps } from "@/components/env-editors/EnvModal";

export function ColorPoolEditor({ value, onChange }: EnvEditorProps) {
  const colors = useMemo(() => value.split(",").filter(Boolean), [value]);
  const [hue, setHue] = useState(0);
  const [lightness, setLightness] = useState(50);
  const wheelRef = useRef<HTMLDivElement>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchText, setBatchText] = useState("");

  const preview = hslToDecimal(hue, 100, lightness);

  const parseInput = (input: string): number | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("#")) {
      const hex = trimmed.slice(1);
      if (/^[0-9a-fA-F]{6}$/.test(hex)) return parseInt(hex, 16);
      if (/^[0-9a-fA-F]{3}$/.test(hex)) {
        return parseInt(
          hex
            .split("")
            .map((c) => c + c)
            .join(""),
          16
        );
      }
    }
    const num = parseInt(trimmed, 10);
    if (!isNaN(num)) return num;
    return null;
  };

  const addColor = (color: number) => {
    onChange([...colors, String(color)].join(","));
  };

  const removeColor = (idx: number) => {
    onChange(colors.filter((_, i) => i !== idx).join(","));
  };

  const addRandom = () => {
    addColor(Math.floor(Math.random() * 16777215));
  };

  const reset = () => {
    onChange("16777215");
  };

  const handleWheelPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!wheelRef.current) return;
    const rect = wheelRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const angle = (Math.atan2(y, x) * 180) / Math.PI;
    setHue((angle + 360) % 360);
  };

  const confirmBatch = () => {
    const added: number[] = [];
    batchText.split(/[\n,;]/).forEach((line) => {
      const c = parseInput(line);
      if (c !== null) added.push(c);
    });
    if (added.length) onChange([...colors, ...added.map(String)].join(","));
    setBatchOpen(false);
    setBatchText("");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {colors.map((c, idx) => (
          <div
            key={idx}
            className="group flex items-center gap-1 rounded-md border px-2 py-1"
          >
            <span
              className="h-5 w-5 rounded-full border"
              style={{ backgroundColor: decColorToHex(Number(c)) }}
            />
            <span className="font-mono text-xs">{c}</span>
            <button
              onClick={() => removeColor(idx)}
              className="rounded p-0.5 hover:bg-destructive/20"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <div
          ref={wheelRef}
          className="relative h-32 w-32 shrink-0 cursor-crosshair rounded-full"
          style={{
            background: `conic-gradient(from 90deg, red, yellow, lime, cyan, blue, magenta, red)`,
          }}
          onPointerDown={handleWheelPointer}
          onPointerMove={(e) => e.buttons === 1 && handleWheelPointer(e)}
        >
          <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-background" />
          <div
            className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
            style={{
              left: `${50 + 40 * Math.cos((hue * Math.PI) / 180)}%`,
              top: `${50 + 40 * Math.sin((hue * Math.PI) / 180)}%`,
              backgroundColor: `hsl(${hue}, 100%, ${lightness}%)`,
            }}
          />
        </div>

        <div className="w-full space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">明度</label>
            <Slider
              value={[lightness]}
              min={10}
              max={90}
              step={1}
              onValueChange={([v]) => setLightness(v)}
            />
          </div>
          <div className="flex items-center gap-3">
            <span
              className="h-8 w-8 rounded-full border"
              style={{ backgroundColor: decColorToHex(preview) }}
            />
            <Button size="sm" onClick={() => addColor(preview)}>
              <Plus className="mr-1 h-3 w-3" /> 添加
            </Button>
            <Button size="sm" variant="outline" onClick={addRandom}>
              <Shuffle className="mr-1 h-3 w-3" /> 随机
            </Button>
            <Button size="sm" variant="outline" onClick={() => setBatchOpen(true)}>
              批量添加
            </Button>
            <Button size="sm" variant="ghost" onClick={reset}>
              <RotateCcw className="mr-1 h-3 w-3" /> 重置
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={batchOpen} onOpenChange={setBatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>批量添加颜色</DialogTitle>
          </DialogHeader>
          <textarea
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
            rows={6}
            placeholder="支持 #RRGGBB 或十进制，每行/逗号/分号分隔"
            className="w-full rounded-md border bg-transparent px-3 py-2 font-mono text-sm"
          />
          <Button onClick={confirmBatch}>确认</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
