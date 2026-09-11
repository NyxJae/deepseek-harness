# local-use 同步官方上游执行手册

本文用于将自用分支 `local-use` 迁移到最新 `upstream/master`，同时保留仍有价值的本地功能。它是一次“以上游当前源码为主体、逐项重做本地能力”的集成流程，不是把旧 `local-use` 整体 merge/rebase/cherry-pick 到新上游。

本文按 Windows + PowerShell 为主要环境编写，Git 命令本身在其他平台同样适用。

## 1. 本次同步的目标

最终结果应满足以下四点：

1. 新 `local-use` 的代码树以同步时最新 `upstream/master` 为基础，官方已经实现的能力采用官方实现。
2. 仍然缺失于官方的本地功能，以尽可能小的补丁重新实现到当前官方架构上。
3. 所有编译、单元测试、静态检查和实机 Web 验证先在临时集成分支完成；验证通过前不移动 `local-use`。
4. 验证完成后，用一次内容不变的 `ours` ancestry merge 把旧 `local-use` 记录为新结果的祖先，然后让 `local-use` 通过 `--ff-only` 快进到集成结果；不要用 `reset --hard` 或裸 `--force` 覆盖它。

本文编写时的已知基线是：旧 `local-use` 为 `4cae7f66e640d156b582c265891d23c7730583e1`，官方 `upstream/master` 为 `5dda764ed3aa172535a7967b06ff95d9cbfe536a`（`dsh@0.1.5-alpha.1`），两条历史的旧共同基线为 `76fda729799fe9b3848dbe2c211d4b231032b81e`。这些 SHA 只用于复核本次历史；真正开始执行时始终重新 `fetch`，以上游当时的真实 HEAD 为准。

## 2. 总原则：不要机械合并旧代码

旧 `local-use` 已经跨过多轮官方架构变化。直接运行 `git merge upstream/master` 或把本地提交整体 `cherry-pick` 到官方 HEAD，会把已经失效的 Session Remote、Client、Sidebar、Subagent、Settings 和 Markdown image 结构重新带回来，并制造大量“能解决文本冲突、但语义已经错误”的合并结果。

本次采用以下模型：

```text
旧 local-use ---------------------------┐
                                        │ 仅作为功能需求、旧实现和祖先来源
upstream/master -> 临时集成分支 -> 本地补丁 -> 测试通过 -> ours ancestry merge
                                                             │
                                                             └-> local-use --ff-only
```

在临时集成分支上，任何文件都先读取当前官方版本，再查看旧 `local-use` 的实现。不要先把旧文件复制进来再修。

## 3. 开始前准备

先在你现有的 DSH 仓库根目录执行：

```powershell
git status --short --branch
git remote -v
git fetch origin --prune
git fetch upstream --prune
```

确认存在：

```text
origin   -> NyxJae/deepseek-harness
upstream -> deepseek-ai/deepseek-harness
```

如果没有 `upstream`：

```powershell
git remote add upstream https://github.com/deepseek-ai/deepseek-harness.git
git fetch upstream --prune
```

记录同步开始时的两个 HEAD：

```powershell
$OLD_LOCAL = git rev-parse local-use
$UPSTREAM = git rev-parse upstream/master
$MERGE_BASE = git merge-base local-use upstream/master

Write-Host "OLD_LOCAL = $OLD_LOCAL"
Write-Host "UPSTREAM  = $UPSTREAM"
Write-Host "MERGE_BASE = $MERGE_BASE"
```

这三个值在整个同步期间不要重新解释。特别是 `$OLD_LOCAL` 必须始终表示“开始同步之前的自用分支头”，后面查看旧实现都从它读取。

建议再保存一份纯文本记录：

```powershell
@"
OLD_LOCAL=$OLD_LOCAL
UPSTREAM=$UPSTREAM
MERGE_BASE=$MERGE_BASE
"@ | Set-Content .git/local-use-integration-baseline.txt
```

`.git/` 下的文件不会进入版本控制。

## 4. 环境基线

当前官方根 `package.json` 要求 Node `^22.19.0 || >=24.0.0`，并声明 `pnpm@11.7.0`。先验证：

```powershell
node --version
pnpm --version
```

如果 pnpm 未准备好，可在已满足版本要求的 Node 环境中使用 Corepack：

```powershell
corepack enable
corepack prepare pnpm@11.7.0 --activate
pnpm --version
```

不要在旧 `local-use` 工作树里先做依赖修复。真正的环境基线应该在下面新建的官方集成 worktree 中验证。

