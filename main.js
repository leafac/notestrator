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
              this.undoStack = [];
              this.undo = () => {
                const undoSVGInnerHTML = this.undoStack.pop();
                if (undoSVGInnerHTML === undefined) return;
                const svg = this.querySelector("svg");
                this.redoStack.push(svg.innerHTML);
                svg.innerHTML = undoSVGInnerHTML;
              };
              this.redoStack = [];
              this.redo = () => {
                const redoSVGInnerHTML = this.redoStack.pop();
                if (redoSVGInnerHTML === undefined) return;
                const svg = this.querySelector("svg");
                this.undoStack.push(svg.innerHTML);
                svg.innerHTML = redoSVGInnerHTML;
              };
            `}"
          >
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
                    this.closest(".drawing").undoStack.push(this.innerHTML);
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
                          d="M \${event.clientX} \${event.clientY}"
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
                        let x0 = { x: event.clientX, y: event.clientY };
                        let x1 = { x: event.clientX, y: event.clientY };
                        let x2 = { x: event.clientX, y: event.clientY };
                        let p1 = { x: event.clientX, y: event.clientY };
                        let p2 = { x: event.clientX, y: event.clientY };
                        handleMousemove = (event) => {
                          // http://scaledinnovation.com/analytics/splines/aboutSplines.html
                          if (event.clientX === x2.x && event.clientY === x2.y)
                            return;
                          x2 = { x: event.clientX, y: event.clientY };
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
                                      (event.clientX - x) ** 2 +
                                        (event.clientY - y) ** 2
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
            <div
              class="cursor"
              style="${css`
                position: absolute;
                width: 15px;
                height: 15px;
                transform: translate(-50%, -50%);
                color: var(--color--red--600);
              `}"
              data-ondomcontentloaded="${javascript`
                document.addEventListener("mouseenter", (event) => {
                  this.hidden = false;
                });
                document.addEventListener("mouseleave", (event) => {
                  this.hidden = true;
                });
                new MutationObserver(() => {
                  this.closest(".drawing").style.cursor = this.hidden ? "default" : "none";
                }).observe(this, { attributes: true, attributeFilter: ["hidden"] });
                document.addEventListener("mousemove", (event) => {
                  this.style.top = String(event.clientY) + "px";
                  this.style.left = String(event.clientX) + "px";
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
          </div>
        </body>
      </html>
    `)
  );

  const menu = new BrowserWindow({
    parent: drawing,
    ...screen.getPrimaryDisplay().bounds,
    width: 96, // var(--width--sm)
    height: 576, // var(--width--xl)
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
                  display: flex;
                  flex-direction: column;
                  gap: var(--space--2);
                }

                .section--heading {
                  font-size: var(--font-size--2xs);
                  line-height: var(--line-height--2xs);
                  font-weight: var(--font-weight--bold);
                  color: var(--color--gray--warm--400);
                  text-align: center;
                  text-transform: uppercase;
                  letter-spacing: var(--letter-spacing--widest);
                }

                .section--content {
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
                  margin-top: var(--space--2);
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
              <div class="section">
                <div class="section--heading">Color</div>
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
                      accelerator: "1",
                      isDefault: true,
                    },
                    {
                      color: "var(--color--amber--600)",
                      borderColor: "var(--color--amber--500)",
                      accelerator: "2",
                    },
                    {
                      color: "var(--color--lime--600)",
                      borderColor: "var(--color--lime--500)",
                      accelerator: "3",
                    },
                    {
                      color: "var(--color--teal--600)",
                      borderColor: "var(--color--teal--500)",
                      accelerator: "4",
                    },
                    {
                      color: "var(--color--sky--600)",
                      borderColor: "var(--color--sky--500)",
                      accelerator: "5",
                    },
                    {
                      color: "var(--color--indigo--600)",
                      borderColor: "var(--color--indigo--500)",
                      accelerator: "6",
                    },
                    {
                      color: "var(--color--purple--600)",
                      borderColor: "var(--color--purple--500)",
                      accelerator: "7",
                    },
                    {
                      color: "var(--color--pink--600)",
                      borderColor: "var(--color--pink--500)",
                      accelerator: "8",
                    },
                    {
                      color: "var(--color--gray--warm--900)",
                      borderColor: "var(--color--gray--warm--700)",
                      accelerator: "9",
                    },
                    {
                      color: "var(--color--gray--warm--50)",
                      borderColor: "var(--color--gray--warm--200)",
                      checkedColor: "var(--color--gray--warm--600)",
                      accelerator: "0",
                    },
                  ].map(
                    ({
                      color,
                      borderColor,
                      checkedColor,
                      accelerator,
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
                            transition-duration: var(
                              --transition-duration--150
                            );
                            transition-timing-function: var(
                              --transition-timing-function--in-out
                            );
                          `}"
                          ${(() => {
                            shortcuts.set(accelerator, () => {
                              menu.webContents.executeJavaScript(javascript`
                              document.querySelector('[name="color"][value="${color}"]').click();
                            `);
                            });
                            return html``;
                          })()}
                        />
                        ${accelerator}
                      </label>
                    `
                  )}
                </div>
              </div>

              <hr class="separator" />

              <div class="section">
                <div class="section--heading">Width</div>
                <div class="section--content">
                  $${[
                    {
                      strokeWidth: 1,
                      accelerator: "q",
                    },
                    {
                      strokeWidth: 3,
                      accelerator: "w",
                      isDefault: true,
                    },
                    {
                      strokeWidth: 5,
                      accelerator: "e",
                    },
                  ].map(
                    ({ strokeWidth, accelerator, isDefault }) => html`
                      <label class="section--item">
                        <input
                          type="radio"
                          name="strokeWidth"
                          value="${strokeWidth}"
                          hidden
                          $${isDefault ? html`checked` : html``}
                          ${(() => {
                            shortcuts.set(accelerator, () => {
                              menu.webContents.executeJavaScript(javascript`
                              document.querySelector('[name="strokeWidth"][value="${strokeWidth}"]').click();
                            `);
                            });
                            return html``;
                          })()}
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
                        ${accelerator.toUpperCase()}
                      </label>
                    `
                  )}
                </div>
              </div>

              <hr class="separator" />

              <div class="section">
                <div class="section--heading">Tool</div>
                <div class="section--content">
                  $${[
                    {
                      tool: "pen",
                      icon: "pen-fancy",
                      accelerator: "a",
                      isDefault: true,
                    },
                    {
                      tool: "highlighter",
                      icon: "highlighter",
                      accelerator: "s",
                    },
                    {
                      tool: "eraser",
                      icon: "eraser",
                      accelerator: "d",
                    },
                  ].map(
                    ({ tool, icon, accelerator, isDefault }) => html`
                      <label class="section--item">
                        <input
                          type="radio"
                          name="tool"
                          value="${tool}"
                          hidden
                          $${isDefault ? html`checked` : html``}
                          ${(() => {
                            shortcuts.set(accelerator, () => {
                              menu.webContents.executeJavaScript(javascript`
                              document.querySelector('[name="tool"][value="${tool}"]').click();
                            `);
                            });
                            return html``;
                          })()}
                        />
                        <div class="section--item--icon">
                          <i class="fas fa-${icon}"></i>
                        </div>
                        ${accelerator.toUpperCase()}
                      </label>
                    `
                  )}
                </div>
              </div>

              <hr class="separator" />

              <div class="section">
                <div class="section--heading">Fade</div>
                <div class="section--content">
                  $${[
                    {
                      fade: "false",
                      accelerator: "z",
                      isDefault: true,
                    },
                    {
                      fade: "1500",
                      gradient: 100,
                      accelerator: "x",
                    },
                    {
                      fade: "500",
                      gradient: 60,
                      accelerator: "c",
                    },
                  ].map(
                    ({ fade, gradient, accelerator, isDefault }) => html`
                      <label class="section--item">
                        <input
                          type="radio"
                          name="fade"
                          value="${fade}"
                          hidden
                          $${isDefault ? html`checked` : html``}
                          ${(() => {
                            shortcuts.set(accelerator, () => {
                              menu.webContents.executeJavaScript(javascript`
                              document.querySelector('[name="fade"][value="${fade}"]').click();
                            `);
                            });
                            return html``;
                          })()}
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
                                    <stop
                                      offset="0%"
                                      stop-color="currentColor"
                                    />
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
                        ${accelerator.toUpperCase()}
                      </label>
                    `
                  )}
                </div>
              </div>
            </form>

            <hr class="separator" />

            <div class="section">
              <div class="section--heading">??</div>
              <div class="section--content">
                <label class="section--item">
                  $${(() => {
                    ipcMain.on("ignoreMouseEvents", (_, ignoreMouseEvents) => {
                      drawing.setIgnoreMouseEvents(
                        ignoreMouseEvents === "true"
                      );
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
                </label>
                <label class="section--item">
                  <input
                    type="radio"
                    name="ignoreMouseEvents"
                    value="true"
                    hidden
                    onchange="${(() => {
                      shortcuts.set("`", () => {
                        menu.webContents.executeJavaScript(javascript`
                        document.querySelector('[name="ignoreMouseEvents"][value="true"]').click();
                      `);
                        drawing.webContents.executeJavaScript(javascript`
                        document.querySelector(".cursor").hidden = true;
                      `);
                      });
                      return javascript`
                      ipcRenderer.send(this.name, this.value);
                    `;
                    })()}"
                  />
                  <div class="section--item--icon">
                    <i class="far fa-window-restore"></i>
                  </div>
                  ${"`"}
                </label>
                <button
                  class="section--item hide"
                  onclick="${(() => {
                    ipcMain.on("hide", () => {
                      drawing.hide();
                    });
                    shortcuts.set("Esc", () => {
                      menu.webContents.executeJavaScript(javascript`
                      document.querySelector(".hide").click();
                    `);
                    });
                    return javascript`
                    ipcRenderer.send("hide");
                  `;
                  })()}"
                >
                  <div class="section--item--icon">
                    <i class="far fa-window-close"></i>
                  </div>
                  ⎋
                </button>
                <button
                  class="section--item quit"
                  onclick="${(() => {
                    ipcMain.on("quit", () => {
                      quit();
                    });
                    shortcuts.set("Command+Q", () => {
                      menu.webContents.executeJavaScript(javascript`
                        document.querySelector(".quit").click();
                      `);
                    });
                    return javascript`
                      ipcRenderer.send("quit");
                    `;
                  })()}"
                >
                  <div class="section--item--icon">
                    <i class="fas fa-power-off"></i>
                  </div>
                  ⌘Q
                </button>
                <button
                  class="section--item hide--menu"
                  onclick="${(() => {
                    ipcMain.on("hide--menu", () => {
                      if (menu.isVisible()) menu.hide();
                      else menu.show();
                    });
                    shortcuts.set("Command+Esc", () => {
                      menu.webContents.executeJavaScript(javascript`
                        document.querySelector(".hide--menu").click();
                      `);
                    });
                    return javascript`
                      ipcRenderer.send("hide--menu");
                    `;
                  })()}"
                >
                  <div class="section--item--icon">
                    <i class="far fa-eye-slash"></i>
                  </div>
                  ⌘⎋
                </button>
                <button
                  class="section--item reset-drawing"
                  onclick="${(() => {
                    ipcMain.on("reset-drawing", () => {
                      drawing.webContents.executeJavaScript(javascript`
                        (() => {
                          const drawing = document.querySelector(".drawing");
                          drawing.querySelector(".highlighter").replaceChildren();
                          drawing.querySelector(".pen").replaceChildren();
                        })();
                      `);
                    });
                    shortcuts.set("Backspace", () => {
                      menu.webContents.executeJavaScript(javascript`
                        document.querySelector(".reset-drawing").click();
                      `);
                    });
                    return javascript`
                      ipcRenderer.send("reset-drawing");
                    `;
                  })()}"
                >
                  <div class="section--item--icon">
                    <i class="fas fa-backspace"></i>
                  </div>
                  ⌫
                </button>
                <button
                  class="section--item undo"
                  onclick="${(() => {
                    ipcMain.on("undo", () => {
                      drawing.webContents.executeJavaScript(javascript`
                        document.querySelector(".drawing").undo();
                      `);
                    });
                    shortcuts.set("Command+Z", () => {
                      menu.webContents.executeJavaScript(javascript`
                        document.querySelector(".undo").click();
                      `);
                    });
                    return javascript`
                      ipcRenderer.send("undo");
                    `;
                  })()}"
                >
                  <div class="section--item--icon">
                    <i class="fas fa-undo-alt"></i>
                  </div>
                  ⌘Z
                </button>
                <button
                  class="section--item redo"
                  onclick="${(() => {
                    ipcMain.on("redo", () => {
                      drawing.webContents.executeJavaScript(javascript`
                        document.querySelector(".drawing").redo();
                      `);
                    });
                    shortcuts.set("Shift+Command+Z", () => {
                      menu.webContents.executeJavaScript(javascript`
                        document.querySelector(".redo").click();
                      `);
                    });
                    return javascript`
                      ipcRenderer.send("redo");
                    `;
                  })()}"
                >
                  <div class="section--item--icon">
                    <i class="fas fa-redo-alt"></i>
                  </div>
                  ⇧⌘Z
                </button>
              </div>
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
        accelerator: "Command+Q",
        click: quit,
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

  function quit() {
    drawing.destroy();
    menu.destroy();
  }

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
                      d="M \${event.clientX} \${event.clientY}"
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
                    let x0 = { x: event.clientX, y: event.clientY };
                    let x1 = { x: event.clientX, y: event.clientY };
                    let x2 = { x: event.clientX, y: event.clientY };
                    let p1 = { x: event.clientX, y: event.clientY };
                    let p2 = { x: event.clientX, y: event.clientY };
                    handleMousemove = (event) => {
                      // http://scaledinnovation.com/analytics/splines/aboutSplines.html
                      if (event.clientX === x2.x && event.clientY === x2.y)
                        return;
                      x2 = { x: event.clientX, y: event.clientY };
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
                                  (event.clientX - x) ** 2 +
                                    (event.clientY - y) ** 2
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
