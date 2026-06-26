import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import type { EnvEditorProps } from "@/components/env-editors/EnvModal";

export function AiApiKeyEditor({ value, onChange }: EnvEditorProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const verify = async () => {
    setStatus("loading");
    try {
      const isMasked = /^\*+$/.test(value.trim());
      const res = await apiFetch(
        "/api/ai/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isMasked ? {} : { aiApiKey: value }),
        },
        true
      );
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        setMessage(data.message || "连通性测试成功");
        toast.success("AI 服务连通");
      } else {
        setStatus("error");
        setMessage(data.message || "连通性测试失败");
        toast.error("AI 服务连接失败");
      }
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "测试失败");
      toast.error("测试失败");
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-md border bg-transparent px-3 py-2 font-mono text-sm"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={verify} disabled={status === "loading"}>
          {status === "loading" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
          测试连通性
        </Button>
        {status === "success" && (
          <span className="flex items-center text-sm text-green-600">
            <CheckCircle className="mr-1 h-4 w-4" /> {message}
          </span>
        )}
        {status === "error" && (
          <span className="flex items-center text-sm text-red-600">
            <XCircle className="mr-1 h-4 w-4" /> {message}
          </span>
        )}
      </div>
    </div>
  );
}
