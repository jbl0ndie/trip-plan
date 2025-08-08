// Utility functions for the trip planner

class Utils {
    // Generate a unique ID for itineraries and locations
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Format minutes into hours and minutes display
    static formatDriveTime(minutes) {
        if (minutes === 0) return '0m';
        if (minutes < 60) return `${minutes}m`;
        
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (remainingMinutes === 0) return `${hours}h`;
        return `${hours}h ${remainingMinutes}m`;
    }

    // Calculate days between two dates
    static calculateDaysBetween(startDate, endDate) {
        if (!startDate || !endDate) return 0;
        
        const start = new Date(startDate);
        const end = new Date(endDate);
        const timeDiff = end.getTime() - start.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        return Math.max(0, daysDiff);
    }

    // Validate date range
    static isValidDateRange(startDate, endDate) {
        if (!startDate || !endDate) return false;
        return new Date(startDate) < new Date(endDate);
    }

    // Format date for display
    static formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    // Debounce function for input handling
    static debounce(func, wait) {
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

    // Deep clone an object
    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    // Validate location name
    static isValidLocation(location) {
        return location && location.trim().length > 0;
    }

    // Generate alphabet letters for itinerary naming
    static getAlphabetLetter(index) {
        return String.fromCharCode(65 + (index % 26));
    }

    // Convert 24-hour time to 12-hour format
    static formatTime12Hour(time24) {
        if (!time24) return '';
        const [hours, minutes] = time24.split(':');
        const hour12 = hours % 12 || 12;
        const ampm = hours < 12 ? 'AM' : 'PM';
        return `${hour12}:${minutes} ${ampm}`;
    }

    // Estimate driving time based on distance (very basic)
    static estimateDrivingMinutes(distanceKm) {
        // Assume average speed of 60 km/h including stops
        return Math.round(distanceKm);
    }

    // Check if device is mobile
    static isMobile() {
        return window.innerWidth <= 768;
    }

    // Smooth scroll to element
    static scrollToElement(element, offset = 0) {
        if (!element) return;
        
        const elementPosition = element.offsetTop;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }

    // Show toast notification (basic implementation)
    static showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Basic styling
        Object.assign(toast.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 20px',
            borderRadius: '4px',
            color: 'white',
            zIndex: '1000',
            fontSize: '14px',
            fontWeight: '500'
        });

        // Set background color based on type
        switch (type) {
            case 'success':
                toast.style.backgroundColor = '#48bb78';
                break;
            case 'error':
                toast.style.backgroundColor = '#f56565';
                break;
            case 'warning':
                toast.style.backgroundColor = '#ed8936';
                break;
            default:
                toast.style.backgroundColor = '#4299e1';
        }

        document.body.appendChild(toast);

        // Remove after duration
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, duration);
    }
}
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
