import { describe, it, expect } from 'vitest'
import {
  parseLocalizedNumber,
  formatCurrencyValue,
  formatPriceValue,
} from '../ninjatrader-number-parser'

describe('parseLocalizedNumber', () => {
  it('returns 0 with error for undefined', () => {
    expect(parseLocalizedNumber(undefined)).toEqual({ value: 0, error: 'Invalid numeric value' })
  })

  it('returns 0 with error for empty string', () => {
    expect(parseLocalizedNumber('')).toEqual({ value: 0, error: 'Invalid numeric value' })
  })

  it('returns 0 with error for whitespace-only string', () => {
    expect(parseLocalizedNumber('   ')).toEqual({ value: 0, error: 'Invalid numeric value' })
  })

  it('parses plain integer', () => {
    expect(parseLocalizedNumber('42')).toEqual({ value: 42 })
  })

  it('parses negative dot-decimal (-23.20)', () => {
    expect(parseLocalizedNumber('-23.20')).toEqual({ value: -23.2 })
  })

  it('parses US thousands separator (1,234.56)', () => {
    expect(parseLocalizedNumber('1,234.56')).toEqual({ value: 1234.56 })
  })

  it('parses EU thousands separator (1.234,56)', () => {
    expect(parseLocalizedNumber('1.234,56')).toEqual({ value: 1234.56 })
  })

  it('parses comma-decimal (39,30)', () => {
    expect(parseLocalizedNumber('39,30')).toEqual({ value: 39.3 })
  })

  it('strips trailing currency symbol ("39,30 $")', () => {
    expect(parseLocalizedNumber('39,30 $')).toEqual({ value: 39.3 })
  })

  it('strips leading $ sign ("$1,234.56")', () => {
    expect(parseLocalizedNumber('$1,234.56')).toEqual({ value: 1234.56 })
  })

  it('strips non-breaking space ("\u00A01,234.56")', () => {
    expect(parseLocalizedNumber('\u00A01,234.56')).toEqual({ value: 1234.56 })
  })

  it('returns 0 with error for fully non-numeric string', () => {
    const result = parseLocalizedNumber('abc')
    expect(result.value).toBe(0)
    expect(result.error).toBeDefined()
  })

  it('parses zero correctly', () => {
    expect(parseLocalizedNumber('0')).toEqual({ value: 0 })
  })

  it('parses large US number (1,000,000.00)', () => {
    expect(parseLocalizedNumber('1,000,000.00')).toEqual({ value: 1_000_000 })
  })
})

describe('formatCurrencyValue', () => {
  it('returns 0 with error for undefined', () => {
    expect(formatCurrencyValue(undefined)).toEqual({ pnl: 0, error: 'Invalid PNL value' })
  })

  it('returns 0 with error for empty string', () => {
    expect(formatCurrencyValue('')).toEqual({ pnl: 0, error: 'Invalid PNL value' })
  })

  it('parses positive PnL', () => {
    expect(formatCurrencyValue('150.00')).toEqual({ pnl: 150 })
  })

  it('parses negative PnL', () => {
    expect(formatCurrencyValue('-75.50')).toEqual({ pnl: -75.5 })
  })

  it('treats parentheses as negative — (23,20)', () => {
    expect(formatCurrencyValue('(23,20)')).toEqual({ pnl: -23.2 })
  })

  it('treats parentheses as negative — large value (1,234.56)', () => {
    expect(formatCurrencyValue('(1,234.56)')).toEqual({ pnl: -1234.56 })
  })

  it('parentheses always produce negative even when value is already negative', () => {
    // (-50) should be -50, not +50
    const result = formatCurrencyValue('(50)')
    expect(result.pnl).toBeLessThan(0)
  })

  it('returns 0 with error for non-numeric string', () => {
    const result = formatCurrencyValue('n/a')
    expect(result.pnl).toBe(0)
    expect(result.error).toBeDefined()
  })
})

describe('formatPriceValue', () => {
  it('parses dot-decimal price', () => {
    expect(formatPriceValue('4523.75')).toEqual({ price: 4523.75 })
  })

  it('parses EU-format price (4.523,75)', () => {
    expect(formatPriceValue('4.523,75')).toEqual({ price: 4523.75 })
  })

  it('parses integer price', () => {
    expect(formatPriceValue('5000')).toEqual({ price: 5000 })
  })

  it('returns 0 with error for invalid input', () => {
    const result = formatPriceValue('not-a-price')
    expect(result.price).toBe(0)
    expect(result.error).toBeDefined()
  })

  it('returns 0 with error for empty string', () => {
    const result = formatPriceValue('')
    expect(result.price).toBe(0)
    expect(result.error).toBeDefined()
  })
})
