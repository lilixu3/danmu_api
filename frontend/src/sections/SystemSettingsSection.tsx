import { useState } from "react";
import { useApiConfig } from "@/hooks/useApiConfig";
import { useEnvMutations } from "@/hooks/useEnvMutations";
import { useDeployment } from "@/hooks/useDeployment";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnvModal } from "@/components/env-editors/EnvModal";
import { LoadingOverlay } from "@/components/shared/LoadingOverlay";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, Rocket, Eraser, Loader2, Lock } from "lucide-react";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "@/lib/constants";
import { apiFetch, type EnvVarItem } from "@/lib/api";
import { escapeHtml } from "@/lib/utils";
import { useAppStore } from "@/stores/appStore";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function SystemSettingsSection() {
  const { data: config } = useApiConfig();
  const adminToken = useAppStore((s) => s.adminToken);
  const [category, setCategory] = useState("api");
  const [editing, setEditing] = useState<EnvVarItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const { setEnv, deleteEnv } = useEnvMutations();
  const { mutate: deploy, isPending: deploying } = useDeployment();
  const qc = useQueryClient();

  if (!adminToken) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Lock className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">需要管理员权限</h3>
          <p className="mt-2 text-muted-foreground">
            请在 URL 中使用 ADMIN_TOKEN 访问此功能。
          </p>
        </CardContent>
      </Card>
    );
  }

  const categorized = config?.categorizedEnvVars || {};
  const items = categorized[category] || [];

  const handleEdit = (item: EnvVarItem) => {
    setEditing(item);
    setModalOpen(true);
  };

  const handleSave = (key: string, value: string) => {
    setEnv.mutate(
      { key, value },
      {
        onSuccess: () => {
          setModalOpen(false);
          toast.success("保存成功");
        },
        onError: (err) => toast.error(err.message),
      }
    );
  };

  const handleDelete = (key: string) => {
    deleteEnv.mutate(key, {
      onSuccess: () => toast.success("删除成功"),
      onError: (err) => toast.error(err.message),
    });
  };

  const handleClearCache = async () => {
    try {
      const res = await apiFetch("/api/cache/clear", { method: "POST" }, true);
      const data = await res.json();
      if (data.success) {
        toast.success("缓存已清理");
        qc.invalidateQueries({ queryKey: ["config"] });
      } else {
        toast.error(data.message || "清理失败");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "清理失败");
    }
  };

  const handleDeploy = () => {
    deploy(undefined, {
      onSuccess: () => toast.success("部署指令已发送"),
      onError: (err) => toast.error(err.message),
    });
  };

  return (
    <>
      <LoadingOverlay open={deploying} title="正在部署" detail="请稍候..." />
      <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">环境变量配置</h2>
          <p className="text-sm text-muted-foreground">
            修改后 Node/Docker 立即生效，云平台需重新部署
          </p>
        </div>
        <div className="flex gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Eraser className="mr-2 h-4 w-4" /> 清理缓存
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认清理缓存</AlertDialogTitle>
                <AlertDialogDescription>
                  将清除搜索缓存、弹幕缓存、请求记录等，确定继续？
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleClearCache}>确认</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="default">
                <Rocket className="mr-2 h-4 w-4" /> 重新部署
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>确认重新部署</AlertDialogTitle>
                <AlertDialogDescription>
                  部署期间服务将短暂不可用，预计 30-90 秒。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeploy} disabled={deploying}>
                  {deploying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  确认
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs value={category} onValueChange={setCategory}>
        <TabsList className="flex w-full flex-wrap h-auto">
          {CATEGORY_ORDER.map((cat) => (
            <TabsTrigger key={cat} value={cat} className="flex-1">
              {CATEGORY_LABELS[cat]}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={category} className="mt-4">
          <div className="grid gap-3">
            {items.map((item) => (
              <Card key={item.key}>
                <CardContent className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-semibold text-primary">{item.key}</span>
                      <Badge variant="outline">{item.type}</Badge>
                    </div>
                    <div className="break-all rounded bg-muted px-2 py-1 font-mono text-sm">
                      <span dangerouslySetInnerHTML={{ __html: escapeHtml(String(item.value || "")) }} />
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2 sm:ml-4">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(item)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认删除</AlertDialogTitle>
                          <AlertDialogDescription>
                            确定删除 {item.key} 吗？
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(item.key)}>
                            删除
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
            {items.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  该分类下暂无配置项
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <EnvModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={editing}
        category={category}
        onSave={handleSave}
      />
      </div>
    </>
  );
}
