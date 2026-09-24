# local-use 0.1.7-rc.1 集成整改指南

适用分支：`integrate/local-use-0.1.7-rc.1-20260924`

用途：指导本地继续修改本次 `local-use` → `dsh 0.1.7-rc.1` 集成结果。本文记录当前审核发现、推荐的最小修法、验证路径，以及最终允许 fast-forward `local-use` 的条件。

这不是新的产品需求。整改时优先保持 RC1 当前 ownership 和 API，不要为了“恢复旧 local-use”扩大补丁面。

## 1. 当前审核结论

当前集成结构可以继续使用：

- RC1 `master` 已进入当前分支 ancestry；
- 旧 `local-use` 仍是当前分支 ancestor；
- 不需要重新开始 merge、rebase 或整串 cherry-pick；
- Markdown 本地图片已经采用 RC1 官方路径；
- Advanced ImageLightbox 已迁到 `ui-primitives`；
- Goal 已使用当前 Jobs 查询/event API，没有恢复旧 Jobs `hasActive(Agent)` / `onJobsChanged()`。

当前仍有三项必须在合回 `local-use` 前完成：

1. 补齐 `file-upload-round` 新增但未提交的 ImageLightbox golden；
2. 修复 mobile Sidebar 与 Settings/Menu 的 Escape ownership；
3. 恢复本地 `dsh-plugin-development` Skill、RC1 integration plan，以及 root `AGENTS.md` 中仍有效的 local-use standing orders。

另有两项建议收敛：

1. 让 `columns.ts` 回到 RC1 原 API，mobile zero-track 只在 AppFrame 传 `collapsedWidth = 0`；
2. 重新确认 `SubagentRuntime.hasPendingContinuations(parent)` 是否真的要成为 public service API。

## 2. 推荐修改顺序

按以下顺序处理：

1. Escape ownership；
2. 缺失 golden；
3. 本地 Skill / plan / AGENTS 恢复；
4. `columns.ts` API 收敛；
5. Subagent public API 决策；
6. focused tests；
7. replay Web tests；
8. repo checks；
9. 最终 integrated review。

不要先跑完整测试再改代码；先让已知 blocker 消失。

## 3. 必修：mobile Sidebar 不得抢内层 overlay 的 Escape

### 3.1 当前问题

当前 `packages/client/ui-sidebar/src/client/SidebarRoot.tsx` 在 mobile drawer 打开时注册：

```ts
document.addEventListener('keydown', onKeyDown)
```

Escape 路径：

```ts
if (event.key !== 'Escape' || event.defaultPrevented) return
event.preventDefault()
toggleSidebar()
```

Settings 位于 `packages/client/ui-settings-general/src/client/SettingsRoot.tsx`，它使用 `window.addEventListener('keydown', ...)`，并先检查：

```ts
if (event.defaultPrevented) return
```

Menu 也在 `document` 上监听 Escape。

真实键盘事件从 focused element 冒泡时，Sidebar 的 `document` listener 可能先于 Settings 的 `window` listener，也可能先于后挂载的 Menu listener 执行。结果是一按 Escape：

```text
Sidebar preventDefault()
→ Sidebar toggleSidebar()
→ Settings/Menu 看到 defaultPrevented
→ 内层 overlay 不关闭
```

目标行为应该是“最上层 overlay 先消费 Escape；Sidebar 只在 Escape 没被内层 UI 消费时关闭 drawer”。

### 3.2 推荐最小修法

不要引入新的全局 overlay manager，也不要重写 Settings/Menu ownership。

优先只修改 mobile Sidebar 的 Escape fallback，让它在本轮事件传播完成后再决定是否关闭：

```ts
const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape') return
  queueMicrotask(() => {
    if (event.defaultPrevented) return
    toggleSidebar()
  })
}
```

关键点：

- Sidebar 不要在 `document` listener 当场 `preventDefault()`；
- Menu、Settings、Lightbox 等更内层 owner 可以先消费同一 Escape；
- microtask 再读取同一个 `event.defaultPrevented`；
- 没有内层 consumer 时才关闭 drawer。

如果当前目标环境对 `queueMicrotask` 有额外约束，使用仓库已有的等价 defer 机制；不要用长 timeout 解决事件 ownership。

### 3.3 必补测试

现有 Sidebar unit test 可以继续保留“未消费 Escape 关闭 drawer”，但“预先手工 `preventDefault`”不能作为唯一 nested-overlay 证据。

必须补一个真实组合 Web test，建议放在已有 mobile Settings 场景的 `apps/web/tests/settings-chrome.e2e.ts`：

```text
mobile viewport
→ open sidebar drawer
→ open Settings
→ press Escape
→ Settings dialog closes
→ sidebar drawer remains open
→ press Escape again
→ sidebar drawer closes
```

