import { describe, it, expect } from 'vitest'
import { generateDeterministicTradeId } from '../trade-id-utils'

const BASE_TRADE = {
  accountNumber: 'ACC-001',
  entryId: 'E1',
  closeId: 'C1',
  instrument: 'ESM25',
  entryPrice: '5000.25',
  closePrice: '5005.00',
  entryDate: '2025-01-06T09:30:00Z',
  closeDate: '2025-01-06T09:45:00Z',
  quantity: 2,
  side: 'Long',
  userId: 'user-abc',
}

describe('generateDeterministicTradeId', () => {
  it('returns a UUID-like string with 8-4-4-4-12 hex segments', () => {
    const id = generateDeterministicTradeId(BASE_TRADE)
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  })

  it('is deterministic — same input always produces same id', () => {
    const id1 = generateDeterministicTradeId(BASE_TRADE)
    const id2 = generateDeterministicTradeId({ ...BASE_TRADE })
    expect(id1).toBe(id2)
  })

  it('produces different id when userId changes', () => {
    const id1 = generateDeterministicTradeId(BASE_TRADE)
    const id2 = generateDeterministicTradeId({ ...BASE_TRADE, userId: 'user-xyz' })
    expect(id1).not.toBe(id2)
  })

  it('produces different id when instrument changes', () => {
    const id1 = generateDeterministicTradeId(BASE_TRADE)
    const id2 = generateDeterministicTradeId({ ...BASE_TRADE, instrument: 'NQM25' })
    expect(id1).not.toBe(id2)
  })

  it('produces different id when entryPrice changes', () => {
    const id1 = generateDeterministicTradeId(BASE_TRADE)
    const id2 = generateDeterministicTradeId({ ...BASE_TRADE, entryPrice: '5001.00' })
    expect(id1).not.toBe(id2)
  })

  it('produces different id when closePrice changes', () => {
    const id1 = generateDeterministicTradeId(BASE_TRADE)
    const id2 = generateDeterministicTradeId({ ...BASE_TRADE, closePrice: '5010.00' })
    expect(id1).not.toBe(id2)
  })

  it('produces different id when quantity changes', () => {
    const id1 = generateDeterministicTradeId(BASE_TRADE)
    const id2 = generateDeterministicTradeId({ ...BASE_TRADE, quantity: 5 })
    expect(id1).not.toBe(id2)
  })

  it('produces different id when side changes (Long vs Short)', () => {
    const id1 = generateDeterministicTradeId(BASE_TRADE)
    const id2 = generateDeterministicTradeId({ ...BASE_TRADE, side: 'Short' })
    expect(id1).not.toBe(id2)
  })

  it('produces different id when accountNumber changes', () => {
    const id1 = generateDeterministicTradeId(BASE_TRADE)
    const id2 = generateDeterministicTradeId({ ...BASE_TRADE, accountNumber: 'ACC-002' })
    expect(id1).not.toBe(id2)
  })

  it('produces different id when entryDate changes', () => {
    const id1 = generateDeterministicTradeId(BASE_TRADE)
    const id2 = generateDeterministicTradeId({ ...BASE_TRADE, entryDate: '2025-01-07T09:30:00Z' })
    expect(id1).not.toBe(id2)
  })

  it('produces different id when entryId changes', () => {
    const id1 = generateDeterministicTradeId(BASE_TRADE)
    const id2 = generateDeterministicTradeId({ ...BASE_TRADE, entryId: 'E2' })
    expect(id1).not.toBe(id2)
  })

  it('two different trades always produce different ids (no collision)', () => {
    const ids = new Set(
      Array.from({ length: 10 }, (_, i) =>
        generateDeterministicTradeId({ ...BASE_TRADE, entryId: `E${i}`, closeId: `C${i}` }),
      ),
    )
    expect(ids.size).toBe(10)
  })
})