## 5. 建立临时集成分支和独立 worktree

推荐保留当前 checkout 停在 `local-use`，另建 worktree。这样旧分支始终可直接查看，也不会因为依赖安装、生成物或未提交文件影响集成树。

选择一个名称，例如：

```powershell
$INTEGRATION_BRANCH = "integrate/local-use-upstream-20260909"
$INTEGRATION_DIR = "../deepseek-harness-local-use-integration"
```

从刚刚 fetch 到的官方 HEAD 创建，而不是从 `local-use` 创建：

```powershell
git worktree add $INTEGRATION_DIR -b $INTEGRATION_BRANCH $UPSTREAM
Set-Location $INTEGRATION_DIR
```

验证：

```powershell
git status --short --branch
git rev-parse HEAD
git rev-parse upstream/master
```

此时 `HEAD` 应等于开始时记录的 `$UPSTREAM`。

建议开启 Git rerere，后续如果重复解决相同小冲突可自动复用：

```powershell
git config rerere.enabled true
```

## 6. 先验证纯官方基线可构建

在没有任何本地补丁之前执行：

```powershell
pnpm install --frozen-lockfile
pnpm run build
```

如果纯官方 HEAD 在你的机器上就失败，先记录失败，不要立即把它当成本地迁移问题。必要时再跑更窄的诊断命令。

这一阶段通过后，建议做一个标签式记录而不是 commit：

```powershell
git status --short
```

必须保持干净。如果安装过程修改了 lockfile 或受控文件，先查清原因。

## 7. 如何查看旧 local-use 的改动

不要 checkout 旧文件覆盖当前文件。常用查看方式：

查看某个旧文件完整内容：

```powershell
git show "$OLD_LOCAL`:packages/client/ui-attachment/src/ImageLightbox.tsx"
```

查看某个目录的本地历史差异：

```powershell
git diff $MERGE_BASE $OLD_LOCAL -- packages/client/ui-attachment
```

查看官方当前实现：

```powershell
git show "$UPSTREAM`:packages/client/ui-attachment/src/ImageLightbox.tsx"
```

把某个功能涉及的旧文件先列出来：

```powershell
git diff --name-status $MERGE_BASE $OLD_LOCAL -- packages/client/ui-attachment
```

只有确认某个文件本身是“纯本地新增、且官方没有同名/同职责替代”时，才考虑 `git restore --source=$OLD_LOCAL -- <path>`。对已经被官方修改过的核心文件，手工在官方版本上重做差异。

## 8. 功能迁移总表

按下面顺序做。每完成一项就运行该项的 focused tests 并单独 commit，不要等全部功能完成后一次提交。

| 功能 | 本次决定 | 迁移原则 |
|---|---|---|
| ModelSelect viewport fit | 不迁旧实现 | 官方已提供 portal、fixed 定位、viewport clamp、scroll/resize reposition，以官方为准 |
| 本地 Markdown 图片旧 resolver/RPC | 默认删除旧架构 | 官方已经通过 `MarkdownPathImages -> /api/file -> ctx.fs` 读取 Host 文件，不恢复旧 462 行 resolver |
| Windows Markdown 本地路径 | 建议保留为极薄补丁 | 只扩展前端绝对路径识别，不重建 durable image RPC |
| Advanced ImageLightbox | 保留并适配 | 保留缩放、拖拽、触摸、键盘、focus trap、scroll lock；以官方当前 labels/API 为底 |
| Mobile sidebar overlay | 保留并适配 | 使用当前官方 `rightbar`、`viewportWidth`、`narrowExpanded`，不要恢复旧 `details` 架构；窄屏时 AppFrame grid 第一 track 始终为 `0px`，SidebarRoot fixed drawer 的绘制宽度独立于 grid 占位，desktop 关闭 rail 仍为 `56px` |
| Responsive settings | 保留缺失的响应式布局 | 官方 DOM/section roster/labels 为准，只补 mobile CSS 和仍缺失的 focus 行为 |
| Settings/Menu keyboard focus | 只补官方仍缺的部分 | 不覆盖官方已经增加的 portal、焦点恢复、方向键行为 |
| Goal background-aware continuation | 保留并适配 | Jobs 用 Agent 对象身份判断；Subagent 适配当前 `ContinuableActivationRegistry` |
| `dsh-plugin-development` 自用 Skill | 保留 | 作为本地开发流程，不修改官方运行时架构 |
| 旧 alpha.2 集成 proposal / 旧生成物 | 不迁 | 旧历史由 Git 祖先保留，不把过期说明、版本、lockfile、generated output 再带进新树 |
### Mobile overlay acceptance

当 viewport 小于 `SIDEBAR_AUTO_COLLAPSE` 时，AppFrame 的 CSS grid 第一 track 在 sidebar 关闭和打开两种状态都必须是 `0px`；SidebarRoot 以独立的 fixed drawer width 绘制打开态，不能把 drawer 绘制宽度当作 grid 占位。desktop 关闭态仍使用 `SIDEBAR_COLLAPSED` 的 `56px` rail。

Mobile sidebar 的 Escape listener 只在 `event.key === 'Escape'` 且 `event.defaultPrevented === false` 时关闭 drawer；嵌套 menu、settings 或其他 overlay 已消费的 Escape 必须保持 sidebar 状态。AppFrame tests 必须覆盖窄屏关闭/打开时第一 track 为 `0px`，SidebarRoot tests 必须覆盖普通 Escape 与 `preventDefault()` 负例。

## 9. Phase A：Advanced ImageLightbox

优先迁这个，因为它与 Host、Session 协议耦合最小，可以先验证整个“官方底座 + 本地补丁”工作流。

重点文件：

```text
packages/client/ui-attachment/src/ImageLightbox.tsx
packages/client/ui-attachment/src/ImageLightbox.module.css
packages/client/ui-attachment/src/client/labels.ts
packages/client/ui-attachment/tests/
```

先比较：

```powershell
git diff $MERGE_BASE $OLD_LOCAL -- packages/client/ui-attachment
```

保留旧实现中仍然缺失于官方的行为：wheel pointer-centered zoom、bounded pan、pinch、double-click zoom、`+`/`-`/`0` keyboard controls、Tab focus trap、focus restoration、body scroll/touch lock、resize clamp 和资源 cleanup。

不要把旧 `labels.ts` 整文件覆盖到当前官方，因为官方 attachment labels 已经扩展。只把当前官方 `lightboxLabels` 缺失的 `zoomIn`、`zoomOut`、`resetZoom` 字段及对应 locale 加回来。

完成后至少运行：

```powershell
pnpm exec vitest run packages/client/ui-attachment
pnpm run typecheck
```

确认：

```powershell
git diff --check
git status --short
```

提交示例：

```powershell
git add packages/client/ui-attachment
git commit -m "local(ui-attachment): restore advanced image lightbox"
```

## 10. Phase B：Windows Markdown 本地图片路径

官方当前的主链路应该保持不动：

```text
AssistantMarkdown
  -> MarkdownPathImages
  -> same-origin /api/file?path=...
  -> SessionMediaReferences
  -> ctx.fs
