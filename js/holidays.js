/**
 * Scheduology - Public Holidays Database
 * Country/region-specific public holidays for attendance calculation
 */

const PUBLIC_HOLIDAYS = {
  // United States - Federal Holidays
  'us': [
    { name: 'New Year\'s Day', month: 0, day: 1 },
    { name: 'Martin Luther King Jr. Day', month: 0, day: 15, week: 3 }, // 3rd Monday in January
    { name: 'Presidents\' Day', month: 1, day: 15, week: 3 }, // 3rd Monday in February
    { name: 'Memorial Day', month: 4, day: 30, week: -1 }, // Last Monday in May
    { name: 'Juneteenth', month: 5, day: 19 },
    { name: 'Independence Day', month: 6, day: 4 },
    { name: 'Labor Day', month: 8, day: 1, week: 1 }, // 1st Monday in September
    { name: 'Columbus Day', month: 9, day: 8, week: 2 }, // 2nd Monday in October
    { name: 'Veterans Day', month: 10, day: 11 },
    { name: 'Thanksgiving Day', month: 10, day: 22, week: 4 }, // 4th Thursday in November
    { name: 'Christmas Day', month: 11, day: 25 }
  ],
  
  // United Kingdom
  'uk': [
    { name: 'New Year\'s Day', month: 0, day: 1 },
    { name: 'Good Friday', month: 3, easter: -2 },
    { name: 'Easter Monday', month: 3, easter: 1 },
    { name: 'Early May Bank Holiday', month: 4, day: 1, week: 1 }, // 1st Monday in May
    { name: 'Spring Bank Holiday', month: 4, day: 29, week: -1 }, // Last Monday in May
    { name: 'Summer Bank Holiday', month: 7, day: 25, week: -1 }, // Last Monday in August
    { name: 'Christmas Day', month: 11, day: 25 },
    { name: 'Boxing Day', month: 11, day: 26 }
  ],
  
  // Canada
  'ca': [
    { name: 'New Year\'s Day', month: 0, day: 1 },
    { name: 'Family Day', month: 1, day: 15, week: 3 }, // 3rd Monday in February
    { name: 'Good Friday', month: 3, easter: -2 },
    { name: 'Victoria Day', month: 4, day: 18, week: -1 }, // Monday before May 25
    { name: 'Canada Day', month: 6, day: 1 },
    { name: 'Labour Day', month: 8, day: 1, week: 1 }, // 1st Monday in September
    { name: 'National Day for Truth and Reconciliation', month: 8, day: 30 },
    { name: 'Thanksgiving Day', month: 9, day: 8, week: 2 }, // 2nd Monday in October
    { name: 'Remembrance Day', month: 10, day: 11 },
    { name: 'Christmas Day', month: 11, day: 25 },
    { name: 'Boxing Day', month: 11, day: 26 }
  ],
  
  // Australia
  'au': [
    { name: 'New Year\'s Day', month: 0, day: 1 },
    { name: 'Australia Day', month: 0, day: 26 },
    { name: 'Good Friday', month: 3, easter: -2 },
    { name: 'Easter Saturday', month: 3, easter: -1 },
    { name: 'Easter Sunday', month: 3, easter: 0 },
    { name: 'Easter Monday', month: 3, easter: 1 },
    { name: 'ANZAC Day', month: 3, day: 25 },
    { name: 'Christmas Day', month: 11, day: 25 },
    { name: 'Boxing Day', month: 11, day: 26 }
  ],
  
  // India
  'in': [
    { name: 'Republic Day', month: 0, day: 26 },
    { name: 'Independence Day', month: 7, day: 15 },
    { name: 'Gandhi Jayanti', month: 9, day: 2 }
  ],
  
  // Generic/International
  'generic': [
    { name: 'New Year\'s Day', month: 0, day: 1 },
    { name: 'Christmas Day', month: 11, day: 25 }
  ]
};

// Calculate Easter date for a given year (Western Christianity)
function calculateEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return { month, day };
}

// Get holidays for a specific year and country
function getHolidays(year, countryCode = 'generic') {
  const countryHolidays = PUBLIC_HOLIDAYS[countryCode.toLowerCase()] || PUBLIC_HOLIDAYS.generic;
  const holidays = [];
  const easter = calculateEaster(year);
  
  countryHolidays.forEach(holiday => {
    let date;
    
    if (holiday.easter !== undefined) {
      // Easter-based holiday
      const easterDate = new Date(year, easter.month, easter.day);
      easterDate.setDate(easterDate.getDate() + holiday.easter);
      date = new Date(easterDate);
    } else if (holiday.week !== undefined) {
      // Nth weekday of month
      const firstDay = new Date(year, holiday.month, 1);
      const targetDay = holiday.day || 1;
      const dayOfWeek = holiday.week > 0 ? holiday.week : 5; // Default to Monday if not specified
      
      // Find the first occurrence of the target weekday
      let currentDate = new Date(firstDay);
      while (currentDate.getDay() !== dayOfWeek) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // For negative weeks (last week), find the last occurrence
      if (holiday.week < 0) {
        const lastDay = new Date(year, holiday.month + 1, 0);
        currentDate = new Date(lastDay);
        while (currentDate.getDay() !== dayOfWeek) {
          currentDate.setDate(currentDate.getDate() - 1);
        }
      } else {
        // For positive weeks, add (week-1) weeks
        currentDate.setDate(currentDate.getDate() + (holiday.week - 1) * 7);
      }
      
      // If a specific day is provided, use that as the day of month
      if (holiday.day && holiday.day !== currentDate.getDate()) {
        // This is a special case like "Monday before May 25"
        // For now, just use the day
        date = new Date(year, holiday.month, holiday.day);
        // Adjust to the correct weekday
        while (date.getDay() !== dayOfWeek) {
          date.setDate(date.getDate() - 1);
        }
      } else {
        date = currentDate;
      }
    } else {
      // Fixed date holiday
      date = new Date(year, holiday.month, holiday.day);
    }
    
    holidays.push({
      name: holiday.name,
      date: new Date(date),
      month: date.getMonth(),
      day: date.getDate()
    });
  });
  
  return holidays;
}

// Check if a date is a public holiday
function isPublicHoliday(date, countryCode = 'generic') {
  const year = date.getFullYear();
  const holidays = getHolidays(year, countryCode);
  
  return holidays.some(holiday => 
    holiday.date.getDate() === date.getDate() &&
    holiday.date.getMonth() === date.getMonth() &&
    holiday.date.getFullYear() === date.getFullYear()
  );
}

// Check if a date is a weekend
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday (0) or Saturday (6)
}

// Check if a date is a teaching day (not weekend, not holiday)
function isTeachingDay(date, countryCode = 'generic') {
  return !isWeekend(date) && !isPublicHoliday(date, countryCode);
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getHolidays,
    isPublicHoliday,
    isWeekend,
    isTeachingDay,
    PUBLIC_HOLIDAYS
  };
}
