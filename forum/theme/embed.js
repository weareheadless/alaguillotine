// Loaded on every forum page. If the page is inside a frame, mark it so the
// theme can drop the chrome the host site already provides. Direct visits are
// untouched, and the class survives in-frame navigation.
if (window.self !== window.top) {
  document.documentElement.classList.add("ala-embedded");
}
