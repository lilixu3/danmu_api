> 一个可自托管的弹幕聚合 API 服务：支持多平台弹幕直接获取，兼容弹弹play 的搜索 / 匹配 / 详情 / 弹幕接口规范，并内置 Web UI 后台。
>
> 本仓库为 **lilixu3 的维护分支（fork）**：在上游基础上补了前端管理后台、运行时状态面板、在线更新 / 云端重部署、更多部署适配，以及一系列稳定性修复。

<p align="center">
  <a href="https://github.com/lilixu3/danmu_api"><img src="https://img.shields.io/github/stars/lilixu3/danmu_api?style=flat-square" alt="stars"></a>
  <a href="https://github.com/lilixu3/danmu_api"><img src="https://img.shields.io/github/forks/lilixu3/danmu_api?style=flat-square" alt="forks"></a>
  <a href="https://github.com/lilixu3/danmu_api/blob/main/LICENSE"><img src="https://img.shields.io/github/license/lilixu3/danmu_api?style=flat-square" alt="license"></a>
  <a href="https://hub.docker.com/r/lilixu3/danmu-api"><img src="https://img.shields.io/docker/v/lilixu3/danmu-api?style=flat-square" alt="docker-version"></a>
  <a href="https://hub.docker.com/r/lilixu3/danmu-api"><img src="https://img.shields.io/docker/pulls/lilixu3/danmu-api?style=flat-square" alt="docker-pulls"></a>
</p>

## 特性概览

- 支持多平台弹幕聚合，可直接获取爱优腾芒哔咪人韩巴等来源弹幕。
- 兼容弹弹play 的搜索、匹配、详情、弹幕和分片接口，便于播放器 / 插件直接接入。
- 支持 `json` / `xml` 两种输出格式，可通过查询参数或环境变量切换。
- 支持内存缓存、`.cache` 落盘、Upstash Redis、本地 Redis。
- 内置 Web UI，覆盖服务概览、日志、接口测试、弹幕测试、推送弹幕、访问记录、系统设置。
- 新增运行状态与版本面板，支持秒级刷新、版本检查、Docker 在线更新、云端重部署。
- 支持 Node.js、Docker、Vercel、Netlify、Cloudflare Workers、EdgeOne 等部署方式。

## 快速开始

### 推荐方式：Docker Compose

按下面步骤操作即可直接启动。

#### 第 1 步：准备配置目录和配置文件

在项目根目录执行：

```bash
mkdir -p ./config
cp ./config/.env.example ./config/.env
```

然后编辑 `./config/.env`，至少确认下面这些变量：

```env
TOKEN=***

# 管理员功能不是默认开启的，只有你自己显式设置后才可用
ADMIN_TOKEN=your-admin-token

# 如需在前端使用 Docker 在线更新，建议开启
ENABLE_RUNTIME_CONTROL=true
DOCKER_CONTAINER_NAME=danmu-api
DOCKER_IMAGE_NAME=lilixu3/danmu-api
```

最少要理解这几个值：

- `TOKEN`：普通 API 和普通 UI 访问令牌
- `ADMIN_TOKEN`：管理员 UI 和管理操作令牌，没有默认值，不配置则管理员功能关闭
- `ENABLE_RUNTIME_CONTROL=true`：启用运行状态面板里的 Docker 在线更新能力
- `DOCKER_CONTAINER_NAME=danmu-api`：要和下面 `docker-compose.yml` 里的 `container_name` 保持一致

#### 第 2 步：在项目根目录创建 `docker-compose.yml`

```yaml
services:
  danmu-api:
    image: lilixu3/danmu-api:latest
    container_name: danmu-api
    ports:
      - "9321:9321"
    volumes:
      - ./config:/app/config
      - ./.cache:/app/.cache
      - /var/run/docker.sock:/var/run/docker.sock
    restart: unless-stopped
```

这个模板已经默认包含：

- `./config:/app/config`
  让容器直接读取你本地的 `config/.env`
- `./.cache:/app/.cache`
  让缓存能落盘，减少重复请求和冷启动影响
- `/var/run/docker.sock:/var/run/docker.sock`
  让前端运行状态面板可以读取 Docker 状态，并支持在线更新

如果你不需要前端在线更新，可以删掉：

- `ENABLE_RUNTIME_CONTROL=true`
- `/var/run/docker.sock:/var/run/docker.sock`

#### 第 3 步：启动服务

```bash
docker compose up -d
```

查看状态：

```bash
docker compose ps
docker compose logs -f
```

#### 第 4 步：验证是否启动成功

启动成功后，直接访问：

- API 根地址：`http://{你的服务器IP}:9321`
- 普通 UI：`http://{你的服务器IP}:9321/{TOKEN}`
- 管理员 UI：`http://{你的服务器IP}:9321/{ADMIN_TOKEN}`（仅在你显式配置 `ADMIN_TOKEN` 后可用）

例如你保持 `TOKEN` 默认值、并把 `ADMIN_TOKEN` 设成 `my-admin-token`：

- 普通 UI：`http://{你的服务器IP}:9321/87654321`
- 管理员 UI：`http://{你的服务器IP}:9321/my-admin-token`

也可以直接测试搜索接口：

```bash
curl "http://127.0.0.1:9321/api/v2/search/anime?keyword=生万物"
```

如果 `TOKEN` 仍为默认值 `87654321`，大多数 API 可以直接省略 token 前缀访问。

