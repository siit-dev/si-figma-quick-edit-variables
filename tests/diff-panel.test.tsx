import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/ui/App'
import { DiffPanel } from '../src/ui/components/DiffPanel'
import type { DiffScanPayload, ScanPayload } from '../src/shared/types'
import { DEFAULT_DIFF_CODE_PREFERENCES } from '../src/shared/diff-code-preferences'

const diffPayload: DiffScanPayload = {
  roots: [{ id: 'root', name: 'Audit fixture' }],
  discoveredInstanceCount: 1,
  unchangedInstanceCount: 0,
  scannedAt: 1,
  instances: [
    {
      instanceId: 'instance',
      instanceName: 'State=Default',
      instancePath: ['Audit fixture', 'State=Default'],
      mainComponentId: 'main',
      mainComponentName: 'State=Default',
      mainComponentRemote: false,
      differenceCount: 2,
      layers: [
        {
          nodeId: 'badge',
          nodeName: 'Status badge',
          nodeType: 'RECTANGLE',
          nodePath: ['State=Default', 'Status badge'],
          currentProperties: [
            {
              field: 'fills',
              label: 'Fill',
              category: 'appearance',
              value: {
                preview: '#FF5533',
                detail: JSON.stringify([
                  { type: 'SOLID', color: { r: 1, g: 0.333, b: 0.2 } },
                ]),
                kind: 'complex',
              },
            },
            {
              field: 'paddingLeft',
              label: 'Padding left',
              category: 'spacing',
              value: { preview: '24 px', detail: '24', kind: 'scalar' },
            },
          ],
          differences: [
            {
              id: 'fill',
              affectedNodeId: 'badge',
              affectedNodeName: 'Status badge',
              affectedNodeType: 'RECTANGLE',
              nodePath: ['State=Default', 'Status badge'],
              field: 'fills',
              label: 'Fill',
              category: 'appearance',
              original: {
                preview: '#1677FF',
                detail: '{}',
                kind: 'complex',
                tokens: [
                  {
                    variableId: 'primary',
                    variableName: 'color/primary',
                    collectionId: 'semantic',
                    collectionName: 'Semantic',
                    modeId: 'light',
                    modeName: 'Light',
                    resolvedType: 'COLOR',
                    resolvedPreview: '#1677FF',
                    status: 'resolved',
                    aliasChain: [
                      {
                        variableId: 'primary',
                        variableName: 'color/primary',
                        collectionId: 'semantic',
                        collectionName: 'Semantic',
                        modeId: 'light',
                        modeName: 'Light',
                      },
                    ],
                  },
                ],
              },
              current: { preview: '#FF5533', detail: '{}', kind: 'complex' },
            },
            {
              id: 'padding',
              affectedNodeId: 'badge',
              affectedNodeName: 'Status badge',
              affectedNodeType: 'RECTANGLE',
              nodePath: ['State=Default', 'Status badge'],
              field: 'paddingLeft',
              label: 'Padding left',
              category: 'spacing',
              original: { preview: '16 px', detail: '16', kind: 'scalar' },
              current: { preview: '24 px', detail: '24', kind: 'scalar' },
            },
          ],
        },
      ],
    },
  ],
}

const scanPayload: ScanPayload = {
  roots: [],
  occurrences: [],
  variables: [],
  collections: [],
  settings: { version: 1, excludedCollectionIds: [], excludedGroups: [] },
  settingsTree: [],
  scannedAt: 1,
}

describe('Instance Diff UI', () => {
  let postMessage: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    postMessage = vi.spyOn(parent, 'postMessage').mockImplementation(() => undefined)
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('filters visual properties and shows resolved token names', () => {
    render(
      <DiffPanel
        payload={diffPayload}
        preferences={DEFAULT_DIFF_CODE_PREFERENCES}
        onPreferences={vi.fn()}
      />,
    )
    expect(screen.getAllByText('Semantic / color/primary')).not.toHaveLength(0)

    fireEvent.change(screen.getByPlaceholderText('Search instances, layers, or fields'), {
      target: { value: 'padding' },
    })
    expect(screen.getByText('Padding left')).toBeInTheDocument()
    expect(screen.queryByText('Fill')).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search instances, layers, or fields'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Typography' }))
    expect(screen.getByText('No differences match.')).toBeInTheDocument()
  })

  it('navigates to the affected layer', () => {
    render(
      <DiffPanel
        payload={diffPayload}
        preferences={DEFAULT_DIFF_CODE_PREFERENCES}
        onPreferences={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByText('Locate')[0]!)
    expect(postMessage).toHaveBeenLastCalledWith(
      { pluginMessage: { type: 'NAVIGATE_DIFF', nodeId: 'badge' } },
      '*',
    )
  })

  it('copies generated CSS and updates code-panel preferences', async () => {
    const writeText = vi.fn(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const onPreferences = vi.fn()
    render(
      <DiffPanel
        payload={diffPayload}
        preferences={DEFAULT_DIFF_CODE_PREFERENCES}
        onPreferences={onPreferences}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining('.status-badge {'),
    ))
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('CSS scope'), {
      target: { value: 'full-layers' },
    })
    expect(onPreferences).toHaveBeenCalledWith({
      ...DEFAULT_DIFF_CODE_PREFERENCES,
      scope: 'full-layers',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Collapse CSS panel' }))
    expect(onPreferences).toHaveBeenCalledWith({
      ...DEFAULT_DIFF_CODE_PREFERENCES,
      collapsed: true,
    })
  })

  it('requests a current-selection refresh from the remembered Diff tab', async () => {
    render(<App />)
    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          pluginMessage: {
            type: 'BOOTSTRAP',
            payload: scanPayload,
            diffPayload,
            activeTab: 'diff',
            windowSize: { width: 500, height: 700 },
            diffCodePreferences: DEFAULT_DIFF_CODE_PREFERENCES,
          },
        },
      }),
    )

    await screen.findByRole('button', { name: 'Instance Diff' })
    fireEvent.click(screen.getByTitle('Refresh selection'))

    await waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        {
          pluginMessage: {
            type: 'REQUEST_DIFF_SCAN',
            useCurrentSelection: true,
          },
        },
        '*',
      ),
    )
  })
})
