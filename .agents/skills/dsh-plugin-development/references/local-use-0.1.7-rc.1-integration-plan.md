# local-use → dsh 0.1.7-rc.1 集成计划

状态：in-progress  
执行分支：`integrate/local-use-0.1.7-rc.1-20260924`  
分支起点：`local-use`  
目标上游：fork `master` / official `deepseek-ai/deepseek-harness:master`  
目标版本：`dsh 0.1.7-rc.1`

本文是本次 `local-use` 向 `dsh 0.1.7-rc.1` 迁移的执行计划。目标不是机械解决旧分支与新上游的文本冲突，而是保留 `local-use` 的历史和产品意图，让最终代码树以 RC1 当前官方源码为主体，再逐项恢复仍有价值的本地能力。

## 1. 当前 Git 基线

| 项目 | SHA / 状态 |
|---|---|
| `local-use` | `fa5a6890616df05cc61c33d145d21bd3514c903b` |
| fork `master` | `46a7f68b0922371ce7144b668b90e377d8e799f4` |
| official release | `dsh 0.1.7-rc.1` |
| merge base | `c291e7961a515f6d7af9304e7fd1d257929aef26` |
| local-only commits | 约 30 |
| upstream commits after merge base | 约 3165 |
| local changed files after merge base | 109 |

当前历史：

```text
c291e796
   ├── local-use ... fa5a689
   └── master ................. 46a7f68 (0.1.7-rc.1)
```

本次专用分支已从 `local-use` 创建：

```text
local-use
   └── integrate/local-use-0.1.7-rc.1-20260924
```

全部集成操作先限定在这个分支，原 `local-use` 在最终验证前保持不动。

## 2. 总体迁移策略

不要直接普通 merge 后逐个硬解冲突，也不要整串 rebase 或 cherry-pick 旧 `local-use`。

核心 UI、Jobs、Subagent、Markdown image 和 platform chrome 的 owner 已在上游多轮演进中变化。文本层面能合并，不等于语义层面仍正确。

本次采用：

```text
old local-use
     │
     ▼
integration branch
     │
     ├─ 记录 master 为祖先（ours merge，tree 不变）
     ├─ 将工作树精确替换为 RC1 master tree
     ├─ 逐项重做仍需保留的 local-use 能力
     ├─ tests / build / docs / real Web verification
     ▼
local-use --ff-only
```

最终历史同时包含旧 `local-use` 和 RC1 `master` 的 ancestry，但最终 tree 不携带已经淘汰的旧实现。

## 3. Phase 0：固定执行 SHA

在本地 checkout 本集成分支后：

```powershell
git status --short --branch
git fetch origin --prune
git fetch upstream --prune

$OLD_LOCAL = git rev-parse HEAD
$TARGET = git rev-parse master
$MERGE_BASE = git merge-base $OLD_LOCAL $TARGET

Write-Host "OLD_LOCAL=$OLD_LOCAL"
Write-Host "TARGET=$TARGET"
Write-Host "MERGE_BASE=$MERGE_BASE"
```

预期：

```text
OLD_LOCAL=fa5a6890616df05cc61c33d145d21bd3514c903b
TARGET=46a7f68b0922371ce7144b668b90e377d8e799f4
MERGE_BASE=c291e7961a515f6d7af9304e7fd1d257929aef26
```

如果值变化，先重新核验计划。执行 tree replacement 前工作树必须 clean。

## 4. Phase 1：接入 RC1 ancestry，但不合旧代码

因为本分支以 `local-use` 为基，先只连接历史：

```powershell
git merge -s ours --no-ff $TARGET -m "chore(local-use): record dsh 0.1.7-rc.1 ancestry"
```

这一 commit 的 tree 应与旧 `local-use` 完全一致。

验证：

```powershell
git diff HEAD^1 HEAD --exit-code
git merge-base --is-ancestor $OLD_LOCAL HEAD
git merge-base --is-ancestor $TARGET HEAD
```

三项都必须成功。

## 5. Phase 2：把代码树切换为纯 RC1

将 index 和 worktree 精确替换成 `$TARGET` 的 tree：

```powershell
git read-tree --reset -u $TARGET
git status --short
git diff --cached --stat
```

