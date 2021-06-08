const { app, BrowserWindow } = require("electron");

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

app.whenReady().then(() => {
  createWindow();
  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", function () {});
