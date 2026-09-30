# 增强直连第一版验证记录（2026-09-30）

分支：`feat/outbound-ech-h3`；基线：远程 `origin/main` 的 `fc1b7ff`。在独立 worktree 开发，原 `danmu_api` 目录未提交内容保留。

## 实网验证

以下结果是在用户明确关闭系统代理之后取得。之前代理状态变化期间的观测不用于判断 Go 握手兼容性。Go TLS 使用默认曲线配置，无跳过证书验证，无普通 SNI 降级。

| 来源 | 模式 | 结果 |
| --- | --- | --- |
| 巴哈姆特 | `h2` | 搜索 HTTP 200、2 个结果；分集有效；弹幕 3001 条；组件每条连接日志 `protocol=h2 ech=true` |
| 巴哈姆特 | `h3` | 搜索 HTTP 200、2 个结果；分集有效；弹幕 3001 条；组件每条连接日志 `protocol=h3 ech=true` |
| 巴哈姆特 | `auto` | 搜索、分集、弹幕成功，本轮选 H3；ECH 已接受 |
| 巴哈姆特实际源适配器 | `auto` | `getEpisodes` 返回有效 video/anime；另一视频的 `getEpisodeDanmu` 返回 2970 条弹幕；H3/ECH 成功 |
| TMDB | `h2`、`h3`、`auto` | `api.tmdb.org/3/configuration` 返回合法 HTTP 401；解析、域名证书验证与协议连接成功，不要求 ECH |

没有发现本地可用的 TMDB API Key，因此尚未验证 TMDB 授权后的业务响应。401 仅作为网络及 API 到达的证据。单次耗时不作为 H2/H3 性能结论。未等待自然 ECH 配置轮换；轮换处理使用确定性测试覆盖，仍需长期观测。

## 自动检查与范围

Node 的 14 项增强直连测试覆盖来源白名单、配置校验、专用/万能/正向代理优先级、同域反代、长 TMDB 域名、云平台/Widget 隔离、缓存/JSON/二进制/重复 Set-Cookie、重定向去凭据、共享超时、请求取消、POST 不重放、流式请求体取消/大小限制及表单 Content-Type/boundary、组件缺失、配置关闭、启动途中关闭、旧 Node 能力限制及 bundle 依赖。

Go 测试覆盖 DNS wire 响应校验、TTL/零 TTL、目标 HTTPS 记录归属、公钥刷新最多一次、不降低 ECH 要求、UDP 不通回到 H2、强制 H3、不重发已发送请求、H3 冷却与恢复、连接池复用和并发、真实 H2 满容量排队/排队取消、退役连接响应体排空、HTTPS 别名追踪/循环、自定义 Cloudflare DoH 配置拒绝刷新、握手取消、本地请求断开取消上游响应体、单请求取消保留共享连接、组件认证与目标白名单。运行 `go vet`。Android/arm64 不支持 Go race detector，因此本机不能执行 `go test -race`。新增 GitHub Actions 检查在 Linux 上执行 race 检测及 Node/Go 回归；这次尚未推送，因此 CI 尚未运行。

隔离服务器启动检查确认 Node 为 `ready`、Hugging Face 为 `unsupported`，均可正常响应配置接口。现有 `danmu_api/worker.test.js` 150 项全部通过。Go 组件已在 Termux 上构建和运行，并交叉编译 Linux/amd64 与 Linux/arm64。`golang:1.27-alpine` 的官方镜像清单包含 Linux/amd64 和 Linux/arm64。当前环境没有 Docker daemon，未实际构建/运行容器镜像；镜像打包仍需要 CI 或 Docker 主机验证。

## 基线已有失败

使用远程 main 相同提交、相同依赖另建干净 worktree 验证：

- `npm run build-forward-widget` 在基线和本分支均出现六个解析错误，涉及 `local-danmu-store.js` 的 Node 内置模块以及 XML 解析器依赖。新增运行时接口单独浏览器 bundle 成功；worker 的 Node bundle 不包含 Go 启动模块或 `node:child_process`。
- `forward/forward-widget.test.js` 依赖红果实网，本分支及基线均因“分片 0–30s 未获取到弹幕”失败。这不是本次功能的离线回归检查。

## 提交前审核

独立审核第一轮发现 1 项 P1 和 4 项 P2，均已修复并加入针对性测试：

1. H2 容量不足曾被误判为连接死亡，可能打断正在运行的请求。现在分开存活、复用和容量判断，使用受取消控制的排队，退役连接等待已有响应体完成。
2. 流式请求体缓冲曾不响应取消且只在读完后检查大小。现在按块读取，及时取消 reader，并在超过 32 MiB 时立即停止。
3. 表单自动生成的 Content-Type 曾丢失。现在同一个 Request 提供序列化字节及头，保留 multipart boundary 与 URL 编码表单类型。
4. HTTPS RR 只处理同一答案内的别名记录，遗漏需要继续查询的目标。现在有界追踪 CNAME/AliasMode，每段独立按 TTL 缓存并检测循环。
5. 自定义 Cloudflare DoH 路径遗漏共享 ECH 刷新。现在与内置路径共用一次有界刷新/重试逻辑，不在该路径降低 ECH 要求。

第二轮复核确认上述五项修复，另发现 ECH 来自 HTTPS 别名时业务拒绝刷新未清理别名目标缓存。已记录查询链并在拒绝时失效整条链，新增 loopback DoH 轮换组合测试，确认两次握手与两次别名查询后恢复。

最终独立复核通过：上述 6 项问题均已关闭。审核者独立运行别名缓存与 ECH 轮换组合测试通过，确认恰好两次别名查询及两次握手；限定范围内无新增具体 findings。审核全程仅使用离线/loopback，不依赖系统代理状态。
