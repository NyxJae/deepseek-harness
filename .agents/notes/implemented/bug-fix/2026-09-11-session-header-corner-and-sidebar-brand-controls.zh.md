# Agent Note: Session header corner 与 sidebar brand 控件

Status: implemented

[English](2026-09-11-session-header-corner-and-sidebar-brand-controls.md) | 中文

## Problem

Session header 可能包含窄视口无法一次容纳的多个 utility 控件。右 corner 席位必须保持在最右侧，同时标题、lineage 与 utility 控件仍可通过横向滚动到达。展开的 sidebar brand 按钮在桌面端和移动端都是导航控件；创建会话需要独立且明确的操作。

## Decision

`ConversationSession` 将标题 cluster 与 header utilities 包在 `data-conversation-header-scroller` 中，并让 `data-conversation-header-corner` 成为它的兄弟节点。在 `max-width: 600px` 下，只有 scroller 横向移动；corner 席位保持为不参与滚动的 flex item。

展开状态的 sidebar brand 按钮使用本地化的收起标签，把焦点移到持久存在的 rail toggle，并在桌面端和移动端调用 `toggleSidebar()`。独立的 New Session 按钮仍是 brand 区域中唯一调用 `startSession()` 的操作。

两个控件保持分离，因为导航状态与会话创建代表不同的用户意图。scroller 负责溢出，corner 席位负责固定可达性。

## Alternatives considered

**滚动整个 title row。** 不采用，因为右 corner 操作会随过长的 utility 条带一起移出视口。

**保留 brand 按钮作为 New Session。** 不采用，因为 brand 是持久的侧边栏入口，用户需要直接的收起操作；旁边独立的 New Session 控件已经明确表达会话创建。

**隐藏或折叠 utility 操作。** 不采用，因为文件管理器和编辑器操作只有在中间条带可以滚动时才能保持可用。

## Consequences

窄屏 Session header 可以展示较长的标题和 utility 内容，同时不移动右 corner 操作。桌面端和移动端的展开侧边栏共享相同的 brand 收起行为，而 New Session 保留独立的可访问名称与动作。

布局增加一个呈现 wrapper 和一个供结构测试使用的数据标记。不改变 session event、持久化字段或面向模型的输入。

## Testing

`ui-conversation` skeleton 测试断言 scroller 与 corner 是兄弟节点；`ui-sidebar` 测试断言 brand 调用 `toggleSidebar`、把焦点恢复到 rail toggle，且独立的 New Session 调用 `startSession`。变更面 suites、client typecheck、完整 build 与文档 gates 均通过。用户已在经过鉴权的 DSH Web GUI 中验证桌面端和移动端行为。
