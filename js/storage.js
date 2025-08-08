// Local storage management

class StorageManager {
    static STORAGE_KEYS = {
        ITINERARIES: 'trip-planner-itineraries',
        TRIP_DATA: 'trip-planner-trip-data',
        SETTINGS: 'trip-planner-settings'
    };

    static saveItineraries(itineraries) {
        try {
            const data = itineraries.map(it => it.toJSON());
            localStorage.setItem(this.STORAGE_KEYS.ITINERARIES, JSON.stringify(data));
            return true;
        } catch (error) {
            console.error('Failed to save itineraries:', error);
            Utils.showToast('Failed to save itineraries', 'error');
            return false;
        }
    }

    static loadItineraries() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.ITINERARIES);
            if (!data) return [];
            
            const parsed = JSON.parse(data);
            return parsed.map(itData => Itinerary.fromJSON(itData));
        } catch (error) {
            console.error('Failed to load itineraries:', error);
            Utils.showToast('Failed to load saved itineraries', 'error');
            return [];
        }
    }

    static saveTripData(tripData) {
        try {
            localStorage.setItem(this.STORAGE_KEYS.TRIP_DATA, JSON.stringify(tripData));
            return true;
        } catch (error) {
            console.error('Failed to save trip data:', error);
            return false;
        }
    }

    static loadTripData() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.TRIP_DATA);
            return data ? JSON.parse(data) : {};
        } catch (error) {
            console.error('Failed to load trip data:', error);
            return {};
        }
    }

    static saveSettings(settings) {
        try {
            localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            return false;
        }
    }

    static loadSettings() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEYS.SETTINGS);
            return data ? JSON.parse(data) : {
                units: 'metric',
                autoSave: true,
                theme: 'light'
            };
        } catch (error) {
            console.error('Failed to load settings:', error);
            return {
                units: 'metric',
                autoSave: true,
                theme: 'light'
            };
        }
    }

    static createSnapshot() {
        const snapshot = {
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            itineraries: this.loadItineraries().map(it => it.toJSON()),
            tripData: this.loadTripData(),
            settings: this.loadSettings()
        };
        
        return snapshot;
    }

    static exportSnapshot() {
        try {
            const snapshot = this.createSnapshot();
            const dataStr = JSON.stringify(snapshot, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(dataBlob);
            link.download = `trip-planner-backup-${new Date().toISOString().split('T')[0]}.json`;
            
            // Trigger download
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            URL.revokeObjectURL(link.href);
            Utils.showToast('Backup exported successfully', 'success');
            
            return true;
        } catch (error) {
            console.error('Failed to export snapshot:', error);
            Utils.showToast('Failed to export backup', 'error');
            return false;
        }
    }

    static importSnapshot(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const snapshot = JSON.parse(e.target.result);
                    
                    // Validate snapshot structure
                    if (!snapshot.itineraries || !Array.isArray(snapshot.itineraries)) {
                        throw new Error('Invalid backup file format');
                    }

                    // Import itineraries
                    const itineraries = snapshot.itineraries.map(itData => Itinerary.fromJSON(itData));
                    this.saveItineraries(itineraries);

                    // Import trip data if available
                    if (snapshot.tripData) {
                        this.saveTripData(snapshot.tripData);
                    }

                    // Import settings if available
                    if (snapshot.settings) {
                        this.saveSettings(snapshot.settings);
                    }

                    Utils.showToast('Backup imported successfully', 'success');
                    resolve(snapshot);
                } catch (error) {
                    console.error('Failed to import snapshot:', error);
                    Utils.showToast('Failed to import backup: ' + error.message, 'error');
                    reject(error);
                }
            };

            reader.onerror = () => {
                const error = new Error('Failed to read file');
                Utils.showToast('Failed to read backup file', 'error');
                reject(error);
            };

            reader.readAsText(file);
        });
    }

    static clearAllData() {
        try {
            Object.values(this.STORAGE_KEYS).forEach(key => {
                localStorage.removeItem(key);
            });
            Utils.showToast('All data cleared', 'success');
            return true;
        } catch (error) {
            console.error('Failed to clear data:', error);
            Utils.showToast('Failed to clear data', 'error');
            return false;
        }
    }

    static getStorageInfo() {
        try {
            let totalSize = 0;
            const info = {};

            Object.entries(this.STORAGE_KEYS).forEach(([name, key]) => {
                const data = localStorage.getItem(key);
                const size = data ? new Blob([data]).size : 0;
                info[name.toLowerCase()] = {
                    key,
                    size,
                    sizeFormatted: this.formatBytes(size),
                    hasData: !!data
                };
                totalSize += size;
            });

            return {
                details: info,
                totalSize,
                totalSizeFormatted: this.formatBytes(totalSize)
            };
        } catch (error) {
            console.error('Failed to get storage info:', error);
            return null;
        }
    }

    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}
