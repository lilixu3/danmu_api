import { Github, MessageCircle, Users } from "lucide-react";

export function Footer() {
  return (
    <footer className="mt-8 rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
      <p className="mb-2">
        一个人人都能部署的基于 js 的弹幕 API 服务器，支持爱优腾芒哔咪人韩巴狐乐西埋帆弹幕直接获取，兼容弹弹Play接口规范。
      </p>
      <p className="mb-3">本项目仅为个人学习爱好开发，代码开源。完全免费，不收取任何费用。</p>
      <div className="flex flex-wrap items-center justify-center gap-4">
        <a
          href="https://t.me/ddjdd_bot"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <MessageCircle className="h-4 w-4" /> TG MSG ROBOT
        </a>
        <a
          href="https://t.me/logvar_danmu_group"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <Users className="h-4 w-4" /> TG GROUP
        </a>
        <a
          href="https://t.me/logvar_danmu_channel"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <MessageCircle className="h-4 w-4" /> TG CHANNEL
        </a>
        <a
          href="https://github.com/huangxd-/danmu_api"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          <Github className="h-4 w-4" /> GitHub Repo
        </a>
      </div>
    </footer>
  );
}
