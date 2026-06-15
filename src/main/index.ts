import {
  ACTIVE_TAB_STORAGE_KEY,
  DEFAULT_WINDOW_SIZE,
  DIFF_CODE_PREFS_STORAGE_KEY,
  MAX_WINDOW_SIZE,
  MIN_WINDOW_SIZE,
  PLUGIN_NAME,
  WINDOW_SIZE_STORAGE_KEY,
} from '../shared/constants'
import type {
  AppTab,
  DiffCodePreferences,
  MainToUiMessage,
  UiToMainMessage,
  WindowSize,
} from '../shared/types'
import { normalizeDiffCodePreferences } from '../shared/diff-code-preferences'
import { applyMutation, mutationErrorPayload } from './mutations'
import { scanInstanceDiff } from './diff-scanner'
import { scanSelection } from './scanner'
import { saveSettings } from './settings-store'

let uiReady = false
let draftActive = false
let selectionChangedWhileDrafting = false
let activeTab: AppTab = 'variables'
let pinnedDiffRootIds: string[] = []
let programmaticSelectionId: string | null = null
let diffRefreshTimer: ReturnType<typeof setTimeout> | undefined
let diffCodePreferences: DiffCodePreferences

void start()

async function start(): Promise<void> {
  const windowSize = clampWindowSize(
    (await figma.clientStorage.getAsync(WINDOW_SIZE_STORAGE_KEY)) as WindowSize | undefined,
  )
  activeTab = normalizeTab(await figma.clientStorage.getAsync(ACTIVE_TAB_STORAGE_KEY))
  diffCodePreferences = normalizeDiffCodePreferences(
    await figma.clientStorage.getAsync(DIFF_CODE_PREFS_STORAGE_KEY),
  )
  pinnedDiffRootIds = figma.currentPage.selection.map((node) => node.id)
  figma.showUI(__html__, {
    width: windowSize.width,
    height: windowSize.height,
    title: PLUGIN_NAME,
    themeColors: true,
  })

  figma.ui.onmessage = (message: UiToMainMessage) => {
    void handleMessage(message, windowSize)
  }

  figma.on('selectionchange', () => {
    if (programmaticSelectionId) {
      const matchesNavigation =
        figma.currentPage.selection.length === 1 &&
        figma.currentPage.selection[0]?.id === programmaticSelectionId
      programmaticSelectionId = null
      if (matchesNavigation) return
    }
    if (draftActive) {
      selectionChangedWhileDrafting = true
      post({ type: 'SELECTION_CHANGED', hasDraft: true })
      return
    }
    pinnedDiffRootIds = figma.currentPage.selection.map((node) => node.id)
    if (activeTab === 'diff') void postDiffScan()
    else void postScan()
  })

  figma.on('documentchange', () => {
    if (!uiReady || activeTab !== 'diff') return
    if (diffRefreshTimer) clearTimeout(diffRefreshTimer)
    diffRefreshTimer = setTimeout(() => {
      void postDiffScan()
    }, 250)
  })
}

async function handleMessage(message: UiToMainMessage, initialWindowSize: WindowSize): Promise<void> {
  try {
    switch (message.type) {
      case 'READY': {
        uiReady = true
        const payload = await scanSelection()
        const diffPayload =
          activeTab === 'diff'
            ? await scanInstanceDiff(pinnedDiffRootIds)
            : undefined
        post({
          type: 'BOOTSTRAP',
          payload,
          diffPayload,
          activeTab,
          windowSize: initialWindowSize,
          diffCodePreferences,
        })
        break
      }
      case 'RESCAN': {
        selectionChangedWhileDrafting = false
        draftActive = false
        if (activeTab === 'diff') await postDiffScan()
        else await postScan()
        break
      }
      case 'SET_DRAFT_STATE': {
        draftActive = message.active
        if (!draftActive && selectionChangedWhileDrafting) {
          selectionChangedWhileDrafting = false
          await postScan()
        }
        break
      }
      case 'APPLY_MUTATION': {
        const resultMessage = await applyMutation(message.draft)
        figma.commitUndo()
        draftActive = false
        selectionChangedWhileDrafting = false
        post({
          type: 'MUTATION_RESULT',
          payload: await scanSelection(),
          message: resultMessage,
        })
        break
      }
      case 'SAVE_SETTINGS': {
        saveSettings(message.settings)
        post({ type: 'SETTINGS_RESULT', payload: await scanSelection() })
        break
      }
      case 'RESIZE': {
        const size = clampWindowSize(message.size)
        figma.ui.resize(size.width, size.height)
        await figma.clientStorage.setAsync(WINDOW_SIZE_STORAGE_KEY, size)
        break
      }
      case 'SET_ACTIVE_TAB': {
        activeTab = message.activeTab
        await figma.clientStorage.setAsync(ACTIVE_TAB_STORAGE_KEY, activeTab)
        post({ type: 'ACTIVE_TAB_RESULT', activeTab })
        if (activeTab === 'diff') {
          pinnedDiffRootIds = figma.currentPage.selection.map((node) => node.id)
          await postDiffScan()
        } else {
          await postScan()
        }
        break
      }
      case 'REQUEST_DIFF_SCAN': {
        if (message.useCurrentSelection) {
          pinnedDiffRootIds = figma.currentPage.selection.map((node) => node.id)
        }
        await postDiffScan()
        break
      }
      case 'NAVIGATE_DIFF': {
        const node = await figma.getNodeByIdAsync(message.nodeId)
        if (!node || node.type === 'DOCUMENT' || node.type === 'PAGE') {
          throw new Error('The affected layer no longer exists.')
        }
        programmaticSelectionId = node.id
        figma.currentPage.selection = [node]
        figma.viewport.scrollAndZoomIntoView([node])
        break
      }
      case 'SAVE_DIFF_CODE_PREFS': {
        diffCodePreferences = normalizeDiffCodePreferences(message.preferences)
        await figma.clientStorage.setAsync(
          DIFF_CODE_PREFS_STORAGE_KEY,
          diffCodePreferences,
        )
        post({ type: 'DIFF_CODE_PREFS_RESULT', preferences: diffCodePreferences })
        break
      }
    }
  } catch (error) {
    post({ type: 'ERROR', error: mutationErrorPayload(error) })
  }
}

async function postScan(): Promise<void> {
  if (!uiReady) return
  post({ type: 'SCAN_RESULT', payload: await scanSelection() })
}

async function postDiffScan(): Promise<void> {
  if (!uiReady) return
  post({ type: 'DIFF_RESULT', payload: await scanInstanceDiff(pinnedDiffRootIds) })
}

function post(message: MainToUiMessage): void {
  if (uiReady) figma.ui.postMessage(message)
}

function clampWindowSize(size?: WindowSize): WindowSize {
  return {
    width: Math.round(
      Math.max(MIN_WINDOW_SIZE.width, Math.min(MAX_WINDOW_SIZE.width, size?.width ?? DEFAULT_WINDOW_SIZE.width)),
    ),
    height: Math.round(
      Math.max(MIN_WINDOW_SIZE.height, Math.min(MAX_WINDOW_SIZE.height, size?.height ?? DEFAULT_WINDOW_SIZE.height)),
    ),
  }
}

function normalizeTab(value: unknown): AppTab {
  return value === 'diff' ? 'diff' : 'variables'
}
