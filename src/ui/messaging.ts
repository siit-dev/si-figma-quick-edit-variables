import type { MainToUiMessage, UiToMainMessage } from '../shared/types'

export function send(message: UiToMainMessage): void {
  parent.postMessage({ pluginMessage: message }, '*')
}

export function subscribe(handler: (message: MainToUiMessage) => void): () => void {
  const listener = (event: MessageEvent<{ pluginMessage?: MainToUiMessage }>) => {
    if (event.data.pluginMessage) handler(event.data.pluginMessage)
  }
  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}

