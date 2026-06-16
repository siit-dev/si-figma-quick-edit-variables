# Release Process

## GitHub ZIP Release

1. Update `package.json` to the next version, for example `1.0.1`.
2. Run the local checks:

   ```powershell
   npm ci
   npm run typecheck
   npm test
   npm run release:check
   npm run package:plugin
   ```

3. Commit and push the versioned change to `main`.
4. Create and push a matching tag:

   ```powershell
   git tag v1.0.1
   git push origin v1.0.1
   ```

5. GitHub Actions will build and upload
   `smartimpact-figma-quick-edit-variables-v1.0.1.zip` to the GitHub release.

The release workflow fails if the pushed tag does not match `package.json`.

## Figma Plugin Update

Figma Community updates are still manual:

1. Open Figma Desktop.
2. Open any design file.
3. Go to **Plugins → Manage plugins**.
4. Open **SmartImpact Figma Quick Edit Variables**.
5. Choose **Publish new version**.
6. If Figma cannot find the local version, choose **Locate local version** and select this repository's `manifest.json`.
7. Add release notes and submit.

Keep the permanent plugin ID unchanged:

```json
"id": "1648612556886294378"
```
