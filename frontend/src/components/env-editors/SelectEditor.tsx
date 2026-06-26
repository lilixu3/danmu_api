import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EnvEditorProps } from "@/components/env-editors/EnvModal";

export function SelectEditor({ item, value, onChange }: EnvEditorProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="请选择" />
      </SelectTrigger>
      <SelectContent>
        {item.options?.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
