import { Textarea } from "@/components/ui/textarea";
import type { EnvEditorProps } from "@/components/env-editors/EnvModal";

export function TextEditor({ value, onChange }: EnvEditorProps) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={6}
      className="font-mono"
    />
  );
}