这里出现大量 staged 删除、修改、新增是预期结果，因为旧 `local-use` tree 正在被完整替换为 RC1 tree。

确认后提交：

```powershell
git commit -m "chore(local-use): adopt dsh 0.1.7-rc.1 tree"
```

验证：

```powershell
git diff HEAD $TARGET --exit-code
git merge-base --is-ancestor $TARGET HEAD
git merge-base --is-ancestor $OLD_LOCAL HEAD
```

此时当前 tree 必须与 RC1 master 完全一致，同时 RC1 master 和旧 local-use 都是 ancestor。

从这一步开始，旧 `local-use` 只作为需求、历史和旧实现参考，不再作为源码基底。

## 6. Phase 3：验证纯官方 RC1

当前官方环境：

```text
Node ^22.19.0 || >=24.0.0
pnpm 11.7.0
```

执行：

```powershell
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm run build
pnpm run test:gui
git status --short
```

工作树必须 clean。

如果纯官方 RC1 在当前机器就失败，先记录为 upstream baseline failure，不要混进本地迁移修复。

## 7. 功能去留总表

| 本地能力 | RC1 状态 | 本次处理 |
|---|---|---|
| Markdown 本地图片 | 官方已实现 | 删除旧本地实现 |
| Windows drive / UNC Markdown 图片 | 官方 `workspace-path` 已支持 | 删除旧补丁 |
| 旧 MarkdownImage renderer / resolver | ownership 已变化 | 不迁 |
| Advanced ImageLightbox | 官方只有基础 viewer | 保留，迁入 `ui-primitives` |
| Menu keyboard/focus | 官方已显著完善 | 删除旧本地实现 |
| Settings focus restoration | 官方已有 | 使用官方 |
| Responsive Settings | 仍有本地价值 | 按 RC1 DOM 重新适配 |
| Mobile sidebar overlay | 官方仍未等价覆盖 | 保留并重做 |
| Session header fixed corner | 本地行为仍有价值 | 保留 |
| Brand click collapses sidebar | 官方仍为 New Session 行为 | 保留，但尊重 macOS drag surface |
| Goal 等待 Job | 需求仍有效 | 基于新 Jobs API 重做 |
| Goal 等待 continuable Subagent | 需求仍有效 | 保留，缩小 Subagent patch |
| Jobs `hasActive(Agent)` | 新 API 可替代 | 不恢复 |
| Jobs `onJobsChanged` | `jobs.events` 可替代 | 不恢复 |
| `dsh-plugin-development` Skill | 官方不存在 | 保留并刷新 |
| 旧 generated catalogs / lockfile | 绑定旧 tree | 不迁 |

## 8. Markdown 本地图片：采用官方实现

RC1 已包含官方本地 Markdown 图片支持。

当前关键路径：

```text
packages/client/ui-chat/src/client/chat/AssistantMarkdown.tsx
packages/client/ui-primitives/src/markdown/render.tsx
packages/util/workspace-path/src/index.ts
```

官方已有：

```text
MarkdownPathImages
localPathMediaUrl(...)
fileMediaUrl(...)
isAbsoluteWorkspacePath(...)
```

`workspace-path` 已处理 POSIX absolute path、Windows drive path、Windows slash/backslash spellings 和 UNC path。

2026-09-19 官方已合入：

```text
7951cee fix(web): render local images in Markdown previews
```

因此不恢复：

```text
packages/client/ui-attachment/src/client/MarkdownImage.tsx
packages/client/ui-attachment/src/client/MarkdownImage.module.css
旧 durable/local image resolver
旧 ui-chat path-image wiring
旧 ui-primitives path-image patch
```

实机只验证：

```text
C:\Users\...\image.png
C:/Users/.../image.png
\\server\share\image.png
/absolute/posix/image.png
带空格路径
带 % 字符路径
```

出现问题时修当前官方路径，不恢复旧 resolver。

## 9. Advanced ImageLightbox：迁入 ui-primitives

旧 `local-use` 的高级 viewer 位于：

```text
packages/client/ui-attachment/src/ImageLightbox.tsx
```

旧版额外拥有 wheel zoom、keyboard zoom、reset、zoom controls、zoom percentage、mouse/pointer pan、pointer capture、pinch zoom、double-click zoom、scale clamp、viewport clamp、body scroll/touch lock 和更完整 focus trap。

