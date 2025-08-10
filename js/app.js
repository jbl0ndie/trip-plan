// Main App Controller for Single-Screen Trip Planner
class TripPlannerApp {
    constructor() {
        this.itineraries = [];
        this.selectedItineraries = new Set();
        this.isCompareMode = false;
        this.tripStartDate = '';
        this.tripEndDate = '';
        
        this.initializeApp();
    }

    initializeApp() {
        this.loadData();
        this.bindEvents();
        this.render();
    }

    loadData() {
        // Load saved data from localStorage
        this.itineraries = StorageManager.loadItineraries();
        
        // If no itineraries exist, create a sample one for testing
        if (this.itineraries.length === 0) {
            const sampleItinerary = new Itinerary();
            sampleItinerary.name = 'Sample Itinerary';
            sampleItinerary.addLocation({
                name: 'Sydney',
                day: 1,
                nights: 2,
                drivingTime: 0
            });
            sampleItinerary.addLocation({
                name: 'Melbourne', 
                day: 2,
                nights: 3,
                drivingTime: 540
            });
            this.itineraries.push(sampleItinerary);
        }
        
        // Load trip dates
        const tripData = StorageManager.loadTripData();
        this.tripStartDate = tripData.startDate || '';
        this.tripEndDate = tripData.endDate || '';
        
        // Update UI with loaded dates
        if (this.tripStartDate) {
            document.getElementById('trip-start').value = this.tripStartDate;
        }
        if (this.tripEndDate) {
            document.getElementById('trip-end').value = this.tripEndDate;
        }
        
        this.updateTripDuration();
    }

