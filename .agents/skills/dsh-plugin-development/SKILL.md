---
name: dsh-plugin-development
description: Use when the user asks to create, modify, package, install, review, debug, reload, or configure a DeepSeek Harness (DSH/Cordis) plugin or its composition; investigate Host/server, browser/client, dual-half plugins, forked built-in plugins, profile patches, bundles, loader resolution, PENDING fibers, dependency links, HMR, system-prompt sections, or runtime lifecycle. Trigger phrases include "DSH", "DeepSeek Harness", "Cordis plugin", "插件开发", "修改内置插件", "fork DSH", "插件不加载", "profile patch", "bundle", "dump-config", "PENDING", "HMR", "热更新", "client plugin", "server plugin", "link dependency", and "ctx.effect".
---

# DSH plugin development

Build against the current checkout and installed runtime, not remembered APIs. DSH is a Cordis plugin tree: a plugin contributes through `ctx`, declares required services with `inject`, and owns every registration and external resource through reversible effects.

## Local source planes

- Forked DSH checkout: `C:\Users\HJ\.dsh\plugins\deepseek-harness`. This checkout may be modified and committed when the requested change belongs to a built-in DSH plugin; keep the change limited to the intended built-in plugin or its required package files.
- New or profile-local plugins: `$DSH_HOME/plugins`. Compose them through the active profile instead of editing shipped source.

Keep the fork's upstream remote and commit built-in-plugin changes before validating the profile. Do not mix a forked built-in replacement with the installed implementation in one composition.

## Use this skill for

Load this skill when the request contains a DSH/Cordis plugin-development intent or one of the trigger terms in the description. It owns the implementation and verification path; read only the referenced detailed guidance needed for the current plugin kind.

- Adding a Host/server plugin, browser/client plugin, or dual-half plugin.
- Adding a local plugin to a profile or packaging an installable bundle.
- Debugging loader resolution, PENDING fibers, profile patches, dependencies, or HMR.
- Reviewing whether a plugin's registrations, cleanup, model-visible behavior, and tests match DSH contracts.

Do not use it for ordinary `SOUL.md`, `SKILL.md`, or profile-only edits unless plugin code or plugin composition is involved.

## Ground the work first

1. Determine the checkout and active profile. Run `pwd`, inspect the applicable `AGENTS.md`, and use `dsh --profile <name> --dump-config` before changing composition.
2. Read the official references listed in [references/official-docs.md](references/official-docs.md) for the requested plugin kind.
3. Inspect the installed package declarations and real composition rows when a runtime API, entry point, or version-sensitive behavior matters.
4. Classify the plugin as Host, Client, or dual-half before choosing files and registration surfaces.
5. For preset, persona, or system-prompt edits, resolve the actual selected preset path from the roster or preset API. User-owned `$DSH_HOME/.agent-presets/<id>/` copies take precedence over same-named shipped presets; verify the change in a new Session because a running Session keeps its startup composition.

## Customization and fork replacement

For new local behavior, develop under `$DSH_HOME/plugins` and compose through the active profile. For a requested change to an existing built-in plugin, modify the approved fork at `C:\Users\HJ\.dsh\plugins\deepseek-harness` and commit the fork change. When the global `dsh` CLI is linked to this checkout, its shipped bundle already resolves the built-in row from the fork; remove stale profile `link:` and replacement rows instead of mounting a second implementation. Use a profile replacement only when the active runtime is an installed package or when an external plugin intentionally replaces a shipped row. Do not modify unrelated built-in plugins, vendored sources, or the read-only upstream checkout.

Preserve the original plugin's service names, slot declarations, public client contracts, and lifecycle ownership so dependent plugins continue to resolve the same runtime surfaces. Disable the original row before enabling the fork; never mount both implementations of the same service or slot set.

Prefer a unique external package name with an id-targeted row replacement to avoid Node and Loader resolution collisions. A same-name fork is allowed only after proving that the profile-local link resolves instead of the installation copy and that exactly one implementation is active. Keep the fork's upstream remote and merge upstream updates deliberately when the base moves.

## Choose the plugin form

- **Function plugin**: export named `name`, optional `inject` and `Config`, and `apply(ctx, config)`.
- **Service plugin**: use a `Service` subclass when the plugin provides a stable service consumed by other plugins; declare the service definition and declaration merge at its owner.
- **Client plugin**: follow `packages/client/AGENTS.md`; declare `dsh.client`, expose the client entry, use the client build preset, and compose through the slot system. Do not put browser code in a Host-only package.
- **Bundle**: an installable npm package declares `dsh.bundle.patch` and ships the patch plus referenced runtime files. A profile declares `dsh.profile.bundles`; a plain dependency without `dsh.bundle` is not a composition layer.

Use `inject` for hard service dependencies. Load order in YAML is not a dependency mechanism. Optional services use `ctx.get(name)` at the use site.

For a Client plugin that mounts its own Typert Remote contribution, inject only `remote`; await `ctx.remote.$mount(...)` in `apply()`, then read `ctx.get('remote.<namespace>')` when invoking it. Do not put the self-mounted namespace in `inject` or access `ctx.remote.<namespace>` before that namespace is declared and injected; the former creates a self-dependency and the latter triggers the runtime inject guard. For Host/Client Remote work, read [references/typert-remote.md](references/typert-remote.md) before choosing the assembly and artifact path.

## Implement the lifecycle

