import goldenSessions from '../../../docs/golden-sessions/representative-sessions.json'
import type { Direction } from '../../domain/types'
import { createAudioSchedule } from '../audio/schedule'
import type { AudioSchedule, ScheduledAudioNote } from '../audio/types'
import { midiNoteToFrequencyHz } from '../audio/frequency'
import { expandGoldenCase } from '../golden/expandGoldenCase'
import { interpretFlow } from '../interpretation/interpretFlow'
import { buildScaleNotes, selectLeapLimitedNote } from '../music/generator'
import { DEFAULT_MUSIC_GRAMMAR } from '../music/grammar'
import { generateMelody } from '../music/generator'
import { LAB_FIXTURE_IDS, type LabFixtureId } from '../lab/model'

export const LIGHTNESS_LOW_BOUNDARY = 1 / 3
export const LIGHTNESS_HIGH_BOUNDARY = 2 / 3
export const DECK_CHROMA_MINIMUM = 0.07
export const DECK_CHROMA_MAXIMUM = 0.17
export const NOTE_LOCAL_PEAK_MINIMUM = 0.75
export const NOTE_LOCAL_PEAK_MAXIMUM = 1

export type ColorDimensionCondition = 'hue-only' | 'hue-lightness-chroma'
export type CommitInput = 'button' | 'swipe'

export interface SourceColorStep {
  order: number
  hex: string
  hue: number
  lightness: number
  chroma: number
  direction: Direction
  commitInput: CommitInput
}

export interface ColorDimensionStep extends SourceColorStep {
  baseHybridContour: number
  lightnessOffset: -1 | 0 | 1
  baseMidi: number
  finalMidi: number
  chromaNormalized: number
  noteLocalPeak: number
  startSeconds: number
  durationSeconds: number
}

export interface ColorDimensionsLabSchedule extends AudioSchedule {
  readonly labExtension: {
    readonly kind: 'work02-color-dimensions-lab-v0'
    readonly noteLocalPeaks: readonly number[]
  }
}

export interface ColorDimensionConditionResult {
  condition: ColorDimensionCondition
  label: string
  steps: readonly ColorDimensionStep[]
  schedule: ColorDimensionsLabSchedule
}

export interface FixtureMetadata {
  directions: string
  commitInputSequence: string
  undoEvents: readonly (readonly [number, string])[]
  elapsedSeconds: number
}

export interface ColorDimensionsFixtureResult {
  fixtureId: LabFixtureId
  sourceColors: readonly SourceColorStep[]
  metadata: FixtureMetadata
  conditions: readonly [ColorDimensionConditionResult, ColorDimensionConditionResult]
}

type JsonObject = Record<string, unknown>
const collection = goldenSessions as unknown as JsonObject

export function lightnessToScaleOffset(lightness: number): -1 | 0 | 1 {
  if (!Number.isFinite(lightness) || lightness < 0 || lightness > 1) {
    throw new RangeError('lightness must be a finite number in [0, 1].')
  }
  if (lightness < LIGHTNESS_LOW_BOUNDARY) return -1
  if (lightness < LIGHTNESS_HIGH_BOUNDARY) return 0
  return 1
}

export function normalizeDeckChroma(chroma: number): number {
  if (!Number.isFinite(chroma)) throw new RangeError('chroma must be finite.')
  return Math.min(1, Math.max(0,
    (chroma - DECK_CHROMA_MINIMUM) / (DECK_CHROMA_MAXIMUM - DECK_CHROMA_MINIMUM),
  ))
}

export function chromaToNoteLocalPeak(chroma: number): number {
  const normalized = normalizeDeckChroma(chroma)
  return NOTE_LOCAL_PEAK_MINIMUM +
    normalized * (NOTE_LOCAL_PEAK_MAXIMUM - NOTE_LOCAL_PEAK_MINIMUM)
}

const fixtureRecord = (fixtureId: LabFixtureId): JsonObject => {
  const cases = collection.cases as unknown[]
  const result = cases.find((item) => (item as JsonObject).id === fixtureId)
  if (!result) throw new RangeError(`Missing golden fixture: ${fixtureId}`)
  return result as JsonObject
}

const sourceColorsFor = (fixtureId: LabFixtureId): readonly SourceColorStep[] => {
  const record = fixtureRecord(fixtureId)
  const deckSeed = record.deckSeed as string
  const deck = (collection.decks as JsonObject)[deckSeed] as [string, number, number, number][]
  const directions = record.directions as string
  const commitInputs = record.commitInputs as string
  const finalCommitByOrder = new Map<number, string>()
  ;(record.commitOrders as number[]).forEach((order, index) => {
    finalCommitByOrder.set(order, commitInputs[index])
  })
  return deck.map(([hex, hue, lightness, chroma], index) => ({
    order: index + 1,
    hex,
    hue,
    lightness,
    chroma,
    direction: directions[index] === 'L' ? 'left' : 'right',
    commitInput: finalCommitByOrder.get(index + 1) === 'S' ? 'swipe' : 'button',
  }))
}

