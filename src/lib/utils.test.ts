import { cn, formatDate, truncate } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz')
  })

  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8')
  })
})

describe('formatDate', () => {
  it('formats ISO date to Czech locale', () => {
    const result = formatDate('2026-03-17T12:00:00Z')
    expect(result).toMatch(/17/)
    expect(result).toMatch(/2026/)
  })
})

describe('truncate', () => {
  it('returns short strings unchanged', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('truncates long strings with ellipsis', () => {
    expect(truncate('hello world', 5)).toBe('hello…')
  })
})
