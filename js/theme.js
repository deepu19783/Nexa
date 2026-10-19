
const THEME_KEY = "nexa-ai-theme";

export function applySavedTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
  document.documentElement.dataset.theme = savedTheme;
  updateThemeButton(savedTheme);
}

export function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme || "dark";
  const nextTheme = currentTheme === "dark" ? "light" : "dark";

  document.documentElement.dataset.theme = nextTheme;
  localStorage.setItem(THEME_KEY, nextTheme);
  updateThemeButton(nextTheme);
}

function updateThemeButton(theme) {
  const button = document.getElementById("themeButton");

  if (button) {
    button.innerHTML = theme === "dark"
      ? "☀ <span>Light mode</span>"
      : "☾ <span>Dark mode</span>";
  }
}
