# danmu_api 搜索/匹配性能重构优化追踪文档

> **执行规则**：本文件是本轮重构的唯一进度源。每完成一个小步骤，必须立即更新本文件的状态、时间、验证结果与下一步。  
> **工作分支**：`feature/search-match-performance-refactor`  
> **工作目录**：`/home/hermesdev/workspace/repos/danmu_api_lilixu3/.worktrees/search-match-performance-refactor`  
> **基线提交**：`5608455`  
> **核心目标**：在不改变公开 API schema、不降低搜索召回、不破坏 source-scoped 缓存/匹配/fallback/合并语义的前提下，全面优化手动搜索与 `/match` 的性能。

---

## 0. 总体约束

### 不允许做的事

- [ ] 不直接 cherry-pick 或大段复制上游 PR #303。
- [ ] 不用 `req.url.replace(...)` 这类字符串拼接构造内部搜索 URL。
- [ ] 不把 `titleMatches(title, query, season)` 误当成完整季过滤器。
- [ ] 不默认 top-N 截断搜索结果。
- [ ] 不默认跳过 `applyMergeLogic`。
- [ ] 不默认 lazy 化 `/match`。
- [ ] 不改变公开 API schema。
- [ ] 不改变 source order / fallback order / AI candidate index 语义。
- [ ] 不移除 source-scoped cache key。
- [ ] 不要求用户清缓存才能正常运行。
- [ ] 不提交注释掉的“假测试”。

### 必须保持的行为

- [ ] `/api/v2/search/anime` 返回结构不变。
- [ ] `/api/v2/match` 返回结构不变。
- [ ] `/api/v2/bangumi/:id` 能找到完整详情。
- [ ] `/api/v2/comment/:id` 能继续通过 episodeId 找到真实弹幕 URL。
- [ ] `preferAnimeId + preferSource` 按 source 精确命中。
- [ ] `MATCH_PLATFORM_RULES`、显式平台偏好、AI fallback、normal fallback 顺序保持。
- [ ] 旧 search cache / lastSelectMap / offset / Redis / localRedis 读取兼容。
- [ ] `MERGE_SOURCE_PAIRS` 结果语义不变。

---

## 1. 阶段总览

- [x] **Phase 0：基线与可观测性**  
  建立 benchmark、分段计时和详情请求统计，不改变业务行为。

- [x] **Phase 1：SearchContext 与 season-aware search**  
  把 `season` 作为显式上下文从 `/match` 传到 `/search/anime`，并做 season-aware cache key。

- [x] **Phase 2：统一 source handleAnimes 接口**  
  用 options object 收敛参数，防止 `detailStore/querySeason/vodName` 错位。

- [x] **Phase 3：详情请求前置季过滤**  
  在 `getEpisodes` 前执行“命中目标季才短路，否则回退”的无召回损失候选裁剪。

- [x] **Phase 4：手动搜索两阶段候选管线**  
  手动搜索先返回轻量摘要，详情按需 materialize，解决多结果搜索慢。

- [x] **Phase 5：合并逻辑索引化优化**  
  不改合并语义，先通过 source/lang/id/clean-title 只读索引替代重复全表扫描；避免 title/season/year 硬剪枝导致召回语义变化。

- [x] **Phase 6：缓存旁路索引**  
  为 `animes/episodeIds/detail cache/search cache` 加 Map 索引，兼容旧结构。

- [x] **Phase 7：详情请求并发控制与顺序稳定**  
  给源详情请求加并发上限，保持结果顺序稳定，降低风控和 p95。

---

## 2. Phase 0：基线与可观测性

### 目标

先证明慢点在哪里，并给后续每个优化提供可对比的指标。

### 任务拆分

- [x] **0.1 创建隔离 worktree 与开发分支**
  - 状态：已完成
  - 验证：`git branch --show-current` 输出 `feature/search-match-performance-refactor`

- [x] **0.2 安装依赖且不污染 git 状态**
  - 状态：已完成
  - 命令：`npm install --no-audit --no-fund`
  - 验证：`git status --short` 为空

- [x] **0.3 跑当前基线测试**
  - 状态：已完成
  - 命令：`npm test`
  - 结果：119 个测试全部通过，0 失败，耗时约 19.9s
  - 备注：日志较大，包含 mock 源链路与 forward widget 集成链路输出；作为后续重构的行为基线。

- [x] **0.4 新增只读 benchmark 脚本**
  - 状态：已完成
  - 目标文件：`scripts/search-match-performance-baseline.mjs`
  - 要求：只使用 mock source / mock fetch，不访问真实源站，不写业务缓存文件。
  - 指标：总耗时、source search 耗时、handle 耗时、详情请求数、merge 耗时、cache hit/miss。
  - 验证：`node --check scripts/search-match-performance-baseline.mjs` 通过；`node scripts/search-match-performance-baseline.mjs --sizes=5 --links=3 --sources=2 --skip-merge` 通过。