RC1 已将基础 Lightbox owner 移到：

```text
packages/client/ui-primitives/src/ImageLightbox.tsx
packages/client/ui-primitives/src/ImageLightbox.module.css
packages/client/ui-primitives/tests/image-lightbox.client.spec.tsx
```

不要恢复旧 `ui-attachment/ImageLightbox`；在当前 `ui-primitives` implementation 上增加高级能力。

保持 locale-owned labels、body portal、Escape/backdrop/close semantics、opener focus restore 和当前 public contract。

必要时扩展 `ImageLightboxLabels`，增加 `zoomIn`、`zoomOut`、`resetZoom`，并更新当前调用方。

Focused tests 至少覆盖：

- initial focus；
- Tab trap；
- Escape；
- backdrop；
- opener restore；
- wheel zoom；
- controls zoom；
- keyboard zoom；
- reset；
- double click；
- pan；
- pinch；
- pointer cancel；
- min/max clamp；
- unmount cleanup。

建议 commit：

```text
feat(local-ui): restore advanced shared image lightbox
```

## 10. Menu 和 Settings focus：不迁旧实现

当前官方 `Menu.tsx` 已拥有 Tab、Shift+Tab、Escape、ArrowUp / ArrowDown、Home / End、trigger focus restoration、post-selection focus restoration、submenu、portal placement 和 iframe blur handling。

相关官方演进：

```text
f46b025 feat(client): give the shared menu family its keyboard model
3f5fc12 fix(web): restore settings focus after commit
```

不要恢复旧 Menu keyboard patch。

Settings 当前也已经在 dialog 打开时 focus close button，并在关闭 commit 后把 focus 还给 trigger。

本次只处理仍缺失的 responsive layout。

## 11. Responsive Settings：只迁当前仍需要的布局

重点检查：

```text
packages/client/ui-settings-general/
packages/client/ui-settings-models/
packages/client/ui-settings-plugin-inventory/
packages/client/ui-settings-plugins/
packages/client/ui-agent-preset/
packages/client/ui-permission-presets/
packages/client/ui-theme/
```

优先 CSS-only。

不要恢复旧 Menu JS、focus ownership JS 和旧 DOM assumptions。

验收 viewport：

```text
360
390
768
1024
desktop
```

重点验证 dialog、nav/content stacking、长 model/provider 文本、plugin cards、form rows、select/input width 和 touch hit target。

建议 commit：

```text
fix(local-ui): restore responsive settings layout
```

## 12. Mobile Sidebar Overlay：高风险迁移

目标继续保留：

```text
viewport < SIDEBAR_AUTO_COLLAPSE
```

时 Sidebar 不占 AppFrame grid track，而作为 fixed overlay drawer 绘制。

验收模型：

```text
closed:
grid sidebar track = 0

open:
grid sidebar track = 0
fixed drawer visible
backdrop visible
center 不移动

desktop collapsed:
56px official rail
```

RC1 已新增 macOS hidden titlebar、vibrancy、window drag ownership、Windows titlebar integration、`shell.leading`、新 rail transition、sidebar panels、footer slots 和 fullscreen chrome。

因此不能复制旧 `AppFrame.tsx` / `SidebarRoot.tsx`，必须在 RC1 当前实现上重做。

优先使用当前 `computeColumns(..., collapsedWidth)` 表达 narrow 零宽 sidebar track；只有无法表达目标时才修改 `columns.ts`。

预计主要修改：

```text
packages/client/ui-layout/src/client/AppFrame.tsx
packages/client/ui-layout/src/client/AppFrame.module.css
packages/client/ui-layout/tests/*

packages/client/ui-sidebar/src/client/SidebarRoot.tsx
packages/client/ui-sidebar/src/client/SidebarRoot.module.css
packages/client/ui-sidebar/tests/*
```

Escape 关闭 drawer 只在：

```ts
event.key === 'Escape' && event.defaultPrevented === false
```

时发生，不能抢走内层 Menu/Dialog 已处理的 Escape。

必须保护 rightbar、desktop rail、Windows titlebar、macOS titlebar、macOS window dragging、fullscreen 和 sidebar resize。

建议 commit：

