// Local storage management

const StorageManager = {
    STORAGE_KEY: 'trip-planner-itineraries',

    saveItineraries(itineraries) {
        try {
            const data = itineraries.map(it => it.toJSON());
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
        } catch (error) {
            console.error('Failed to save itineraries:', error);
        }
    },

    loadItineraries() {
        try {
            const data = localStorage.getItem(this.STORAGE_KEY);
            if (!data) return [];
            
            const parsed = JSON.parse(data);
            return parsed.map(itData => Itinerary.fromJSON(itData));
        } catch (error) {
            console.error('Failed to load itineraries:', error);
            return [];
        }
    },

    exportSnapshot() {
        const data = {
            timestamp: new Date().toISOString(),
            itineraries: ItineraryManager.itineraries.map(it => it.toJSON())
        };
        
        const dataStr = JSON.stringify(data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `trip-planner-snapshot-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(link.href);
    },

    importSnapshot(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    if (data.itineraries && Array.isArray(data.itineraries)) {
                        const importedItineraries = data.itineraries.map(itData => 
                            Itinerary.fromJSON(itData)
                        );
                        resolve(importedItineraries);
                    } else {
                        reject(new Error('Invalid snapshot format'));
                    }
                } catch (error) {
                    reject(new Error('Failed to parse snapshot file'));
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    },

    clearAll() {
        if (confirm('Are you sure you want to clear all itineraries? This cannot be undone.')) {
            localStorage.removeItem(this.STORAGE_KEY);
            ItineraryManager.itineraries = [];
            return true;
        }
        return false;
    }
};
