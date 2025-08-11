// Itinerary class and related functions

class Itinerary {
    constructor(name = 'New Itinerary') {
        this.id = Utils.generateId();
        this.name = name;
        this.locations = [];
        this.totalDrivingTime = 0;
        this.totalNights = 0;
        this.isSelected = false;
        this.createdAt = new Date().toISOString();
        this.lastModified = new Date().toISOString();
    }

    addLocation(locationData = {}) {
        const location = {
            id: Utils.generateId(),
            name: locationData.name || 'New Location',
            day: locationData.day || this.locations.length + 1,
            nights: locationData.nights || 1,
            drivingTime: locationData.drivingTime || 0,
            notes: locationData.notes || ''
        };
        
        this.locations.push(location);
        this.updateCalculations();
        this.updateLastModified();
        
        return location;
    }

    removeLocation(locationId) {
        const index = this.locations.findIndex(loc => loc.id === locationId);
        if (index > -1) {
            this.locations.splice(index, 1);
            this.reorderDays();
            this.updateCalculations();
            this.updateLastModified();
        }
    }

    updateLocation(locationId, updates) {
        const location = this.locations.find(loc => loc.id === locationId);
        if (location) {
            Object.assign(location, updates);
            this.updateCalculations();
            this.updateLastModified();
        }
    }

    reorderDays() {
        this.locations.forEach((location, index) => {
            location.day = index + 1;
        });
    }

    moveLocation(fromIndex, toIndex) {
        if (fromIndex < 0 || fromIndex >= this.locations.length ||
            toIndex < 0 || toIndex >= this.locations.length) {
            return;
        }

        const location = this.locations.splice(fromIndex, 1)[0];
        this.locations.splice(toIndex, 0, location);
        this.reorderDays();
        this.updateCalculations();
        this.updateLastModified();
    }

    updateCalculations() {
        // Calculate total nights (excluding first and last locations)
        this.totalNights = this.locations.reduce((total, location, index) => {
            const isFirst = index === 0;
            const isLast = index === this.locations.length - 1;
            
            // Only count nights for middle locations (not first or last)
            if (!isFirst && !isLast) {
                return total + (location.nights || 0);
            }
            return total;
        }, 0);

        // Calculate total driving time
        this.totalDrivingTime = this.locations.reduce((total, location) => {
            return total + (location.drivingTime || 0);
        }, 0);
    }

    getTotalNights() {
        return this.totalNights;
    }

    getTotalDriveTime() {
        return this.totalDrivingTime;
    }

    getTotalDays() {
        return this.locations.length;
    }

    getDuration() {
        // Calculate total trip duration including travel days
        const travelDays = Math.max(0, this.locations.length - 1); // Days spent traveling
        const stayDays = this.totalNights; // Days spent at locations
        return travelDays + stayDays;
    }

    validateDates(tripStartDate, tripEndDate) {
        if (!tripStartDate || !tripEndDate) return { isValid: false, message: 'Trip dates not set' };

        const start = new Date(tripStartDate);
        const end = new Date(tripEndDate);
        const tripDuration = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        const itineraryDuration = this.getDuration();

        return {
            isValid: tripDuration === itineraryDuration,
            tripDuration,
            itineraryDuration,
            message: tripDuration === itineraryDuration 
                ? 'Dates match perfectly!' 
                : `Trip is ${tripDuration} days, itinerary is ${itineraryDuration} days`
        };
    }

    clone() {
        const cloned = new Itinerary(this.name);
        cloned.locations = this.locations.map(location => ({
            id: Utils.generateId(), // New ID for cloned location
            name: location.name,
            day: location.day,
            nights: location.nights,
            drivingTime: location.drivingTime,
            notes: location.notes
        }));
        cloned.updateCalculations();
        return cloned;
    }

    updateLastModified() {
        this.lastModified = new Date().toISOString();
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            locations: this.locations,
            totalDrivingTime: this.totalDrivingTime,
            totalNights: this.totalNights,
            isSelected: this.isSelected,
            createdAt: this.createdAt,
            lastModified: this.lastModified
        };
    }

    static fromJSON(data) {
        const itinerary = new Itinerary(data.name);
        itinerary.id = data.id;
        itinerary.locations = data.locations || [];
        itinerary.totalDrivingTime = data.totalDrivingTime || 0;
        itinerary.totalNights = data.totalNights || 0;
        itinerary.isSelected = data.isSelected || false;
        itinerary.createdAt = data.createdAt || new Date().toISOString();
        itinerary.lastModified = data.lastModified || new Date().toISOString();
        
        // Ensure all locations have proper IDs
        itinerary.locations.forEach(location => {
            if (!location.id) {
                location.id = Utils.generateId();
            }
        });
        
        itinerary.updateCalculations();
        return itinerary;
    }
}

