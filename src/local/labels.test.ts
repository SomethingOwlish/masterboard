import { describe, expect, it } from 'vitest'
import { plural } from './labels'

describe('plural', () => {
  const word = (count: number) => plural(count, 'операция', 'операции', 'операций')

  it('picks the Russian form by the last digits', () => {
    expect([1, 21, 101].map(word)).toEqual(['операция', 'операция', 'операция'])
    expect([2, 3, 4, 22, 104].map(word)).toEqual(['операции', 'операции', 'операции', 'операции', 'операции'])
    expect([0, 5, 9, 20, 100].map(word)).toEqual(['операций', 'операций', 'операций', 'операций', 'операций'])
  })

  it('uses the «many» form for 11–14, whatever the last digit', () => {
    expect([11, 12, 13, 14, 111, 212].map(word)).toEqual(Array(6).fill('операций'))
  })
})