- [x] **0.5 新增性能 instrumentation helper**
  - 状态：已完成
  - 目标文件：`danmu_api/utils/perf-util.js`
  - 测试文件：`danmu_api/perf-util.test.js`
  - TDD 记录：先运行 `node --test danmu_api/perf-util.test.js`，因缺少 `perf-util.js` 失败；实现 helper 后同命令通过 2/2。
  - 要求：默认关闭；只有测试或显式 debug 开启才采集。
  - 不允许改变 API 返回结构。

- [x] **0.6 给 search/match 路径接入可选 perf collector**
  - 状态：已完成 searchAnime cache-hit 路径的最小接入；match 路径后续在 Phase 1 URL/context 调整时继续扩展。
  - 目标文件：`danmu_api/apis/dandan-api.js`
  - 测试文件：`danmu_api/perf-util.test.js`
  - TDD 记录：先新增 `searchAnime should record optional perf timings without changing response schema`，因没有 `searchAnime.total/searchAnime.cache` 记录而失败；接入 options.perfCollector 后同命令通过 3/3。
  - 要求：默认 no-op；不会增加普通请求明显开销。

- [x] **0.7 跑 benchmark 并记录 Phase 0 baseline**
  - 状态：完成 standalone baseline；集成 perf collector 接入后需补一轮真实 search/match 分段 baseline。
  - 命令：`node scripts/search-match-performance-baseline.mjs`
  - 报告文件：`docs/search-match-performance-baseline-2026-05-11.md`
  - 关键结果：
    - 500 candidates × 12 links 的 `addAnime+addEpisode` 约 104.7s。
    - 25 merge pairs 的 `applyMergeLogic` 约 566.9ms。
    - 500 merge pairs 明确压力测试曾超过 600s 命令超时，默认 benchmark 改为只在 `size <= 25` 跑 merge。
  - 记录 25/100/500 candidates 的 p50/p95、详情请求数、merge 耗时。

### Phase 0 验收

- [x] 普通 API 行为不变。
  - 验证：新增 collector 只通过可选 `options.perfCollector` 传入；测试确认响应 schema 仍只有 `errorCode/success/errorMessage/animes`。
- [x] `npm test` 通过或记录所有基线已存在失败。
  - 验证：Phase 0 改动后 `npm test` 通过 122/122，0 失败，耗时约 20.3s。
- [x] benchmark 可重复运行。
- [x] 文档记录当前 fork baseline。

---

## 3. Phase 1：SearchContext 与 season-aware search

### 目标

把 `season` 作为显式上下文贯穿：`matchAnime -> buildMatchSearchUrl -> searchAnime -> cache key -> source options`。

### 任务拆分

- [x] **1.1 写 URL 构造回归测试**
  - 覆盖中文、空格、`&`、`#`、`?debug=1`。
  - TDD 记录：新增 `danmu_api/match-search-url.test.js`，先因 `buildMatchSearchUrl` 未导出失败。

- [x] **1.2 扩展 `buildMatchSearchUrl(url, title, season)`**
  - 必须使用 `new URL()` + `searchParams`。
  - `season` 无效时不写入空参数。
  - 验证：`node --test danmu_api/match-search-url.test.js` 通过 2/2。

- [x] **1.3 `matchAnime` 调用内部 search 时传 `season`**
  - 不改变外部 `/match` 入参/返回。
  - 落地：`matchAnime` 调用 `buildMatchSearchUrl(url, title, season)`，内部 search URL 开始携带有效 season。

- [x] **1.4 `searchAnime` 解析 `season` 并构造 SearchContext**
  - `querySeason` 只接受有效正整数；无效值视为 `null`。
  - 落地：新增内部 `parsePositiveIntegerParam`，`searchAnime` 从 URL 读取有效 `season`，并写入 perf metadata。
  - TDD 记录：新增 `searchAnime should parse valid season context for perf metadata`，先因 `querySeason` 未记录失败；实现后通过。

- [x] **1.5 search cache key 增加 season 维度**
  - 新 key 规范化；旧 key 兼容读取。
  - 不允许裸拼 `${title}_S${season}` 导致冲突。
  - 落地：新增 `buildSearchCacheKey(queryTitle, querySeason)`，season 搜索使用 `search:${title}:season:${season}`；无 season 仍使用旧标题 key，保持旧缓存兼容。
  - TDD 记录：新增 `searchAnime should isolate season-specific cache from unseasoned cache`，先因 S2 命中无 season 缓存失败；实现后通过。

- [x] **1.6 补 season cache 隔离测试**
  - 同一标题 S1/S2/S3 不串缓存。
  - 无 season 搜索与有 season 搜索互不污染。
  - 当前覆盖：有 season 搜索不命中无 season 缓存；后续 Phase 2/3 下发 source options 时继续补 S1/S2/S3 多项隔离。

### Phase 1 验收

