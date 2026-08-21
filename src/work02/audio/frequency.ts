const MINIMUM_MIDI_NOTE = 0
const MAXIMUM_MIDI_NOTE = 127

export class MidiNoteFrequencyValidationError extends Error {
  constructor(message: string) {
    super(`Invalid MIDI note for frequency conversion: ${message}`)
    this.name = 'MidiNoteFrequencyValidationError'
  }
}

/** Converts a standard MIDI note number to its 12-TET frequency in hertz. */
export function midiNoteToFrequencyHz(midiNote: number): number {
  if (!Number.isFinite(midiNote) || !Number.isInteger(midiNote)) {
    throw new MidiNoteFrequencyValidationError('midiNote must be a finite integer.')
  }
  if (midiNote < MINIMUM_MIDI_NOTE || midiNote > MAXIMUM_MIDI_NOTE) {
    throw new MidiNoteFrequencyValidationError('midiNote must be in the range 0..127.')
  }
  return 440 * 2 ** ((midiNote - 69) / 12)
}
