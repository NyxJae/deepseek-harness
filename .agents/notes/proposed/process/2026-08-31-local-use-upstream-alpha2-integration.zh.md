# Agent Note: 将 local-use 集成到上游 alpha.2

Status: proposed

[English](2026-08-31-local-use-upstream-alpha2-integration.md) | 中文

## 问题

官方 `upstream/master` 与本地 `master` 均指向 `0a53fb55bea101816fa226bb964ae2bed71c343b`（`dsh-v0.1.2-alpha.2`）。自用分支 `local-use` 指向 `1db349583f7f73f4e0dbaa3aeb61a258d510d6c0`，在 alpha.1 公共祖先 `cd5ef8148158c3a752a658978873241fdf8e2bbc` 之后包含两个本地提交，并落后新基线 234 个官方提交。

官方更新改变了 Session Remote 错误／结果模型、Client Session 行为、agent-preset roster、设置内容、连接恢复展示、包版本、生成的 Typert 输出以及 Web 预期输出。机械合并会把陈旧的本地接口与新架构组合在一起，并恢复已经删除的 General 设置 `AgentPresetRow`。模拟合并已经在 Session Controller Client 文件、测试 fake、设置布局、设置预期输出以及已删除 preset 行上报告架构性冲突。

本地分支也包含官方 alpha.2 尚未替代的独立功能：耐久本地 Markdown 图片、增强图片灯箱、移动端侧边栏抽屉、响应式设置布局、键盘焦点所有权以及视口安全的模型选择。这些行为需要选择性迁移，不能整提交重放。当前工作树在 `.agents/skills/dsh-plugin-development/evals/evals.json` 中还有一项无关修改，而 `backup/local-use` 仍指向 `f4da3d7ac513cd11a8ccdb6b35f1e7d13dacfa4c`；集成不得改变或意外发布这项工作树修改。

## 提案

只有用户直接批准后才开始实施。集成以官方 alpha.2 作为源码文件树和第一父历史，把现有 `local-use` 提交当作只读的目标行为来源，并只手工移植已接受的功能。它不会机械合并冲突块，也不会在官方实现已经满足所需行为时恢复本地实现。

### 完成目标

1. 产出一个通过评审的集成 head：其第一父基线是最新获批的 `upstream/master`，文件树使用官方 API 与产品结构承载已接受的 local-use 功能。
2. 保留耐久本地 Markdown 图片、共享图片灯箱改进、移动端侧边栏覆盖行为、响应式设置行为、官方尚缺的键盘焦点行为以及视口安全的模型菜单定位。
3. 保持官方 `RemoteError` / `RemoteResult`、当前 Client Session 行为、agent-preset roster、设置内容、连接恢复指示、包版本、依赖决策以及生成文件归属为权威实现。
4. 不恢复 `AgentPresetRow` 或另一个重复的 General 设置 preset 入口；只允许把兼容的响应式 roster 卡片样式迁移到官方 preset section。
5. 保证 `.agents/skills/dsh-plugin-development/evals/evals.json` 与集成前的工作树内容逐字节一致，并将其排除在全部集成提交之外。
6. 在分支切换前完成聚焦测试、必需的免密钥快照与 SDK 投影、构建后 Web 验证、认证 GUI 验证以及全新独立审核。
7. 每次提交、祖先合并、本地分支切换或推送前都重新取得用户确认；除非后续请求明确改变目标，否则绝不把这次自用集成推送到 `origin`。

### 固定基线

| 事实 | 计划值 |
|---|---|
| 官方来源 | `upstream/master` 与 `master` 均位于 `0a53fb55bea101816fa226bb964ae2bed71c343b` |
| 本地行为来源 | `local-use` 位于 `1db349583f7f73f4e0dbaa3aeb61a258d510d6c0` |
| 公共祖先 | `cd5ef8148158c3a752a658978873241fdf8e2bbc` |
| 制定计划时的分歧 | 官方侧 234 个提交，本地侧 2 个提交 |
| 私有备份状态 | `backup/local-use` 位于 `f4da3d7ac513cd11a8ccdb6b35f1e7d13dacfa4c` |
| 受保护的工作树修改 | `.agents/skills/dsh-plugin-development/evals/evals.json` |
| 集成 worktree | `worktrees/local-use-upstream-alpha2/` |
| 集成分支 | `integrate/local-use-upstream-alpha2` |

