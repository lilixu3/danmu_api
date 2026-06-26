import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import { Loader2 } from "lucide-react";
import type { EnvEditorProps } from "@/components/env-editors/EnvModal";

export function BilibiliCookieEditor({ value, onChange }: EnvEditorProps) {
  const [status, setStatus] = useState<{ icon: string; text: string; color: string }>({
    icon: "⚠️",
    text: "未配置",
    color: "text-yellow-600",
  });
  const [qrOpen, setQrOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState("");
  const [qrStatus, setQrStatus] = useState("正在生成二维码...");
  const qrKeyRef = useRef<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = async () => {
    const cookie = value.trim();
    if (!cookie) {
      setStatus({ icon: "⚠️", text: "未配置", color: "text-yellow-600" });
      return;
    }
    setStatus({ icon: "🔍", text: "检测中...", color: "text-blue-600" });
    const isMasked = /^\*+$/.test(cookie);
    try {
      const res = await apiFetch(
        "/api/cookie/verify",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isMasked ? {} : { cookie }),
        },
        true
      );
      const data = await res.json();
      if (data.success && data.data?.isValid) {
        const uname = data.data.uname || "已登录";
        const expiresAt = data.data.expiresAt;
        let left = "";
        if (typeof expiresAt === "number" && expiresAt > Date.now() / 1000) {
          const days = Math.ceil((expiresAt - Date.now() / 1000) / (24 * 60 * 60));
          left = ` (剩余 ${days} 天)`;
        }
        setStatus({
          icon: "✅",
          text: `${uname}${left}${isMasked ? "" : " · 请点击保存按钮"}`,
          color: "text-green-600",
        });
      } else {
        setStatus({
          icon: "❌",
          text: `${data.data?.error || "Cookie 无效或已失效"}`,
          color: "text-red-600",
        });
      }
    } catch {
      setStatus({ icon: "⚠️", text: "检测失败", color: "text-yellow-600" });
    }
  };

  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startQR = async () => {
    setQrOpen(true);
    setQrStatus("正在生成二维码...");
    setQrUrl("");
    if (intervalRef.current) clearInterval(intervalRef.current);
    try {
      const res = await apiFetch("/api/cookie/qr/generate", { method: "POST" }, true);
      const data = await res.json();
      if (data.success && data.data) {
        qrKeyRef.current = data.data.qrcode_key;
        setQrUrl(data.data.url);
        setQrStatus("请使用 Bilibili APP 扫描");
        intervalRef.current = setInterval(async () => {
          try {
            const r = await apiFetch(
              "/api/cookie/qr/check",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ qrcode_key: qrKeyRef.current }),
              },
              true
            );
            const d = await r.json();
            if (!d.success || !d.data) return;
            const code = d.data.code;
            if (code === 86101) setQrStatus("⏳ 等待扫码...");
            else if (code === 86090) setQrStatus("📱 已扫码，请确认");
            else if (code === 86038) {
              setQrStatus("❌ 二维码已过期");
              if (intervalRef.current) clearInterval(intervalRef.current);
            } else if (code === 0) {
              setQrStatus("✅ 登录成功！");
              if (intervalRef.current) clearInterval(intervalRef.current);
              if (d.data.cookie) {
                onChange(d.data.cookie);
                setTimeout(() => {
                  setQrOpen(false);
                  check();
                }, 1000);
              }
            }
          } catch (e) {
            console.error(e);
          }
        }, 2000);
      }
    } catch (err) {
      setQrStatus(err instanceof Error ? err.message : "生成失败");
    }
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="space-y-2">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-md border bg-transparent px-3 py-2 font-mono text-sm"
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={startQR}>
          扫码登录
        </Button>
        <Button size="sm" variant="outline" onClick={check}>
          检测状态
        </Button>
        <span className={status.color}>{status.icon} {status.text}</span>
      </div>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>扫码登录 Bilibili</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center py-4">
            {qrUrl ? (
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`}
                alt="QR"
                className="h-48 w-48"
              />
            ) : (
              <Loader2 className="h-12 w-12 animate-spin" />
            )}
            <p className="mt-4 text-sm text-muted-foreground">{qrStatus}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
