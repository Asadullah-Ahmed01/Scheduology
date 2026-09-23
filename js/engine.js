/**
 * Scheduology - Core Calculation Engine
 * Handles all attendance calculations and semester logic
 */

// Import holidays module (will be available in browser context)
// const Holidays = require('./holidays');

const DAYS_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ============================================
// SEMESTER CALCULATIONS
// ============================================

/**
 * Calculate total teaching days in a semester
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {string} countryCode
 * @param {Array} additionalHolidays - Array of date strings (YYYY-MM-DD)
 * @returns {number}
 */
function calculateTeachingDays(startDate, endDate, countryCode = 'us', additionalHolidays = []) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  let count = 0;
  
  // Normalize dates to start at midnight
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const current = new Date(start);
  while (current <= end) {
    // Check if it's a teaching day
    if (isTeachingDay(current, countryCode, additionalHolidays)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  
  return count;
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
  
  // Check if public holiday
  if (typeof isPublicHoliday === 'function' && isPublicHoliday(date, countryCode)) {
    return false;
  }
  
  // Check additional holidays
  const dateStr = formatDate(date);
  if (additionalHolidays.includes(dateStr)) {
    return false;
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
 * Parse date from YYYY-MM-DD string
 * @param {string} dateStr
 * @returns {Date}
 */
function parseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// ============================================
// COURSE CALCULATIONS
// ============================================

/**
 * Calculate course statistics
 * @param {Object} course - Course object with id, name, requirement, sessions
 * @param {Object} attendance - Attendance records {date: {courseId: status}}
 * @param {Date} semesterStart
 * @param {Date} semesterEnd
 * @param {string} countryCode
 * @param {Array} additionalHolidays
 * @returns {Object} Course stats
 */
function calculateCourseStats(course, attendance, semesterStart, semesterEnd, countryCode = 'us', additionalHolidays = []) {
  const courseId = course.id;
  const requirement = course.requirement || 75; // Default 75%
  
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
      default:
        // Not yet marked
        break;
    }
  });
  
  // Calculate statistics
  const attendedSessions = attended + cancelled; // Cancelled classes don't count against attendance
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
    attendanceRate: Math.round(attendanceRate * 10) / 10, // Round to 1 decimal
    requirement,
    minimumRequired,
    canStillMiss: Math.max(0, canStillMiss),
    status
  };
}

/**
 * Get all session dates for a course
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
  
  // For each session in the course timetable
  course.sessions.forEach(session => {
    // session.dayOfWeek: 0-6 (0=Sunday, 1=Monday, etc.)
    // session.time: 'HH:MM'
    
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
      // Set the time
      const dateWithTime = new Date(current);
      dateWithTime.setHours(hours, minutes, 0, 0);
      
      // Check if it's a teaching day
      if (isTeachingDay(current, countryCode, additionalHolidays)) {
        dates.push(new Date(dateWithTime));
      }
      
      // Move to next week
      current.setDate(current.getDate() + 7);
    }
  });
  
  return dates.sort((a, b) => a - b);
}

// ============================================
// SEMESTER STATS
// ============================================

/**
 * Calculate overall semester statistics
 * @param {Array} courses
 * @param {Object} attendance
 * @param {Date} semesterStart
 * @param {Date} semesterEnd
 * @param {string} countryCode
 * @param {Array} additionalHolidays
 * @returns {Object}
 */
function calculateSemesterStats(courses, attendance, semesterStart, semesterEnd, countryCode = 'us', additionalHolidays = []) {
  let totalSessions = 0;
  let totalAttended = 0;
  let totalAbsent = 0;
  let coursesAtRisk = 0;
  
  courses.forEach(course => {
    const stats = calculateCourseStats(course, attendance, semesterStart, semesterEnd, countryCode, additionalHolidays);
    totalSessions += stats.totalSessions;
    totalAttended += stats.attended;
    totalAbsent += stats.absent;
    
    if (stats.status === 'risk') {
      coursesAtRisk++;
    }
  });
  
  const overallAttendanceRate = totalSessions > 0 ? ((totalAttended) / totalSessions) * 100 : 0;
  
  return {
    totalSessions,
    totalAttended,
    totalAbsent,
    coursesAtRisk,
    overallAttendanceRate: Math.round(overallAttendanceRate * 10) / 10
  };
}

// ============================================
// TODAY'S CLASSES
// ============================================

/**
 * Get today's scheduled classes
 * @param {Array} courses
 * @param {Date} today
 * @returns {Array}
 */