再补一个 Menu 场景：

```text
mobile drawer
→ open one Menu inside drawer/settings
→ Escape
→ Menu closes
→ drawer stays open
```

如果现有 Web composition 很难稳定打开一个 Menu，可以先用跨组件 integration test 固定 listener 顺序，但最终至少保留一个真实 browser overlay-stack 断言。

### 3.4 验收

- Settings 打开时 Escape 只关闭 Settings；
- Menu 打开时 Escape 只关闭 Menu；
- Settings/Menu 关闭后再次 Escape 才关闭 mobile drawer；
- backdrop click 仍直接关闭 drawer；
- desktop Sidebar 不新增 Escape 行为；
- 不通过 DOM class/name 特判 overlay 类型。

## 4. 必修：提交缺失的 ImageLightbox golden

### 4.1 当前问题

`apps/web/tests/file-upload-round.e2e.ts` 新增：

```ts
const IMAGE_PREVIEW_EXPECTED =
  fileURLToPath(new URL('./expected/file-upload-round/image-preview.expected.md', import.meta.url))
```

Preview tab 中调用：

```ts
await compareOrRefreshGolden(IMAGE_PREVIEW_EXPECTED, imagePreview, MODE)
```

但当前没有：

```text
apps/web/tests/expected/file-upload-round/image-preview.expected.md
```

`compareOrRefreshGolden()` 在 replay 模式遇到缺失 golden 会直接失败，所以当前分支不能满足最终 Web replay gate。

### 4.2 生成方式

先完成 Lightbox 行为修改，再生成 golden。

PowerShell：

```powershell
$env:DSH_SNAPSHOT = "refresh"
pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/file-upload-round.e2e.ts
```

然后：

```powershell
git status --short
git diff -- apps/web/tests/expected/file-upload-round
```

必须人工检查生成结果。不要因为 refresh 顺便改了其它 golden 就全部提交，只保留当前行为变化能解释的输出。

### 4.3 replay 验证

```powershell
$env:DSH_SNAPSHOT = "replay"
pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/file-upload-round.e2e.ts
```

最终证据必须来自 replay，不是 refresh。

### 4.4 验收

- `image-preview.expected.md` 已提交；
- 内容对应 125% zoom 的稳定 ARIA surface；
- replay 通过；
- 没有无解释的其它 snapshot/golden churn。

## 5. 必修：恢复 local-use 开发 Skill 与 standing orders

### 5.1 当前问题

RC1 tree adoption 后，当前 tree 缺失：

```text
.agents/skills/dsh-plugin-development/
```

之前专门写的：

```text
.agents/skills/dsh-plugin-development/references/local-use-0.1.7-rc.1-integration-plan.md
```

也没有保留。

root `AGENTS.md` 中原 local-use 两条本地规则也没有恢复：

- upstream sync 后必须执行完整 `pnpm run build`；
- `3079` / `3080` 是用户管理的 Web 端口，自动测试和临时实例不能占用。

### 5.2 恢复 Skill

先从旧 `local-use` 恢复整个本地 Skill：

```powershell
git restore --source=local-use -- .agents/skills/dsh-plugin-development
```

然后先审阅再提交，重点看：

```text
.agents/skills/dsh-plugin-development/SKILL.md
.agents/skills/dsh-plugin-development/references/agent-turn-lifecycle.md
.agents/skills/dsh-plugin-development/references/official-docs.md
.agents/skills/dsh-plugin-development/references/typert-remote.md
.agents/skills/dsh-plugin-development/references/local-use-upstream-integration.md
```

凡是引用旧 Jobs/Subagent/UI owner、旧版本号或旧 upstream integration 流程的内容，都按 RC1 当前代码修正。

不要恢复已经被 RC1 官方实现替代的 Markdown resolver、Menu patch 等旧设计说明。

### 5.3 恢复本次 integration plan

本次计划文档仍在当前分支历史里，但 tree adoption 时被删除。

本地定位创建该文件的 commit：

```powershell
$PLAN_PATH = ".agents/skills/dsh-plugin-development/references/local-use-0.1.7-rc.1-integration-plan.md"
$PLAN_COMMIT = git log --diff-filter=A --format=%H -n 1 -- $PLAN_PATH
git restore --source=$PLAN_COMMIT -- $PLAN_PATH
```

恢复后以当前实现为准更新：

- Goal 实际实现；
- Subagent API 决策；
- mobile Sidebar 最终 Escape 方案；
- Lightbox tests；
- 最终 verification commands。

### 5.4 root AGENTS.md 只手工恢复本地规则

不要执行：

```powershell
git restore --source=local-use -- AGENTS.md
```

这会覆盖 RC1 新增的 standing orders。

只在 RC1 当前 `AGENTS.md` 的 contributor/check 区域手工加入两条最小规则：

