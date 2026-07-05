// Routing and geocoding functionality using OpenRouteService

class RoutingService {
    constructor() {
        // For now, we'll use the demo service. Later you can add your API key here
        this.apiKey = null; // Set to your OpenRouteService API key when you get one
        this.baseUrl = 'https://api.openrouteservice.org';
        
        // Cache for geocoding results to avoid repeated API calls
        this.geocodeCache = new Map();
        this.routeCache = new Map();
    }

    // Geocode a location name to coordinates using multiple fallback services
    async geocodeLocation(locationName) {
        if (!locationName || locationName.trim() === '') {
            throw new Error('Location name is required');
        }

        const cacheKey = locationName.toLowerCase().trim();
        if (this.geocodeCache.has(cacheKey)) {
            return this.geocodeCache.get(cacheKey);
        }

        // Try multiple geocoding services in order
        const geocodingServices = [
            this.tryPhotonGeocoding.bind(this),
            this.tryNominatimWithHeaders.bind(this),
            this.tryPositionStackGeocoding.bind(this)
        ];

        for (const service of geocodingServices) {
            try {
                const coords = await service(locationName);
                this.geocodeCache.set(cacheKey, coords);
                return coords;
            } catch (error) {
                console.warn(`Geocoding service failed: ${error.message}`);
                continue;
            }
        }

        throw new Error(`Could not geocode location "${locationName}" - all services failed`);
    }

    // Helper method to suggest better location formats
    suggestLocationFormat(locationName) {
        const suggestions = [];
        
        // If location doesn't have country, suggest adding it
        if (!locationName.includes(',')) {
            suggestions.push(`Try adding country: "${locationName}, UK" or "${locationName}, USA"`);
        }
        
        // If it's very short, suggest being more specific
        if (locationName.length < 4) {
            suggestions.push(`Try being more specific: "${locationName} city" or "${locationName} town"`);
        }
        
        return suggestions;
    }

    // Primary geocoding service - Photon (no CORS issues)
    async tryPhotonGeocoding(locationName) {
        // First attempt with preferred filters
        try {
            return await this._photonSearchWithRetry(locationName, {
                bbox: '-15,41,15,61',
                osmTagFilters: '&osm_tag=place:city&osm_tag=place:town&osm_tag=place:village&osm_tag=boundary:administrative',
            });
        } catch (error) {
            console.warn(`Primary Photon search failed for "${locationName}": ${error.message}`);
            // Retry with broader search (no osm_tag filter, wider bbox)
            try {
                return await this._photonSearchWithRetry(locationName, {
                    bbox: '-30,35,30,70',
                    osmTagFilters: '',
                });
            } catch (retryError) {
                console.warn(`Broader Photon search also failed for "${locationName}": ${retryError.message}`);
                throw error; // Throw the original error
            }
        }
    }

    _nameMatchesQuery(resultName, query) {
        if (!resultName || !query) return false;
        const r = resultName.toLowerCase().trim();
        const q = query.toLowerCase().trim();
        if (r === q) return true;
        if (r.includes(q) || q.includes(r)) return true;
        const rWords = r.split(/[\s,]+/).filter(Boolean);
        const qWords = q.split(/[\s,]+/).filter(Boolean);
        return qWords.some(qw => rWords.some(rw => rw.includes(qw) || qw.includes(rw)));
    }

    // Perform a Photon search and retry if the best result doesn't match the query name
    async _photonSearchWithRetry(locationName, { bbox, osmTagFilters }) {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(locationName)}&limit=5${osmTagFilters}&bbox=${bbox}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        let response;
        try {
            response = await fetch(url, {
                signal: controller.signal,
                headers: { 'Accept': 'application/json' }
            });
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            throw new Error(`Photon geocoding failed: ${response.status}`);
        }

        const data = await response.json();

        if (!data.features || data.features.length === 0) {
            throw new Error(`Location "${locationName}" not found`);
        }

