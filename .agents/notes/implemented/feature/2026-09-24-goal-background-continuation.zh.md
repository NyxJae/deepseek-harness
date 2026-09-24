# Agent Note: Goal 续行等待所属后台工作

Status: implemented

[English](2026-09-24-goal-background-continuation.md) | 中文

## 问题

Agent 进入 idle 时，仍可能拥有运行中的 Job 或驻留的可继续子级。此时启动新 Goal 自动轮次，会在委派工作终结前再次发出模型请求。子级 Session 与已终结 Job 的记录会继续存在，因此仅凭历史记录无法判断下一轮何时就绪。

## 决策

[同会话 Goal 领域](2026-07-19-persisted-same-session-goal-domain.zh.md)仍负责持久状态；`@deepseek-ai/dsh-goal-round-driver` 仅在确切在线 Agent 没有由其 Session 拥有的运行中或停止中的 Job、也没有驻留的直接可继续子级 Activation 时调度。JobsLocal 负责 Job 状态与终结事件；SubagentRuntime 同时通过直接父级 Session id 与确切父 Agent 身份查询其 Activation 注册表。驱动器在 idle、持久性检查点之后，以及异步 pre-step 委派前后重新查询两个所有者。Job 终结和子级生命周期结束事件触发新一轮调度检查。

## 考虑过的方案

- **仅检查 Agent idle 状态。** 未采用：Job 和可继续子级的生命周期可能长于父级轮次。
- **计入所有可列举 Job 或子级 Session。** 未采用：无 owner 或其他 owner 的 Job、已终结 Job、未驻留的子级 Session 都不是此 Agent 尚在等待的工作。
- **在 Goal 快照中持久化后台计数器。** 未采用：Job 与 Activation 注册表已拥有进程内生命周期；第二份计数器可能比资源存活更久或与其分歧。

## 后果

下一轮 Goal 会等待当前 Agent 尚未完成的工作，不会被无关任务或历史子级阻塞。调度器使用所有者 API 与事件，不改变 Goal 日志或 Agent loop。后台 Job 完成后仍按[完成通知规则](2026-08-11-background-job-completion-wakes-an-idle-owner.zh.md)投递普通通知；驱动器在接纳自己的提示词前仍检查确切在线状态。

## 测试

Goal driver 测试覆盖 owner 筛选、Jobs 延迟挂载、可继续子级结束唤醒，以及异步 pre-step 期间开始的后台工作。Subagent 测试区分驻留直接子级、另一 Agent、字段相同的代理对象和已持久化的冷子级。通过 Loader 启动的 Web 组合测试使用真实 JobRegistry 验证终结后的持久 Goal 轮次。
