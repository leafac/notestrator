const { app, BrowserWindow, ipcMain, screen } = require("electron");
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
                      d="M \${event.x} \${event.y}"
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
                  let x0 = { x: event.x, y: event.y };
                  let x1 = { x: event.x, y: event.y };
                  let x2 = { x: event.x, y: event.y };
                  let p1 = { x: event.x, y: event.y };
                  let p2 = { x: event.x, y: event.y };
                  handleMousemove = (event) => {
                    // http://scaledinnovation.com/analytics/splines/aboutSplines.html
                    if (event.x === x2.x && event.y === x2.y) return;
                    x2 = { x: event.x, y: event.y };
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
                                (event.x - x) ** 2 + (event.y - y) ** 2
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
