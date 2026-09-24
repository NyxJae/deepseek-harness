# local-use 0.1.7-rc.1 集成验收

[English](local-use-0.1.7-rc.1-review-fixes.md) | 中文

本实操手册用于验收 `local-use` 向 DSH 0.1.7-rc.1 的集成工作树。按当前 RC1 源码确认行为归属，完整的上游更新流程见 [dsh-plugin-development Skill](../../.agents/skills/dsh-plugin-development/references/local-use-upstream-integration.md)。

## 起点

1. 在项目内的 `.worktree/local-use-0.1.7-rc.1-integration` 检查 `git status --short --branch` 和上游引用。根 `local-use` 的用户改动保持原样；Web 的 `3079`/`3080` 端口由用户管理，测试使用独立 profile 与随机端口。
2. 以 RC1 官方源码作为当前包和 API 的依据。Markdown 本地图片遵循官方解析路径，原图查看由 `ui-primitives/ImageLightbox` 负责；Goal 使用当前 Jobs 查询与事件 API。

## 行为归属

1. 移动抽屉的 Escape 监听在 `document`，Settings 在 `window`，Menu 在自身监听器中消费按键。浏览器可能在这两个原生监听阶段之间执行微任务；Sidebar 在下一次任务读取 `event.defaultPrevented`，仅在未消费时关闭抽屉，并在组件卸载时取消待执行 timer。焦点进入抽屉，抽屉关闭后返回触发器。行为归属见 [Sidebar README](../../packages/client/ui-sidebar/README.zh.md)。
2. `apps/web/tests/expected/file-upload-round/image-preview.expected.md` 记录 Trajectory 预览在 125% 缩放时的稳定 ARIA；`snapshots/web/file-upload-round/session.v3.jsonl` 保持已提交的回放输入。golden 由 `file-upload-round.e2e.ts` 的完整轮次生成，内容须经人工核对。
3. `computeColumns(viewport, sidebar, rightbar, collapsedWidth)` 保持 RC1 的数值型第 4 个参数；移动端、macOS 和 Windows 标题栏的零轨道策略由 `AppFrame` 传入，列宽求解器只计算尺寸。
4. `SubagentRuntime.hasPendingContinuations(parent)` 是供 Goal 跨包调用的 public Host 查询：使用精确的 parent Agent 身份，只统计驻留的直接可继续子级，不统计一次性运行或冷 Session。现有 README、单元测试和生成目录记录该语义。
5. 项目 `dsh-plugin-development` Skill 来自 `origin/local-use` 的 7 个已提交文件；root `AGENTS.md` 保留同步上游后完整构建与保护 Web 端口两条本地规则。

## 验证步骤

1. 运行 `pnpm run build`，再运行 `pnpm exec vitest run packages/client/ui-layout/tests/columns.client.spec.ts packages/client/ui-sidebar/tests/sidebar-root.client.spec.tsx`；确认默认轨道和零轨道、未消费 Escape、连按及卸载取消均通过。
2. 以 `DSH_SNAPSHOT=replay` 运行 `apps/web/tests/settings-chrome.e2e.ts` 中的移动弹层用例：首个 Escape 只关 Settings，菜单打开时 Escape 只关 Menu，后续 Escape 才关抽屉并恢复触发器焦点。对比打开 Settings 前后和关闭后的窄屏截图。
3. 在支持的 Linux CI 上以 `DSH_SNAPSHOT=replay` 运行 `apps/web/tests/file-upload-round.e2e.ts` 与完整 `pnpm run test:web`，确认新 ARIA golden 和已提交 V3 Session 能重放。Windows 本机将转义后的工具参数路径写入持久 Session，比对可能在8个浏览器断言通过后失败；创建 symlink 也可能返回 `EPERM`。保留原始失败输出，以 Linux 门禁判定这些跨平台结果。
4. 对最终差异执行 `pnpm run test:gui`、`pnpm run typecheck`、`pnpm run lint`、`pnpm run doc-sync` 和 `git diff --check`；按实际平台记录未通过的检查，不改变产品安全配置以掩盖环境限制。
5. 审阅工作树与最终 diff。每次 commit/push 单独取得用户批准；只有审核与 Linux 门禁通过、祖先关系和根工作树状态核实后，才由用户决定将 `local-use` fast-forward 到集成结果。
