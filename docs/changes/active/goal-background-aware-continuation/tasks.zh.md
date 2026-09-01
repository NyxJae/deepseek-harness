# Goal 后台感知续行与外置引导开发计划

[English](tasks.md) | 中文

状态：`in-progress`（A、B 均已实现；完整验收待执行）

需求：[`requirements.zh.md`](requirements.zh.md)

设计：[`design.zh.md`](design.zh.md)

## 阶段 0：批准与基线

- [ ] 确认两个需求保持独立：A 修改内置 `goal-round-driver`，B 使用 `C:\Users\HJ\.dsh\plugins\dsh-goal-guidance`。
- [ ] 实现前记录 `git status --short --branch`，不覆盖用户已有修改。
- [ ] 保留 goal driver、Jobs、subagent 和 goal-tool snapshot 的基线行为。

## 阶段 1：实现 A 的后台工作 gate

### 1.1 Job 观察

- [x] 在 `packages/goal/goal-round-driver/src/index.ts` 增加精确 owner 的后台工作查询。
- [x] 在 `packages/jobs/jobs/src/index.ts` 增加精确 Agent 生命周期查询（例如 `hasActive(owner: Agent)`）；在 `packages/jobs/jobs-local/src/index.ts` 使用现有精确 owner active count 实现，并增加 Jobs 测试和 API 文档。
- [ ] 为 `packages/goal/goal-round-driver/package.json` 增加源码 import 所需的 `@deepseek-ai/dsh-jobs`、`@deepseek-ai/dsh-subagent` 和 `@deepseek-ai/dsh-scope` peer/dev 依赖，并验证 source/lib 边界。
- [x] 为 Jobs Service Definition 和 provider 补齐公共 JSDoc：精确 Agent 对象身份、仅统计 `running`/`stopping`、排除终态 `reported`、返回值以及不匹配同一 SessionId replacement。
- [x] 通过 `ctx.get('jobs')` 保持 Jobs provider 可选。
- [x] 只统计精确 owner 的 `running`/`stopping` Job；终态不阻塞 Goal Round。
- [x] 通过 `ctx.inject(['jobs'], jobsCtx => ...)` 在 driver-owned child injection 中注册 `onJobsChanged`；忽略 `owner === undefined` 和其他 owner，缺少可选 provider 时不建立 observer。

### 1.2 Continuable 子代理观察

- [x] 在 `packages/subagent/subagent/src/index.ts` 和 continuation manager 增加公开、同步、只读的 `hasPendingContinuations(parent: Agent)` 查询；定义为精确 parent 的 direct-child live Activation，并记录 managerless、cold-persisted 和 exact-parent-replacement 行为。
- [x] goal driver 只监听 `subagent/start`/`subagent/end` 来请求重评估，使用普通 function 和 `carrierKeyOf(this)`；测试 Activation 在 settlement/end 前移除、end 后释放 parent ownership，以及 one-shot lifecycle 噪声。
- [x] 在 Agent disposal、driver disposal、manager teardown 和后续手动 reload 时释放所有 listener 与等待中的 drive 工作；定义 provider 缺失和 query error 行为，不把错误转换成无工作。

### 1.3 准入与竞态

- [x] 在创建 reservation 前加入后台 gate。
- [x] 在 `agent/pre-step` reservation 验证时再次检查同一个 gate。
- [x] 后台工作在两次检查间出现时，走现有 stale 路径，不阻塞 goal、不计 Round、不请求模型。
- [ ] 覆盖 completion-before-notice 顺序和 observer 不直接调用模型；测试 running、即使 `reported` 为 true 的 stopping、终态 `reported: false`、终态 `reported: true`、unowned、其他 owner、同一 SessionId replacement、reservation-to-pre-step 工作、continuable start/end、settlement-before-end、one-shot lifecycle noise、cold persisted child，以及没有 Jobs/subagent provider 的 goal-only 组合。

## 阶段 2：实现 B 的外置插件

### 2.1 外置包

- [x] 创建 `C:\Users\HJ\.dsh\plugins\dsh-goal-guidance\package.json`。
- [x] 创建导出 `name`、`inject` 和 `apply` 的 `C:\Users\HJ\.dsh\plugins\dsh-goal-guidance\index.mjs`。
- [x] 创建外置插件 README，说明触发条件、消息 source、profile 挂载和限制。
- [x] 让插件只作用于精确 live main-session 检查（`ctx.agents.get(agent.id) === agent` 且 `agent.session.header.parentSession === undefined`），并从当前 turn 记录派生 direct-human 输入；增加 child session 初始 prompt 为 `source.kind === 'user'` 的回归。

