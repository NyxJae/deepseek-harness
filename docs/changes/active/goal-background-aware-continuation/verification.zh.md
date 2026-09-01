# Goal 后台感知续行与外置引导验收记录

[English](verification.md) | 中文

状态：`in-progress`（A、B 均已实现；聚焦验证通过；完整验收待执行）

需求：[`requirements.zh.md`](requirements.zh.md)

设计：[`design.zh.md`](design.zh.md)

任务：[`tasks.zh.md`](tasks.zh.md)

## 已完成的调研证据

| 项目 | 证据 | 结论 |
|---|---|---|
| Web profile 组合 | `dsh --profile web --dump-config` | shipped Web bundle 包含 `goal` 和 `goal-round-driver`；用户 profile 现在有一条 `dsh-goal-guidance` dependency 和 `goal-guidance` patch 行，外置目录已包含实现，`hmr` 行处于 disabled。 |
| 后台 Job 状态 | `packages/jobs/jobs/src/types.ts`、`packages/jobs/jobs/src/index.ts`、`packages/jobs/jobs-local/src/index.ts` | owner、`running`/`stopping`、终态 `reported` 和 `onJobsChanged()` 仍是生命周期事实；`hasActive(owner)` 现在只报告精确所有者的存活工作，终态 Job 不计入。 |
| Continuable 子代理 | `packages/subagent/subagent/src/lifecycle.ts`、`src/continuation.ts` 及 continuation tests | 父级作用域存在 `subagent/start`/`subagent/end`；结算通知先于 `subagent/end`；`hasPendingContinuations(parent)` 现在只报告精确 parent 的直接子级 live Activation。 |
| 动态上下文注入 | `packages/context/time-context/src/index.ts` | `agent/pre-step` 在下游准入后追加带 source 的持久 `UserMessage`。 |
| 当前工作树 | `git status --short --branch` | 存在用户修改；本变更没有覆盖它们。 |

## 当前实现状态

- 内置源码现在包含后台工作 gate；外置 B 仍已实现。
- 外置插件目录和入口已创建；Web profile dependency、patch 行和 lockfile 已更新。
- `pnpm install`、`pnpm run gen-cordis-catalog`、四包聚焦 Vitest（226 tests）、外置 `node --check`/import/smoke 检查和 `dsh --profile web --dump-config` 均已通过；没有重启受保护的 Web Node 进程。
- 真实 Loader 行为、模型可见的 Web snapshot、完成通知顺序、广泛跨 owner/cold child 覆盖和完整仓库门禁仍待执行；完整门禁按要求未运行。
## 已执行的聚焦验证

- `pnpm install` ——退出 0；workspace 依赖和 lockfile 已同步；没有重启 Node 进程。
- `pnpm run gen-cordis-catalog` ——退出 0；计算 97 个 artifact，写入 5 个生成文件，刷新 2 条配对记录。
- `pnpm exec vitest run packages/jobs/jobs/tests/service.spec.ts packages/jobs/jobs-local/tests/jobs.spec.ts packages/subagent/subagent/tests/continuation.spec.ts packages/goal/goal-round-driver/tests/goal-round-driver.spec.ts` ——退出 0；4 个文件、226 个测试通过。
- 外置插件检查 ——`node --check index.mjs`、直接 ESM import 和 `C:\Users\HJ\.dsh\.temp\goal-guidance-smoke.mjs` 之前均已通过；profile `pnpm install` 和 `pnpm dsh --profile web --dump-config` 也退出 0。
- 没有停止或重启受保护的 DSH Web Node 进程；HMR 仍处于 disabled，激活需要用户手动 reload/restart。
## 待执行验收

### A：自动续行

- [x] 没有后台工作时，现有 Goal Round 保持不变。
- [x] 精确 owner 的 Job 处于 `running`/`stopping` 时阻止新的 Goal Round，包括 `reported: true` 的 stopping；同一 SessionId 的 replacement 不匹配旧 owner。
- [ ] owner Job 在 `reported: false` 或 `reported: true` 的终态都不阻塞；当 `onJobsChanged` 先于完成通知时，最终准入保持 stale，不产生模型请求、Round 增量或 blocker，通知沿用现有交付路径。
- [ ] `hasPendingContinuations` 为 true 时只覆盖精确 parent 的 direct-child live Activation；cold persisted child 不阻塞，Activation 先于 settlement/end 被移除，结算保持现有交付顺序。
- [x] 后台工作在 reservation 后、pre-step 前出现时安全丢弃，不阻塞、不计数、不请求模型。
- [ ] 其他 owner 和 unowned 工作不阻塞，也不创建跨 Agent 的评估。
- [x] Agent/driver teardown 不留下 listener、reservation 或后续轮次。

### B：外置引导

- [x] direct-human + 无 goal 追加一条创建引导。
- [x] paused、blocked 和 active + disarmed 追加正确的恢复引导。
- [x] active + armed、complete、plugin notice 和仅后台结果的步骤不追加。
- [x] 同一 turn 不重复；reject、cancel 和 dispose 不追加。
- [ ] 消息 source、持久记录和回放输出稳定。
- [ ] 外置插件卸载后停止引导，不改变内置 goal/tool 包。
- [ ] 初始 prompt 带 `source.kind === 'user'` 的 continuable child 不收到主会话引导；complete + direct human 输入仍可通过既有 policy 使用 `create_goal`。

### 文档与组合

- [x] `dsh --profile web --dump-config` 展示预期的内置 driver 和一份外置 guidance 实现。
- [ ] keyless session snapshot 证明等待后台工作期间没有额外 Goal Round，并且 B 的 Web owner 场景记录引导 source、去重、通知独立唤醒不追加和状态分支。
- [ ] `pnpm run test:docs` 通过。
- [ ] `pnpm run doc-sync` 通过。
- [ ] `git diff --check` 通过，最终记录说明 HMR 保持 disabled，激活需要用户手动 reload。

## 实现后的记录格式

每条已执行命令记录命令原文、退出结果、profile/artifact 路径和是否重启。失败、跳过或需要用户操作的项目保持未勾选，不写成通过。
