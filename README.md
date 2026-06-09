# SmartImpact Figma Quick Edit Variables

A Figma Design plugin for safely editing existing variable bindings and auditing instance overrides.

## Features

- Scan selected layers and descendants for existing variable bindings.
- Inspect source variables, collections, effective modes, and resolved values.
- Edit source values or assign compatible local aliases without removing bindings.
- Share collection and slash-group picker exclusions through the Figma document.
- Audit selected instances and nested instances against their current main components.
- Use persistent, resizable plugin layouts in light or dark Figma themes.

## Development

Requirements:

- Node.js 20.19+, 22.12+, or newer.
- Figma desktop or web with permission to run development plugins.

```powershell
npm install
npm run typecheck
npm test
npm run build
```

Import `manifest.json` through **Plugins → Development → Import plugin from manifest**.

## Safety

- Existing variable bindings are never intentionally removed.
- Source edits affect every consumer of the selected variable and mode.
- Mutations require explicit confirmation and stale-state validation.
- Instance Diff is read-only.
