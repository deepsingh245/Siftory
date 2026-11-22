import type { AnalysisResult } from '../../domain/analysis'
import type { ResearchAnswer, ResearchContextSource } from '../../domain/research'

export type ModelOption = { slug: string; label: string }

export type ChatGptStatus =
  | { state: 'disconnected' | 'pending' | 'error'; message?: string }
  | { state: 'connected'; connectionId: string; email?: string; models: ModelOption[] }

export type ChatGptConnection = Extract<ChatGptStatus, { state: 'connected' }>

export class ChatGptRequestError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

async function api<T>(path: string, method: 'GET' | 'POST', body?: object, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`/api/ai/${path}`, {
    method, credentials: 'same-origin', signal,
    headers: { 'X-Siftory-Request': '1', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw new Error('The AI connection is available when Siftory runs locally with npm run dev or npm run preview.')
  }
  const value = await response.json() as T & { error?: string }
  if (!response.ok) throw new ChatGptRequestError(value.error ?? 'The ChatGPT request could not be completed.', response.status)
  return value
}

export const chatgpt = {
  status: (signal?: AbortSignal) => api<ChatGptStatus>('status', 'GET', undefined, signal),
  connect: () => api<{ authorizationUrl: string }>('connect', 'POST'),
  disconnect: () => api<ChatGptStatus>('disconnect', 'POST'),
  analyze: (model: string, text: string, connectionId: string) => api<{ result: AnalysisResult }>('analyze', 'POST', { model, text, connectionId, consent: true }),
  research: (model: string, question: string, sources: ResearchContextSource[], connectionId: string) => api<{ answer: ResearchAnswer }>('research', 'POST', {
    model, question, connectionId, consent: true,
    sources: sources.map(({ id, title, kind, excerpt, timedSegments }) => ({ id, title, kind, excerpt, timedSegments })),
  }),
}
