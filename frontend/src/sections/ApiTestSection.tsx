import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { JsonViewer } from "@/components/shared/JsonViewer";
import { XmlViewer } from "@/components/shared/XmlViewer";
import { API_ENDPOINTS } from "@/lib/constants";
import { buildApiUrl } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { DanmuTestPanel } from "@/sections/DanmuTestPanel";

export function ApiTestSection() {
  const [selectedId, setSelectedId] = useState<string>("");
  const [params, setParams] = useState<Record<string, string>>({});
  const [body, setBody] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<{ type: "json" | "xml" | "error"; data: unknown } | null>(null);

  const config = API_ENDPOINTS.find((c) => c.id === selectedId);

  const handleParamChange = (name: string, value: string) => {
    setParams((prev) => ({ ...prev, [name]: value }));
  };

  const handleSend = async () => {
    if (!config) return;
    setLoading(true);
    setResponse(null);
    try {
      let path = config.path;
      const query = new URLSearchParams();
      const pathParams: Record<string, string> = {};

      config.params.forEach((p) => {
        const value = params[p.name] || "";
        if (path.includes(`:${p.name}`)) {
          pathParams[p.name] = value;
        } else if (value && !config.hasBody) {
          query.set(p.name, value);
        }
      });

      Object.entries(pathParams).forEach(([k, v]) => {
        path = path.replace(`:${k}`, encodeURIComponent(v));
      });

      const url = `${path}${query.toString() ? `?${query.toString()}` : ""}`;
      const options: RequestInit = { method: config.method };
      let reqBody = body;
      if (config.hasBody) {
        if (config.id === "getSegmentComment" && !body) {
          const bodyObj: Record<string, string> = {};
          config.params.forEach((p) => {
            if (p.name !== "body") bodyObj[p.name] = params[p.name] || "";
          });
          reqBody = JSON.stringify(bodyObj);
        }
        options.headers = { "Content-Type": "application/json" };
        options.body = reqBody;
      }

      const res = await fetch(buildApiUrl(url), options);
      const contentType = res.headers.get("content-type") || "";
      const text = await res.text();
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);

      if (contentType.includes("xml") || text.trim().startsWith("<?xml")) {
        setResponse({ type: "xml", data: text });
      } else {
        try {
          setResponse({ type: "json", data: JSON.parse(text) });
        } catch {
          setResponse({ type: "xml", data: text });
        }
      }
    } catch (err) {
      setResponse({ type: "error", data: err instanceof Error ? err.message : String(err) });
      toast.error("请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tabs defaultValue="debug" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2 sm:w-auto">
        <TabsTrigger value="debug">接口调试</TabsTrigger>
        <TabsTrigger value="danmu-test">弹幕测试</TabsTrigger>
      </TabsList>

      <TabsContent value="debug" className="space-y-4">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div>
              <Label>选择接口</Label>
              <Select value={selectedId} onValueChange={(v) => {
                setSelectedId(v);
                setParams({});
                setBody("");
                setResponse(null);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择接口" />
                </SelectTrigger>
                <SelectContent>
                  {API_ENDPOINTS.map((ep) => (
                    <SelectItem key={ep.id} value={ep.id}>
                      {ep.name} - {ep.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {config && (
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  {config.method} {config.path}
                </div>
                {config.params.map((p) => (
                  <div key={p.name}>
                    <Label>
                      {p.label} {p.required && <span className="text-red-500">*</span>}
                    </Label>
                    {p.type === "select" ? (
                      <Select
                        value={params[p.name] || ""}
                        onValueChange={(v) => handleParamChange(p.name, v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={p.placeholder} />
                        </SelectTrigger>
                        <SelectContent>
                          {p.options?.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={params[p.name] || ""}
                        onChange={(e) => handleParamChange(p.name, e.target.value)}
                        placeholder={p.placeholder}
                      />
                    )}
                  </div>
                ))}

                {config.hasBody && (
                  <div>
                    <Label>请求体 JSON</Label>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={6}
                      placeholder="输入 JSON 请求体"
                    />
                  </div>
                )}

                <Button onClick={handleSend} disabled={loading}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                  发送请求
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {response && (
          <Card>
            <CardContent className="pt-6">
              <h3 className="mb-2 font-semibold">响应结果</h3>
              {response.type === "error" ? (
                <div className="rounded-lg bg-destructive/10 p-4 text-destructive">{String(response.data)}</div>
              ) : response.type === "xml" ? (
                <XmlViewer xml={String(response.data)} />
              ) : (
                <JsonViewer data={response.data} />
              )}
            </CardContent>
          </Card>
        )}
      </TabsContent>

      <TabsContent value="danmu-test">
        <DanmuTestPanel />
      </TabsContent>
    </Tabs>
  );
}