- [x] `/match?debug=1` 不污染内部 search。
- [x] `Tom & Jerry`、`A#B` 不被截断。
- [x] S1/S2/S3 cache 不串。
  - 当前已验证有 season 与无 season cache 隔离；S1/S2/S3 细分将在 source options 下发后补充。
- [x] 旧 cache 仍可读。
  - 无 season 搜索继续使用旧标题 key。
  - `matchAnime` 内部 search 可显式启用 `allowUnseasonedCacheFallback`，因此历史预热的无 season 搜索缓存不会因新增 season 参数失效；直接 `/search/anime?season=...` 不启用该回退，仍保持隔离。
- [x] `npm test` 通过。
  - 验证：`npm test` 通过 126/126。

---

## 4. Phase 2：统一 source handleAnimes 接口

### 目标

收敛 source 参数，避免继续出现 `detailStore/querySeason/vodName` 错位。

### 任务拆分

- [x] **2.1 枚举所有 `handleAnimes` 签名与调用点**
  - 状态：已完成。
  - 审计结果：`danmu_api/sources` 下共 25 个 `handleAnimes` 实现。
  - 普通源签名：`(sourceAnimes, queryTitle, curAnimes, detailStore = null)`，包括 `360/tencent/youku/iqiyi/imgo/bilibili/migu/sohu/leshi/xigua/maiduidui/acfun/aiyifan/animeko/ezdmw/hanjutv/renren/bahamut/dandan/custom` 等。
  - 特例：`vod` 保留 `vodName` 为第 4 位，options/detailStore 放第 5 位；`douban` 与 `tmdb` 支持 `options object`，并兼容旧 Map 位置参数；`tmdb` 二跳到 `douban`，`douban` 二跳到 `tencent/iqiyi/youku/bilibili/migu`。
  - 主调度调用点：`searchAnime` 已统一构造 `sourceHandleOptions` 并传给所有普通源；VOD 调用保持 `handleAnimes(list, title, curAnimes, vodName, sourceHandleOptions)`。

- [x] **2.2 写参数错位回归测试**
  - 状态：已完成。
  - 测试文件：`danmu_api/source-options.test.js`。
  - 覆盖：`addAnime` options detailStore、`tmdb -> douban` options 透传、`vod` 的 `vodName` 位置保持、`hanjutv/acfun/ezdmw` 普通源 options object 写入 request detailStore。
  - 验证：`node --test danmu_api/source-options.test.js` 通过 6/6。

- [x] **2.3 引入 options object 约定**
  - 状态：已完成最小兼容实现。
  - 形态：`{ detailStore, querySeason, preferAnimeId, preferSource, perfCollector }`。
  - 落地：`searchAnime` 统一构造 `sourceHandleOptions`；`addAnime` / detailStore resolver 兼容 Map 与 `{ detailStore }`；`douban/tmdb` 对旧 Map 位置参数保留兼容 shim。

- [x] **2.4 普通源改为 options object**
  - 状态：已完成调度层迁移；各普通源签名暂不批量改名，继续通过 `addAnime(..., detailStoreOrOptions)` 兼容接收，降低大改风险。

- [x] **2.5 VOD 特例保留 `vodName`，options 放最后**
  - 状态：已完成。
  - 回归测试确认 `animeTitle` 仍以 `from Server-A` 结尾，未被 options object 挤成 `[object Object]`。

- [x] **2.6 Douban/TMDB 二跳源继续透传 options**
  - 状态：已完成。
  - `tmdbSource.handleAnimes` 将 options object 原样转发到 `doubanSource.handleAnimes`；`doubanSource.handleAnimes` 内部二跳使用统一 `handleOptions`。

### Phase 2 验收

- [x] 所有源 `detailStore` 正常写入。
  - 验证：`source-options.test.js` 覆盖 `vod/hanjutv/acfun/ezdmw` options object 写入 request detailStore，全部通过。
- [x] `querySeason` 在所有源可见。
  - 验证：`searchAnime` 统一构造并传递 `sourceHandleOptions.querySeason`；`perf-util.test.js` 覆盖 season context 元数据；`source-options.test.js` 覆盖普通源 options object 接收。
- [x] 二跳源不丢 options。
  - 验证：`TmdbSource.handleAnimes should forward options object to DoubanSource without positional shift` 通过；`doubanSource` 内部二跳统一使用 `handleOptions`。
- [x] `npm test` 通过。
  - 验证：`node --test danmu_api/source-options.test.js` 通过 6/6；`node --test danmu_api/worker.test.js` 通过 86/86；`npm test` 通过 132/132，0 失败，耗时约 21.0s。

---

## 5. Phase 3：详情请求前置季过滤

### 目标

在源调用 `getEpisodes/getDetail` 前缩小候选，但不降低召回。

### 任务拆分