```text
fix(local-ui): restore narrow sidebar overlay
```

## 13. Session Header fixed corner

保留旧 `local-use` 最新提交中的 Header 设计：

```text
[ title / lineage / actions / utilities 可水平滚动 ][ corner 固定 ]
```

在 RC1 当前 JSX 上增加 scroller wrapper，不恢复旧文件整体。

预计：

```text
packages/client/ui-conversation/src/client/skeleton/ConversationSession.tsx
packages/client/ui-conversation/src/client/skeleton/ConversationRoot.module.css
packages/client/ui-conversation/tests/skeleton.client.spec.tsx
```

结构测试继续验证：

```text
data-conversation-header-scroller
data-conversation-header-corner
```

建议 commit：

```text
fix(local-ui): keep session header corner reachable
```

## 14. Sidebar Brand：保留 collapse，但尊重 macOS drag surface

RC1：

```text
普通 Web / Windows:
expanded brand click → New Session

macOS Desktop:
brand wordmark → window drag surface
```

本地目标：

```text
非 macOS Desktop:
brand → collapse sidebar

macOS Desktop:
brand → 保持 non-button drag surface

New Session:
始终由独立按钮 → startSession()
```

测试至少覆盖 normal desktop、Windows、mobile、darwin desktop 和 independent New Session button。

建议 commit：

```text
fix(local-ui): make non-macos brand collapse sidebar
```

## 15. Goal background-aware continuation：按 RC1 API 重做

旧 `local-use` 曾为 Jobs 添加：

```ts
hasActive(owner: Agent)
onJobsChanged(...)
```

RC1 Jobs 已改成 SessionId-facing：

```ts
list(caller?: SessionId)
get(...)
read(...)
kill(...)
wait(...)
remove(...)
```

并新增：

```ts
jobs.events.subscribe(...)
```

支持：

```ts
{ owner: SessionId }
{ owners: 'scope' }
{ owners: 'all' }
```

因此不恢复 `JobRegistry.hasActive(Agent)`、`JobRegistry.onJobsChanged(...)` 或 `jobs-local` changed-listener patch。

Goal 判断 Job 是否仍活跃，优先直接使用：

```ts
ctx.get('jobs')?.list(agent.id)
```

检查 `running` / `stopping`。

Job 状态变化重新 drive Goal 时，用官方 `jobs.events.subscribe(...)`，只响应会改变 quiescence 的事件，例如 `registered`、`stopping`、`settled`、`removed`。不要因 output/progress 每次变化都 drive Goal。

理想结果：

```text
packages/jobs/jobs/*
packages/jobs/jobs-local/*
```

保持官方零 diff。

## 16. Subagent：只暴露最薄的 pending query

RC1 内部 `ContinuableActivationRegistry.hasPending(parent)` 已存在。

本地 Goal 只需要知道 exact live parent 是否仍有 continuable child。

优先只增加：

```text
SubagentContinuationManager.hasPendingContinuations(parent)
SubagentRuntime.hasPendingContinuations(parent)
```

不要修改 Activation graph、cold resume、ownership acquisition/release、maxActiveSubagents、message delivery 和 drain semantics。

## 17. Goal quiescence 条件

自动 Goal round 只在以下条件同时成立时继续：

```text
Goal active + armed
AND 当前 Agent 没有普通待处理 prompt
AND 没有 running/stopping owned Job
AND 没有 pending continuable Subagent
```

测试：

### Job

```text
Goal active
→ start background Job
→ Goal 不开下一轮
→ Job settled
→ Goal driver 被重新请求
→ Goal 可继续
```

### Subagent

```text
Goal active
→ continuable child active
→ Goal 不开下一轮
→ child settlement
→ Goal 可继续
```

### Optional capability

`ctx.jobs` 或 `ctx.subagents` 缺失时，保留原 Goal 行为。

建议 commit：

```text
fix(goal): defer automatic rounds during background work
```

## 18. dsh-plugin-development Skill

完整保留：

```text
.agents/skills/dsh-plugin-development/
```

但完成迁移后刷新：

```text
SKILL.md
references/agent-turn-lifecycle.md
references/official-docs.md
references/typert-remote.md
references/local-use-upstream-integration.md
```

