export function secondsPerBeat(tempoBpm: number): number {
  if (!Number.isFinite(tempoBpm) || tempoBpm <= 0) {
    throw new RangeError('tempoBpm must be a positive finite number.')
  }
  return 60 / tempoBpm
}

export function beatsToSeconds(beats: number, tempoBpm: number): number {
  if (!Number.isFinite(beats) || beats < 0) {
    throw new RangeError('beats must be a non-negative finite number.')
  }
  return beats * secondsPerBeat(tempoBpm)
}
