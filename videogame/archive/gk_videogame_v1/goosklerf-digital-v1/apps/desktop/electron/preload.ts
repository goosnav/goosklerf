import { contextBridge } from 'electron'

contextBridge.exposeInMainWorld('gkApi', {
  version: '0.1.0',
})
