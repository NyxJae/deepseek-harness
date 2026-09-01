# Goal 后台感知续行与状态引导需求

[English](requirements.md) | 中文

状态：`in-progress`（A、B 均已实现；完整验收待执行）

关联问题：[`issue.zh.md`](issue.zh.md)

目标设计：[`design.zh.md`](design.zh.md)

开发计划：[`tasks.zh.md`](tasks.zh.md)

验收记录：[`verification.zh.md`](verification.zh.md)

## 1. 目标

减少主 Agent 等待后台工作时产生的无效 Goal Round，并在直接人类请求需要长期推进但不存在可执行 goal 时，把模型引向正确的创建或恢复动作。

两项需求拥有独立的触发条件和 owner：

- **需求 A：后台工作期间抑制自动续行**，owner 是内置 `@deepseek-ai/dsh-goal-round-driver`。
- **需求 B：注入 goal 状态引导**，owner 是位于 `C:\Users\HJ\.dsh\plugins\dsh-goal-guidance` 的外置 `dsh-goal-guidance` 插件。

## 2. 需求 A：后台工作期间抑制自动 `<goal_round>`

### A-1. 自动续行准入

驱动器只有在以下所有条件都成立时，才可以注入或排队 `<goal_round>`：

```text
Agent.status === 'idle'
&& currentGoal.phase === 'active'
&& currentGoal.activation === 'armed'
&& !competingQueued
&& !hasOutstandingBackgroundWork(agent)
```

驱动器现有的停止、Agent 身份、reservation、checkpoint 和 teardown 条件继续有效。

### A-2. 后台工作定义

`hasOutstandingBackgroundWork(agent)` 只统计由该精确 Agent 生命周期拥有的工作，或父级关系明确指向该 Agent 的 continuable child。不统计其他 Agent 拥有的工作或没有 owner 的工作。

至少包括：

- `ctx.get('jobs')?.hasActive(agent) ?? false` 对当前精确 Agent 对象拥有的 Job 返回 true；`hasActive` 比较对象身份，只统计 `running` 和 `stopping`，因此相同 SessionId 的旧 Job 不会匹配 replacement Agent。
- `ctx.get('subagents')?.hasPendingContinuations(agent) ?? false` 只在该精确 Agent 拥有 direct child 的 live Activation 时返回 true；缺少 provider/manager 或 child 已持久化但尚未 materialize 时返回 false，`subagent/start` 之前已创建的 Activation 则计入。精确 parent replacement 不会匹配旧 Activation。
- 可选 provider 缺失时，该查询贡献 false；已安装 provider 的查询抛错时，driver 通过现有错误路径暴露错误，不把它当成没有后台工作。

终态 Job 不属于进行中的后台工作。完成通知、输出读取和 `reported` 更新仍由现有 jobs 控制面负责，不决定 Goal Round 准入。

### A-3. 等待行为

存在后台工作时，主 Agent 可以用普通阶段性回复结束当前 turn，但驱动器不得：

- 注入或排队另一个 `<goal_round>`。
- 创建另一个模型请求。
- 增加 goal 的 `roundsStarted`。
- 把 goal 改为 `paused`、`blocked` 或 `complete`。

后台结果继续通过现有 jobs/subagent 交付路径传递，并可以唤醒主 Agent。后台工作全部结束后，下一个真正的 idle 边界才可以恢复自动续行；终态 Job 的通知与输出收集不改变 Goal Round 准入规则。

### A-4. 竞态处理

驱动器必须在两个位置重新检查后台工作：

1. 创建下一轮 reservation 之前。
2. `agent/pre-step` 验证 reservation、模型请求即将进入之前。

如果后台工作在两次检查之间出现，reservation 必须走现有 stale/不准入路径。不得发送模型请求、增加 Round 计数或为 goal 写入 blocker。临时移除的非 goal 输入必须走现有恢复路径。

### A-5. 生命周期与隔离

- 后台状态变化应请求再次评估驱动器，而不是轮询模型或使用定时器。
- `onJobsChanged` 必须通过由 driver fiber 拥有的 child injection 注册；忽略 `owner === undefined`，只对已有且 Agent 对象为精确 owner 的 state 请求重评估。不得为其他 owner 创建 state，也不得因 unowned 变化驱动所有 Agent。
- 重新加载驱动器时不得漏掉已有活动并错误续行；新的评估使用精确 Job 查询和 live continuable activity 查询。
- teardown 继续按现有生命周期规则关闭准入、取消或等待 Goal Round，并清理后台观察器。

## 3. 需求 B：外置 goal 状态引导提示词

### B-1. 外置归属

独立创建插件：

```text
C:\Users\HJ\.dsh\plugins\dsh-goal-guidance
```

通过 Web profile 的 `package.json` 依赖和 `cordis.patch.yml` 插入挂载。不得为了该引导修改内置 `dsh-goal` 或 `dsh-tool-goal` 源码。

### B-2. 触发时机

Agent 即将进入模型步骤时，外置插件沿用 `time-context` 的 `agent/pre-step` 模式：

