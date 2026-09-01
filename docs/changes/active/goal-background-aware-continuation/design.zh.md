# Goal 后台感知续行与外置引导设计

[English](design.md) | 中文

状态：`in-progress`（A、B 均已实现；完整验收待执行）

关联需求：[`requirements.zh.md`](requirements.zh.md)

## 1. 设计结论

本变更保留 goal 领域与模型侧消费方现有的职责划分：

- A 直接修改内置 `@deepseek-ai/dsh-goal-round-driver`，因为只有该插件决定何时排队并准入自动 `<goal_round>`；当前没有外置插件可以安全使用的公共 veto 点，同时又不会把合法等待变成 blocker。
- B 创建外置 `dsh-goal-guidance`，因为它是动态模型引导，不需要改变 goal 状态或工具权限；它位于 `C:\Users\HJ\.dsh\plugins`，由 Web profile 组合。

不要把 A 实现成外置 listener 在 `agent/pre-step` 中拒绝已经排队的 Goal Round。内置 driver 会在终止和恢复路径中使用被拒绝的 reservation，外置 listener 无法可靠区分后台等待与真正的 Goal Round 失败。也不要用外置 `pause`/`resume` 模拟等待，因为这会改变持久 phase、revision 和用户可见状态。

## 2. A：后台工作判定

### 2.1 查询 Job 注册表

在 `@deepseek-ai/dsh-jobs` Service Definition 增加精确 owner 的只读查询，例如 `hasActive(owner: Agent): boolean`，并在 `LocalJobRegistry` 中复用精确 owner 的 active count。

```text
function hasOutstandingOwnedJob(agent: Agent): boolean {
  const jobs = ctx.get('jobs')
  return jobs?.hasActive(agent) ?? false
}
```

`hasActive(owner)` 比较精确的 Agent 对象，只统计 `running` 和 `stopping`，对终态 Job 无论 `reported` 值为何都返回 false；因此相同 SessionId 的 replacement 不会观察到旧 Agent 生命周期拥有的 Job。

`ctx.get('jobs')` 只用于准入读取。`onJobsChanged` 必须通过由 driver fiber 拥有的 child injection 注册；回调忽略 `owner === undefined`，只对已有且 Agent 对象为精确 owner 的 state 请求重评估。不得为其他 owner 创建 state，也不得因 unowned 变化驱动所有 Agent。缺少 Jobs provider 时 gate 为 false 且不建立 observer。

### 2.2 Continuable 子代理查询

continuable 子代理不使用 Job wrapper，因此在 `ctx.subagents` 增加公开、同步、只读查询，例如 `hasPendingContinuations(parent: Agent): boolean`，并按 `ctx.get('subagents')?.hasPendingContinuations(agent) ?? false` 读取。

- 该查询仅在精确 Agent 拥有 direct child 的 live Activation 时返回 true；没有 manager 的 provider、已经持久化但尚未 materialize 的 child 返回 false。`subagent/start` 之前已创建的 Activation 计入，精确 parent replacement 不匹配旧 Activation。
- 父级作用域的 `subagent/start` listener 请求再次评估 driver；匹配的 `subagent/end` listener 也这样做。事件只负责唤醒重评估，不维护第二份生命周期源。
- manager 在交付 settlement notice 和发布 `subagent/end` 之前移除 Activation，之后才释放 parent ownership。因此 end listener 中查询必须已经为 false，不能只从 `ownedChildren` 推导。
- 已安装 provider 的查询抛错时，driver 通过现有错误路径暴露错误，不把它当成没有工作；driver fiber 在 dispose 时移除这些 listener，并等待已有的 driver teardown。

使用已有的 `carrierKeyOf(this)` 识别事件的精确父级，不向 `SubagentRunInfo` wire payload 添加 parent 字段。不要读取 continuation manager 的私有 `activations`，也不要把 `listChildren().activity` 当作精确 residency 查询。公开查询提供 reload 后的当前状态，listener 即使从生命周期中途开始也不会漏掉 active child。

one-shot 子代理也可能产生 `subagent/start` 和 `subagent/end`，但其后台路径仍由精确 owner Job 查询负责；查询只统计 continuable live Activation，因此生命周期噪声会被忽略，不会重复 Goal Round。

### 2.3 驱动条件与唤醒

把 `hasOutstandingBackgroundWork` 加入现有 `readyToDrive` 检查，并在 reservation 准入和 pre-step 重校验时再次读取：

```text
readyToDrive
  = existing agent/goal/competing/stopping checks
  && !hasOutstandingBackgroundWork(agent)
```