旧 `local-use-upstream-integration.md` 记录上一轮版本和旧 API，本文件是本次 RC1 的版本固定执行计划。

## 19. Root AGENTS.md

不要把旧 `local-use/AGENTS.md` 覆盖到 RC1。

RC1 已新增或调整 desktop、computer-use、browser-use、jobs、goal、schedule、attachment、workspace、MCP、runtime diagnostics、persistence type acknowledgement、no-`unknown` cast、workspace release range 和 Agent Note policy。

只重新加入仍属于本地环境的规则，例如：

```text
After syncing upstream into local-use, run full pnpm run build.
3079 / 3080 不用于自动测试或临时验证。
```

其余以 RC1 root `AGENTS.md` 为准。

## 20. Docs / Agent Notes / generated files

不要先复制旧 docs。

最终代码稳定后，再基于 RC1 当前 owner 更新 package README、subsystem docs、bilingual pairs 和必要 Agent Note。

旧 `2026-09-07-session-prose-local-media-display` 的主要行为已由上游实现，不应重新成为 fork-owned current authority。

不要机械恢复：

```text
docs/event-producer-consumer.*
docs/subsystems/jobs.*
docs/subsystems/subagent.*
docs/subsystems/slots.*
packages/extensions/cordis-client-runner/src/client/slot-catalog.ts
packages/extensions/tool-cordis/src/api-catalog.ts
pnpm-lock.yaml
```

需要生成时从 RC1 当前 source 重新生成。

## 21. 推荐实现顺序

1. Advanced shared ImageLightbox；
2. Responsive Settings；
3. Mobile Sidebar overlay；
4. Session Header fixed corner；
5. Sidebar Brand behavior；
6. Goal + Subagent background-awareness；
7. local development Skill；
8. docs / README / AGENTS 同步。

## 22. 推荐 commit 序列

```text
M  chore(local-use): record dsh 0.1.7-rc.1 ancestry
T  chore(local-use): adopt dsh 0.1.7-rc.1 tree

A  feat(local-ui): restore advanced shared image lightbox
B  fix(local-ui): restore responsive settings layout
C  fix(local-ui): restore narrow sidebar overlay
D  fix(local-ui): keep session header corner reachable
E  fix(local-ui): make non-macos brand collapse sidebar
F  fix(goal): defer automatic rounds during background work
G  docs(local-use): refresh local development workflow for rc.1
```

不要追求与旧 30 个 commit 一一对应；每个新 commit 描述当前 RC1 上一个独立、可验证的能力。

## 23. Focused checks

UI 每阶段：

```powershell
pnpm run test:gui
```

改变 assembled Web 或 visible conversation/UI output：

```powershell
$env:DSH_SNAPSHOT = "replay"
pnpm run test:web
```

Goal/Subagent：

```powershell
pnpm exec vitest run packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts packages/subagent/subagent/tests/continuation.spec.ts
```

如果实际修改 Jobs，再加入 Jobs 对应 specs。

## 24. 最终验证

