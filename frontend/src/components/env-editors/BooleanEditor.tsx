import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import type { EnvEditorProps } from "@/components/env-editors/EnvModal";

export function BooleanEditor({ value, onChange }: EnvEditorProps) {
  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="bool-editor"
        checked={value === "true"}
        onCheckedChange={(checked) => onChange(checked ? "true" : "false")}
      />
      <Label htmlFor="bool-editor">{value === "true" ? "开启" : "关闭"}</Label>
    </div>
  );
}
