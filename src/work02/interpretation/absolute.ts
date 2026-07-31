import type { Work02Input } from '../types'
import { ABSOLUTE_HUE_INTERPRETER_VERSION } from '../versions'
import { extractCommonFlowFeatures } from './common'
import {
  buildContourCandidates,
  calculateAbsoluteHuePositions,
} from './contour'
import type { FlowInterpretation } from './types'

export function interpretAbsoluteHue(input: Work02Input): FlowInterpretation {
  const method = 'absolute-hue'
  const common = extractCommonFlowFeatures(input, method)
  return {
    ...common,
    versions: {
      ...common.versions,
      interpreter: ABSOLUTE_HUE_INTERPRETER_VERSION,
    },
    registerContourCandidates: buildContourCandidates(
      input,
      calculateAbsoluteHuePositions(input),
      method,
      ABSOLUTE_HUE_INTERPRETER_VERSION,
    ),
  }
}