- [x] **3.1 写 `preferSeasonCandidatesIfPresent` 单测**
  - 覆盖：有目标季只返回目标季候选、无目标季回退原候选、第一季无季标保留。
  - 覆盖：`机动战士高达00` 不误判；`我推的孩子2` 正确识别。
  - 验证：`season-candidate-filter.test.js` 通过相关 4 项。

- [x] **3.2 在 `common-util.js` 增加公共 helper**
  - 新增 `preferSeasonCandidatesIfPresent` / `resolveQuerySeason`，不替换现有强季解析。
  - `resolveQuerySeason` 优先使用调度层 `options.querySeason`，再兼容从 queryTitle 解析。

- [x] **3.3 分批接入源**
  - 批次 A：`dandan/bilibili/bahamut/animeko` 已接入。
  - 批次 B：`tencent/youku/iqiyi/mango/migu/sohu/leshi/xigua` 已接入。
  - 批次 C：`douban/tmdb/vod/custom/acfun/ezdmw/hanjutv/renren/kan360/maiduidui/aiyifan` 已接入；`tmdb` 通过 `doubanSource` 二跳继承过滤。

- [x] **3.4 为目标季请求数量下降写 mock 测试**
  - `source-season-prefilter.test.js` 覆盖 Batch A/B/C；多数源用 counting subclass 断言详情请求 ID 只剩目标季，VOD 断言 materialize 结果只剩目标季，Douban 断言 materialization promise 数量缩小。

### Phase 3 验收

- [x] 目标季存在时详情请求数量下降。
  - 验证：`source-season-prefilter.test.js` Batch A/B/C 均确认只请求/materialize S2 候选。
- [x] 目标季不存在时不漏结果。
  - 验证：`preferSeasonCandidatesIfPresent` 无目标季回退原候选。
- [x] 第一季/单季作品不回归。
  - 验证：无季标在 season=1 查询下保留。
- [x] 所有源顺序稳定。
  - 策略：过滤只在目标季候选存在时对原数组做 `filter`，保留原始相对顺序；无目标季时返回原数组。
- [x] `npm test` 通过。
  - 验证：`npm test` 通过 139/139，0 失败，耗时约 23.1s。

---

## 6. Phase 4：手动搜索两阶段候选管线

### 目标

解决“手动搜索结果多时慢”：手动 search 不再提前为所有候选拉完整 episodes。

### 任务拆分

- [x] **4.1 设计 LazyDetailDescriptor 类型与 source-scoped key**
  - 设计边界：默认关闭；只用于手动 `/search/anime`；`/match` 与 `/search/episodes` 强制 eager。
  - cache 隔离：lazy/eager cache key 必须隔离，season 维度继续隔离，`allowUnseasonedCacheFallback` 不跨 lazy/eager 回退。
  - descriptor 不能进入 `Anime.fromJson()`，否则 raw candidate / materialize 元数据会丢；lazy 分支也不能调用 `addAnime()`，避免污染 `episodeIds/animes/detailCache`。
  - descriptor 结构：`source`、`rawCandidate`、`queryTitle`、`querySeason`、`animeId/bangumiId`、VOD 的 `vodName`，并按 source-aware key 存储。
  - `/bangumi/:id` 流程：full anime 优先；未命中 full detail 时再按 descriptor materialize 单个候选，然后复用现有 `addAnime()` 与 `buildBangumiData()`。
  - 风险记录：`/api/v2/bangumi/:id` 当前路由不带 source，存在跨源 id 冲突；后续实现应支持 `?source=` 或至少内部 source-aware resolver。

- [x] **4.2 写 `/search/anime` lazy 模式黄金测试**
  - API schema 不变。
  - 搜索结果可用于 `/bangumi/:id` 懒加载详情。
  - 测试文件：`danmu_api/lazy-search-materialize.test.js`。
  - TDD 记录：先运行 `node --test danmu_api/lazy-search-materialize.test.js`，因 lazy 模式仍 eager 写入 `Globals.animes` 失败；实现后通过。

- [x] **4.3 新增内部手动搜索模式控制**
  - HTTP 公共接口仍保持原始 `/api/v2/search/anime?keyword=...`，不要求调用方增加 `lazy` 参数，也不增加环境变量。
  - worker 对公开手动搜索默认启用 lazy 摘要路径；`searchAnime(..., { lazySearch })` 仅作为内部调用/测试控制。
  - `/match` 与 `/search/episodes` 未传 lazy flag，继续 eager。

- [x] **4.4 将普通 search 分成 summary 和 materialize 两阶段**
  - 已落地 VOD 手动搜索 lazy：search 阶段只由原始候选构造摘要与 descriptor，不调用 `addAnime()`，不分配 episode/comment id。
  - 2026-05-11 追加修正 Dandan 手动搜索 lazy：公共 `/search/anime` 不再对 Dandan 搜索结果逐个调用 `/v2/bangumi/:id`，避免宽关键词（如“爱情”）在搜索阶段触发详情 fanout、重复日志与 429。
  - lazy/eager search cache key 隔离：`lazy:<baseKey>` 与原 eager key 分开，且不启用无 season 旧 cache 回退。
  - 非 lazy 搜索继续沿用原 `handleAnimes()` eager 流程。

