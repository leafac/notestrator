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
    closable: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.loadFile("index.html");
  menuWindow = new BrowserWindow({
    ...screen.getPrimaryDisplay().bounds,
    width: 100,
    height: 600,
    resizable: false,
    minimizable: false,
    maximizable: false,
    closable: false,
    focusable: false,
    skipTaskbar: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    parent: mainWindow,
  });
  menuWindow.loadFile("menu.html");
}

app.whenReady().then(() => {
  ipcMain.handle("menu", async () => {
    return await menuWindow.webContents.executeJavaScript(
      `Object.fromEntries(new URLSearchParams(new FormData(document.querySelector("form"))))`
    );
  });

  ipcMain.on("ignoreMouseEvents", (_, ignoreMouseEvents) => {
    mainWindow.setIgnoreMouseEvents(ignoreMouseEvents === "true");
  });

  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {});
