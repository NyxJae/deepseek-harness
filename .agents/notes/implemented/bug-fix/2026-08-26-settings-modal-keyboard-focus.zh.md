# Agent Note: Settings modal keyboard focus ownership

Status: implemented

[English](2026-08-26-settings-modal-keyboard-focus.md) | 中文

## Problem

设置对话框声明了 `aria-modal="true"`，但焦点仍可能停留在会话区，或移动到对话框外的控件。设置选择器打开时不会把焦点移到选项上，键盘用户无法稳定地用方向键查看和选择设置。

## Decision

`SettingsRoot` 保留设置触发按钮的 ref，并在面板通过任一路径关闭后把焦点恢复到触发按钮。`SettingsPanel` 挂载时聚焦关闭控件，在可见的对话框控件内限制 Tab 和 Shift+Tab，并在捕获阶段处理 Escape，使嵌套菜单或对话框优先负责自身关闭。父级处理器会跳过嵌套菜单和对话框中的目标。

共享的 `Menu` primitive 会记录打开者，打开时聚焦已选或第一个启用的菜单项，并在菜单内支持 ArrowUp、ArrowDown、Home 和 End，同时跳过禁用项。Escape 和 Tab 会关闭菜单并把焦点恢复到打开者；原生按钮激活仍然负责执行选择。

## Alternatives considered

**把焦点行为交给浏览器的文档顺序。** 否决，因为声明了 `aria-modal` 的对话框必须把键盘交互限制在当前任务内，并在关闭后把用户带回打开者。

**在每个设置选择器中分别增加键盘处理器。** 否决，因为所有选择器都使用共享的 `Menu` primitive，否则焦点、导航和恢复规则会重复实现。

**引入新的焦点管理依赖。** 否决，因为现有 React 和 DOM primitive 足以覆盖这个范围有限的对话框和菜单行为，不需要增加运行时依赖。

## Consequences

设置保留现有 slot 契约和覆盖层结构，同时让键盘焦点跟随当前的模态层。Menu 使用者在设置页和其他选择器中获得一致的键盘路径。嵌套菜单或对话框必须先停止自身的 Escape 事件，父级覆盖层才不会响应；在这些 role 之外自定义覆盖层的调用方需要提供等价的焦点所有权。
