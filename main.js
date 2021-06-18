const { app, BrowserWindow, ipcMain, screen } = require("electron");

(async () => {
  await app.whenReady();

  // FIXME: Deal with multiple displays.
  const drawing = new BrowserWindow({
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
  drawing.setAlwaysOnTop(true, "screen-saver", 1);
  drawing.setVisibleOnAllWorkspaces(true);
  drawing.loadFile("drawing.html");

  const menu = new BrowserWindow({
    parent: drawing,
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
  menu.loadFile("menu.html");

  ipcMain.handle("menu", async () => {
    return await menu.webContents.executeJavaScript(
      `Object.fromEntries(new URLSearchParams(new FormData(document.querySelector("form"))))`
    );
  });

  ipcMain.on("ignoreMouseEvents", (_, ignoreMouseEvents) => {
    drawing.setIgnoreMouseEvents(ignoreMouseEvents === "true");
  });
})();
