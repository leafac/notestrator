- Full-screen applications aren’t working anymore.
- Flesh out the metadata for electron-builder.
- Test that the logo on the tray works on 1x displays.



### Backlog

- Custom cursor doesn’t go away on click-through mode.
- Multiple displays.
  - Improve on the `primaryDrawing` hack.
  - Rename `"drawing"` to `"drawings"` in `evaluate()`.
- Another styling pass on the menu.
  - “??”
  - Revisit the “Fade” section.
  - Refine the crosshair on the custom cursor.
  - Custom cursor isn’t going away when you switch to `ignoreMouseEvents` mode.
- Mouse modifiers:
  - Scroll.
  - Shift to keep line straight.
- Save the drawing: SVG & PNG with transparent background.

- [ ] touchbar
- [ ] Menubar icons should be 32x32
- [ ] Start at login

- [ ] - [ ] TLDraw
  - [ ] excalidraw
  - [ ] Smooth drawing
    - [ ] http://paperjs.org/tutorials/paths/smoothing-simplifying-flattening/
    - [ ] Smooth
      - [ ] https://developer.mozilla.org/en-US/docs/Web/SVG/Element/path
      - [ ] https://github.com/paperjs/paper.js/blob/develop/src/path/Path.js#L1288
    - [ ] Simplify
      - [ ] http://paperjs.org/examples/path-simplification/
        - [ ] https://github.com/paperjs/paper.js/blob/3ef3ca66d5a615df53f001331081396ae701c276/src/path/PathFitter.js
      - [ ] https://github.com/soswow/fit-curve
      - [ ] https://github.com/odiak/fit-curve
  - [ ] A bookmarklet to annotate any web page

  - [ ]
  - [ ] https://github.com/serge-rgb/milton

- [ ] https://discuss.atom.io/t/advice-on-creating-a-draw-on-screen-app/49401/15

### Notes About Packaging

- electron-packager
  - Low-level tool for packing your app into a .app, .exe, etc.
- electron-forge
  - Uses electron-packager and gives you more high-level tools
- electron-builder

  - Doesn’t use electron-packager, and is way more popular
  - Used by kap
  - Less intrusive, for example:
    - It doesn’t take over `npm start`, like Forge
    - It doesn’t install a bunch of development dependencies, like Forge

- Last resort: Do it manually https://www.electronjs.org/docs/latest/tutorial/application-distribution

- Forge isn’t using ASAR

- Builder is more popular than forge

- Icon
- Don’t include development dependencies
  - Forge gets this point
- Auto-update
  - The blockmap stuff from electron-builder looks great!
- Code signing
  - https://www.electronjs.org/docs/latest/tutorial/code-signing




```javascript
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
```