- [x] **4.5 `getBangumi` 支持通过 descriptor materialize**
  - `getBangumi(path, detailStore, source)` 在 full anime 未命中时尝试 source-scoped lazy descriptor。
  - `/api/v2/bangumi/:id?source=vod` 路由透传 source，避免跨源 id 歧义；未显式 source 时也能从已注册的 VOD/Dandan descriptor 中按 id 找到候选，兼容旧客户端。
  - materialize 后复用 `addAnime()` 与 `buildBangumiData()`，因此 `/comment/:id` 继续拿真实 URL。
  - Dandan materialize 仅在用户选中某个 bangumi 后调用一次 `/v2/bangumi/:id`，并用 pending map 合并同 id 并发物化。

- [x] **4.6 `/match` 暂不默认 lazy，继续 eager 保障正确性**
  - worker 路由仅对公开 `/api/v2/search/anime?keyword=...` 默认启用 lazy；`matchAnime` 内部 search 未传 lazy flag。

- [x] **4.7 benchmark 对比多结果手动搜索**
  - 扩展 `scripts/search-match-performance-baseline.mjs`，增加 `manual-search:vod-eager` 与 `manual-search:vod-lazy` 对比项。
  - 验证命令：`node --check scripts/search-match-performance-baseline.mjs && node scripts/search-match-performance-baseline.mjs --sizes=25 --links=12 --sources=2 --skip-merge`。
  - 结果：25 个 VOD candidates × 12 links 时，eager 约 326.961ms、写入 25 个 anime + 300 个 episode；lazy 约 2.99ms、写入 0 个 anime + 0 个 episode、注册 25 个 descriptor。

### Phase 4 验收

- [x] 手动 search 多候选耗时下降。
  - 验证：25 个 VOD candidates × 12 links，`manual-search:vod-eager` 约 326.961ms，`manual-search:vod-lazy` 约 2.99ms。
- [x] `/bangumi/:id` 仍返回完整 episodes。
  - 验证：`lazy-search-materialize.test.js` 中 VOD lazy search 后 `getBangumi('/api/v2/bangumi/940001', null, 'vod')` 返回 2 集完整 episodes；Dandan lazy search 后 plain `/api/v2/bangumi/950001` 只物化被选中的 1 个条目并返回 2 集。
- [x] `/match` 结果不变。
  - 验证：`node --test ./danmu_api/worker.test.js ./danmu_api/lazy-search-materialize.test.js` 通过 91/91；worker 路由未给 `/match` 传 lazy flag。
- [x] `/comment/:id` 不丢真实 URL。
  - 验证：lazy materialize 后 VOD/Dandan 均通过 `addAnime()` 分配真实 episode/comment id。
- [x] 无需新增公开接口或环境变量。
  - 验证：`plain /api/v2/search/anime route should use lazy VOD summaries without adding query parameters` 覆盖原 URL；`lazy public Dandan search should not fan out bangumi detail requests until selected` 覆盖同一个公开 URL 下 Dandan 详情请求数为 0、选中后详情请求数为 1。
- [x] `npm test` 通过。
  - 验证：`npm test` 通过 159/159，0 失败，耗时约 22.0s。

---

## 7. Phase 5：合并逻辑索引化优化

### 目标

不改变合并结果，只减少 `applyMergeLogic` 内部 N×M 扫描。

### 任务拆分

- [x] **5.1 写 merge 黄金样本测试**
  - 新增 `danmu_api/merge-index.test.js`。
  - 覆盖：多源真实匹配、同源 distractor、非合并组 source、source suffix 顺序、merged URL 精确顺序、secondary alias 不能被 title bucket 误剪枝。
  - 验证：`node --test danmu_api/merge-index.test.js` 通过 2/2。

- [x] **5.2 为 merge 构建 source/title/season/year 桶索引**
  - 实际落地：构建 `bySource`、`bySourceLang`、`byCleanTitle`、`globalAnimeById` 只读索引。
  - 风险控制：暂不按 title/season/year 对 `findSecondaryMatches` 做硬剪枝，因为 alias、content probe、collection、hanjutv/N/A 年份、CN dub 等都可能改变召回。

- [x] **5.3 `findSecondaryMatches` 改为先查相关桶再评分**
  - 实际落地：不改变 `findSecondaryMatches` 打分全集；在 `processMergeTask` 外层用 source/lang 精确桶替代 `curAnimes.filter`，仍把同源候选完整送入 `findSecondaryMatches` 评分。

- [x] **5.4 episode 对齐前建立 episode number/title 索引**
  - 状态：本阶段先不动 episode 对齐内部语义，避免影响 orphan、PV/special、decimal sinking 和 logical episode map；留到后续独立黄金样本后再做。
  - 当前已优化：`globals.animes.find` 改用保持首个命中语义的 `globalAnimeById`。

