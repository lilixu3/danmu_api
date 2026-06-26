import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/appStore";
import { Header } from "@/components/layout/Header";
import { NavTabs } from "@/components/layout/NavTabs";
import { Footer } from "@/components/layout/Footer";
import { PreviewSection } from "@/sections/PreviewSection";
import { LogsSection } from "@/sections/LogsSection";
import { ApiTestSection } from "@/sections/ApiTestSection";
import { PushDanmuSection } from "@/sections/PushDanmuSection";
import { RequestRecordsSection } from "@/sections/RequestRecordsSection";
import { SystemSettingsSection } from "@/sections/SystemSettingsSection";
import { useApiConfig } from "@/hooks/useApiConfig";
import { API_TOKEN, parseTokenFromPath } from "@/lib/api";
import { PROTECTED_TABS, type TabId } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Lock } from "lucide-react";

const SECTIONS: Record<TabId, React.FC> = {
  preview: PreviewSection,
  logs: LogsSection,
  api: ApiTestSection,
  push: PushDanmuSection,
  "request-records": RequestRecordsSection,
  env: SystemSettingsSection,
};

export default function App() {
  const currentTab = useAppStore((s) => s.currentTab);
  const setCurrentTab = useAppStore((s) => s.setCurrentTab);
  const setAdminToken = useAppStore((s) => s.setAdminToken);
  const { data: config } = useApiConfig();
  const [hasToken, setHasToken] = useState(!!API_TOKEN);

  useEffect(() => {
    if (config?.originalEnvVars?.ADMIN_TOKEN) {
      setAdminToken(config.originalEnvVars.ADMIN_TOKEN);
    }
  }, [config, setAdminToken]);

  useEffect(() => {
    if (!API_TOKEN) {
      const t = parseTokenFromPath();
      if (t) {
        useAppStore.setState({ token: t });
        setHasToken(true);
      }
    }
  }, []);

  const isProtected = PROTECTED_TABS.includes(currentTab);
  const Section = SECTIONS[currentTab];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <Header />
        <NavTabs currentTab={currentTab} onChange={setCurrentTab} />
        <main className="animate-fadeIn py-6">
          {isProtected && !hasToken ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Lock className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-semibold">需要 TOKEN</h3>
                <p className="mt-2 text-muted-foreground">
                  请在 URL 中配置 TOKEN 以访问此功能。
                </p>
              </CardContent>
            </Card>
          ) : (
            <Section />
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}
