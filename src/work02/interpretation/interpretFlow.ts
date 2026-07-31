import type { Work02Input } from '../types'
import { interpretAbsoluteHue } from './absolute'
import { interpretHybridHue } from './hybrid'
import { interpretRelativeHue } from './relative'
import type { FlowInterpretation, InterpretationMethod } from './types'

const unsupportedMethod = (method: never): never => {
  throw new RangeError(`Unsupported interpretation method: ${String(method)}`)
}

export function interpretFlow(
  input: Work02Input,
  method: InterpretationMethod,
): FlowInterpretation {
  switch (method) {
    case 'absolute-hue':
      return interpretAbsoluteHue(input)
    case 'relative-hue':
      return interpretRelativeHue(input)
    case 'hybrid':
      return interpretHybridHue(input)
    default:
      return unsupportedMethod(method)
  }
}