        const scoredResults = data.features.map((feature) => {
            const props = feature.properties;
            let score = 0;
            let reasons = [];
            const coords = feature.geometry.coordinates;
            const lng = coords[0];
            const lat = coords[1];

            if (props.osm_key === 'place') {
                score += 50;
                reasons.push('is a place');
            }
            if (props.osm_key === 'boundary') {
                score += 40;
                reasons.push('is an administrative boundary');
            }

            if (props.osm_value === 'city') {
                score += 30;
                reasons.push('is a city');
            } else if (props.osm_value === 'town') {
                score += 25;
                reasons.push('is a town');
            } else if (props.osm_value === 'village') {
                score += 20;
                reasons.push('is a village');
            }

            if (lng >= -15 && lng <= 15 && lat >= 41 && lat <= 61) {
                score += 25;
                reasons.push('in western Europe');
            }

            if (props.population) {
                const pop = parseInt(props.population);
                if (pop > 100000) {
                    score += 15;
                    reasons.push(`large town/city (${pop.toLocaleString()})`);
                } else if (pop > 30000) {
                    score += 10;
                    reasons.push(`substantial town (${pop.toLocaleString()})`);
                } else if (pop > 10000) {
                    score += 5;
                    reasons.push(`medium town (${pop.toLocaleString()})`);
                }
            }

            if (props.admin_level) {
                const level = parseInt(props.admin_level);
                if (level <= 8) {
                    score += Math.max(0, 10 - level);
                    reasons.push(`admin level ${level}`);
                }
            }

            if (locationName.toLowerCase() === 'fleet') {
                const fleetHampshireLat = 51.29;
                const fleetHampshireLng = -0.83;
                const distance = Math.sqrt(Math.pow(lat - fleetHampshireLat, 2) + Math.pow(lng - fleetHampshireLng, 2));

                if (distance < 0.1) {
                    score += 20;
                    reasons.push('near Fleet, Hampshire location');
                } else if (distance < 0.2) {
                    score += 10;
                    reasons.push('reasonably close to Fleet, Hampshire');
                }

                if (lat >= 51.0 && lat <= 51.5 && lng >= -1.0 && lng <= -0.5) {
                    score += 15;
                    reasons.push('in Hampshire/Surrey region');
                }
            }

            const name = props.name || '';
            const nameMatch = this._nameMatchesQuery(name, locationName);
            if (name.toLowerCase() === locationName.toLowerCase()) {
                score += 30;
                reasons.push('exact name match');
            } else if (nameMatch) {
                score += 15;
                reasons.push('partial name match');
            } else {
                score -= 40;
                reasons.push(`name "${name}" does not match query "${locationName}" (penalty)`);
            }

            if (props.osm_key === 'amenity') {
                score -= 20;
                reasons.push('is an amenity (penalty)');
            }
            if (props.osm_key === 'shop') {
                score -= 30;
                reasons.push('is a shop (penalty)');
            }
            if (props.osm_key === 'office') {
                score -= 30;
                reasons.push('is an office (penalty)');
            }

            return {
                feature,
                score,
                name: props.name,
                type: `${props.osm_key}:${props.osm_value}`,
                population: props.population ? parseInt(props.population) : null,
                location: `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}`,
                reasons,
            };
        });

