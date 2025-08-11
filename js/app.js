// Main App Controller for Single-Screen Trip Planner
class TripPlannerApp {
    constructor() {
        this.itineraries = [];
        this.selectedItineraries = new Set();
        this.isCompareMode = false;
        this.tripStartDate = '';
        this.tripEndDate = '';
        this.routingService = new RoutingService();
        
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
                name: 'London',
                day: 1,
                nights: 2,
                drivingTime: 0
            });
            sampleItinerary.addLocation({
                name: 'Bath', 
                day: 2,
                nights: 1,
                drivingTime: 120
            });
            sampleItinerary.addLocation({
                name: 'Edinburgh', 
                day: 3,
                nights: 2,
                drivingTime: 300
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
            } else if (e.target.classList.contains('calculate-drive-times-btn')) {
                const card = e.target.closest('.itinerary-card');
                const itineraryId = card.dataset.itineraryId;
                this.calculateDriveTimes(itineraryId);
            } else if (e.target.classList.contains('edit-drive-time-btn')) {
                this.toggleDriveTimeEdit(e.target);
            } else if (e.target.closest('.itinerary-actions .btn-icon[title="Delete"]')) {
                const card = e.target.closest('.itinerary-card');
                const itineraryId = card.dataset.itineraryId;
                this.deleteItinerary(itineraryId);
            } else if (e.target.closest('.itinerary-actions .btn-icon[title="Duplicate"]')) {
                const card = e.target.closest('.itinerary-card');
                const itineraryId = card.dataset.itineraryId;
                this.duplicateItinerary(itineraryId);
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

        document.addEventListener('blur', (e) => {
            if (e.target.classList.contains('drive-time-input')) {
                this.finishDriveTimeEdit(e.target);
            }
        });

        // Drag and drop event listeners for location reordering
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        let draggedElement = null;
        let draggedItineraryId = null;

        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('drag-handle')) {
                // Get the parent location item
                draggedElement = e.target.closest('.location-item');
                const card = draggedElement.closest('.itinerary-card');
                draggedItineraryId = card.dataset.itineraryId;
                
                // Add visual feedback classes
                draggedElement.classList.add('dragging');
                draggedElement.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', draggedElement.outerHTML);
            }
        });

        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('drag-handle') && draggedElement) {
                // Remove visual feedback
                draggedElement.classList.remove('dragging');
                draggedElement.style.opacity = '';
                draggedElement = null;
                draggedItineraryId = null;
                
                // Remove any drop zone indicators
                document.querySelectorAll('.drop-zone').forEach(zone => {
                    zone.classList.remove('drop-zone');
                });
            }
        });

        document.addEventListener('dragover', (e) => {
            if (draggedElement) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                const targetLocationItem = e.target.closest('.location-item');
                const targetCard = e.target.closest('.itinerary-card');
                
                // Only allow dropping within the same itinerary
                if (targetCard && targetCard.dataset.itineraryId === draggedItineraryId) {
                    if (targetLocationItem && targetLocationItem !== draggedElement) {
                        // Remove existing drop zone indicators
                        document.querySelectorAll('.drop-zone').forEach(zone => {
                            zone.classList.remove('drop-zone');
                        });
                        
                        // Add drop zone indicator
                        targetLocationItem.classList.add('drop-zone');
                    }
                }
            }
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            
            if (!draggedElement) return;
            
            const targetLocationItem = e.target.closest('.location-item');
            const targetCard = e.target.closest('.itinerary-card');
            
            // Only allow dropping within the same itinerary
            if (targetCard && targetCard.dataset.itineraryId === draggedItineraryId && 
                targetLocationItem && targetLocationItem !== draggedElement) {
                
                const draggedLocationId = draggedElement.dataset.locationId;
                const targetLocationId = targetLocationItem.dataset.locationId;
                
                this.reorderLocation(draggedItineraryId, draggedLocationId, targetLocationId);
            }
            
            // Clean up
            document.querySelectorAll('.drop-zone').forEach(zone => {
                zone.classList.remove('drop-zone');
            });
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

    deleteItinerary(itineraryId) {
        const itinerary = this.itineraries.find(it => it.id === itineraryId);
        if (!itinerary) {
            Utils.showToast('Itinerary not found', 'error');
            return;
        }

        // Show confirmation dialog
        const confirmed = confirm(`Are you sure you want to delete "${itinerary.name}"?\n\nThis action cannot be undone.`);
        
        if (!confirmed) {
            return;
        }

        // Remove from itineraries array
        this.itineraries = this.itineraries.filter(it => it.id !== itineraryId);
        
        // Remove from selected itineraries if it was selected
        this.selectedItineraries.delete(itineraryId);
        
        // Save changes
        this.saveItineraries();
        
        // Show success message
        Utils.showToast(`"${itinerary.name}" deleted successfully`, 'success');
        
        // Re-render the view
        this.render();
        
        // If we're in compare mode and no itineraries are selected, exit compare mode
        if (this.isCompareMode && this.selectedItineraries.size === 0) {
            this.toggleCompareMode();
        }
    }

    duplicateItinerary(itineraryId) {
        const originalItinerary = this.itineraries.find(it => it.id === itineraryId);
        if (!originalItinerary) {
            Utils.showToast('Itinerary not found', 'error');
            return;
        }

        // Create a new itinerary with copied data
        const duplicatedItinerary = new Itinerary();
        duplicatedItinerary.name = `${originalItinerary.name} (Copy)`;
        
        // Copy all locations
        originalItinerary.locations.forEach(location => {
            duplicatedItinerary.addLocation({
                name: location.name,
                day: location.day,
                nights: location.nights,
                drivingTime: location.drivingTime
            });
        });

        // Add to itineraries array
        this.itineraries.push(duplicatedItinerary);
        
        // Save changes
        this.saveItineraries();
        
        // Show success message
        Utils.showToast(`"${originalItinerary.name}" duplicated successfully`, 'success');
        
        // Re-render the view
        this.render();

        // Focus on the new itinerary name input
        setTimeout(() => {
            const nameInput = document.querySelector(`[data-itinerary-id="${duplicatedItinerary.id}"] .itinerary-name-input`);
            if (nameInput) {
                nameInput.focus();
                nameInput.select(); // Select all text for easy editing
            }
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

    reorderLocation(itineraryId, draggedLocationId, targetLocationId) {
        const itinerary = this.itineraries.find(it => it.id === itineraryId);
        if (!itinerary) return;

        // Don't reorder if dragging to same position
        if (draggedLocationId === targetLocationId) return;

        // Find the indices of the locations
        const draggedIndex = itinerary.locations.findIndex(loc => loc.id === draggedLocationId);
        const targetIndex = itinerary.locations.findIndex(loc => loc.id === targetLocationId);

        if (draggedIndex === -1 || targetIndex === -1) return;

        // Remove the dragged location from its current position
        const [draggedLocation] = itinerary.locations.splice(draggedIndex, 1);

        // Calculate the correct insertion index
        // When dragging down (to a higher index), the target index needs to be adjusted
        // because we just removed an element from before it
        let insertIndex;
        if (draggedIndex < targetIndex) {
            // Dragging down: insert at targetIndex - 1 (because we removed from before)
            insertIndex = targetIndex - 1;
        } else {
            // Dragging up: insert at targetIndex (no adjustment needed)
            insertIndex = targetIndex;
        }

        // Insert the dragged location at the calculated position
        itinerary.locations.splice(insertIndex, 0, draggedLocation);

        // Update day numbers based on new order
        itinerary.locations.forEach((location, index) => {
            location.day = index + 1;
        });

        // Update calculations and save
        itinerary.updateCalculations();
        this.saveItineraries();
        this.render();

        Utils.showToast('Location order updated', 'success');
    }

    updateLocationData(itineraryId, locationId, inputElement) {
        const itinerary = this.itineraries.find(it => it.id === itineraryId);
        if (!itinerary) return;
        
        const location = itinerary.locations.find(loc => loc.id === locationId);
        if (!location) return;
        
        // Update the location data based on the input type
        if (inputElement.classList.contains('location-name')) {
            const oldName = location.name;
            location.name = inputElement.value;
            
            // Refresh map if location name changed
            if (oldName !== location.name) {
                setTimeout(() => this.refreshItineraryMap(itineraryId), 100);
            }
        } else if (inputElement.type === 'number') {
            if (inputElement.closest('.location-nights')) {
                location.nights = parseInt(inputElement.value) || 0;
            } else if (inputElement.classList.contains('drive-time-input')) {
                const rawMinutes = parseInt(inputElement.value) || 0;
                location.drivingTime = Utils.roundToNearestQuarterHour(rawMinutes);
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

    async calculateDriveTimes(itineraryId) {
        const itinerary = this.itineraries.find(it => it.id === itineraryId);
        if (!itinerary) return;

        if (itinerary.locations.length < 2) {
            Utils.showToast('Need at least 2 locations to calculate drive times', 'warning');
            return;
        }

        // Check if locations have names
        const emptyLocations = itinerary.locations.filter(loc => !loc.name || loc.name.trim() === '');
        if (emptyLocations.length > 0) {
            Utils.showToast('Please enter names for all locations first', 'warning');
            return;
        }

        // Find button and prevent multiple simultaneous calculations
        const button = document.querySelector(`[data-itinerary-id="${itineraryId}"] .calculate-drive-times-btn`);
        if (!button) {
            console.error('Calculate drive times button not found');
            return;
        }

        // Check if already calculating
        if (button.disabled) {
            console.log('Calculation already in progress, ignoring duplicate request');
            return;
        }

        // Show loading state
        const originalText = button.textContent;
        button.textContent = '🚗 Calculating...';
        button.disabled = true;

        try {
            console.log('Starting drive time calculation for itinerary:', itineraryId);
            const result = await this.routingService.calculateItineraryDrivingTimes(itinerary);
            console.log('Drive time calculation completed');
            
            this.saveItineraries();
            this.updateItinerarySummary(itineraryId);
            
            // Update just the location inputs without full re-render
            this.updateLocationInputs(itineraryId);
            
            // Refresh the map to show updated route
            this.refreshItineraryMap(itineraryId);
            
            // Show detailed success message with route information
            const routeInfo = this.getRouteInfoSummary(result);
            Utils.showToast(`Drive times calculated successfully!${routeInfo}`, 'success');

        } catch (error) {
            console.error('Failed to calculate drive times:', error);
            
            // Provide more helpful error messages
            let errorMessage = `Failed to calculate drive times: ${error.message}`;
            
            if (error.message.includes('not found')) {
                errorMessage += '\n\nTip: Try being more specific with location names (e.g., "Fleet, UK" instead of just "Fleet")';
            }
            
            Utils.showToast(errorMessage, 'error');
        } finally {
            // Ensure button is always restored, even if DOM changed
            setTimeout(() => {
                const currentButton = document.querySelector(`[data-itinerary-id="${itineraryId}"] .calculate-drive-times-btn`);
                if (currentButton) {
                    currentButton.textContent = originalText;
                    currentButton.disabled = false;
                    console.log('Button state restored');
                } else {
                    console.warn('Could not find button to restore state');
                }
            }, 100);
        }
    }

    updateLocationInputs(itineraryId) {
        const itinerary = this.itineraries.find(it => it.id === itineraryId);
        if (!itinerary) return;

        const card = document.querySelector(`[data-itinerary-id="${itineraryId}"]`);
        if (!card) return;

        const locationItems = card.querySelectorAll('.location-item');
        locationItems.forEach((item, index) => {
            if (index < itinerary.locations.length) {
                const location = itinerary.locations[index];
                const driveTimeDisplay = item.querySelector('.drive-time-display');
                const driveTimeInput = item.querySelector('.drive-time-input');
                
                if (driveTimeDisplay) {
                    driveTimeDisplay.textContent = Utils.formatDriveTime(location.drivingTime);
                }
                if (driveTimeInput) {
                    driveTimeInput.value = location.drivingTime || 0;
                }
            }
        });
    }

    toggleDriveTimeEdit(editButton) {
        const driveTimeContainer = editButton.closest('.location-drive-time');
        const display = driveTimeContainer.querySelector('.drive-time-display');
        const input = driveTimeContainer.querySelector('.drive-time-input');
        
        // Switch to edit mode
        display.style.display = 'none';
        input.style.display = 'inline';
        editButton.style.display = 'none';
        input.focus();
    }

    finishDriveTimeEdit(input) {
        const driveTimeContainer = input.closest('.location-drive-time');
        const display = driveTimeContainer.querySelector('.drive-time-display');
        const editButton = driveTimeContainer.querySelector('.edit-drive-time-btn');
        const locationItem = input.closest('.location-item');
        
        // Update the data
        const card = locationItem.closest('.itinerary-card');
        const itineraryId = card.dataset.itineraryId;
        const locationId = locationItem.dataset.locationId;
        
        // Update the location with rounded value
        const rawMinutes = parseInt(input.value) || 0;
        const roundedMinutes = Utils.roundToNearestQuarterHour(rawMinutes);
        input.value = roundedMinutes;
        
        this.updateLocationData(itineraryId, locationId, input);
        
        // Update display with formatted time
        display.textContent = Utils.formatDriveTime(roundedMinutes);
        
        // Switch back to display mode
        display.style.display = 'inline';
        input.style.display = 'none';
        editButton.style.display = 'inline';
    }

    getRouteInfoSummary(itinerary) {
        if (!itinerary || !itinerary.locations || itinerary.locations.length < 2) {
            return '';
        }
        
        const routeDescriptions = [];
        
        for (let i = 1; i < itinerary.locations.length; i++) {
            const fromLocation = itinerary.locations[i - 1];
            const toLocation = itinerary.locations[i];
            
            if (fromLocation.name && toLocation.name && toLocation.drivingTime > 0) {
                const driveTimeFormatted = Utils.formatDriveTime(toLocation.drivingTime);
                routeDescriptions.push(`${fromLocation.name} → ${toLocation.name}: ${driveTimeFormatted}`);
            }
        }
        
        if (routeDescriptions.length === 0) return '';
        
        const summary = routeDescriptions.join('\n• ');
        return `\n\nCalculated routes:\n• ${summary}`;
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
        this.initializeMaps();
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
                <button class="calculate-drive-times-btn" title="Calculate driving times between locations">🚗 Calculate Drive Times</button>
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
                <div class="itinerary-map">
                    <div class="leaflet-map-container">
                        <div id="map-${itinerary.id}" class="leaflet-map"></div>
                        <div class="map-loading">Loading map...</div>
                    </div>
                </div>
            </div>
        `;

        return card;
    }

    createLocationHTML(itineraryId, location) {
        return `
            <div class="location-item" data-location-id="${location.id}">
                <div class="drag-handle" draggable="true" data-location-id="${location.id}" title="Drag to reorder">⋮⋮</div>
                <input type="text" class="location-name" value="${location.name}" 
                       placeholder="Enter location">
                <div class="location-details">
                    <div class="location-nights">
                        <input type="number" value="${location.nights}" min="0" max="30">
                        <span>nights</span>
                    </div>
                    <div class="location-drive-time">
                        🚙 <span class="drive-time-display">${Utils.formatDriveTime(location.drivingTime)}</span>
                        <input type="number" class="drive-time-input" value="${location.drivingTime}" min="0" max="1440" style="display: none;">
                        <button class="edit-drive-time-btn" title="Edit drive time">✏️</button>
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

    initializeMaps() {
        // Initialize all maps after a short delay to ensure DOM is ready
        setTimeout(() => {
            this.itineraries.forEach(itinerary => {
                const mapId = `map-${itinerary.id}`;
                this.initializeLeafletMap(mapId, itinerary);
            });
        }, 500);
    }

    refreshItineraryMap(itineraryId) {
        const mapId = `map-${itineraryId}`;
        const mapElement = document.getElementById(mapId);
        
        if (!mapElement) {
            console.warn(`Map element not found for itinerary ${itineraryId}`);
            return;
        }

        // Reset the initialized flag to allow re-initialization
        mapElement.dataset.initialized = 'false';
        
        // Clear the existing map
        mapElement.innerHTML = '';
        
        // Find the itinerary
        const itinerary = this.itineraries.find(it => it.id === itineraryId);
        if (!itinerary) {
            console.warn(`Itinerary not found: ${itineraryId}`);
            return;
        }

        // Re-initialize the map
        console.log(`Refreshing map for itinerary: ${itinerary.name}`);
        this.initializeLeafletMap(mapId, itinerary);
    }

    async initializeLeafletMap(mapId, itinerary) {
        const mapElement = document.getElementById(mapId);
        if (!mapElement || mapElement.dataset.initialized) return;

        mapElement.dataset.initialized = 'true';
        
        // Check if Leaflet is loaded
        if (typeof L === 'undefined') {
            console.error('Leaflet library not loaded');
            const loadingEl = mapElement.parentElement.querySelector('.map-loading');
            if (loadingEl) loadingEl.textContent = 'Map library not loaded';
            return;
        }

        const locations = itinerary.locations.filter(loc => loc.name.trim() !== '');
        const loadingEl = mapElement.parentElement.querySelector('.map-loading');
        
        try {
            // Initialize map with default view (UK)
            const map = L.map(mapId, {
                zoomControl: true,
                scrollWheelZoom: false,
                doubleClickZoom: false,
                dragging: true
            }).setView([54.0, -2.0], 6);

            // Add tiles
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 18
            }).addTo(map);

            if (loadingEl) loadingEl.style.display = 'none';

            if (locations.length === 0) {
                return;
            }

            const markers = [];
            const coordinates = [];

            // Add markers for each location
            for (let i = 0; i < locations.length; i++) {
                const location = locations[i];
                console.log(`Geocoding location ${i + 1}/${locations.length}: ${location.name}`);
                try {
                    const result = await this.routingService.geocodeLocation(location.name);
                    console.log(`Geocode results for "${location.name}":`, result);
                    
                    if (result && result.lat && result.lng) {
                        const lat = parseFloat(result.lat);
                        const lng = parseFloat(result.lng);
                        
                        if (isNaN(lat) || isNaN(lng)) {
                            console.error(`Invalid coordinates for ${location.name}:`, lat, lng);
                            continue;
                        }
                        
                        console.log(`Adding marker for ${location.name} at [${lat}, ${lng}]`);
                        coordinates.push([lat, lng]);

                        const isFirst = i === 0;
                        const isLast = i === locations.length - 1;
                        const iconHtml = isFirst ? '🚩' : isLast ? '🏁' : '📍';

                        // Create custom marker icon
                        const customIcon = L.divIcon({
                            className: 'custom-marker',
                            html: `<div class="marker-icon">${iconHtml}</div>`,
                            iconSize: [30, 30],
                            iconAnchor: [15, 30]
                        });

                        const marker = L.marker([lat, lng], { icon: customIcon }).addTo(map);
                        marker.bindPopup(`<strong>${location.name}</strong><br>
                            ${location.nights > 0 ? `${location.nights} night${location.nights !== 1 ? 's' : ''}<br>` : ''}
                            Day ${location.day || i + 1}`);
                        markers.push(marker);
                    } else {
                        console.warn(`No results found for: ${location.name}`);
                    }
                } catch (error) {
                    console.error(`Geocoding failed for ${location.name}:`, error);
                }
            }

            console.log(`Total coordinates found: ${coordinates.length}`);
            console.log('Coordinates:', coordinates);

            // Add route line
            if (coordinates.length > 1) {
                console.log('Adding route line between', coordinates.length, 'points');
                const polyline = L.polyline(coordinates, {
                    color: '#3b82f6',
                    weight: 3,
                    opacity: 0.7
                }).addTo(map);
                console.log('Route line added');
            }

            // Fit bounds
            if (coordinates.length > 0) {
                console.log('Fitting map bounds to coordinates');
                if (coordinates.length === 1) {
                    console.log('Single location, setting view to:', coordinates[0]);
                    map.setView(coordinates[0], 10);
                } else {
                    console.log('Multiple locations, fitting bounds');
                    const group = new L.featureGroup(markers);
                    map.fitBounds(group.getBounds().pad(0.1));
                }
            } else {
                console.log('No coordinates found, keeping default view');
            }

        } catch (error) {
            console.error('Error initializing map:', error);
            if (loadingEl) {
                loadingEl.textContent = 'Unable to load map';
                loadingEl.style.color = '#ef4444';
            }
        }
    }

    updateTripDuration() {
        const durationElement = document.getElementById('trip-duration');
        
        if (this.tripStartDate && this.tripEndDate) {
            const days = Utils.calculateDaysBetween(this.tripStartDate, this.tripEndDate);
            durationElement.textContent = `${days} night${days !== 1 ? 's' : ''}`;
        } else {
            durationElement.textContent = '0 nights';
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
