# Goal 后台等待与引导提示词

[English](issue.md) | 中文

状态：`in-progress`（A、B 均已实现；聚焦验证通过；完整验收待执行）

首次提出：2026-09-01

来源：用户确认的两个独立需求

## 问题

当前 `@deepseek-ai/dsh-goal-round-driver` 把 Agent 进入 `idle` 作为自动续行的主要时机。主 Agent 启动后台子代理或命令后，阶段性汇报也可能结束 turn 并让 Agent 回到 `idle`；此时 Agent 逻辑上是在等待后台结果，不应开始新的 Goal Round。

如果驱动器把这种等待误判为可以工作，就会注入 `<goal_round>`，促使主 Agent 重复检查后台状态，产生额外模型请求，并消耗自动 goal 轮次。

现有后台任务注册表区分 owner、`running`/`stopping` 和终态 `reported`；`reported` 是通知簿记，不是单纯表示完成的布尔值。continuable 子代理提供父级作用域的 `subagent/start` 与 `subagent/end` 生命周期边界。内置 driver 现在通过精确 owner 和精确 parent 查询读取这些事实。

goal 工具目前只有稳定的 `tool:goal` 系统提示词段落。当没有当前 goal，或 goal 已暂停或阻塞时，模型不会在请求准备阶段收到一次性、与状态对应的“先创建或恢复 goal”指令。

## 已核对的当前事实

- [`packages/goal/goal-round-driver/src/index.ts`](../../../../packages/goal/goal-round-driver/src/index.ts) 的自动续行判断检查 Agent 状态、当前 goal、激活状态、竞争输入和精确 owner 的后台工作，并在 `agent/pre-step` 再次检查后台工作条件。
- [`packages/jobs/jobs/src/types.ts`](../../../../packages/jobs/jobs/src/types.ts) 把 `running` 和 `stopping` 视为未结束工作；owner 通过 `ownerSession` 关联，`reported` 记录终态快照的通知簿记，并可能在 stopping、读取、等待、终止或 teardown 期间变化。
- [`packages/jobs/jobs/src/index.ts`](../../../../packages/jobs/jobs/src/index.ts) 提供 owner-scoped `list()`、`hasActive(owner)` 和 `onJobsChanged()`；`tool-jobs` 在完成通知后仍可能要求模型用 `job_output` 收集终态输出。
- [`packages/subagent/subagent/src/lifecycle.ts`](../../../../packages/subagent/subagent/src/lifecycle.ts) 与 [`packages/subagent/subagent/src/continuation.ts`](../../../../packages/subagent/subagent/src/continuation.ts) 提供父级作用域生命周期边界，以及用于 live direct-child Activation 的 `hasPendingContinuations(parent)`；结算通知先于 `subagent/end`。
- [`packages/context/time-context/src/index.ts`](../../../../packages/context/time-context/src/index.ts) 展示了调用下游 `agent/pre-step` listener，再向即将进入的请求追加带 source 的持久 `UserMessage`。
- `dsh --profile web --dump-config` 已确认 shipped Web bundle 组合 `goal` 和 `goal-round-driver`。用户 profile 现在有一条 `dsh-goal-guidance` dependency 和 `goal-guidance` patch 行，`C:\Users\HJ\.dsh\plugins\dsh-goal-guidance` 已包含外置实现；`hmr` 行仍处于 disabled。

## 范围

本变更包含：

1. 为内置 `goal-round-driver` 增加后台工作感知，使自动 `<goal_round>` 只在主 Agent 确实可以继续时排队。
2. 在 `C:\Users\HJ\.dsh\plugins` 下创建独立的外置 `dsh-goal-guidance` 插件，为没有可执行 goal 的直接人类请求追加状态引导。
3. 为两项行为增加单元、真实组合、竞态和 keyless session snapshot 验收，并更新受影响的包文档。

本变更不包含：

- 修改 `dsh-goal` 的持久 phase、revision、事件格式或 Round 上限语义。
- 修改后台任务执行、完成交付、输出读取或子代理业务生命周期。
- 自动恢复 paused、blocked 或 resume/fork 后 disarmed 的 goal；引导只要求模型在直接人类请求后使用既有工具。
- 用外置 `agent/pre-step` veto 替换 goal driver；这种方式可能把合法等待报告成 goal blocker，或破坏现有 reservation。