`ctx.jobs.onJobsChanged` 通过上面所述的 driver-owned child injection 注册。`subagent/start` 和 `subagent/end` 解析 carrier parent 和已有 Agent state 后，只请求现有 driver 评估；不调用模型、`followup` 或 goal mutation。现有 Job completion listener 继续决定结果进入 next-step、打开 next-turn 或保持 quiet。

如果 reservation 后出现后台工作，pre-step 检查走现有 stale-reservation 恢复路径：移除或拒绝 Goal message，保留其他已领取或新排队的输入，释放 attempt，等待后台交付或另一个外部唤醒。它不调用 `goals.block()`，因为等待是调度条件，不是持久 blocker。

Job settlement 可能先触发 `onJobsChanged`，再由 completion listener 发出终态通知。driver 可能先观察到没有 active Job 并请求评估，但通知会在 pre-step 准入前成为 competing input；最终检查必须使 reservation stale，不产生模型请求、Round 增量或 blocker，并覆盖终态 `reported: false` 与 `reported: true`。

### 2.4 终态与生命周期边界

- continuable child 只有在 `hasPendingContinuations(parent)` 为 true 时阻塞续行；manager 在 settlement notice 和 `subagent/end` 前移除 live Activation，因此 end 后查询为 false，交付顺序仍由 manager 负责。
- Job 处于 `completed`、`failed` 或 `killed` 时不再属于进行中的后台工作；现有 jobs 控制完成通知、输出读取和 `reported` 更新。
- 当前 Agent disposal 时，driver 移除其关联，不为失效生命周期创建 reservation。
- teardown 期间先关闭新的准入，现有 driver 工作沿用当前取消/等待路径，observer 不得在 teardown 后请求新的 drive。

## 3. B：外置 `dsh-goal-guidance`

### 3.1 包与 profile

目录：

```text
C:\Users\HJ\.dsh\plugins\dsh-goal-guidance\
  package.json
  index.mjs
  README.md
```

采用现有 `dsh-soul` 插件的直接 ESM 形式：导出 `name`、`inject` 和 `apply`；不加入仓库 `packages/` aggregate，也不修改 shipped package。`package.json` 只声明运行时需要的 Cordis、Agent、goal 和 LLM 构造依赖；profile 将包 link 到该绝对路径。

Web profile 需要：

1. 在 `C:\Users\HJ\.dsh\profiles\web\package.json` 增加 `dsh-goal-guidance` 的 `link:` 依赖。
2. 在 `C:\Users\HJ\.dsh\profiles\web\cordis.patch.yml` 的 `insert` 部分增加一行 `goal-guidance`。
3. 保持当前 `hmr` 行 disabled；本变更不增加 HMR root。通过 `dump-config` 验证激活，并要求依赖或 patch 变化后由用户手动 reload 进程。未来若启用 HMR，必须在独立变更中重述完整行配置，并为内置 driver 和外置 entry 增加精确 built-artifact root。
4. 执行 `dsh --profile web --dump-config`，确认只挂载一份外置实现。

本变更不把该插件加入内置 `standard` 或 `ptc` preset。引导步骤必须同时要求 `ctx.agents.get(agent.id) === agent` 且 `agent.session.header.parentSession === undefined`；不能单独使用 `ctx.agents.roots()`，因为 continuable child 可能属于 runtime root，同时保留 durable parent lineage。

### 3.2 pre-step 数据流

插件注册一个 effect-owned 的 `agent/pre-step` listener，沿用 `time-context`：

1. 调用 `next()`，保留其 `kind`、`messages`、`startsRequestSeries` 和 reject 结果。
2. decision reject、signal 已取消或 Agent 不满足精确 live-main-session 检查（`ctx.agents.get(agent.id) === agent` 且 `agent.session.header.parentSession === undefined`）时，原样返回。
3. 从当前开放 turn 的持久 suffix 和即将进入的 `decision.messages` 中检查 direct human message；child session 中 `source.kind === 'user'` 的消息不属于 direct human 输入。
4. 读取 `ctx.goals.get(agent)`，把 `undefined`、`paused`、`blocked` 和 `active + disarmed` 映射到对应引导。
5. 检查当前 turn 是否已经有 `dsh-goal-guidance` snapshot；有则不追加重复消息。
6. 创建带有以下 source 的 `UserMessage`：

```text
{
  kind: 'plugin',
  plugin: 'dsh-goal-guidance',
  form: 'snapshot',
  sections: [{ name: 'goal-guidance', text }],
}
```

7. 返回 `{ ...decision, messages: [...decision.messages, guidance] }`。

Agent loop 接受步骤时，消息与其他 `user/message` 事件一起持久化，因此不会创建独立唤醒或 turn。去重从当前 `turn/start` 开始扫描，所以插件 reload 不会仅因内存 WeakMap 丢失而重复提示。

### 3.3 文本策略

