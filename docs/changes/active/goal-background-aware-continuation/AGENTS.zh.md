# AGENTS.md — Goal background-aware continuation

[English](AGENTS.md) | 中文

## 范围

本目录记录两个 goal 变更方向：后台工作等待期间抑制自动 `<goal_round>`，以及由 `C:\Users\HJ\.dsh\plugins\dsh-goal-guidance` 提供的 goal 引导提示词。两项均已实现；A 位于内置 driver，B 位于外置插件。

## 文件归属

- `issue.md`：问题与已确认范围。
- `requirements.md`：所需的用户、模型和生命周期行为。
- `design.md`：目标实现、数据流、竞态和被拒绝的替代方案。
- `tasks.md`：按依赖排序的开发计划与文件清单。
- `verification.md`：调研证据和实现后的验收记录。
- `status.yaml`：本变更唯一的状态源。

## 当前状态

变更状态为 `in-progress`，外置 B（`dsh-goal-guidance`）已实现并挂载到 Web profile，内置 A 已在 fork 中实现。文档必须明确保留的完整验收缺口。

## 首要阅读

先读仓库根 [`AGENTS.md`](../../../../AGENTS.md)、[`docs/AGENTS.md`](../../../AGENTS.md) 和 [`packages/AGENTS.md`](../../../../packages/AGENTS.md)，再读本变更的 `requirements.md` 与 `design.md`。

## 验证

文档修改后运行 `pnpm run test:docs`、`pnpm run doc-sync` 和 `git diff --check`；实现阶段运行 `tasks.md` 中的焦点测试和 profile 检查。不要重启受保护的 dsh Web Node 进程。
