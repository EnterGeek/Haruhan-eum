import type { Direction } from '../domain/types'

export interface Work02InputItem {
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