// Location helper functions
class LocationHelper {
    static createEmptyLocation(day = 1) {
        return {
            id: Utils.generateId(),
            name: '',
            day: day,
            nights: 1,
            drivingTime: 0,
            notes: ''
        };
    }

    static estimateDrivingTime(location1, location2) {
        // This is a placeholder for actual driving time calculation
        // In a real implementation, this would use a mapping API like Google Maps
        if (!location1 || !location2 || location1 === location2) {
            return 0;
        }

        // Simple estimation based on location names
        // This is just for demo purposes
        const distance = this.estimateDistance(location1, location2);
        return Math.round(distance * 1.5); // Assume 40 km/h average including stops
    }

    static estimateDistance(location1, location2) {
        // Simple placeholder distance estimation
        // In reality, this would use geocoding and distance calculation
        const commonDistances = {
            'same': 0,
            'nearby': 30,
            'city': 120,
            'regional': 300,
            'interstate': 600
        };

        // Very basic heuristic based on common location patterns
        if (location1.toLowerCase() === location2.toLowerCase()) {
            return commonDistances.same;
        }

        // Check if locations contain common city/state patterns
        const loc1Words = location1.toLowerCase().split(/[\s,]+/);
        const loc2Words = location2.toLowerCase().split(/[\s,]+/);
        
        const commonWords = loc1Words.filter(word => loc2Words.includes(word));
        
        if (commonWords.length > 1) {
            return commonDistances.nearby;
        } else if (commonWords.length === 1) {
            return commonDistances.regional;
        } else {
            return commonDistances.interstate;
        }
    }

    static async fetchDrivingTime(origin, destination) {
        // Placeholder for actual API integration
        // This would integrate with Google Maps Directions API or similar
        return new Promise((resolve) => {
            setTimeout(() => {
                const estimatedTime = LocationHelper.estimateDrivingTime(origin, destination);
                resolve(estimatedTime);
            }, 500);
        });
    }
}

// Trip validation helpers
class TripValidator {
    static validateItinerary(itinerary, tripStartDate, tripEndDate) {
        const errors = [];
        const warnings = [];

        // Check for empty locations
        const emptyLocations = itinerary.locations.filter(loc => !loc.name.trim());
        if (emptyLocations.length > 0) {
            errors.push(`${emptyLocations.length} location(s) need names`);
        }

        // Check for zero-night stays
        const zeroNights = itinerary.locations.filter(loc => loc.nights === 0);
        if (zeroNights.length > 0) {
            warnings.push(`${zeroNights.length} location(s) have 0 nights`);
        }

        // Validate against trip dates
        if (tripStartDate && tripEndDate) {
            const dateValidation = itinerary.validateDates(tripStartDate, tripEndDate);
            if (!dateValidation.isValid) {
                warnings.push(dateValidation.message);
            }
        }

        // Check for excessive driving
        if (itinerary.totalDrivingTime > 480) { // More than 8 hours total
            warnings.push('Total driving time exceeds 8 hours');
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    static compareItineraries(itineraries) {
        if (!itineraries || itineraries.length < 2) {
            return { error: 'Need at least 2 itineraries to compare' };
        }

        const comparison = {
            summary: {},
            details: []
        };

        itineraries.forEach(itinerary => {
            comparison.details.push({
                id: itinerary.id,
                name: itinerary.name,
                locations: itinerary.locations.length,
                totalNights: itinerary.getTotalNights(),
                totalDriveTime: itinerary.getTotalDriveTime(),
                totalDays: itinerary.getTotalDays(),
                efficiency: this.calculateEfficiency(itinerary)
            });
        });

        // Calculate summary statistics
        comparison.summary = {
            mostLocations: Math.max(...comparison.details.map(d => d.locations)),
            fewestLocations: Math.min(...comparison.details.map(d => d.locations)),
            longestStay: Math.max(...comparison.details.map(d => d.totalNights)),
            shortestStay: Math.min(...comparison.details.map(d => d.totalNights)),
            mostDriving: Math.max(...comparison.details.map(d => d.totalDriveTime)),
            leastDriving: Math.min(...comparison.details.map(d => d.totalDriveTime)),
            mostEfficient: Math.max(...comparison.details.map(d => d.efficiency))
        };

        return comparison;
    }

    static calculateEfficiency(itinerary) {
        // Simple efficiency metric: nights stayed vs driving time
        if (itinerary.totalDrivingTime === 0) return 100;
        return Math.round((itinerary.totalNights * 60) / (itinerary.totalNights * 60 + itinerary.totalDrivingTime) * 100);
    }
}
