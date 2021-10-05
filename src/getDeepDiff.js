const diff = require('deep-diff').diff

const getDeepDiff = (present, newPresent, options) => {
  if (Array.isArray(newPresent)) {
    return diff(
      {
        WRAPKEY: present
      },
      {
        WRAPKEY: newPresent
      },
      options.excludeRegexPaths
    )
  } else if (typeof newPresent === 'object') {
    return diff(present, newPresent, options.excludeRegexPaths)
  }
}

export default getDeepDiff
