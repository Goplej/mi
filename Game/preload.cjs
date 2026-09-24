const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('garageEmpire', {
  quit() {
    ipcRenderer.send('garage-quit');
  },
});
