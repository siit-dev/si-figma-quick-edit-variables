# SmartImpact Figma Quick Edit Variables

A Figma Design plugin for safely editing existing variable bindings, comparing
instances with their current variants, and generating CSS from visual changes.

## Features

- Scan selected layers and descendants for existing variable bindings.
- Inspect source variables, collections, effective modes, and resolved values.
- Edit a source value for a selected mode without removing the node binding.
- Assign an existing compatible local variable as an alias.
- Exclude selected collections and slash-delimited variable groups from pickers.
- Compare instances with their exact current variants across visible styling and layout.
- Resolve variable aliases into readable values and token provenance.
- Generate copyable CSS for matching changed layers.
- Use persistent, resizable plugin and CSS-panel layouts in light or dark Figma themes.

## Download Without Building

For manual installation without Node.js or build tools:

1. Download `smartimpact-figma-quick-edit-variables-v1.0.0.zip` from
   [GitHub Releases](https://github.com/siit-dev/si-figma-quick-edit-variables/releases).
2. Unzip it locally.
3. In Figma Desktop, open a design file.
4. Select **Plugins → Development → Import plugin from manifest**.
5. Choose the unzipped `manifest.json`.
6. Run **SmartImpact Figma Quick Edit Variables** from the development plugins menu.

The public Figma Community listing remains the recommended install path once
the plugin is approved.

## Install For Development

Requirements:

- Node.js 20.19+, 22.12+, or newer.
- Figma desktop or web with permission to run development plugins.

```powershell
npm install
npm run typecheck
npm test
npm run build
npm run package:plugin
```

Then open Figma and select:

1. **Plugins → Development → Import plugin from manifest**
2. This repository's `manifest.json`
3. **SmartImpact Figma Quick Edit Variables** from the development plugins menu

Rebuild with `npm run build` after source changes.

## Usage

### Variables

1. Select one or more layers.
2. Open the plugin's **Variables** tab.
3. Choose an existing bound property.
4. Select the target mode.
5. Enter a source value or choose a compatible local variable alias.
6. Review the global impact notice and apply the change.

Source edits affect every consumer of that variable and mode.

### Instance Diff

1. Select an instance or a frame containing instances.
2. Open **Instance Diff**.
3. Search or filter visible appearance, typography, spacing, geometry, visibility,
   and structural changes.
4. Use **Locate** to navigate to an affected layer.
5. Expand the CSS panel to select a scope and copy generated current-instance styles.

Instance Diff and CSS generation are read-only.

## Safety And Privacy

- Existing variable bindings are never intentionally removed.
- Mutations require explicit confirmation and stale-state validation.
- The plugin has no network access, analytics, telemetry, advertising, or external storage.
- Shared exclusion settings remain in Figma document plugin data.
- Personal UI preferences remain in Figma `clientStorage`.
- Clipboard access occurs only after the user activates **Copy**.

See the [privacy policy](PRIVACY.md) for details.

## Support

- [Report a bug or request help](https://github.com/siit-dev/si-figma-quick-edit-variables/issues)
- [Ask a non-sensitive privacy question](https://github.com/siit-dev/si-figma-quick-edit-variables/issues/new?template=privacy_question.yml)
- [Report a security vulnerability privately](https://github.com/siit-dev/si-figma-quick-edit-variables/security/advisories/new)

Do not include confidential Figma files, credentials, access tokens, personal data,
or customer information in public issues.

## License

[MIT](LICENSE) © 2026 Smart Impact