### 备选方式：docker run

```bash
docker pull lilixu3/danmu-api:latest

docker run -d \
  --name danmu-api \
  -p 9321:9321 \
  -v $(pwd)/config:/app/config \
  -v $(pwd)/.cache:/app/.cache \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -e TOKEN=87654321 \
  -e ADMIN_TOKEN=your-admin-token \
  -e ENABLE_RUNTIME_CONTROL=true \
  -e DOCKER_CONTAINER_NAME=danmu-api \
  -e DOCKER_IMAGE_NAME=lilixu3/danmu-api \
  --restart unless-stopped \
  lilixu3/danmu-api:latest
```

### 本地 Node.js 运行

要求：

- Node.js 18+
- npm

启动：

2. **安装依赖**：
   ```bash
   npm install
   ```

3. **配置应用**（可选）：

   本项目支持两种配置方式，优先级从高到低：
   1. **系统环境变量**（最高优先级）
   2. **.env 文件**（低优先级）- 复制 `config/.env.example` 为 `config/.env` 并修改

4. **启动服务器**：
   ```bash
   npm start
   ```
   服务器将在 `http://{ip}:9321` 运行，默认token是`87654321`。
   如需修改端口，可设置环境变量 `DANMU_API_PORT`（例如 `DANMU_API_PORT=8080 npm start`）。

   **热更新支持**：修改 `config/.env`，应用会自动检测并重新加载配置（无需重启应用）。

   或者使用下面的命令
   ```bash
   # 启动
   node ./danmu_api/server.js
   # 测试
   node --test ./danmu_api/worker.test.js
   # 构建forward弹幕插件
   node build-forward-widget.js
   # 测试forward弹幕插件
   node --test ./forward/forward-widget.test.js
   ```

5. **测试 API**：
   使用 Postman 或 curl 测试：
   - `GET http://{ip}:9321/87654321`
   - `GET http://{ip}:9321/87654321/api/v2/search/anime?keyword=生万物`
   - `POST http://{ip}:9321/87654321/api/v2/match`
   - `GET http://{ip}:9321/87654321/api/v2/search/episodes?anime=生万物`
   - `GET http://{ip}:9321/87654321/api/v2/bangumi/1`
   - `GET http://{ip}:9321/87654321/api/v2/comment/1?format=json`
   - `GET http://{ip}:9321/87654321/api/v2/comment/1?format=json&duration=true`
   - `GET http://{ip}:9321/87654321/api/v2/comment?url=https://v.qq.com/x/cover/xxx.html&format=json`
   - `GET http://{ip}:9321/87654321/api/v2/extcomment?url=https://v.qq.com/x/cover/xxx.html&format=json`
   - `POST http://{ip}:9321/87654321/api/v2/segmentcomment?format=json` (请求体包含segment类JSON数据，示例 `{"type": "qq","segment_start":0,"segment_end":30000,"url":"https://dm.video.qq.com/barrage/segment/j0032ubhl9s/t/v1/0/30000"}` )
   - `GET http://{ip}:9321/87654321/api/logs`
   > 注意：TOKEN为默认87654321的情况下，可不带{TOKEN}请求，如`http://{ip}:9321/api/v2/search/anime?keyword=生万物`

## 使用 Docker 运行
1. **构建 Docker 镜像**：
   ```bash
   docker build -t danmu-api .
   ```

2. **运行容器**：
   ```bash
   docker run -d -p 9321:9321 --name danmu-api -e TOKEN=*** danmu-api
   ```
   - 如果想使用默认值，可把 `TOKEN` 设置为默认值 87654321。
   - 或使用 `--env-file ./config/.env` 加载配置文件里的环境变量：`docker run -d -p 9321:9321 --name danmu-api --env-file ./config/.env danmu-api`

   **热更新支持**：如需支持环境变量热更新（修改 `config/.env` 文件后无需重启容器），请使用 Volume 挂载：
   ```bash
   docker run -d -p 9321:9321 --name danmu-api -v $(pwd)/config:/app/config --env-file ./config/.env danmu-api
   ```

   > **推荐**：使用 docker compose 部署可以更方便地管理配置和支持热更新，详见下方"Docker 一键启动"部分。

3. **测试 API**：
   使用 `http://{ip}:9321/{TOKEN}` 访问上述 API 接口。
   > 注意：TOKEN为默认87654321的情况下，可不带{TOKEN}请求，如`http://{ip}:9321/api/v2/search/anime?keyword=生万物`

## Docker 一键启动 【推荐】
1. **拉取镜像**：
   ```bash
   docker pull lilixu3/danmu-api:latest
   ```

