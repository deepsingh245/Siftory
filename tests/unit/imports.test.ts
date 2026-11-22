import { describe, expect, it } from 'vitest'
import { MAX_IMPORTED_DESCRIPTION_CHARS, MAX_INSTAGRAM_IMPORT_ROWS, parseInstagramJson, parseManualUrl, parseSourceFile, toImportedItems } from '../../src/domain/imports'

describe('Instagram export import', () => {
  it('parses a synthetic export above the former 1,000-row limit', () => {
    const payload = JSON.stringify(Array.from({ length: 5_000 }, (_, index) => ({ caption: `Synthetic saved note ${index}` })))
    const start = performance.now()
    const result = parseInstagramJson(payload)
    const elapsed = performance.now() - start
    expect(result.errors).toEqual([])
    expect(result.rows).toHaveLength(5_000)
    console.info(`Synthetic Instagram import: 5,000 rows parsed in ${Math.round(elapsed)} ms (${(payload.length / 1024).toFixed(1)} KiB).`)
  })

  it('retains the original row and accepts nested metadata without inferring the media type', () => {
    const original = {
      timestamp: 1_700_000_000,
      media: [],
      label_values: [{ dict: [{ href: 'https://www.instagram.com/p/example/' }, { caption: 'Field notes' }, { username: 'example' }, { media_id: 42 }] }],
    }
    const { rows, errors } = parseInstagramJson(`\uFEFF${JSON.stringify([original])}`)
    expect(errors).toEqual([])
    expect(rows[0]).toMatchObject({
      selected: true,
      sourceRecordId: '42',
      sourceMetadata: original,
      draft: { contentType: 'unknown', url: 'https://www.instagram.com/p/example/', description: 'Field notes', creatorHandle: 'example', savedAt: '2023-11-14T22:13:20.000Z' },
    })
    expect(rows[0].warnings[0]).toContain('media list is empty')
    const { items } = toImportedItems([{ ...rows[0], draft: { ...rows[0].draft!, description: 'Corrected' } }])
    expect(items[0]).toMatchObject({ status: 'inbox', description: 'Corrected', sourceMetadata: original })
  })

  it('reports malformed rows independently of usable rows', () => {
    const result = parseInstagramJson(JSON.stringify([null, { href: 'javascript:alert(1)' }, { label_values: [] }, { caption: 'Useful caption' }]))
    expect(result.errors).toEqual([])
    expect(result.rows.map((row) => row.selected)).toEqual([false, false, false, true])
    expect(result.rows.slice(0, 3).every((row) => row.errors.length > 0)).toBe(true)
    expect(toImportedItems(result.rows).items).toHaveLength(1)
  })

  it('retains the full caption when the editable field is shortened', () => {
    const caption = 'a'.repeat(MAX_IMPORTED_DESCRIPTION_CHARS + 1)
    const { rows: [row] } = parseInstagramJson(JSON.stringify([{ caption }]))
    expect(row.draft?.description).toHaveLength(MAX_IMPORTED_DESCRIPTION_CHARS)
    expect(row.sourceMetadata?.caption).toBe(caption)
    expect(row.warnings).toContainEqual(expect.stringContaining('description preview'))
  })

  it.each(['{', '{}', JSON.stringify(Array(MAX_INSTAGRAM_IMPORT_ROWS + 1).fill({}))])('rejects an unreadable or out of bounds export', (input) => {
    expect(parseInstagramJson(input)).toMatchObject({ rows: [], errors: [expect.any(String)] })
  })
})

describe('manual link and file import', () => {
  it('normalizes web links and rejects unsafe schemes and embedded credentials', () => {
    expect(parseManualUrl('  https://EXAMPLE.com/', ' Note ').rows[0].draft).toMatchObject({ url: 'https://example.com/', title: 'Note' })
    expect(parseManualUrl('https://youtube.com/watch?v=abcdefghijk').rows[0].draft).toMatchObject({ sourceType: 'youtube', contentType: 'video' })
    expect(parseManualUrl('https://youtu.be/abcdefghijk').rows[0].sourceMetadata).toEqual({ youtubeVideoId: 'abcdefghijk' })
    expect(parseManualUrl('https://youtube.com/shorts/abcdefghijk').rows[0].draft).toMatchObject({ sourceType: 'youtube', contentType: 'short' })
    for (const url of ['file:///notes', 'javascript:alert(1)', 'https://user:pass@example.com/']) {
      expect(parseManualUrl(url)).toMatchObject({ rows: [], errors: [expect.any(String)] })
    }
  })

  it('preserves file bytes and fingerprints and ignores rows the user did not select', async () => {
    const { rows: [text] } = await parseSourceFile(new File(['abc'], 'Notes.TXT', { type: 'text/plain' }))
    const { rows: [pdf] } = await parseSourceFile(new File(['%PDF-1.7'], 'Paper.pdf', { type: 'application/pdf' }))
    const { items, files } = toImportedItems([text, { ...pdf, selected: false }])
    expect(items).toHaveLength(1)
    expect(files).toHaveLength(1)
    expect(items[0].sourceFileId).toBe(files[0].savedItemId)
    expect(files[0]).toMatchObject({ mediaType: 'text/plain', sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad' })
    expect(await files[0].blob.text()).toBe('abc')
  })

  it('rejects empty files and files with unsupported types', async () => {
    for (const file of [new File([], 'notes.txt'), new File(['a'], 'notes.txt', { type: 'text/html' }), new File(['a'], 'notes.exe')]) {
      expect(await parseSourceFile(file)).toMatchObject({ rows: [], errors: [expect.any(String)] })
    }
  })
})