执行前置检查会再次 fetch `upstream` 并比较这些值。如果 `upstream/master` 已经移动，则在创建任何代码修改前停止实施，更新本基线与冲突分析，并请用户批准修订后的目标。

### 功能决策

| 区域 | 决策 | 权威实现与必需结果 |
|---|---|---|
| Session Remote 结果与错误 | 采用官方实现，再进行扩展 | 保留官方 `RemoteResult`、`RemoteError`、`isRemoteFailure()` 与领域前缀失败码；增加本地图片行为时不得恢复 `ClientResult`、旧 Typert failure 或旧错误名。 |
| 耐久本地 Markdown 图片 | 保留并适配 | 保留[认证 Web 聊天中的本地 Markdown 图片](../../implemented/feature/2026-08-29-web-local-markdown-images.zh.md)负责的行为，并迁移到当前 Session Controller 与生成的 Remote API。 |
| 图片灯箱 | 官方缺少等价行为时保留 | 通过当前 `ui-attachment` 组件结构保留缩放、平移、触摸、键盘、焦点、滚动锁、安全区域及清理行为。 |
| 移动端侧边栏抽屉 | 保留并适配 | 保留[移动端侧边栏使用覆盖式抽屉](../../implemented/feature/2026-08-24-mobile-sidebar-drawer.zh.md)，不替换官方 sidebar slot 或桌面行为。 |
| 响应式设置布局 | 只保留仍然缺失的行为 | 以官方设置 DOM、标签、section roster、连接指示与内容为基线，只增加尚未具备的响应式布局。 |
| 对话框与菜单焦点 | 只保留仍然缺失的行为 | 官方等价行为保持不变；只增加尚未解决的焦点陷阱、嵌套覆盖层 Escape 所有权、方向键菜单导航与打开者焦点恢复。 |
| 模型菜单视口适配 | 仍缺失时保留 | 在官方模型选择实现上保留[模型菜单保持在视口内](../../implemented/feature/2026-08-24-model-menu-viewport-fit.zh.md)。 |
| General preset 行 | 淘汰 | 接受官方删除 `AgentPresetRow`；只把兼容 CSS 迁移到官方 `AgentPresetSection` 与 roster 卡片。 |
| 版本、依赖、lockfile、生成输出 | 采用官方并重新生成本地增量 | 不得恢复 alpha.1 包版本或 lockfile 条目；只有保留的实现确实需要且官方依赖尚未负责该功能时才增加依赖。 |

### Worktree 与历史策略

1. 记录当前分支、ref 值、`git status --short --branch` 以及已修改 eval 文件的 `git hash-object`。现有 checkout 保持在 `local-use`；不 stash、不暂存、不 reset，也不编辑这项无关修改。
2. 在 `worktrees/local-use-upstream-alpha2/` 中从验证后的 `master` tip 创建 `integrate/local-use-upstream-alpha2`。全部产品代码、测试、生成输出和文档工作都在该 worktree 内进行。
3. 检查两个本地提交及其相对公共祖先的完整 diff。只把它们当作源材料，不整体 cherry-pick 任一提交。
4. 按功能单元逐项迁移到官方文件，保留官方命名、包角色、事件／错误约定、本地化归属与生成文件归属。
5. 每次提交前向用户展示精确 diff、拟定消息、包含路径、检查结果以及被排除的 eval 文件。一次通用的实施批准不授权后续提交或推送。
6. 所有功能提交、文档、验证与独立审核都通过后，提出一次以旧 `local-use` 为第二父提交、内容不变的祖先合并。`git merge -s ours local-use` 只用于让通过评审的集成 head 同时成为官方 alpha.2 和旧本地历史的后代；其第一父文件树必须逐字节不变，并且该合并提交需要单独获得用户批准。
7. 通过空的第一父文件树 diff、两个预期父提交、`master` 是祖先以及旧 `local-use` 是祖先来验证该祖先合并。该合并不得隐藏未完成的功能，也不得代替迁移与测试。
8. 只有现有 checkout 能在不改变 eval 修改的情况下 fast-forward，才推进本地 `local-use` ref。如果官方基线改变了该路径，或 Git 会覆盖它，则停止并请用户先保存或提交该无关修改。未来推送 `backup/local-use` 必须是单独批准并通过 `git ls-remote` 验证的普通 fast-forward；预计不需要裸 force 或 lease 保护的 force push。