全部功能完成后：

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
```

不要在每个 commit 后重复完整 suite。

## 25. Web 实机验证

保护 `3079` / `3080`，使用其他 loopback port。

### Images

验证 Windows absolute、UNC、POSIX absolute、普通 message image、Markdown image、wheel/button/keyboard zoom、drag、pinch、double-click、reset、focus restore。

### Sidebar

viewport 至少：

```text
360
390
768
1023
1024+
```

确认 narrow closed/open 的 sidebar grid track 均为 0，drawer 不推动 center，backdrop/Escape 正常，desktop rail 仍为 56px，rightbar 正常。

### Settings

检查 General、Models、Plugins、Plugin Inventory、Agent Preset、Permission、Appearance。

### Goal

```text
Goal → background Job → running 时不抢跑 → settlement 后继续
Goal → continuable Subagent → active 时不抢跑 → settlement 后继续
```

## 26. 最终移动 local-use

全部检查通过前，不移动原 `local-use`。

完成后：

```powershell
git status --short
git merge-base --is-ancestor $OLD_LOCAL HEAD
git merge-base --is-ancestor $TARGET HEAD
git switch local-use
git merge --ff-only integrate/local-use-0.1.7-rc.1-20260924
git fetch origin
git merge-base --is-ancestor origin/local-use local-use
git push origin local-use
```

正常流程不需要 `--force`、`--force-with-lease` 或 `reset --hard`。

## 27. 回滚

集成完成前，原 `local-use` 不移动，本 integration branch 本身就是完整 checkpoint。

如果最终 fast-forward 前发现问题，只修 integration branch。

已经 push 后发现问题，优先 forward-fix，不把整个分支倒退回旧 tree。

## 28. 风险排序

### 高：Mobile Sidebar

本地需求仍存在，同时 RC1 新增多套 platform chrome，Web、Windows、macOS Desktop 的布局 owner 已明显扩张。

### 高：Goal background work

旧补丁所依赖 Jobs API 已重构，但 RC1 新 `jobs.events` 和 SessionId API 能让最终 patch 更小。

### 中：Advanced Lightbox

交互逻辑可复用，但 owner 已从 `ui-attachment` 迁到 `ui-primitives`。

### 中：Header / Brand

Header 相对简单；Brand 必须保护 macOS drag surface。

### 中低：Responsive Settings

以 CSS 为主，官方已覆盖大部分 focus 行为。

### 低：Markdown local images

官方已经提供目标能力，本地只做真实路径验证。

## 29. 明确不做

1. 普通 merge 后逐个硬解所有旧冲突；
2. 整串 rebase 旧 `local-use`；
3. 整串 cherry-pick；
4. 恢复旧 `ui-attachment/ImageLightbox.tsx` ownership；
5. 恢复旧 Markdown resolver；
6. 恢复旧 Menu keyboard implementation；
7. 恢复 Jobs `hasActive(Agent)`；
8. 恢复 Jobs `onJobsChanged()`；
9. 用旧 `AGENTS.md` 覆盖 RC1；
10. 用旧 docs 覆盖 RC1；
11. 用旧 `pnpm-lock.yaml` 覆盖 RC1；
12. 为减少 diff 而破坏当前官方 package ownership。

## 30. 最终验收

- [ ] 旧 `local-use` 是最终 HEAD 的 ancestor。
- [ ] RC1 `46a7f68` 是最终 HEAD 的 ancestor。
- [ ] RC1 adoption commit 后 tree 与 `$TARGET` 完全一致。
- [ ] 新代码以 RC1 当前 architecture 为主体。
- [ ] 不存在旧 Markdown local-image pipeline。
- [ ] Windows/UNC Markdown 图片走官方实现。
- [ ] Advanced Lightbox 位于 `ui-primitives`。
- [ ] 官方 Menu keyboard/focus 未被旧实现覆盖。
- [ ] Settings 窄屏布局可用。
- [ ] mobile sidebar 为 overlay，不占 grid track。
- [ ] desktop collapsed sidebar 保持官方 rail。
- [ ] macOS wordmark drag surface 未被破坏。
- [ ] Header corner 窄屏固定可达。
- [ ] 非 macOS brand collapse 行为符合本地需求。
- [ ] New Session 保持独立入口。
- [ ] Goal 不会在 active Job 时抢跑。
- [ ] Goal 不会在 pending continuable Subagent 时抢跑。
- [ ] Jobs provider/service 尽量保持官方零 diff。
- [ ] `dsh-plugin-development` Skill 保留且与 RC1 一致。
- [ ] `pnpm run test:gui` 通过。
- [ ] `DSH_SNAPSHOT=replay pnpm run test:web` 通过。
- [ ] `pnpm run typecheck` 通过。
- [ ] `pnpm run lint` 通过。
- [ ] `pnpm run build` 通过。
- [ ] `pnpm run hygiene` 通过。
- [ ] `pnpm run doc-sync` 通过。
- [ ] 最终 `pnpm run test` 通过。
- [ ] 原 `local-use` 最终只通过 `--ff-only` 前进。

## 31. 目标状态

完成后的 `local-use` 应收敛为：

```text
official dsh 0.1.7-rc.1
+
Advanced shared ImageLightbox
Responsive local UI
Mobile Sidebar overlay
Header / Brand preference
Goal background-work coordination
Local development Skill
```

其余能力尽量采用官方实现。

本轮最重要的维护目标，是让下一次从 RC1 更新到后续 RC / stable 时，不再重复处理当前这一轮的大规模架构漂移。