```text
- After syncing upstream into local-use, run the full pnpm run build.
- Protected Web ports: 3079/3080 are user-managed; test DSH on another loopback port.
```

第二条应链接到恢复后的 `dsh-plugin-development` Skill 的 protected-port section。

### 5.5 验收

- `dsh-plugin-development/SKILL.md` 存在；
- Skill references 不把旧 RC 前 API 写成当前事实；
- RC1 integration plan 存在；
- root `AGENTS.md` 仍以 RC1 为主体，只增加 local-use 最小 standing orders；
- `3079` / `3080` 保护规则有 canonical owner；
- 没有整体覆盖旧 `AGENTS.md`。

## 6. 建议收敛：让 columns.ts 回到 RC1 API

### 6.1 当前变化

RC1 原接口：

```ts
export function computeColumns(
  viewport: number,
  sidebar: number,
  rightbar: number,
  collapsedWidth = SIDEBAR_COLLAPSED,
): Columns
```

当前集成改成：

```ts
export interface ColumnOptions {
  sidebarTrack?: 'rail' | 'none'
}
```

mobile overlay 实际只需要“collapsed track = 0”，RC1 原有第 4 参数已经能表达。

### 6.2 推荐修法

优先恢复 RC1 `columns.ts`，在 `AppFrame.tsx` 决定数字：

```ts
const collapsedWidth =
  narrow || darwin || windowsTitlebar
    ? 0
    : SIDEBAR_COLLAPSED
```

然后继续使用：

```ts
computeColumns(viewport, sidebar, rightbar, collapsedWidth)
```

mobile drawer 的 expanded width 仍通过 Sidebar owner prop 独立传递，不让 grid solver 了解“mobile”概念。

### 6.3 收敛收益

- `columns.ts` 可以与 RC1 保持零 diff 或极小 diff；
- 不新增 `ColumnOptions` public type；
- 后续吸收 upstream column solver 修改更简单；
- viewport/platform policy 留在真正拥有这些信息的 `AppFrame`。

### 6.4 必须保留的测试

```text
desktop collapsed → 56px
darwin collapsed → 0px
windows-titlebar collapsed → 0px
viewport < 1024 → 0px
mobile open/closed → grid track 始终 0
mobile → desktop → 恢复原 sidebar width preference
```

## 7. 建议决策：Subagent pending query 是否公开

当前新增：

```text
ContinuableActivationRegistry.hasPending(parent)
SubagentContinuationManager.hasPendingContinuations(parent)
SubagentRuntime.hasPendingContinuations(parent)
```

`SubagentRuntime.hasPendingContinuations(parent)` 已进入 public service surface，并进入 Cordis API catalog。Goal 是当前明确 consumer。

两种方向都可以，但必须明确：

### A. 保留 public API

如果希望其它插件也能查询“exact Agent 是否拥有 resident direct continuable child”，可以保留。

要求：

- README 明确 stable semantics；
- exact Agent identity、direct child、resident Activation 都写清楚；
- one-shot 和 cold durable Session 明确不计；
- Cordis catalog 由 generator 更新，不手改。

### B. 收回为私有 capability

如果查询只服务 Goal scheduler，就不要为了一个 consumer 扩大 public Subagent API。改成最薄的 private closure/capability，让 Goal 消费内部能力。

这项不是当前 blocker，但最终合并前要做明确选择，不留下“先公开，以后再说”的无主 API。

## 8. 当前不需要重做的部分

以下方向继续保留。

### Markdown local images

继续使用 RC1：

```text
AssistantMarkdown
MarkdownPathImages
workspace-path
localPathMediaUrl(...)
fileMediaUrl(...)
```

保留 Windows forward-slash path 覆盖，不恢复旧 `MarkdownImage.tsx` / local resolver pipeline。

### Advanced ImageLightbox

继续由：

```text
packages/client/ui-primitives/src/ImageLightbox.tsx
```

拥有。

保留 wheel zoom、control zoom、keyboard zoom、reset、double-click、pointer pan、pinch、scale clamp、focus trap、opener restore、body scroll/touch lock。

### Goal Jobs integration

继续使用：

```ts
ctx.get('jobs')?.list(agent.session.id)
jobs.events.subscribe(...)
```

不要恢复旧：

```text
JobRegistry.hasActive(Agent)
JobRegistry.onJobsChanged(...)
```

### Header / Brand

继续保留：

- title/lineage/actions/utilities 可横向滚动；
- corner fixed；
- 非 macOS brand collapse；
- macOS brand 继续作为 drag surface；
- New Session 保持独立按钮。

## 9. Focused verification

已知问题修完后先跑 focused tests。

### Client

