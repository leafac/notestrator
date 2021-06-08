const { app, BrowserWindow, ipcMain } = require("electron");

let mainWindow;
let menuWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    // transparent: true,
    // frame: false,
  });
  mainWindow.loadFile("index.html");
  menuWindow = new BrowserWindow({
    width: 100,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    // transparent: true,
    // frame: false,
  });
  menuWindow.loadFile("menu.html");
}

ipcMain.on("color", (_, color) => {
  mainWindow.webContents.send("color", color);
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {});
