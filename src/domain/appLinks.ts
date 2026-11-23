import type { Analysis } from './analysis.ts'

export type AppLookupTarget =
  | { kind: 'name'; value: string }
  | { kind: 'apple' | 'google'; value: string }

export type AppListing = { store: 'apple' | 'google'; url: string; title: string; publisher?: string }
export type AppLookupResult = { target: AppLookupTarget; listings: AppListing[]; state: 'found' | 'unconfirmed' | 'unavailable' }

export const appLookupNamePattern = /^[\p{L}\p{N}][\p{L}\p{N} .&+’'-]{0,59}$/u
export const appleAppIdPattern = /^[1-9]\d{5,15}$/u
export const playPackagePattern = /^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)+$/u
export const maxAppLookupTargets = 6

function targetFromUrl(raw: string): AppLookupTarget | undefined {
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return
    if (url.hostname === 'apps.apple.com') {
      const id = /\/(?:[a-z]{2}\/)?app\/(?:[^/]+\/)?id(\d+)\/?$/u.exec(url.pathname)?.[1]
      if (id && appleAppIdPattern.test(id)) return { kind: 'apple', value: id }
    }
    if (url.hostname === 'play.google.com' && url.pathname === '/store/apps/details') {
      const id = url.searchParams.get('id')
      if (id && id.length <= 150 && playPackagePattern.test(id)) return { kind: 'google', value: id }
    }
  } catch { /* Keep unsupported URLs in the original source links. */ }
}

export function appLookupTargets(analysis: Pick<Analysis, 'links' | 'result'>): AppLookupTarget[] {
  const targets = new Map<string, AppLookupTarget>()
  function add(target: AppLookupTarget) {
    const key = `${target.kind}:${target.value.toLowerCase()}`
    if (!targets.has(key)) targets.set(key, target)
  }
  for (const link of analysis.links) {
    const target = targetFromUrl(link)
    if (target) add(target)
  }
  const { summary, points, mentions } = analysis.result
  for (const { evidence } of [summary, ...points, ...mentions]) {
    // Find explicit names in source evidence, including older analyses where
    // the model omitted the product from its mentions list.
    for (const match of evidence.matchAll(/\b(?:called|named)\s+([\p{Lu}\p{N}][\p{L}\p{N}&+'’.-]*(?:[ \t]+[\p{Lu}\p{N}][\p{L}\p{N}&+'’.-]*){0,3})/gu)) {
      const value = match[1].replace(/[.]+$/u, '').replace(/[ \t]+/gu, ' ')
      if (appLookupNamePattern.test(value)) add({ kind: 'name', value })
    }
  }
  for (const { text, evidence } of mentions) {
    const value = text.trim()
    if (appLookupNamePattern.test(value) && evidence.toLowerCase().includes(value.toLowerCase())) add({ kind: 'name', value })
  }
  return [...targets.values()].slice(0, maxAppLookupTargets)
}