为模型使用稳定的任务语言，并保留以下分支：

- 没有 goal：判断直接人类请求是否为长期完成目标；是则调用 `create_goal`，否则按普通单轮任务处理。
- paused：只有直接人类请求继续现有目标时，才调用 `get_goal` 后 `update_goal(resume)`。
- blocked：先判断 blocker 是否已解决；不要仅因工作困难而 resume 或追加 blocker。
- active + disarmed：说明 resume/fork 后的显式 rearm 需要直接人类继续请求。
- active + armed 和 complete：首版不追加动态引导。`complete` 不执行 resume；新的长期直接请求仍可依赖既有 `create_goal` policy 创建 replacement goal。

文本不得向模型暴露 `ctx.goals`、Jobs、reservation、RPC 或 profile 术语，也不得执行 mutation。现有 goal-tool authority check 仍是唯一执行时约束。

## 4. 测试与文档设计

### 4.1 A 焦点测试

扩展 `packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts` 的真实 Agent Loop harness：

- 挂载真实 `LocalJobRegistry` 和 controller，使用 deferred `done` promise 测试 `running`、`stopping` 以及不阻塞的终态 Job；用终态 `reported: false` 和 `reported: true` 断言 settlement-before-completion-notice 竞态。
- 挂载或模拟真实 continuable subagent，验证精确 direct-child live Activation、pre-`start` materialization 情况、移除 Activation 后再 settlement/end 的顺序，以及同一 SessionId 的 parent replacement。
- 覆盖后台工作在 reservation 后、pre-step 前出现的 race。
- 覆盖其他 owner 和 unowned Job 不阻塞。
- 覆盖 listener dispose 后不再 drive。

焦点测试不得使用 sleep 或模型轮询；使用 deferred promise、生命周期事件和 `whenIdle()` 等已有 quiescence 信号。

### 4.2 B 焦点测试

使用外置插件的真实 Loader 组合，而不只是手工 `ctx.plugin` fixture，并验证：

- direct-human 输入在无 goal、paused、blocked 和 active + disarmed 时的文本与 snapshot source；
- active + armed、complete、plugin notice、仅后台结果的步骤不追加消息，并且同一 turn 不重复；
- continuable child 的初始 prompt 即使 `source.kind === 'user'` 也不追加；pre-step reject 或 cancellation 后也不追加；
- 缺少 goal service 或 projection failure 时保持 fail-loud，dispose 后移除 listener；
- 追加引导不会增加 turn，也不会修改 goal。

### 4.3 组合与快照

A/B 的模型可见行为需要更新 keyless recorded-session snapshot：

- A 的 shipped profile keyless session snapshot 在 `apps/cli/tests/profiles/acp/tests/goal.expected.e2e.ts` 及其 `goal-expected` artifacts 中覆盖后台等待、无额外 Round 和交付后续行。
- 只有在 fixture 确实挂载 Jobs 与 continuable-subagent provider 时，`apps/cli/tests/profiles/headless/goal.cordis.snapshot.yml` 中的 fixture 才能证明 A。
- 为 B 增加 Web owner 的 keyless 场景 `apps/web/tests/goal-guidance.e2e.ts`，以及 owner-local `snapshots/web/goal-guidance/` artifacts；记录引导 source、同一 turn 去重、通知/后台结果独立唤醒不追加，以及 `complete`/`active + disarmed` 分支。
- 不能用 ACP 或 headless snapshot 证明 B，因为 B 只由 Web profile 挂载。

实现只增加 runtime query 和普通 plugin `UserMessage` 记录，不新增 `SessionEventMap` 成员或 Agent Loop 协议变更，因此不触发 TypeScript/Python SDK projection 同步；若该边界改变，再增加对应 expected output。

实现后更新 [`packages/goal/goal-round-driver/README.zh.md`](../../../../packages/goal/goal-round-driver/README.zh.md) 和外置插件 README；只有当前行为确实改变时才更新 `dsh-goal` 或 `tool-goal`。非平凡的内置代码修改还需在同一变更中增加或更新 bug-fix Agent Note。

## 5. 运行时验证

实现后：

1. 运行 A/B 焦点测试和真实组合测试。
2. 运行 keyless snapshot replay，确认等待后台工作不增加 Goal Round，并且交付后可以继续。
3. 只有 profile 依赖改变时，才在 Web profile 中运行 `pnpm install`，随后运行 `dsh --profile web --dump-config`。
4. 验证外置 entry 的精确 profile 解析路径。
5. HMR 不属于本变更，因为当前 Web profile 的 `hmr` 行处于 disabled。只验证手动 reload/activation；未来 HMR 变更必须先重述完整行配置和精确 built-artifact root，才能声称支持 live update。
6. 运行文档和工作树检查。
