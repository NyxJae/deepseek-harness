# Typert Remote quick reference

只在外置 Host/Client Remote、`ctx.remote.$mount()` 或 Remote 调用失败时读取本页。

## 最小组合

- Host 包公开 `./typert`，并提供 `lib/index.js` 与生成的 `lib/typert.host.js`。
- Client 调用侧公开并能解析 `./remote` 的生成产物 `lib/typert.remote-client.js`；浏览器仍需构建 `./client` 的 `lib/client.js`。
- profile 同时加载 Host row；`dsh.client` row 由 Client modules 扫描。
- generated Remote artifacts 由 Typert generator/tsdown 生成，不手写或手改 descriptor、Zod codec 或 declaration merge。

## 自挂载 Client Remote

```ts
export const inject = ['slots', 'remote']

export function apply(ctx: ClientContext): void {
  const mounted = ctx.remote.$mount(contribution)
  const call = async (request: Request) => {
    await mounted
    const remote = ctx.get('remote.myNamespace') as MyRemote | undefined
    if (remote === undefined) throw new Error('Remote namespace was not mounted')
    return remote.run(request)
  }
}
```

不要把 `remote.myNamespace` 加进同一个插件的 `inject`；该 namespace 由当前 `apply()` 创建，会形成自依赖。不要在 mount 前读取 `ctx.remote.myNamespace`；属性代理会按注入声明拒绝访问。可选或动态服务在使用点通过 `ctx.get()` 读取。

## 调用排查

- 先检查 `dsh --profile <name> --dump-config`、`./typert`/`./remote` import、Client bundle URL 和实际 boot manifest。
- 用生成 descriptor 的参数名构造 wire payload；Client 的业务参数会被包在 descriptor 的 `wire` 字段下，不能凭 endpoint 名称猜字段。
- 区分三类失败：Remote assembly/mount、carrier transport、Host method result。Client 保留错误码；Host 记录 logger；再决定是否查 Host terminal、浏览器 console 或 `/api/<namespace>/<method>` 响应。