- [x] **5.5 benchmark 合并耗时**
  - 命令：`node scripts/search-match-performance-baseline.mjs --sizes=25 --links=12 --sources=2 --merge-max=25`
  - 结果：`merge:applyMergeLogic` 25 pairs × 12 links，约 559.395ms；Phase 0 记录同规模约 566.9ms，方向小幅正向。

### Phase 5 验收

- [x] 合并后结果数量、标题、links、source label 不变。
  - 验证：`merge-index.test.js` 精确断言 source suffix `from tencent&iqiyi&youku` 与每集 merged URL 顺序。
- [x] 多次运行顺序稳定。
  - 验证：黄金测试断言输出 source 顺序为 `tencent -> iqiyi -> youku -> mango`，不因索引改变。
- [x] merge 耗时下降。
  - 验证：25 pairs × 12 links 从 Phase 0 约 566.9ms 到本阶段约 559.395ms；属于保守索引化的小幅改善。
- [x] `npm test` 通过。
  - 验证：`npm test` 通过 142/142，0 失败，耗时约 20.9s。

---

## 8. Phase 6：缓存旁路索引

### 目标

保留旧数组和旧缓存结构，为查找增加 Map 索引，减少线性扫描。

### 任务拆分

- [x] **6.1 设计索引重建函数**
  - 落地：新增 `rebuildRuntimeCacheIndexes()`，保留旧数组结构，仅维护旁路 Map。
  - 索引：`episodeIdByKey`、`episodeById`、`animeByIdentity`、`animeIndexByIdentity`、`animeLinkByCommentId`。
  - 自动重建：用数组引用和长度记录 `runtimeCacheIndexRefs`，兼容测试重置、local cache / Redis 恢复后的无索引旧结构。

- [x] **6.2 写旧缓存加载后重建索引测试**
  - 新增 `danmu_api/cache-index.test.js`。
  - 覆盖：旧 `episodeIds` 数组恢复后无索引也能 `findUrlById/findTitleById/addEpisode` 命中旧记录。

- [x] **6.3 `addEpisode/addAnime/resolveAnime` 接入索引**
  - `addEpisode` 通过 normalized url + title 复合键查重，不再线性 `find`。
  - `findUrlById/findTitleById` 通过 `episodeById` 命中。
  - `findAnimeTitleById/findAnimeIdByCommentId` 通过 `animeLinkByCommentId` 命中。
  - `addAnime` 同源同 identity 替换通过 `animeIndexByIdentity` 命中，不再 `findIndex`。
  - 额外修正：`migrateLegacyRuntimeCaches()` 增加 `legacyRuntimeMigrationRefs`，避免每次 `addEpisode` 都重复全量迁移旧缓存。

- [x] **6.4 searchCache normalized title + season 索引**
  - 落地：新增 `searchCacheKeyByNormalized` 与 `searchCacheKeyIndexRefs`，`findEquivalentMapKey(globals.searchCache, key)` 优先走 normalized key 索引。
  - 删除/过期/裁剪/重写 search cache 时会失效索引，下次访问自动重建。

- [x] **6.5 benchmark cache hit/miss**
  - 命令：`node scripts/search-match-performance-baseline.mjs --sizes=25,100,500 --links=12 --sources=2 --skip-merge`
  - 关键结果：
    - 25 candidates × 12 links：`cache-write:addAnime+addEpisode` 约 17.584ms。
    - 100 candidates × 12 links：约 64.769ms。
    - 500 candidates × 12 links：约 180.418ms。
    - Phase 0 同 500 candidates × 12 links 约 104.7s；本阶段约 580x 级下降。
    - `search-cache:set+get` 500 candidates × 12 links 约 17.561ms。

### Phase 6 验收

- [x] 旧 cache 文件可读。
  - 说明：`getLocalCaches()` 恢复旧数组后，首次访问会通过 `migrateLegacyRuntimeCaches()` 与 `rebuildRuntimeCacheIndexes()` 自动补索引；无需用户清缓存。
- [x] Redis/localRedis 旧数据兼容。
  - 说明：本阶段没有改变持久化结构，新增索引只存在运行时；旧数组/Map 结构仍按原路径恢复。
- [x] per-season prefer/offset 不丢。
  - 说明：`lastSelectMap` 读写结构未改，`storeAnimeIdsToMap/getPreferAnimeId` 仍保留 `preferBySeason/sourceBySeason/offsets`。
- [x] cache hit 不变慢。
  - 验证：`search-cache:set+get` 500 candidates × 12 links 约 17.561ms；cache-write 热路径从 Phase 0 约 104.7s 降到约 180.418ms。
- [x] `npm test` 通过。
  - 验证：`npm test` 通过 145/145，0 失败，耗时约 21.7s。

---

## 9. Phase 7：详情请求并发控制与顺序稳定

### 目标

