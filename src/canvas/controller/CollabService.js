import Logger from '../../core/Logger'
import * as CollabUtil from './CollabUtil'
import { v4 as uuidv4 } from 'uuid';
import {mergeDeep} from './MergeUtil'
export default class CollabService {

    constructor(appId){
      Logger.log(2, 'CollabService()', appId)
      this.events = []
      this.appId = appId
    }

    reset () {
      this.events = []
    }

    createEvent (changes) {
      Logger.log(1, 'CollabService.createEvent()')
      let minichanges = CollabUtil.getMiniChanges(changes)
      let event = {
        id:uuidv4(),
        appId: this.appId,
        ts: new Date().getTime(),
        changes: minichanges
      }
      this.pushEvent(event)
      return event
    }

    applyEvent (model, event) {
      Logger.log(1, 'CollabService.applyEvent() > enter')
      /**
       * Should we clone???
       */

      if (model.id !== event.appId) {
        Logger.warn('CollabService.applyEvent() > wrong app')
        return model
      }

      /**
       * Should not happen, because of WebSocket, anyhow we check to ensure we do not merge
       * in useless changes
       */
      if (this.events.find(e => e.id === event.id) !== undefined) {
        Logger.log(-1,'CollabService.applyEvent() > Event ignored, because it was already added')
        return model
      }

      let changes = event.changes
      changes.forEach(change => {
        if (change.parent) {
          this.applyInParent(model, change)
        } else {
          this.applyInRoot(model, change)
        }
      })

      this.pushEvent(event)


      return model
    }

    applyInRoot( model, change) {
      if (change.type === 'add') {
        Logger.log(1, 'CollabService.applyInRoot() >  add', change)
        model[change.id] = change.value
      }

      /**
       * In case of root updates we send the entire value!
       */
      if (change.type === 'update') {
        Logger.log(1, 'CollabService.applyInRoot() >  update', change)
        model[change.id] = change.value
      }

      if (change.type === 'delete') {
        Logger.log(2, 'CollabService.applyInRoot() >  delete', change)
        if (model[change.id]) {
          delete model[change.id]
        }
      }
    }

    applyInParent(model, change) {
      let parent = model[change.parent]
      if (change.type === 'add') {
        Logger.log(1, 'CollabService.applyInParent() >  add', change)
        if (!parent[change.id]) {
          parent[change.id] = change.value
        } else {
          Logger.log(-1, 'CollabService.applyInParent() >  Object already present', change)
        }
      }

      if (change.type === 'update') {
        Logger.log(1, 'CollabService.applyInParent() >  update', change)
        if (parent[change.id]) {
          // FIXME: we should have here something like deep merge.
          let oldValue =parent[change.id]
          let newValue = mergeDeep(oldValue, change.value)
          parent[change.id] = newValue
          //parent[change.id] = change.value
        } else {
          Logger.log(-1, 'CollabService.applyInParent() >  No object to update', change)
        }
      }

      if (change.type === 'delete') {
        Logger.log(2, 'CollabService.applyInParent() >  delete', change)
        if (parent[change.id]) {
          delete parent[change.id]
        }
      }
    }

    pushEvent(event) {
      if (this.events.length > 50) {
        this.events.shift()
      }
      this.events.push(event)
    }

}