    bindEvents() {        
        // Trip date changes
        const tripStart = document.getElementById('trip-start');
        const tripEnd = document.getElementById('trip-end');
        
        if (tripStart) {
            tripStart.addEventListener('change', (e) => {
                this.tripStartDate = e.target.value;
                this.saveTripData();
                this.updateTripDuration();
            });
        }

        if (tripEnd) {
            tripEnd.addEventListener('change', (e) => {
                this.tripEndDate = e.target.value;
                this.saveTripData();
                this.updateTripDuration();
            });
        }

        // Main action buttons
        const addBtn = document.getElementById('add-itinerary-btn');
        const compareBtn = document.getElementById('compare-mode-btn');
        const exportBtn = document.getElementById('export-btn');

        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.addItinerary();
            });
        }

        if (compareBtn) {
            compareBtn.addEventListener('click', () => {
                this.toggleCompareMode();
            });
        }

        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportSelectedItinerary();
            });
        }

        // Comparison view
        const closeComparisonBtn = document.getElementById('close-comparison-btn');
        if (closeComparisonBtn) {
            closeComparisonBtn.addEventListener('click', () => {
                this.hideComparison();
            });
        }

        // Event delegation for dynamically created buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-location-btn')) {
                const card = e.target.closest('.itinerary-card');
                const itineraryId = card.dataset.itineraryId;
                this.addLocationToItinerary(itineraryId);
            } else if (e.target.classList.contains('location-remove')) {
                const locationItem = e.target.closest('.location-item');
                const card = locationItem.closest('.itinerary-card');
                const itineraryId = card.dataset.itineraryId;
                const locationId = locationItem.dataset.locationId;
                this.removeLocationFromItinerary(itineraryId, locationId);
            }
        });

        // Event delegation for location input changes
        const self = this; // Preserve 'this' context
        document.addEventListener('input', (e) => {
            if (e.target.closest('.location-item')) {
                const locationItem = e.target.closest('.location-item');
                const card = locationItem.closest('.itinerary-card');
                const itineraryId = card.dataset.itineraryId;
                const locationId = locationItem.dataset.locationId;
                
                self.updateLocationData(itineraryId, locationId, e.target);
            }
        });
    }

    addItinerary() {
        const newItinerary = new Itinerary();
        newItinerary.name = `Itinerary ${Utils.getAlphabetLetter(this.itineraries.length)}`;
        
        // Add a default location to start with
        newItinerary.addLocation({
            name: '',
            day: 1,
            nights: 1,
            drivingTime: 0
        });

        this.itineraries.push(newItinerary);
        this.saveItineraries();
        this.render();

        // Focus on the new itinerary name input
        setTimeout(() => {
            const nameInput = document.querySelector(`[data-itinerary-id="${newItinerary.id}"] .itinerary-name-input`);
            if (nameInput) nameInput.focus();
        }, 100);
    }

    addLocationToItinerary(itineraryId) {
        const itinerary = this.itineraries.find(it => it.id === itineraryId);
        if (!itinerary) return;

        const newLocation = {
            name: '',
            day: itinerary.locations.length + 1,
            nights: 1,
            drivingTime: 0
        };

        itinerary.addLocation(newLocation);
        this.saveItineraries();
        this.render();

        // Focus on the new location name input
        setTimeout(() => {
            const card = document.querySelector(`[data-itinerary-id="${itineraryId}"]`);
            const locationInputs = card.querySelectorAll('.location-name');
            const lastInput = locationInputs[locationInputs.length - 1];
            if (lastInput) lastInput.focus();
        }, 100);
    }

    removeLocationFromItinerary(itineraryId, locationId) {
        const itinerary = this.itineraries.find(it => it.id === itineraryId);
        if (!itinerary) return;

        // Don't allow removing the last location - ensure at least one remains
        if (itinerary.locations.length <= 1) {
            Utils.showToast('Cannot remove the last location from an itinerary', 'warning');
            return;
        }

        // Remove the location from the itinerary
        const locationIndex = itinerary.locations.findIndex(loc => loc.id === locationId);
        if (locationIndex > -1) {
            itinerary.locations.splice(locationIndex, 1);
            
            // Update calculations and save
            itinerary.updateCalculations();
            this.saveItineraries();
            this.render();
        }
    }

    updateLocationData(itineraryId, locationId, inputElement) {
        const itinerary = this.itineraries.find(it => it.id === itineraryId);
        if (!itinerary) return;
        
        const location = itinerary.locations.find(loc => loc.id === locationId);
        if (!location) return;
        
        // Update the location data based on the input type
        if (inputElement.classList.contains('location-name')) {
            location.name = inputElement.value;
        } else if (inputElement.type === 'number') {
            if (inputElement.closest('.location-nights')) {
                location.nights = parseInt(inputElement.value) || 0;
            } else if (inputElement.closest('.location-drive-time')) {
                location.drivingTime = parseInt(inputElement.value) || 0;
            }
        }
        
        // Recalculate totals and update UI
        itinerary.updateCalculations();
        this.saveItineraries();
        
        // Re-render just the summary for this itinerary
        this.updateItinerarySummary(itineraryId);
    }

    updateItinerarySummary(itineraryId) {
        const itinerary = this.itineraries.find(it => it.id === itineraryId);
        if (!itinerary) return;
        
        const card = document.querySelector(`[data-itinerary-id="${itineraryId}"]`);
        if (!card) return;
        
        const summary = card.querySelector('.itinerary-summary');
        if (summary) {
            summary.innerHTML = `
                <div class="summary-stat">
                    <span class="label">Locations</span>
                    <span class="value">${itinerary.locations.length}</span>
                </div>
                <div class="summary-stat">
                    <span class="label">Nights</span>
                    <span class="value">${itinerary.getTotalNights()}</span>
                </div>
                <div class="summary-stat">
                    <span class="label">Drive Time</span>
                    <span class="value">${Utils.formatDriveTime(itinerary.getTotalDriveTime())}</span>
                </div>
            `;
        }
    }

    toggleCompareMode() {
        console.log('Toggle compare mode - not implemented yet');
    }

    exportSelectedItinerary() {
        console.log('Export selected itinerary - not implemented yet');
    }

    hideComparison() {
        const comparisonView = document.getElementById('comparison-view');
        if (comparisonView) {
            comparisonView.classList.add('hidden');
        }
    }

    updateItineraryName(itineraryId, newName) {
        const itinerary = this.itineraries.find(it => it.id === itineraryId);
        if (itinerary) {
            itinerary.name = newName;
            itinerary.updateLastModified();
            this.saveItineraries();
        }
    }

    saveItineraries() {
        StorageManager.saveItineraries(this.itineraries);
    }

    render() {
        this.renderItineraries();
    }

    renderItineraries() {
        const container = document.getElementById('itineraries-container');
        
        if (!container) {
            console.error('Could not find itineraries-container element');
            return;
        }
        
        container.innerHTML = '';

        this.itineraries.forEach((itinerary) => {
            const card = this.createItineraryCard(itinerary);
            container.appendChild(card);
        });
    }

    createItineraryCard(itinerary) {
        const card = document.createElement('div');
        card.className = 'itinerary-card';
        card.dataset.itineraryId = itinerary.id;

        card.innerHTML = `
            <div class="itinerary-header">
                <input type="text" class="itinerary-name-input" value="${itinerary.name}" 
                       onblur="app.updateItineraryName('${itinerary.id}', this.value)"
                       onkeypress="if(event.key==='Enter') this.blur()">
                <div class="itinerary-actions">
                    <button class="btn-icon" title="Duplicate">📋</button>
                    <button class="btn-icon" title="Delete">🗑️</button>
                </div>
            </div>
            <div class="itinerary-body">
                <div class="location-list">
                    ${itinerary.locations.map(location => this.createLocationHTML(itinerary.id, location)).join('')}
                </div>
                <button class="add-location-btn">+ Add Location</button>
                <div class="itinerary-summary">
                    <div class="summary-stat">
                        <span class="label">Locations</span>
                        <span class="value">${itinerary.locations.length}</span>
                    </div>
                    <div class="summary-stat">
                        <span class="label">Nights</span>
                        <span class="value">${itinerary.getTotalNights()}</span>
                    </div>
                    <div class="summary-stat">
                        <span class="label">Drive Time</span>
                        <span class="value">${Utils.formatDriveTime(itinerary.getTotalDriveTime())}</span>
                    </div>
                </div>
            </div>
        `;

        return card;
    }

    createLocationHTML(itineraryId, location) {
        return `
            <div class="location-item" data-location-id="${location.id}">
                <input type="text" class="location-name" value="${location.name}" 
                       placeholder="Enter location">
                <div class="location-details">
                    <div class="location-nights">
                        <input type="number" value="${location.nights}" min="0" max="30">
                        <span>nights</span>
                    </div>
                    <div class="location-drive-time">
                        🚗 <input type="number" value="${location.drivingTime}" min="0" max="1440">
                        <span>min</span>
                    </div>
                    <button class="location-remove" title="Remove location">×</button>
                </div>
            </div>
        `;
    }

    saveTripData() {
        StorageManager.saveTripData({
            startDate: this.tripStartDate,
            endDate: this.tripEndDate
        });
    }

    updateTripDuration() {
        const durationElement = document.getElementById('trip-duration');
        
        if (this.tripStartDate && this.tripEndDate) {
            const days = Utils.calculateDaysBetween(this.tripStartDate, this.tripEndDate);
            durationElement.textContent = `${days} day${days !== 1 ? 's' : ''}`;
        } else {
            durationElement.textContent = '0 days';
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.app = new TripPlannerApp();
    } catch (error) {
        console.error('Error creating app:', error);
    }
});