const createLabSchedule = (
  schedule: AudioSchedule,
  notes: readonly ScheduledAudioNote[],
  peaks: readonly number[],
): ColorDimensionsLabSchedule => ({
  ...schedule,
  notes,
  labExtension: {
    kind: 'work02-color-dimensions-lab-v0',
    noteLocalPeaks: peaks,
  },
})

export function noteLocalPeakForLabSchedule(
  schedule: AudioSchedule,
  note: ScheduledAudioNote,
): number {
  const extension = (schedule as Partial<ColorDimensionsLabSchedule>).labExtension
  if (extension?.kind !== 'work02-color-dimensions-lab-v0') return 1
  return extension.noteLocalPeaks[note.noteIndex] ?? 1
}

export function createColorDimensionsFixtureResult(
  fixtureId: LabFixtureId,
): ColorDimensionsFixtureResult {
  if (!(LAB_FIXTURE_IDS as readonly string[]).includes(fixtureId)) {
    throw new RangeError(`Unsupported Work 02 color-dimensions fixture: ${fixtureId}`)
  }
  const input = expandGoldenCase(goldenSessions, fixtureId)
  const interpretation = interpretFlow(input, 'hybrid')
  const baseMelody = generateMelody(interpretation)
  const baseSchedule = createAudioSchedule(baseMelody)
  const sourceColors = sourceColorsFor(fixtureId)
  const baseNotes = baseMelody.events.filter((event) => event.kind === 'note')
  const scaleNotes = buildScaleNotes(DEFAULT_MUSIC_GRAMMAR)
  let previousFinalMidi: number | null = null

  const enrichedSteps = sourceColors.map((source, index): ColorDimensionStep => {
    const baseNote = baseNotes[index]
    const scheduled = baseSchedule.notes[index]
    const offset = lightnessToScaleOffset(source.lightness)
    const baseScaleIndex = scaleNotes.indexOf(baseNote.midiNote)
    const shiftedIndex = Math.min(scaleNotes.length - 1, Math.max(0, baseScaleIndex + offset))
    const finalMidi = selectLeapLimitedNote(
      scaleNotes,
      scaleNotes[shiftedIndex],
      previousFinalMidi,
      DEFAULT_MUSIC_GRAMMAR.maximumMelodicLeapSemitones,
    )
    previousFinalMidi = finalMidi
    return {
      ...source,
      baseHybridContour: interpretation.registerContourCandidates[index].normalizedPosition,
      lightnessOffset: offset,
      baseMidi: baseNote.midiNote,
      finalMidi,
      chromaNormalized: normalizeDeckChroma(source.chroma),
      noteLocalPeak: chromaToNoteLocalPeak(source.chroma),
      startSeconds: scheduled.startSeconds,
      durationSeconds: scheduled.durationSeconds,
    }
  })

  const hueOnlySteps = enrichedSteps.map((step): ColorDimensionStep => ({
    ...step,
    lightnessOffset: 0,
    finalMidi: step.baseMidi,
    noteLocalPeak: 1,
  }))
  const dimensionNotes = baseSchedule.notes.map((note, index) => ({
    ...note,
    midiNote: enrichedSteps[index].finalMidi,
    frequencyHz: midiNoteToFrequencyHz(enrichedSteps[index].finalMidi),
  }))
  const record = fixtureRecord(fixtureId)
  return {
    fixtureId,
    sourceColors,
    metadata: {
      directions: record.directions as string,
      commitInputSequence: record.commitInputs as string,
      undoEvents: record.undoEvents as (readonly [number, string])[],
      elapsedSeconds: (Date.parse(record.completedAt as string) -
        Date.parse(record.startedAt as string)) / 1000,
    },
    conditions: [
      {
        condition: 'hue-only',
        label: 'A · Hybrid / Hue only',
        steps: hueOnlySteps,
        schedule: createLabSchedule(baseSchedule, baseSchedule.notes, hueOnlySteps.map(() => 1)),
      },
      {
        condition: 'hue-lightness-chroma',
        label: 'B · Hybrid / Hue + L + C',
        steps: enrichedSteps,
        schedule: createLabSchedule(
          baseSchedule,
          dimensionNotes,
          enrichedSteps.map((step) => step.noteLocalPeak),
        ),
      },
    ],
  }
}
