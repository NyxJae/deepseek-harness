# AGENTS.md — Active changes

[English](AGENTS.md) | 中文

## 范围与归属

本目录保存尚未完成的跨包需求、目标设计、开发任务和验收记录。每项变更使用独立子目录，并由该目录的 `AGENTS.md` 细化文件归属与状态规则。

当前变更：[`goal-background-aware-continuation`](active/goal-background-aware-continuation/requirements.zh.md)。

## 规则

- active change 文档描述目标态或已验证的当前事实；未合入的行为必须标记为 `proposed` 或“未实现”。
- 需求、设计、任务与验证记录保持相互链接；代码路径、profile 路径和命令保持原文。
- 变更完成前不得移动到 archive；实现后将当前行为同步到最近的包 README、子系统页面和必要的 Agent Note。
- 文档检查使用 `pnpm run test:docs`、`pnpm run doc-sync` 和 `git diff --check`；只报告实际执行的命令。
