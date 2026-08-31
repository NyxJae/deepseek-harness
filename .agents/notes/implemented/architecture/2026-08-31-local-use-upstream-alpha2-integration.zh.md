# Agent Note: 基于 upstream alpha.2 的 local-use 选择性整合

Status: implemented

[English](2026-08-31-local-use-upstream-alpha2-integration.md) | 中文

## Problem

local-use 分支包含有价值的响应式 UI 与本地 Markdown 图片行为，但它的两个提交基于 alpha.2 之前的共同祖先。直接完整应用这些提交会把已被替代的 Remote 失败类型、过时的 Session Controller 接口、已移除的 preset 组件以及 alpha.2 之前的设置所有权重新带入官方架构。

## Decision

整合分支以官方 `upstream/master` 的 `dsh-v0.1.2-alpha.2` 为基线，按能力移植 local-use 行为，而不按提交祖先整体合并。alpha.2 的 Session Controller、Typert 协议、preset roster、设置 DOM、生成产物和包版本保持权威。

响应式 Web 改动扩展 alpha.2 的 AppFrame、sidebar、menu、model-selection、settings、language、appearance、agent-preset 与 conversation 样式，不重建已移除的组件，也不把业务状态移入呈现组件。移动端 drawer 与 menu 保留焦点所有权、Escape 处理、安全区间距，以及官方分开的 New Session 与折叠操作。客户端组装遵循[动态客户端呈现与附件所有权](2026-08-17-dynamic-client-render-and-attachment-ownership.zh.md)。

图片呈现改动继续把附件所有权放在现有 conversation slot 中。单张消息图片可以行内呈现，文档级灯箱负责适配、受限缩放、滚轮与指针手势、触摸捏合和拖动、键盘控制、焦点锁定、打开控件焦点恢复以及背景滚动锁定。语言包标签仍由所属字典提供。这些改动扩展[Web 多模态图片输入与耐久附件](../feature/2026-07-22-web-multimodal-image-input-and-durable-attachments.zh.md)中的耐久附件行为，不改变其消息内容规则。

本地 Markdown 图片使用显式的 Session Controller 策略：默认 `disabled`，`workspaces` 限制在已注册 Workspace 根目录，`host` 使用活动文件系统提供方支持且可读取的图片范围。Host 先证明请求的消息、文本块和 Markdown 调用实例存在，再通过 `ctx.fs` 读取并规范化文件，经附件服务接纳后追加 `assistant/markdown-image` 映射事件。映射只写入日志，不改变模型可见的 Assistant 文本或 token 计量。Client Chat state 折叠该事件，已完成的调用实例通过认证附件路径解析，disabled 目标保持作者写入的 alt 文本且不发起 Remote 请求，启用模式下被拒绝或失败的调用实例保留可重试状态。这是对[远程 Markdown 图片策略](../feature/2026-07-30-web-remote-markdown-images.zh.md)的本地文件扩展；绝对 HTTP(S) 目标仍由后者负责。

resolver 与其 Client 方法使用 alpha.2 的 `RemoteError` 和 `RemoteResult` 语义。幂等性、single-flight 解析、取消、销毁、Workspace 包含关系、媒体与大小检查，以及把映射连接到较早 Assistant Markdown 调用实例的关系不变量，都由 Session Controller 拥有。Persistence、Cordis、Client 与文档目录由各自源码所有者重新生成。

## Alternatives considered

**直接合并 local-use 提交。** 这会保留祖先关系，却同时恢复 alpha.2 之前的接口与已移除架构，迫使每个受影响的包边界加入兼容层。

**把官方 API 降级到 local 分支的失败与 Session 类型。** 这可以让单个功能编译，却会偏离上游 wire 协议和所有生成的 Remote consumer。

**只解析瞬时的浏览器本地图片 URL。** 这可以避免耐久事件，但回放会依赖源文件，也会绕过现有的认证附件路径。

**把本地图片字节或源路径写入 Assistant 消息文本。** 这会改变模型可见内容或持久化消息内容，破坏 Assistant 文本与仅用于呈现的附件映射之间的分离；耐久消息内容规则仍由[Web 多模态图片输入与耐久附件](../feature/2026-07-22-web-multimodal-image-input-and-durable-attachments.zh.md)负责。

**重建已移除的 alpha.2 UI 组件以适配旧的 local 样式。** 这会重复官方所有权，并让后续 preset 或 settings 变更面对两套相互竞争的组件接口。

## Consequences

这次整合保留官方 alpha.2 架构，并把本地行为限制在明确的扩展点中。新的映射事件是耐久且需要生成的协议表面，因此 Session event vocabulary、Remote 声明、面向 SDK 的投影、不变量、测试、目录和文档必须持续同步。

本地 Markdown 解析默认关闭，已经接纳的附件不因源文件删除而失效。若附件发布后、映射事件写入前进程失败，未被引用的对象可能会保留到具备引用感知的回收机制实现为止。`host` 策略有意授予活动文件系统提供方可读取图片的范围；`workspaces` 是更窄的选项。

Host、Client、attachment、Markdown、Chat 与 conversation 的聚焦测试覆盖了变更路径。整合目前尚未提交，不改变 `master`、`upstream/master` 或受保护的源 checkout evaluation 文件。