```

不要恢复旧的：

```text
markdown-images.ts
assistant/markdown-image durable mapping
resolveMarkdownImage RPC
旧 Client projection
旧 attachment snapshot pipeline
```

官方现在已经能够让 settled assistant Markdown 中的 POSIX absolute path 通过 `/api/file` 展示，而且 `/api/file` 使用与 RPC 相同的 Connection trust/auth 机制，并由 `ctx.fs` provider 决定可读范围。

本地真正值得保留的差异是 Windows Host path。当前前端 `localPathMediaUrl()` 只接受以 `/` 开头的绝对路径，因此 `C:\Users\HJ\x.png` 或 `C:/Users/HJ/x.png` 不会被转换。

在 `packages/client/ui-chat/src/client/chat/AssistantMarkdown.tsx` 当前官方实现上增加非常窄的 lexical detector，例如同时接受：

```text
/absolute/posix/path.png
C:\absolute\windows\path.png
C:/absolute/windows/path.png
```

浏览器侧不要 import `node:path`。前端只负责判断“看起来是绝对 Host path”并 URL encode；真正的 Host 路径处理仍由 `/api/file` 和 Host 端 `path.isAbsolute()` / `ctx.fs` 完成。

先只做 drive-letter absolute path；除非你确实需要 UNC，再单独设计 `\\server\share\...`，不要顺手扩大输入面。

测试至少覆盖：

```text
POSIX absolute path -> /api/file
Windows backslash absolute path -> /api/file
Windows slash absolute path -> /api/file
relative path -> inert
//protocol-relative -> inert
http/https -> 保持原行为
非 http/https page protocol -> inert
```

运行：

```powershell
pnpm exec vitest run packages/client/ui-chat
pnpm run typecheck
```

在 Windows 实机还要用真实文件测试，例如让 Agent 最终回复：

```markdown
![test](C:/Users/HJ/path/to/test.png)
```

同时再测试反斜杠写法是否经过 Markdown parser 后仍按预期进入 resolver。若 Markdown parser 对裸反斜杠 destination 有转义影响，优先规范 Agent 输出使用 `C:/...`，不要为了接受任意 Markdown 语法而扩张 renderer。

提交示例：

```powershell
git add packages/client/ui-chat
git commit -m "local(ui-chat): support Windows local media paths"
```

## 11. Phase C：Mobile sidebar overlay

这一项不能把旧 `AppFrame.tsx` 或 `SidebarRoot.tsx` 整文件拿回来，因为官方 layout 已经从旧结构演进到当前 `rightbar` 模型，而且官方 store 已经拥有 `viewportWidth` / `narrowExpanded`。

当前目标只有三个：窄屏关闭 sidebar 时不保留 56px rail；打开时 sidebar 作为 fixed overlay 覆盖内容而不是挤压 center；移动端提供 trigger、backdrop、Escape 和焦点进入/恢复。

主要文件：

```text
packages/client/ui-layout/src/client/AppFrame.tsx
packages/client/ui-layout/src/client/index.ts
packages/client/ui-sidebar/src/client/SidebarRoot.tsx
packages/client/ui-sidebar/src/client/SidebarRoot.module.css
packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css
```

迁移要点：

1. 保留官方 `rightbar` 计算和当前 `panels.narrowExpanded` 状态。
2. 窄屏时 grid 的 sidebar contribution 应为 `0`，避免 center 被 rail 或 drawer 挤压。
3. drawer 自己仍需要一个展开宽度，因此把“grid 占用宽度”和“sidebar owner 实际绘制宽度”分开计算。
4. `SidebarOwnerProps` 增加 `mobile` 只作为 owner -> component 的明确输入，不建立第二套 store。
5. 窄屏关闭时显示 44px 左上 trigger；打开时显示 backdrop 和 fixed drawer。
6. Escape 只在 mobile drawer 打开时关闭；尊重已经被子 overlay `preventDefault()` 的 Escape。
7. drawer 打开后把焦点移入可交互项，关闭后恢复 trigger。
8. 不要迁旧实现中与移动端无关的品牌按钮行为变化。
9. Conversation header 只有在真实重叠时才增加 mobile trigger 的左侧预留。

重点比较：

```powershell
git diff $MERGE_BASE $OLD_LOCAL -- packages/client/ui-layout packages/client/ui-sidebar packages/client/ui-conversation/src/client/skeleton
```

运行：

```powershell
pnpm exec vitest run packages/client/ui-layout packages/client/ui-sidebar packages/client/ui-conversation
pnpm run typecheck
```

手工 Web 验证必须覆盖：desktop rail 正常、desktop resize 正常、窄屏关闭 center 不被挤压、窄屏打开 drawer overlay、backdrop 点击关闭、Escape 关闭、焦点恢复、浏览器 resize 从 desktop <-> mobile 不留下错误状态。

提交示例：

```powershell
git add packages/client/ui-layout packages/client/ui-sidebar packages/client/ui-conversation
git commit -m "local(client): restore mobile sidebar overlay"
```

## 12. Phase D：Responsive settings 和 focus ownership

官方 Settings 内容、section roster、ConnectionIndicator、preset 结构和当前 Menu primitive 都是权威来源。不要恢复旧 `AgentPresetRow`，不要把旧 SettingsRoot 整文件覆盖。

先比较：

```powershell
git diff $MERGE_BASE $OLD_LOCAL -- packages/client/ui-settings-general packages/client/ui-settings-models packages/client/ui-settings-plugins packages/client/ui-agent-preset packages/client/locale packages/client/ui-conversation/src/client/settings packages/client/ui-permission-presets packages/client/ui-theme packages/client/ui-primitives/src/Menu.tsx
```

优先迁 CSS：窄屏 Settings panel 使用可用 viewport 高度、safe-area、纵向 panel 布局、横向可滚动 section nav、较小 header/option padding；Models、Plugins、Preset、Language、Permission、Appearance、EnterBehavior 只补仍然存在的窄屏布局问题。

JS/TSX 的 focus 行为逐项和官方比较。官方已经拥有的行为不再本地维护。只保留测试能证明仍缺失的 modal Tab containment、nested overlay Escape ownership、disabled item skipping 或 opener restoration。

特别注意：旧 `Menu.tsx` 中的 createPortal、打开时聚焦、关闭恢复、Escape、Tab close、ArrowUp/ArrowDown/Home/End 等能力，官方当前可能已经具备。先读官方代码和测试，再决定是否存在本地增量。

运行：

```powershell
pnpm exec vitest run packages/client/ui-settings-general packages/client/ui-settings-models packages/client/ui-settings-plugins packages/client/ui-agent-preset packages/client/ui-primitives
pnpm run typecheck
pnpm run verify-client-ui-i18n
```

实机验证至少覆盖 320/375/430px 宽度、桌面宽度、键盘 Tab/Shift+Tab、Settings 内下拉菜单打开后 Escape 优先关闭最上层 overlay、关闭 Settings 后焦点回到 opener。

提交示例：

```powershell
git add packages/client/ui-settings-general packages/client/ui-settings-models packages/client/ui-settings-plugins packages/client/ui-agent-preset packages/client/locale packages/client/ui-conversation packages/client/ui-permission-presets packages/client/ui-theme packages/client/ui-primitives
git commit -m "local(client): restore responsive settings behavior"
```

## 13. Phase E：Goal background-aware continuation

这一项涉及生命周期和并发，不要照抄旧代码。开始前重新阅读根 `AGENTS.md`、`docs/defensive-patterns.md` 和相关 package README/AGENTS。

目标语义保持为：同一个 Agent object 还有自己的后台 Jobs 或可继续的 direct-child Subagent activation 时，Goal driver 不开始下一轮；后台工作结束后主动唤醒 Goal driver；其他 Agent、terminal job、cold persisted child 不阻塞当前 Agent。

Jobs 侧保持 exact object identity。不要用仅比较 session id 的公共 `list()` 替代，因为旧本地语义明确区分同 session 下不同 Agent 对象生命周期。

推荐在当前 `JobRegistry` service 上保留一个极小查询，例如：

```text
hasActive(owner: Agent): boolean
```

实现依据 active job 的真实 owner object 判断，并把 `running` / `stopping` 视为 active。

Subagent 侧必须适配官方当前的 `ContinuableActivationRegistry`；不要把旧版本 manager 中已经被官方重构掉的 activation map 重新加回来。把 `hasPendingContinuations(parent)` 放在当前 activation ownership 所在的 registry，再通过现有 manager/runtime 暴露给 Goal driver 所需的依赖层。

Goal driver 继续保证：异步 pre-step delegate 前后都重新检查后台状态，避免“检查为空 -> 等待异步步骤 -> 期间新后台任务启动 -> 仍然开下一轮”的 race。

主要范围：

```text
packages/goal/goal-round-driver
packages/jobs/jobs
packages/jobs/jobs-local
packages/subagent/subagent
```

比较：

```powershell
git diff $MERGE_BASE $OLD_LOCAL -- packages/goal/goal-round-driver packages/jobs/jobs packages/jobs/jobs-local packages/subagent/subagent
```

运行：

```powershell
pnpm exec vitest run packages/goal/goal-round-driver packages/jobs/jobs packages/jobs/jobs-local packages/subagent/subagent
pnpm run typecheck
pnpm run lint
```

测试至少证明：same Agent running job 阻塞、stopping job 阻塞、terminal job 不阻塞、other Agent job 不阻塞、live direct-child continuable activation 阻塞、cold persisted child 不阻塞、job/subagent completion 会 wake driver、async pre-step race 被二次检查挡住。

如果该改动改变 `SessionEventMap`、SDK projection 或 model-visible log，按当前根 `AGENTS.md` 同步 TypeScript/Python SDK expected output 和 keyless snapshot；如果只是生命周期查询且没有新 durable/model-visible data，不要为了复刻旧树而修改生成物。

提交示例：

```powershell
git add packages/goal/goal-round-driver packages/jobs/jobs packages/jobs/jobs-local packages/subagent/subagent
git commit -m "local(goal): wait for owned background work"
```

## 14. Phase F：保留本地开发 Skill 和必要自用文档

`dsh-plugin-development` 是自用开发流程，应保留，但不要把旧 alpha.2 集成 proposal、旧生成 catalog、旧 package version 或旧 lockfile 当成需要迁移的功能。

本文件本身也在这个目录中，因此最终集成分支必须把当前自用 skill 迁入，否则后面的 `ours` ancestry merge 不会把旧树内容自动带进来。

建议先比较官方是否出现同名内容：

```powershell
git ls-tree -r --name-only $UPSTREAM -- .agents/skills/dsh-plugin-development
```

如果官方仍没有这个 skill，可以直接从旧自用分支恢复整个目录，然后审阅：

```powershell
git restore --source=$OLD_LOCAL -- .agents/skills/dsh-plugin-development
```

重点保留当前自用约束：fork checkout、HMR/source/artifact plane、protected ports `3079`/`3080`、测试实例使用其他 loopback 端口、必要时独立 `$DSH_HOME`。

如果根 `AGENTS.md` 中只有一行本地 protected-port 提醒有价值，不要恢复整个旧 `AGENTS.md`；在当前官方根文件上手工加最小一行即可。

这一阶段不恢复：

```text
旧 2026-08-31 alpha.2 integration proposal/implemented note
旧生成的 config/event/persistence/catalog 输出
旧 pnpm-lock.yaml
为了旧 Markdown image RPC 添加的 package dependencies
已经被官方替代的 ModelSelect note/代码
```

运行：

```powershell
pnpm run verify-skill-invocation-metadata
pnpm run test:docs
pnpm run doc-sync
```

提交示例：

```powershell
git add .agents/skills/dsh-plugin-development AGENTS.md
git commit -m "local(dev): preserve DSH plugin development workflow"
```

## 15. 不恢复旧 durable Markdown image pipeline 的原因

旧 `local-use` 的 durable pipeline 有一个官方当前 `/api/file` 不具备的特性：图片首次解析后可以存入 attachment，因此原始文件之后被删除或覆盖，历史消息仍能显示旧字节。

本次默认不保留这个能力，因为它会重新引入 Session event、Remote method、attachment authorization、Client projection、generated Typert、snapshot 和大量测试，维护面明显大于当前需求。

如果日后明确需要“历史消息中的本地图片内容必须冻结”，把它作为独立 feature 重新设计在当前官方架构上，不要在本次同步中顺手恢复旧 `markdown-images.ts`。

## 16. ModelSelect 明确不迁

完成所有迁移后检查：

```powershell
git diff $UPSTREAM...HEAD -- packages/client/ui-model-selection
```

正常情况下应为空。只有你实机验证发现官方当前 viewport fit 有具体 regression，才新开一个最小修复；不要因为旧 `local-use` 曾修改过它就保留差异。

## 17. 每个阶段的提交纪律

每个功能一个 commit。不要把多个独立功能 squash 成一个大提交，也不要在某功能 commit 中夹带 lockfile、generated output 或格式化噪声。

每次提交前：

```powershell
git status --short
git diff --check
git diff --stat
git diff
```

如果某个 generator 必须更新文件，先确认是当前源码变化导致，再运行官方 generator；不要从旧 `local-use` 恢复 generated file。

建议保持类似历史：

```text
upstream HEAD
  local(ui-attachment): restore advanced image lightbox
  local(ui-chat): support Windows local media paths
  local(client): restore mobile sidebar overlay
  local(client): restore responsive settings behavior
  local(goal): wait for owned background work
  local(dev): preserve DSH plugin development workflow
