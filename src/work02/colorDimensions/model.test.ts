import { describe, expect, it } from 'vitest'
import goldenSessions from '../../../docs/golden-sessions/representative-sessions.json'
import { expandGoldenCase } from '../golden/expandGoldenCase'
import { interpretFlow } from '../interpretation/interpretFlow'
import { generateMelody } from '../music/generator'
import { DEFAULT_MUSIC_GRAMMAR } from '../music/grammar'
import { LAB_FIXTURE_IDS } from '../lab/model'
import {
  DECK_CHROMA_MAXIMUM,
  DECK_CHROMA_MINIMUM,
  LIGHTNESS_HIGH_BOUNDARY,
  LIGHTNESS_LOW_BOUNDARY,
  chromaToNoteLocalPeak,
  createColorDimensionsFixtureResult,
  lightnessToScaleOffset,
  normalizeDeckChroma,
} from './model'

describe('Work 02 color dimensions model', () => {
  it('maps low, middle, and high lightness with fixed deterministic boundaries', () => {
    expect(lightnessToScaleOffset(0)).toBe(-1)
    expect(lightnessToScaleOffset(LIGHTNESS_LOW_BOUNDARY - Number.EPSILON)).toBe(-1)
    expect(lightnessToScaleOffset(LIGHTNESS_LOW_BOUNDARY)).toBe(0)
    expect(lightnessToScaleOffset(LIGHTNESS_HIGH_BOUNDARY - Number.EPSILON)).toBe(0)
    expect(lightnessToScaleOffset(LIGHTNESS_HIGH_BOUNDARY)).toBe(1)
    expect(lightnessToScaleOffset(1)).toBe(1)
  })

  it('maps the Work 01 deck chroma range monotonically to 0.75 through 1.00', () => {
    expect(normalizeDeckChroma(DECK_CHROMA_MINIMUM)).toBe(0)
    expect(normalizeDeckChroma(DECK_CHROMA_MAXIMUM)).toBe(1)
    expect(chromaToNoteLocalPeak(DECK_CHROMA_MINIMUM)).toBe(0.75)
    expect(chromaToNoteLocalPeak(DECK_CHROMA_MAXIMUM)).toBe(1)
    expect(chromaToNoteLocalPeak(0.08)).toBeLessThan(chromaToNoteLocalPeak(0.12))
    expect(chromaToNoteLocalPeak(0.12)).toBeLessThan(chromaToNoteLocalPeak(0.16))
    expect(() => chromaToNoteLocalPeak(Number.NaN)).toThrow(/finite/)
  })

  it.each(LAB_FIXTURE_IDS)('keeps Hue-only exactly equal to current Hybrid for %s', (fixtureId) => {
    const result = createColorDimensionsFixtureResult(fixtureId)
    const hueOnly = result.conditions[0]
    const current = generateMelody(interpretFlow(expandGoldenCase(goldenSessions, fixtureId), 'hybrid'))
    const currentNotes = current.events.filter((event) => event.kind === 'note')
    expect(hueOnly.steps.map((step) => step.finalMidi)).toEqual(currentNotes.map((note) => note.midiNote))
    expect(hueOnly.steps.map((step) => step.noteLocalPeak)).toEqual(Array(12).fill(1))
    expect(hueOnly.steps.map((step) => [step.startSeconds, step.durationSeconds])).toEqual(
      result.conditions[1].steps.map((step) => [step.startSeconds, step.durationSeconds]),
    )
  })

  it.each(LAB_FIXTURE_IDS)('keeps MIDI range and maximum leap for %s', (fixtureId) => {
    const steps = createColorDimensionsFixtureResult(fixtureId).conditions[1].steps
    expect(steps.every((step) => step.finalMidi >= DEFAULT_MUSIC_GRAMMAR.minimumMidi &&
      step.finalMidi <= DEFAULT_MUSIC_GRAMMAR.maximumMidi)).toBe(true)
    expect(steps.slice(1).every((step, index) =>
      Math.abs(step.finalMidi - steps[index].finalMidi) <=
        DEFAULT_MUSIC_GRAMMAR.maximumMelodicLeapSemitones)).toBe(true)
  })

  it('isolates chroma from pitch and lightness from timing', () => {
    const result = createColorDimensionsFixtureResult('same-deck-baseline')
    const dimension = result.conditions[1]
    const cloned = dimension.steps.map((step) => ({ ...step, chroma: DECK_CHROMA_MAXIMUM }))
    expect(cloned.map((step) => step.finalMidi)).toEqual(dimension.steps.map((step) => step.finalMidi))
    expect(dimension.steps.map((step) => [step.startSeconds, step.durationSeconds])).toEqual(
      result.conditions[0].steps.map((step) => [step.startSeconds, step.durationSeconds]),
    )
  })

  it('returns JSON-safe source colors, session metadata, and two equal conditions', () => {
    const result = createColorDimensionsFixtureResult('undo-and-reselect')
    expect(result.sourceColors).toHaveLength(12)
    expect(result.metadata.undoEvents).toHaveLength(3)
    expect(result.conditions).toHaveLength(2)
    expect(JSON.parse(JSON.stringify(result))).toEqual(result)
  })
})