这项策略保留官方第一父历史和既有本地祖先，同时避免让 Git 组合陈旧的本地文件内容。它符合[GitHub 原生堆叠与可选 PR rebase](../../implemented/process/2026-08-02-native-github-stacks-and-optional-rebases.zh.md)；本次集成不是 PR 堆叠，本计划也不会创建 GitHub 对象。

### 阶段 0：前置检查与迁移清单

- 执行 `fetch upstream --prune`，验证 `master == upstream/master`，并重新运行祖先、分歧、`git cherry -v` 与 `git merge-tree --write-tree` 分析。开始代码工作前记录任何变化后的冲突集合。
- 在集成 worktree 内重新读取根目录和包指令、`docs/architecture.md`、`docs/testing.md`、当前 alpha.2 包 manifest、生成文件归属以及本提案链接的已实现 Agent Note。
- 为两个本地提交改变的每个文件生成迁移矩阵：`保留`、`适配`、`淘汰` 或 `官方已有`。每个保留项都要指出其官方目标文件、测试、快照和文档归属。
- 确认集成 worktree 干净、源 checkout 仍然只有已知 eval 修改，并且静态实施不需要 HMR 或受保护进程操作。

### 阶段 1：响应式外壳与移动端导航

- 通过 `packages/client/ui-layout/src/client/AppFrame.tsx` 与 `packages/client/ui-layout/src/client/columns.ts` 迁移覆盖布局，并使用官方布局状态和 owner 类型。
- 通过 `packages/client/ui-sidebar/src/client/SidebarRoot.tsx` 及其归属 CSS 迁移抽屉、遮罩、移动端触发器、Escape 处理、焦点进入／恢复、安全区域尺寸以及桌面／移动端区分。
- 只有官方 alpha.2 标题栏仍然与移动触发器重叠时，才更新对话标题栏间距归属；不新增布局 store，也不复制 sidebar 状态。
- 更新聚焦的 layout/sidebar 套件，包括 `columns.client.spec.ts`、`app-frame.client.spec.tsx`、`sidebar-root.client.spec.tsx` 及 CSS 行为检查。保留桌面轨道和调整宽度行为。

### 阶段 2：设置、preset roster 与焦点所有权

- 从官方 `packages/client/ui-settings-general/src/client/SettingsRoot.tsx` 与 `SettingsRoot.module.css` 开始。先保留官方设置 section 顺序、标签、`ConnectionIndicator`、关闭行为与 roster 内容，再增加窄屏标题、横向 section 导航、安全区域尺寸和单列选项布局。
- 比较官方对话框／菜单键盘行为与本地实现。只把仍缺失的打开聚焦、模态 Tab 限制、嵌套 dialog/menu Escape 所有权、ArrowUp/ArrowDown/Home/End 导航、跳过禁用项以及打开者焦点恢复迁移到当前归属，包括该行为仍由 `packages/client/ui-primitives/src/Menu.tsx` 负责时的 primitive 修改。
- 接受上游删除 `packages/client/ui-agent-preset/src/client/AgentPresetRow.module.css`。不得重建 `AgentPresetRow` 或旧 General 设置入口。把仍有价值的响应式卡片规则适配到 `AgentPresetSection.module.css` 与官方 roster 组件。
- 更新 `settings-root.client.spec.tsx`、设置组件测试、菜单 primitive 测试、preset section 测试、`apps/web/tests/settings-chrome.e2e.ts` 以及受影响的两个设置预期输出文件，并以官方 alpha.2 内容为准。

### 阶段 3：模型菜单与共享图片查看器

