import { useRequestRecords } from "@/hooks/useRequestRecords";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function RequestRecordsSection() {
  const { data, isLoading, refetch } = useRequestRecords();
  const records = data?.records || [];
  const todayReqNum = data?.todayReqNum || 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">请求记录</h2>
          <p className="text-sm text-muted-foreground">
            今日请求总数: <span className="font-bold text-primary">{todayReqNum}</span>
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
          刷新记录
        </Button>
      </div>

      <div className="grid gap-3">
        {records.map((record, idx) => (
          <Card key={idx} className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-2 bg-muted/30 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant={record.method === "POST" ? "default" : "secondary"}
                  className="font-mono"
                >
                  {record.method}
                </Badge>
                <code className="rounded bg-muted px-2 py-0.5 text-xs">
                  {decodeURIComponent(record.interface)}
                </code>
              </div>
              <span className="text-xs text-muted-foreground">{record.clientIp}</span>
            </CardHeader>
            <CardContent className="py-3">
              <div className="text-xs text-muted-foreground">
                {new Date(record.timestamp).toLocaleString("zh-CN")}
              </div>
              {record.params && Object.keys(record.params).length > 0 && (
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(record.params, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        ))}
        {records.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              暂无请求记录
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
