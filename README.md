### Backlog

- Use the `executeJavaScript` event throughout the application.
- Only build the HTML, CSS, and client-side JavaScript in development.

- Another styling pass on the menu.
  - “??”
  - Revisit the “Fade” section.
  - Refine the crosshair on the custom cursor.
  - Custom cursor isn’t going away when you switch to `ignoreMouseEvents` mode.
- Mouse modifiers:
  - Scroll.
  - Shift to keep line straight.
- Save the drawing: SVG & PNG with transparent background.

- Don’t create undo point if used eraser and nothing changed
- What happens if you control z in the middle of drawing?

- [ ] touchbar
- [ ] Menubar icons should be 32x32
- [ ] Start at login

- [ ] 
    - [ ] TLDraw
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
