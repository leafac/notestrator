const { app, BrowserWindow, ipcMain } = require("electron");

function createWindow() {
  new BrowserWindow({
    width: 800,
    height: 600,
    // transparent: true,
    // frame: false,
  }).loadFile("index.html");
  new BrowserWindow({
    width: 100,
    height: 600,
    // transparent: true,
    // frame: false,
  }).loadFile("menu.html");
}

ipcMain.on("color", (_, color) => {
  console.log(color);
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {});