- 先调用下游 listener。
- 只对即将进入的 decision 追加引导。
- 不调用 `followup()`、`steer()` 或另一个 `agent.inject()`，因此插件不会唤醒 Agent 或创建独立 turn。
- 每个 turn 最多追加一条 goal 引导消息。

首个版本只在主 Agent 的开放 turn 中包含直接人类消息时触发。仅由后台结果、子代理报告、Goal Round 或其他插件通知唤醒的 Agent 不触发引导。listener 必须同时要求 `ctx.agents.get(agent.id) === agent` 且 `agent.session.header.parentSession === undefined`；不能单独使用 `ctx.agents.roots()`，因为 continuable child 可能属于 runtime root。child session 中 `source.kind === 'user'` 的消息不属于本插件的 direct human 输入。

### B-3. 不可执行 goal 状态

首个版本按以下状态生成状态引导：

| 当前状态 | 引导动作 |
|---|---|
| 没有当前 goal | 如果直接人类请求是长期完成目标，先调用 `create_goal`；小型单轮任务不要创建 goal。 |
| `paused` | 如果直接人类请求要求继续同一目标，调用 `get_goal`，再用精确的 `goal_id` 和 `revision` 调用 `update_goal(resume)`；没有该意图时不得恢复。 |
| `blocked` | 先阅读 blocker；只有直接人类请求表示 blocker 已解决或要求继续时，才用精确 ref 尝试 `resume`；不要把困难或不确定性当成新的 blocker。 |
| `active + disarmed` | 说明目标存在但自动续行未启用；直接人类明确要求继续时，读取精确 ref 并调用 `resume`。 |
| `complete` | 首版不发送恢复引导；既有工具策略仍允许长期新请求创建替代 goal。 |

### B-4. 引导内容

引导使用面向模型的任务语言，不暴露 UI、RPC、插件组合或内部调度术语。至少说明：

- 当前状态没有可执行 goal；模型不必无条件创建或恢复 goal。
- 只有长期完成目标才应创建 goal；常规单轮工作不应创建。
- 更新 goal 前必须先 `get_goal`，并使用精确的 `goal_id` 和 `revision`。
- paused、blocked 或 disarmed goal 不能仅因插件通知而恢复；需要直接人类的继续意图。
- 引导本身不表示 goal 已创建、恢复或完成。

引导消息使用带 `form: 'snapshot'` 和 section 名称的 plugin source，并写入会话的 `user/message` 记录，使模型可见内容可回放。

### B-5. 去重与失败

- 去重从当前 turn 的持久会话记录和即将进入的消息派生，不依赖不可回放的全局 singleton。
- pre-step 被拒绝、signal 已取消或 Agent 不满足精确 live-main-session 检查时，不追加引导；判断 direct-human 输入前同时检查当前 turn 的持久 suffix 和即将进入的 `decision.messages`。
- 合法的无当前 goal 投影是正常状态；投影损坏、依赖缺失和其他服务错误沿用现有 fail-loud 行为，不伪装成无 goal。

## 4. 共同验收标准

### A 场景

1. 没有后台工作时，active + armed goal 维持现有自动续行。
2. 存在 running Job 时，Agent 普通阶段性回复后不产生新的 Goal Round。
3. Job 进入终态后不因其 `reported` 值阻塞；完成通知和输出收集维持现有 jobs 行为。
4. continuable child 位于 `subagent/start` 与 `subagent/end` 之间时不产生新的 Goal Round，结算通知仍通过现有路径到达父 Agent。
5. 后台工作在 reservation 后、pre-step 前出现时，Goal Round 被丢弃，不阻塞、不计数、不请求模型。
6. 其他 Agent 拥有的 Job 和 unowned Job 不影响当前 Agent。
7. 所有后台工作结束后，下一个真正的 idle 边界恢复自动续行。
8. 插件卸载、Agent disposal 和取消不会留下 observer、reservation 或后续自动轮次。
9. 对先触发 `onJobsChanged`、再发出完成通知的 Job settlement，分别测试终态 `reported: false` 与 `reported: true`；两种情况都不得发送模型请求、增加 Round 计数或写入 blocker，通知仍必须交付。

### B 场景

1. 没有 goal 的 Agent 收到直接人类请求时，下一个模型请求最多出现一条创建引导。
2. 同一 turn 的后续工具步骤不再次追加引导。
3. `paused`、`blocked` 和 `active + disarmed` 生成对应引导；`active + armed` 不生成；首版 `complete` 不生成。
4. 仅由插件通知或后台结果唤醒的步骤不生成引导。
5. 引导不打开额外 turn，不改变 goal revision/phase，也不自行调用 goal mutation。
6. 外置插件卸载后不再追加引导；内置 goal 和 tool 包保持不变。
7. Web owner 的 keyless session snapshot 记录引导 source、同一 turn 去重、通知独立唤醒不追加，以及 `complete`/`active + disarmed` 分支。

## 5. 非目标

- 不改变 GoalService 持久化格式、状态转换或 CAS 规则。
- 不引入 token、时间或货币预算。
- 不让模型绕过 goal 工具已有的直接人类权限检查。
- 不通过静态系统提示词在每个请求重复发送动态 goal 状态。
- 不用 `job_list`、`list_agents` 轮询或模型自检替代 owner-scoped 生命周期事实。
