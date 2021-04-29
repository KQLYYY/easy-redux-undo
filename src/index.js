import {
  createAction
} from "@reduxjs/toolkit";
import { now } from "lodash";
const _ = require("lodash");
const diff = require("deep-diff").diff;

const WRAPKEY = '__wrapper'
const DEBUGPREPEND = '[easy-redux-undo]=>'
const LIBRARYPREFIX = '@@easy-redux-undo/'
const UNDOACTION = `${LIBRARYPREFIX}UNDO`
const REDOACTION = `${LIBRARYPREFIX}REDO`
const CLEARACTION = `${LIBRARYPREFIX}CLEAR`
const GROUPBEGINACTION = `${LIBRARYPREFIX}GROUPBEGIN`
const GROUPENDACTION = `${LIBRARYPREFIX}GROUPEND`
const UNDO = createAction(UNDOACTION)
const REDO = createAction(REDOACTION)
const CLEAR = createAction(CLEARACTION)
const GROUPBEGIN = createAction(GROUPBEGINACTION)
const GROUPEND = createAction(GROUPENDACTION)

const defaultOptions = {
  maxHistory: 100,
  undoType: UNDOACTION,
  redoType: REDOACTION,
  clearType: CLEARACTION,
  groupBeginType: GROUPBEGINACTION,
  groupEndType: GROUPENDACTION,
  include: [],
  exclude: []
}