2. **运行容器**：
   ```bash
   docker run -d -p 9321:9321 --name danmu-api -e TOKEN=*** lilixu3/danmu-api:latest
   ```
   - 如果想使用默认值，可把 `TOKEN` 设置为默认值 87654321。
   - 或使用 `--env-file ./config/.env` 加载配置文件里的环境变量：`docker run -d -p 9321:9321 --name danmu-api --env-file ./config/.env lilixu3/danmu-api:latest`

   **热更新支持**：如需支持环境变量热更新（修改 `config/.env` 文件后无需重启容器），请使用 Volume 挂载：
   ```bash
   docker run -d -p 9321:9321 --name danmu-api -v $(pwd)/config:/app/config --env-file ./config/.env lilixu3/danmu-api:latest
   ```

   或使用 docker compose 部署（**推荐，支持环境变量热更新**）：
   ```yaml
   services:
     danmu-api:
       image: lilixu3/danmu-api:latest
       ports:
         - "9321:9321"
       # 热更新支持：挂载 config/.env 文件，修改后容器会自动重新加载配置（无需重启容器）
       volumes:
         - ./config:/app/config    # config目录下需要创建.env
         - ./.cache:/app/.cache    # 配置 .cache 目录，会将缓存实时保存在本地文件
       restart: unless-stopped
   ```

   可以使用 watchtower 监控有新版本自动更新：
   ```yaml
   services:
     watchtower:
       image: nickfedor/watchtower
       container_name: watchtower-gx
       restart: always
       volumes:
         - /var/run/docker.sock:/var/run/docker.sock
       environment:
         - TZ=Asia/Shanghai  # 保持时区正确
       command:
         - --cleanup         # 更新后清理旧镜像
         - --interval        # 间隔参数
         - "12600"           # 30分钟（1800秒），适合测试
         - danmu-api         # 监控的目标容器名
   ```

3. **测试 API**：
   使用 `http://{ip}:9321/{TOKEN}` 访问上述 API 接口。
   > 注意：TOKEN为默认87654321的情况下，可不带{TOKEN}请求，如`http://{ip}:9321/api/v2/search/anime?keyword=生万物`

### 一键安装脚本
`bash <(curl -fsSL https://raw.githubusercontent.com/dukiii1928/danmu-install/refs/heads/main/install.sh)`

## 安卓App
请前往 @lilixu3 的项目 [danmu-api-android](https://github.com/lilixu3/danmu-api-android/releases) 下载

## 部署到 Vercel 【推荐】

### 一键部署
点击以下按钮即可将项目快速部署到 Vercel：

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/lilixu3/danmu_api&project-name=danmu_api&repository-name=danmu_api)

**注意**：默认按钮已指向当前维护分支 `https://github.com/lilixu3/danmu_api`。如果你使用的是自己的 fork，请把它替换成你的实际 Git 仓库地址后再部署。
- **设置环境变量**：部署后，在 Vercel 仪表板中：
  1. 转到你的项目设置。
  2. 在“Environment Variables”部分添加 `TOKEN` 变量，输入你的 API 令牌值。
  3. 保存更改并重新部署。
- 示例请求：`https://{your_domain}.vercel.app/87654321/api/v2/search/anime?keyword=子夜归`
  > 注意：TOKEN为默认87654321的情况下，可不带{TOKEN}请求，如`https://{your_domain}.vercel.app/api/v2/search/anime?keyword=子夜归`

### 优化点
- Settings > Functions > Advanced Setting > Function Region 切换为 新加坡/韩国/日本等，能提高访问速度，体验更优
  > hk有可能访问不了360或其他源，可以尝试切其他region
- vercel在国内被墙，请配合代理或绑定自定义域名使用

## 部署到 Netlify 【推荐】

### 一键部署
点击以下按钮即可将项目快速部署到 Netlify：

<a href="https://app.netlify.com/start/deploy?repository=https://github.com/lilixu3/danmu_api"><img src="https://www.netlify.com/img/deploy/button.svg"></a>

> 默认访问domain：https://{你的部署项目名}.netlify.app
> > 注意：TOKEN为默认87654321的情况下，可不带{TOKEN}请求，如`https://{你的部署项目名}.netlify.app/api/v2/search/anime?keyword=子夜归`

- **设置环境变量**：部署后，在 Netlify 仪表板中：
  1. 点击Project configuration。
  2. 在“Environment variables”部分点击 “Add a variable” 添加 `TOKEN` 变量，输入你的 API 令牌值。
  3. 保存更改并重新部署。

## 部署到 腾讯云 edgeone pages

