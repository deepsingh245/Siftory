import { describe, expect, it } from 'vitest'
import { parseRoute, routeHref } from '../../src/app/routes'

describe('hash routes', () => {
  it('opens Dashboard by default while retaining the library route', () => {
    expect(parseRoute('')).toEqual({ page: 'dashboard' })
    expect(parseRoute('#/dashboard')).toEqual({ page: 'dashboard' })
    expect(parseRoute('#/library')).toEqual({ page: 'library' })
  })

  it('creates and parses an item route with a URL-safe identifier', () => {
    const href = routeHref({ page: 'item', id: 'item / 1' })
    expect(href).toBe('#/item/item%20%2F%201')
    expect(parseRoute(href)).toEqual({ page: 'item', id: 'item / 1' })
  })

  it('falls back to the library for invalid or unsupported routes', () => {
    expect(parseRoute('#/not-a-page')).toEqual({ page: 'library' })
    expect(parseRoute('#/item/%E0%A4%A')).toEqual({ page: 'library' })
  })
})
