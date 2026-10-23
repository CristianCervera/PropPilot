// jsdom reports navigator.language = 'en-US'; the existing specs assert the
// Spanish UI, so start every test file in Spanish (i18n.spec switches itself).
try {
  localStorage.setItem('proppilot.lang', 'es');
} catch {
  // ignore
}
