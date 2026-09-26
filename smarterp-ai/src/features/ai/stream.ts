import type { AIMessage, ChatEvent } from './types/ai.types'
// Décode uniquement le protocole SSE convenu avec Django ; aucun outil exécuté ici.
export function createChatStreamDecoder(emit: (event: ChatEvent) => void) {
  let offset = 0, buffer = '', finalMessage: AIMessage | null = null
  const dispatch = (payload: string) => {
    if (!payload || payload === '[DONE]') return
    const value: unknown = JSON.parse(payload)
    if (!value || typeof value !== 'object' || !('type' in value) || !['status', 'block', 'done', 'error'].includes(String(value.type))) throw new Error('Réponse IA non reconnue.')
    const event = value as ChatEvent
    if (event.type === 'done') { if (!event.message || event.message.role !== 'assistant' || !Array.isArray(event.message.blocks) || !Array.isArray(event.message.sources)) throw new Error('Réponse IA incomplète.'); finalMessage = event.message }
    if (event.type === 'error') throw new Error('La réponse IA a été interrompue par le serveur.')
    emit(event)
  }
  return {
    consume(text: string, final = false) {
      buffer += text.slice(offset); offset = text.length; buffer = buffer.replace(/\r\n/g, '\n')
      let boundary: number
      while ((boundary = buffer.indexOf('\n\n')) !== -1) { const frame = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2); dispatch(frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')) }
      if (final && buffer.trim()) { if (buffer.trimStart().startsWith('{')) { const message = JSON.parse(buffer) as AIMessage; dispatch(JSON.stringify({ type: 'done', message })) } else dispatch(buffer.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')); buffer = '' }
      return finalMessage
    },
  }
}
