# 增强直连组件

首版仅在独立 Node / Docker / Termux 部署中启用。Docker 镜像内置组件；默认 `OUTBOUND_MODE=off`。Vercel、Netlify、EdgeOne、Cloudflare Workers、Hugging Face 与 Forward Widget 保留原有请求方式，管理界面显示不支持。VPS 上自己运行的 Docker 或 Node 属于支持范围。

## 启用

Docker 在已有配置中增加：

```dotenv
OUTBOUND_MODE=auto
```

本地 Node / Termux 先安装 Go 1.26 或更新版本，并在项目根目录构建：

```sh
# Termux 安装工具链
pkg install golang

# 本地 Node / Termux 编译当前平台的可执行文件
npm run build:outbound
npm start
```

然后在 `config/.env` 中设置 `OUTBOUND_MODE=auto`。本地增强直连使用 Node 20.19+；Docker 使用项目的 Node 22 镜像。也可以自行编译，并通过 `OUTBOUND_HELPER_PATH` 指定可执行文件的绝对路径。Android/Termux 要使用 Android 版本，Linux Docker 使用 Linux 版本，二者不能直接互换。

要搜索巴哈姆特，仍需在原来的 `SOURCE_ORDER` 中包含 `bahamut`。TMDB 继续使用原来的 `TMDB_API_KEY`。网络开关不改变来源列表、顺序或缓存设置。

| 变量 | 默认值 | 作用 |
| --- | --- | --- |
| `OUTBOUND_MODE` | `off` | `off` 使用现有请求方式；`auto` 对指定来源启用增强直连 |
| `OUTBOUND_SOURCES` | `bahamut,tmdb` | 逗号分隔，仅支持这两个来源；不加入搜索来源列表 |
| `OUTBOUND_HTTP_VERSION` | `auto` | `auto` 选择 H2/H3；`h2` 固定 TCP/H2；`h3` 强制 QUIC/H3，失败不回退 |
| `OUTBOUND_DOH_URL` | 空 | 自定义 HTTPS DNS wire-format 接口；空值使用内置解析路径 |
| `OUTBOUND_CONNECT_TIMEOUT_MS` | `3000` | 高级配置，单轮连接竞速最长时间，仍受请求剩余时间限制 |
| `OUTBOUND_HELPER_PATH` | 自动定位 | 高级配置，本地组件的绝对路径 |

## 请求策略

代理优先级保持为：专用反代 → 万能反代 → 正向代理 → 增强直连 → 原有直连。选定代理后不会因失败自动换出口；若要让巴哈姆特使用本功能，需要移除与它匹配的代理配置。

仅准确匹配 `api.gamer.com.tw`、`api.tmdb.org` 和 `api.themoviedb.org` 的 HTTPS/443 请求可以使用组件。巴哈姆特要求 TLS 1.3 + ECH，握手必须检查 `ECHAccepted`；TMDB 不要求 ECH，也不会使用 Cloudflare 共享密钥。URL、Host 和证书名称始终使用原始业务域名。重定向由 Node 逐跳处理、重新选路，跨源移除 Authorization/Cookie 等凭据。

自动模式优先复用域名已有连接，记录最近成功的协议。需要连接且 DNS 的 HTTPS RR 声明支持 H3 时，启动 H3 与 H2 握手竞速，另一路延迟约 200 毫秒；只有胜出的连接发送业务请求。未获得 H3 连接的探测会计入失败，连续两次后冷却五分钟，冷却期使用 H2，之后重新尝试探测。巴哈姆特回退到 H2 时仍要求 ECH。

自定义 Cloudflare DoH 与内置解析路径都会在 ECH 拒绝时刷新共享配置并最多重试一次。业务握手的 ECH 被拒绝时，失效业务域名及其完整 HTTPS 别名链的配置缓存，重新查询当前配置，并最多重试一次握手；缺少有效配置或仍被拒绝就失败。不会静默转成普通 SNI。H2 达到对端 stream 并发限制时排队，等待受请求取消和总超时约束。退出复用的连接先让已有响应体读完，取消单个流不会中断其他并发请求。组件不重放已开始发送的业务请求；增强直连 POST 也不会复用原 HTTP 工具层的自动重试。GET 的业务重试、DNS、连接、响应体和退避共享 `options.timeout` / `VOD_REQUEST_TIMEOUT` 的总预算；原有请求方式保留原来的超时行为。

