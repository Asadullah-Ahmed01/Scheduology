/**
 * Scheduology - Manual Theme Toggle
 * Custom implementation for vanilla JS (not Next.js)
 * Defaults to light mode, remembers user preference
 */

const THEME_KEY = 'scheduology_theme';
const DARK_CLASS = 'dark-mode';

/**
 * Initialize theme system
 */
function initTheme() {
  // Get stored theme preference, default to 'light'
  const storedTheme = localStorage.getItem(THEME_KEY) || 'light';
  
  // Apply the theme
  applyTheme(storedTheme);
  
  // Set up toggle button
  setupThemeToggle();
}

/**
 * Apply theme to document
 * @param {string} theme - 'light' or 'dark'
 */
function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add(DARK_CLASS);
  } else {
    document.documentElement.classList.remove(DARK_CLASS);
  }
  
  // Update any theme-dependent elements
  updateThemeDependentElements(theme);
}

/**
 * Update elements that need theme-specific adjustments
 * @param {string} theme
 */
function updateThemeDependentElements(theme) {
  // This can be expanded for any elements that need special handling
  const toggleBtn = document.getElementById('theme-toggle');
  if (toggleBtn) {
    const icon = toggleBtn.querySelector('.theme-icon');
    if (icon) {
      icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
  }
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
  const currentTheme = document.documentElement.classList.contains(DARK_CLASS) ? 'dark' : 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  // Save preference
  localStorage.setItem(THEME_KEY, newTheme);
  
  // Apply new theme
  applyTheme(newTheme);
}

/**
 * Get current theme
 * @returns {string} 'light' or 'dark'
 */
function getTheme() {
  return document.documentElement.classList.contains(DARK_CLASS) ? 'dark' : 'light';
}

/**
 * Set up theme toggle button
 */
function setupThemeToggle() {
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) return;
  
  // Set initial icon
  const currentTheme = getTheme();
  const icon = document.createElement('span');
  icon.className = 'theme-icon';
  icon.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
  toggleBtn.appendChild(icon);
  
  // Add click handler
  toggleBtn.addEventListener('click', toggleTheme);
}

/**
 * Check if dark mode is active
 * @returns {boolean}
 */
function isDarkMode() {
  return document.documentElement.classList.contains(DARK_CLASS);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initTheme,
    toggleTheme,
    getTheme,
    isDarkMode
  };
}
