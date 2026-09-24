const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const root = path.join(__dirname, '..', 'Builds', 'web', 'index.html');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#07090c',
    title: 'GARAGE EMPIRE',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  win.loadFile(root);
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
ipcMain.on('garage-quit', () => app.quit());
