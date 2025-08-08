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
        document.getElementById('trip-start').addEventListener('change', (e) => {
            this.tripStartDate = e.target.value;
            this.saveTripData();
            this.updateTripDuration();
        });

        document.getElementById('trip-end').addEventListener('change', (e) => {
            this.tripEndDate = e.target.value;
            this.saveTripData();
            this.updateTripDuration();
        });

        // Main action buttons
        document.getElementById('add-itinerary-btn').addEventListener('click', () => {
            this.addItinerary();
        });

        document.getElementById('compare-mode-btn').addEventListener('click', () => {
            this.toggleCompareMode();
        });

        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportSelectedItinerary();
        });

        // Comparison view
        document.getElementById('close-comparison-btn').addEventListener('click', () => {
            this.hideComparison();
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
        container.innerHTML = '';

        this.itineraries.forEach(itinerary => {
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
                <div class="location-day">Day ${location.day}</div>
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
    window.app = new TripPlannerApp();
});
