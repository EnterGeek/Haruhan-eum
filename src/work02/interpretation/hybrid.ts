import type { Work02Input } from '../types'
import { HYBRID_HUE_INTERPRETER_VERSION } from '../versions'
import { extractCommonFlowFeatures } from './common'
import {
  buildContourCandidates,
  calculateHybridHuePositions,
} from './contour'
import type { FlowInterpretation } from './types'

export function interpretHybridHue(input: Work02Input): FlowInterpretation {
  const method = 'hybrid'
  const common = extractCommonFlowFeatures(input, method)
  return {
    ...common,
    versions: {
      ...common.versions,
      interpreter: HYBRID_HUE_INTERPRETER_VERSION,
    },
    registerContourCandidates: buildContourCandidates(
      input,
      calculateHybridHuePositions(input),
      method,
      HYBRID_HUE_INTERPRETER_VERSION,
    ),
  }
}
