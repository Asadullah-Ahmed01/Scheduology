/**
 * Scheduology - Local Storage Manager
 * Handles all data persistence using browser localStorage
 */

const STORAGE_PREFIX = 'scheduology_';

// ============================================
// USER & AUTHENTICATION
// ============================================

/**
 * Save user data
 * @param {Object} user - User object with id, name, email, etc.
 */
function saveUser(user) {
  localStorage.setItem(STORAGE_PREFIX + 'user', JSON.stringify(user));
}

/**
 * Get current user
 * @returns {Object|null} User object or null if not logged in
 */
function getUser() {
  const userData = localStorage.getItem(STORAGE_PREFIX + 'user');
  return userData ? JSON.parse(userData) : null;
}

/**
 * Check if user is logged in
 * @returns {boolean}
 */
function isLoggedIn() {
  return getUser() !== null;
}

/**
 * Log out user
 */
function logout() {
  localStorage.removeItem(STORAGE_PREFIX + 'user');
  localStorage.removeItem(STORAGE_PREFIX + 'demo');
}

/**
 * Check if in demo mode
 * @returns {boolean}
 */
function isDemoMode() {
  return localStorage.getItem(STORAGE_PREFIX + 'demo') === 'true';
}

/**
 * Set demo mode
 * @param {boolean} enabled
 */
function setDemoMode(enabled) {
  if (enabled) {
    localStorage.setItem(STORAGE_PREFIX + 'demo', 'true');
  } else {
    localStorage.removeItem(STORAGE_PREFIX + 'demo');
  }
}

// ============================================
// SEMESTER DATA
// ============================================

/**
 * Save semester configuration
 * @param {Object} semester - Semester data
 */
function saveSemester(semester) {
  const userId = getUser()?.id || 'demo';
  localStorage.setItem(STORAGE_PREFIX + 'semester_' + userId, JSON.stringify(semester));
}

/**
 * Get current semester
 * @returns {Object|null} Semester object or null
 */
function getSemester() {
  const userId = getUser()?.id || 'demo';
  const semesterData = localStorage.getItem(STORAGE_PREFIX + 'semester_' + userId);
  return semesterData ? JSON.parse(semesterData) : null;
}

/**
 * Delete semester
 */
function deleteSemester() {
  const userId = getUser()?.id || 'demo';
  localStorage.removeItem(STORAGE_PREFIX + 'semester_' + userId);
}

// ============================================
// COURSES
// ============================================

/**
 * Save all courses
 * @param {Array} courses - Array of course objects
 */
function saveCourses(courses) {
  const userId = getUser()?.id || 'demo';
  localStorage.setItem(STORAGE_PREFIX + 'courses_' + userId, JSON.stringify(courses));
}

/**
 * Get all courses
 * @returns {Array} Array of course objects
 */
function getCourses() {
  const userId = getUser()?.id || 'demo';
  const coursesData = localStorage.getItem(STORAGE_PREFIX + 'courses_' + userId);
  return coursesData ? JSON.parse(coursesData) : [];
}

/**
 * Get a specific course by ID
 * @param {string} courseId
 * @returns {Object|null}
 */
function getCourse(courseId) {
  const courses = getCourses();
  return courses.find(c => c.id === courseId) || null;
}

/**
 * Add a new course
 * @param {Object} course
 */
function addCourse(course) {
  const courses = getCourses();
  courses.push(course);
  saveCourses(courses);
}

/**
 * Update a course
 * @param {string} courseId
 * @param {Object} updates
 */
function updateCourse(courseId, updates) {
  const courses = getCourses();
  const index = courses.findIndex(c => c.id === courseId);
  if (index !== -1) {
    courses[index] = { ...courses[index], ...updates };
    saveCourses(courses);
  }
}

/**
 * Delete a course
 * @param {string} courseId
 */
function deleteCourse(courseId) {
  const courses = getCourses();
  const filtered = courses.filter(c => c.id !== courseId);
  saveCourses(filtered);
}

// ============================================
// TIMETABLE
// ============================================

/**
 * Save timetable configuration
 * @param {Object} timetable
 */
function saveTimetable(timetable) {
  const userId = getUser()?.id || 'demo';
  localStorage.setItem(STORAGE_PREFIX + 'timetable_' + userId, JSON.stringify(timetable));
}

/**
 * Get timetable
 * @returns {Object|null}
 */
function getTimetable() {
  const userId = getUser()?.id || 'demo';
  const timetableData = localStorage.getItem(STORAGE_PREFIX + 'timetable_' + userId);
  return timetableData ? JSON.parse(timetableData) : null;
}

// ============================================
// ATTENDANCE
// ============================================

/**
 * Save attendance record
 * @param {string} date - ISO date string (YYYY-MM-DD)
 * @param {string} courseId
 * @param {string} status - 'present', 'absent', 'cancelled'
 */
function saveAttendance(date, courseId, status) {
  const userId = getUser()?.id || 'demo';
  const key = STORAGE_PREFIX + 'attendance_' + userId;
  
  let attendance = JSON.parse(localStorage.getItem(key) || '{}');
  
  if (!attendance[date]) {
    attendance[date] = {};
  }
  
  attendance[date][courseId] = status;
  localStorage.setItem(key, JSON.stringify(attendance));
}

