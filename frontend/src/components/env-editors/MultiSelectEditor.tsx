import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, GripHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { EnvEditorProps } from "@/components/env-editors/EnvModal";
import { SPECIAL_ENV_KEYS } from "@/lib/constants";

function SortableTag({
  value,
  onRemove,
}: {
  value: string;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: value });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-1 rounded-md border bg-secondary px-2 py-1",
        isDragging && "opacity-50"
      )}
    >
      <span {...attributes} {...listeners} className="cursor-grab">
        <GripHorizontal className="h-3 w-3 text-muted-foreground" />
      </span>
      <span className="text-sm">{value}</span>
      <button onClick={onRemove} className="ml-1 rounded p-0.5 hover:bg-destructive/20">
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function MultiSelectEditor({ item, value, onChange }: EnvEditorProps) {
  const selected = value ? value.split(",").filter(Boolean) : [];
  const available = item.options || [];
  const forceMerge =
    item.key === SPECIAL_ENV_KEYS.MERGE_SOURCE_PAIRS ||
    item.key === SPECIAL_ENV_KEYS.PLATFORM_ORDER;
  const [mergeMode, setMergeMode] = useState(forceMerge);
  const [staging, setStaging] = useState<string[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const setSelected = (next: string[]) => {
    onChange(next.join(","));
  };

  const toggle = (opt: string) => {
    if (mergeMode) {
      if (staging.includes(opt)) {
        setStaging(staging.filter((s) => s !== opt));
      } else {
        setStaging([...staging, opt]);
      }
      return;
    }
    if (selected.includes(opt)) {
      setSelected(selected.filter((s) => s !== opt));
    } else {
      setSelected([...selected, opt]);
    }
  };

  const confirmMerge = () => {
    if (!staging.length) return;
    const merged = staging.join("&");
    setSelected([...selected, merged]);
    setStaging([]);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = selected.indexOf(String(active.id));
      const newIndex = selected.indexOf(String(over.id));
      setSelected(arrayMove(selected, oldIndex, newIndex));
    }
  };

  return (
    <div className="space-y-4">
      {!forceMerge && (
        <div className="flex items-center gap-2">
          <Switch
            id="merge-mode"
            checked={mergeMode}
            onCheckedChange={(v) => {
              setMergeMode(v);
              setStaging([]);
            }}
          />
          <Label htmlFor="merge-mode">合并模式（组合多个来源）</Label>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={selected} strategy={horizontalListSortingStrategy}>
          <div className="flex min-h-[40px] flex-wrap gap-2 rounded-md border bg-background p-2">
            {selected.length === 0 && (
              <span className="text-sm text-muted-foreground">拖拽添加选项</span>
            )}
            {selected.map((s) => (
              <SortableTag
                key={s}
                value={s}
                onRemove={() => setSelected(selected.filter((x) => x !== s))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {mergeMode && (
        <div className="rounded-md border bg-muted/50 p-3">
          <div className="mb-2 text-sm font-medium">暂存区（将组合为 source1&source2）</div>
          <div className="mb-2 flex flex-wrap gap-2">
            {staging.map((s) => (
              <Badge key={s} variant="secondary">
                {s}
              </Badge>
            ))}
          </div>
          <Button size="sm" onClick={confirmMerge} disabled={staging.length < 2}>
            确认组合
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {available.map((opt) => {
          const inSelected = selected.includes(opt);
          const inStaging = staging.includes(opt);
          const disabled = mergeMode ? inStaging || inSelected : inSelected;
          return (
            <Button
              key={opt}
              variant={disabled ? "secondary" : "outline"}
              size="sm"
              onClick={() => toggle(opt)}
              disabled={disabled}
            >
              {opt}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