## DNS

A、AAAA 和 HTTPS RR 分别按各自答案 TTL 缓存，TTL=0 不缓存，支持受限的 CNAME 链及 HTTPS AliasMode 链；别名循环或超过六段时失败。连接地址采用 IPv4/IPv6 交错选择和短延迟竞速。不会写死业务 IP、HTTPS hints 或 ECHConfig。

内置路径首先从可达的国内 HTTPS DNS 获取 `cloudflare-ech.com` 的当前公钥配置，再使用带 ECH 的 Cloudflare DoH 查询业务域名；不可达时尝试独立的 Google DoH 和普通 Cloudflare DoH 路径。国内解析器仅作为共享公钥的启动路径，不作为内置业务地址答案来源。目标自身 ECH 配置优先；仅对已验证的巴哈姆特域名允许 Cloudflare 共享配置。所有解析路径都验证 HTTPS 证书。

组件包含解析服务基础设施的启动地址，以解决 DoH 服务自身的解析问题；这些地址与业务 IP 分开维护。自定义 DoH 使用用户指定的解析器查询业务记录及共享公钥；当该解析器本身为 Cloudflare DoH 时，仍需要独立的公钥启动路径。未知自定义解析器的主机名使用系统解析启动，用户应确保该解析器可达。自定义 URL 必须是 HTTPS，不接受 URL 凭据或片段。

内置路径已在开发设备上验证，但网络、CDN 和解析器策略会变化。诊断时应先看管理界面的实际状态及组件日志：就绪仅表示组件已启动，不能保证每个上游都可达。

## 进程与兼容范围

只有 `server.js` 注册 Node 传输能力，共享请求层通过不依赖 Node 子进程的接口调用组件。云函数入口不能通过设置 `OUTBOUND_MODE=auto` 获得该能力；Hugging Face 使用项目现有 `SPACE_ID` 判断予以排除。

组件仅监听随机 loopback 端口，不需要映射额外容器端口。Node 使用每次启动生成的认证 token 与组件通信；Go 同时检查目标白名单。Node 退出关闭 stdin 时组件自动退出，正常退出也发送 SIGTERM。配置文件热更新重建组件并取消正在使用旧组件的请求；组件异常退出显示失败，后续请求可尝试重新启动。

首版在本地 IPC 中完整缓冲响应，支持 JSON、二进制、表单和重复响应头，每个请求体/响应体最多 32 MiB。流式请求体按块读取，在超时、取消或超过大小限制时立即停止；FormData 的 boundary 与 Content-Type 一起保留。适用于这两个来源的元数据和弹幕请求；流媒体、任意域名代理及其他来源不在本版范围内。Go 的 CA 验证始终启用，不沿用关闭 Node 证书验证的配置。

日志只记录上游域名、协议、ECH 接受状态、状态码、错误阶段和耗时，不输出请求 URL 参数、头、Cookie 或认证 token。

## 验证

```sh
npm run test:outbound
cd outbound
go test ./...
go vet ./...
```

可选的实网检查，需要先构建组件，且应在确定的直连网络状态下运行：

```sh
node scripts/check-outbound.js h2 h3 auto
# 单独确认 Go 的 H3 + ECH 握手
cd outbound
DANMU_OUTBOUND_LIVE_TEST=1 go test -run TestLiveH3ECH -v
```

实网脚本不读取本地凭据，TMDB 用未授权请求的 401 响应确认连接。授权后的 TMDB 查询还需另外使用有效 API Key 验证。ECH 轮换、UDP 阻断/冷却、强制 H3、连接复用、请求取消等由确定性测试验证；长期运行中的自然 ECH 轮换仍需持续观察。
