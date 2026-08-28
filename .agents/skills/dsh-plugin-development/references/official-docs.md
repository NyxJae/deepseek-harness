# Official DSH plugin-development references

These references are the source of truth for the workflow in the parent skill. Read the relevant page before implementing a version-sensitive feature.

## Local repository sources

- [`docs/architecture.md`](file:///C:/Users/HJ/.dsh/plugins/deepseek-harness/docs/architecture.md) — profiles, bundles, patch layers, extension points, system-prompt sections, `agent.inject()`, and model-visible logging.
- [`docs/cookbook/adding-a-package.md`](file:///C:/Users/HJ/.dsh/plugins/deepseek-harness/docs/cookbook/adding-a-package.md) — package layout, package manifests, aggregate registration, README and verification requirements.
- [`docs/cookbook/extension-cookbook.md`](file:///C:/Users/HJ/.dsh/plugins/deepseek-harness/docs/cookbook/extension-cookbook.md) — extension-point selection and the feature-to-mechanism map.
- [`docs/cordis-primer.md`](file:///C:/Users/HJ/.dsh/plugins/deepseek-harness/docs/cordis-primer.md) — plugin forms, service dependencies, events, loader expressions, and reversible registrations.
- [`docs/cordis-tutorial/01-first-plugin.md`](file:///C:/Users/HJ/.dsh/plugins/deepseek-harness/docs/cordis-tutorial/01-first-plugin.md) — minimal function plugin and local composition.
- [`docs/cordis-tutorial/02-lifecycle-and-effects.md`](file:///C:/Users/HJ/.dsh/plugins/deepseek-harness/docs/cordis-tutorial/02-lifecycle-and-effects.md) — effects, disposal, fiber lifecycle, and external watcher cleanup.
- [`docs/cordis-tutorial/03-services.md`](file:///C:/Users/HJ/.dsh/plugins/deepseek-harness/docs/cordis-tutorial/03-services.md) — service providers, `inject`, PENDING state, and dependency replacement.
- [`docs/cordis-tutorial/04-events.md`](file:///C:/Users/HJ/.dsh/plugins/deepseek-harness/docs/cordis-tutorial/04-events.md) — declaration merging, dispatch modes, and event listener disposal.
- [`docs/cordis-tutorial/05-config.md`](file:///C:/Users/HJ/.dsh/plugins/deepseek-harness/docs/cordis-tutorial/05-config.md) — Schemastery configuration and load-time validation.
- [`docs/cordis-tutorial/06-composition-and-hmr.md`](file:///C:/Users/HJ/.dsh/plugins/deepseek-harness/docs/cordis-tutorial/06-composition-and-hmr.md) — HMR unload/reload behavior and loader diagnostics.
- [`docs/cordis-tutorial/07-into-the-harness.md`](file:///C:/Users/HJ/.dsh/plugins/deepseek-harness/docs/cordis-tutorial/07-into-the-harness.md) — real harness services and assembled plugin composition.
- [`packages/client/AGENTS.md`](file:///C:/Users/HJ/.dsh/plugins/deepseek-harness/packages/client/AGENTS.md) — browser plugin manifests, client build, slots, layering, and GUI testing.

## Official website projections

- [Your first plugin](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/)
- [Package and install a plugin](https://deepseek-harness.github.io/deepseek-harness/en/develop/basic/publish)
- [DeepSeek Harness architecture](https://deepseek-harness.github.io/deepseek-harness/en/reference/)

## Stable official rules extracted from these pages

- A function plugin exports `apply`; named `name`, `inject`, and `Config` provide diagnostics, service dependencies, and configuration validation.
- `inject` expresses service availability, not YAML ordering. A missing required service leaves the fiber PENDING; a provider replacement unloads and reloads dependents.
- `ctx.on()`, registry registrations, and prompt sections are lifecycle-owned effects. External timers, watchers, processes, and connections require an effect that returns a disposer and awaits quiescence.
- `system-prompt/assemble` is an authoritative whole-assembly waterfall. A section provider is the normal route for durable system prompt content; `agent.inject()` is the route for durable, temporary model-facing context and file-change notices.
- `dsh.bundle` declares an installable configuration layer; `dsh.profile` declares the ordered bundles in a runnable profile. A package without `dsh.bundle` can be a plain dependency but does not add a profile layer.
- Server HMR unloads a fiber and re-runs `apply`; browser HMR requires the Web client build watcher and `client-hmr`. All resources must therefore have correct disposal.
