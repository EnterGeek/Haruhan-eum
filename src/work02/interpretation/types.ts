import type { Direction } from '../../domain/types'
import type { HueRotationDirection } from '../hue'
import type {
  ABSOLUTE_HUE_INTERPRETER_VERSION,
  COMMON_FEATURES_VERSION,
  FLOW_INTERPRETATION_CONTRACT_VERSION,
  HYBRID_HUE_INTERPRETER_VERSION,
  RELATIVE_HUE_INTERPRETER_VERSION,
  WORK02_INPUT_VERSION,
} from '../versions'

export type InterpretationMethod = 'absolute-hue' | 'relative-hue' | 'hybrid'
export type InterpreterVersion =
  | typeof ABSOLUTE_HUE_INTERPRETER_VERSION
  | typeof RELATIVE_HUE_INTERPRETER_VERSION
  | typeof HYBRID_HUE_INTERPRETER_VERSION

export interface AdjacentHueChange {
  fromPresentedOrder: number
  distance: number
  signedDelta: number
  direction: HueRotationDirection
}

export interface FlowItemFeature {
  sequencePosition: number
  presentedOrder: number
  cardId: string
  selectionDirection: Direction
  normalizedHue: number
  normalizedHuePosition: number
  lightness: number
  chroma: number
  adjacentHueChange: AdjacentHueChange | null
}

export interface DirectionRun {
  direction: Direction
  startPresentedOrder: number
  endPresentedOrder: number
  length: number
}

export interface DirectionTurn {
  atPresentedOrder: number
  from: Direction
  to: Direction
}

export interface DirectionSummary {
  leftCount: number
  rightCount: number
  leftRatio: number
  rightRatio: number
  positionsByDirection: Readonly<Record<Direction, readonly number[]>>
}

export interface HueMovementSummary {
  totalDistance: number
  maximumDistance: number
  meanDistance: number
}

export interface PhraseBoundaryCandidate {
  afterPresentedOrder: number
  source: string
}

export interface RegisterContourCandidate {
  presentedOrder: number
  normalizedPosition: number
  source: string
}

export interface CommonFlowInterpretation {
  versions: {
    input: typeof WORK02_INPUT_VERSION
    contract: typeof FLOW_INTERPRETATION_CONTRACT_VERSION
    commonFeatures: typeof COMMON_FEATURES_VERSION
  }
  method: InterpretationMethod
  inputItemCount: number
  items: readonly FlowItemFeature[]
  directionRuns: readonly DirectionRun[]
  directionTurns: readonly DirectionTurn[]
  directionSummary: DirectionSummary
  hueMovement: HueMovementSummary
  phraseBoundaryCandidates: readonly PhraseBoundaryCandidate[]
  registerContourCandidates: readonly RegisterContourCandidate[]
}

export interface FlowInterpretation extends CommonFlowInterpretation {
  versions: CommonFlowInterpretation['versions'] & {
    interpreter: InterpreterVersion
  }
}
