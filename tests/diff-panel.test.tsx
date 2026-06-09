import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/ui/App'
import { DiffPanel } from '../src/ui/components/DiffPanel'
import type { DiffScanPayload, ScanPayload } from '../src/shared/types'

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
      componentProperties: [
        {
          id: 'property',
          propertyKey: 'Label#1:2',
          propertyName: 'Label',
          propertyType: 'TEXT',
          original: { preview: 'Action', detail: '"Action"', kind: 'scalar' },
          current: { preview: 'Changed action', detail: '"Changed action"', kind: 'scalar' },
        },
      ],
      layers: [
        {
          nodeId: 'text',
          nodeName: 'Subtitle',
          nodeType: 'TEXT',
          nodePath: ['State=Default', 'Subtitle'],
          differences: [
            {
              id: 'characters',
              affectedNodeId: 'text',
              affectedNodeName: 'Subtitle',
              affectedNodeType: 'TEXT',
              nodePath: ['State=Default', 'Subtitle'],
              field: 'characters',
              label: 'Characters',
              category: 'content',
              original: { preview: 'Original', detail: '"Original"', kind: 'scalar' },
              current: { preview: 'Changed', detail: '"Changed"', kind: 'scalar' },
              mapping: 'exact',
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

  it('filters by search and category and navigates to affected layers', () => {
    render(<DiffPanel payload={diffPayload} />)

    fireEvent.change(screen.getByPlaceholderText('Search instances, layers, or fields'), {
      target: { value: 'subtitle' },
    })
    expect(screen.getByText('Characters')).toBeInTheDocument()
    expect(screen.queryByText('Label')).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText('Search instances, layers, or fields'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    expect(screen.getByText('No differences match.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    fireEvent.click(screen.getAllByText('Locate')[1]!)
    expect(postMessage).toHaveBeenLastCalledWith(
      { pluginMessage: { type: 'NAVIGATE_DIFF', nodeId: 'text' } },
      '*',
    )
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
