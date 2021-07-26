const {
  app,
  BrowserWindow,
  ipcMain,
  screen,
  globalShortcut,
  Tray,
  Menu,
} = require("electron");
const path = require("path");
const express = require("express");
const { html } = require("@leafac/html");
const { css, extractInlineStyles } = require("@leafac/css");
const javascript = require("tagged-template-noop");

(async () => {
  await app.whenReady();

  const shortcuts = new Map();

  // FIXME: Fix keyboard shortcuts by forwarding the keyboard events to the menu window.
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
    transparent: true, // TODO: Breaks in Windows.
    hasShadow: false,
    roundedCorners: false,
    skipTaskbar: true, // TODO: Probably necessary to hide the app in Windows.
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  drawing.setAlwaysOnTop(true, "screen-saver", 1);
  drawing.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
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
            require("@fortawesome/fontawesome-free/js/all.js");
            window.addEventListener("DOMContentLoaded", () => {
              for (const element of document.querySelectorAll(
                "[data-ondomcontentloaded]"
              ))
                new Function(element.dataset.ondomcontentloaded).call(element);
            });
          </script>
        </head>
        <body>
          <div
            class="drawing"
            style="${css`
              cursor: none;
              position: absolute;
              top: 0;
              right: 0;
              bottom: 0;
              left: 0;
            `}"
            data-ondomcontentloaded="${javascript`
              ipcRenderer.on("settings", (_, settings) => {
                this.settings = settings;
              });
            `}"
          >
            <!-- FIXME: The cursor shows up below the drawing. -->
            <div
              style="${css`
                position: absolute;
                width: 15px;
                height: 15px;
                transform: translate(-50%, -50%);
                color: var(--color--red--600);
              `}"
              data-ondomcontentloaded="${javascript`
                document.addEventListener("mousemove", (event) => {
                  this.hidden = false;
                  this.style.top = String(event.offsetY) + "px";
                  this.style.left = String(event.offsetX) + "px";
                });
                document.addEventListener("mouseleave", (event) => {
                  this.hidden = true;
                });
                ipcRenderer.on("settings", (_, settings) => {
                  this.style.color = settings.color;
                  const circle = this.querySelector(".circle circle");
                  circle.setAttribute("r", settings.strokeWidth / 2 * (settings.tool === "highlighter" ? 3 : 1));
                  circle.style.opacity = settings.tool === "highlighter" ? 0.5 : 1;
                  this.querySelector(".circle").hidden = settings.tool === "eraser";
                  const eraser = this.querySelector(".eraser");
                  eraser.hidden = settings.tool !== "eraser";
                  /*
                  TODO: Do we change the cursor on fade?
                  {
                    "fade": "false",
                  }
                  */
                });
              `}"
            >
              <div class="circle">
                <svg viewBox="-7.5 -7.5, 15 15">
                  <circle cx="0" cy="0" r="1.5" fill="currentColor" />
                  <path
                    d="M -6 0 L 6 0 M 0 -6 L 0 6"
                    stroke="currentColor"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
              <div class="eraser" hidden>
                <i class="fas fa-eraser"></i>
              </div>
            </div>
            <div
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
                data-ondomcontentloaded="${javascript`
                  const drawing = this.closest(".drawing");
                  window.addEventListener("mousedown", async (event) => {
                    let handleMousemove;
                    let handleMouseup;
                    switch (drawing.settings.tool) {
                      case "pen":
                      case "highlighter":
                        const group = this.querySelector(\`.\${drawing.settings.tool}\`);
                        group.insertAdjacentHTML(
                          "beforeend",
                          \`
                        <path
                          d="M \${event.offsetX} \${event.offsetY}"
                          fill="none"
                          stroke="\${drawing.settings.color}"
                          stroke-width="\${
                            drawing.settings.strokeWidth * (drawing.settings.tool === "highlighter" ? 3 : 1)
                          }"
                          stroke-opacity="\${drawing.settings.tool === "highlighter" ? 0.5 : 1}"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          style="\${
                            drawing.settings.fade === "false"
                              ? \`\`
                              : \`transition: opacity \${drawing.settings.fade}ms ease-in;\`
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
                          if (drawing.settings.fade === "false") return;
                          path.style.opacity = 0;
                          path.addEventListener("transitionend", () => {
                            path.remove();
                          });
                        };
                        break;
                      case "eraser":
                        handleMousemove = (event) => {
                          const elementsToRemove = new Set();
                          for (const element of this.querySelectorAll("*"))
                            switch (element.tagName) {
                              case "path":
                                for (const [x, y] of element
                                  .getAttribute("d")
                                  .match(
                                    ${/C [\d.]+ [\d.]+, [\d.]+ [\d.]+, [\d.]+ [\d.]+/g}
                                  )
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
                                    drawing.settings.strokeWidth * 5
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
                `}"
              >
                <g class="highlighter"></g>
                <g class="pen"></g>
              </svg>
            </div>
          </div>
        </body>
      </html>
    `)
  );

  const menu = new BrowserWindow({
    parent: drawing,
    ...screen.getPrimaryDisplay().bounds,
    width: 96, // var(--space--24)
    height: 384, // var(--space--96)
    closable: false,
    minimizable: false,
    maximizable: false,
    resizable: false,
    frame: false,
    focusable: false,
    skipTaskbar: true, // TODO: Probably necessary to hide the app in Windows.
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
              require("@fortawesome/fontawesome-free/js/all.js");
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
              padding: var(--space--2) var(--space--2);
              position: absolute;
              top: 0;
              right: 0;
              bottom: 0;
              left: 0;
              -webkit-user-select: none;
              -webkit-app-region: drag;

              @at-root {
                .section {
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  justify-content: space-between;
                  gap: var(--space--2);
                }

                .section--item {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  gap: var(--space--1);
                }

                .section--item--icon {
                  font-size: var(--font-size--sm);
                  line-height: var(--line-height--sm);
                  color: var(--color--gray--warm--600);
                  &:hover {
                    background-color: var(--color--gray--warm--200);
                  }
                  &:active {
                    background-color: var(--color--gray--warm--300);
                  }
                  :checked + & {
                    color: var(--color--gray--warm--100);
                    background-color: var(--color--gray--warm--600);
                  }
                  @media (prefers-color-scheme: dark) {
                    color: var(--color--gray--warm--400);
                    &:hover {
                      background-color: var(--color--gray--warm--800);
                    }
                    &:active {
                      background-color: var(--color--gray--warm--700);
                    }
                    :checked + & {
                      color: var(--color--gray--warm--900);
                      background-color: var(--color--gray--warm--400);
                    }
                  }
                  width: var(--font-size--xl);
                  height: var(--font-size--xl);
                  border-radius: var(--border-radius--md);
                  display: flex;
                  justify-content: center;
                  align-items: center;
                  transition-property: var(--transition-property--colors);
                  transition-duration: var(--transition-duration--150);
                  transition-timing-function: var(
                    --transition-timing-function--in-out
                  );
                  * {
                    stroke: currentColor;
                  }
                }

                .separator {
                  border-top: var(--border-width--1) solid
                    var(--color--gray--warm--200);
                  @media (prefers-color-scheme: dark) {
                    border-color: var(--color--gray--warm--800);
                  }
                  margin: var(--space--2) var(--space--0);
                }
              }
            `}"
          >
            <form
              data-ondomcontentloaded="${(() => {
                ipcMain.on("settings", (_, settings) => {
                  drawing.webContents.send("settings", settings);
                });
                return javascript`
                  const settings = () => {
                    ipcRenderer.send("settings", Object.fromEntries(new URLSearchParams(new FormData(this))));
                  };
                  settings();
                  this.addEventListener("change", settings);
                `;
              })()}"
            >
              <div
                style="${css`
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: var(--space--2);
                  column-gap: var(--space--4);
                  row-gap: var(--space--2);
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
                        $${isDefault ? html`checked` : html``}
                        style="${css`
                          background-color: ${color};
                          width: var(--font-size--xl);
                          height: var(--font-size--xl);
                          border: var(--border-width--1) solid ${borderColor};
                          border-radius: var(--border-radius--circle);
                          display: flex;
                          justify-content: center;
                          align-items: center;
                          &:hover {
                            transform: scale(var(--scale--110));
                          }
                          &:active {
                            transform: scale(var(--scale--90));
                          }
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
                          transition-property: var(
                            --transition-property--transform
                          );
                          transition-duration: var(--transition-duration--150);
                          transition-timing-function: var(
                            --transition-timing-function--in-out
                          );
                        `}"
                        ${(() => {
                          shortcuts.set(shortcut, () => {
                            menu.webContents.executeJavaScript(javascript`
                            document.querySelector('[name="color"][value="${color}"]').click();
                          `);
                          });
                        })()}
                      />
                      ${shortcut}
                    </label>
                  `
                )}
              </div>

              <hr class="separator" />

              <div class="section">
                $${[
                  {
                    strokeWidth: 1,
                    shortcut: "q",
                  },
                  {
                    strokeWidth: 3,
                    shortcut: "w",
                    isDefault: true,
                  },
                  {
                    strokeWidth: 5,
                    shortcut: "e",
                  },
                ].map(
                  ({ strokeWidth, shortcut, isDefault }) => html`
                    <label class="section--item">
                      <input
                        type="radio"
                        name="strokeWidth"
                        value="${strokeWidth}"
                        hidden
                        $${isDefault ? html`checked` : html``}
                        data-ondomcontentloaded="${javascript`
                          Mousetrap.bind(${JSON.stringify(
                            shortcut
                          )}, () => { this.click(); })
                        `}"
                      />
                      <svg class="section--item--icon">
                        <line
                          x1="${strokeWidth / 2 + 3}"
                          y1="${20 - strokeWidth / 2 - 3}"
                          x2="${20 - strokeWidth / 2 - 3}"
                          y2="${strokeWidth / 2 + 3}"
                          stroke-width="${strokeWidth}"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          fill="none"
                        />
                      </svg>
                      ${shortcut.toUpperCase()}
                    </label>
                  `
                )}
              </div>

              <hr class="separator" />

              <div class="section">
                $${[
                  {
                    tool: "pen",
                    icon: "pen-fancy",
                    shortcut: "a",
                    isDefault: true,
                  },
                  {
                    tool: "highlighter",
                    icon: "highlighter",
                    shortcut: "s",
                  },
                  {
                    tool: "eraser",
                    icon: "eraser",
                    shortcut: "d",
                  },
                ].map(
                  ({ tool, icon, shortcut, isDefault }) => html`
                    <label class="section--item">
                      <input
                        type="radio"
                        name="tool"
                        value="${tool}"
                        hidden
                        $${isDefault ? html`checked` : html``}
                        data-ondomcontentloaded="${javascript`
                          Mousetrap.bind(${JSON.stringify(
                            shortcut
                          )}, () => { this.click(); })
                        `}"
                      />
                      <div class="section--item--icon">
                        <i class="fas fa-${icon}"></i>
                      </div>
                      ${shortcut.toUpperCase()}
                    </label>
                  `
                )}
              </div>

              <hr class="separator" />

              <div class="section">
                $${[
                  {
                    fade: "false",
                    shortcut: "z",
                    isDefault: true,
                  },
                  {
                    fade: "1500",
                    gradient: 100,
                    shortcut: "x",
                  },
                  {
                    fade: "500",
                    gradient: 60,
                    shortcut: "c",
                  },
                ].map(
                  ({ fade, gradient, shortcut, isDefault }) => html`
                    <label class="section--item">
                      <input
                        type="radio"
                        name="fade"
                        value="${fade}"
                        hidden
                        $${isDefault ? html`checked` : html``}
                        data-ondomcontentloaded="${javascript`
                          Mousetrap.bind(${JSON.stringify(
                            shortcut
                          )}, () => { this.click(); })
                        `}"
                      />
                      <svg class="section--item--icon">
                        $${gradient === undefined
                          ? html``
                          : html`
                              <defs>
                                <linearGradient
                                  id="fade--${gradient}"
                                  x1="0%"
                                  y1="0%"
                                  x2="100%"
                                  y2="100%"
                                >
                                  <stop offset="0%" stop-color="currentColor" />
                                  <stop
                                    offset="${gradient}%"
                                    stop-color="transparent"
                                  />
                                </linearGradient>
                              </defs>
                            `}
                        <rect
                          x="5"
                          y="5"
                          width="10"
                          height="10"
                          rx="3"
                          style="${css`
                            stroke: none;
                            fill: ${gradient === undefined
                              ? "currentColor"
                              : `url('#fade--${gradient}')`};
                          `}"
                        />
                      </svg>
                      ${shortcut.toUpperCase()}
                    </label>
                  `
                )}
              </div>
            </form>

            <hr class="separator" />

            <div class="section">
              <label class="section--item">
                $${(() => {
                  ipcMain.on("ignoreMouseEvents", (_, ignoreMouseEvents) => {
                    drawing.setIgnoreMouseEvents(ignoreMouseEvents === "true");
                  });
                  return html``;
                })()}
                <input
                  type="radio"
                  name="ignoreMouseEvents"
                  value="false"
                  checked
                  hidden
                  onchange="${javascript`
                    ipcRenderer.send(this.name, this.value);
                  `}"
                />
                <div class="section--item--icon">
                  <i class="far fa-edit"></i>
                </div>
                Z
              </label>
              <label class="section--item">
                <input
                  type="radio"
                  name="ignoreMouseEvents"
                  value="true"
                  hidden
                  onchange="${javascript`
                    ipcRenderer.send(this.name, this.value);
                  `}"
                />
                <div class="section--item--icon">
                  <i class="far fa-window-restore"></i>
                </div>
                X
              </label>
              <label class="section--item">
                <button
                  class="section--item--icon"
                  onclick="${(() => {
                    ipcMain.on("hide", () => {
                      drawing.hide();
                    });
                    return javascript`
                      ipcRenderer.send("hide");
                    `;
                  })()}"
                >
                  <i class="far fa-window-close"></i>
                </button>
                ?
              </label>
            </div>
          </body>
        </html>
      `
    )
  );

  globalShortcut.register("Control+Alt+Command+Space", () => {
    drawing.show();
  });

  const tray = new Tray(path.join(__dirname, "logo@2x.png"));
  tray.setToolTip("Notestrator");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Draw",
        accelerator: "Control+Alt+Command+Space",
        click: () => {
          drawing.show();
        },
      },
      {
        label: "Quit",
        click: () => {
          drawing.destroy();
          menu.destroy();
        },
      },
    ])
  );
  app.addListener("accessibility-support-changed", () => {
    tray;
  });

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Shortcuts",
        submenu: [...shortcuts.entries()].map(([accelerator, click]) => ({
          label: `Shortcut ${accelerator}`,
          accelerator,
          click,
        })),
      },
    ])
  );

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
              --space--2: var(--space--2);

              @at-root {
                .separator {
                  border-top: var(--border-width--1) solid
                    var(--color--gray--warm--200);
                  @media (prefers-color-scheme: dark) {
                    border-color: var(--color--gray--warm--800);
                  }
                  margin: var(--space--2) var(--space--0);
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
                padding: var(--space--1) var(--space--2);
                -webkit-app-region: drag;
              `}"
            >
              Notestrator
            </div>
            <form
              style="${css`
                padding: var(--space--2) var(--space--2);
              `}"
            >
              <div
                style="${css`
                  display: grid;
                  grid-template-columns: 1fr 1fr;
                  gap: var(--space--2);
                  column-gap: var(--space--4);
                  row-gap: var(--space--2);
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
                ><input type="radio" name="tool" value="highlighter" /> highlighter</label
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
              <g class="highlighter"></g>
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
                  case "highlighter":
                    const group = drawing.querySelector(\`.\${menu.tool}\`);
                    group.insertAdjacentHTML(
                      "beforeend",
                      \`
                    <path
                      d="M \${event.offsetX} \${event.offsetY}"
                      fill="none"
                      stroke="\${menu.color}"
                      stroke-width="\${
                        menu.strokeWidth * (menu.tool === "highlighter" ? 3 : 1)
                      }"
                      stroke-opacity="\${menu.tool === "highlighter" ? 0.5 : 1}"
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