- 迁移前先比较官方 `ModelSelect` 定位行为。如果仍缺少视口约束，则在 `packages/client/ui-model-selection/src/client/ModelSelect.tsx` 及其 CSS 中增加测量后的 fixed 定位、上下方选择、resize 处理和捕获阶段 scroll 更新，不改变模型目录或选择状态。
- 通过 `packages/client/ui-attachment/src/ImageLightbox.tsx`、其归属 CSS 与 `MessageImages.tsx` 迁移共享灯箱。URL 所有权继续属于现有附件／Session 缓存，不增加第二个 preview store。
- 保留以指针为中心的滚轮缩放、有界平移、捏合与单指手势、双击缩放、键盘控制、焦点陷阱／恢复、背景滚动锁、resize 重置／约束、安全区域控件以及清理。
- 更新 `model-select.client.spec.tsx`、`image-lightbox.client.spec.tsx` 与 `message-image.client.spec.tsx`，覆盖几何、键盘、指针、触摸、resize 与 dispose 场景。

### 阶段 4：本地 Markdown 图片的 Host 与 Session 协议

- 将 `packages/api/session-controller/src/markdown-images.ts` 迁移为 Session 归属的解析器：在文件系统访问前验证已记录的 assistant 调用实例，通过 `ctx.fs` 读取，通过附件服务保存，追加一个耐久 `assistant/markdown-image` 映射，并对每个调用实例保持幂等与 single-flight。
- 在 `types.ts`、`index.ts`、`commands.ts` 与 `invariant.ts` 中扩展映射事件、请求／返回类型、配置、Remote 方法、事件专属附件授权及关系不变式。除非 alpha.2 当前事件规则证明发生了结构性格式改变，否则保持 `SESSION_FORMAT_VERSION` 不变。
- 把 `src/client/contract/session.ts` 与 `src/client/sessions/session.ts` 适配到官方 `RemoteResult` 和 `isRemoteFailure()` 行为。不得恢复 `ClientResult`、`RpcResponse`、`RemoteStreamError`、`RpcId`、`TypertRemoteFailure` 或旧 `attachment-error` 代码。
- 使用当前官方领域前缀错误码与 `RemoteError` 构造。保留 `disabled` 作为发布默认值、`workspaces` 作为较窄策略，并只在明确的本地部署 profile 使用 `host`；不得暴露公开文件系统路由或扩大 Web authority 检查。
- 遵循当前日志事件与导出 JSDoc 规则：`assistant/markdown-image` 不携带 `@mode`，`MarkdownImageOccurrence` 具有导出约定，`extractMarkdownImages` 记录其 `text` 参数和返回值。
- 通过归属生成器重新生成当前 Typert Remote 产物，不手工编辑生成文件。把 `tests/fake-api.client.ts` 与 `tests/test-remote.ts` 适配到官方生成协议。
- 迁移并更新 `markdown-images.host.spec.ts`、`markdown-images-resolver.host.spec.ts`、`commands-queue-attachment.host.spec.ts`、Client 约定测试、不变式测试与传输测试，覆盖官方 failure 值、回放、授权、并发、取消与 dispose。

### 阶段 5：Client 投影与 Markdown 渲染

- 扩展 `packages/client/ui-chat/src/client/conversation-nodes/assistant.ts`，从 Session 事件投影耐久映射；扩展 `AssistantMarkdown.tsx`，只解析已完成的本地图片调用实例，并提供本地化加载、重试与失败状态。
- 扩展 `packages/client/ui-primitives/src/markdown/render.tsx` 与 `MarkdownText.tsx`，增加不依赖 Cordis 的调用实例解析器和文档顺序索引。远程 HTTP(S) 图片必须继续直接渲染，流式本地图片必须保持无副作用的回退文本，周边 Markdown 必须留在同一次 AST 渲染中。
- 把成功映射送入现有历史附件缓存和 `session.attachment` Blob URL 路径，使刷新、重连、Session 切换以及源文件删除后的回放继续使用已存储字节。
- 更新 Markdown 解析／渲染测试、Chat 事件投影测试、Chat view 测试、本地化字典和附件呈现测试。为原始 HTML、`data:` URL、不支持的协议／类型、不匹配序号以及同级图片部分失败增加负向覆盖。

### 阶段 6：生成输出、快照与决策记录

