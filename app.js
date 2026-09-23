/**
 * Scheduology - Main Application
 * Handles all navigation, page rendering, and user interactions
 */

// ============================================
// DOM ELEMENTS
// ============================================

const landingEl = document.getElementById('landing');
const authEl = document.getElementById('auth');
const appEl = document.getElementById('app');
const pageEl = document.getElementById('page');
const navLinksEl = document.getElementById('nav-links');
const navUserEl = document.getElementById('nav-user');

// ============================================
// STATE
// ============================================

let currentUser = null;
let currentSemester = null;
let currentCourses = [];
let currentTimetable = null;
let allAttendance = {};
let currentView = 'landing';

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize the application
 */
function init() {
  // Load initial data
  loadInitialData();
  
  // Set up event listeners
  setupEventListeners();
  
  // Set up navigation
  setupNavigation();
  
  // Initial navigation
  navigate();
}

/**
 * Load initial data from storage
 */
function loadInitialData() {
  // Check if user is logged in
  const userData = localStorage.getItem('scheduology_user');
  if (userData) {
    try {
      currentUser = JSON.parse(userData);
    } catch (e) {
      console.error('Failed to parse user data:', e);
    }
  }
  
  // Check if in demo mode
  const demoMode = localStorage.getItem('scheduology_demo') === 'true';
  
  // Load semester data
  const userId = currentUser?.id || (demoMode ? 'demo' : null);
  if (userId) {
    loadSemesterData(userId);
  }
}

/**
 * Load semester data for a user
 * @param {string} userId
 */
function loadSemesterData(userId) {
  // Load semester
  const semesterData = localStorage.getItem(`scheduology_semester_${userId}`);
  if (semesterData) {
    try {
      currentSemester = JSON.parse(semesterData);
    } catch (e) {
      console.error('Failed to parse semester data:', e);
    }
  }
  
  // Load courses
  const coursesData = localStorage.getItem(`scheduology_courses_${userId}`);
  if (coursesData) {
    try {
      currentCourses = JSON.parse(coursesData);
    } catch (e) {
      console.error('Failed to parse courses data:', e);
    }
  }
  
  // Load timetable
  const timetableData = localStorage.getItem(`scheduology_timetable_${userId}`);
  if (timetableData) {
    try {
      currentTimetable = JSON.parse(timetableData);
    } catch (e) {
      console.error('Failed to parse timetable data:', e);
    }
  }
  
  // Load attendance
  const attendanceData = localStorage.getItem(`scheduology_attendance_${userId}`);
  if (attendanceData) {
    try {
      allAttendance = JSON.parse(attendanceData);
    } catch (e) {
      console.error('Failed to parse attendance data:', e);
    }
  }
}

// ============================================
// EVENT LISTENERS
// ============================================

/**
 * Set up all event listeners
 */
function setupEventListeners() {
  // Hash change navigation
  window.addEventListener('hashchange', navigate);
  
  // Demo button
  const demoBtn = document.getElementById('demo-btn');
  if (demoBtn) {
    demoBtn.addEventListener('click', handleDemoClick);
  }
  
  // Logout button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogoutClick);
  }
  
  // Brand/logo click - go to home
  const brandLinks = document.querySelectorAll('.brand');
  brandLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      if (href) {
        window.location.hash = href;
        navigate();
      }
    });
  });
}

// ============================================
// NAVIGATION
// ============================================

/**
 * Set up navigation links
 */
function setupNavigation() {
  // This will be populated when user is logged in
  // For now, just handle the basic navigation
}

/**
 * Main navigation function
 */
function navigate() {
  const hash = window.location.hash || '#/';
  const path = hash.substring(1) || '/';
  
  // Hide all views
  if (landingEl) landingEl.classList.add('hidden');
  if (authEl) authEl.classList.add('hidden');
  if (appEl) appEl.classList.add('hidden');
  
  // Determine which view to show
  if (path === '/' || path === '') {
    showLandingPage();
  } else if (path.startsWith('login')) {
    showLoginPage();
  } else if (path.startsWith('signup')) {
    showSignupPage();
  } else if (path.startsWith('today')) {
    showTodayPage();
  } else if (path.startsWith('courses')) {
    showCoursesPage();
  } else if (path.startsWith('semester')) {
    showSemesterPage();
  } else if (path.startsWith('settings')) {
    showSettingsPage();
  } else {
    // Unknown route - show landing page
    window.location.hash = '#/';
    showLandingPage();
  }
  
  // Update nav links active state
  updateNavLinks(path);
}

/**
 * Update navigation links active state
 * @param {string} currentPath
 */