```

实际 commit 数量可以根据当前官方状态减少。某项已经完全官方化时直接跳过，不创建空的“保留”提交。

## 18. 集成分支最终静态验证

所有功能迁完后，先确认你真正相对官方保留了什么：

```powershell
git diff --stat $UPSTREAM...HEAD
git diff --name-status $UPSTREAM...HEAD
```

逐项确认没有以下残留：旧 Session Markdown image RPC、大量旧 generated Typert 文件、旧 package versions、旧 lockfile、旧 `details` layout、旧 Subagent activation ownership、重复 General preset row、ModelSelect 本地补丁。

然后运行最终检查。至少：

```powershell
pnpm run build
pnpm run typecheck
pnpm run lint
pnpm run hygiene
pnpm run test:docs
pnpm run doc-sync
```

由于这是跨多个 package 的自用分支同步，建议再跑：

```powershell
pnpm run test
```

如果改动触及 expected-output owner：

```powershell
pnpm run test:expected
```

如果改动触及 model-visible/session transcript 行为：

```powershell
pnpm run test:snapshot
```

不要看到 snapshot 失败就直接 refresh；先确认差异是预期行为，再按官方流程刷新。

最后再运行：

```powershell
git diff --check $UPSTREAM...HEAD
git status --short --branch
```

工作树必须干净。

## 19. Windows 本机 Web 实机验证

编译和 unit test 通过后，不直接碰你现有的 `127.0.0.1:3079` / `127.0.0.1:3080` 服务。

使用独立测试端口，例如：

```powershell
pnpm dsh --profile web --host 127.0.0.1 --port 3090 --no-open
```

如果 3090 已占用，换一个空闲 loopback port。若测试可能写 Session、Workspace、Settings、Credential 或持久化数据，再给测试进程设置独立 `DSH_HOME`，不要只靠不同端口隔离。

至少验证：

1. Web 正常启动且能创建/打开 Session。
2. Desktop 宽度下 sidebar、rightbar、settings 没有 regression。
3. Mobile viewport 下 sidebar 是 overlay，不挤压 chat center。
4. Settings 在 320/375/430px 下可完整操作。
5. ImageLightbox 的 mouse、wheel、drag、double-click、keyboard、focus、关闭后 scroll 状态正常。
6. Agent 最终 Markdown 回复引用真实 Windows `C:/.../image.png` 时图片能显示。
7. 相对路径、无效路径、超过限制或不可读文件失败时不会破坏整条消息渲染。
8. `/api/file` 请求只有已认证 Web session 可用，页面刷新后 cookie/session flow 仍正常。

本地图片只在 assistant message settled 后变成真正图片；streaming 阶段保持 inert/fallback 是官方设计，不要把它误判为 bug。

## 20. VPS relay / 手机访问验证

如果你的实际使用链路是：

```text
Windows DSH Host -> VPS relay/reverse proxy -> 手机浏览器
```

在本地 loopback 验证通过后，再用你真实链路测试同一张 Host 本地图片。

手机浏览器不需要直接访问 Windows 文件系统。正确链路是：

```text
手机页面中的 <img>
 -> 同源 https://你的外部地址/api/file?path=...
 -> relay/proxy
 -> Windows DSH Host
 -> ctx.fs 读取文件
 -> response bytes 返回手机
