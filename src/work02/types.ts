import type { Direction } from '../domain/types'

export interface Work02InputItem {
  /**
   * Work 01 `presentedOrder` preserved as-is (1..12).
   * This is not a zero-based array index.
   */
  index: number
  cardId: string
  color: {
    hue: number
    lightness: number
    chroma: number
  }
  direction: Direction
}

export type Work02Input = readonly [
  Work02InputItem,
  Work02InputItem,
  Work02InputItem,
  Work02InputItem,
  Work02InputItem,
  Work02InputItem,
  Work02InputItem,
  Work02InputItem,
  Work02InputItem,
  Work02InputItem,
  Work02InputItem,
  Work02InputItem,
]
