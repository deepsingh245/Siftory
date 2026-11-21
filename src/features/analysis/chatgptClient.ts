import type { AnalysisResult } from '../../domain/analysis'

export type ModelOption = { slug: string; label: string }

export type ChatGptStatus =
  | { state: 'disconnected' | 'pending' | 'error'; message?: string }
  | { state: 'connected'; email?: string; models: ModelOption[] }

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
  if (!response.ok) throw new Error(value.error ?? 'The ChatGPT request could not be completed.')
  return value
}

export const chatgpt = {
  status: (signal?: AbortSignal) => api<ChatGptStatus>('status', 'GET', undefined, signal),
  connect: () => api<{ authorizationUrl: string }>('connect', 'POST'),
  disconnect: () => api<ChatGptStatus>('disconnect', 'POST'),
  analyze: (model: string, text: string) => api<{ result: AnalysisResult }>('analyze', 'POST', { model, text, consent: true }),
}