```

如果聊天 RPC 正常但图片 403/401，先检查 proxy 是否保持浏览器看到的 authority 和 Host/Origin trust 语义。`trustedHosts` 只扩展 Host/Origin reachability fence，不等于取消 browser authentication。

特别检查 reverse proxy 不要把浏览器的外部 Origin 与后端收到的 Host 搞成不匹配的 authority。必要时观察 Network 面板中的 `/api/file` status、request URL、Origin/Cookie 和后端日志，再判断是路径问题还是 trust/auth 问题。

## 21. 验证通过后再把旧 local-use 接入新历史

到这里临时集成分支已经完成所有代码和测试，但旧 `local-use` 还停在同步前的旧 HEAD。这正是需要的状态。

先再次记录：

```powershell
git rev-parse HEAD
git rev-parse $OLD_LOCAL
git status --short
```

工作树必须干净。

然后在临时集成分支做一次只记录祖先、不改变文件树的 merge：

```powershell
git merge -s ours --no-ff $OLD_LOCAL -m "merge: preserve pre-upstream local-use ancestry"
```

这里 `-s ours` 的含义是：第二个 parent 记录旧 `local-use`，但最终 tree 完全采用当前已经测试通过的集成 tree。它不是用来“解决功能冲突”的；所有功能必须在前面已经人工迁移完成。

马上验证这次 merge 没改任何内容：

```powershell
git diff HEAD^1 HEAD --exit-code
```

该命令必须无输出并返回 0。

再验证两个祖先都存在：

```powershell
git merge-base --is-ancestor $UPSTREAM HEAD
if ($LASTEXITCODE -ne 0) { throw "upstream is not an ancestor" }

