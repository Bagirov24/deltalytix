import { describe, it, expect } from 'vitest'
import {
  calculateTicksAndPoints,
  calculateTicksAndPointsForTrades,
  calculateTicksAndPointsForGroupedTrade,
} from '../tick-calculations'

// Minimal mock that satisfies the Trade shape used inside tick-calculations
const makeTrade = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'trade-1',
    instrument: 'ESM25',
    pnl: 250,
    quantity: 1,
    accountNumber: '',
    entryPrice: 5000,
    closePrice: 5005,
    entryDate: '2025-01-06T09:30:00Z',
    closeDate: '2025-01-06T09:45:00Z',
    commission: 0,
    side: 'Long',
    userId: 'user-1',
    tags: [],
    images: [],
    groupId: null,
    ...overrides,
  } as any)

const ES_TICK_DETAILS = {
  ES: { tickValue: 12.5, tickSize: 0.25 },
}

const NQ_TICK_DETAILS = {
  NQ: { tickValue: 5, tickSize: 0.25 },
}

describe('calculateTicksAndPoints', () => {
  it('uses defaults (tickValue=1, tickSize=0.01) when no matching ticker', () => {
    const result = calculateTicksAndPoints(makeTrade({ instrument: 'UNKNOWN' }), {})
    expect(result.tickValue).toBe(1)
    expect(result.tickSize).toBe(0.01)
  })

  it('matches ticker by longest matching prefix in instrument name', () => {
    const result = calculateTicksAndPoints(makeTrade({ instrument: 'ESM25' }), ES_TICK_DETAILS)
    expect(result.tickValue).toBe(12.5)
    expect(result.tickSize).toBe(0.25)
  })

  it('computes ticks: pnlPerContract / tickValue — 250 / 12.5 = 20', () => {
    const result = calculateTicksAndPoints(makeTrade({ pnl: 250, quantity: 1 }), ES_TICK_DETAILS)
    expect(result.ticks).toBe(20)
  })

  it('computes points: ticks * tickSize — 20 * 0.25 = 5', () => {
    const result = calculateTicksAndPoints(makeTrade({ pnl: 250, quantity: 1 }), ES_TICK_DETAILS)
    expect(result.points).toBe(5)
  })

  it('handles negative pnl (loss) — -125 / 12.5 = -10 ticks', () => {
    const result = calculateTicksAndPoints(makeTrade({ pnl: -125, quantity: 1 }), ES_TICK_DETAILS)
    expect(result.ticks).toBe(-10)
    expect(result.points).toBe(-2.5)
  })

  it('divides pnl by quantity before computing ticks (2 contracts)', () => {
    // pnlPerContract = 500/2 = 250 → 250/12.5 = 20 ticks
    const result = calculateTicksAndPoints(makeTrade({ pnl: 500, quantity: 2 }), ES_TICK_DETAILS)
    expect(result.ticks).toBe(20)
    expect(result.points).toBe(5)
  })

  it('returns 0 ticks and 0 points for zero pnl', () => {
    const result = calculateTicksAndPoints(makeTrade({ pnl: 0, quantity: 1 }), ES_TICK_DETAILS)
    expect(result.ticks).toBe(0)
    expect(result.points).toBe(0)
  })

  it('returns 0 for NaN result (quantity = 0, division by zero)', () => {
    const result = calculateTicksAndPoints(makeTrade({ pnl: 100, quantity: 0 }), ES_TICK_DETAILS)
    expect(result.ticks).toBe(0)
    expect(result.points).toBe(0)
  })

  it('works with NQ tick details (tickValue=5)', () => {
    // 200 pnl / 5 tickValue = 40 ticks; 40 * 0.25 = 10 points
    const result = calculateTicksAndPoints(
      makeTrade({ instrument: 'NQM25', pnl: 200, quantity: 1 }),
      NQ_TICK_DETAILS,
    )
    expect(result.ticks).toBe(40)
    expect(result.points).toBe(10)
  })

  it('rounds points to 2 decimal places', () => {
    // pnl=100, quantity=3 → pnlPerContract≈33.33, ticks=Math.round(33.33/12.5)=3
    // points = 3 * 0.25 = 0.75
    const result = calculateTicksAndPoints(makeTrade({ pnl: 100, quantity: 3 }), ES_TICK_DETAILS)
    const decimals = result.points.toString().split('.')[1]?.length ?? 0
    expect(decimals).toBeLessThanOrEqual(2)
  })
})

describe('calculateTicksAndPointsForTrades', () => {
  it('returns results keyed by trade id', () => {
    const trades = [
      makeTrade({ id: 'a', pnl: 250, quantity: 1 }),
      makeTrade({ id: 'b', pnl: -125, quantity: 1 }),
    ]
    const result = calculateTicksAndPointsForTrades(trades, ES_TICK_DETAILS)
    expect(result['a'].ticks).toBe(20)
    expect(result['b'].ticks).toBe(-10)
  })

  it('returns empty object for empty trades array', () => {
    expect(calculateTicksAndPointsForTrades([], ES_TICK_DETAILS)).toEqual({})
  })

  it('processes all trades even with mixed instruments', () => {
    const trades = [
      makeTrade({ id: 'es', instrument: 'ESM25', pnl: 250 }),
      makeTrade({ id: 'nq', instrument: 'NQM25', pnl: 200 }),
    ]
    const result = calculateTicksAndPointsForTrades(trades, {
      ...ES_TICK_DETAILS,
      ...NQ_TICK_DETAILS,
    })
    expect(Object.keys(result)).toHaveLength(2)
    expect(result['es'].tickValue).toBe(12.5)
    expect(result['nq'].tickValue).toBe(5)
  })
})

describe('calculateTicksAndPointsForGroupedTrade', () => {
  it('sums ticks and points across grouped trades', () => {
    const grouped = {
      trades: [
        makeTrade({ id: 'a', pnl: 250, quantity: 1 }), // 20 ticks, 5 points
        makeTrade({ id: 'b', pnl: 125, quantity: 1 }), // 10 ticks, 2.5 points
      ],
    }
    const result = calculateTicksAndPointsForGroupedTrade(grouped, ES_TICK_DETAILS)
    expect(result.ticks).toBe(30)
    expect(result.points).toBeCloseTo(7.5)
  })

  it('falls back to single trade calculation when trades array is absent', () => {
    const trade = makeTrade({ pnl: 250, quantity: 1 })
    const result = calculateTicksAndPointsForGroupedTrade(trade, ES_TICK_DETAILS)
    expect(result.ticks).toBe(20)
    expect(result.points).toBe(5)
  })

  it('handles empty grouped trades array', () => {
    const grouped = { trades: [] }
    const result = calculateTicksAndPointsForGroupedTrade(grouped, ES_TICK_DETAILS)
    expect(result.ticks).toBe(0)
    expect(result.points).toBe(0)
  })

  it('uses default tickValue/tickSize for grouped trade summary', () => {
    const grouped = {
      trades: [makeTrade({ pnl: 250, quantity: 1 })],
    }
    const result = calculateTicksAndPointsForGroupedTrade(grouped, ES_TICK_DETAILS)
    // grouped summary always reports tickValue=1, tickSize=0.01
    expect(result.tickValue).toBe(1)
    expect(result.tickSize).toBe(0.01)
  })
})