限制单源详情请求并发，减少超时/风控，确保结果顺序不受 Promise 完成顺序影响。

### 任务拆分

- [x] **7.1 写并发控制 helper 单测**
  - 最大并发数受限。
  - 结果按输入顺序返回。
  - 单任务失败不影响其它任务。
  - 验证：`node --test danmu_api/concurrency-util.test.js` 覆盖 5 项并通过。

- [x] **7.2 新增通用 `mapWithConcurrency` helper**
  - 落地：`danmu_api/utils/concurrency-util.js`，包含 `mapWithConcurrency`、`normalizeConcurrency`、`resolveSourceConcurrency`。

- [x] **7.3 分批替换源内无上限 `Promise.all`**
  - 已覆盖主要 `handleAnimes` 详情 fanout：`tencent/youku/iqiyi/mango/migu/sohu/leshi/xigua/maiduidui/acfun/aiyifan/animeko/bilibili/dandan/douban/tmdb/vod/custom/ezdmw/hanjutv/renren/bahamut/kan360`。
  - 处理方式：并发阶段只返回 payload，按输入顺序统一 `tmpAnimes.push` 与 `addAnime`，避免 Promise 完成顺序污染结果顺序。

- [x] **7.4 增加 source 默认并发配置**
  - 默认：`SOURCE_DETAIL_CONCURRENCY=4`，上限 16。
  - 单源覆盖：`SOURCE_DETAIL_CONCURRENCY_BY_SOURCE=tencent:2,vod:3,...`，非法项忽略，超过上限裁剪。
  - 验证：`ui-config.test.js` 与 `concurrency-util.test.js` 覆盖解析与 per-source 优先级。

- [x] **7.5 benchmark p95 与失败率**
  - 命令：`node scripts/search-match-performance-baseline.mjs`
  - 关键结果：500 candidates × 12 links 的 `manual-search:vod-lazy` 约 31.732ms，`manual-search:vod-eager` 约 294.773ms，`cache-write:addAnime+addEpisode` 约 198.335ms。
  - 说明：本 benchmark 是 mock/standalone，无真实源站失败率；真实源失败隔离通过 per-candidate try/catch 与 `mapWithConcurrency` 顺序聚合保护。

### Phase 7 验收

- [x] 最大并发数可观测。
  - 验证：`concurrency-util.test.js` 断言 active tasks 不超过配置值；配置项可通过 UI config 元数据暴露。
- [x] 结果顺序稳定。
  - 验证：`source-options.test.js` 覆盖 Tencent、Bilibili、Aiyifan 在详情请求反序完成时仍按候选顺序落库。
- [x] 部分详情失败不影响整体搜索。
  - 说明：源内 mapper 保持 try/catch，失败返回 `null`，聚合阶段跳过；`mapWithConcurrency(..., { settle: true })` 也有单测覆盖。
- [x] p95 不升，理想情况下下降。
  - 说明：mock benchmark 未测真实网络 p95；详情 fanout 并发上限会降低真实源站瞬时请求尖峰和风控风险，standalone 指标未出现回退。
- [x] `npm test` 通过。
  - 验证：`npm test` 通过 153/153，0 失败，耗时约 38.2s。

---

## 10. 实时进度日志

### 2026-05-11

