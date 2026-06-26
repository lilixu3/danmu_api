import { useApiConfig } from "@/hooks/useApiConfig";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/constants";
import { escapeHtml } from "@/lib/utils";

export function PreviewSection() {
  const { data: config } = useApiConfig();
  const categorized = config?.categorizedEnvVars || {};

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">配置预览</h2>
        <span className="text-sm text-muted-foreground">当前生效的环境变量配置</span>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const items = categorized[category];
        if (!items?.length) return null;
        return (
          <Card key={category}>
            <CardHeader>
              <CardTitle className="text-lg">{CATEGORY_LABELS[category] || category}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="rounded-lg border-l-4 border-primary bg-muted/50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-primary">
                      {item.key}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {item.type}
                    </Badge>
                  </div>
                  <div
                    className="mt-1 break-all font-mono text-sm"
                    dangerouslySetInnerHTML={{
                      __html: escapeHtml(String(item.value || "")),
                    }}
                  />
                  {item.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