        scoredResults.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            if (b.population && a.population) return b.population - a.population;
            if (b.population && !a.population) return 1;
            if (!b.population && a.population) return -1;
            return 0;
        });

        console.log(`🔍 Geocoding "${locationName}" - analyzing ${data.features.length} results:`);
        scoredResults.forEach((result, index) => {
            const prefix = index === 0 ? '✅ SELECTED' : `   Option ${index + 1}`;
            const popInfo = result.population ? ` | Pop: ${result.population.toLocaleString()}` : ' | No pop data';
            console.log(`${prefix}: "${result.name}" (${result.type}) - Score: ${result.score}${popInfo} | ${result.location}`);
            console.log(`     Reasons: ${result.reasons.join(', ')}`);
        });

        const bestMatch = scoredResults[0];
        const ties = scoredResults.filter(r => r.score === bestMatch.score);
        if (ties.length > 1) {
            console.warn(`⚠️ Found ${ties.length} locations with same score (${bestMatch.score}). Selected based on population/order.`);
            ties.forEach((tie, index) => {
                const popInfo = tie.population ? ` (pop: ${tie.population.toLocaleString()})` : ' (no pop data)';
                console.warn(`   ${index === 0 ? 'SELECTED' : 'Alternative'}: ${tie.name}${popInfo} at ${tie.location}`);
            });
        }

        const feature = bestMatch.feature;
        return {
            lat: feature.geometry.coordinates[1],
            lng: feature.geometry.coordinates[0],
            displayName: feature.properties.name || locationName,
            confidence: bestMatch.score,
            type: bestMatch.type,
            selectionReason: bestMatch.reasons.join(', ')
        };
    }

    // Fallback geocoding service - Nominatim with proper headers
    async tryNominatimWithHeaders(locationName) {
        // Add featureType to prioritize cities and towns
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(locationName)}&limit=5&featuretype=city,town,village&addressdetails=1`;
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'TripPlannerApp/1.0 (hobby project)',
                'Accept': 'application/json',
                'Referer': 'http://localhost:8080'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Nominatim geocoding failed: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.length === 0) {
            throw new Error(`Location "${locationName}" not found`);
        }

        // Score results to prefer actual places over businesses
        const scoredResults = data.map(result => {
            let score = 0;
            
            // Prefer places with proper administrative levels
            if (result.address) {
                if (result.address.city) score += 30;
                if (result.address.town) score += 25;
                if (result.address.village) score += 20;
                if (result.address.country) score += 10;
            }
            
            // Prefer higher importance (0-1 scale in Nominatim)
            if (result.importance) score += result.importance * 20;
            
            // Prefer place types over amenities
            if (result.type === 'city') score += 40;
            if (result.type === 'town') score += 35;
            if (result.type === 'village') score += 30;
            if (result.type === 'administrative') score += 25;
            
            // Penalize businesses
            if (result.type === 'amenity') score -= 20;
            if (result.category === 'amenity') score -= 20;
            
            return { result, score };
        });
        
        // Sort by score and take the best
        scoredResults.sort((a, b) => b.score - a.score);
        const best = scoredResults[0].result;
        
        console.log(`Nominatim geocoding "${locationName}": selected "${best.display_name}" (type: ${best.type})`);

        return {
            lat: parseFloat(best.lat),
            lng: parseFloat(best.lon),
            displayName: best.display_name,
            type: best.type
        };
    }

    // Alternative geocoding service - PositionStack (backup)
    async tryPositionStackGeocoding(locationName) {
        // For now, just throw error - this would need an API key
        // You could sign up for free at http://positionstack.com/
        throw new Error('PositionStack geocoding not configured');
    }

    // Calculate driving time between two coordinates
    async calculateDrivingTime(fromCoords, toCoords) {
        const cacheKey = `${fromCoords.lng},${fromCoords.lat}-${toCoords.lng},${toCoords.lat}`;
        if (this.routeCache.has(cacheKey)) {
            return this.routeCache.get(cacheKey);
        }

        // Try multiple routing services
        const routingServices = [
            this.tryOSRMRouting.bind(this),
            this.tryOpenRouteServiceRouting.bind(this)
        ];

        for (const service of routingServices) {
            try {
                const result = await service(fromCoords, toCoords);
                this.routeCache.set(cacheKey, result);
                return result;
            } catch (error) {
                console.warn(`Routing service failed: ${error.message}`);
                continue;
            }
        }

        // Fallback: estimate based on straight-line distance
        const fallback = this.estimateDrivingTime(fromCoords, toCoords);
        this.routeCache.set(cacheKey, fallback);
        return fallback;
    }

    // Primary routing service - OSRM
    async tryOSRMRouting(fromCoords, toCoords) {
        const url = `https://router.project-osrm.org/route/v1/driving/${fromCoords.lng},${fromCoords.lat};${toCoords.lng},${toCoords.lat}?overview=false`;
        
        console.log(`🚗 OSRM routing request: ${fromCoords.lng},${fromCoords.lat} → ${toCoords.lng},${toCoords.lat}`);
        
        // Add timeout to prevent hanging requests
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
        
        try {
            const response = await fetch(url, { 
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`OSRM routing failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (!data.routes || data.routes.length === 0) {
                throw new Error('No routes found');
            }

            const route = data.routes[0];
            const rawMinutes = Math.round(route.duration / 60);
            const roundedMinutes = Utils.roundToNearestQuarterHour(rawMinutes);
            const distanceKm = route.distance ? Math.round(route.distance / 1000) : 0;
            const distanceMiles = Utils.metersToMiles(route.distance || 0);
            
            console.log(`✅ OSRM route found: ${distanceKm}km (${distanceMiles}mi), ${rawMinutes}min raw → ${roundedMinutes}min rounded`);
            
            return { duration: roundedMinutes, distanceMiles };
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Routing request timed out');
            }
            console.log(`❌ OSRM routing failed: ${error.message}`);
            throw error;
        }
    }

    // Fallback routing service - OpenRouteService
    async tryOpenRouteServiceRouting(fromCoords, toCoords) {
        if (!this.apiKey) {
            throw new Error('OpenRouteService API key required');
        }

        const url = `${this.baseUrl}/v2/directions/driving-car?api_key=${this.apiKey}&start=${fromCoords.lng},${fromCoords.lat}&end=${toCoords.lng},${toCoords.lat}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`OpenRouteService routing failed: ${response.status}`);
        }

        const data = await response.json();
        const minutes = Math.round(data.features[0].properties.summary.duration / 60);
        const roundedMinutes = Utils.roundToNearestQuarterHour(minutes);
        const distanceMeters = data.features[0].properties.summary.distance || 0;
        const distanceMiles = Utils.metersToMiles(distanceMeters);
        return { duration: roundedMinutes, distanceMiles };
    }

    // Fallback: estimate driving time based on straight-line distance
    estimateDrivingTime(fromCoords, toCoords) {
        // Calculate straight-line distance using Haversine formula
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(toCoords.lat - fromCoords.lat);
        const dLon = this.toRad(toCoords.lng - fromCoords.lng);
        
        const lat1 = this.toRad(fromCoords.lat);
        const lat2 = this.toRad(toCoords.lat);

        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.sin(dLon/2) * Math.sin(dLon/2) * Math.cos(lat1) * Math.cos(lat2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;

        // Estimate driving time: assume 60km/h average speed, add 20% for roads not being straight
        const estimatedMinutes = Math.round((distance / 60) * 60 * 1.2);
        const roundedMinutes = Utils.roundToNearestQuarterHour(estimatedMinutes);
        const distanceMiles = Utils.metersToMiles(distance * 1000);
        
        console.warn(`Using estimated driving time: ${roundedMinutes} minutes for ${distance.toFixed(1)}km (${distanceMiles}mi)`);
        return { duration: roundedMinutes, distanceMiles };
    }

    toRad(deg) {
        return deg * (Math.PI/180);
    }

    // Main method to calculate driving time between two location names
    async getDrivingTimeBetweenLocations(fromLocation, toLocation) {
        console.log(`🗺️ Calculating drive time: ${fromLocation} → ${toLocation}`);
        
        try {
            // Add small delay to be respectful to free APIs
            await new Promise(resolve => setTimeout(resolve, 200));

            console.log(`📍 Geocoding FROM location: "${fromLocation}"`);
            const fromCoords = await this.geocodeLocation(fromLocation);
            console.log(`✅ FROM: ${fromCoords.displayName} (${fromCoords.lat}, ${fromCoords.lng})`);
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            console.log(`📍 Geocoding TO location: "${toLocation}"`);
            const toCoords = await this.geocodeLocation(toLocation);
            console.log(`✅ TO: ${toCoords.displayName} (${toCoords.lat}, ${toCoords.lng})`);
            
            await new Promise(resolve => setTimeout(resolve, 200));
            
            console.log(`🚗 Calculating route between selected locations...`);
            const result = await this.calculateDrivingTime(fromCoords, toCoords);
            const drivingTime = result.duration;
            const distanceMiles = result.distanceMiles;
            
            console.log(`⏱️ Drive time calculated: ${drivingTime} minutes (${Utils.formatDriveTime(drivingTime)})`);
            if (distanceMiles) {
                console.log(`📏 Distance: ${Utils.formatMiles(distanceMiles)}`);
            }
            console.log(`📋 Route summary: "${fromCoords.displayName}" → "${toCoords.displayName}" = ${Utils.formatDriveTime(drivingTime)}`);
            
            return {
                duration: drivingTime,
                distanceMiles: distanceMiles,
                from: fromCoords,
                to: toCoords,
                routeSummary: `${fromCoords.displayName} → ${toCoords.displayName}`
            };

        } catch (error) {
            console.error('❌ Error calculating driving time:', error);
            throw error;
        }
    }

    // Calculate all driving times for an itinerary
    async calculateItineraryDrivingTimes(itinerary) {
        if (!itinerary.locations || itinerary.locations.length < 2) {
            return itinerary;
        }

        try {
            for (let i = 1; i < itinerary.locations.length; i++) {
                const fromLocation = itinerary.locations[i - 1];
                const toLocation = itinerary.locations[i];

                if (fromLocation.name && toLocation.name) {
                    const result = await this.getDrivingTimeBetweenLocations(
                        fromLocation.name, 
                        toLocation.name
                    );
                    
                    // Update the "to" location with the driving time and distance
                    toLocation.drivingTime = result.duration;
                    toLocation.drivingDistance = result.distanceMiles || 0;
                }
            }

            // First location has no driving time or distance (starting point)
            if (itinerary.locations[0]) {
                itinerary.locations[0].drivingTime = 0;
                itinerary.locations[0].drivingDistance = 0;
            }

            // Recalculate totals
            itinerary.updateCalculations();
            return itinerary;

        } catch (error) {
            console.error('Error calculating itinerary driving times:', error);
            throw error;
        }
    }

    // Set API key for OpenRouteService (optional)
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    // Clear caches
    clearCache() {
        this.geocodeCache.clear();
        this.routeCache.clear();
    }
}
