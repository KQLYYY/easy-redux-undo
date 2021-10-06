import getDeepDiff from './getDeepDiff'

const getDeepDiffItem = (present, newPresent, options, devProps) => ({
  lib: getDeepDiff(present, newPresent, options),
  dev: {
    ts: Date.now(),
    ...devProps
  }
})

export default getDeepDiffItem
