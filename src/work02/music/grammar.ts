import { MUSIC_GRAMMAR_VERSION } from '../versions'
import type { MusicGrammar, MusicGrammarSnapshot } from './types'

export const DEFAULT_MUSIC_GRAMMAR: MusicGrammar = Object.freeze({
  version: MUSIC_GRAMMAR_VERSION,
  scale: Object.freeze({
    name: 'major pentatonic',
    semitoneOffsets: Object.freeze([0, 2, 4, 7, 9]),
  }),
  tonicMidi: 60,
  minimumMidi: 60,
  maximumMidi: 76,
  tempoBpm: 80,
  totalBeats: 12,
  allowedDurationsBeats: Object.freeze([0.5, 1, 1.5, 2]),
  maximumMelodicLeapSemitones: 7,
  targetDurationSeconds: Object.freeze({
    minimum: 8,
    maximum: 15,
  }),
  restsAllowed: true,
})

export function createMusicGrammarSnapshot(
  grammar: MusicGrammar = DEFAULT_MUSIC_GRAMMAR,
): MusicGrammarSnapshot {
  return Object.freeze({
    version: grammar.version,
    scale: Object.freeze({
      name: grammar.scale.name,
      semitoneOffsets: Object.freeze([...grammar.scale.semitoneOffsets]),
    }),
    tonicMidi: grammar.tonicMidi,
    minimumMidi: grammar.minimumMidi,
    maximumMidi: grammar.maximumMidi,
    tempoBpm: grammar.tempoBpm,
    totalBeats: grammar.totalBeats,
    allowedDurationsBeats: Object.freeze([...grammar.allowedDurationsBeats]),
    maximumMelodicLeapSemitones: grammar.maximumMelodicLeapSemitones,
    targetDurationSeconds: Object.freeze({
      minimum: grammar.targetDurationSeconds.minimum,
      maximum: grammar.targetDurationSeconds.maximum,
    }),
    restsAllowed: grammar.restsAllowed,
  })
}