```powershell
pnpm exec vitest run packages/client/ui-sidebar/tests/sidebar-root.client.spec.tsx packages/client/ui-settings-general/tests/settings-root.client.spec.tsx packages/client/ui-primitives/tests/atoms.client.spec.tsx packages/client/ui-primitives/tests/image-lightbox.client.spec.tsx packages/client/ui-layout/tests/app-frame.client.spec.tsx packages/client/ui-layout/tests/columns.client.spec.ts packages/client/ui-conversation/tests/skeleton.client.spec.tsx
```

### Goal / Subagent

```powershell
pnpm exec vitest run packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts packages/subagent/subagent/tests/continuation.spec.ts
```

### Targeted Web replay

golden 已生成并提交后：

```powershell
$env:DSH_SNAPSHOT = "replay"
pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/file-upload-round.e2e.ts apps/web/tests/settings-chrome.e2e.ts apps/web/tests/sidebar-title-hover-scroll.e2e.ts apps/web/tests/goal-background.e2e.ts apps/web/tests/markdown-images.e2e.ts
```

这些通过后再进入 repo-level checks。

## 10. 最终 repo checks

准备 fast-forward 回 `local-use` 前：

```powershell
pnpm run test:gui
$env:DSH_SNAPSHOT = "replay"
pnpm run test:web
pnpm run typecheck
pnpm run lint
pnpm run build
pnpm run hygiene
pnpm run doc-sync
pnpm run test
git status --short
git diff master...HEAD --stat
```

工作树必须 clean。不要用 refresh 模式作为最终通过证据。

## 11. 最终人工 Web 检查

临时 Web 实例不要使用 `3079` / `3080`。

### Mobile overlay stack

```text
320 / 375 / 430
sidebar open
Settings open
Escape → Settings only
Escape → Sidebar
```

再验证：

```text
sidebar open
Menu open
Escape → Menu only
Escape → Sidebar
```

### Lightbox

```text
open
zoom in/out
wheel
keyboard + - 0
double click
drag
pinch
reset
Escape
opener focus restore
```

### Header

```text
<= 600px
title/lineage/actions/utilities horizontal scroll
corner stays fixed and clickable
```

### Platform chrome

至少确认代码/test 没有破坏：

```text
ordinary Web rail
Windows titlebar
macOS drag surface
narrow macOS zero-track trigger
```

## 12. 本轮不要做

整改过程中不要：

1. 重新 merge `master`；
2. rebase 整个 integration branch；
3. 把旧 `local-use` 文件整体 checkout 回来；
4. 用旧 root `AGENTS.md` 覆盖 RC1；
5. 恢复旧 Markdown resolver；
6. 恢复旧 Menu keyboard implementation；
7. 给 Jobs 重新加旧 local-use API；
8. 为修 Escape 引入新的全局 overlay framework；
9. 盲目提交 refresh 产生的所有 golden；
10. 修改 `3079` / `3080` 上用户管理的实例。

## 13. 推荐 commit 切分

```text
fix(local-ui): preserve nested escape ownership in mobile sidebar
test(web): record advanced image preview golden
docs(local-use): restore local development guidance
refactor(local-ui): reuse rc1 collapsed-width column contract
```

如果决定调整 Subagent API，再单独一个 commit。不要把这些整改揉成一个大 commit。

## 14. 可以合回 local-use 的条件

全部满足后才执行：

```powershell
git switch local-use
git merge --ff-only integrate/local-use-0.1.7-rc.1-20260924
```

检查表：

- [ ] `image-preview.expected.md` 已提交且 replay 通过；
- [ ] mobile Sidebar 不再抢 Settings/Menu Escape；
- [ ] 有真实 browser test 覆盖 overlay Escape 顺序；
- [ ] `dsh-plugin-development` Skill 已恢复并按 RC1 刷新；
- [ ] RC1 integration plan 已恢复；
- [ ] root `AGENTS.md` 恢复 local-use build + protected-port rules，未覆盖 RC1 内容；
- [ ] `columns.ts` 已收敛或有明确保留理由；
- [ ] Subagent public pending-query 已明确保留或收回；
- [ ] focused client tests 通过；
- [ ] Goal/Subagent focused tests 通过；
- [ ] targeted Web replay 通过；
- [ ] full `test:web` replay 通过；
- [ ] `typecheck`、`lint`、`build`、`hygiene`、`doc-sync` 通过；
- [ ] 最终 `pnpm run test` 通过；
- [ ] 工作树 clean；
- [ ] 最终 diff 中没有旧 Markdown/Menu/Jobs 实现回流；
- [ ] `master` 与旧 `local-use` 都仍是最终 HEAD 的 ancestor。

满足这些条件后，再做一次只针对最终 diff 的集成审核；第二轮审核只检查 blocker 是否关闭、测试证据是否与最终 tree 一致，不重新讨论已经批准的产品需求。