### 一键部署
[![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://console.cloud.tencent.com/edgeone/pages/new?template=https://github.com/lilixu3/danmu_api&project-name=danmu-api&root-directory=.%2F&env=TOKEN)

> 注意：部署时请在环境变量配置区域填写你的TOKEN值，该变量将用于API服务的身份验证相关功能
> 
> 示例请求：`https://{your_domain}/{TOKEN}/api/v2/search/anime?keyword=子夜归`确认是否部署成功
> > 注意：TOKEN为默认87654321的情况下，可不带{TOKEN}请求，如`https://{your_domain}/api/v2/search/anime?keyword=子夜归`
>
> 部署的时候项目加速区域最好设置为"全球可用区（不含中国大陆）"，不然不绑定自定义域名貌似只能生成3小时的预览链接？[相关文档](https://edgeone.cloud.tencent.com/pages/document/175191784523485184)
> 
> 也可直接用国际站的部署按钮一键部署，默认选择"全球可用区（不含中国大陆）" [![使用 EdgeOne Pages 部署](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?template=https://github.com/lilixu3/danmu_api&project-name=danmu-api&root-directory=.%2F&env=TOKEN)
> 
<img src="https://i.mji.rip/2025/09/17/3a675876dabb92e4ce45c10d543ce66b.png" style="width:400px" />

> 如果每次访问都遇到404等问题，可能是edgeone pages修改了访问策略，每次接口请求都转发到了新的环境，没有缓存，导致获取不到对应的弹幕，推荐用vercel/netlify部署。
> 
> 解决方法：请配置环境变量`UPSTASH_REDIS_REST_URL`和`UPSTASH_REDIS_REST_TOKEN`，开启upstash redis存储

## 部署到 Cloudflare

### 一键部署
点击以下按钮即可将项目快速部署到 Cloudflare：

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/lilixu3/danmu_api)

**注意**：默认按钮已指向当前维护分支 `https://github.com/lilixu3/danmu_api`。如果你使用的是自己的 fork，请把它替换成你的实际 Git 仓库地址后再部署。
- **设置环境变量**：部署后，在 Cloudflare 仪表板中：
  1. 转到你的 Workers 项目。
  2. 转到“Settings” > “Variables”。
  3. 添加 `TOKEN` 环境变量，输入你的 API 令牌值。
  4. 保存并部署。
- 示例请求：`https://{your_domain}.workers.dev/87654321/api/v2/search/anime?keyword=子夜归`
  > 注意：TOKEN为默认87654321的情况下，可不带{TOKEN}请求，如`https://{your_domain}.workers.dev/api/v2/search/anime?keyword=子夜归`

### ~~手动部署~~
~~创建一个worker，将`danmu_api/worker.js`里的代码直接拷贝到你创建的`worker.js`里，然后点击部署。~~

> cf部署可能不稳定，推荐用vercel/netlify部署。

## 部署到 Hugging Face Spaces

### Docker 部署
1. 在 Hugging Face 创建 Space，SDK 选择 **Docker**。
2. 将仓库代码推送到 Space 仓库，或在 Space 中连接/同步你的 Git 仓库。
3. 在 Space Settings > Variables and secrets 中至少添加 `TOKEN` 环境变量。
4. 如果需要在 UI 中保存环境变量并触发重启，额外添加：
   - `DEPLOY_PLATFROM_ACCOUNT`: Hugging Face 用户名或组织名
   - `DEPLOY_PLATFROM_PROJECT`: Space 名称
   - `DEPLOY_PLATFROM_TOKEN`: 具备目标 Space 写入权限的 User Access Token

- 示例请求：`https://{account}-{space}.hf.space/87654321/api/v2/search/anime?keyword=子夜归`
  > 注意：TOKEN为默认87654321的情况下，可不带{TOKEN}请求，如`https://{account}-{space}.hf.space/api/v2/search/anime?keyword=子夜归`

## API食用指南
支持 forward/senplayer/hills/小幻/yamby/eplayerx/afusekt/uz影视/dscloud/lenna/danmaku-anywhere/omnibox/ChaiChaiEmbyTV/moontv/capyplayer/kerkerker/LinPlayer/peekpili/Fongmi(FengMi影视) 等支持弹幕API的播放器。

配合 dd-danmaku 扩展新增对 Emby Web 端弹幕的支持，具体使用方法参考 [PR #98](https://github.com/huangxd-/danmu_api/pull/98) 。

以`senplayer`为例：
1. 获取到部署之后的API地址，如 `http://192.168.1.7:9321/87654321` ，其中`87654321`是默认token（默认为87654321的情况下也可以不带token），如果有自定义环境变量TOKEN，请替换成相应的token；API地址也可直接在UI界面上点击API端点直接复制
2. 将API地址填入自定义弹幕API，在`设置 - 弹幕设置 - 自定义弹幕API`
3. 播放界面点击`弹幕按钮 - 搜索弹幕`，选择你的弹幕API，会根据标题进行搜索，等待一段时间，选择剧集就行。
<img src="https://i.mji.rip/2025/09/14/1dae193008f23e507d3cc3733a92f0a1.jpeg" style="width:400px" />
<img src="https://i.mji.rip/2025/09/14/506fd7810928088d7450be00f67f27e6.png" style="width:400px" />
<img src="https://i.mji.rip/2025/09/14/e206ab329c232d8bed225c6a9ff6f506.jpeg" style="width:400px" />
<img src="https://i.mji.rip/2025/09/14/80aa5205d49a767447f61938f2dada20.jpeg" style="width:400px" />
<img src="https://i.mji.rip/2025/09/14/9fdf945fb247994518042691f60d7849.jpeg" style="width:400px" />
<img src="https://i.mji.rip/2025/09/14/dbacc0cf9c8a839f16b8960de1f38f11.jpeg" style="width:400px" />
4. 现已支持手动搜索标题输入爱优腾芒哔咪狐乐西播放链接获取弹幕。

`uz`使用：
1. 弹幕拓展 -> 豆儿弹幕
2. 豆儿弹幕API -> 填入你的API

### XML 格式说明

API 支持返回 Bilibili 标准 XML 格式的弹幕数据，通过查询参数 `?format=xml` 指定。

**XML 格式示例**：
```xml
<?xml version="1.0" ?>
<i>
    <d p="5.0,5,25,16488046,1751533608,0,0,13190629936">有 162 条弹幕来袭~请做好准备🔥！</d>
    <d p="4.0,5,25,13818234,1751533608,0,0,84261947057">阿姐我来啦！[打call了]</d>
    <d p="5.0,1,25,16488046,1751533608,0,0,33648506749">2025-07-02打卡</d>
</i>
```

默认监听 `9321` 端口，可通过 `DANMU_API_PORT` 改端口。

## 访问与权限模型

这个分支把 UI 和运行时接口拆成了“可公开读取”和“管理员写操作”两层：

- 普通访问令牌：`TOKEN`
  用于普通 API、普通 UI、接口测试、日志查看、运行状态查看。
- 管理员令牌：`ADMIN_TOKEN`
  没有默认值。只有你显式配置后，才能用于环境变量修改、清缓存、云端重部署、Docker 在线更新、Cookie 写入、AI 连通性验证等写操作。

当前权限规则：

- `GET /api/runtime/info`：公开只读
- `POST /api/runtime/check-update`：公开只读
- `POST /api/runtime/update`：仅管理员
- `POST /api/deploy`：仅管理员
- `POST /api/env/*`：仅管理员
- `POST /api/cache/clear`：仅管理员

说明：

- 普通访客也能打开“运行状态与版本”面板查看当前运行状态和版本信息。
- 只有使用 `ADMIN_TOKEN` 访问时，前端才会显示可执行的在线更新 / 重部署能力。

## Web UI 现在包含什么

详细说明见 [danmu_api/ui/README.md](./danmu_api/ui/README.md)。

当前 UI 模块：

- 服务概览：接入地址、模式、运行状态、版本、已配置项统计
- 运行日志：筛选、搜索、自动刷新、导出、清空
- 接口测试：直接调用搜索、匹配、详情、弹幕、分片接口
- 弹幕测试：自动匹配 / 手动搜索、热力图、统计、导出
- 推送弹幕：联动播放器刷新
- 访问记录：最近请求历史和今日请求总数
- 系统设置：环境变量、Cookie 管理、AI 连通性测试、缓存清理、重部署

## 运行状态、版本检查与在线更新

这个分支新增了完整的运行时面板。

### 面板能力

- 侧边栏与详情弹窗都是秒级刷新。
- 弹窗刷新时会保留已展开的详情区块，不会因为轮询自动收起。
- 会显示当前版本、最新版本、运行状态、访问模式、资源指标、更新日志。

### 不同运行模式下的能力

| 运行模式 | 自动识别方式 | CPU / 内存 / 网络 | 版本检查 | 在线更新 / 重部署 |
|---|---|---|---|---|
| `node` | 本地 Node.js 运行 | 支持 | 支持 | 不支持 |
| `docker` | 检测到 Docker 容器 / socket / 显式 `RUNTIME_MODE=docker` | 支持 | 支持 | 支持 Docker 在线更新 |
| `cloud` | Vercel / Netlify / Cloudflare / EdgeOne 等云平台，或显式 `RUNTIME_MODE=cloud` | 不支持 | 支持 | 支持云端重部署 |

### Docker 在线更新需要什么

至少满足下面几个条件：

- `ENABLE_RUNTIME_CONTROL=true`
- 容器内能访问 Docker socket
- 默认模板中已经包含：`/var/run/docker.sock:/var/run/docker.sock`

可选但推荐的变量：

- `DOCKER_SOCKET_PATH`
- `DOCKER_CONTAINER_NAME`
- `DOCKER_IMAGE_NAME`
- `DOCKER_KEEP_BACKUP`

说明：

[喂饭教程5：非常详细的 danmu_api 图文教程](https://bks.indevs.in)

- `DOCKER_CONTAINER_NAME` 不填时，会尝试通过当前容器 hostname 自动识别。
- `DOCKER_IMAGE_NAME` 默认会使用 `lilixu3/danmu-api` 做版本检查。

### 云平台的表现差异

- 云平台模式下不会展示 CPU / 内存 / 网络指标，这是预期行为。
- 管理员可以触发“重新部署”，前提是已配置对应平台的 `DEPLOY_PLATFROM_*` 参数。
- 只读文件系统环境下，运行时状态会自动从磁盘缓存回退到内存缓存，不会因为 `.cache` 不可写而导致运行时面板报错。

## 热更新与需要重启的变量

Node / Docker 挂载 `config/.env` 后，大部分业务配置会自动热加载，不需要重启进程。

但下面这类“启动期变量”建议修改后主动重启：

- `DANMU_API_PORT`
- `LOCAL_PROXY_BIND`
- `LOCAL_PROXY_TOKEN`
- 首次启用或关闭正向代理时的 `PROXY_URL`

原因：

- 这些变量会影响监听端口、代理辅助服务是否启动、代理绑定地址和鉴权方式。
- 进程虽然会重新读取 `.env`，但不会自动重新绑定监听端口或重新创建 5321 辅助代理服务。

## 常用 API

说明：

- 如果你自定义了 `TOKEN` 且不再使用默认值，通常需要带 `/{TOKEN}` 前缀访问。
- 下列接口只列最常用的一组，完整能力可直接在 UI 的“接口测试”里查看。

### 兼容弹弹play 的业务接口

- `GET /api/v2/search/anime?keyword=xxx`
  按剧名关键字搜索番剧列表，返回可用于后续匹配和详情查询的候选结果。
- `GET /api/v2/search/episodes?anime=xxx`
  直接按剧名搜索剧集结果，适合快速拿到分集列表。
- `POST /api/v2/match`
  根据文件名或标题自动匹配番剧和集数，适合播放器自动刮削场景。
- `GET /api/v2/bangumi/:animeId`
  获取指定番剧详情和剧集列表。
- `GET /api/v2/comment/:commentId?format=json|xml`
  按 `commentId` 获取弹幕，可输出 `json` 或 `xml`。
- `GET /api/v2/comment?url={videoUrl}&format=json|xml`
  直接按视频链接获取弹幕，适合已知源站 URL 的场景。
- `GET /api/v2/comment/:commentId/duration`
  获取该剧集的时长信息，便于播放器校准时间轴。
- `POST /api/v2/segmentcomment?format=json`
  按分片信息拉取单个分片弹幕，适合需要分片加载的客户端。
- `GET|POST /api/v2/fongmi/danmaku?name={name}&episode={episode}`
  Fongmi / FengMi影视原生弹幕候选接口，返回可直接加载的 XML 弹幕地址。
- `GET|POST /danmaku?name={name}&episode={episode}`
  Fongmi 别名短路径；推荐播放器直接填写 `https://你的域名/TOKEN`，更多说明见 [Fongmi 弹幕适配说明](./docs/fongmi-danmaku-adapter.md)。

### UI / 系统接口

- `GET /api/config`
  获取当前配置预览、环境变量分类信息和 UI 初始化所需数据。
- `GET /api/logs`
  读取最近日志。
- `GET /api/reqrecords`
  读取最近请求记录和今日请求总数。
- `POST /api/logs/clear`
  清空日志，仅管理员可用。
- `POST /api/cache/clear`
  清空内存 / 本地 / Redis 缓存，仅管理员可用。
- `POST /api/deploy`
  触发云平台重新部署，仅管理员可用。
- `GET /api/runtime/info`
  获取运行时状态、版本信息和资源指标，只读开放。
- `POST /api/runtime/check-update`
  主动检查最新版本，只读开放。
- `POST /api/runtime/update`
  执行 Docker 在线更新，仅管理员可用。
- `POST /api/env/set`
  修改现有环境变量，仅管理员可用。
- `POST /api/env/add`
  新增环境变量，仅管理员可用。
- `POST /api/env/del`
  删除环境变量，仅管理员可用。
- `GET /api/cookie/status`
  获取 Bilibili Cookie 当前状态。
- `POST /api/cookie/*`
  处理二维码登录、Cookie 校验、保存、清理、刷新等操作，仅管理员可用。
- `POST /api/ai/verify`
  测试 AI 配置连通性，仅管理员可用。

## 环境变量说明

完整示例和注释见 [config/.env.example](./config/.env.example)。

### 基础与权限

| 变量 | 说明 |
|---|---|
| `TOKEN` | 普通访问令牌，默认 `87654321` |
| `ADMIN_TOKEN` | 管理员令牌，不填则无法执行管理写操作 |
| `DANMU_API_PORT` | Node / Docker 主服务监听端口，默认 `9321` |
| `RATE_LIMIT_MAX_REQUESTS` | 同一 IP 每分钟最大请求数，`0` 表示不限流 |
| `IP_BLACKLIST` | IP 黑名单，支持精确值、CIDR、正则 |
| `LOG_LEVEL` | 日志级别：`error` / `warn` / `info` / `debug`，默认 `info` |
| `FONGMI_PUBLIC_BASE_URL` | Fongmi 返回弹幕 URL 时使用的公开基础地址，留空自动按请求 Host / 反代头推断 |

### 源、代理与平台接入

| 变量 | 说明 |
|---|---|
| `SOURCE_ORDER` | 数据源顺序 |
| `OTHER_SERVER` | 第三方弹幕服务器兜底地址 |
| `CUSTOM_SOURCE_API_URL` | 自定义弹幕源地址，启用后还要把 `custom` 加入 `SOURCE_ORDER` |
| `VOD_SERVERS` | VOD 站点配置 |
| `VOD_RETURN_MODE` | `all` 或 `fastest` |
| `VOD_REQUEST_TIMEOUT` | VOD 请求超时 |
| `BILIBILI_COOKIE` | B 站 Cookie，UI 支持扫码登录、校验、刷新 |
| `DOUBAN_COOKIE` | 豆瓣 Cookie；配置后 Douban 请求会优先直接带 Cookie，降低搜索接口 403 风控概率 |
| `YOUKU_CONCURRENCY` | 优酷并发数 |
| `PROXY_URL` | 代理 / 反代配置，支持正向代理、万能反代、平台专用反代 |
| `LOCAL_PROXY_BIND` | 本地 5321 辅助代理绑定地址 |
| `LOCAL_PROXY_TOKEN` | 本地 5321 辅助代理鉴权 token |
| `ALLOW_PRIVATE_URLS` | 是否允许访问内网 / 本地 URL，默认 `false` |
| `TMDB_API_KEY` | 用于 TMDB 辅助译名 / 标题转换场景 |

常用字段速查：

- `SOURCE_ORDER` 可选值：`360`、`vod`、`tmdb`、`douban`、`tencent`、`youku`、`iqiyi`、`imgo`、`bilibili`、`migu`、`renren`、`hanjutv`、`bahamut`、`dandan`、`sohu`、`leshi`、`xigua`、`maiduidui`、`acfun`、`aiyifan`、`animeko`、`custom`。
- `PLATFORM_ORDER` / `MATCH_PLATFORM_RULES` 常用平台名：`qiyi`、`bilibili1`、`imgo`、`youku`、`qq`、`migu`、`acfun`、`sohu`、`leshi`、`xigua`、`maiduidui`、`aiyifan`、`renren`、`hanjutv`、`bahamut`、`dandan`、`animeko`、`custom`。
- `MERGE_SOURCE_PAIRS` 使用源字段，用 `&` 组合多源、`,` 分隔多组，例如 `imgo&iqiyi,dandan&bahamut&animeko`。

### 匹配与标题处理

| 变量 | 说明 |
|---|---|
| `PLATFORM_ORDER` | 自动匹配优选平台 |
| `MATCH_PLATFORM_RULES` | 按剧名 / 季度配置自动匹配平台优先级，平台名沿用 `PLATFORM_ORDER`；只调整匹配偏好，不裁剪搜索源；文件名显式 `@平台` 优先；配合标题映射时原始标题和映射后标题都可命中，如 `葬送的芙莉莲->dandan;葬送的芙莉莲/S01->bilibili1,animeko` |
| `MERGE_SOURCE_PAIRS` | 多源合并规则 |
| `ENABLE_ANIME_EPISODE_FILTER` | 是否启用剧名 / 集标题过滤 |
| `ANIME_TITLE_FILTER` | 剧名过滤规则 |
| `EPISODE_TITLE_FILTER` | 集标题过滤规则 |
| `STRICT_TITLE_MATCH` | 是否启用严格标题匹配 |
| `TITLE_TO_CHINESE` | 外语标题转中文，通常配合 `TMDB_API_KEY` |
| `USE_BANGUMI_DATA` | 是否启用 Bangumi Data 加速匹配；本地 / Docker 建议挂载 `.cache`，云部署会退化为内存缓存 |
| `ANIME_TITLE_SIMPLIFIED` | 搜索时繁转简 |
| `TITLE_MAPPING_TABLE` | 标题映射表 |
| `DANMU_OFFSET` | 按剧名 / 季度 / 集数和来源配置弹幕时间轴偏移 |
| `AI_BASE_URL` | AI 接口地址，支持 OpenAI 兼容服务 |
| `AI_MODEL` | AI 模型名 |
| `AI_API_KEY` | AI 密钥 |
| `AI_MATCH_PROMPT` | 自定义 AI 匹配提示词 |
| `AI_TRUST_MATCH_RESULT` | 是否完全信任 AI 结论，开启后 AI 未命中时不再走常规兜底匹配 |

### 弹幕处理

| 变量 | 说明 |
|---|---|
| `BLOCKED_WORDS` | 屏蔽词 |
| `GROUP_MINUTE` | 去重时间窗口 |
| `DANMU_LIMIT` | 弹幕采样上限，单位 k |
| `DANMU_LIKE_PRESET` | 点赞显示预设 |
| `LIKE_SWITCH` | 是否显示点赞标记 |
| `DANMU_SIMPLIFIED_TRADITIONAL` | 简繁转换 |
| `CONVERT_TOP_BOTTOM_TO_SCROLL` | 顶部 / 底部弹幕转滚动 |
| `CONVERT_COLOR` | 颜色转换：可填 `default`、`white`、`color`，也可直接填十进制颜色列表作为自定义随机颜色池 |
| `DANMU_FONT_SIZE` | 字号 |
| `DANMU_OUTPUT_FORMAT` | 全局默认输出格式 |
| `DANMU_PUSH_URL` | 推送弹幕默认地址 |

### 缓存与状态保持

| 变量 | 说明 |
|---|---|
| `SEARCH_CACHE_MINUTES` / `COMMENT_CACHE_MINUTES` | 搜索 / 弹幕缓存时间，设置 `0` 表示不缓存 |
| `SEARCH_CACHE_MAX_ITEMS` / `COMMENT_CACHE_MAX_ITEMS` | 搜索 / 弹幕缓存容量 |
| `REMEMBER_LAST_SELECT` | 记住手动选择结果 |
| `MAX_LAST_SELECT_MAP` | 上次选择映射上限 |
| `MAX_ANIMES` | 动漫缓存上限 |
| `BANGUMI_DATA_CACHE_DAYS` | Bangumi Data 缓存有效期（天），设置 `0` 表示每次请求时强制异步更新 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST 缓存配置 |
| `LOCAL_REDIS_URL` | 本地 Redis |

### 运行时与部署控制

| 变量 | 说明 |
|---|---|
| `RUNTIME_MODE` | `docker` / `node` / `cloud`，留空自动识别 |
| `ENABLE_RUNTIME_CONTROL` | 是否启用运行时在线控制能力 |
| `DOCKER_SOCKET_PATH` | Docker socket 路径 |
| `DOCKER_CONTAINER_NAME` | 目标容器名 |
| `DOCKER_IMAGE_NAME` | 版本检查 / 在线更新使用的镜像名 |
| `DOCKER_KEEP_BACKUP` | 在线更新后是否保留旧容器 |
| `DEPLOY_PLATFROM_ACCOUNT` | 云平台账号 / 账户 ID |
| `DEPLOY_PLATFROM_PROJECT` | 云平台项目 ID |
| `DEPLOY_PLATFROM_TOKEN` | 云平台访问令牌 |
| `NODE_TLS_REJECT_UNAUTHORIZED` | HTTPS 证书校验开关，`0` 表示忽略 |

## 云端重部署支持

当前 UI 中已接入的云平台部署控制：

- Vercel
- Netlify
- Cloudflare Workers
- EdgeOne Pages

先说明一个关键前提：

- 云平台上想启用“前端改配置”和“在线重部署”，不是只把代码部署上去就够了。
- 你必须先在云平台控制台里手动写入最小启动变量，让服务先拥有管理员入口和平台 API 凭据。
- 然后使用 `/{ADMIN_TOKEN}` 打开管理员 UI，后续才可以从前端继续维护大部分环境变量。

最小启用条件：

- 设置 `ADMIN_TOKEN`
- 使用 `/{ADMIN_TOKEN}` 访问管理员 UI
- 在对应云平台中配置好 `DEPLOY_PLATFROM_*`
- 如平台自动识别失败，再补 `RUNTIME_MODE=cloud`

### 云平台最小配置速查

| 平台 | 最少需要配置 | `DEPLOY_PLATFROM_ACCOUNT` 含义 | `DEPLOY_PLATFROM_PROJECT` 含义 | `DEPLOY_PLATFROM_TOKEN` 含义 |
|---|---|---|---|---|
| Vercel | `ADMIN_TOKEN` `DEPLOY_PLATFROM_PROJECT` `DEPLOY_PLATFROM_TOKEN` | 不需要 | Vercel Project ID，通常以 `prj_` 开头 | Vercel Access Token |
| Netlify | `ADMIN_TOKEN` `DEPLOY_PLATFROM_ACCOUNT` `DEPLOY_PLATFROM_PROJECT` `DEPLOY_PLATFROM_TOKEN` | Team slug 或 account ID | Site ID，Netlify UI 中也叫 Project ID | Netlify Personal Access Token |
| Cloudflare Workers | `ADMIN_TOKEN` `DEPLOY_PLATFROM_ACCOUNT` `DEPLOY_PLATFROM_PROJECT` `DEPLOY_PLATFROM_TOKEN` | Cloudflare Account ID | Worker 脚本名 | Cloudflare API Token |
| EdgeOne Pages | `ADMIN_TOKEN` `DEPLOY_PLATFROM_PROJECT` `DEPLOY_PLATFROM_TOKEN` | 当前实现不使用，可留空 | EdgeOne Pages `ProjectId` | EdgeOne Pages API Token |

补充说明：

- 这些变量要配在云平台自己的环境变量页面里，不是只写本地 `config/.env`。
- Node / Docker 部署不走云端重部署接口，通常是直接热加载或本地生效。
- Cloudflare 这条当前按 Workers Script Settings API 实现，`DEPLOY_PLATFROM_PROJECT` 应填 Worker 名称，不是自定义域名。
- EdgeOne 当前在线重部署请求固定按 `main` 分支触发；如果你的生产分支不是 `main`，请先调整仓库分支策略，或暂时在控制台手动重部署。

### 去哪里找这些值

| 平台 | 控制台入口 / 页面地址 | 官方文档 |
|---|---|---|
| Vercel | Token 页面：<https://vercel.com/account/tokens>；项目内按 `Settings -> General -> Project ID`、`Settings -> Environment Variables` 查找 | [Environment Variables](https://vercel.com/docs/environment-variables) / [General Settings](https://vercel.com/docs/projects/project-configuration/general-settings) / [Access Token Guide](https://examples.vercel.com/guides/how-do-i-use-a-vercel-api-access-token) |
| Netlify | PAT 页面：<https://app.netlify.com/user/applications#personal-access-tokens>；项目内按 `Project configuration -> General -> Project information` 查 Project ID；团队内按 `Team settings -> General -> Team information` 查 Team slug | [Environment variables overview](https://docs.netlify.com/build/environment-variables/overview/) / [Get started with the Netlify API](https://docs.netlify.com/api-and-cli-guides/api-guides/get-started-with-api/) / [Get started with Netlify CLI](https://docs.netlify.com/api-and-cli-guides/cli-guides/get-started-with-cli/) |
| Cloudflare Workers | Token 页面：<https://dash.cloudflare.com/profile/api-tokens>；`Workers & Pages` 页面可查看 Account ID，并进入 Worker 的 `Settings -> Variables and Secrets` | [Find account and zone IDs](https://developers.cloudflare.com/fundamentals/account/find-account-and-zone-ids/) / [Create API token](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/) / [Environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/) |
| EdgeOne Pages | Pages 控制台 API Token 文档：<https://pages.edgeone.ai/document/api-token>；项目配置和环境变量入口见 `Project Settings` / 部署页 | [API Token](https://pages.edgeone.ai/document/api-token) / [Project Management](https://pages.edgeone.ai/document/project-management) / [Build Guide](https://pages.edgeone.ai/document/build-guide) / [Manage Deploys](https://pages.edgeone.ai/document/manage-deploys) |

更细的逐平台说明、字段怎么填、有哪些实现差异，见 [danmu_api/ui/README.md](./danmu_api/ui/README.md) 中的“云平台环境变量与在线重部署”章节。

## 相关项目

- Android 端一键运行（内置 Node.js）：`danmu-api-android`
  https://github.com/lilixu3/danmu-api-android

## 免责声明

本项目仅用于学习与技术研究，请遵守当地法律法规与平台服务协议。请勿用于侵权 / 盗版传播等用途。
如有侵权内容请联系删除。

## 致谢

- 上游项目：huangxd-/danmu_api
- 以及所有贡献者 / 依赖项目作者

## License

见 [LICENSE](./LICENSE)。
