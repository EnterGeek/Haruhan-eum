import type { Direction } from '../../domain/types'
import type { InterpretationMethod, InterpreterVersion } from '../interpretation/types'
import type {
  MELODY_GENERATOR_VERSION,
  FLOW_INTERPRETATION_CONTRACT_VERSION,
  MELODY_OUTPUT_CONTRACT_VERSION,
  MUSIC_GRAMMAR_VERSION,
} from '../versions'

export interface MusicScale {
  name: string
  semitoneOffsets: readonly number[]
}

export interface TargetDurationSeconds {
  minimum: number
  maximum: number
}

export interface MusicGrammar {
  version: typeof MUSIC_GRAMMAR_VERSION
  scale: MusicScale
  tonicMidi: number
  minimumMidi: number
  maximumMidi: number
  tempoBpm: number
  totalBeats: number
  allowedDurationsBeats: readonly number[]
  maximumMelodicLeapSemitones: number
  targetDurationSeconds: TargetDurationSeconds
  restsAllowed: boolean
}

export type MusicGrammarSnapshot = MusicGrammar

export interface MelodyEventSource {
  presentedOrders: readonly number[]
  selectionDirections: readonly Direction[]
  contourPositions: readonly number[]
}

interface MelodyEventBase {
  eventIndex: number
  startBeat: number
  durationBeats: number
  source: MelodyEventSource
}

export interface MelodyNoteEvent extends MelodyEventBase {
  kind: 'note'
  midiNote: number
}

export interface MelodyRestEvent extends MelodyEventBase {
  kind: 'rest'
}

export type MelodyEvent = MelodyNoteEvent | MelodyRestEvent

export interface MelodyOutput {
  versions: {
    outputContract: typeof MELODY_OUTPUT_CONTRACT_VERSION
    grammar: typeof MUSIC_GRAMMAR_VERSION
    interpretationContract: typeof FLOW_INTERPRETATION_CONTRACT_VERSION
      interpreter: InterpreterVersion
    generator: typeof MELODY_GENERATOR_VERSION
  }
  method: InterpretationMethod
  grammar: MusicGrammarSnapshot
  totalBeats: number
  events: readonly MelodyEvent[]
}
