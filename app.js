/**
 * Scheduology - Simple SPA Router
 * Handles hash-based navigation for the application
 */

// DOM Elements
const landingEl = document.getElementById('landing');
const authEl = document.getElementById('auth');
const appEl = document.getElementById('app');

// Navigation function
function navigate() {
  const hash = window.location.hash || '#/';
  const path = hash.substring(1) || '/';
  
  // Hide all views
  if (landingEl) landingEl.classList.add('hidden');
  if (authEl) authEl.classList.add('hidden');
  if (appEl) appEl.classList.add('hidden');
  
  // Show appropriate view based on path
  if (path === '/' || path === '') {
    // Landing page
    if (landingEl) landingEl.classList.remove('hidden');
  } else if (path.startsWith('login') || path.startsWith('signup')) {
    // Authentication views
    if (authEl) authEl.classList.remove('hidden');
    
    // If there's a specific auth form to show, handle it here
    // For now, just showing the auth shell is sufficient
  } else if (path.startsWith('today') || path.startsWith('courses') || 
             path.startsWith('semester') || path.startsWith('settings')) {
    // Application views - require authentication
    // In a real app, you'd check if user is logged in first
    if (appEl) appEl.classList.remove('hidden');
  } else {
    // Default to landing page for unknown routes
    if (landingEl) landingEl.classList.remove('hidden');
  }
  
  // Update nav links active state
  updateNavLinks(path);
}

// Update navigation links active state
function updateNavLinks(currentPath) {
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    const linkPath = link.getAttribute('href').substring(1);
    if (currentPath.startsWith(linkPath)) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// Demo button handler
function setupDemoButton() {
  const demoBtn = document.getElementById('demo-btn');
  if (demoBtn) {
    demoBtn.addEventListener('click', function() {
      // Store demo flag
      localStorage.setItem('scheduology_demo', 'true');
      // Navigate to app
      window.location.hash = '#today';
      navigate();
    });
  }
}

// Logout button handler
function setupLogoutButton() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      // Clear auth
      localStorage.removeItem('scheduology_user');
      localStorage.removeItem('scheduology_demo');
      // Navigate to landing
      window.location.hash = '#/';
      navigate();
    });
  }
}

// Initialize the application
function init() {
  // Set up event listeners
  window.addEventListener('hashchange', navigate);
  
  // Set up button handlers
  setupDemoButton();
  setupLogoutButton();
  
  // Initial navigation
  navigate();
}

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
