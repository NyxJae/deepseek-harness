# local-use 官方更新集成

本流程用于在 DSH fork 中吸收当前官方代码，同时保留仍有价值的本地功能。Git 分支与发布操作遵循 `git-operations` 技能；测试选择遵循 [dsh-pre-push-checks](../../dsh-pre-push-checks/SKILL.md)。当前 RC1 分支的整改事实与验收归 [集成审核指南](../../../../docs/cookbook/local-use-0.1.7-rc.1-review-fixes.md) 管理。

## 确定同步范围

1. 在 fork 根目录读取当前 [AGENTS.md](../../../../AGENTS.md)、分支、工作树状态与 `origin` / `upstream`。用户未提交的根工作树改动保持原样，在项目内 `.worktree/<purpose>` 建立独立集成分支。
2. 拉取并核实这次使用的官方、fork 和自用分支引用；记录 Git commit ID 与 merge base。运行 `pnpm --silent run change-scope --base <已核实的基线>`，区分已提交、暂存、未暂存和新文件。
3. 查阅[架构](../../../../docs/architecture.md)及各包 README，按当前官方实现判定本地功能的所有者。官方已有等价实现时直接采用；仍需保留的本地行为在当前包、事件与客户端 Slot 中实现，连同测试和所属文档一起修改。

## 集成与验收

- 在隔离工作树中维护官方代码主体和既有 `local-use` 祖先关系。历史分支只提供功能依据，不作为直接覆盖当前代码树的文件模板；先核对目标分支是否可以 fast-forward。
- 同步上游后运行完整 `pnpm run build`，使 Host、Client 与 Web 产物共享同一次构建环境。对变动的包运行 focused tests，用户可见输出运行所属 keyless Web replay；文档和包声明运行相应生成器与检查。
- 可运行的 profile 在独立 `$DSH_HOME` 和独立 loopback 端口验证。`3079`/`3080` 的启动、停止和重启属于用户；端口、进程及实际加载代码按 [Skill 验收规则](../SKILL.md#protected-web-ports-and-live-verification) 核对。
- Windows 的标准预设禁用 Bash；依赖 Bash 的录制场景以 Linux CI 的 replay 为证据。Windows symlink 权限导致的门禁失败保留原始输出，不改产品安全策略来制造通过。

## 发布与后续

- 审阅完整 diff、变更范围和验收结果；每次 Git commit 与 push 另取用户明确批准。GitHub 项目经 `git-operations` 的 VPS relay 发布，并验证本地 HEAD、VPS mirror、GitHub ref 与本地 tracking ref 一致。
- 只有用户批准且独立集成分支具备所需证据时，才决定是否将 `local-use` 通过 fast-forward 接入该结果；受保护的根工作树和未提交内容保持原状。
