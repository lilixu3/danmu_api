# Fongmi（com.fongmi.android.tv）弹幕适配说明

## 推荐填写方式

在 Fongmi 自带弹幕设置里填写短入口：

```text
https://你的域名/TOKEN
```

服务端会把 Fongmi 请求转换为本项目的搜索/匹配流程，并返回：

```json
[
  { "name": "剧名 集数", "url": "https://你的域名/TOKEN/api/v2/comment/10002.xml" }
]
```

这里刻意使用 `.xml` 后缀，而不是 `?format=xml`，避免播放器或中间代理二次请求弹幕 URL 时丢失查询参数。

## 支持的入口

- 短入口：`POST /TOKEN`
- 别名入口：`GET|POST /TOKEN/danmaku`
- 显式入口：`GET|POST /TOKEN/api/v2/fongmi/danmaku`
- 嵌套兼容：`GET|POST /TOKEN/danmaku/api/v2/fongmi/danmaku`

推荐仍然填写 `https://你的域名/TOKEN`。如果某些壳或客户端会自动拼接 `/danmaku`，服务端也会兼容。

参数别名：

- 剧名：`name` / `keyword` / `title`
- 集数：`episode` / `ep`

集数会做常见归一化和候选排序，例如 `1`、`第1集`、`01话`、`S01E01`、`02x`、带文件后缀的集数文本。

标题会优先清洗常见媒体文件噪音再回退搜索，例如年份、`1080p`、`WEB-DL`、编码参数和点号分隔符。没有明确媒体噪音时仍优先保留原始标题，避免误清洗。

返回候选最多保留 12 条，减少 Fongmi 选择列表过长或播放器侧压力。

## 鉴权级别

- Fongmi 入口只使用普通 `TOKEN`。
- 使用 `ADMIN_TOKEN` 请求显式 Fongmi 入口会返回空数组，避免把管理 token 暴露给播放器；短入口推荐只填写普通 `TOKEN`。
- `/api/logs`、`/api/reqrecords` 是普通 token 可读；普通 token 返回时会脱敏 IP。
- 管理写接口仍然需要 `ADMIN_TOKEN`，例如 `/api/cache/clear`、`/api/logs/clear`、`/api/env/*`、`/api/cookie/*`、`/api/ai/verify`。

## 公开地址生成

默认会根据请求 Host / 反代头生成返回给播放器的弹幕 URL。若你的反代会改写 Host，建议配置：

```text
FONGMI_PUBLIC_BASE_URL=https://你的域名
```

这里不要带 `TOKEN`，服务端会自动拼接为 `https://你的域名/TOKEN/api/v2/comment/<id>.xml`。

## 格式行为

- `/api/v2/comment/<id>.xml` 默认按后缀输出 XML。
- `/api/v2/comment/<id>.xml?format=json` 仍可显式覆盖为 JSON。
- 如果弹幕很多导致播放器压力较大，可以考虑降低 `DANMU_LIMIT`，例如 `5` 或 `10`。

## App 侧排查

如果服务端日志显示已加载并返回弹幕，但播放器不显示，优先检查 Fongmi 里两个开关：

1. 设置页里的“弹幕加载”。
2. 播放界面里的“弹幕显示”。
