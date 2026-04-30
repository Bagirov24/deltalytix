import { describe, it, expect } from 'vitest'
import { createTradeWithDefaults } from '../trade-factory'

describe('createTradeWithDefaults', () => {
  it('returns an object with all required Trade fields', () => {
    const trade = createTradeWithDefaults({})
    expect(trade).toHaveProperty('id')
    expect(trade).toHaveProperty('accountNumber')
    expect(trade).toHaveProperty('instrument')
    expect(trade).toHaveProperty('pnl')
    expect(trade).toHaveProperty('commission')
    expect(trade).toHaveProperty('quantity')
    expect(trade).toHaveProperty('side')
    expect(trade).toHaveProperty('entryDate')
    expect(trade).toHaveProperty('closeDate')
    expect(trade).toHaveProperty('tags')
    expect(trade).toHaveProperty('images')
  })

  it('applies string defaults for empty input', () => {
    const trade = createTradeWithDefaults({})
    expect(trade.accountNumber).toBe('')
    expect(trade.instrument).toBe('')
    expect(trade.side).toBe('')
    expect(trade.comment).toBe('')
    expect(trade.userId).toBe('')
  })

  it('applies numeric defaults for empty input', () => {
    const trade = createTradeWithDefaults({})
    expect(trade.pnl).toBe(0)
    expect(trade.commission).toBe(0)
    expect(trade.quantity).toBe(0)
    expect(trade.timeInPosition).toBe(0)
  })

  it('applies array defaults for empty input', () => {
    const trade = createTradeWithDefaults({})
    expect(trade.tags).toEqual([])
    expect(trade.images).toEqual([])
  })

  it('applies null defaults for nullable fields', () => {
    const trade = createTradeWithDefaults({})
    expect(trade.groupId).toBeNull()
    expect(trade.imageBase64).toBeNull()
    expect(trade.imageBase64Second).toBeNull()
    expect(trade.videoUrl).toBeNull()
    expect(trade.entryId).toBeNull()
    expect(trade.closeId).toBeNull()
  })

  it('preserves provided instrument', () => {
    const trade = createTradeWithDefaults({ instrument: 'ESM25' })
    expect(trade.instrument).toBe('ESM25')
  })

  it('preserves provided pnl', () => {
    const trade = createTradeWithDefaults({ pnl: 350.5 })
    expect(trade.pnl).toBe(350.5)
  })

  it('preserves provided userId', () => {
    const trade = createTradeWithDefaults({ userId: 'user-abc' })
    expect(trade.userId).toBe('user-abc')
  })

  it('preserves provided tags array', () => {
    const trade = createTradeWithDefaults({ tags: ['momentum', 'breakout'] })
    expect(trade.tags).toEqual(['momentum', 'breakout'])
  })

  it('preserves provided groupId', () => {
    const trade = createTradeWithDefaults({ groupId: 'group-42' })
    expect(trade.groupId).toBe('group-42')
  })

  it('generates a non-empty id string', () => {
    const trade = createTradeWithDefaults({ instrument: 'NQM25', userId: 'u1' })
    expect(typeof trade.id).toBe('string')
    expect(trade.id.length).toBeGreaterThan(0)
  })

  it('generates different ids for different inputs', () => {
    const t1 = createTradeWithDefaults({ instrument: 'ESM25', userId: 'u1' })
    const t2 = createTradeWithDefaults({ instrument: 'NQM25', userId: 'u1' })
    expect(t1.id).not.toBe(t2.id)
  })

  it('generates the same id for identical inputs (deterministic via generateTradeHash)', () => {
    const input = { instrument: 'ESM25', userId: 'u1', accountNumber: 'ACC-1', quantity: 2 }
    const t1 = createTradeWithDefaults(input)
    const t2 = createTradeWithDefaults({ ...input })
    expect(t1.id).toBe(t2.id)
  })

  it('createdAt is a Date instance', () => {
    const trade = createTradeWithDefaults({})
    expect(trade.createdAt).toBeInstanceOf(Date)
  })
})
