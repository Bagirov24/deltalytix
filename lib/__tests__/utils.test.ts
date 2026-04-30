import { describe, it, expect } from 'vitest'
import { parsePositionTime, groupBy, calculateTradingDays, generateTradeHash } from '../utils'

// ── parsePositionTime ─────────────────────────────────────────────────────────

describe('parsePositionTime', () => {
  it('returns "0m 0s" for 0 seconds', () => {
    expect(parsePositionTime(0)).toBe('0m 0s')
  })

  it('formats seconds only (45s)', () => {
    expect(parsePositionTime(45)).toBe('0m 45s')
  })

  it('formats minutes and seconds (90s → 1m 30s)', () => {
    expect(parsePositionTime(90)).toBe('1m 30s')
  })

  it('formats hours, minutes, seconds (3661s → 1h 1m 1s)', () => {
    expect(parsePositionTime(3661)).toBe('1h 1m 1s')
  })

  it('formats exactly 1 hour (3600s → 1h 0m 0s)', () => {
    expect(parsePositionTime(3600)).toBe('1h 0m 0s')
  })

  it('formats exactly 1 minute (60s → 1m 0s)', () => {
    expect(parsePositionTime(60)).toBe('1m 0s')
  })

  it('formats 2h 30m (9000s)', () => {
    expect(parsePositionTime(9000)).toBe('2h 30m 0s')
  })

  it('returns "0" for NaN input', () => {
    expect(parsePositionTime(NaN)).toBe('0')
  })
})

// ── groupBy ───────────────────────────────────────────────────────────────────

describe('groupBy', () => {
  it('groups an array of objects by a string key', () => {
    const items = [
      { side: 'Long', pnl: 100 },
      { side: 'Short', pnl: -50 },
      { side: 'Long', pnl: 200 },
    ]
    const result = groupBy(items, 'side')
    expect(result['Long']).toHaveLength(2)
    expect(result['Short']).toHaveLength(1)
  })

  it('returns empty object for empty array', () => {
    expect(groupBy([], 'side')).toEqual({})
  })

  it('creates a group key for each unique value', () => {
    const items = [
      { instrument: 'ES', pnl: 100 },
      { instrument: 'NQ', pnl: 200 },
      { instrument: 'ES', pnl: -50 },
    ]
    const result = groupBy(items, 'instrument')
    expect(Object.keys(result).sort()).toEqual(['ES', 'NQ'])
  })

  it('preserves all items in their groups (no data loss)', () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ id: i, bucket: i % 3 }))
    const result = groupBy(items, 'bucket')
    const total = Object.values(result).reduce((s, arr) => s + arr.length, 0)
    expect(total).toBe(10)
  })

  it('handles single-item groups', () => {
    const items = [{ k: 'only', v: 1 }]
    const result = groupBy(items, 'k')
    expect(result['only']).toEqual([{ k: 'only', v: 1 }])
  })
})

// ── calculateTradingDays ──────────────────────────────────────────────────────

const makeTrade = (entryDate: string, pnl: number, commission = 0) =>
  ({ entryDate, pnl, commission, id: entryDate } as any)

describe('calculateTradingDays', () => {
  it('returns zeros for empty trades array', () => {
    const result = calculateTradingDays([])
    expect(result.totalTradingDays).toBe(0)
    expect(result.validTradingDays).toBe(0)
    expect(result.dailyPnL).toEqual({})
  })

  it('counts one trading day for a single trade', () => {
    const result = calculateTradingDays([makeTrade('2025-01-06T10:00:00Z', 250)])
    expect(result.totalTradingDays).toBe(1)
  })

  it('aggregates pnl minus commission per day', () => {
    const result = calculateTradingDays([
      makeTrade('2025-01-06T10:00:00Z', 300, 10),
      makeTrade('2025-01-06T12:00:00Z', 100, 5),
    ])
    // Both on same day: (300-10) + (100-5) = 385
    expect(result.totalTradingDays).toBe(1)
    const dayKey = Object.keys(result.dailyPnL)[0]
    expect(result.dailyPnL[dayKey]).toBeCloseTo(385)
  })

  it('counts multiple days correctly', () => {
    const result = calculateTradingDays([
      makeTrade('2025-01-06T10:00:00Z', 250),
      makeTrade('2025-01-07T10:00:00Z', 150),
      makeTrade('2025-01-08T10:00:00Z', -100),
    ])
    expect(result.totalTradingDays).toBe(3)
  })

  it('counts valid days when minPnlToCountAsDay is provided', () => {
    const result = calculateTradingDays(
      [
        makeTrade('2025-01-06T10:00:00Z', 300),  // +300 → valid
        makeTrade('2025-01-07T10:00:00Z', 50),   // +50  → invalid (below 200)
        makeTrade('2025-01-08T10:00:00Z', -100), // -100 → invalid
      ],
      200,
    )
    expect(result.totalTradingDays).toBe(3)
    expect(result.validTradingDays).toBe(1)
  })

  it('all days are valid when minPnlToCountAsDay is null', () => {
    const result = calculateTradingDays(
      [
        makeTrade('2025-01-06T10:00:00Z', 100),
        makeTrade('2025-01-07T10:00:00Z', -50),
      ],
      null,
    )
    expect(result.validTradingDays).toBe(result.totalTradingDays)
  })

  it('all days are valid when minPnlToCountAsDay is 0', () => {
    const result = calculateTradingDays(
      [makeTrade('2025-01-06T10:00:00Z', 100)],
      0,
    )
    expect(result.validTradingDays).toBe(1)
  })
})

// ── generateTradeHash ─────────────────────────────────────────────────────────

const BASE_TRADE = {
  userId: 'user-1',
  accountNumber: 'ACC-001',
  instrument: 'ESM25',
  entryDate: '2025-01-06T09:30:00Z',
  closeDate: '2025-01-06T09:45:00Z',
  quantity: 2,
  entryId: 'E1',
  closeId: 'C1',
  timeInPosition: 900,
}

describe('generateTradeHash', () => {
  it('returns a non-empty string', () => {
    expect(generateTradeHash(BASE_TRADE)).toBeTruthy()
  })

  it('is deterministic — same input produces same hash', () => {
    expect(generateTradeHash(BASE_TRADE)).toBe(generateTradeHash({ ...BASE_TRADE }))
  })

  it('changes when userId changes', () => {
    const h1 = generateTradeHash(BASE_TRADE)
    const h2 = generateTradeHash({ ...BASE_TRADE, userId: 'user-2' })
    expect(h1).not.toBe(h2)
  })

  it('changes when instrument changes', () => {
    const h1 = generateTradeHash(BASE_TRADE)
    const h2 = generateTradeHash({ ...BASE_TRADE, instrument: 'NQM25' })
    expect(h1).not.toBe(h2)
  })

  it('changes when quantity changes', () => {
    const h1 = generateTradeHash(BASE_TRADE)
    const h2 = generateTradeHash({ ...BASE_TRADE, quantity: 5 })
    expect(h1).not.toBe(h2)
  })

  it('handles undefined fields gracefully (partial trade)', () => {
    expect(() => generateTradeHash({})).not.toThrow()
    const hash = generateTradeHash({})
    expect(typeof hash).toBe('string')
  })

  it('uses empty string for missing userId (no crash)', () => {
    const hash = generateTradeHash({ instrument: 'ES' })
    expect(hash).toContain('ES')
  })
})
