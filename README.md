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
