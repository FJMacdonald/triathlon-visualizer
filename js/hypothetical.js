import { RaceConfig } from './config/race-config.js';
import { secondsToTime } from './utils/formatters.js';

export class HypotheticalAnalysis {
    constructor() {
        this.dialog = document.getElementById('hypotheticalDialog');
        this.athlete = null;
        this.stage = null;
        this.processedData = null;
        this.bikePacks = {};
        this.manualRunAdjustment = false;
        this.lastBikeStrategy = 'solo';
        
        this.setupDialog();
    }
    
    setupDialog() {
        if (!this.dialog) return;
        
        this.dialog.innerHTML = this.createDialogHTML();
        this.bindEvents();
    }
    
    createDialogHTML() {
        return `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>Hypothetical Scenario Analysis</h3>
                    <button class="dialog-close" id="closeHypothetical">×</button>
                </div>
                <div class="dialog-body">
                    <div id="athleteInfo"></div>
                    
                    <div class="scenario-controls">
                        <h4>Adjust Performance</h4>
                        
                        <div class="control-group">
                            <label>Swim Pace Adjustment</label>
                            <input type="range" id="swimAdjust" min="-20" max="20" value="0" step="1">
                            <span id="swimAdjustValue">0%</span>
                            <div class="pace-info" id="swimPaceInfo"></div>
                        </div>
                        
                        <div class="control-group">
                            <label>T1 Time</label>
                            <input type="range" id="t1Adjust" min="-30" max="30" value="0" step="1">
                            <span id="t1AdjustValue">0s</span>
                        </div>
                        
                        <div class="control-group">
                            <label>Bike Strategy</label>
                            <select id="bikeStrategy">
                                <option value="solo">Solo Effort</option>
                                <option value="leadPack">Lead Pack (Draft)</option>
                                <option value="chasePack">Chase Pack (Draft)</option>
                                <option value="custom">Custom Power</option>
                            </select>
                            <div id="bikeCustomControl" style="display: none;">
                                <input type="range" id="bikeAdjust" min="-20" max="20" value="0" step="1">
                                <span id="bikeAdjustValue">0%</span>
                            </div>
                            <div class="pace-info" id="bikePaceInfo"></div>
                        </div>
                        
                        <div class="control-group">
                            <label>T2 Time</label>
                            <input type="range" id="t2Adjust" min="-30" max="30" value="0" step="1">
                            <span id="t2AdjustValue">0s</span>
                        </div>
                        
                        <div class="control-group">
                            <label>Run Pace (affected by bike effort)</label>
                            <input type="range" id="runAdjust" min="-20" max="20" value="0" step="1">
                            <span id="runAdjustValue">0%</span>
                            <div class="pace-info" id="runPaceInfo"></div>
                            <div class="effort-warning" id="runEffortWarning" style="display: none;"></div>
                            <button class="btn" id="resetRunAdjust" style="margin-top: 5px;">Reset to Auto</button>
                        </div>
                    </div>
                    
                    <div class="scenario-results" style="margin-top: 30px; padding: 20px; background: #e8f5e9; border-radius: 8px;">
                        <h4>Projected Outcome</h4>
                        <div id="scenarioComparison" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px;"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    bindEvents() {
        document.getElementById('closeHypothetical')?.addEventListener('click', () => this.close());
        
        // Swim adjustment
        const swimAdjust = document.getElementById('swimAdjust');
        swimAdjust?.addEventListener('input', () => {
            document.getElementById('swimAdjustValue').textContent = `${swimAdjust.value}%`;
            this.updatePaceInfo();
            this.updateResults();
        });
        
        // T1 adjustment
        const t1Adjust = document.getElementById('t1Adjust');
        t1Adjust?.addEventListener('input', () => {
            document.getElementById('t1AdjustValue').textContent = `${t1Adjust.value}s`;
            this.updateResults();
        });
        
        // T2 adjustment
        const t2Adjust = document.getElementById('t2Adjust');
        t2Adjust?.addEventListener('input', () => {
            document.getElementById('t2AdjustValue').textContent = `${t2Adjust.value}s`;
            this.updateResults();
        });
        
        // Bike strategy
        const bikeStrategy = document.getElementById('bikeStrategy');
        bikeStrategy?.addEventListener('change', () => {
            const customControl = document.getElementById('bikeCustomControl');
            customControl.style.display = bikeStrategy.value === 'custom' ? 'block' : 'none';
            
            if (!this.manualRunAdjustment) {
                this.applyBikeStrategyToRun(bikeStrategy.value);
            }
            
            this.lastBikeStrategy = bikeStrategy.value;
            this.updateBikeProjection();
            this.updateRunImpact();
            this.updateResults();
        });
        
        // Bike custom adjustment
        const bikeAdjust = document.getElementById('bikeAdjust');
        bikeAdjust?.addEventListener('input', () => {
            document.getElementById('bikeAdjustValue').textContent = `${bikeAdjust.value}%`;
            this.updateBikeProjection();
            if (!this.manualRunAdjustment) {
                this.applyBikeStrategyToRun('custom');
            }
            this.updateRunImpact();
            this.updateResults();
        });
        
        // Run adjustment
        const runAdjust = document.getElementById('runAdjust');
        runAdjust?.addEventListener('input', () => {
            document.getElementById('runAdjustValue').textContent = `${runAdjust.value}%`;
            this.manualRunAdjustment = true;
            this.updateRunImpact();
            this.updateResults();
        });
        
        // Reset run
        document.getElementById('resetRunAdjust')?.addEventListener('click', () => {
            this.manualRunAdjustment = false;
            this.applyBikeStrategyToRun(this.lastBikeStrategy);
            this.updateRunImpact();
            this.updateResults();
        });
    }
    
    open(athlete, stage, processedData) {
        this.athlete = athlete;
        this.stage = stage;
        this.processedData = processedData;
        this.manualRunAdjustment = false;
        this.lastBikeStrategy = 'solo';
        
        this.calculateBikePacks();
        this.populateAthleteInfo();
        this.resetSliders();
        this.updatePaceInfo();
        this.updateBikeProjection();
        this.updateRunImpact();
        this.updateResults();
        
        if (this.dialog) {
            this.dialog.style.display = 'flex';
        }
    }
    
    close() {
        if (this.dialog) {
            this.dialog.style.display = 'none';
        }
        this.resetSliders();
        this.manualRunAdjustment = false;
    }
    
    resetSliders() {
        ['swimAdjust', 't1Adjust', 'bikeAdjust', 't2Adjust', 'runAdjust'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = 0;
        });
        
        const bikeStrategy = document.getElementById('bikeStrategy');
        if (bikeStrategy) bikeStrategy.value = 'solo';
        
        const customControl = document.getElementById('bikeCustomControl');
        if (customControl) customControl.style.display = 'none';
        
        ['swimAdjustValue', 'bikeAdjustValue', 'runAdjustValue'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0%';
        });
        
        ['t1AdjustValue', 't2AdjustValue'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '0s';
        });
    }
    
    calculateBikePacks() {
        if (!this.processedData) return;
        
        const athletesAtT1 = this.processedData
            .filter(a => a.actualT1Time)
            .map(a => ({
                athlete: a,
                t1Time: a.swimCumulative + a.actualT1Time
            }))
            .sort((a, b) => a.t1Time - b.t1Time);
        
        this.bikePacks = { lead: [], chase: [], dropped: [] };
        
        if (athletesAtT1.length > 0) {
            let currentPack = [athletesAtT1[0]];
            let packs = [];
            
            for (let i = 1; i < athletesAtT1.length; i++) {
                if (athletesAtT1[i].t1Time - athletesAtT1[i-1].t1Time > 10) {
                    packs.push([...currentPack]);
                    currentPack = [];
                }
                currentPack.push(athletesAtT1[i]);
            }
            if (currentPack.length > 0) packs.push(currentPack);
            
            if (packs[0]) this.bikePacks.lead = packs[0];
            if (packs[1]) this.bikePacks.chase = packs[1];
            if (packs.length > 2) {
                this.bikePacks.dropped = packs.slice(2).flat();
            }
        }
    }
    
    populateAthleteInfo() {
        const info = document.getElementById('athleteInfo');
        if (!info || !this.athlete) return;
        
        info.innerHTML = `
            <h4>${this.athlete.baseName || this.athlete.name} - ${this.athlete.country}</h4>
            <p>Current Position: ${this.athlete.finalRank || 'N/A'}</p>
            <p>Analyzing from: ${this.stage}</p>
        `;
    }
    
    updatePaceInfo() {
        if (!this.athlete) return;
        
        const swimAdjust = parseFloat(document.getElementById('swimAdjust')?.value || 0) / 100;
        const swimPaceInfo = document.getElementById('swimPaceInfo');
        
        const baseSwimPace = RaceConfig.getSwimPace(this.athlete.actualSwimTime);
        const adjustedSwimPace = baseSwimPace * (1 - swimAdjust);
        const baseSwimTime = this.athlete.actualSwimTime;
        const adjustedSwimTime = baseSwimTime * (1 - swimAdjust);
        
        if (swimPaceInfo) {
            swimPaceInfo.innerHTML = `
                Time: ${secondsToTime(baseSwimTime)} → ${secondsToTime(adjustedSwimTime)}<br/>
                Pace: ${secondsToTime(baseSwimPace)}/100m → ${secondsToTime(adjustedSwimPace)}/100m
            `;
        }
    }
    
    updateBikeProjection() {
        if (!this.athlete) return { time: this.athlete.actualBikeTime, effort: 'Normal' };
        
        const strategy = document.getElementById('bikeStrategy')?.value || 'solo';
        const bikePaceInfo = document.getElementById('bikePaceInfo');
        
        let projectedBikeTime = this.athlete.actualBikeTime;
        let effortLevel = 'Normal';
        
        switch(strategy) {
            case 'leadPack':
                const leadPackAvg = d3.mean(this.bikePacks.lead.map(a => a.athlete.actualBikeTime));
                projectedBikeTime = leadPackAvg || projectedBikeTime * 0.93;
                effortLevel = 'High (rotating in pack)';
                break;
            case 'chasePack':
                const chasePackAvg = d3.mean(this.bikePacks.chase.map(a => a.athlete.actualBikeTime));
                projectedBikeTime = chasePackAvg || projectedBikeTime * 0.97;
                effortLevel = 'Moderate (drafting benefit)';
                break;
            case 'solo':
                effortLevel = 'Very High (no draft)';
                break;
            case 'custom':
                const bikeAdjust = parseFloat(document.getElementById('bikeAdjust')?.value || 0) / 100;
                projectedBikeTime = this.athlete.actualBikeTime * (1 - bikeAdjust);
                effortLevel = 'Custom';
                break;
        }
        
        const bikeSpeed = RaceConfig.getBikeSpeed(projectedBikeTime);
        const actualSpeed = RaceConfig.getBikeSpeed(this.athlete.actualBikeTime);
        
        if (bikePaceInfo) {
            bikePaceInfo.innerHTML = `
                Time: ${secondsToTime(this.athlete.actualBikeTime)} → ${secondsToTime(projectedBikeTime)}<br/>
                Speed: ${actualSpeed.toFixed(1)} km/hr → ${bikeSpeed.toFixed(1)} km/hr<br/>
                Effort: ${effortLevel}
            `;
        }
        
        return { time: projectedBikeTime, effort: effortLevel };
    }
    
    applyBikeStrategyToRun(strategy) {
        const runSlider = document.getElementById('runAdjust');
        if (!runSlider) return;
        
        let suggestedAdjustment = 0;
        
        switch(strategy) {
            case 'solo':
                suggestedAdjustment = -10;
                break;
            case 'leadPack':
                suggestedAdjustment = -5;
                break;
            case 'chasePack':
                suggestedAdjustment = 0;
                break;
            case 'custom':
                const bikeAdjust = parseFloat(document.getElementById('bikeAdjust')?.value || 0);
                if (bikeAdjust > 0) {
                    suggestedAdjustment = -(bikeAdjust * 0.5);
                }
                break;
        }
        
        runSlider.value = suggestedAdjustment;
        document.getElementById('runAdjustValue').textContent = `${suggestedAdjustment}%`;
    }
    
    updateRunImpact() {
        if (!this.athlete) return;
        
        const bikeStrategy = document.getElementById('bikeStrategy')?.value || 'solo';
        const runAdjust = parseFloat(document.getElementById('runAdjust')?.value || 0);
        const warning = document.getElementById('runEffortWarning');
        const runPaceInfo = document.getElementById('runPaceInfo');
        
        if (warning) {
            if (!this.manualRunAdjustment) {
                switch(bikeStrategy) {
                    case 'solo':
                        warning.innerHTML = '⚠️ Solo bike effort typically slows run by ~10% (auto-adjusted)';
                        warning.style.display = 'block';
                        warning.style.background = '#fff3cd';
                        break;
                    case 'leadPack':
                        warning.innerHTML = '⚠️ Lead pack work typically slows run by ~5% (auto-adjusted)';
                        warning.style.display = 'block';
                        warning.style.background = '#fff3cd';
                        break;
                    default:
                        warning.style.display = 'none';
                }
            } else {
                warning.innerHTML = '✓ Manual run adjustment active (overriding bike strategy effects)';
                warning.style.background = '#d1ecf1';
                warning.style.display = 'block';
            }
        }
        
        const baseRunTime = this.athlete.actualRunTime;
        const adjustedRunTime = baseRunTime * (1 - runAdjust / 100);
        const baseRunPace = RaceConfig.getRunPace(baseRunTime);
        const adjustedPace = RaceConfig.getRunPace(adjustedRunTime);
        
        const formatPace = (pace) => `${Math.floor(pace)}:${Math.round((pace % 1) * 60).toString().padStart(2, '0')}`;
        
        if (runPaceInfo) {
            runPaceInfo.innerHTML = `
                Time: ${secondsToTime(baseRunTime)} → ${secondsToTime(adjustedRunTime)}<br/>
                Pace: ${formatPace(baseRunPace)}/km → ${formatPace(adjustedPace)}/km
            `;
        }
    }
    
    updateResults() {
        if (!this.athlete || !this.processedData) return;
        
        const swimAdjust = parseFloat(document.getElementById('swimAdjust')?.value || 0) / 100;
        const t1Adjust = parseFloat(document.getElementById('t1Adjust')?.value || 0);
        const bikeProjection = this.updateBikeProjection();
        const t2Adjust = parseFloat(document.getElementById('t2Adjust')?.value || 0);
        const runAdjust = parseFloat(document.getElementById('runAdjust')?.value || 0) / 100;
        
        const hypothetical = {
            swim: this.athlete.actualSwimTime * (1 - swimAdjust),
            t1: Math.max(0, this.athlete.actualT1Time - t1Adjust),
            bike: bikeProjection.time,
            t2: Math.max(0, this.athlete.actualT2Time - t2Adjust),
            run: this.athlete.actualRunTime * (1 - runAdjust)
        };
        
        const hypotheticalTotal = hypothetical.swim + hypothetical.t1 + 
                                hypothetical.bike + hypothetical.t2 + hypothetical.run;
        
        const newPosition = this.processedData.filter(a => 
            a.actualTotalTime && a.actualTotalTime < hypotheticalTotal
        ).length + 1;
        
        const comparison = document.getElementById('scenarioComparison');
        if (comparison) {
            comparison.innerHTML = `
                <div class="comparison-column" style="padding: 10px;">
                    <h5 style="margin-bottom: 10px; color: #667eea;">Actual Performance</h5>
                    <div class="comparison-item" style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: white; border-radius: 4px;">
                        <span>Total Time:</span>
                        <strong>${secondsToTime(this.athlete.actualTotalTime)}</strong>
                    </div>
                    <div class="comparison-item" style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: white; border-radius: 4px;">
                        <span>Position:</span>
                        <strong>${this.athlete.finalRank}</strong>
                    </div>
                    <div class="comparison-item" style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: white; border-radius: 4px;">
                        <span>Swim:</span>
                        <span>${secondsToTime(this.athlete.actualSwimTime)}</span>
                    </div>
                    <div class="comparison-item" style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: white; border-radius: 4px;">
                        <span>Bike:</span>
                        <span>${secondsToTime(this.athlete.actualBikeTime)}</span>
                    </div>
                    <div class="comparison-item" style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: white; border-radius: 4px;">
                        <span>Run:</span>
                        <span>${secondsToTime(this.athlete.actualRunTime)}</span>
                    </div>
                </div>
                <div class="comparison-column" style="padding: 10px;">
                    <h5 style="margin-bottom: 10px; color: #667eea;">Hypothetical Performance</h5>
                    <div class="comparison-item" style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: white; border-radius: 4px;">
                        <span>Total Time:</span>
                        <strong>${secondsToTime(hypotheticalTotal)}</strong>
                    </div>
                    <div class="comparison-item" style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: white; border-radius: 4px;">
                        <span>Position:</span>
                        <strong>${newPosition}</strong>
                    </div>
                    <div class="comparison-item" style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: white; border-radius: 4px;">
                        <span>Swim:</span>
                        <span>${secondsToTime(hypothetical.swim)}</span>
                    </div>
                    <div class="comparison-item" style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: white; border-radius: 4px;">
                        <span>Bike:</span>
                        <span>${secondsToTime(hypothetical.bike)}</span>
                    </div>
                    <div class="comparison-item" style="display: flex; justify-content: space-between; margin-bottom: 5px; padding: 5px; background: white; border-radius: 4px;">
                        <span>Run:</span>
                        <span>${secondsToTime(hypothetical.run)}</span>
                    </div>
                </div>
            `;
        }
    }
}

export const hypotheticalAnalysis = new HypotheticalAnalysis();