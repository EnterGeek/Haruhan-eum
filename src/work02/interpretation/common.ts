import type { Direction } from '../../domain/types'
import {
  circularHueDistance,
  hueRotationDirection,
  normalizeHue,
  signedHueDelta,
} from '../hue'
import type { Work02Input } from '../types'
import {
  COMMON_FEATURES_VERSION,
  FLOW_INTERPRETATION_CONTRACT_VERSION,
  WORK02_INPUT_CARD_COUNT,
  WORK02_INPUT_VERSION,
} from '../versions'
import type {
  DirectionRun,
  DirectionTurn,
  FlowInterpretation,
  InterpretationMethod,
} from './types'

const buildRuns = (input: Work02Input): DirectionRun[] => {
  const runs: DirectionRun[] = []
  input.forEach((item) => {
    const current = runs.at(-1)
    if (current?.direction === item.direction) {
      current.endPresentedOrder = item.index
      current.length += 1
    } else {
      runs.push({
        direction: item.direction,
        startPresentedOrder: item.index,
        endPresentedOrder: item.index,
        length: 1,
      })
    }
  })
  return runs
}

const buildTurns = (input: Work02Input): DirectionTurn[] =>
  input.slice(1).flatMap((item, sequencePosition) => {
    const previous = input[sequencePosition]
    return previous.direction === item.direction
      ? []
      : [{
          atPresentedOrder: item.index,
          from: previous.direction,
          to: item.direction,
        }]
  })

export function extractCommonFlowFeatures(
  input: Work02Input,
  method: InterpretationMethod,
): FlowInterpretation {
  if (input.length !== WORK02_INPUT_CARD_COUNT) {
    throw new RangeError(`Work02Input must contain ${WORK02_INPUT_CARD_COUNT} items.`)
  }

  input.forEach((item, sequencePosition) => {
    if (item.index !== sequencePosition + 1) {
      throw new RangeError(
        `Work02Input item ${sequencePosition} must preserve presentedOrder ${sequencePosition + 1}.`,
      )
    }
  })

  const items = input.map((item, sequencePosition) => {
    const normalizedHue = normalizeHue(item.color.hue)
    const previous = sequencePosition === 0 ? null : input[sequencePosition - 1]
    return {
      sequencePosition,
      presentedOrder: item.index,
      cardId: item.cardId,
      selectionDirection: item.direction,
      normalizedHue,
      normalizedHuePosition: normalizedHue / 360,
      lightness: item.color.lightness,
      chroma: item.color.chroma,
      adjacentHueChange: previous === null ? null : {
        fromPresentedOrder: previous.index,
        distance: circularHueDistance(previous.color.hue, item.color.hue),
        signedDelta: signedHueDelta(previous.color.hue, item.color.hue),
        direction: hueRotationDirection(previous.color.hue, item.color.hue),
      },
    }
  })

  const distances = items
    .slice(1)
    .map((item) => item.adjacentHueChange?.distance ?? 0)
  const positionsByDirection: Record<Direction, number[]> = {
    left: [],
    right: [],
  }
  input.forEach((item) => positionsByDirection[item.direction].push(item.index))
  const leftCount = positionsByDirection.left.length
  const rightCount = positionsByDirection.right.length

  return {
    versions: {
      input: WORK02_INPUT_VERSION,
      contract: FLOW_INTERPRETATION_CONTRACT_VERSION,
      commonFeatures: COMMON_FEATURES_VERSION,
    },
    method,
    inputItemCount: input.length,
    items,
    directionRuns: buildRuns(input),
    directionTurns: buildTurns(input),
    directionSummary: {
      leftCount,
      rightCount,
      leftRatio: leftCount / input.length,
      rightRatio: rightCount / input.length,
      positionsByDirection,
    },
    hueMovement: {
      totalDistance: distances.reduce((total, distance) => total + distance, 0),
      maximumDistance: Math.max(...distances),
      meanDistance: distances.reduce((total, distance) => total + distance, 0) /
        distances.length,
    },
    phraseBoundaryCandidates: [],
    registerContourCandidates: [],
  }
}
