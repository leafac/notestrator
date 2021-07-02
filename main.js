const { app, BrowserWindow, ipcMain, screen } = require("electron");
const express = require("express");
const { html } = require("@leafac/html");
const { css, extractInlineStyles } = require("@leafac/css");
const javascript = require("tagged-template-noop");

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
    roundedCorners: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  drawing.setAlwaysOnTop(true, "screen-saver", 1);
  drawing.setVisibleOnAllWorkspaces(true);
  drawing.loadURL(
    HTMLToURL(html`
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
        </head>
        <body>
          <svg
            style="${css`
              position: absolute;
              width: 100vw;
              height: 100vh;
            `}"
          >
            <g class="marker"></g>
            <g class="pen"></g>
          </svg>
          <script>
            const drawing = document.currentScript.previousElementSibling;
            window.addEventListener("mousedown", async (event) => {
              const menu = await ipcRenderer.invoke("menu");
              let handleMousemove;
              let handleMouseup;
              switch (menu.tool) {
                case "pen":
                case "marker":
                  const group = drawing.querySelector(\`.\${menu.tool}\`);
                  group.insertAdjacentHTML(
                    "beforeend",
                    \`
                    <path
                      d="M \${event.offsetX} \${event.offsetY}"
                      fill="none"
                      stroke="\${menu.color}"
                      stroke-width="\${
                        menu.strokeWidth * (menu.tool === "marker" ? 3 : 1)
                      }"
                      stroke-opacity="\${menu.tool === "marker" ? 0.5 : 1}"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      style="\${
                        menu.fade === "false"
                          ? \`\`
                          : \`transition: opacity \${menu.fade}ms ease-in;\`
                      }"
                    />
                  \`
                  );
                  const path = group.lastElementChild;
                  const t = 0.4;
                  let x0 = { x: event.offsetX, y: event.offsetY };
                  let x1 = { x: event.offsetX, y: event.offsetY };
                  let x2 = { x: event.offsetX, y: event.offsetY };
                  let p1 = { x: event.offsetX, y: event.offsetY };
                  let p2 = { x: event.offsetX, y: event.offsetY };
                  handleMousemove = (event) => {
                    // http://scaledinnovation.com/analytics/splines/aboutSplines.html
                    if (event.offsetX === x2.x && event.offsetY === x2.y)
                      return;
                    x2 = { x: event.offsetX, y: event.offsetY };
                    const x0_x1 = Math.sqrt(
                      (x0.x - x1.x) ** 2 + (x0.y - x1.y) ** 2
                    );
                    const x1_x2 = Math.sqrt(
                      (x1.x - x2.x) ** 2 + (x1.y - x2.y) ** 2
                    );
                    const x0_x1_x2 = x0_x1 + x1_x2;
                    const ratio_x0_x1 = x0_x1 / x0_x1_x2;
                    const ratio_x1_x2 = x1_x2 / x0_x1_x2;
                    const w = x2.x - x0.x;
                    const h = x2.y - x0.y;
                    p1 = {
                      x: x1.x - w * t * ratio_x0_x1,
                      y: x1.y - h * t * ratio_x0_x1,
                    };
                    path.setAttribute(
                      "d",
                      \`\${path.getAttribute("d")} C \${p2.x} \${p2.y}, \${
                        p1.x
                      } \${p1.y}, \${x1.x} \${x1.y}\`
                    );
                    p2 = {
                      x: x1.x + w * t * ratio_x1_x2,
                      y: x1.y + h * t * ratio_x1_x2,
                    };
                    x0 = x1;
                    x1 = x2;
                  };
                  handleMouseup = () => {
                    const d = path.getAttribute("d");
                    if (!d.includes("C")) {
                      const [x, y] = d.split(" ").slice(1);
                      path.setAttribute(
                        "d",
                        \`\${d} C \${x} \${y}, \${x} \${y}, \${x} \${y}\`
                      );
                    }
                    if (menu.fade === "false") return;
                    path.style.opacity = 0;
                    path.addEventListener("transitionend", () => {
                      path.remove();
                    });
                  };
                  break;
                case "eraser":
                  handleMousemove = (event) => {
                    const elementsToRemove = new Set();
                    for (const element of drawing.querySelectorAll("*"))
                      switch (element.tagName) {
                        case "path":
                          for (const [x, y] of element
                            .getAttribute("d")
                            .match(/C [d.]+ [d.]+, [d.]+ [d.]+, [d.]+ [d.]+/g)
                            .map((curve) =>
                              curve.split(",")[2].trim().split(" ").map(Number)
                            ))
                            if (
                              Math.sqrt(
                                (event.offsetX - x) ** 2 +
                                  (event.offsetY - y) ** 2
                              ) <
                              menu.strokeWidth * 5
                            )
                              elementsToRemove.add(element);
                          break;
                      }

                    for (const element of elementsToRemove) element.remove();
                  };
                  break;
              }
              window.addEventListener("mousemove", handleMousemove);
              window.addEventListener(
                "mouseup",
                () => {
                  window.removeEventListener("mousemove", handleMousemove);
                  if (handleMouseup !== undefined) handleMouseup();
                },
                { once: true }
              );
            });
          </script>
        </body>
      </html>
    `)
  );

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
              const Mousetrap = require("mousetrap");
              window.addEventListener("DOMContentLoaded", () => {
                for (const element of document.querySelectorAll(
                  "[data-ondomcontentloaded]"
                ))
                  new Function(element.dataset.ondomcontentloaded).call(
                    element
                  );
              });
            </script>
          </head>
          <body
            style="${css`
              font-family: var(--font-family--sans-serif);
              font-size: var(--font-size--xs);
              line-height: var(--line-height--xs);
              color: var(--color--gray--warm--500);
              background-color: var(--color--gray--warm--100);
              @media (prefers-color-scheme: dark) {
                color: var(--color--gray--warm--500);
                background-color: var(--color--gray--warm--900);
              }
              -webkit-user-select: none;
              --space--base: var(--space--2);

              @at-root {
                .separator {
                  border-top: var(--border-width--1) solid
                    var(--color--gray--warm--200);
                  @media (prefers-color-scheme: dark) {
                    border-color: var(--color--gray--warm--800);
                  }
                  margin: var(--space--base) var(--space--0);
                }
              }
            `}"
          >
            <div
              style="${css`
                text-align: center;
                color: var(--color--gray--warm--900);
                background-color: var(--color--gray--warm--300);
                @media (prefers-color-scheme: dark) {
                  color: var(--color--gray--warm--400);
                  background-color: var(--color--gray--warm--800);
                }
                padding: var(--space--1) var(--space--base);
                -webkit-app-region: drag;
              `}"
            >
              Notestrator
            </div>
            <form
              style="${css`
                padding: var(--space--base) var(--space--base);
              `}"
            >
              <div
                style="${css`
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: var(--space--base);
                  column-gap: var(--space--4);
                  row-gap: var(--space--base);
                `}"
              >
                $${[
                  {
                    color: "var(--color--red--600)",
                    borderColor: "var(--color--red--500)",
                    shortcut: "1",
                  },
                  {
                    color: "var(--color--amber--600)",
                    borderColor: "var(--color--amber--500)",
                    shortcut: "2",
                  },
                  {
                    color: "var(--color--lime--600)",
                    borderColor: "var(--color--lime--500)",
                    shortcut: "3",
                  },
                  {
                    color: "var(--color--teal--600)",
                    borderColor: "var(--color--teal--500)",
                    shortcut: "4",
                  },
                  {
                    color: "var(--color--sky--600)",
                    borderColor: "var(--color--sky--500)",
                    shortcut: "5",
                  },
                  {
                    color: "var(--color--indigo--600)",
                    borderColor: "var(--color--indigo--500)",
                    shortcut: "6",
                  },
                  {
                    color: "var(--color--purple--600)",
                    borderColor: "var(--color--purple--500)",
                    shortcut: "7",
                  },
                  {
                    color: "var(--color--pink--600)",
                    borderColor: "var(--color--pink--500)",
                    shortcut: "8",
                  },
                  {
                    color: "var(--color--gray--warm--900)",
                    borderColor: "var(--color--gray--warm--700)",
                    shortcut: "9",
                  },
                  {
                    color: "var(--color--gray--warm--50)",
                    borderColor: "var(--color--gray--warm--200)",
                    checkedColor: "var(--color--gray--warm--600)",
                    shortcut: "0",
                  },
                ].map(
                  (
                    { color, borderColor, checkedColor, shortcut },
                    index
                  ) => html`
                    <label
                      style="${css`
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                      `}"
                    >
                      <input
                        type="radio"
                        name="color"
                        value="${color}"
                        $${index === 0 ? html`checked` : html``}
                        style="${css`
                          background-color: ${color};
                          width: var(--font-size--xl);
                          height: var(--font-size--xl);
                          border: var(--border-width--1) solid ${borderColor};
                          border-radius: var(--border-radius--circle);
                          display: flex;
                          justify-content: center;
                          align-items: center;
                          &::after {
                            content: "";
                            background-color: ${checkedColor ??
                            "var(--color--gray--warm--50)"};
                            display: block;
                            width: var(--space--2);
                            height: var(--space--2);
                            border-radius: var(--border-radius--circle);
                            transform: scale(var(--scale--0));
                            transition-property: var(
                              --transition-property--transform
                            );
                            transition-duration: var(
                              --transition-duration--150
                            );
                            transition-timing-function: var(
                              --transition-timing-function--in-out
                            );
                          }
                          &:checked::after {
                            transform: scale(var(--scale--100));
                          }
                        `}"
                        data-ondomcontentloaded="${javascript`
                          Mousetrap.bind(${JSON.stringify(
                            shortcut
                          )}, () => { this.click(); })
                        `}"
                      />
                      ${shortcut}
                    </label>
                  `
                )}
              </div>

              <hr class="separator" />

              <div
                style="${css`
                  display: flex;
                  justify-content: space-between;
                `}"
              >
                $${[
                  { strokeWidth: 1, shortcut: "q" },
                  { strokeWidth: 3, shortcut: "w" },
                  { strokeWidth: 5, shortcut: "e" },
                ].map(
                  ({ strokeWidth, shortcut }, index) => html`
                    <label>
                      <input
                        type="radio"
                        name="strokeWidth"
                        value="${strokeWidth}"
                        hidden
                        $${index === 0 ? html`checked` : html``}
                        data-ondomcontentloaded="${javascript`
                          Mousetrap.bind(${JSON.stringify(
                            shortcut
                          )}, () => { this.click(); })
                        `}"
                      />
                      <div
                        style="${css`
                          display: flex;
                          flex-direction: column;
                          align-items: center;
                          gap: var(--space--1);
                        `}"
                      >
                        <svg
                          style="${css`
                            width: var(--font-size--xl);
                            height: var(--font-size--xl);
                          `}"
                        >
                          <path
                            d="
                              M ${strokeWidth} ${20 - strokeWidth / 2}
                              C ${strokeWidth} ${strokeWidth},
                                ${20 - strokeWidth / 2} ${20 - strokeWidth / 2},
                                ${20 - strokeWidth / 2} ${strokeWidth}
                            "
                            stroke-width="${strokeWidth}"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke="var(--color--gray--warm--600)"
                            fill="none"
                          />
                        </svg>
                        ${shortcut.toUpperCase()}
                      </div>
                    </label>
                  `
                )}
              </div>

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

  /*
  const OBSDrawing = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  OBSDrawing.loadURL(
    HTMLToURL(html`
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
            const Mousetrap = require("mousetrap");
            const OBSWebSocket = require("obs-websocket-js");
            const obs = new OBSWebSocket();
            obs.connect({ address: "localhost:4444" });
            window.addEventListener("DOMContentLoaded", () => {
              for (const element of document.querySelectorAll(
                "[data-ondomcontentloaded]"
              ))
                new Function(element.dataset.ondomcontentloaded).call(element);
            });
          </script>
        </head>
        <body
          style="${css`
            display: flex;
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            left: 0;
          `}"
        >
          <div
            style="${css`
              font-family: var(--font-family--sans-serif);
              font-size: var(--font-size--xs);
              line-height: var(--line-height--xs);
              color: var(--color--gray--warm--500);
              background-color: var(--color--gray--warm--100);
              @media (prefers-color-scheme: dark) {
                color: var(--color--gray--warm--500);
                background-color: var(--color--gray--warm--900);
              }
              width: 100px;
              -webkit-user-select: none;
              --space--base: var(--space--2);

              @at-root {
                .separator {
                  border-top: var(--border-width--1) solid
                    var(--color--gray--warm--200);
                  @media (prefers-color-scheme: dark) {
                    border-color: var(--color--gray--warm--800);
                  }
                  margin: var(--space--base) var(--space--0);
                }
              }
            `}"
          >
            <div
              style="${css`
                text-align: center;
                color: var(--color--gray--warm--900);
                background-color: var(--color--gray--warm--300);
                @media (prefers-color-scheme: dark) {
                  color: var(--color--gray--warm--400);
                  background-color: var(--color--gray--warm--800);
                }
                padding: var(--space--1) var(--space--base);
                -webkit-app-region: drag;
              `}"
            >
              Notestrator
            </div>
            <form
              style="${css`
                padding: var(--space--base) var(--space--base);
              `}"
            >
              <div
                style="${css`
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: var(--space--base);
                  column-gap: var(--space--4);
                  row-gap: var(--space--base);
                `}"
              >
                $${[
                  {
                    color: "var(--color--red--600)",
                    borderColor: "var(--color--red--500)",
                    shortcut: "1",
                    isDefault: true,
                  },
                  {
                    color: "var(--color--amber--600)",
                    borderColor: "var(--color--amber--500)",
                    shortcut: "2",
                  },
                  {
                    color: "var(--color--lime--600)",
                    borderColor: "var(--color--lime--500)",
                    shortcut: "3",
                  },
                  {
                    color: "var(--color--teal--600)",
                    borderColor: "var(--color--teal--500)",
                    shortcut: "4",
                  },
                  {
                    color: "var(--color--sky--600)",
                    borderColor: "var(--color--sky--500)",
                    shortcut: "5",
                  },
                  {
                    color: "var(--color--indigo--600)",
                    borderColor: "var(--color--indigo--500)",
                    shortcut: "6",
                  },
                  {
                    color: "var(--color--purple--600)",
                    borderColor: "var(--color--purple--500)",
                    shortcut: "7",
                  },
                  {
                    color: "var(--color--pink--600)",
                    borderColor: "var(--color--pink--500)",
                    shortcut: "8",
                  },
                  {
                    color: "var(--color--gray--warm--900)",
                    borderColor: "var(--color--gray--warm--700)",
                    shortcut: "9",
                  },
                  {
                    color: "var(--color--gray--warm--50)",
                    borderColor: "var(--color--gray--warm--200)",
                    checkedColor: "var(--color--gray--warm--600)",
                    shortcut: "0",
                  },
                ].map(
                  ({
                    color,
                    borderColor,
                    checkedColor,
                    shortcut,
                    isDefault,
                  }) => html`
                    <label>
                      <input
                        type="radio"
                        name="color"
                        value="${color}"
                        $${isDefault ? html`checked` : html``}
                        style="${css`
                          display: none;
                        `}"
                        data-ondomcontentloaded="${javascript`
                          Mousetrap.bind(${JSON.stringify(
                            shortcut
                          )}, () => { this.click(); })
                        `}"
                      />
                      <div
                        style="${css`
                          display: flex;
                          justify-content: space-between;
                          align-items: center;
                        `}"
                      >
                        <div
                          style="${css`
                            background-color: ${color};
                            width: var(--font-size--2xl);
                            height: var(--font-size--2xl);
                            border: var(--border-width--1) solid ${borderColor};
                            border-radius: var(--border-radius--circle);
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            &::after {
                              content: "";
                              background-color: ${checkedColor ??
                              "var(--color--gray--warm--50)"};
                              display: block;
                              width: var(--space--2);
                              height: var(--space--2);
                              border-radius: var(--border-radius--circle);
                              opacity: var(--opacity--0);
                              transition-property: var(
                                --transition-property--opacity
                              );
                              transition-duration: var(
                                --transition-duration--150
                              );
                              transition-timing-function: var(
                                --transition-timing-function--in-out
                              );
                            }
                            :checked + * > &::after {
                              opacity: var(--opacity--100);
                            }
                          `}"
                        ></div>
                        ${shortcut}
                      </div>
                    </label>
                  `
                )}
              </div>

              <hr class="separator" />

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
          </div>
          <div
            style="${css`
              flex: 1;
            `}"
            data-ondomcontentloaded="${javascript`
              const element = this;
              obs.on("ConnectionOpened", () => {
                (async function update() {
                  const preview = await obs.send("TakeSourceScreenshot", { embedPictureFormat: "png" });
                  element.style.backgroundImage = 'url("' + preview.img + '")';
                  setTimeout(update, 500);
                })();
              });
            `}"
          >
            <svg
              style="${css`
                width: 100%;
                height: 100%;
              `}"
              data-ondomcontentloaded="${javascript`
                new MutationObserver(() => {
                  ipcRenderer.send("OBSBrowserSourceUpdate", this.innerHTML);
                }).observe(this, { subtree: true, childList: true, attributes: true });
              `}"
            >
              <g class="marker"></g>
              <g class="pen"></g>
            </svg>
            <script>
              const drawing = document.currentScript.previousElementSibling;
              window.addEventListener("mousedown", async (event) => {
                const menu = Object.fromEntries(
                  new URLSearchParams(
                    new FormData(document.querySelector("form"))
                  )
                );
                let handleMousemove;
                let handleMouseup;
                switch (menu.tool) {
                  case "pen":
                  case "marker":
                    const group = drawing.querySelector(\`.\${menu.tool}\`);
                    group.insertAdjacentHTML(
                      "beforeend",
                      \`
                    <path
                      d="M \${event.offsetX} \${event.offsetY}"
                      fill="none"
                      stroke="\${menu.color}"
                      stroke-width="\${
                        menu.strokeWidth * (menu.tool === "marker" ? 3 : 1)
                      }"
                      stroke-opacity="\${menu.tool === "marker" ? 0.5 : 1}"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      style="\${
                        menu.fade === "false"
                          ? \`\`
                          : \`transition: opacity \${menu.fade}ms ease-in;\`
                      }"
                    />
                  \`
                    );
                    const path = group.lastElementChild;
                    const t = 0.4;
                    let x0 = { x: event.offsetX, y: event.offsetY };
                    let x1 = { x: event.offsetX, y: event.offsetY };
                    let x2 = { x: event.offsetX, y: event.offsetY };
                    let p1 = { x: event.offsetX, y: event.offsetY };
                    let p2 = { x: event.offsetX, y: event.offsetY };
                    handleMousemove = (event) => {
                      // http://scaledinnovation.com/analytics/splines/aboutSplines.html
                      if (event.offsetX === x2.x && event.offsetY === x2.y)
                        return;
                      x2 = { x: event.offsetX, y: event.offsetY };
                      const x0_x1 = Math.sqrt(
                        (x0.x - x1.x) ** 2 + (x0.y - x1.y) ** 2
                      );
                      const x1_x2 = Math.sqrt(
                        (x1.x - x2.x) ** 2 + (x1.y - x2.y) ** 2
                      );
                      const x0_x1_x2 = x0_x1 + x1_x2;
                      const ratio_x0_x1 = x0_x1 / x0_x1_x2;
                      const ratio_x1_x2 = x1_x2 / x0_x1_x2;
                      const w = x2.x - x0.x;
                      const h = x2.y - x0.y;
                      p1 = {
                        x: x1.x - w * t * ratio_x0_x1,
                        y: x1.y - h * t * ratio_x0_x1,
                      };
                      path.setAttribute(
                        "d",
                        \`\${path.getAttribute("d")} C \${p2.x} \${p2.y}, \${
                          p1.x
                        } \${p1.y}, \${x1.x} \${x1.y}\`
                      );
                      p2 = {
                        x: x1.x + w * t * ratio_x1_x2,
                        y: x1.y + h * t * ratio_x1_x2,
                      };
                      x0 = x1;
                      x1 = x2;
                    };
                    handleMouseup = () => {
                      const d = path.getAttribute("d");
                      if (!d.includes("C")) {
                        const [x, y] = d.split(" ").slice(1);
                        path.setAttribute(
                          "d",
                          \`\${d} C \${x} \${y}, \${x} \${y}, \${x} \${y}\`
                        );
                      }
                      if (menu.fade === "false") return;
                      path.style.opacity = 0;
                      path.addEventListener("transitionend", () => {
                        path.remove();
                      });
                    };
                    break;
                  case "eraser":
                    handleMousemove = (event) => {
                      const elementsToRemove = new Set();
                      for (const element of drawing.querySelectorAll("*"))
                        switch (element.tagName) {
                          case "path":
                            for (const [x, y] of element
                              .getAttribute("d")
                              .match(/C [d.]+ [d.]+, [d.]+ [d.]+, [d.]+ [d.]+/g)
                              .map((curve) =>
                                curve
                                  .split(",")[2]
                                  .trim()
                                  .split(" ")
                                  .map(Number)
                              ))
                              if (
                                Math.sqrt(
                                  (event.offsetX - x) ** 2 +
                                    (event.offsetY - y) ** 2
                                ) <
                                menu.strokeWidth * 5
                              )
                                elementsToRemove.add(element);
                            break;
                        }

                      for (const element of elementsToRemove) element.remove();
                    };
                    break;
                }
                window.addEventListener("mousemove", handleMousemove);
                window.addEventListener(
                  "mouseup",
                  () => {
                    window.removeEventListener("mousemove", handleMousemove);
                    if (handleMouseup !== undefined) handleMouseup();
                  },
                  { once: true }
                );
              });
            </script>
          </div>
        </body>
      </html>
    `)
  );

  const OBSBrowserSourceApp = express();
  OBSBrowserSourceApp.get("/", (req, res) => {
    res.send(
      extractInlineStyles(html`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />
            <meta
              name="viewport"
              content="width=device-width, initial-scale=1.0"
            />
            <script>
              const eventSource = new EventSource("/event-source");
              eventSource.addEventListener("update", (event) => {
                document.querySelector("svg").innerHTML = event.data;
              });
            </script>
          </head>
          <body
            style="${css`
              position: absolute;
              top: 0;
              right: 0;
              bottom: 0;
              left: 0;
            `}"
          >
            <svg
              style="${css`
                width: 100%;
                height: 100%;
              `}"
            ></svg>
          </body>
        </html>
      `)
    );
  });

  OBSBrowserSourceApp.get("/event-source", (req, res) => {
    res.contentType("text/event-stream").write("");
    OBSBrowserSourceApp.locals.eventSource = res;
  });

  ipcMain.on("OBSBrowserSourceUpdate", (_, data) => {
    if (OBSBrowserSourceApp.locals.eventSource === undefined) return;
    OBSBrowserSourceApp.locals.eventSource.write(
      `event: update\ndata: ${data.replace(/\n/g, "\ndata: ")}\n\n`
    );
  });

  const OBSBrowserSourceServer = OBSBrowserSourceApp.listen(4445);
  */

  function HTMLToURL(html) {
    return `data:text/html;base64,${Buffer.from(
      extractInlineStyles(html)
    ).toString("base64")}`;
  }
})();
