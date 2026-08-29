# Agent Note: 认证 Web 聊天中的本地 Markdown 图片

Status: implemented

[English](2026-08-29-web-local-markdown-images.md) | 中文

## 问题

assistant 可以使用普通 Markdown 图片语法引用 DSH Host 上的截图、图表或其他图片，但通过回环地址或 `dsh.nyxjae.xyz` 连接的浏览器不能通过 `file:` URL、操作系统绝对路径或相对路径读取 Host 文件。

现有耐久附件链路会通过认证 Session API 传输已接纳的字节，并在浏览器中渲染 Blob URL。本地 Markdown 图片需要使用同一耐久表示；现有图片查看器也需要为大型截图和图表提供检查控件。

## 决定

已完成的 Assistant Markdown 本地图片调用实例进入一个可选的 Host 解析器。解析器校验目标 Session 消息，通过 Host 文件系统提供方读取获准的本地目标，经附件服务保存规范化字节，并追加仅日志的 `assistant/markdown-image` 映射。Chat 在不改变发送给提供方的 assistant 文本的前提下，把匹配的 AST 调用实例替换为现有耐久消息图片呈现。

解析器接受标准 Markdown 中的 PNG、JPEG、WebP 和 GIF 目标，处理 `file:` URL、绝对路径以及相对于 Session `cwd` 的路径。远程 HTTP(S) 图片继续由浏览器直接加载。原始 HTML、`data:` URL、不支持的协议和非图片文件不使用此解析器。流式 Markdown 在 assistant 消息完成前把本地目标保留为不会发起请求的回退文本。

### 授权与路径策略

`api-session-controller` 提供 `localMarkdownImages.mode`，默认值为 `disabled`。`disabled` 不执行本地图片工作，`workspaces` 要求提供方确认目标位于已注册 Workspace 根目录内，`host` 则允许活动文件系统提供方能够读取的任意普通受支持图片。用户 Web profile 选择 `host`；Web 进程继续绑定 `127.0.0.1`，并把 `dsh.nyxjae.xyz` 作为唯一非回环 authority。

Host 使用 `ctx.fs.resolve`、`stat`、`contains` 和有界 `readBytes`。它不会解析不透明的 `FsTarget.targetKey`，也不会暴露公开文件系统路由或操作系统文件句柄。现有 Host、Origin、Fetch-Metadata 和绑定 authority 的浏览器认证检查继续保护 `/api` 与 WebSocket 访问。

```yaml
localMarkdownImages:
  mode: host
```

### 耐久解析与回放

每个调用实例由 `sessionId`、assistant `messageId`、文本块索引、图片序号和作者写下的目标寻址。Host 使用 GFM 与 math 扩展重新解析记录中的 assistant 文本，按文档顺序处理图片并对引用定义采用首次定义优先；目标不匹配时在文件系统访问前拒绝。Client behavior method 在调用生成的 `session.resolveMarkdownImage` Remote 代码前补上自身 Session 身份。

Host 先保存图片，再追加包含映射的事件。事件专用附件授权分支只检查 `assistant/markdown-image` 的 `data.attachment`，因此 `session.attachment` 可以读取已映射引用，而不会因其他事件字段获得权限。映射不会进入提供方请求、token 计量、压缩输入或 KV Cache 身份。

解析按调用实例实现幂等与 single-flight。同进程追加失败时保留已保存引用，重试无需重新读取源文件。销毁会拒绝新工作并等待活动接纳完成。内容寻址对象已经发布但事件尚未持久化时进程崩溃，可能留下没有引用的去重对象；引用感知的垃圾回收仍延期实现。

### Chat 渲染

`ui-chat` 把映射事件折叠进 Assistant state，并向 `ui-primitives` 提供只在完成态启用的 Markdown 图片解析器。解析器只替换匹配的 AST 图片节点，周围 Markdown 仍在同一次渲染中处理，随后沿用现有的 `HistoricalImageCache` 到 `session.attachment` Blob URL 链路。因此刷新、重连、切换 Session 和历史回放都会使用已存储字节，即使源文件后来被修改或删除。

文件缺失、路径拒绝、不支持的图片或接纳失败只影响对应调用实例。Chat 显示本地化加载状态或可重试的失败控件，成功的同级图片继续可见。流式阶段不会请求本地文件。

### 图片查看器

