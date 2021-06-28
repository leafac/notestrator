const { app, BrowserWindow, ipcMain, screen } = require("electron");
const { html } = require("@leafac/html");
const { css, extractInlineStyles } = require("@leafac/css");

(async () => {
  await app.whenReady();

  // FIXME: Deal with multiple displays.
  const drawing = new BrowserWindow({
    ...screen.getPrimaryDisplay().bounds,
    enableLargerThanScreen: true,
    closable: false,
    minimizable: false, // TODO: Breaks in Windows.
    maximizable: false,
    movable: false,
    resizable: false,
    frame: false,
    focusable: false,
    transparent: true, // TODO: Breaks in Windows.
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  drawing.setAlwaysOnTop(true, "screen-saver", 1);
  drawing.setVisibleOnAllWorkspaces(true);
  drawing.loadURL(HTMLToURL(html``));

  const menu = new BrowserWindow({
    parent: drawing,
    ...screen.getPrimaryDisplay().bounds,
    width: 100,
    height: 600,
    closable: false,
    minimizable: false,
    maximizable: false,
    resizable: false,
    frame: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  menu.loadURL(
    HTMLToURL(
      html`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />
            <script>
              const { ipcRenderer } = require("electron");
            </script>
            <style>
              .color {
                width: 1.5rem;
                height: 1.5rem;
                border-radius: 50%;
                appearance: none;
                display: grid;
                box-shadow: 0 2px 2px #d1d5db;
                transition: transform 200ms;
              }

              .color:checked {
                transform: scale(1.5);
              }

              hr {
                border-top: 1px solid #d1d5db;
                width: 100%;
                margin: 0;
              }
            </style>
          </head>
          <body style="margin: 0">
            <div style="-webkit-user-select: none; -webkit-app-region: drag">
              Notestrator
            </div>
            <form
              style="
        display: flex;
        flex-direction: column;
        gap: 1rem;
        height: 100vh;
        background-color: #f3f4f6;
      "
            >
              <div
                style="
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          padding: 0.5rem;
          justify-content: center;
        "
              >
                <label>
                  <input
                    type="radio"
                    name="color"
                    value="#111827"
                    checked
                    class="color"
                    style="background-color: #111827"
                  />
                </label>
                <label>
                  <input
                    type="radio"
                    name="color"
                    value="#F9FAFB"
                    class="color"
                    style="background-color: #f9fafb"
                  />
                </label>
                <label>
                  <input
                    type="radio"
                    name="color"
                    value="#DC2626"
                    class="color"
                    style="background-color: #dc2626"
                  />
                </label>
                <label>
                  <input
                    type="radio"
                    name="color"
                    value="#D97706"
                    class="color"
                    style="background-color: #d97706"
                  />
                </label>
                <label>
                  <input
                    type="radio"
                    name="color"
                    value="#65A30D"
                    class="color"
                    style="background-color: #65a30d"
                  />
                </label>
                <label>
                  <input
                    type="radio"
                    name="color"
                    value="#059669"
                    class="color"
                    style="background-color: #059669"
                  />
                </label>
                <label>
                  <input
                    type="radio"
                    name="color"
                    value="#0891B2"
                    class="color"
                    style="background-color: #0891b2"
                  />
                </label>
                <label>
                  <input
                    type="radio"
                    name="color"
                    value="#2563EB"
                    class="color"
                    style="background-color: #2563eb"
                  />
                </label>
                <label>
                  <input
                    type="radio"
                    name="color"
                    value="#7C3AED"
                    class="color"
                    style="background-color: #7c3aed"
                  />
                </label>
                <label>
                  <input
                    type="radio"
                    name="color"
                    value="#C026D3"
                    class="color"
                    style="background-color: #c026d3"
                  />
                </label>
              </div>

              <hr />

              <label
                ><input type="radio" name="strokeWidth" value="1" /> Thin</label
              >
              <label
                ><input type="radio" name="strokeWidth" value="3" checked />
                Medium</label
              >
              <label
                ><input type="radio" name="strokeWidth" value="5" />
                Thick</label
              >

              <label
                ><input type="radio" name="tool" value="pen" checked />
                Pen</label
              >
              <label
                ><input type="radio" name="tool" value="marker" /> Marker</label
              >
              <label
                ><input type="radio" name="tool" value="eraser" /> Eraser</label
              >

              <label>
                <input
                  type="radio"
                  name="ignoreMouseEvents"
                  value="false"
                  checked
                  onchange="ipcRenderer.send(this.name, this.value)"
                />
                Draw
              </label>
              <label>
                <input
                  type="radio"
                  name="ignoreMouseEvents"
                  value="true"
                  onchange="ipcRenderer.send(this.name, this.value)"
                />
                Click-through
              </label>

              <div>Fade</div>
              <label>
                <input type="radio" name="fade" value="false" checked />
                None
              </label>
              <label>
                <input type="radio" name="fade" value="1500" />
                Slow
              </label>
              <label>
                <input type="radio" name="fade" value="1000" />
                Medium
              </label>
              <label>
                <input type="radio" name="fade" value="500" />
                Fast
              </label>
            </form>
          </body>
        </html>
      `
    )
  );

  ipcMain.handle("menu", async () => {
    return await menu.webContents.executeJavaScript(
      `Object.fromEntries(new URLSearchParams(new FormData(document.querySelector("form"))))`
    );
  });

  ipcMain.on("ignoreMouseEvents", (_, ignoreMouseEvents) => {
    drawing.setIgnoreMouseEvents(ignoreMouseEvents === "true");
  });

  function HTMLToURL(html) {
    return `data:text/html;base64,${Buffer.from(
      extractInlineStyles(html)
    ).toString("base64")}`;
  }
})();
