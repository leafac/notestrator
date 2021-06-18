const { app, BrowserWindow, ipcMain, screen } = require("electron");

(async () => {
  await app.whenReady();

  // FIXME: Deal with multiple displays.
  const mainWindow = new BrowserWindow({
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

  const menuWindow = new BrowserWindow({
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

  ipcMain.handle("menu", async () => {
    return await menuWindow.webContents.executeJavaScript(
      `Object.fromEntries(new URLSearchParams(new FormData(document.querySelector("form"))))`
    );
  });

  ipcMain.on("ignoreMouseEvents", (_, ignoreMouseEvents) => {
    mainWindow.setIgnoreMouseEvents(ignoreMouseEvents === "true");
  });
})();