git merge-base --is-ancestor $OLD_LOCAL HEAD
if ($LASTEXITCODE -ne 0) { throw "old local-use is not an ancestor" }
```

查看 merge parents：

```powershell
git show --no-patch --pretty=raw HEAD
```

应有两个 parent：第一 parent 是刚刚测试通过的集成 head，第二 parent 是 `$OLD_LOCAL`。

## 22. 把 local-use 安全快进到集成结果

由于上一步已经把旧 `local-use` 作为祖先，新结果现在允许普通 fast-forward。

如果原来的 `local-use` checkout 是另一个 worktree，回到那个 worktree：

```powershell
Set-Location <你的原始仓库目录>
git status --short --branch
```

确保没有未提交文件会被更新覆盖。

然后：

```powershell
git switch local-use
git merge --ff-only $INTEGRATION_BRANCH
```

绝对不要在这里用：

```text
git reset --hard
 git push --force
```

再次验证：

```powershell
git rev-parse local-use
git rev-parse $INTEGRATION_BRANCH
git status --short --branch
```

两者应相同。

## 23. 推送新的 local-use

因为旧远端 `origin/local-use` 已经是新结果的祖先，正常情况下应能普通 fast-forward push：

```powershell
git fetch origin --prune
git merge-base --is-ancestor origin/local-use local-use
if ($LASTEXITCODE -ne 0) { throw "origin/local-use moved; inspect before push" }

