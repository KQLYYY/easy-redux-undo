import getDeepDiff from './getDeepDiff'

const getDeepDiffItem = (present, newPresent, options, action) =>
  getItemWithDiff(getDeepDiff(present, newPresent, options), action)

const getItemWithDiff = (lib, action) => ({
  lib,
  dev: {
    ts: Date.now(),
    ...action.historyPayload
  }
})

export default getDeepDiffItem