- 当 alpha.2 改变路径、类型、验证或部署事实时，更新仍负责保留行为的现有已实现 Agent Note。不要在本集成记录中复制它们的理由。
- 工作未完成时，本记录保持在 `proposed/process/`。通过评审的文件树在本地交付后，把它改写为现在时，将提案／验收章节替换为已实现决策与后果，把完整 triplet 移到 `implemented/process/`，修复链接并重新记录翻译配对。
- 只通过归属生成器重新生成受影响的 Typert 输出、Cordis／配置文档、事件生产方－消费方参考以及其他派生物。审查每个生成 diff；不得把 alpha.1 包版本或陈旧 lockfile 解析带入集成。
- 按当前 Cordis catalog 类型链接归属对 `SessionResolveMarkdownImageRequest` 与 `SessionResolveMarkdownImageValue` 进行分类，再重新生成 Cordis catalog、Cordis inspect catalog、Client catalog、config catalog 与 persistence catalog。这些输出在集成前的 `local-use` 文件树中已确认陈旧，必须恢复到与生成归属一致。
- 由于 `SessionEventMap` 会在 alpha.2 基线上增加或重新引入耐久事件，同一变更必须更新所需的 TypeScript SDK 与 Python SDK 预期投影，并运行其归属检查。
- 增加或更新一个免密钥 recorded-session Web 场景，通过受控 workspace fixture 验证保留的本地图片呈现。为官方 roster／内容与保留的响应式行为更新归属应用的设置预期输出。只有审查观测到的变化后才刷新预期产物。

### 阶段 7：本地验证

最小聚焦单元集合覆盖 Session Controller Markdown 解析与附件授权、Chat 投影与完成态 Markdown 渲染、layout/sidebar 列与焦点、settings/preset/menu 行为、模型菜单几何，以及灯箱输入、焦点、resize 与清理。迁移矩阵确定后从当前 alpha.2 文件树选择测试文件，并以此前各阶段列出的本地套件作为初始集合。

生成的 Remote 与 Client 改动稳定后，运行 `pnpm run build:lib:host`、`pnpm run build:lib:client`、`pnpm run build:web` 与 `pnpm run typecheck`。每个阶段运行聚焦 Vitest 文件，随后对集成 diff 集中运行受影响的 Web 预期输出套件、目标免密钥快照场景、SDK 投影检查、`pnpm run test:docs`、`pnpm run doc-sync`、`pnpm run lint` 与 `git diff --check`。

文档站 symlink 逃逸测试必须在能够创建测试 symlink 的环境中通过。Windows 因缺少 symlink 权限产生的 `EPERM` 记为环境限制，并在具备能力的 host 或 CI 上重跑；它不授权跳过测试，也不能把无关产品改动当作修复。

任何推送前，针对最终待发布 diff 调用 `dsh-pre-push-checks` 选择其他必需检查。不默认运行仓库级 `test:coverage`、完整平台矩阵或 `check:windows-wine`；只有变更文件、失败的聚焦测试或用户明确要求证明必要时才增加。

### 阶段 8：构建后运行时与浏览器验证

- 依赖 Client HMR 前，验证当前 checkout 是否已经运行 `pnpm run dev:web`。不启动替代 DSH server，也不停止或重启任何 Node 进程。
- 重建受影响的 Host 与 Client 产物，刷新现有 GUI `http://127.0.0.1:3079`；不把 Vite shell 当作独立替代应用。
- Host 侧 Session Controller 改动需要受保护的 DSH Web 进程加载新产物。请用户完成重启，再验证现有 URL、进程 profile、插件组合和解析到的包路径。在这次运行时交接完成前，目标保持未完成。
- 在代表性宽度验证桌面与窄屏布局，包括 1440×900、390×844 与 320×568。检查移动端侧边栏几何和焦点、设置导航与 roster、模型菜单视口边距、嵌套菜单／对话框键盘所有权以及图片灯箱的键盘、滚轮、拖动、捏合、滚动锁和焦点生命周期。
- 通过认证 Chat 解析真实本地 PNG/JPEG/WebP/GIF，刷新 Session，删除或重命名源文件，并验证回放仍使用已存储字节。验证一个被拒绝路径或不支持文件显示本地化可重试失败，同时成功的同级图片仍然可见；验证 HTTP(S) 图片仍由浏览器加载。
- 把浏览器截图与可观测操作日志保存为产品源码之外的验证证据。如果后续请求为 GUI 变更创建 PR，则必须在创建 PR 前从真实的已评审 server 录制所需 GIF。