function updateNavLinks(currentPath) {
  if (!navLinksEl) return;
  
  const navLinks = navLinksEl.querySelectorAll('a');
  navLinks.forEach(link => {
    const linkPath = link.getAttribute('href').substring(1);
    if (currentPath.startsWith(linkPath)) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

// ============================================
// PAGE HANDLERS
// ============================================

/**
 * Show landing page
 */
function showLandingPage() {
  if (landingEl) {
    landingEl.classList.remove('hidden');
  }
  currentView = 'landing';
  
  // Scroll to top
  window.scrollTo(0, 0);
}

/**
 * Show login page
 */
function showLoginPage() {
  if (authEl) {
    authEl.classList.remove('hidden');
    renderLoginForm();
  }
  currentView = 'login';
  window.scrollTo(0, 0);
}

/**
 * Show signup page
 */
function showSignupPage() {
  if (authEl) {
    authEl.classList.remove('hidden');
    renderSignupForm();
  }
  currentView = 'signup';
  window.scrollTo(0, 0);
}

/**
 * Show today's classes page
 */
function showTodayPage() {
  // Check if user is logged in or in demo mode
  const isLoggedIn = currentUser !== null;
  const isDemo = localStorage.getItem('scheduology_demo') === 'true';
  
  if (!isLoggedIn && !isDemo) {
    // Redirect to landing page
    window.location.hash = '#/';
    navigate();
    return;
  }
  
  if (appEl) {
    appEl.classList.remove('hidden');
    renderTodayPage();
    renderAppNav();
  }
  currentView = 'today';
  window.scrollTo(0, 0);
}

/**
 * Show courses page
 */
function showCoursesPage() {
  const isLoggedIn = currentUser !== null;
  const isDemo = localStorage.getItem('scheduology_demo') === 'true';
  
  if (!isLoggedIn && !isDemo) {
    window.location.hash = '#/';
    navigate();
    return;
  }
  
  if (appEl) {
    appEl.classList.remove('hidden');
    renderCoursesPage();
    renderAppNav();
  }
  currentView = 'courses';
  window.scrollTo(0, 0);
}

/**
 * Show semester setup page
 */
function showSemesterPage() {
  const isLoggedIn = currentUser !== null;
  const isDemo = localStorage.getItem('scheduology_demo') === 'true';
  
  if (!isLoggedIn && !isDemo) {
    window.location.hash = '#/';
    navigate();
    return;
  }
  
  if (appEl) {
    appEl.classList.remove('hidden');
    renderSemesterPage();
    renderAppNav();
  }
  currentView = 'semester';
  window.scrollTo(0, 0);
}

/**
 * Show settings page
 */
function showSettingsPage() {
  const isLoggedIn = currentUser !== null;
  const isDemo = localStorage.getItem('scheduology_demo') === 'true';
  
  if (!isLoggedIn && !isDemo) {
    window.location.hash = '#/';
    navigate();
    return;
  }
  
  if (appEl) {
    appEl.classList.remove('hidden');
    renderSettingsPage();
    renderAppNav();
  }
  currentView = 'settings';
  window.scrollTo(0, 0);
}

// ============================================
// RENDER FUNCTIONS
// ============================================

/**
 * Render login form
 */
function renderLoginForm() {
  const authCard = document.getElementById('auth-card');
  if (!authCard) return;
  
  authCard.innerHTML = `
    <div class="page-title">
      <h1>Log in</h1>
      <p>Sign in to access your attendance data</p>
    </div>
    
    <form id="login-form" class="cards">
      <div class="card">
        <div class="field">
          <span>Email</span>
          <input type="email" id="login-email" placeholder="your@email.com" required />
        </div>
        <div class="field">
          <span>Password</span>
          <input type="password" id="login-password" placeholder="Enter your password" required />
        </div>
        <button type="submit" class="btn btn-primary btn-block">Log in</button>
      </div>
      
      <div class="card" style="text-align: center;">
        <p class="tiny">Don't have an account? <a href="#/signup" style="color: var(--pine);">Create one</a></p>
      </div>
    </form>
  `;
  
  // Set up form submission
  const form = authCard.querySelector('#login-form');
  if (form) {
    form.addEventListener('submit', handleLoginSubmit);
  }
}

/**
 * Render signup form
 */
function renderSignupForm() {
  const authCard = document.getElementById('auth-card');
  if (!authCard) return;
  
  authCard.innerHTML = `
    <div class="page-title">
      <h1>Create account</h1>
      <p>Start tracking your attendance</p>
    </div>
    
    <form id="signup-form" class="cards">
      <div class="card">
        <div class="field">
          <span>Name</span>
          <input type="text" id="signup-name" placeholder="Your full name" required />
        </div>
        <div class="field">
          <span>Email</span>
          <input type="email" id="signup-email" placeholder="your@email.com" required />
        </div>
        <div class="field">
          <span>Password</span>
          <input type="password" id="signup-password" placeholder="Create a password" required minlength="8" />
        </div>
        <div class="field">
          <span>University Attendance Requirement (%)</span>
          <select id="signup-requirement" required>
            <option value="75">75%</option>
            <option value="80">80%</option>
            <option value="85">85%</option>
            <option value="90">90%</option>
          </select>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Create account</button>
      </div>
      
      <div class="card" style="text-align: center;">
        <p class="tiny">Already have an account? <a href="#/login" style="color: var(--pine);">Log in</a></p>
      </div>
    </form>
  `;
  
  // Set up form submission
  const form = authCard.querySelector('#signup-form');
  if (form) {
    form.addEventListener('submit', handleSignupSubmit);
  }
}

/**
 * Render app navigation
 */
function renderAppNav() {
  if (!navLinksEl) return;
  
  // Clear existing links
  navLinksEl.innerHTML = '';
  
  // Add navigation links
  const links = [
    { href: '#today', text: 'Today' },
    { href: '#courses', text: 'Courses' },
    { href: '#semester', text: 'Semester' },
    { href: '#settings', text: 'Settings' }
  ];
  
  links.forEach(link => {
    const a = document.createElement('a');
    a.href = link.href;
    a.textContent = link.text;
    a.classList.add('nav-link');
    navLinksEl.appendChild(a);
  });
  
  // Update user display
  if (navUserEl) {
    if (currentUser) {
      navUserEl.textContent = currentUser.name || currentUser.email || 'User';
    } else if (localStorage.getItem('scheduology_demo') === 'true') {
      navUserEl.textContent = 'Demo Mode';
    } else {
      navUserEl.textContent = '';
    }
  }
}

/**
 * Render today's classes page
 */
function renderTodayPage() {
  if (!pageEl) return;
  
  const today = new Date();
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][today.getDay()];
  const dateStr = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  // Get today's classes
  const classes = getTodaysClasses(currentCourses, today);
  
  // Calculate stats for each course
  const todayDateStr = formatDate(today);
  
  pageEl.innerHTML = `
    <div class="page-title">
      <h1>Today's Classes</h1>
      <p>${dateStr}</p>
    </div>
    
    ${classes.length > 0 ? `
      <div class="cards">
        ${classes.map(cls => {
          const course = currentCourses.find(c => c.id === cls.courseId);
          if (!course) return '';
          
          const courseAttendance = getCourseAttendance(cls.courseId);
          const todayStatus = allAttendance[todayDateStr]?.[cls.courseId];
          
          const stats = calculateCourseStats(course, allAttendance, 
            currentSemester?.startDate ? new Date(currentSemester.startDate) : new Date(),
            currentSemester?.endDate ? new Date(currentSemester.endDate) : new Date(),
            currentSemester?.country || 'us',
            currentSemester?.additionalHolidays || []
          );
          
          const statusClass = todayStatus ? `status-${todayStatus}` : 'status-pending';
          const statusText = todayStatus ? 
            todayStatus.charAt(0).toUpperCase() + todayStatus.slice(1) : 
            'Mark attendance';
          
          return `
            <div class="card">
              <div class="course-card">
                <div class="swatch" style="background: ${course.color || '#1f7a5f'}"></div>
                <div class="grow">
                  <h2>${course.code || course.name}</h2>
                  <p class="tiny">${cls.time} - ${cls.location || 'Location not set'}</p>
                </div>
                <div>
                  <span class="chip chip-${stats.status}">${stats.status}</span>
                </div>
              </div>
              
              <div class="progress-ring" style="margin-top: 16px;">
                <div class="ring-meta">
                  <b>${stats.attended}/${stats.totalSessions}</b>
                  <span class="muted">${Math.round(stats.attendanceRate)}% attended</span>
                </div>
              </div>
              
              <div class="bar" style="margin-top: 8px;">
                <i style="width: ${stats.attendanceRate}%; background: ${stats.status === 'risk' ? 'var(--danger)' : stats.status === 'edge' ? 'var(--clay)' : 'var(--pine)'}"></i>
              </div>
              
              <div class="session-actions" style="margin-top: 16px;">
                ${!todayStatus ? `
                  <button class="btn btn-primary btn-sm" onclick="markAttendance('${cls.courseId}', 'present', '${todayDateStr}')">Present</button>
                  <button class="btn btn-danger btn-sm" onclick="markAttendance('${cls.courseId}', 'absent', '${todayDateStr}')">Absent</button>
                  <button class="btn btn-soft btn-sm" onclick="markAttendance('${cls.courseId}', 'cancelled', '${todayDateStr}')">Cancelled</button>
                ` : `
                  <button class="btn btn-ghost btn-sm" disabled>${statusText}</button>
                  <button class="btn btn-soft btn-sm" onclick="markAttendance('${cls.courseId}', 'present', '${todayDateStr}')">Change</button>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <div class="empty">
        <h3>No classes today</h3>
        <p>Enjoy your day off!</p>
        <a href="#courses" class="btn btn-primary">View all courses</a>
      </div>
    `}
  `;
}

/**
 * Render courses page
 */
function renderCoursesPage() {
  if (!pageEl) return;
  
  const semesterStart = currentSemester?.startDate ? new Date(currentSemester.startDate) : new Date();
  const semesterEnd = currentSemester?.endDate ? new Date(currentSemester.endDate) : new Date();
  const countryCode = currentSemester?.country || 'us';
  const additionalHolidays = currentSemester?.additionalHolidays || [];
  
  pageEl.innerHTML = `
    <div class="page-title">
      <h1>Your Courses</h1>
      <a href="#semester" class="btn btn-primary btn-sm">Edit Semester</a>
    </div>
    
    ${currentCourses.length > 0 ? `
      <div class="cards">
        ${currentCourses.map(course => {
          const stats = calculateCourseStats(course, allAttendance, semesterStart, semesterEnd, countryCode, additionalHolidays);
          
          return `
            <div class="card">
              <div class="course-card">
                <div class="swatch" style="background: ${course.color || '#1f7a5f'}"></div>
                <div class="grow">
                  <h2>${course.code || course.name}</h2>
                  <p class="tiny">${course.requirement}% required • ${stats.totalSessions} total lectures</p>
                </div>
                <div>
                  <span class="chip chip-${stats.status}">${stats.status}</span>
                </div>
              </div>
              
              <div class="stat-row" style="margin-top: 16px;">
                <div class="stat">
                  <b>${stats.attended}</b>
                  <span>attended</span>
                </div>
                <div class="stat">
                  <b>${stats.sessionsRemaining}</b>
                  <span>remaining</span>
                </div>
                <div class="stat">
                  <b>${stats.canStillMiss}</b>
                  <span>can miss</span>
                </div>
              </div>
              
              <div class="bar" style="margin-top: 12px;">
                <i style="width: ${stats.attendanceRate}%; background: ${stats.status === 'risk' ? 'var(--danger)' : stats.status === 'edge' ? 'var(--clay)' : 'var(--pine)'}"></i>
              </div>
              
              <div style="margin-top: 16px;">
                <a href="#/courses/${course.id}" class="btn btn-ghost btn-sm btn-block">View Details</a>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <div class="empty">
        <h3>No courses yet</h3>
        <p>Start by setting up your semester and adding courses.</p>
        <a href="#semester" class="btn btn-primary">Set up semester</a>
      </div>
    `}
  `;
}

/**
 * Render semester setup page
 */
function renderSemesterPage() {
  if (!pageEl) return;
  
  pageEl.innerHTML = `
    <div class="page-title">
      <h1>Semester Setup</h1>
      <p>Configure your semester dates and settings</p>
    </div>
    
    <div class="cards">
      <div class="card">
        <h2>Semester Dates</h2>
        <form id="semester-form">
          <div class="grid-2" style="gap: 16px; margin-top: 16px;">
            <div class="field">
              <span>Start Date</span>
              <input type="date" id="semester-start" value="${currentSemester?.startDate || ''}" required />
            </div>
            <div class="field">
              <span>End Date</span>
              <input type="date" id="semester-end" value="${currentSemester?.endDate || ''}" required />
            </div>
          </div>
          
          <div class="grid-2" style="gap: 16px; margin-top: 16px;">
            <div class="field">
              <span>Country</span>
              <select id="semester-country">
                <option value="us" ${currentSemester?.country === 'us' ? 'selected' : ''}>United States</option>
                <option value="uk" ${currentSemester?.country === 'uk' ? 'selected' : ''}>United Kingdom</option>
                <option value="ca" ${currentSemester?.country === 'ca' ? 'selected' : ''}>Canada</option>
                <option value="au" ${currentSemester?.country === 'au' ? 'selected' : ''}>Australia</option>
                <option value="in" ${currentSemester?.country === 'in' ? 'selected' : ''}>India</option>
                <option value="generic" ${currentSemester?.country === 'generic' ? 'selected' : ''}>Generic</option>
              </select>
            </div>
            <div class="field">
              <span>Week Starts On</span>
              <select id="semester-weekstart">
                <option value="0" ${currentSemester?.weekStartsOn === 0 ? 'selected' : ''}>Sunday</option>
                <option value="1" ${currentSemester?.weekStartsOn === 1 ? 'selected' : ''}>Monday</option>
              </select>
            </div>
          </div>
          
          <button type="submit" class="btn btn-primary" style="margin-top: 16px;">Save Semester</button>
        </form>
      </div>
      
      <div class="card">
        <h2>Additional Holidays</h2>
        <p class="tiny muted" style="margin-bottom: 12px;">Add university-specific holidays or cancelled lecture days</p>
        <div id="holidays-list" style="margin-bottom: 12px;">
          ${(currentSemester?.additionalHolidays || []).map(holiday => `
            <div class="list-row">
              <span>${holiday}</span>
              <button class="btn btn-danger btn-sm" onclick="removeHoliday('${holiday}')">Remove</button>
            </div>
          `).join('')}
        </div>
        <div class="field">
          <input type="date" id="new-holiday" placeholder="Add a holiday" />
          <button class="btn btn-soft" onclick="addHoliday()" style="margin-top: 8px;">Add Holiday</button>
        </div>
      </div>
      
      <div class="card">
        <h2>Courses</h2>
        <p class="tiny muted" style="margin-bottom: 12px;">${currentCourses.length} courses configured</p>
        <a href="#/courses/new" class="btn btn-primary">Add Course</a>
        ${currentCourses.length > 0 ? `
          <div style="margin-top: 16px;">
            ${currentCourses.map(course => `
              <div class="list-row">
                <span>${course.code || course.name}</span>
                <button class="btn btn-ghost btn-sm" onclick="editCourse('${course.id}')">Edit</button>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
  
  // Set up form submission
  const form = pageEl.querySelector('#semester-form');
  if (form) {
    form.addEventListener('submit', handleSemesterSubmit);
  }
}

/**
 * Render settings page
 */
function renderSettingsPage() {
  if (!pageEl) return;
  
  pageEl.innerHTML = `
    <div class="page-title">
      <h1>Settings</h1>
      <p>Manage your account and preferences</p>
    </div>
    
    <div class="cards">
      <div class="card">
        <h2>Account</h2>
        <div class="list-row">
          <span>Name</span>
          <span>${currentUser?.name || 'Not set'}</span>
        </div>
        <div class="list-row">
          <span>Email</span>
          <span>${currentUser?.email || 'Not set'}</span>
        </div>
        <button class="btn btn-ghost btn-block" onclick="handleLogoutClick()" style="margin-top: 16px;">Log Out</button>
      </div>
      
      <div class="card">
        <h2>Data</h2>
        <p class="tiny muted" style="margin-bottom: 12px;">Your data is stored locally on this device.</p>
        <button class="btn btn-soft" onclick="exportData()">Export Data</button>
        <button class="btn btn-danger" onclick="clearData()" style="margin-left: 8px;">Clear All Data</button>
      </div>
      
      <div class="card">
        <h2>About</h2>
        <p class="tiny">Scheduology v1.0.0</p>
        <p class="tiny">Built for students who cannot afford a surprise on the attendance sheet.</p>
      </div>
    </div>
  `;
}

// ============================================
// HANDLERS
// ============================================

/**
 * Handle demo button click
 */
function handleDemoClick() {
  // Set demo mode
  localStorage.setItem('scheduology_demo', 'true');
  
  // Create demo data if it doesn't exist
  createDemoData();
  
  // Navigate to today's view
  window.location.hash = '#today';
  navigate();
}

/**
 * Create demo data for testing
 */
function createDemoData() {
  const demoUser = {
    id: 'demo',
    name: 'Demo User',
    email: 'demo@example.com'
  };
  
  // Save demo semester
  const today = new Date();
  const semesterStart = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  const semesterEnd = new Date(today.getFullYear(), today.getMonth() + 3, 30);
  
  const demoSemester = {
    id: 'demo-semester',
    name: 'Fall 2024',
    startDate: semesterStart.toISOString().split('T')[0],
    endDate: semesterEnd.toISOString().split('T')[0],
    country: 'us',
    weekStartsOn: 1,
    additionalHolidays: []
  };
  
  localStorage.setItem('scheduology_semester_demo', JSON.stringify(demoSemester));
  
  // Save demo courses
  const demoCourses = [
    {
      id: 'course-1',
      name: 'Calculus I',
      code: 'MATH 101',
      requirement: 75,
      color: '#1f7a5f',
      sessions: [
        { dayOfWeek: 1, time: '09:00', duration: '1 hour', location: 'Room 101' },
        { dayOfWeek: 3, time: '09:00', duration: '1 hour', location: 'Room 101' },
        { dayOfWeek: 5, time: '09:00', duration: '1 hour', location: 'Room 101' }
      ]
    },
    {
      id: 'course-2',
      name: 'Introduction to Computer Science',
      code: 'CS 101',
      requirement: 80,
      color: '#b4532a',
      sessions: [
        { dayOfWeek: 2, time: '11:00', duration: '1.5 hours', location: 'Room 201' },
        { dayOfWeek: 4, time: '11:00', duration: '1.5 hours', location: 'Room 201' }
      ]
    },
    {
      id: 'course-3',
      name: 'English Composition',
      code: 'ENG 101',
      requirement: 70,
      color: '#9f2d1f',
      sessions: [
        { dayOfWeek: 1, time: '14:00', duration: '1 hour', location: 'Room 301' },
        { dayOfWeek: 3, time: '14:00', duration: '1 hour', location: 'Room 301' }
      ]
    }
  ];
  
  localStorage.setItem('scheduology_courses_demo', JSON.stringify(demoCourses));
  
  // Save demo attendance (some marked as present)
  const demoAttendance = {};
  const startDate = new Date(semesterStart);
  const todayDate = new Date();
  
  // Mark some days as present
  for (let d = new Date(startDate); d <= todayDate; d.setDate(d.getDate() + 1)) {
    const dateStr = formatDate(d);
    if (d.getDay() === 1 || d.getDay() === 3 || d.getDay() === 5) {
      // Monday, Wednesday, Friday
      demoAttendance[dateStr] = {
        'course-1': Math.random() > 0.2 ? 'present' : 'absent'
      };
    }
    if (d.getDay() === 2 || d.getDay() === 4) {
      // Tuesday, Thursday
      demoAttendance[dateStr] = {
        'course-2': Math.random() > 0.2 ? 'present' : 'absent'
      };
    }
  }
  
  localStorage.setItem('scheduology_attendance_demo', JSON.stringify(demoAttendance));
  
  // Reload data
  loadSemesterData('demo');
}

/**
 * Handle login form submission
 * @param {Event} e
 */
function handleLoginSubmit(e) {
  e.preventDefault();
  
  const email = document.getElementById('login-email')?.value;
  const password = document.getElementById('login-password')?.value;
  
  if (!email || !password) {
    showNotice('Please enter both email and password', 'error');
    return;
  }
  
  // In a real app, you would validate credentials here
  // For demo purposes, we'll just create a user
  const user = {
    id: generateId(),
    email: email,
    name: email.split('@')[0]
  };
  
  // Save user
  localStorage.setItem('scheduology_user', JSON.stringify(user));
  localStorage.removeItem('scheduology_demo');
  
  // Reload data
  currentUser = user;
  loadSemesterData(user.id);
  
  // Navigate to today's view
  window.location.hash = '#today';
  navigate();
}

/**
 * Handle signup form submission
 * @param {Event} e
 */
function handleSignupSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('signup-name')?.value;
  const email = document.getElementById('signup-email')?.value;
  const password = document.getElementById('signup-password')?.value;
  const requirement = document.getElementById('signup-requirement')?.value;
  
  if (!name || !email || !password) {
    showNotice('Please fill in all fields', 'error');
    return;
  }
  
  if (password.length < 8) {
    showNotice('Password must be at least 8 characters', 'error');
    return;
  }
  
  // Create user
  const user = {
    id: generateId(),
    name: name,
    email: email,
    defaultRequirement: parseInt(requirement) || 75
  };
  
  // Save user
  localStorage.setItem('scheduology_user', JSON.stringify(user));
  localStorage.removeItem('scheduology_demo');
  
  // Create initial semester
  const today = new Date();
  const semesterStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const semesterEnd = new Date(today.getFullYear(), today.getMonth() + 5, 0);
  
  const semester = {
    id: generateId(),
    name: `Semester ${today.getFullYear()}`,
    startDate: semesterStart.toISOString().split('T')[0],
    endDate: semesterEnd.toISOString().split('T')[0],
    country: 'us',
    weekStartsOn: 1,
    additionalHolidays: []
  };
  
  localStorage.setItem(`scheduology_semester_${user.id}`, JSON.stringify(semester));
  
  // Reload data
  currentUser = user;
  currentSemester = semester;
  
  // Navigate to semester setup
  window.location.hash = '#semester';
  navigate();
}

/**
 * Handle logout button click
 */
function handleLogoutClick() {
  // Clear user data
  localStorage.removeItem('scheduology_user');
  localStorage.removeItem('scheduology_demo');
  
  // Clear current state
  currentUser = null;
  currentSemester = null;
  currentCourses = [];
  currentTimetable = null;
  allAttendance = {};
  
  // Navigate to landing page
  window.location.hash = '#/';
  navigate();
}

/**
 * Handle semester form submission
 * @param {Event} e
 */
function handleSemesterSubmit(e) {
  e.preventDefault();
  
  const startDate = document.getElementById('semester-start')?.value;
  const endDate = document.getElementById('semester-end')?.value;
  const country = document.getElementById('semester-country')?.value;
  const weekStartsOn = parseInt(document.getElementById('semester-weekstart')?.value) || 1;
  
  if (!startDate || !endDate) {
    showNotice('Please enter both start and end dates', 'error');
    return;
  }
  
  const userId = currentUser?.id || 'demo';
  
  const semester = {
    id: currentSemester?.id || generateId(),
    name: `Semester ${new Date(startDate).getFullYear()}`,
    startDate: startDate,
    endDate: endDate,
    country: country,
    weekStartsOn: weekStartsOn,
    additionalHolidays: currentSemester?.additionalHolidays || []
  };
  
  // Save semester
  localStorage.setItem(`scheduology_semester_${userId}`, JSON.stringify(semester));
  
  // Update current state
  currentSemester = semester;
  
  showNotice('Semester saved successfully!', 'success');
  
  // Re-render page
  renderSemesterPage();
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Generate unique ID
 * @returns {string}
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date
 * @returns {string}
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Show notice message
 * @param {string} message
 * @param {string} type - 'success', 'error', 'info'
 */
function showNotice(message, type = 'info') {
  // Create notice element
  const notice = document.createElement('div');
  notice.className = `notice ${type === 'error' ? '' : type === 'success' ? 'ok' : ''}`;
  notice.textContent = message;
  notice.style.position = 'fixed';
  notice.style.bottom = '20px';
  notice.style.right = '20px';
  notice.style.zIndex = '1000';
  notice.style.maxWidth = '300px';
  
  document.body.appendChild(notice);
  
  // Remove after 3 seconds
  setTimeout(() => {
    notice.remove();
  }, 3000);
}

/**
 * Add a holiday
 */
function addHoliday() {
  const holidayInput = document.getElementById('new-holiday');
  const holidayDate = holidayInput?.value;
  
  if (!holidayDate) {
    showNotice('Please select a date', 'error');
    return;
  }
  
  const userId = currentUser?.id || 'demo';
  const semester = currentSemester || {};
  
  // Add to additional holidays
  const additionalHolidays = semester.additionalHolidays || [];
  if (!additionalHolidays.includes(holidayDate)) {
    additionalHolidays.push(holidayDate);
    
    // Update semester
    semester.additionalHolidays = additionalHolidays;
    localStorage.setItem(`scheduology_semester_${userId}`, JSON.stringify(semester));
    currentSemester = semester;
    
    // Re-render
    renderSemesterPage();
    showNotice('Holiday added!', 'success');
  } else {
    showNotice('This date is already a holiday', 'error');
  }
  
  // Clear input
  if (holidayInput) {
    holidayInput.value = '';
  }
}

/**
 * Remove a holiday
 * @param {string} holidayDate
 */
function removeHoliday(holidayDate) {
  const userId = currentUser?.id || 'demo';
  const semester = currentSemester || {};
  
  // Remove from additional holidays
  let additionalHolidays = semester.additionalHolidays || [];
  additionalHolidays = additionalHolidays.filter(h => h !== holidayDate);
  
  // Update semester
  semester.additionalHolidays = additionalHolidays;
  localStorage.setItem(`scheduology_semester_${userId}`, JSON.stringify(semester));
  currentSemester = semester;
  
  // Re-render
  renderSemesterPage();
  showNotice('Holiday removed!', 'success');
}

/**
 * Mark attendance for a course
 * @param {string} courseId
 * @param {string} status - 'present', 'absent', 'cancelled'
 * @param {string} dateStr - YYYY-MM-DD
 */
function markAttendance(courseId, status, dateStr) {
  const userId = currentUser?.id || 'demo';
  
  // Get current attendance
  let attendance = JSON.parse(localStorage.getItem(`scheduology_attendance_${userId}`) || '{}');
  
  // Update attendance
  if (!attendance[dateStr]) {
    attendance[dateStr] = {};
  }
  attendance[dateStr][courseId] = status;
  
  // Save
  localStorage.setItem(`scheduology_attendance_${userId}`, JSON.stringify(attendance));
  allAttendance = attendance;
  
  // Re-render current page
  if (currentView === 'today') {
    renderTodayPage();
  } else if (currentView === 'courses') {
    renderCoursesPage();
  }
  
  showNotice(`Marked as ${status}`, 'success');
}

/**
 * Export all data
 */
function exportData() {
  const userId = currentUser?.id || 'demo';
  
  const data = {
    user: currentUser,
    semester: currentSemester,
    courses: currentCourses,
    timetable: currentTimetable,
    attendance: allAttendance,
    settings: localStorage.getItem(`scheduology_settings_${userId}`)
  };
  
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `scheduology-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showNotice('Data exported successfully!', 'success');
}

/**
 * Clear all data
 */
function clearData() {
  if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    const userId = currentUser?.id || 'demo';
    
    // Remove all user data
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('scheduology_')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Clear current state
    currentUser = null;
    currentSemester = null;
    currentCourses = [];
    currentTimetable = null;
    allAttendance = {};
    
    // Navigate to landing page
    window.location.hash = '#/';
    navigate();
    
    showNotice('All data cleared!', 'success');
  }
}

/**
 * Get today's classes
 * @param {Array} courses
 * @param {Date} today
 * @returns {Array}
 */
function getTodaysClasses(courses, today = new Date()) {
  const dayOfWeek = today.getDay();
  const classes = [];
  
  courses.forEach(course => {
    if (!course.sessions) return;
    
    course.sessions.forEach(session => {
      if (session.dayOfWeek === dayOfWeek) {
        classes.push({
          courseId: course.id,
          courseName: course.name,
          code: course.code,
          time: session.time,
          duration: session.duration || '1 hour',
          location: session.location || '',
          color: course.color || '#1f7a5f'
        });
      }
    });
  });
  
  // Sort by time
  return classes.sort((a, b) => {
    const timeA = a.time.split(':').map(Number);
    const timeB = b.time.split(':').map(Number);
    return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
  });
}

/**
 * Get course attendance
 * @param {string} courseId
 * @returns {Object}
 */
function getCourseAttendance(courseId) {
  const userId = currentUser?.id || 'demo';
  const attendanceData = localStorage.getItem(`scheduology_attendance_${userId}`);
  const allAttendance = attendanceData ? JSON.parse(attendanceData) : {};
  
  const courseAttendance = {};
  for (const [date, records] of Object.entries(allAttendance)) {
    if (records[courseId]) {
      courseAttendance[date] = records[courseId];
    }
  }
  
  return courseAttendance;
}

/**
 * Calculate course statistics
 * @param {Object} course
 * @param {Object} attendance
 * @param {Date} semesterStart
 * @param {Date} semesterEnd
 * @param {string} countryCode
 * @param {Array} additionalHolidays
 * @returns {Object}
 */
function calculateCourseStats(course, attendance, semesterStart, semesterEnd, countryCode = 'us', additionalHolidays = []) {
  const courseId = course.id;
  const requirement = course.requirement || 75;
  
  // Get all session dates for this course
  const sessionDates = getCourseSessionDates(course, semesterStart, semesterEnd, countryCode, additionalHolidays);
  const totalSessions = sessionDates.length;
  
  // Count attendance
  let attended = 0;
  let absent = 0;
  let cancelled = 0;
  
  sessionDates.forEach(date => {
    const dateStr = formatDate(date);
    const status = attendance[dateStr]?.[courseId];
    
    switch (status) {
      case 'present':
        attended++;
        break;
      case 'absent':
        absent++;
        break;
      case 'cancelled':
        cancelled++;
        break;
    }
  });
  
  const attendedSessions = attended + cancelled;
  const attendanceRate = totalSessions > 0 ? (attendedSessions / totalSessions) * 100 : 0;
  const minimumRequired = Math.ceil((requirement / 100) * totalSessions);
  const canStillMiss = minimumRequired - attendedSessions;
  const sessionsRemaining = totalSessions - attendedSessions - absent;
  
  // Determine status
  let status = 'safe';
  if (attendanceRate < requirement) {
    status = 'risk';
  } else if (canStillMiss <= 2) {
    status = 'edge';
  }
  
  return {
    courseId: course.id,
    courseName: course.name,
    totalSessions,
    attended,
    absent,
    cancelled,
    sessionsRemaining,
    attendanceRate: Math.round(attendanceRate * 10) / 10,
    requirement,
    minimumRequired,
    canStillMiss: Math.max(0, canStillMiss),
    status
  };
}

/**
 * Get course session dates
 * @param {Object} course
 * @param {Date} semesterStart
 * @param {Date} semesterEnd
 * @param {string} countryCode
 * @param {Array} additionalHolidays
 * @returns {Array<Date>}
 */
function getCourseSessionDates(course, semesterStart, semesterEnd, countryCode = 'us', additionalHolidays = []) {
  const dates = [];
  
  if (!course.sessions || course.sessions.length === 0) {
    return dates;
  }
  
  const start = new Date(semesterStart);
  const end = new Date(semesterEnd);
  
  course.sessions.forEach(session => {
    const targetDay = session.dayOfWeek;
    const [hours, minutes] = session.time.split(':').map(Number);
    
    // Find first occurrence of this day of week on or after start date
    let current = new Date(start);
    while (current.getDay() !== targetDay) {
      current.setDate(current.getDate() + 1);
    }
    
    // If this is before the start date, move forward
    if (current < start) {
      current.setDate(current.getDate() + 7);
    }
    
    // Add all occurrences until end date
    while (current <= end) {
      // Check if it's a teaching day
      if (isTeachingDay(current, countryCode, additionalHolidays)) {
        dates.push(new Date(current));
      }
      
      // Move to next week
      current.setDate(current.getDate() + 7);
    }
  });
  
  return dates.sort((a, b) => a - b);
}

/**
 * Check if a date is a teaching day
 * @param {Date} date
 * @param {string} countryCode
 * @param {Array} additionalHolidays
 * @returns {boolean}
 */
function isTeachingDay(date, countryCode = 'us', additionalHolidays = []) {
  // Check if weekend
  if (isWeekend(date)) {
    return false;
  }
  
  // Check additional holidays
  const dateStr = formatDate(date);
  if (additionalHolidays.includes(dateStr)) {
    return false;
  }
  
  // Check public holidays (if holidays.js is loaded)
  if (typeof isPublicHoliday === 'function') {
    if (isPublicHoliday(date, countryCode)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Check if weekend
 * @param {Date} date
 * @returns {boolean}
 */
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

// ============================================
// GLOBAL FUNCTIONS (for inline onclick handlers)
// ============================================

// Make functions available globally for inline event handlers
window.markAttendance = markAttendance;
window.addHoliday = addHoliday;
window.removeHoliday = removeHoliday;
window.exportData = exportData;
window.clearData = clearData;

// ============================================
// INITIALIZE
// ============================================

// Run initialization when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
