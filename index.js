const { app, BrowserWindow, ipcMain, screen } = require("electron");

let mainWindow;
let menuWindow;
function createWindow() {
  // FIXME: Deal with multiple displays.
  mainWindow = new BrowserWindow({
    ...screen.getPrimaryDisplay().bounds,
    hasShadow: false,
    enableLargerThanScreen: true,
    resizable: false,
    movable: false,
    frame: false,
    transparent: true,
    // closable: false,
    // alwaysOnTop: true,
    // show: false,
    // acceptFirstMouse
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
  mainWindow.loadFile("index.html");
  menuWindow = new BrowserWindow({
    width: 100,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    parent: mainWindow,
  });
  menuWindow.loadFile("menu.html");
}

ipcMain.on("color", (_, color) => {
  mainWindow.webContents.send("color", color);
});

ipcMain.on("strokeWidth", (_, strokeWidth) => {
  mainWindow.webContents.send("strokeWidth", strokeWidth);
});

ipcMain.on("tool", (_, tool) => {
  mainWindow.webContents.send("tool", tool);
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {});