1. Register services, sections, tools, adapters, and listeners through APIs that return disposers, or wrap external resources in `ctx.effect(() => disposer, label)`.
2. Keep watcher, timer, process, socket, and subscription setup inside one plugin-owned effect. Its disposer must stop the resource and await quiescence before unload completes.
3. Use `ctx.on()` for events; never retain listeners across plugin unload.
4. For system-prompt contributions, use `ctx.systemPrompt.section()` with an explicit stable name and order. For temporary model-facing context, use the owning agent's `agent.inject()`; it becomes a durable message in the next admitted request.
5. Treat `system-prompt/change` as the prompt-registry update signal. It causes later prompt assembly to use changed dynamic sections; it is not itself a user-role context injection.
6. Make model-visible inputs reconstructable from the session log. Add or update the owning event and projection when a new durable input is introduced.
7. When a plugin owns an interactive Agent turn, followup, Session event listener, queue, cancellation, or AgentHandle, read [references/agent-turn-lifecycle.md](references/agent-turn-lifecycle.md) before implementing timeout or teardown behavior. Keep outer waits separate from turn ownership and verify quiescence, stale-event fences, and delivery outcomes.

## Compose and install

For an out-of-tree local source plugin, prefer a profile-local `link:` dependency during development so the loader resolves the live source tree. Built-in plugins in a globally linked checkout do not need a profile link. Keep the package's `main`/`exports` pointed at the real ESM entry. Confirm the resolved path is a link or junction rather than a copied `file:` install when source HMR is required.

Use a profile patch for composition:

```yaml
- insert:
    - id: my-plugin
      name: my-plugin
```

Use an id-targeted row to enable, disable, or reconfigure an existing entry. Validate the composed tree with `dsh --profile <name> --dump-config` before booting.

For a package dependency imported by a linked source entry, verify Node resolution from the actual source entry path. A dependency present only in the profile's `node_modules` may not resolve when the linked module is imported from its source directory; declare it where the loader can resolve it, or link the required runtime dependency into the source package's dependency path.

## HMR and reload

Server-side Cordis HMR and browser client HMR are separate:

- Server HMR unloads the old fiber, unwinds effects, imports the changed module, and runs `apply()` again. Enable `@deepseek-ai/cordis-plugin-hmr` with roots covering the built-in checkout and every external source directory; `root: ['.']` usually watches only the profile base directory. Read `C:\Users\HJ\.dsh\skills\deepseek-harness\references\source-runtime.md` for the source, profile, and artifact planes.
- A globally linked `dsh` CLI loads `apps/cli/lib` and package `lib` entries. TypeScript source edits therefore need a Host build/watch process that rewrites those artifacts before HMR can reload them; direct `.mjs` external plugins can reload from a watched source root.
- Client HMR requires the Web client build watcher (`pnpm run dev:web`) to rebuild client bundles; `client-hmr` then notifies the browser. It does not discover a newly installed server plugin, and an external Client plugin needs its own build watcher or inclusion in the development build set.
- Profile and package metadata changes require the profile to be reread; restart the Web host when the reload path is uncertain.
- A model request already in flight is not rewritten. Verify changed prompt behavior at the next step or request boundary.
- Preset composition and persona edits take effect for newly created Sessions; do not treat a Web refresh as proof that an existing Session rebuilt its system prompt.

After source edits, inspect HMR logs and verify both internal and external plugin unload cleanup and re-application. A configured HMR root or `dump-config` result is not runtime evidence. If HMR is disabled or profile/package metadata changed, do not restart a protected Web or Gateway Node process without the user's explicit authorization. After an authorized restart, verify the managed job, actual PID/command line, profile, and resolved plugin path before claiming the target is updated.

## Verification gate

Run the smallest checks covering the changed surface, then an assembled smoke test:

- `dsh --profile <name> --dump-config` shows the intended row, name, id, config, and enabled state.
- The profile dependency/link and any deployment copy resolve the reviewed fork or plugin source; record the resolved path without secrets.
- A real Loader/profile boot imports the plugin and reaches ACTIVE; do not rely only on `ctx.plugin()` unit tests for product-visible behavior.
- A lifecycle test disposes the plugin fiber and observes removal of registrations and closure of watchers/resources.
- A file/resource change test proves the promised next-step behavior and failure policy.
- HMR configuration names every internal and external source root required by the runtime, and the active log proves unload/re-apply for the changed plugin.
- For Gateway/Web changes, verify the actual running process after an authorized restart or a proven HMR reload; a dump-config result alone is not runtime evidence.
- For user-visible Web resources, including path-based local images, test the same transport the user uses. If the browser shows fallback text or alt text, inspect runtime config, RPC errors, and path authorization before changing the input markup.
- When widening privileged access, keep one explicit `loopback`/`trusted-hosts` mode, test both modes, and record that `trustedHosts` is a reachability fence rather than authentication.
- Host package changes run focused tests, typecheck, build, and applicable hygiene gates; client changes follow the client testing ladder.
- Run `node --check` for plain JavaScript entries and `git diff --check` for repository changes.

Report commands actually run, runtime/profile paths, whether HMR was enabled, and any behavior that was only statically inspected.

## Boundaries

Do not copy community plugin code or treat a curated catalog as a security endorsement. Review source, dependencies, permissions, credentials, network access, and lifecycle behavior before installation. Official DSH docs and the current repository source override community examples when they differ.
