// Utility functions for the trip planner

// Generate a unique ID for itineraries and days
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Calculate approximate driving time between locations (placeholder implementation)
async function calculateDrivingTime(from, to) {
    // This is a placeholder - in production you'd use Google Maps API or similar
    // For now, return a random time between 30 minutes and 4 hours
    if (!from || !to || from === to) return 0;
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const minMinutes = 30;
    const maxMinutes = 240;
    const minutes = Math.floor(Math.random() * (maxMinutes - minMinutes) + minMinutes);
    
    return minutes;
}

// Format minutes into hours and minutes display
function formatDrivingTime(minutes) {
    if (minutes === 0) return '';
    if (minutes < 60) return `${minutes}m`;
    
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (remainingMinutes === 0) return `${hours}h`;
    return `${hours}h ${remainingMinutes}m`;
}

// Calculate total nights for a trip
function calculateTotalNights(startDate, endDate) {
    if (!startDate || !endDate) return 0;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const timeDiff = end.getTime() - start.getTime();
    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    
    return Math.max(0, daysDiff);
}

// Validate date range
function isValidDateRange(startDate, endDate) {
    if (!startDate || !endDate) return false;
    return new Date(startDate) <= new Date(endDate);
}

// Debounce function for input handling
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Format date for input fields
function formatDateForInput(date) {
    if (!date) return '';
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

// Get day name from date
function getDayName(date, dayOffset = 0) {
    if (!date) return `Day ${dayOffset + 1}`;
    
    const d = new Date(date);
    d.setDate(d.getDate() + dayOffset);
    
    const options = { weekday: 'long', month: 'short', day: 'numeric' };
    return d.toLocaleDateString('en-US', options);
}