### 阶段 9：独立审核与修正

测试与浏览器证据齐全后，由全新的独立 subagent 审核完整 diff。审核检查已批准范围、官方架构保留、事件耐久性与附件授权、错误码迁移、焦点与手势清理、本地化归属、生成输出归属、陈旧 preset 行缺失、快照覆盖以及无意带入的 alpha.1 残余。前端设计审核根据保留行为检查响应式与交互证据。

每个阻断发现都在引入它的功能单元中修复，并重新运行窄范围受影响检查。最终审核报告必须以无未解决 blocker 的 `PASS` 结束，才能切换分支；局部审核、代码自述或仅编译通过都不构成完成证据。

### 拟定提交边界

| 单元 | 预期内容 | 拟定消息系列 |
|---|---|---|
| 响应式外壳 | layout 列、移动端 sidebar、设置响应式结构、兼容官方 roster 的 CSS、聚焦测试与归属记录 | `feat(web): port responsive local-use shell refinements` |
| 交互改进 | 菜单／对话框焦点行为、模型菜单视口定位、图片灯箱行为、聚焦测试与归属记录 | `feat(web): port local-use interaction refinements` |
| 耐久本地图片 | Session 事件／解析器／Remote API、Client 投影／渲染、附件、测试、快照、SDK 投影、配置／文档 | `feat(web): port durable local Markdown images` |
| 集成记录 | 最终当前状态集成记录、剩余生成／文档同步、验证记录 | `docs: record local-use alpha.2 integration` |
| 祖先合并 | 所有前置单元通过后，把旧本地历史作为第二父提交且文件树不变 | `merge: retain prior local-use ancestry` |

这些是评审单元，不是预授权提交。最终 diff 形成后会再次展示精确拆分与消息，每次 `git commit` 都需要新的直接确认。

### 暂停条件

- `upstream/master` 在实施开始前移动，或产生不同的冲突集合。
- 保留的功能需要替换官方 alpha.2 架构，而不是扩展其文档化归属。
- Session 事件变更需要超出现有版本 0 fail-closed 事件策略的格式或迁移决策。
- 受保护 Web 进程必须重启、现有 GUI 无法加载新 Host 产物，或无法自主收集认证运行时证据。
- 推进已 checkout 的 `local-use` 分支会覆盖或重新解释无关 eval 修改。
- 必需的生成器、快照、聚焦测试或独立审核因系统性原因持续失败，并需要更广泛的设计决策。

出现任何暂停条件时，保留干净的集成 worktree 与证据，报告准确阻断项，并请用户在可行下一步中选择。不得用兼容代码、跳过验证、force 更新或替代 server 掩盖问题。

## 考虑过的替代方案

**把 `master` 直接合并到旧 `local-use` 文件树，只解决 Git 报告的冲突。** 不采用，因为 Git 还会自动合并许多不冲突的 alpha.1 本地代码，其中包含需要与官方 alpha.2 进行语义比较的行为。最终文件树仍需要完整审核，而且陈旧本地架构会更难识别。

**把两个本地提交 rebase 或 cherry-pick 到 alpha.2。** 不采用，因为这些提交混合了独立 UI 与 Session 协议变更，并包含陈旧的 Client 结果类型、错误码、设置 DOM、preset 入口和预期输出。整提交重放不是正确的评审单元。

**只使用官方 alpha.2 并丢弃全部本地行为。** 不采用，因为官方 alpha.2 不提供本部署的耐久本地 Markdown 图片，也没有覆盖所有需要保留的移动端、焦点、菜单定位与图片检查行为。

**恢复已删除的 General 设置 preset 行。** 不采用，因为官方 alpha.2 明确由 roster 负责 preset 选择。第二个 General 设置入口会重复状态展示，并保留已删除的组件模型。