function getTodaysClasses(courses, today = new Date()) {
  const dayOfWeek = today.getDay();
  const dateStr = formatDate(today);
  const classes = [];
  
  courses.forEach(course => {
    if (!course.sessions) return;
    
    course.sessions.forEach(session => {
      if (session.dayOfWeek === dayOfWeek) {
        classes.push({
          courseId: course.id,
          courseName: course.name,
          time: session.time,
          duration: session.duration || '1 hour',
          location: session.location || '',
          status: 'scheduled' // Will be updated with attendance status
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
 * Get classes for a specific date
 * @param {Array} courses
 * @param {Date} date
 * @returns {Array}
 */
function getClassesForDate(courses, date) {
  const dayOfWeek = date.getDay();
  const classes = [];
  
  courses.forEach(course => {
    if (!course.sessions) return;
    
    course.sessions.forEach(session => {
      if (session.dayOfWeek === dayOfWeek) {
        classes.push({
          courseId: course.id,
          courseName: course.name,
          time: session.time,
          duration: session.duration || '1 hour',
          location: session.location || ''
        });
      }
    });
  });
  
  return classes.sort((a, b) => {
    const timeA = a.time.split(':').map(Number);
    const timeB = b.time.split(':').map(Number);
    return timeA[0] * 60 + timeA[1] - (timeB[0] * 60 + timeB[1]);
  });
}

// ============================================
// DATE UTILITIES
// ============================================

/**
 * Get all dates in a semester
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Array<Date>}
 */
function getSemesterDates(startDate, endDate) {
  const dates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  
  const current = new Date(start);
  while (current <= end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}

/**
 * Get week number for a date
 * @param {Date} date
 * @param {number} weekStartsOn - 0=Sunday, 1=Monday, etc.
 * @returns {number}
 */
function getWeekNumber(date, weekStartsOn = 1) {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
  
  // Adjust for week start day
  const weekDay = (date.getDay() + 7 - weekStartsOn) % 7;
  const weekNum = Math.ceil((pastDaysOfYear + weekDay) / 7);
  
  return weekNum;
}

/**
 * Format date for display
 * @param {Date} date
 * @returns {string}
 */
function formatDisplayDate(date) {
  return `${DAYS_OF_WEEK[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/**
 * Format time for display
 * @param {string} time - HH:MM format
 * @returns {string}
 */
function formatDisplayTime(time) {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

// ============================================
// VALIDATION
// ============================================

/**
 * Validate course data
 * @param {Object} course
 * @returns {Object} { isValid, errors }
 */
function validateCourse(course) {
  const errors = [];
  
  if (!course.name || course.name.trim().length === 0) {
    errors.push('Course name is required');
  }
  
  if (course.requirement === undefined || course.requirement === null) {
    errors.push('Attendance requirement is required');
  } else if (course.requirement < 0 || course.requirement > 100) {
    errors.push('Attendance requirement must be between 0 and 100');
  }
  
  if (!course.sessions || course.sessions.length === 0) {
    errors.push('At least one session is required');
  } else {
    course.sessions.forEach((session, index) => {
      if (!session.dayOfWeek || session.dayOfWeek < 0 || session.dayOfWeek > 6) {
        errors.push(`Session ${index + 1}: Invalid day of week`);
      }
      if (!session.time || !/^\d{1,2}:\d{2}$/.test(session.time)) {
        errors.push(`Session ${index + 1}: Invalid time format (use HH:MM)`);
      }
    });
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate semester dates
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Object} { isValid, errors }
 */
function validateSemesterDates(startDate, endDate) {
  const errors = [];
  
  if (!startDate || !(startDate instanceof Date) || isNaN(startDate.getTime())) {
    errors.push('Start date is required and must be valid');
  }
  
  if (!endDate || !(endDate instanceof Date) || isNaN(endDate.getTime())) {
    errors.push('End date is required and must be valid');
  }
  
  if (startDate && endDate && startDate >= endDate) {
    errors.push('End date must be after start date');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

// ============================================
// PUBLIC API
// ============================================

const Engine = {
  // Teaching day checks
  isTeachingDay,
  isWeekend,
  
  // Calculations
  calculateTeachingDays,
  calculateCourseStats,
  calculateSemesterStats,
  getCourseSessionDates,
  
  // Date utilities
  formatDate,
  parseDate,
  getSemesterDates,
  getWeekNumber,
  formatDisplayDate,
  formatDisplayTime,
  
  // Today/classes
  getTodaysClasses,
  getClassesForDate,
  
  // Validation
  validateCourse,
  validateSemesterDates
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Engine;
}
