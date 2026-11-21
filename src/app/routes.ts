export type AppRoute =
  | { page: 'library' | 'inbox' | 'recent' | 'collections' | 'categories' | 'tags' | 'import' }
  | { page: 'item' | 'collection' | 'category' | 'tag'; id: string }

export function parseRoute(hash: string): AppRoute {
  let parts: string[]
  try {
    parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return { page: 'library' }
  }
  const page = parts[0]
  const id = parts[1]

  if (page === 'inbox' || page === 'recent' || page === 'collections' || page === 'categories' || page === 'tags' || page === 'import') {
    return { page }
  }
  if (page === 'item' && id) return { page: 'item', id }
  if (page === 'collection' && id) return { page: 'collection', id }
  if (page === 'category' && id) return { page: 'category', id }
  if (page === 'tag' && id) return { page: 'tag', id }
  return { page: 'library' }
}

export function routeHref(route: AppRoute): string {
  return `#/${route.page}${'id' in route ? `/${encodeURIComponent(route.id)}` : ''}`
}
