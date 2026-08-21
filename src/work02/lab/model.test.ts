import { describe, expect, it } from 'vitest'
import goldenSessions from '../../../docs/golden-sessions/representative-sessions.json'
import { validateAudioSchedule } from '../audio/validateSchedule'
import { LAB_FIXTURE_IDS, LAB_METHODS, createLabFixtureResult } from './model'

describe('Work 02 A/B/C Lab model', () => {
  it('supports exactly the seven approved fixture IDs and fixed A/B/C order', () => {
    expect(LAB_FIXTURE_IDS).toHaveLength(7)
    expect(LAB_METHODS).toEqual(['absolute-hue', 'relative-hue', 'hybrid'])
    LAB_FIXTURE_IDS.forEach((caseId) => {
      expect(createLabFixtureResult(caseId).methods.map(({ method }) => method))
        .toEqual(LAB_METHODS)
    })
  })

  it('rejects unsupported fixture IDs', () => {
    expect(() => createLabFixtureResult('not-a-fixture')).toThrow(RangeError)
  })

  it('validates all 21 schedules with 12 MIDI and contour values at nine seconds', () => {
    const results = LAB_FIXTURE_IDS.flatMap((caseId) =>
      createLabFixtureResult(caseId).methods)
    expect(results).toHaveLength(21)
    results.forEach((result) => {
      expect(validateAudioSchedule(result.schedule)).toBe(result.schedule)
      expect(result.midiNotes).toHaveLength(12)
      expect(result.contourPositions).toHaveLength(12)
      expect(result.schedule.totalDurationSeconds).toBe(9)
    })
  })

  it('uses one identical playback profile for A/B/C', () => {
    LAB_FIXTURE_IDS.forEach((caseId) => {
      const profiles = createLabFixtureResult(caseId).methods.map(({ schedule }) =>
        schedule.profile)
      expect(profiles[1]).toEqual(profiles[0])
      expect(profiles[2]).toEqual(profiles[0])
    })
  })

  it('is deterministic, JSON serializable, and does not mutate the fixture collection', () => {
    const fixtureBefore = structuredClone(goldenSessions)
    const first = createLabFixtureResult('same-deck-baseline')
    const second = createLabFixtureResult('same-deck-baseline')
    expect(second).toEqual(first)
    expect(() => JSON.stringify(first)).not.toThrow()
    expect(goldenSessions).toEqual(fixtureBefore)
  })
})
