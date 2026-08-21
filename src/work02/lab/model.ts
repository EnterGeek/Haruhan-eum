import goldenSessions from '../../../docs/golden-sessions/representative-sessions.json'
import type { Direction } from '../../domain/types'
import type { AudioSchedule } from '../audio/types'
import { createAudioSchedule } from '../audio/schedule'
import { validateAudioSchedule } from '../audio/validateSchedule'
import { expandGoldenCase } from '../golden/expandGoldenCase'
import { interpretFlow } from '../interpretation/interpretFlow'
import type { FlowInterpretation, InterpretationMethod } from '../interpretation/types'
import { generateMelody } from '../music/generator'
import type { MelodyOutput } from '../music/types'

export const LAB_FIXTURE_IDS = [
  'same-deck-baseline',
  'all-left-fast-buttons',
  'all-right-same-deck-replay',
  'undo-and-reselect',
  'swipe-only',
  'mixed-button-and-swipe',
  'pause-and-resume',
] as const

export type LabFixtureId = typeof LAB_FIXTURE_IDS[number]

export const LAB_METHODS: readonly InterpretationMethod[] = [
  'absolute-hue',
  'relative-hue',
  'hybrid',
]

export interface LabMethodResult {
  method: InterpretationMethod
  interpretation: FlowInterpretation
  melody: MelodyOutput
  schedule: AudioSchedule
  midiNotes: readonly number[]
  contourPositions: readonly number[]
}

export interface LabFixtureResult {
  caseId: LabFixtureId
  directions: readonly Direction[]
  methods: readonly LabMethodResult[]
}

const isLabFixtureId = (caseId: string): caseId is LabFixtureId =>
  (LAB_FIXTURE_IDS as readonly string[]).includes(caseId)

export function createLabFixtureResult(caseId: string): LabFixtureResult {
  if (!isLabFixtureId(caseId)) {
    throw new RangeError(`Unsupported Work 02 Lab fixture: ${caseId}`)
  }

  const input = expandGoldenCase(goldenSessions, caseId)
  const methods = LAB_METHODS.map((method): LabMethodResult => {
    const interpretation = interpretFlow(input, method)
    const melody = generateMelody(interpretation)
    const schedule = validateAudioSchedule(createAudioSchedule(melody))
    return {
      method,
      interpretation,
      melody,
      schedule,
      midiNotes: melody.events
        .filter((event) => event.kind === 'note')
        .map((event) => event.midiNote),
      contourPositions: interpretation.registerContourCandidates
        .map((candidate) => candidate.normalizedPosition),
    }
  })

  return {
    caseId,
    directions: input.map((item) => item.direction),
    methods,
  }
}
