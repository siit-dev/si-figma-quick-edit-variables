# Privacy Policy

Last updated: June 12, 2026

SmartImpact Figma Quick Edit Variables is developed and maintained by Smart Impact.

## Data Processing

The plugin processes the current Figma selection, local variables, variable bindings, component and instance properties, and related document metadata only to provide its variable-editing and visual-diff features.

Processing occurs within the Figma plugin runtime. The plugin does not transmit file content, user information, generated CSS, or usage information to Smart Impact or any third party.

## Network And Analytics

The plugin declares no network access in its Figma manifest. It does not use analytics, telemetry, advertising, tracking pixels, or external error-reporting services.

## Storage

The plugin stores:

- Shared collection and variable-group exclusion settings in Figma document plugin data.
- Window size, selected tab, and CSS panel preferences in Figma `clientStorage` for the current user.

The plugin does not operate an external database or cloud storage service.

## Clipboard

Generated CSS is written to the system clipboard only after the user activates the Copy control. Clipboard content is not transmitted or retained by Smart Impact.

## Data Changes

Variable source edits are performed only after explicit user confirmation. Instance Diff and CSS generation are read-only. The plugin does not remove existing variable bindings.

## Contact

Questions about privacy or data handling can be submitted through the
[GitHub privacy-question form](https://github.com/siit-dev/si-figma-quick-edit-variables/issues/new?template=privacy_question.yml).

Technical problems should use the plugin's
[GitHub Issues](https://github.com/siit-dev/si-figma-quick-edit-variables/issues).

Do not include personal data, confidential files, credentials, or customer information in a public issue. Security-sensitive reports must use
[GitHub private vulnerability reporting](https://github.com/siit-dev/si-figma-quick-edit-variables/security/advisories/new).
