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
const fs = require("fs/promises");

(async () => {
  if (!app.isPackaged) {
    const { html } = require("@leafac/html");
    const { css, extractInlineStyles } = require("@leafac/css");
    const javascript = require("tagged-template-noop");

    const shortcuts = {};

    await fs.writeFile(
      "drawing.html",
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
            this.setSettings = (settings) => {
              this.settings = settings;
              this.querySelector(".cursor").update(settings);
            };

            this.reset = () => {
              this.createUndoPoint();
              this.querySelector(".highlighter").replaceChildren();
              this.querySelector(".pen").replaceChildren();
            };

            this.undoStack = [];
            this.redoStack = [];
            this.createUndoPoint = () => {
              this.undoStack.push(this.querySelector("svg").innerHTML);
              this.redoStack.length = 0;
            };
            this.undo = () => {
              const undoSVGInnerHTML = this.undoStack.pop();
              if (undoSVGInnerHTML === undefined) return;
              const svg = this.querySelector("svg");
              this.redoStack.push(svg.innerHTML);
              svg.innerHTML = undoSVGInnerHTML;
            };
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
                  const isRightClick = event.button === 2;
                  const originalTool = drawing.settings.tool;
                  if (isRightClick)
                    await ipcRenderer.invoke("evaluate", {
                      process: "menu",
                      javascript: ${JSON.stringify(
                        javascript`
                          document.querySelector('[value="eraser"]').click();
                        `
                      )}
                    });
                  let handleMousemove;
                  let handleMouseup;
                  switch (drawing.settings.tool) {
                    case "pen":
                    case "highlighter":
                      if (drawing.settings.fade === "false") drawing.createUndoPoint();
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
                      let undoPointCreated = false;
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

                        if (!undoPointCreated && elementsToRemove.size > 0) {
                          undoPointCreated = true;
                          drawing.createUndoPoint();
                        }
                        for (const element of elementsToRemove) element.remove();
                      };
                      break;
                  }
                  window.addEventListener("mousemove", handleMousemove);
                  window.addEventListener(
                    "mouseup",
                    () => {
                      if (isRightClick)
                        ipcRenderer.invoke("evaluate", {
                          process: "menu",
                          javascript: \`
                            document.querySelector('[value="\${ originalTool }"]').click();
                          \`
                        });
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
              this.update = (settings) => {
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
              };
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
    await fs.writeFile(
      "menu.html",
      extractInlineStyles(
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
                    &.section--item--row {
                      flex-direction: row;
                      justify-content: space-between;
                    }
                  }

                  .section--item--label {
                    display: flex;
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
                data-ondomcontentloaded="${javascript`
                  const settings = () => {
                    ipcRenderer.invoke("evaluate", {
                      process: "drawings",
                      javascript: \`
                        document.querySelector(".drawing").setSettings(
                          \${JSON.stringify(Object.fromEntries(new URLSearchParams(new FormData(this))))}
                        );
                      \`
                    });
                  };
                  settings();
                  this.addEventListener("change", settings);
                `}"
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
                        <div
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
                              border: var(--border-width--1) solid
                                ${borderColor};
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
                              shortcuts[accelerator] = [
                                {
                                  process: "menu",
                                  javascript: javascript`
                                    document.querySelector('[name="color"][value="${color}"]').click();
                                  `,
                                },
                              ];
                              return html``;
                            })()}
                          />
                          ${accelerator}
                        </div>
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
                        <div class="section--item">
                          <label>
                            <input
                              type="radio"
                              name="strokeWidth"
                              value="${strokeWidth}"
                              hidden
                              $${isDefault ? html`checked` : html``}
                              ${(() => {
                                shortcuts[accelerator] = [
                                  {
                                    process: "menu",
                                    javascript: javascript`
                                      document.querySelector('[name="strokeWidth"][value="${strokeWidth}"]').click();
                                    `,
                                  },
                                ];
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
                          </label>
                          ${accelerator.toUpperCase()}
                        </div>
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
                        <div class="section--item">
                          <label>
                            <input
                              type="radio"
                              name="tool"
                              value="${tool}"
                              hidden
                              $${isDefault ? html`checked` : html``}
                              ${(() => {
                                shortcuts[accelerator] = [
                                  {
                                    process: "menu",
                                    javascript: javascript`
                                      document.querySelector('[name="tool"][value="${tool}"]').click();
                                    `,
                                  },
                                ];
                                return html``;
                              })()}
                            />
                            <div class="section--item--icon">
                              <i class="fas fa-${icon}"></i>
                            </div>
                          </label>
                          ${accelerator.toUpperCase()}
                        </div>
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
                        <div class="section--item">
                          <label>
                            <input
                              type="radio"
                              name="fade"
                              value="${fade}"
                              hidden
                              $${isDefault ? html`checked` : html``}
                              ${(() => {
                                shortcuts[accelerator] = [
                                  {
                                    process: "menu",
                                    javascript: javascript`
                                      document.querySelector('[name="fade"][value="${fade}"]').click();
                                    `,
                                  },
                                ];
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
                          </label>
                          ${accelerator.toUpperCase()}
                        </div>
                      `
                    )}
                  </div>
                </div>
              </form>

              <hr class="separator" />

              <div class="section">
                <div class="section--heading">Mode</div>
                <div class="section--item section--item--row">
                  <label class="section--item--label">
                    <input
                      type="radio"
                      name="ignoreMouseEvents"
                      value="false"
                      checked
                      hidden
                      onchange="${javascript`
                        ipcRenderer.invoke("evaluate", {
                          process: "main",
                          javascript: ${JSON.stringify(
                            javascript`
                              for (const drawing of drawings) drawing.setIgnoreMouseEvents(false);
                            `
                          )}
                        });
                      `}"
                    />
                    <div class="section--item--icon">
                      <i class="far fa-edit"></i>
                    </div>
                    Draw
                  </label>
                </div>
                <div class="section--item section--item--row">
                  <label class="section--item--label">
                    <input
                      type="radio"
                      name="ignoreMouseEvents"
                      value="true"
                      hidden
                      onchange="${(() => {
                        shortcuts["`"] = [
                          {
                            process: "menu",
                            javascript: javascript`
                              document.querySelector('[name="ignoreMouseEvents"][value="true"]').click();
                            `,
                          },
                          {
                            process: "drawings",
                            javascript: javascript`
                              document.querySelector(".cursor").hidden = true;
                            `,
                          },
                        ];
                        return javascript`
                          ipcRenderer.invoke("evaluate", {
                            process: "main",
                            javascript: ${JSON.stringify(
                              javascript`
                              for (const drawing of drawings) drawing.setIgnoreMouseEvents(true);
                              `
                            )}
                          });
                        `;
                      })()}"
                    />
                    <div class="section--item--icon">
                      <i class="far fa-window-restore"></i>
                    </div>
                    Show
                  </label>
                  ${"`"}
                </div>
              </div>

              <hr class="separator" />

              <div class="section">
                <div class="section--heading">Hide</div>
                <div class="section--item section--item--row">
                  <button
                    class="section--item--label hide"
                    onclick="${(() => {
                      shortcuts["Esc"] = [
                        {
                          process: "menu",
                          javascript: javascript`
                            document.querySelector(".hide").click();
                          `,
                        },
                      ];
                      return javascript`
                        ipcRenderer.invoke("evaluate", {
                          process: "main",
                          javascript: ${JSON.stringify(
                            javascript`
                              for (const drawing of drawings) drawing.hide();
                            `
                          )}
                        });
                      `;
                    })()}"
                  >
                    <div class="section--item--icon">
                      <i class="far fa-window-close"></i>
                    </div>
                    Drawing
                  </button>
                  ⎋
                </div>
                <div class="section--item section--item--row">
                  <button
                    class="section--item--label hide--menu"
                    onclick="${(() => {
                      shortcuts["Command+Esc"] = [
                        {
                          process: "menu",
                          javascript: javascript`
                            document.querySelector(".hide--menu").click();
                          `,
                        },
                      ];
                      return javascript`
                        ipcRenderer.invoke("evaluate", {
                          process: "main",
                          javascript: ${JSON.stringify(
                            javascript`
                              if (menu.isVisible()) menu.hide();
                              else menu.show();
                            `
                          )}
                        });
                      `;
                    })()}"
                  >
                    <div class="section--item--icon">
                      <i class="far fa-eye-slash"></i>
                    </div>
                    Menu
                  </button>
                  ⌘⎋
                </div>
              </div>

              <hr class="separator" />

              <div class="section">
                <div class="section--content">
                  <button
                    class="section--item quit"
                    onclick="${(() => {
                      shortcuts["Command+Q"] = [
                        {
                          process: "menu",
                          javascript: javascript`
                            document.querySelector(".quit").click();
                          `,
                        },
                      ];
                      return javascript`
                        ipcRenderer.invoke("evaluate", {
                          process: "main",
                          javascript: ${JSON.stringify(
                            javascript`
                              quit();
                            `
                          )}
                        });
                      `;
                    })()}"
                  >
                    <div class="section--item--icon">
                      <i class="fas fa-power-off"></i>
                    </div>
                    ⌘Q
                  </button>

                  <button
                    class="section--item reset-drawing"
                    onclick="${(() => {
                      shortcuts["Backspace"] = [
                        {
                          process: "menu",
                          javascript: javascript`
                            document.querySelector(".reset-drawing").click();
                          `,
                        },
                      ];
                      return javascript`
                        ipcRenderer.invoke("evaluate", {
                          process: "drawings",
                          javascript: ${JSON.stringify(
                            javascript`
                              document.querySelector(".drawing").reset();
                            `
                          )}
                        });
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
                      shortcuts["Command+Z"] = [
                        {
                          process: "menu",
                          javascript: javascript`
                            document.querySelector(".undo").click();
                          `,
                        },
                      ];
                      return javascript`
                        ipcRenderer.invoke("evaluate", {
                          process: "drawings",
                          javascript: ${JSON.stringify(
                            javascript`
                              document.querySelector(".drawing").undo();
                            `
                          )}
                        });
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
                      shortcuts["Shift+Command+Z"] = [
                        {
                          process: "menu",
                          javascript: javascript`
                            document.querySelector(".redo").click();
                          `,
                        },
                      ];
                      return javascript`
                        ipcRenderer.invoke("evaluate", {
                          process: "drawings",
                          javascript: ${JSON.stringify(
                            javascript`
                              document.querySelector(".drawing").redo();
                            `
                          )}
                        });
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
    await fs.writeFile(
      "shortcuts.json",
      JSON.stringify(shortcuts, undefined, 2)
    );
  }

  await app.whenReady();

  const drawings = screen.getAllDisplays().map((display) => {
    const drawing = new BrowserWindow({
      ...display.bounds,
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
        nativeWindowOpen: true,
      },
    });
    drawing.setAlwaysOnTop(true, "screen-saver", 1);
    drawing.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    drawing.loadFile(path.join(__dirname, "drawing.html"));
    return drawing;
  });

  const menu = new BrowserWindow({
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
      nativeWindowOpen: true,
    },
  });
  menu.setAlwaysOnTop(true, "screen-saver", 2); // FIXME: Apple recommends that you don’t go over screen-saver 1.
  menu.loadFile(path.join(__dirname, "menu.html"));

  async function evaluate({ process, javascript }) {
    switch (process) {
      case "main":
        return eval(javascript);
      case "drawings":
        const evaluationResults = [];
        for (const drawing of drawings)
          evaluationResults.push(
            await drawing.webContents.executeJavaScript(javascript)
          );
        return evaluationResults;
      case "menu":
        return await menu.webContents.executeJavaScript(javascript);
      default:
        throw new Error(`Process not found: ‘${process}’`);
    }
  }

  ipcMain.handle("evaluate", async (_, evaluationConfiguration) => {
    return await evaluate(evaluationConfiguration);
  });

  globalShortcut.register("Control+Alt+Command+Space", () => {
    show();
  });

  const tray = new Tray(path.join(__dirname, "logo@2x.png"));
  tray.setToolTip("Notestrator");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: "Draw",
        accelerator: "Control+Alt+Command+Space",
        click: () => {
          show();
        },
      },
      {
        label: "Quit",
        accelerator: "Command+Q",
        click: () => {
          quit();
        },
      },
    ])
  );

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "Shortcuts",
        submenu: [
          ...Object.entries(
            JSON.parse(
              await fs.readFile(path.join(__dirname, "shortcuts.json"), "utf8")
            )
          ),
        ].map(([accelerator, evaluationConfigurations]) => ({
          label: `Shortcut ${accelerator}`,
          accelerator,
          click: () => {
            for (const evaluationConfiguration of evaluationConfigurations)
              evaluate(evaluationConfiguration);
          },
        })),
      },
    ])
  );

  function show() {
    for (const drawing of drawings) drawing.show();
    menu.show();
  }

  function quit() {
    for (const drawing of drawings) drawing.destroy();
    menu.destroy();
  }
})();
