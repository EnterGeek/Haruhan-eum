import type { Work02Input } from '../types'
import { RELATIVE_HUE_INTERPRETER_VERSION } from '../versions'
import { extractCommonFlowFeatures } from './common'
import {
  buildContourCandidates,
  calculateRelativeHuePositions,
} from './contour'
import type { FlowInterpretation } from './types'

export function interpretRelativeHue(input: Work02Input): FlowInterpretation {
  const method = 'relative-hue'
  const common = extractCommonFlowFeatures(input, method)
  return {
    ...common,
    versions: {
      ...common.versions,
      interpreter: RELATIVE_HUE_INTERPRETER_VERSION,
    },
    registerContourCandidates: buildContourCandidates(
      input,
      calculateRelativeHuePositions(input),
      method,
      RELATIVE_HUE_INTERPRETER_VERSION,
    ),
  }
}