`ui-attachment` 升级现有 `ImageLightbox`，因此结构化附件和本地 Markdown 图片共享一个查看器。通过 body portal 打开的查看器提供放大、缩小、适配／重置、关闭、以指针为中心的滚轮缩放、有界抓手平移、触摸捏合和单指平移、双击缩放、`+`、`-`、`0`、Escape、焦点陷阱、打开控件焦点恢复、背景滚动锁、尺寸变化处理、安全区域位置以及本地化可访问标签。

查看器负责 pointer capture、瞬态手势状态和清理。每次缩放与平移都会限制在视口范围内，打开新图片时从适配比例开始。查看器接收既有 Blob 或预览 URL，不新增 URL 所有者，也不引入公开图床。

### 包归属与部署

行为位于三个 Cordis 插件以及一个 Cordis-free Markdown 回调中：

| 归属方 | 职责 |
|---|---|
| `@deepseek-ai/dsh-api-session-controller` | 配置、文件系统策略、耐久接纳、映射事件、附件授权、不变式和 Host Remote 方法。 |
| `@deepseek-ai/dsh-client-ui-chat` | 调用实例分类、Session 作用域恢复、Assistant 映射投影、加载／错误状态和 Chat 渲染。 |
| `@deepseek-ai/dsh-client-ui-attachment` | 共享缩放平移查看器、控件、手势、焦点生命周期、安全区域样式和组件呈现。 |
| `@deepseek-ai/dsh-client-ui-primitives` | 只在完成态使用的 AST 图片替换回调，不依赖 Cordis 或 Session。 |

Web bundle 默认保持本地图片模式禁用。用户 profile 启用 `host` 并配置唯一公开 authority；反向代理必须为页面、`/api` 和 WebSocket 请求保留该 Host。`agent-loop`、`client-connection` 和公开 API 信任模型均不改变。

### 测试

聚焦 Host、Client 和组件套件覆盖解析顺序、引用图片、本地路径策略、耐久映射、授权、不变式拒绝、重试、并发、流式回退、Chat 投影、查看器键盘／焦点行为、滚轮缩放、指针拖动、触摸捏合、尺寸变化和清理。最终功能回归运行通过 35 个测试文件和 380 个测试。

`build:lib`、`build:web`、`test:docs`、变更目录 Oxlint、相关 face-specific typecheck、`git diff --check` 和 Web profile 组合 dump 均通过。本次没有重启受保护的 Web 进程，因此认证回环渲染、公开 authority 渲染、删除源文件后的回放以及桌面／移动截图证据仍需用户重启后的手动验证。

## 考虑过的替代方案

**让浏览器直接加载 `file:` URL。** 远程浏览器会根据自身机器和安全策略解析该 URL，无法通过 VPS 传输 DSH Host 字节。

**公开 Host 文件系统路由或使用图床。** 第二条路由会重复路径授权与生命周期规则，图床会增加网络发布、凭据和清理。耐久 Session 附件可以复用现有校验、授权、回放和 Blob URL 处理。

**信任所有非回环 authority 或移除 `/api` 信任检查。** Session 操作可以执行工具，因此向任意 authority 授权会扩大敏感传输范围。精确的 `dsh.nyxjae.xyz` 信任保留现有部署规则。

**每次渲染都读取源路径。** 文件被覆盖时历史会变化，被删除时历史会失效。耐久附件引用把第一次成功读取固定为稳定的回放快照。

**改写 assistant 消息或修改 `agent-loop`。** 把 Markdown 替换为 `ImageBlock` 会改变模型可见内容并扩大核心循环改动。仅日志映射可以保持提供方输出不变。

**把部署限制在已注册 Workspace。** 这是更窄的受支持模式，但本部署的目标是发送任意可读取本地图片，因此需要 `host`。较宽的授权通过配置显式记录。

## 后果

认证 Web Chat 可以在没有公开文件路由或图床的情况下显示受支持的本地 Markdown 图片；源文件修改或删除后，后续客户端仍可回放已存储图片。映射只以仅日志事件存在，不改变模型输入。

`host` 模式允许已认证 Web 主体把任意可读取的受支持图片复制进 Session，因此不接受该权限的 profile 应保持禁用。附件校验继续限制字节、尺寸、像素和媒体类型；规范化可能改变查看器显示的存储 master。

失败或因崩溃丢失的映射追加可能留下没有引用的去重对象。同进程重试会复用对象，引用感知垃圾回收延期实现。大型图片会消耗浏览器解码内存，共享查看器限制变换状态，并由既有 Session 或草稿所有者负责 URL 生命周期。
