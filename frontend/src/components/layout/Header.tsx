import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { useApiConfig } from "@/hooks/useApiConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/shared/CopyButton";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { toast } from "sonner";
import { Copy, Globe, AlertTriangle } from "lucide-react";

export function Header() {
  const { data: config, error: configError } = useApiConfig();
  const token = useAppStore((s) => s.token);
  const reverseProxy = useAppStore((s) => s.reverseProxy);
  const setReverseProxy = useAppStore((s) => s.setReverseProxy);
  const [apiEndpoint, setApiEndpoint] = useState<string>("");
  const [latestVersion, setLatestVersion] = useState<string>("加载中...");
  const [showProxyInput, setShowProxyInput] = useState(false);
  const [proxyInput, setProxyInput] = useState(reverseProxy);

  useEffect(() => {
    fetch("https://img.shields.io/docker/v/logvar/danmu-api?sort=semver")
      .then((r) => r.text())
      .then((svg) => {
        const m = svg.match(/version<\/text><text.*?>(v[\d.]+)/);
        if (m) setLatestVersion(m[1]);
      })
      .catch(() => setLatestVersion("未知"));
  }, []);

  useEffect(() => {
    if (!config) return;
    const protocol = window.location.protocol;
    const host = window.location.host;
    const effectiveToken =
      config.originalEnvVars?.TOKEN === "87654321" ? "87654321" : token;
    const base = reverseProxy
      ? reverseProxy.startsWith("http")
        ? reverseProxy
        : `${protocol}//${host}${reverseProxy}`
      : `${protocol}//${host}`;
    setApiEndpoint(`${base.replace(/\/$/, "")}/${effectiveToken || "********"}`);
  }, [config, token, reverseProxy]);

  useEffect(() => {
    setShowProxyInput(!!configError);
  }, [configError]);

  const saveProxy = () => {
    const url = proxyInput.trim().replace(/\/$/, "");
    setReverseProxy(url);
    setShowProxyInput(false);
    toast.success(url ? "API 地址已保存" : "已恢复默认 API 地址");
    window.location.reload();
  };

  return (
    <header className="rounded-2xl bg-gradient-to-r from-blue-700 to-cyan-600 p-6 text-white shadow-lg">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-white shadow">
            <img
              src="https://i.mji.rip/2025/09/27/eedc7b701c0fa5c1f7c175b22f441ad9.jpeg"
              alt="Logo"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <h1 className="text-2xl font-bold">LogVar弹幕API</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30">
                当前版本: v{config?.version || "--"}
              </Badge>
              <Badge className="bg-yellow-400 text-yellow-950 hover:bg-yellow-300">
                最新版本: {latestVersion}
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 opacity-80" />
            <span className="text-sm opacity-90">API端点:</span>
            <code
              className="cursor-pointer rounded bg-white/20 px-2 py-0.5 text-sm font-semibold hover:bg-white/30"
              onClick={() => apiEndpoint && navigator.clipboard.writeText(apiEndpoint)}
              title="点击复制"
            >
              {apiEndpoint || "加载中..."}
            </code>
            {apiEndpoint && (
              <CopyButton text={apiEndpoint}>
                <Copy className="h-4 w-4" />
              </CopyButton>
            )}
            <ThemeToggle />
          </div>
        </div>
      </div>

      {showProxyInput && (
        <div className="mt-4 rounded-xl border border-yellow-300/50 bg-yellow-100/20 p-4 dark:bg-yellow-900/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-200" />
            <div className="flex-1">
              <h3 className="font-semibold">检测到无法获取配置</h3>
              <p className="mt-1 text-sm opacity-90">
                如果您使用了复杂的反向代理，请在此处手动输入完整的反代后链接（不包含 TOKEN）。
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Input
                  value={proxyInput}
                  onChange={(e) => setProxyInput(e.target.value)}
                  placeholder="例如: http://192.168.8.1:2333/danmu_api/"
                  className="border-white/30 bg-white/10 text-white placeholder:text-white/60"
                />
                <Button variant="secondary" onClick={saveProxy}>
                  保存并刷新
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