### 2.2 动态引导

- [x] 参考 `packages/context/time-context/src/index.ts` 注册 effect-owned `agent/pre-step` listener。
- [x] 实现无 goal、paused、blocked 和 active + disarmed 文本；首版不在 active + armed 或 complete 时追加。
- [x] 追加一条带 `form: 'snapshot'` 的 `dsh-goal-guidance` plugin `UserMessage`，按 turn 去重。
- [x] 不修改 goal、不创建独立 turn，也不在只有后台结果或插件通知的步骤追加引导；测试 proposed-message 扫描和精确 source 字段。

## 阶段 3：profile 与 artifact 组合

- [x] 在 `C:\Users\HJ\.dsh\profiles\web\package.json` 增加外置插件 `link:` 依赖。
- [x] 在 `C:\Users\HJ\.dsh\profiles\web\cordis.patch.yml` 插入一行 `goal-guidance`。
- [x] 保持当前 Web profile 的 `hmr` 行 disabled；本变更不增加 HMR root，记录手动 activation/reload，且不重启受保护的 DSH Web Node 进程。
- [x] 依赖变化时，在 Web profile 运行 `pnpm install` 并更新 `pnpm-lock.yaml`，使 lockfile、resolver link 与 patch 一致。
- [x] 运行 `dsh --profile web --dump-config`，确认一个内置 driver 和一个外置 guidance 实现。

## 阶段 4：测试与模型可见输出

- [ ] 扩展 `packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts` 的真实 Loop harness，覆盖 Jobs 和 continuable subagent。
- [ ] 增加 running/stopping Job、终态 Job 不阻塞、精确 owner replacement、continuable activity、settlement-before-end 顺序和 completion notice delivery 回归。
- [x] 增加 reservation-to-pre-step 后台工作竞态回归。
- [ ] 通过真实 Loader 组合测试外置插件，包括缺少 goal service/projection failure、主会话过滤、continuable child 初始 prompt、plugin notice、后台结果、reject、cancel、重复输入和 dispose。
- [ ] 更新 `apps/cli/tests/profiles/acp/tests/goal.expected.e2e.ts` 及其 artifacts，覆盖 A 的 shipped-profile 后台等待、无额外 Round 和交付后续行行为。
- [ ] 只有在挂载 Jobs 与 continuable-subagent provider 时，才用 headless goal snapshot fixture 证明 A；为 B 增加必需的 Web owner 场景 `apps/web/tests/goal-guidance.e2e.ts` 和 owner-local `snapshots/web/goal-guidance/` artifacts。
- [ ] 断言 A/B 只增加 runtime query 和普通 plugin `UserMessage` 记录，不新增 `SessionEventMap` 成员或 Agent Loop 协议变更；因此除非该边界改变，否则 TypeScript/Python SDK expected output 保持不变。

## 阶段 5：文档与验收

- [x] 更新 `packages/goal/goal-round-driver/README.md` 和 `README.zh.md`，说明后台等待 gate。
- [x] 更新 Jobs 和 Subagent 包 README，说明新的公共 query contract 与终态/continuable 语义。
- [x] 源码 JSDoc 修改后，生成 Cordis API catalog 和子系统投影；不得手改生成的 API/type-equivalent 片段。
- [x] 更新现有已实现的 Same-session goal-round driver Agent Note 及中文对应文件，记录已发布的后台工作决策；刷新配对记录。
- [ ] 运行焦点测试、snapshot replay、Web owner snapshot 检查和 `dsh --profile web --dump-config`。
- [ ] 运行 `pnpm run test:docs`、`pnpm run doc-sync` 和 `git diff --check`。
- [ ] 记录命令、结果、未解决问题和手动 reload 要求；完成前保持 `status.yaml` 为 `proposed` 或 `in-progress`。

## 交付顺序

1. 先实现并验证 B 的外置插件，再实现 A，以便先验证独立的模型引导路径而不修改内置 driver。
2. B 完成后实现并验证 A，再刷新共享包文档和生成目录。
3. 在剩余 Loader、snapshot 和仓库门禁证据可用前保持变更为 `in-progress`；未完成或缺证据的变更不得归档。