const undoable = function(reducer, options = {}) {
  options = Object.assign(defaultOptions, options)

  if (options.include.length > 0 && options.exclude.length > 0) {
    console.error(
      `${DEBUGPREPEND} cannot have both a 'include' and 'exclude' property, choose one or the other!`
    )
    return
  }

  /** @description Undos an action in the store, or a group of actions if undo encounters a group
   * @returns {object} An object of the updated state in the store
   * @param {object} past
   * @param {object} present
   * @param {object} future
   * @param {object} updPast The previous past from a prior undo call, if calling undo for the first time, this value should be undefined
   * @param {object} updPresent The previous present from a prior undo call, if calling undo for the first time, this value should be undefined
   * @param {object} updFuture The previous future from a prior undo call, if calling undo for the first time, this value should be undefined
   */
  const undo = function(
    past,
    present,
    future,
    updPast = undefined,
    updPresent = undefined,
    updFuture = undefined
  ) {
    let groupEndTypePayload = {}
    let newPast = updPast || past
    let newPresent
    let newFuture = updFuture || future
    let undoingGroup = false

    let endIndex = newPast.length - 1
    let changesToApply = newPast[endIndex]

    // If we are undoing a group,
    // grab all actions in that group
    if (getLibData(changesToApply) === options.groupEndType) {
      groupEndTypePayload = getDevData(changesToApply)
      let startIndex = endIndex - 1

      // Find the matching group begin action
      for (startIndex; startIndex >= 0; startIndex--) {
        if (getLibData(newPast[startIndex]) === options.groupBeginType) break
      }

      // Throw if didn't find closed group
      if (startIndex === 0 && getLibData(newPast[startIndex]) !== options.groupBeginType) {
        throw `${DEBUGPREPEND} did not find a closed group of actions to undo, did you forget to send a '${options.groupBeginType}' action?`
      }

      // Store all changes as part of this group to undo
      changesToApply = []
      for (let i = endIndex - 1; i >= startIndex + 1; i--) {
        changesToApply.push(newPast[i])
      }

      // Update the endIndex variable so we can make use of
      // it outside of this 'if' statement
      endIndex = startIndex

      undoingGroup = true
    }

    // Store the new past after we undo the given action/s
    newPast = newPast.slice(0, endIndex)

    // Need to deep clone here because otherwise the
    // 'diff' function below complains because we can't edit
    // the redux store values directly
    newPresent = updPresent || _.cloneDeep(present)

    // Need to wrap present in object if state is
    // an array, because deep-diff can't handle
    // comparisons of arrays
    if (Array.isArray(newPresent)) {
      newPresent[`${WRAPKEY}`] = newPresent
    }

    // Revert the changes applied to the state
    if (undoingGroup) {
      for (let j = 0; j < changesToApply.length; j++) {
        for (let k = 0; k < getLibData(changesToApply[j]).length; k++) {
          diff.revertChange(newPresent, true, getLibData(changesToApply[j])[k])
        }
      }
    } else {
      for (let i = 0; i < getLibData(changesToApply).length; i++) {
        diff.revertChange(newPresent, true, getLibData(changesToApply)[i])
      }
    }

    // Unwrap array if state is an array
    newPresent = Array.isArray(newPresent) ? newPresent[`${WRAPKEY}`] : newPresent

    // Update the future array
    if (undoingGroup) {
      newFuture = [
        { lib: options.groupEndType, dev: groupEndTypePayload },
        ...changesToApply,
        { lib: options.groupBeginType },
        ...newFuture
      ]
    } else {
      newFuture = [changesToApply, ...newFuture]
    }

    return {
      past: newPast,
      present: newPresent,
      future: newFuture
    }
  }

  /** @description Redos an action in the store, or a group of actions if redo encounters a group
   * @returns {object} An object of the updated state in the store
   * @param {object} past
   * @param {object} present
   * @param {object} future
   * @param {object} updPast The previous past from a prior redo call, if calling redo for the first time, this value should be undefined
   * @param {object} updPresent The previous present from a prior redo call, if calling redo for the first time, this value should be undefined
   * @param {object} updFuture The previous future from a prior redo call, if calling redo for the first time, this value should be undefined
   */
  const redo = function(
    past,
    present,
    future,
    updPast = undefined,
    updPresent = undefined,
    updFuture = undefined
  ) {
    let groupEndTypePayload = {}
    let newPast = updPast || past
    let newPresent
    let newFuture = updFuture || future
    let redoingGroup = false

    let startIndex = 1
    let changesToApply = newFuture[startIndex - 1]

    // If we are undoing a group,
    // grab all actions in that group
    if (getLibData(changesToApply) === options.groupEndType) {
      groupEndTypePayload = getDevData(changesToApply)
      let endIndex = startIndex
      // Find the matching group begin action
      for (endIndex; endIndex <= newFuture.length; endIndex++) {
        if (getLibData(newFuture[endIndex]) === options.groupBeginType) break
      }

      // Throw if didn't find closed group
      if (
        endIndex === newFuture.length - 1 &&
        getLibData(newFuture[endIndex]) !== options.groupBeginType
      ) {
        throw `${DEBUGPREPEND} did not find a closed group of actions to redo, something must have went wrong!`
      }

      // Store all changes as part of this group to undo
      changesToApply = []
      for (let i = endIndex - 1; i >= startIndex; i--) {
        changesToApply.push(newFuture[i])
      }

      // Update the startIndex variable so we can make use of
      // it outside of this 'if' statement
      startIndex = endIndex + 1

      redoingGroup = true
    }

    // Update future array
    newFuture = newFuture.slice(startIndex)

    // Need to deep clone here because otherwise the
    // 'diff' function below complains because we can't edit
    // the redux store values directly
    newPresent = updPresent || _.cloneDeep(present)

    // Need to wrap present in object if state is
    // an array, because deep-diff can't handle
    // comparisons of arrays
    if (Array.isArray(newPresent)) {
      newPresent[`${WRAPKEY}`] = newPresent
    }

    // Revert the changes applied to the state
    if (redoingGroup) {
      for (let j = 0; j < changesToApply.length; j++) {
        for (let k = 0; k < getLibData(changesToApply[j]).length; k++) {
          diff.applyChange(newPresent, true, getLibData(changesToApply[j])[k])
        }
      }
    } else {
      for (let i = 0; i < getLibData(changesToApply).length; i++) {
        diff.applyChange(newPresent, true, getLibData(changesToApply)[i])
      }
    }

    // Unwrap array if state is an array
    newPresent = Array.isArray(newPresent) ? newPresent[`${WRAPKEY}`] : newPresent

    // Update the past array
    if (redoingGroup) {
      newPast = [
        ...newPast,
        { lib: options.groupBeginType },
        ...changesToApply,
        { lib: options.groupEndType, dev: groupEndTypePayload }
      ]
    } else {
      newPast = [...newPast, changesToApply]
    }

    return {
      past: newPast,
      present: newPresent,
      future: newFuture
    }
  }

  const getLibData = (obj) => obj.lib
  const getDevData = (obj) => obj.dev

  // return a reducer that handles undo and redo
  return function(state = {}, action) {
    const { past, present, future } = state

    // If we are calling this reducer for the first time,
    // present will not have a value and we should return
    // a default value
    if (typeof present === 'undefined') {
      return {
        past: [],
        present: reducer(undefined, {}),
        future: []
      }
    }

    // We can pass a number for the number of undo/redos to do;
    // parse this value out here
    const actionCount =
      typeof action.payload === 'number' && action.payload > 0 ? action.payload : 1

    switch (action.type) {
      case options.groupBeginType: {
        return {
          past: [...past, { lib: options.groupBeginType, dev: options.groupBeginType }],
          present,
          future
        }
      }
      case options.groupEndType: {
        if (past[past.length - 1] === options.groupBeginType) {
          console.warn(
            `${DEBUGPREPEND} did not add '${options.groupEndType}' action; detected that the previous action was '${options.groupBeginType}' - this would result in an empty group!`
          )
          break
        } else {
          const textContent = action.payload || 'empty payload'
          const newPast = [...past, { lib: options.groupEndType, dev: textContent }]
          const newState = {
            past: newPast,
            present,
            future
          }
          return newState
        }
      }
      case options.clearType: {
        return {
          past: [],
          present,
          future: []
        }
      }
      case options.undoType: {
        if (past.length === 0) {
          return {
            past,
            present,
            future
          }
        }
        let undoResult = {}
        for (let i = 1; i <= actionCount; i++) {
          undoResult = undo(
            past,
            present,
            future,
            undoResult.past,
            undoResult.present,
            undoResult.future
          )

          if (undoResult.past.length === 0) break
        }
        return undoResult
      }
      case options.redoType: {
        if (future.length === 0) {
          return {
            past,
            present,
            future
          }
        }

        let redoResult = {}
        for (let i = 1; i <= actionCount; i++) {
          redoResult = redo(
            past,
            present,
            future,
            redoResult.past,
            redoResult.present,
            redoResult.future
          )

          if (redoResult.past.length === 0) break
        }
        return redoResult
      }
      default: {
        const newPresent = reducer(present, action)
        let actionDiff

        // If state is an array, deep-diff can't handle
        // comparing arrays, so we wrap the array in an object
        if (Array.isArray(newPresent)) {
          actionDiff = diff(
            {
              WRAPKEY: present
            },
            {
              WRAPKEY: newPresent
            }
          )
        } else if (typeof newPresent === 'object') {
          actionDiff = diff(present, newPresent)
        }

        // If the action did not alter the state,
        // return the initial state
        if (typeof actionDiff === 'undefined') {
          return state
        }

        let totalHistory = 0
        let inGroup = false
        const historyPayloadWithTs = {
          ts: Date.now(),
          ...action.historyPayload
        }
        let newPast = [{ lib: actionDiff, dev: historyPayloadWithTs }]
        let data = { lib: actionDiff, dev: historyPayloadWithTs }
        // let newPastStory = [action.type]

        // If we have a group that hasn't closed, don't count it's
        // elements in the total history
        for (let i = past.length - 1; i >= 0; i--) {
          if (getLibData(past[i]) === options.groupEndType) break
          if (getLibData(past[i]) === options.groupBeginType) {
            inGroup = true
            break
          }
        }

        // If we are including/excluding any actions; short-circuit if possible
        if (
          !inGroup &&
          ((options.include.length > 0 &&
            !options.include.includes(action.type.slice(action.type.indexOf('/')))) ||
            (options.exclude.length > 0 && options.exclude.includes(action.type)))
        ) {
          return {
            past,
            present: newPresent,
            future: future
          }
        }

        // Count up history; truncate any past events if we extend past the maxHistory
        for (let i = past.length - 1; i >= 0; i--) {
          if (getLibData(past[i]) === options.groupEndType) {
            totalHistory = totalHistory + 1
            inGroup = true
          } else if (getLibData(past[i]) === options.groupBeginType) {
            inGroup = false
          } else if (!inGroup) totalHistory = totalHistory + 1

          // Truncate past if it exceeds our max history limit
          if (totalHistory >= options.maxHistory - 1 || i === 0) {
            // if our index is on a groupend action,
            // update it to pull the entire group
            if (getLibData(past[i]) === options.groupEndType) {
              let j = i
              for (j; j >= 0; j--) {
                if (getLibData(past[j]) === options.groupBeginType) {
                  break
                }
              }
              newPast = [...past.slice(j), data]
            } else {
              newPast = [...past.slice(i), data]
            }

            break
          }
        }

        return {
          past: newPast,
          present: newPresent,
          future: []
        }
      }
    }
  }
}

export { UNDO, REDO, CLEAR, GROUPBEGIN, GROUPEND }
export default undoable