/**
 * Get attendance for a specific date
 * @param {string} date - ISO date string
 * @returns {Object} Attendance object for that date
 */
function getAttendance(date) {
  const userId = getUser()?.id || 'demo';
  const key = STORAGE_PREFIX + 'attendance_' + userId;
  const allAttendance = JSON.parse(localStorage.getItem(key) || '{}');
  return allAttendance[date] || {};
}

/**
 * Get attendance for a specific course
 * @param {string} courseId
 * @returns {Object} Attendance records for the course
 */
function getCourseAttendance(courseId) {
  const userId = getUser()?.id || 'demo';
  const key = STORAGE_PREFIX + 'attendance_' + userId;
  const allAttendance = JSON.parse(localStorage.getItem(key) || '{}');
  
  const courseAttendance = {};
  for (const [date, records] of Object.entries(allAttendance)) {
    if (records[courseId]) {
      courseAttendance[date] = records[courseId];
    }
  }
  
  return courseAttendance;
}

/**
 * Get all attendance records
 * @returns {Object} All attendance records
 */
function getAllAttendance() {
  const userId = getUser()?.id || 'demo';
  const key = STORAGE_PREFIX + 'attendance_' + userId;
  return JSON.parse(localStorage.getItem(key) || '{}');
}

/**
 * Update attendance for a date and course
 * @param {string} date
 * @param {string} courseId
 * @param {string} status
 */
function updateAttendance(date, courseId, status) {
  saveAttendance(date, courseId, status);
}

/**
 * Delete attendance for a date and course
 * @param {string} date
 * @param {string} courseId
 */
function deleteAttendance(date, courseId) {
  const userId = getUser()?.id || 'demo';
  const key = STORAGE_PREFIX + 'attendance_' + userId;
  
  let attendance = JSON.parse(localStorage.getItem(key) || '{}');
  
  if (attendance[date] && attendance[date][courseId]) {
    delete attendance[date][courseId];
    
    // If date has no more records, delete the date
    if (Object.keys(attendance[date]).length === 0) {
      delete attendance[date];
    }
    
    localStorage.setItem(key, JSON.stringify(attendance));
  }
}

// ============================================
// SETTINGS
// ============================================

/**
 * Save user settings
 * @param {Object} settings
 */
function saveSettings(settings) {
  const userId = getUser()?.id || 'demo';
  localStorage.setItem(STORAGE_PREFIX + 'settings_' + userId, JSON.stringify(settings));
}

/**
 * Get user settings
 * @returns {Object}
 */
function getSettings() {
  const userId = getUser()?.id || 'demo';
  const settingsData = localStorage.getItem(STORAGE_PREFIX + 'settings_' + userId);
  return settingsData ? JSON.parse(settingsData) : {
    country: 'us',
    weekStartsOn: 1, // Monday
    defaultAttendanceRequirement: 75
  };
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
 * Clear all data for current user
 */
function clearAllData() {
  const userId = getUser()?.id || 'demo';
  
  // Remove all user-specific data
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      if (key.includes(`_${userId}`) || key === STORAGE_PREFIX + 'user') {
        keysToRemove.push(key);
      }
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Export all data as JSON
 * @returns {string}
 */
function exportData() {
  const userId = getUser()?.id || 'demo';
  const data = {
    user: getUser(),
    semester: getSemester(),
    courses: getCourses(),
    timetable: getTimetable(),
    attendance: getAllAttendance(),
    settings: getSettings()
  };
  
  return JSON.stringify(data, null, 2);
}

/**
 * Import data from JSON
 * @param {string} jsonData
 */
function importData(jsonData) {
  try {
    const data = JSON.parse(jsonData);
    
    if (data.user) saveUser(data.user);
    if (data.semester) saveSemester(data.semester);
    if (data.courses) saveCourses(data.courses);
    if (data.timetable) saveTimetable(data.timetable);
    if (data.attendance) {
      const userId = getUser()?.id || 'demo';
      localStorage.setItem(STORAGE_PREFIX + 'attendance_' + userId, JSON.stringify(data.attendance));
    }
    if (data.settings) saveSettings(data.settings);
    
    return true;
  } catch (e) {
    console.error('Failed to import data:', e);
    return false;
  }
}

// ============================================
// PUBLIC API
// ============================================

const Store = {
  // User
  saveUser,
  getUser,
  isLoggedIn,
  logout,
  isDemoMode,
  setDemoMode,
  
  // Semester
  saveSemester,
  getSemester,
  deleteSemester,
  
  // Courses
  saveCourses,
  getCourses,
  getCourse,
  addCourse,
  updateCourse,
  deleteCourse,
  
  // Timetable
  saveTimetable,
  getTimetable,
  
  // Attendance
  saveAttendance,
  getAttendance,
  getCourseAttendance,
  getAllAttendance,
  updateAttendance,
  deleteAttendance,
  
  // Settings
  saveSettings,
  getSettings,
  
  // Utility
  generateId,
  clearAllData,
  exportData,
  importData
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Store;
}
