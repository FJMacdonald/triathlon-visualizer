// Race distance configuration
export const RaceConfig = {
    // Default distances
    distances: {
        swim: 1500,  // meters
        bike: 40,    // kilometers
        run: 10      // kilometers
    },
    
    // Preset race types
    presets: {
        standard: { swim: 1500, bike: 40, run: 10 },
        sprint: { swim: 750, bike: 20, run: 5 },
        olympic: { swim: 1500, bike: 40, run: 10 }
    },
    
    setDistances(swim, bike, run) {
        this.distances.swim = swim;
        this.distances.bike = bike;
        this.distances.run = run;
    },
    
    applyPreset(presetName) {
        const preset = this.presets[presetName];
        if (preset) {
            this.setDistances(preset.swim, preset.bike, preset.run);
            return true;
        }
        return false;
    },
    
    getSwimPace(timeInSeconds) {
        return (timeInSeconds / this.distances.swim) * 100; // per 100m
    },
    
    getBikeSpeed(timeInSeconds) {
        return (this.distances.bike / timeInSeconds) * 3600; // km/h
    },
    
    getRunPace(timeInSeconds) {
        return timeInSeconds / this.distances.run / 60; // min/km
    },
    
    // Create configuration dialog HTML
    createDialogHTML() {
        return `
            <div class="dialog-content" style="max-width: 500px;">
                <div class="dialog-header">
                    <h3>Race Distance Configuration</h3>
                    <button class="dialog-close" id="closeRaceConfig">×</button>
                </div>
                <div class="dialog-body">
                    <div class="control-group">
                        <label>Race Type:</label>
                        <select id="raceTypeSelect">
                            <option value="standard">Standard Distance</option>
                            <option value="sprint">Sprint Distance</option>
                            <option value="custom">Custom</option>
                        </select>
                    </div>
                    
                    <div class="control-group">
                        <label>Swim Distance (meters):</label>
                        <input type="number" id="swimDistance" value="${this.distances.swim}" min="100" step="50">
                    </div>
                    
                    <div class="control-group">
                        <label>Bike Distance (km):</label>
                        <input type="number" id="bikeDistance" value="${this.distances.bike}" min="1" step="1">
                    </div>
                    
                    <div class="control-group">
                        <label>Run Distance (km):</label>
                        <input type="number" id="runDistance" value="${this.distances.run}" min="1" step="0.5">
                    </div>
                    
                    <button class="btn" id="saveRaceConfig">Save Configuration</button>
                </div>
            </div>
        `;
    }
};