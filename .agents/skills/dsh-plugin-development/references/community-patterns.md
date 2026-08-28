# Community patterns and review boundaries

Community material is useful for discovering recurring plugin forms, but it is not an authority for runtime APIs, security, or compatibility. Check every claim against the current DSH checkout, installed declarations, `--dump-config`, and a real Loader boot.

## Sources reviewed

- [w2112515/dsh-plugin-development](https://github.com/w2112515/dsh-plugin-development) — portable skill covering Host, Client, dual-half plugins, local links, bundles, and diagnostics. It explicitly labels itself unofficial and beta.
- [RayYeung1989/dsh-plugin-development](https://github.com/RayYeung1989/dsh-plugin-development) — Chinese/English skill with references and server/client/dual-half templates; useful for workflow structure, not a substitute for current types.
- [awesome-dsh-plugin/awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) — community catalog of DSH plugins and ecosystem categories. A listing is not a safety or maintenance endorsement.
- [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market) — plugin marketplace project demonstrating profile/plugin management concepts; inspect source before installing any listed plugin.

## Reusable patterns

- Separate the Host and Client halves when their dependencies, lifecycle, or release surface differ.
- Keep the main skill or README concise and place templates, service catalogs, and troubleshooting material in references.
- Treat local development links and packaged installs differently: a linked package lets edits reach the resolved entry, while a copied `file:` install does not.
- Review third-party source, transitive dependencies, credentials, filesystem access, network access, subprocess use, profile patches, and cleanup before enabling a plugin.
- Use a curated catalog to find candidates only. Verify the exact repository, package manifest, entry point, bundle declaration, and current DSH compatibility yourself.
