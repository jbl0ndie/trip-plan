// Main App Controller
class TripPlannerApp {
    constructor() {
        this.currentScreen = 'home';
        this.currentItinerary = null;
        this.selectedItineraries = new Set();
        this.itineraries = [];
        
        this.initializeApp();
    }

    initializeApp() {
        this.loadData();
        this.bindEvents();
        this.showScreen('home');
        this.updateItineraryList();
    }

    loadData() {
        // Load saved data from localStorage
        this.itineraries = StorageManager.loadItineraries();
        
        // Load trip dates
        const tripData = StorageManager.loadTripData();
        if (tripData.startDate) {
            document.getElementById('trip-start').value = tripData.startDate;
        }
        if (tripData.endDate) {
            document.getElementById('trip-end').value = tripData.endDate;
        }
    }

    bindEvents() {
        // Bottom navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const screen = e.currentTarget.dataset.screen;
                this.showScreen(screen);
            });
        });

        // Back button
        document.getElementById('back-btn').addEventListener('click', () => {
            this.showScreen('home');
        });

        // Home screen events
        document.getElementById('add-itinerary-btn').addEventListener('click', () => {
            this.createNewItinerary();
        });

        document.getElementById('compare-itineraries-btn').addEventListener('click', () => {
            if (this.selectedItineraries.size >= 2) {
                this.showScreen('compare');
            }
        });

        // Edit screen events
        document.getElementById('duplicate-itinerary-btn').addEventListener('click', () => {
            this.duplicateCurrentItinerary();
        });

        document.getElementById('save-itinerary-btn').addEventListener('click', () => {
            this.saveCurrentItinerary();
        });

        document.getElementById('add-location-btn').addEventListener('click', () => {
            this.addLocationToItinerary();
        });

        // Compare screen events
        document.getElementById('export-selected-btn').addEventListener('click', () => {
            this.exportSelectedItinerary();
        });

        // Trip date changes
        document.getElementById('trip-start').addEventListener('change', this.saveTripData.bind(this));
        document.getElementById('trip-end').addEventListener('change', this.saveTripData.bind(this));

        // Itinerary name changes
        document.getElementById('itinerary-name').addEventListener('blur', () => {
            if (this.currentItinerary) {
                this.currentItinerary.name = document.getElementById('itinerary-name').value;
                this.saveCurrentItinerary();
            }
        });
    }

    showScreen(screenName) {
        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.screen === screenName) {
                item.classList.add('active');
            }
        });

        // Update screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active', 'prev');
        });

        const targetScreen = document.getElementById(`${screenName}-screen`);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        // Update header
        const pageTitle = document.getElementById('page-title');
        const backBtn = document.getElementById('back-btn');

        switch (screenName) {
            case 'home':
                pageTitle.textContent = 'Trip Planner';
                backBtn.style.display = 'none';
                break;
            case 'edit':
                pageTitle.textContent = this.currentItinerary ? this.currentItinerary.name : 'Edit Itinerary';
                backBtn.style.display = 'block';
                break;
            case 'compare':
                pageTitle.textContent = 'Compare';
                backBtn.style.display = 'block';
                break;
        }

        this.currentScreen = screenName;

        // Screen-specific updates
        if (screenName === 'compare') {
            this.updateCompareView();
        } else if (screenName === 'edit') {
            this.updateEditView();
        }
    }

    createNewItinerary() {
        const newItinerary = new Itinerary();
        newItinerary.name = `Itinerary ${String.fromCharCode(65 + this.itineraries.length)}`;
        
        this.itineraries.push(newItinerary);
        this.currentItinerary = newItinerary;
        
        this.showScreen('edit');
        this.updateItineraryList();
    }

    duplicateCurrentItinerary() {
        if (!this.currentItinerary) return;

        const duplicated = this.currentItinerary.clone();
        duplicated.name = `${this.currentItinerary.name} Copy`;
        
        this.itineraries.push(duplicated);
        this.currentItinerary = duplicated;
        
        this.updateEditView();
        this.updateItineraryList();
    }

    saveCurrentItinerary() {
        if (this.currentItinerary) {
            StorageManager.saveItineraries(this.itineraries);
            this.updateItineraryList();
            
            // Visual feedback
            const saveBtn = document.getElementById('save-itinerary-btn');
            const originalHTML = saveBtn.innerHTML;
            saveBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>';
            setTimeout(() => {
                saveBtn.innerHTML = originalHTML;
            }, 1000);
        }
    }

    saveTripData() {
        const startDate = document.getElementById('trip-start').value;
        const endDate = document.getElementById('trip-end').value;
        
        StorageManager.saveTripData({ startDate, endDate });
        
        // Update all itineraries if dates changed
        this.updateAllCalculations();
    }

    addLocationToItinerary() {
        if (!this.currentItinerary) return;

        const newLocation = {
            id: Utils.generateId(),
            name: 'New Location',
            day: this.currentItinerary.locations.length + 1,
            nights: 1,
            drivingTime: 0
        };

        this.currentItinerary.addLocation(newLocation);
        this.updateEditView();
    }

    editItinerary(itinerary) {
        this.currentItinerary = itinerary;
        this.showScreen('edit');
    }

    deleteItinerary(itinerary) {
        const index = this.itineraries.indexOf(itinerary);
        if (index > -1) {
            this.itineraries.splice(index, 1);
            StorageManager.saveItineraries(this.itineraries);
            this.updateItineraryList();
        }
    }

    toggleItinerarySelection(itinerary) {
        if (this.selectedItineraries.has(itinerary.id)) {
            this.selectedItineraries.delete(itinerary.id);
        } else {
            this.selectedItineraries.add(itinerary.id);
        }
        
        this.updateItineraryList();
        
        // Update compare button state
        const compareBtn = document.getElementById('compare-itineraries-btn');
        compareBtn.disabled = this.selectedItineraries.size < 2;
    }

    updateItineraryList() {
        const container = document.getElementById('itinerary-list');
        container.innerHTML = '';

        this.itineraries.forEach(itinerary => {
            const card = this.createItineraryCard(itinerary);
            container.appendChild(card);
        });
    }

    createItineraryCard(itinerary) {
        const card = document.createElement('div');
        card.className = 'itinerary-card';
        if (this.selectedItineraries.has(itinerary.id)) {
            card.classList.add('selected');
        }

        const totalNights = itinerary.getTotalNights();
        const totalDriveTime = itinerary.getTotalDriveTime();

        card.innerHTML = `
            <h3>${itinerary.name}</h3>
            <div class="itinerary-meta">
                <span>${itinerary.locations.length} locations</span>
                <span>${totalNights} nights</span>
                <span>${Utils.formatDriveTime(totalDriveTime)}</span>
            </div>
        `;

        // Single tap to select, double tap to edit
        let tapCount = 0;
        card.addEventListener('click', () => {
            tapCount++;
            setTimeout(() => {
                if (tapCount === 1) {
                    this.toggleItinerarySelection(itinerary);
                } else if (tapCount === 2) {
                    this.editItinerary(itinerary);
                }
                tapCount = 0;
            }, 300);
        });

        return card;
    }

    updateEditView() {
        if (!this.currentItinerary) return;

        // Update title
        document.getElementById('itinerary-name').value = this.currentItinerary.name;

        // Update locations
        const container = document.getElementById('itinerary-items');
        container.innerHTML = '';

        this.currentItinerary.locations.forEach((location, index) => {
            const item = this.createLocationItem(location, index);
            container.appendChild(item);
        });

        // Update summary
        this.updateSummary();
    }

    createLocationItem(location, index) {
        const item = document.createElement('div');
        item.className = 'itinerary-item';
        
        item.innerHTML = `
            <div class="item-header">
                <input type="text" class="item-location" value="${location.name}" 
                       onblur="app.updateLocationName('${location.id}', this.value)">
                <span class="item-day">Day ${location.day}</span>
            </div>
            <div class="item-details">
                <div class="driving-time">
                    🚗 <input type="number" value="${location.drivingTime}" min="0" max="1440" 
                             style="width: 60px; border: none; background: transparent;"
                             onchange="app.updateDrivingTime('${location.id}', this.value)"> min
                </div>
                <div class="nights">
                    <input type="number" value="${location.nights}" min="0" max="30"
                           style="width: 40px; border: none; background: transparent;"
                           onchange="app.updateNights('${location.id}', this.value)"> nights
                </div>
            </div>
        `;

        return item;
    }

    updateLocationName(locationId, newName) {
        if (!this.currentItinerary) return;
        
        const location = this.currentItinerary.locations.find(l => l.id === locationId);
        if (location) {
            location.name = newName;
            this.updateSummary();
        }
    }

    updateDrivingTime(locationId, newTime) {
        if (!this.currentItinerary) return;
        
        const location = this.currentItinerary.locations.find(l => l.id === locationId);
        if (location) {
            location.drivingTime = parseInt(newTime) || 0;
            this.updateSummary();
        }
    }

    updateNights(locationId, newNights) {
        if (!this.currentItinerary) return;
        
        const location = this.currentItinerary.locations.find(l => l.id === locationId);
        if (location) {
            location.nights = parseInt(newNights) || 0;
            this.updateSummary();
        }
    }

    updateSummary() {
        if (!this.currentItinerary) return;

        const totalNights = this.currentItinerary.getTotalNights();
        const totalDriveTime = this.currentItinerary.getTotalDriveTime();

        document.getElementById('total-nights').textContent = totalNights;
        document.getElementById('total-drive-time').textContent = Utils.formatDriveTime(totalDriveTime);
    }

    updateCompareView() {
        const container = document.getElementById('comparison-grid');
        container.innerHTML = '';

        const selectedItineraries = this.itineraries.filter(it => this.selectedItineraries.has(it.id));
        
        selectedItineraries.forEach(itinerary => {
            const card = this.createComparisonCard(itinerary);
            container.appendChild(card);
        });
    }

    createComparisonCard(itinerary) {
        const card = document.createElement('div');
        card.className = 'comparison-card';
        
        const totalNights = itinerary.getTotalNights();
        const totalDriveTime = itinerary.getTotalDriveTime();

        card.innerHTML = `
            <h3>${itinerary.name}</h3>
            <div class="comparison-summary">
                <div class="summary-stat">
                    <div class="number">${itinerary.locations.length}</div>
                    <div class="label">Locations</div>
                </div>
                <div class="summary-stat">
                    <div class="number">${totalNights}</div>
                    <div class="label">Nights</div>
                </div>
                <div class="summary-stat">
                    <div class="number">${Math.round(totalDriveTime / 60)}</div>
                    <div class="label">Drive Hours</div>
                </div>
            </div>
            <div class="location-list">
                ${itinerary.locations.map(loc => `
                    <div class="location-item">
                        <span class="location-name">${loc.name}</span>
                        <span class="location-time">${loc.nights}n, ${Utils.formatDriveTime(loc.drivingTime)}</span>
                    </div>
                `).join('')}
            </div>
        `;

        return card;
    }

    updateAllCalculations() {
        this.itineraries.forEach(itinerary => {
            itinerary.updateCalculations();
        });
        
        if (this.currentScreen === 'edit') {
            this.updateSummary();
        }
        
        this.updateItineraryList();
    }

    exportSelectedItinerary() {
        const selectedItineraries = this.itineraries.filter(it => this.selectedItineraries.has(it.id));
        if (selectedItineraries.length === 0) return;

        // For now, export the first selected itinerary
        const itinerary = selectedItineraries[0];
        const tripData = StorageManager.loadTripData();
        
        ExportManager.exportToICS(itinerary, tripData.startDate, tripData.endDate);
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TripPlannerApp();
});