**把 `local-use` 改写到集成 head 并 force-push 私有分支。** 不作为默认方案，因为内容不变的祖先合并可以保留两侧历史并允许普通 fast-forward 发布。除非后续证据证明祖先策略无效且用户明确批准修订计划，否则无需改写历史。

## 验收标准

- 最终集成 head 同时以获批官方 `master` tip 和旧 `local-use` tip 为祖先，官方 alpha.2 位于第一父历史，且没有未经评审的合并内容。
- 最终文件树中没有恢复的 `AgentPresetRow`、重复 preset 控件、`ClientResult`／旧 Remote 适配器、陈旧 alpha.1 包版本，也没有本地迁移引入的旧附件失败码。
- 本地 Markdown 图片在文件系统访问前验证已记录调用实例，使用配置的 `disabled`／`workspaces`／`host` 策略，持久化耐久附件映射，只授权映射中的附件字段，并在源文件删除后回放已存储字节，同时不改变模型可见的 assistant 文本。
- 远程 HTTP(S) 图片、流式 Markdown、不支持输入、同级部分失败、重试、幂等、并发、取消和 dispose 保持文档化行为。
- 移动端侧边栏、响应式设置、官方 preset roster、模型菜单定位、模态／菜单键盘行为和图片灯箱交互在桌面与窄屏下通过聚焦单元测试及构建后浏览器验证。
- 官方连接恢复展示、section 内容、本地化归属、包依赖、生成文件归属和桌面行为保持完整。
- 必需的免密钥 Web／Session 快照以及 TypeScript 与 Python SDK 投影覆盖耐久事件和可见行为；每个预期输出变化都根据官方 alpha.2 内容完成审查。
- Host 与 Client library、Web bundle、类型检查、选定单元／Web／快照检查、文档检查、lint 和 `git diff --check` 通过，并记录真实命令与输出。
- 用户负责的进程重启后，现有 DSH GUI 加载通过评审的构建产物，并从 `http://127.0.0.1:3079` 采集认证本地图片回放与响应式交互证据。
- 全新独立审核报告无未解决 blocker 的 `PASS`，且每项发现都有对应修正证据。
- `.agents/skills/dsh-plugin-development/evals/evals.json` 在集成前后的工作树 blob hash 与 diff 相同，不出现在集成提交中，也不进入推送。
- `git status`、change-scope 输出与最终 diff 只包含获批集成文件以及单独保留的既有 eval 修改。
- 没有任何提交、祖先合并、本地分支切换、推送、PR、Node 进程重启或替代 server 在缺少对应用户决定时发生。
- 后续若批准发布，只通过验证后的 fast-forward 更新 `backup/local-use`，除非用户明确选择其他 remote 与分支。

## 风险

官方分支可能在计划制定后或工作期间移动。从陈旧基线开始会重复冲突分析与浏览器证据，而静默替换进行中的基线会丢弃可评审检查点。前置检查遇到移动会停止；工作开始后的移动只在当前已批准检查点完成且用户再次决定后处理。

本地 Markdown 图片事件跨越 Session 耐久性、Remote 生成、附件授权、Client 投影、快照与 SDK 投影。只迁移 UI 可能编译通过却破坏回放或外部消费方，因此必须覆盖完整事件路径和两种 SDK 预期输出。

响应式与焦点代码可能覆盖并未表现为文本冲突的官方 alpha.2 产品改动。每个 UI 阶段都从官方 DOM 与状态归属开始，比较行为后只迁移经过测量的缺口；陈旧快照不得作为产品真源。

`host` 图片策略有意允许已认证 Web 主体把任意可读取的受支持图片复制进 Session。发布默认值继续为 `disabled`，`host` 只在本地部署中显式启用。扩大 authority、增加公开文件路由或放宽浏览器认证均不属于本计划。

只有目标文件树已经存在并通过评审后，内容不变的祖先合并才安全。过早使用它会掩盖缺失的本地行为，因此该合并拥有独立批准、空文件树 diff 检查、父提交检查和祖先检查。

受保护的 DSH Web 进程不能由 agent 重启。Host 集成可以达到测试与构建通过状态，但在用户执行重启前无法满足运行时验收；目标会暂停，而不会仅根据源码测试宣称完成。
