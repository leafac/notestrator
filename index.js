const { app, BrowserWindow, ipcMain, screen } = require("electron");

(async () => {
  await app.whenReady();

  // FIXME: Deal with multiple displays.
  const mainWindow = new BrowserWindow({
    ...screen.getPrimaryDisplay().bounds,
    enableLargerThanScreen: true,
    closable: false,
    minimizable: false,
    maximizable: false,
    movable: false,
    resizable: false,
    frame: false,
    focusable: false,
    transparent: true,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.setAlwaysOnTop(true, "screen-saver", 1);
  mainWindow.setVisibleOnAllWorkspaces(true);
  mainWindow.loadFile("index.html");

  const menuWindow = new BrowserWindow({
    parent: mainWindow,
    ...screen.getPrimaryDisplay().bounds,
    width: 100,
    height: 600,
    closable: false,
    minimizable: false,
    maximizable: false,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
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