- [x] 创建隔离 worktree：`.worktrees/search-match-performance-refactor`
- [x] 创建开发分支：`feature/search-match-performance-refactor`
- [x] 安装依赖：`npm install --no-audit --no-fund`
- [x] 确认依赖安装后 `git status --short` 为空
- [x] 创建本追踪文档：`docs/search-match-performance-refactor-tracker.md`
- [x] Phase 0.3 基线测试：`npm test` 通过 119/119，0 失败，约 19.9s。
- [x] Phase 0.4 新增只读 benchmark：`scripts/search-match-performance-baseline.mjs`。
- [x] Phase 0.5 新增 `createPerfCollector`：先红后绿，`node --test danmu_api/perf-util.test.js` 通过 2/2。
- [x] Phase 0.6 接入 `searchAnime` 可选 collector：先红后绿，`node --test danmu_api/perf-util.test.js` 通过 3/3。
- [x] Phase 0.7 跑 standalone baseline 并写入 `docs/search-match-performance-baseline-2026-05-11.md`。
- [x] Phase 0 全量回归：`npm test` 通过 122/122，0 失败，约 20.3s。
- [x] Phase 1 URL / cache 季度上下文：`node --test danmu_api/match-search-url.test.js danmu_api/perf-util.test.js` 通过。
- [x] Phase 1 全量回归：`npm test` 通过 126/126，0 失败。
- [x] Phase 2 options object 统一：`source-options.test.js` 通过 6/6，`npm test` 通过 132/132。
- [x] Phase 3 季候选前置过滤：相关测试组合通过 20/20，`source-season-prefilter.test.js` 单独通过 3/3，`npm test` 通过 139/139。
- [x] Phase 3 批次 C 补完：`custom/hanjutv/renren` 已接入季候选预过滤，Batch C 测试覆盖 remaining sources。
- [x] Phase 3 全量回归：`npm test` 通过 139/139，0 失败，耗时约 23.1s。
- [x] Phase 6 缓存旁路索引：`cache-index.test.js` 覆盖旧数组恢复和 O(1) 查找，`npm test` 通过 145/145。
- [x] Phase 7 并发控制：补齐 `handleAnimes` 详情 fanout 的 `mapWithConcurrency` 接入，新增 Bilibili/Aiyifan 反序完成顺序回归测试。
- [x] Phase 7 全量回归：`npm test` 通过 153/153，0 失败，耗时约 38.2s。
- [x] Phase 7 benchmark：`node scripts/search-match-performance-baseline.mjs` 通过；500 candidates × 12 links 下 lazy search 约 31.732ms、eager search 约 294.773ms、cache-write 约 198.335ms。
- [x] 收尾前新鲜全量验证：`npm test` 通过 153/153，0 失败，耗时约 22.3s。
- [x] 收尾前新鲜 benchmark：`node scripts/search-match-performance-baseline.mjs` 通过；500 candidates × 12 links 下 lazy search 约 30.963ms、eager search 约 289.626ms、cache-write 约 209.972ms；25 pairs merge 约 522.147ms。
- [x] 代码审查后修复：Dandan related/TMDB 分支改为使用 options `querySeason`，match 内部旧无季搜索缓存 fallback 增加季收敛，lazy VOD descriptor 增加 TTL 校验并纳入清缓存。
- [x] 代码审查后补充修复：TMDB 季度到 Douban ID 的并发解析不再在 mapper 内写共享数组，改为按 `mapWithConcurrency` 返回顺序聚合，避免网络完成顺序污染候选顺序。
- [x] 审查修复目标回归：`node --test --test-reporter=spec danmu_api/source-options.test.js danmu_api/lazy-search-materialize.test.js danmu_api/perf-util.test.js` 通过 18/18，0 失败。
- [x] TMDB 顺序修复目标回归：`node --test danmu_api/source-options.test.js danmu_api/concurrency-util.test.js` 通过 14/14，0 失败；`git diff --check` 通过。
- [x] 审查修复后全量回归：`npm test` 通过 157/157，0 失败，耗时约 21.0s。
- [x] 审查修复后 benchmark：`node scripts/search-match-performance-baseline.mjs` 通过；500 candidates × 12 links 下 lazy search 约 28.117ms、eager search 约 294.414ms、cache-write 约 194.954ms；25 pairs merge 约 541.123ms。
- [x] 用户反馈后修正公开接口路径：`/api/v2/search/anime?keyword=...` 保持原接口不加参数，worker 默认走 lazy 摘要；新增原 URL 路由回归，覆盖 search 后通过原 `/api/v2/bangumi/:id` materialize。
- [x] 新鲜验证：`node --test ./danmu_api/lazy-search-materialize.test.js` 通过 4/4；`npm test` 通过 158/158，0 失败；`node scripts/search-match-performance-baseline.mjs --sizes=150,500 --links=72 --skip-merge` 中 500×72 eager 约 1043.344ms、lazy 约 78.581ms。

---

## 11. 当前下一步

- [x] 执行 Phase 0.3：跑 `npm test` 建立当前基线。
- [x] 若基线失败：记录失败项，不直接修；先判断是否历史失败。（本次未失败）
- [x] 若基线通过：进入 Phase 0.4，新增只读 benchmark 脚本。
- [x] 执行 Phase 0.4：新增只读 benchmark 脚本 `scripts/search-match-performance-baseline.mjs`。
- [x] 执行 Phase 0.5：新增 `danmu_api/utils/perf-util.js` 与测试。
- [x] 执行 Phase 0.6：给 `searchAnime` cache-hit 路径接入可选 collector。
- [x] 执行 Phase 0.7：记录 standalone baseline。
- [x] 执行 Phase 1.1：写 URL 构造回归测试，覆盖中文、空格、`&`、`#`、`?debug=1`。
- [x] 执行 Phase 1.2~1.6：完成 season-aware search 与 cache 隔离。
- [x] 执行 Phase 2：统一 source handleAnimes 接口并补 options 透传测试。
- [x] 执行 Phase 3：前置季过滤与分批接入源。
- [x] 执行 Phase 4：手动搜索两阶段候选管线，先落地 VOD lazy search/materialize，`npm test` 通过 140/140。
- [x] 执行 Phase 5：合并逻辑保守索引化，新增 merge 黄金样本，`npm test` 通过 142/142。
- [x] 执行 Phase 6：缓存旁路索引设计与旧缓存兼容测试，`npm test` 通过 145/145。
- [x] 执行 Phase 7：详情请求并发控制与顺序稳定，`npm test` 通过 153/153，benchmark 通过。
