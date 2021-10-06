const getNewPastWithMaxHistoryCheck = (oldPast, newItem, maxHistory) => {
    const truncateMaxHistory = () => {
      // Count up history; truncate any past events if we extend past the maxHistory
      if (oldPast.length === maxHistory) {
        // Truncate past if it exceeds our max history limit
        return oldPast.slice(1)
      }
      return oldPast
    }
  
    return [...truncateMaxHistory(), newItem]
  }
  
  export default getNewPastWithMaxHistoryCheck
  