git push origin local-use
```

如果 ancestry check 失败，不要 force。先执行：

```powershell
git log --graph --oneline --decorate --all -n 80
```

确认是不是你在另一台机器或 GitHub 上更新过 `local-use`，再重新整合那个远端变化。

推送后验证：

```powershell
git fetch origin
git rev-parse local-use
git rev-parse origin/local-use
```

应一致。

## 24. 最终结果应呈现什么样子

理想的 `git log --first-parent --oneline` 应主要呈现：

```text
merge: preserve pre-upstream local-use ancestry
local(dev): preserve DSH plugin development workflow
local(goal): wait for owned background work
local(client): restore responsive settings behavior
local(client): restore mobile sidebar overlay
local(ui-chat): support Windows local media paths
local(ui-attachment): restore advanced image lightbox
<official upstream HEAD>
...
```

具体顺序可以根据实现依赖调整，但第一 parent 主线始终应该清晰：官方 HEAD -> 少量本地功能 commits -> ancestry merge。

`git diff upstream/master...local-use` 应只剩仍有意维护的自用差异，而不是旧版本整个产品树。

## 25. 未来再次同步官方时

下一次官方更新不要再从旧共同祖先重复做大迁移。完成本次重建后，`local-use` 已经以新官方为第一 parent，并把旧历史接入祖先图；未来通常可以从新的 `upstream/master` 再建一个临时集成分支，仅审查这几个 `local(...)` commits 是否仍有必要。

每次仍遵守同一规则：官方已经实现的本地能力直接删除；官方架构变化时在新接口上重新表达最小本地需求；先在临时分支完成 build/test/runtime verification，再通过 ancestry merge + `--ff-only` 推进 `local-use`。

## 26. 本次最重要的检查清单

- [ ] `git fetch upstream --prune` 后记录真实 `UPSTREAM`、`OLD_LOCAL`、`MERGE_BASE`。
- [ ] 临时集成分支从 `UPSTREAM` 创建，不从 `local-use` 创建。
- [ ] 纯官方基线 `pnpm install --frozen-lockfile && pnpm run build` 成功。
- [ ] ModelSelect 旧补丁不迁。
- [ ] 旧 durable Markdown image RPC/resolver 不迁。
- [ ] 如有需要，只增加 Windows absolute local media path 的极薄支持。
- [ ] Advanced ImageLightbox 在当前官方 attachment APIs 上重做。
- [ ] Mobile sidebar 使用当前 `rightbar` / `narrowExpanded` 架构重做。
- [ ] Settings 只补官方仍缺失的 responsive/focus 行为。
- [ ] Goal continuation 适配当前 JobRegistry / ContinuableActivationRegistry，不恢复旧 ownership 结构。
- [ ] 本地 `dsh-plugin-development` Skill 和本文件被迁入新集成树。
- [ ] 不恢复旧 alpha.2 proposal、旧 generated outputs、旧 versions、旧 lockfile。
- [ ] Focused tests 按阶段全部通过。
- [ ] 最终 `build`、`typecheck`、`lint`、`hygiene`、`doc-sync`、全量 `test` 按需要通过。
- [ ] Windows 独立测试端口验证通过，未触碰 3079/3080。
- [ ] Windows local image 真路径验证通过。
- [ ] VPS/手机真实链路的 `/api/file` 验证通过。
- [ ] `git merge -s ours $OLD_LOCAL` 后 `git diff HEAD^1 HEAD --exit-code` 为 0。
- [ ] `UPSTREAM` 和 `OLD_LOCAL` 都是最终 HEAD 的 ancestor。
- [ ] `local-use` 只通过 `git merge --ff-only <integration-branch>` 前进。
- [ ] push 前确认 `origin/local-use` 仍是新 `local-use` 的 ancestor。

如果任何阶段发现“官方已经提供了同等或更强能力”，优先删掉对应本地补丁并更新测试预期。这个原则比机械保留旧功能代码更重要。