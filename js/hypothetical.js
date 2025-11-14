import { RaceConfig } from './config/race-config.js';
import { secondsToTime } from './utils/formatters.js';

export class HypotheticalAnalysis {
    constructor() {
        this.dialog = document.getElementById('hypotheticalDialog');
        this.athlete = null;
        this.processedData = null;
        this.packs = [];
        this.athletePack = null;
        this.selectedPack = null;
        this.teamAthletes = [];
        
        this.setupDialog();
    }
    
    setupDialog() {
        if (!this.dialog) return;
        this.dialog.innerHTML = this.createDialogHTML();
        this.bindEvents();
    }
    
    createDialogHTML() {
        return `
            <div class="dialog-content hypothetical-dialog">
                <div class="dialog-header">
                    <h3>Race Strategy Analysis</h3>
                    <button class="dialog-close" id="closeHypothetical">×</button>
                </div>
                <div class="dialog-body">
                    <div id="athleteInfo" class="athlete-summary"></div>
                    
                    <div class="pack-analysis-section">
                        <h4>Bike Pack Formation Analysis</h4>
                        <p class="section-description">
                            Athletes grouped by similar T2 entry times (end of bike). Close times indicate pack riding.
                        </p>
                        <div id="packVisualization" class="pack-container"></div>
                    </div>
                    
                    <div class="strategy-section">
                        <h4>Strategy Planning</h4>
                        
                        <div class="pack-selector-container">
                            <label>Target Bike Pack:</label>
                            <select id="targetPack" class="pack-select">
                                <option value="current">Current Pack (Actual)</option>
                            </select>
                        </div>
                        
                        <div id="packRequirements" class="requirements-panel"></div>
                        
                        <div class="adjustment-section">
                            <h5>Swim & T1 Adjustments</h5>
                            <div class="adjustment-grid">
                                <div class="control-group">
                                    <label>Swim Pace Adjustment</label>
                                    <div class="pace-adjuster">
                                        <input type="range" id="swimPaceAdjust" min="-10" max="10" value="0" step="0.5">
                                        <div class="pace-display">
                                            <span id="swimPaceValue">0</span>% 
                                            <span id="swimTimeChange" class="time-change"></span>
                                        </div>
                                    </div>
                                    <div id="swimDetails" class="pace-details"></div>
                                </div>
                                
                                <div class="control-group">
                                    <label>T1 Time Adjustment</label>
                                    <div class="time-adjuster">
                                        <input type="range" id="t1Adjust" min="-30" max="30" value="0" step="1">
                                        <div class="time-display">
                                            <span id="t1Value">0</span>s
                                        </div>
                                    </div>
                                    <div id="t1Details" class="time-details"></div>
                                </div>
                            </div>
                            
                            <div id="canMakePack" class="feasibility-check"></div>
                        </div>
                        
                        <div class="run-section">
                            <h5>Run Performance Scenario</h5>
                            <div class="control-group">
                                <label>Run Pace Adjustment</label>
                                <div class="pace-adjuster">
                                    <input type="range" id="runPaceAdjust" min="-10" max="10" value="0" step="0.5">
                                    <div class="pace-display">
                                        <span id="runPaceValue">0</span>%
                                        <span id="runTimeChange" class="time-change"></span>
                                    </div>
                                </div>
                                <div id="runDetails" class="pace-details"></div>
                                <div id="runFatigueWarning" class="fatigue-warning"></div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="results-section">
                        <h4>Projected Outcome</h4>
                        <div class="outcome-tabs">
                            <button class="tab-btn active" data-tab="individual">Individual Impact</button>
                            <button class="tab-btn" data-tab="team">Team Impact</button>
                        </div>
                        <div id="individualOutcome" class="outcome-panel active"></div>
                        <div id="teamOutcome" class="outcome-panel"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    bindEvents() {
        document.getElementById('closeHypothetical')?.addEventListener('click', () => this.close());
        
        // Pack selection
        document.getElementById('targetPack')?.addEventListener('change', (e) => {
            this.selectPack(e.target.value);
        });
        
        // Swim pace adjustment
        document.getElementById('swimPaceAdjust')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('swimPaceValue').textContent = value.toFixed(1);
            this.updateSwimDetails();
            this.checkPackFeasibility();
            this.updateProjections();
        });
        
        // T1 adjustment
        document.getElementById('t1Adjust')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('t1Value').textContent = value;
            this.updateT1Details();
            this.checkPackFeasibility();
            this.updateProjections();
        });
        
        // Run pace adjustment
        document.getElementById('runPaceAdjust')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('runPaceValue').textContent = value.toFixed(1);
            this.updateRunDetails();
            this.updateProjections();
        });
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.outcome-panel').forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(`${e.target.dataset.tab}Outcome`).classList.add('active');
            });
        });
    }
    
    open(athlete, stage, processedData) {
        this.athlete = athlete;
        this.processedData = processedData;
        
        this.identifyTeammates();
        this.analyzePacks();
        this.identifyAthletePack();
        this.populateUI();
        
        if (this.dialog) {
            this.dialog.style.display = 'flex';
        }
    }
    
    close() {
        if (this.dialog) {
            this.dialog.style.display = 'none';
        }
        this.resetAdjustments();
    }
    
    identifyTeammates() {
        if (!this.athlete || !this.processedData) return;
        
        this.teamAthletes = this.processedData.filter(a => 
            a.country === this.athlete.country
        );
    }
    
    analyzePacks() {
        if (!this.processedData) return;
        
        const bikeCumulatives = this.processedData
            .filter(a => a.actualSwimTime && a.actualT1Time && a.actualBikeTime)
            .map(a => ({
                athlete: a,
                t1Exit: a.swimCumulative + a.actualT1Time,
                t2Entry: a.swimCumulative + a.actualT1Time + a.actualBikeTime,
                bikeTime: a.actualBikeTime
            }))
            .sort((a, b) => a.t2Entry - b.t2Entry);
        
        this.packs = [];
        if (bikeCumulatives.length === 0) return;
        
        let currentPack = {
            id: 0,
            members: [bikeCumulatives[0]]
        };
        
        const PACK_GAP_THRESHOLD = 15; // seconds
        
        for (let i = 1; i < bikeCumulatives.length; i++) {
            const gap = bikeCumulatives[i].t2Entry - bikeCumulatives[i-1].t2Entry;
            
            if (gap <= PACK_GAP_THRESHOLD) {
                currentPack.members.push(bikeCumulatives[i]);
            } else {
                this.finalizePack(currentPack);
                this.packs.push(currentPack);
                currentPack = {
                    id: this.packs.length,
                    members: [bikeCumulatives[i]]
                };
            }
        }
        this.finalizePack(currentPack);
        this.packs.push(currentPack);
    }
    
    finalizePack(pack) {
        pack.size = pack.members.length;
        
        // T1 exit times
        const t1Exits = pack.members.map(m => m.t1Exit);
        pack.earliestT1Exit = Math.min(...t1Exits);
        pack.latestT1Exit = Math.max(...t1Exits);
        pack.avgT1Exit = d3.mean(t1Exits);
        
        // T2 entry times
        const t2Entries = pack.members.map(m => m.t2Entry);
        pack.avgT2Entry = d3.mean(t2Entries);
        pack.t2EntrySpread = Math.max(...t2Entries) - Math.min(...t2Entries);
        
        // Bike performance
        const bikeTimes = pack.members.map(m => m.bikeTime);
        pack.avgBikeTime = d3.mean(bikeTimes);
        pack.fastestBikeTime = Math.min(...bikeTimes);
        pack.slowestBikeTime = Math.max(...bikeTimes);
        pack.avgBikeSpeed = RaceConfig.getBikeSpeed(pack.avgBikeTime);
        
        // Pack characteristics
        if (pack.id === 0) {
            pack.name = 'Lead Pack';
            pack.type = 'lead';
        } else if (pack.size >= 5) {
            pack.name = `Chase Pack ${pack.id}`;
            pack.type = 'chase';
        } else if (pack.size >= 2) {
            pack.name = `Small Group ${pack.id}`;
            pack.type = 'small';
        } else {
            pack.name = `Solo Rider`;
            pack.type = 'solo';
        }
        
        // Check for bridging
        pack.hadBridging = (pack.latestT1Exit - pack.earliestT1Exit) > 20;
    }
    
    identifyAthletePack() {
        if (!this.athlete) return;
        
        for (const pack of this.packs) {
            const inPack = pack.members.some(m => 
                m.athlete.name === this.athlete.name
            );
            if (inPack) {
                this.athletePack = pack;
                break;
            }
        }
    }
    
    populateUI() {
        this.updateAthleteInfo();
        this.renderPackVisualization();
        this.populatePackSelector();
        this.resetAdjustments();
        this.selectPack('current');
    }
    
    updateAthleteInfo() {
        const info = document.getElementById('athleteInfo');
        if (!info || !this.athlete) return;
        
        const swimPace = RaceConfig.getSwimPace(this.athlete.actualSwimTime);
        const bikePower = RaceConfig.getBikeSpeed(this.athlete.actualBikeTime);
        const runPace = RaceConfig.getRunPace(this.athlete.actualRunTime);
        
        info.innerHTML = `
            <div class="athlete-header">
                <div class="athlete-name">
                    <h4>${this.athlete.baseName || this.athlete.name}</h4>
                    <span class="country-badge">${this.athlete.country}</span>
                </div>
                <div class="athlete-position">
                    <span class="position-number">#${this.athlete.finalRank}</span>
                    <span class="position-label">Final Position</span>
                </div>
            </div>
            <div class="athlete-performance">
                <div class="perf-item">
                    <label>Total Time</label>
                    <value>${secondsToTime(this.athlete.actualTotalTime)}</value>
                </div>
                <div class="perf-item">
                    <label>Swim Pace</label>
                    <value>${this.formatSwimPace(swimPace)}/100m</value>
                </div>
                <div class="perf-item">
                    <label>Bike Speed</label>
                    <value>${bikePower.toFixed(1)} km/h</value>
                </div>
                <div class="perf-item">
                    <label>Run Pace</label>
                    <value>${this.formatRunPace(runPace)}/km</value>
                </div>
            </div>
        `;
    }
    
    renderPackVisualization() {
        const container = document.getElementById('packVisualization');
        if (!container) return;
        
        let html = '<div class="pack-timeline">';
        
        this.packs.forEach(pack => {
            const isCurrentPack = pack === this.athletePack;
            const hasTeammates = pack.members.some(m => 
                m.athlete.country === this.athlete.country && 
                m.athlete.name !== this.athlete.name
            );
            
            html += `
                <div class="pack-card ${isCurrentPack ? 'current' : ''} ${hasTeammates ? 'has-teammates' : ''}" 
                     data-pack-id="${pack.id}">
                    <div class="pack-header">
                        <div class="pack-title">
                            <span class="pack-name">${pack.name}</span>
                            <span class="pack-size">${pack.size} athlete${pack.size > 1 ? 's' : ''}</span>
                        </div>
                        ${pack.hadBridging ? '<span class="bridging-badge">⚡ Bridging</span>' : ''}
                    </div>
                    
                    <div class="pack-stats">
                        <div class="stat">
                            <label>T1 Exit Range</label>
                            <value>${secondsToTime(pack.earliestT1Exit)} - ${secondsToTime(pack.latestT1Exit)}</value>
                        </div>
                        <div class="stat">
                            <label>Avg Bike Time</label>
                            <value>${secondsToTime(pack.avgBikeTime)} @ ${pack.avgBikeSpeed.toFixed(1)}km/h</value>
                        </div>
                        <div class="stat">
                            <label>T2 Entry</label>
                            <value>${secondsToTime(pack.avgT2Entry)} ±${(pack.t2EntrySpread/2).toFixed(0)}s</value>
                        </div>
                    </div>
                    
                    <div class="pack-members">
                        <div class="members-header">Athletes in pack:</div>
                        <div class="members-list">
                            ${pack.members.map(m => {
                                const isCurrentAthlete = m.athlete.name === this.athlete.name;
                                const isTeammate = m.athlete.country === this.athlete.country;
                                const bikeSpeed = RaceConfig.getBikeSpeed(m.bikeTime);
                                return `
                                    <div class="member ${isCurrentAthlete ? 'current-athlete' : ''} ${isTeammate ? 'teammate' : ''}">
                                        <span class="member-name">${m.athlete.baseName || m.athlete.name}</span>
                                        <span class="member-country">${m.athlete.country}</span>
                                        <span class="member-bike">${bikeSpeed.toFixed(1)}km/h</span>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
    
    populatePackSelector() {
        const select = document.getElementById('targetPack');
        if (!select) return;
        
        let html = '<option value="current">Current Pack (Actual Performance)</option>';
        
        this.packs.forEach(pack => {
            if (pack !== this.athletePack) {
                const timeDiff = this.calculateTimeToJoinPack(pack);
                const direction = timeDiff.total < 0 ? 'faster' : timeDiff.total > 0 ? 'easier' : 'same';
                const teammates = pack.members.filter(m => 
                    m.athlete.country === this.athlete.country
                ).length;
                
                html += `
                    <option value="${pack.id}">
                        ${pack.name} - ${Math.abs(timeDiff.total).toFixed(0)}s ${direction}
                        ${teammates > 0 ? ` (${teammates} teammate${teammates > 1 ? 's' : ''})` : ''}
                    </option>
                `;
            }
        });
        
        select.innerHTML = html;
    }
    
    calculateTimeToJoinPack(pack) {
        const currentT1Exit = this.athlete.swimCumulative + this.athlete.actualT1Time;
        const targetT1Exit = pack.latestT1Exit; // Latest they could exit and still bridge
        const timeDiff = targetT1Exit - currentT1Exit;
        
        // Break down how this could be achieved
        const swimTime = this.athlete.actualSwimTime;
        const t1Time = this.athlete.actualT1Time;
        
        return {
            total: timeDiff,
            targetT1Exit: targetT1Exit,
            currentT1Exit: currentT1Exit,
            suggestedSwimChange: timeDiff * 0.8, // 80% from swim
            suggestedT1Change: timeDiff * 0.2   // 20% from T1
        };
    }
    
    selectPack(packId) {
        if (packId === 'current') {
            this.selectedPack = this.athletePack;
        } else {
            this.selectedPack = this.packs.find(p => p.id === parseInt(packId));
        }
        
        this.updatePackRequirements();
        this.suggestAdjustments();
        this.updateProjections();
    }
    
    updatePackRequirements() {
        const panel = document.getElementById('packRequirements');
        if (!panel || !this.selectedPack) return;
        
        if (this.selectedPack === this.athletePack) {
            panel.innerHTML = `
                <div class="current-pack-notice">
                    <strong>📍 Analyzing actual performance</strong>
                    <p>Adjust swim/T1/run to explore alternative outcomes.</p>
                </div>
            `;
            return;
        }
        
        const timeDiff = this.calculateTimeToJoinPack(this.selectedPack);
        const bikeTimeDiff = this.selectedPack.avgBikeTime - this.athlete.actualBikeTime;
        
        const timeClass = timeDiff.total < 0 ? 'time-cost' : 'time-saved';
        const effortText = timeDiff.total < 0 ? 'Required effort' : 'Could ease up';
        
        panel.innerHTML = `
            <div class="pack-requirements">
                <div class="requirement-header">
                    <h5>${this.selectedPack.name} Requirements</h5>
                </div>
                
                <div class="time-requirement ${timeClass}">
                    <div class="time-display">
                        <span class="time-label">${effortText}:</span>
                        <span class="time-value">${this.formatTimeDiff(Math.abs(timeDiff.total))}</span>
                    </div>
                    <div class="time-breakdown">
                        <div>Need T1 exit by: ${secondsToTime(timeDiff.targetT1Exit)}</div>
                        <div>Current T1 exit: ${secondsToTime(timeDiff.currentT1Exit)}</div>
                    </div>
                </div>
                
                <div class="pack-benefit">
                    <div class="benefit-item">
                        <label>Bike time with pack:</label>
                        <value>${secondsToTime(this.selectedPack.avgBikeTime)} 
                               (${bikeTimeDiff > 0 ? '+' : ''}${secondsToTime(Math.abs(bikeTimeDiff))})</value>
                    </div>
                    <div class="benefit-item">
                        <label>Pack speed:</label>
                        <value>${this.selectedPack.avgBikeSpeed.toFixed(1)} km/h</value>
                    </div>
                    <div class="benefit-item">
                        <label>Energy cost:</label>
                        <value>${this.estimateEnergyCost()}</value>
                    </div>
                </div>
                
                ${this.getTeammatesInPack().length > 0 ? `
                    <div class="teammates-notice">
                        <strong>🤝 Teammates in this pack:</strong>
                        ${this.getTeammatesInPack().map(t => 
                            `<span>${t.athlete.baseName || t.athlete.name}</span>`
                        ).join(', ')}
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    getTeammatesInPack() {
        if (!this.selectedPack) return [];
        return this.selectedPack.members.filter(m => 
            m.athlete.country === this.athlete.country && 
            m.athlete.name !== this.athlete.name
        );
    }
    
    estimateEnergyCost() {
        if (!this.selectedPack || this.selectedPack === this.athletePack) {
            return 'Baseline';
        }
        
        const bikeTimeDiff = this.selectedPack.avgBikeTime - this.athlete.actualBikeTime;
        
        if (bikeTimeDiff < -60) return '🔴 Very High (faster bike)';
        if (bikeTimeDiff < 0) return '🟠 High (faster bike)';
        if (bikeTimeDiff === 0) return '🟡 Similar';
        if (bikeTimeDiff < 60) return '🟢 Lower (easier bike)';
        return '🟢 Much Lower (much easier bike)';
    }
    
    suggestAdjustments() {
        if (this.selectedPack === this.athletePack) {
            this.resetAdjustments();
            return;
        }
        
        const timeDiff = this.calculateTimeToJoinPack(this.selectedPack);
        
        // Convert to pace adjustments
        const swimPaceChange = (timeDiff.suggestedSwimChange / this.athlete.actualSwimTime) * 100;
        const t1Change = timeDiff.suggestedT1Change;
        
        // Set suggested values
        document.getElementById('swimPaceAdjust').value = -swimPaceChange;
        document.getElementById('swimPaceValue').textContent = (-swimPaceChange).toFixed(1);
        document.getElementById('t1Adjust').value = -t1Change;
        document.getElementById('t1Value').textContent = -Math.round(t1Change);
        
        // Suggest run impact based on bike effort difference
        const bikeTimeDiff = this.selectedPack.avgBikeTime - this.athlete.actualBikeTime;
        let runImpact = 0;
        
        if (bikeTimeDiff < 0) {
            // Harder bike = slower run
            runImpact = (Math.abs(bikeTimeDiff) / this.athlete.actualBikeTime) * 100 * 0.5;
        } else {
            // Easier bike = potential faster run
            runImpact = -(bikeTimeDiff / this.athlete.actualBikeTime) * 100 * 0.3;
        }
        
        document.getElementById('runPaceAdjust').value = runImpact;
        document.getElementById('runPaceValue').textContent = runImpact.toFixed(1);
        
        this.updateSwimDetails();
        this.updateT1Details();
        this.updateRunDetails();
        this.checkPackFeasibility();
    }
    
    resetAdjustments() {
        ['swimPaceAdjust', 't1Adjust', 'runPaceAdjust'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = 0;
        });
        
        document.getElementById('swimPaceValue').textContent = '0';
        document.getElementById('t1Value').textContent = '0';
        document.getElementById('runPaceValue').textContent = '0';
        
        this.updateSwimDetails();
        this.updateT1Details();
        this.updateRunDetails();
    }
    
    updateSwimDetails() {
        const details = document.getElementById('swimDetails');
        const paceAdjust = parseFloat(document.getElementById('swimPaceAdjust')?.value || 0);
        
        const currentPace = RaceConfig.getSwimPace(this.athlete.actualSwimTime);
        const newPace = currentPace * (1 + paceAdjust / 100);
        const newTime = this.athlete.actualSwimTime * (1 + paceAdjust / 100);
        const timeDiff = newTime - this.athlete.actualSwimTime;
        
        document.getElementById('swimTimeChange').textContent = 
            `(${timeDiff > 0 ? '+' : ''}${timeDiff.toFixed(0)}s)`;
        
        if (details) {
            details.innerHTML = `
                <div>Current: ${secondsToTime(this.athlete.actualSwimTime)} @ ${this.formatSwimPace(currentPace)}/100m</div>
                <div>New: ${secondsToTime(newTime)} @ ${this.formatSwimPace(newPace)}/100m</div>
            `;
        }
    }
    
    updateT1Details() {
        const details = document.getElementById('t1Details');
        const adjustment = parseInt(document.getElementById('t1Adjust')?.value || 0);
        
        const newTime = Math.max(10, this.athlete.actualT1Time + adjustment);
        
        if (details) {
            details.innerHTML = `
                <div>Current: ${secondsToTime(this.athlete.actualT1Time)}</div>
                <div>New: ${secondsToTime(newTime)}</div>
            `;
        }
    }
    
    updateRunDetails() {
        const details = document.getElementById('runDetails');
        const warning = document.getElementById('runFatigueWarning');
        const paceAdjust = parseFloat(document.getElementById('runPaceAdjust')?.value || 0);
        
        const currentPace = RaceConfig.getRunPace(this.athlete.actualRunTime);
        const newPace = currentPace * (1 + paceAdjust / 100);
        const newTime = this.athlete.actualRunTime * (1 + paceAdjust / 100);
        const timeDiff = newTime - this.athlete.actualRunTime;
        
        document.getElementById('runTimeChange').textContent = 
            `(${timeDiff > 0 ? '+' : ''}${timeDiff.toFixed(0)}s)`;
        
        if (details) {
            details.innerHTML = `
                <div>Current: ${secondsToTime(this.athlete.actualRunTime)} @ ${this.formatRunPace(currentPace)}/km</div>
                <div>New: ${secondsToTime(newTime)} @ ${this.formatRunPace(newPace)}/km</div>
            `;
        }
        
        if (warning) {
            if (this.selectedPack && this.selectedPack !== this.athletePack) {
                const bikeTimeDiff = this.selectedPack.avgBikeTime - this.athlete.actualBikeTime;
                if (bikeTimeDiff < 0) {
                    warning.innerHTML = '⚠️ Harder bike effort likely impacts run performance';
                    warning.style.display = 'block';
                } else if (bikeTimeDiff > 0) {
                    warning.innerHTML = '✅ Easier bike could allow faster run';
                    warning.style.display = 'block';
                } else {
                    warning.style.display = 'none';
                }
            } else {
                warning.style.display = 'none';
            }
        }
    }
    
    checkPackFeasibility() {
        const container = document.getElementById('canMakePack');
        if (!container || !this.selectedPack || this.selectedPack === this.athletePack) {
            if (container) container.innerHTML = '';
            return;
        }
        
        const swimAdjust = parseFloat(document.getElementById('swimPaceAdjust')?.value || 0);
        const t1Adjust = parseInt(document.getElementById('t1Adjust')?.value || 0);
        
        const newSwimTime = this.athlete.actualSwimTime * (1 + swimAdjust / 100);
        const newT1Time = Math.max(10, this.athlete.actualT1Time + t1Adjust);
        const newT1Exit = this.athlete.swimCumulative - this.athlete.actualSwimTime + newSwimTime + newT1Time;
        
        const timeDiff = this.calculateTimeToJoinPack(this.selectedPack);
        const canMake = newT1Exit <= timeDiff.targetT1Exit + 5; // 5s buffer
        
        container.innerHTML = canMake ? `
            <div class="feasibility-success">
                ✅ Can make ${this.selectedPack.name} with these adjustments
                <div>T1 exit: ${secondsToTime(newT1Exit)} (need ${secondsToTime(timeDiff.targetT1Exit)})</div>
            </div>
        ` : `
            <div class="feasibility-fail">
                ❌ Cannot make ${this.selectedPack.name} with current adjustments
                <div>T1 exit: ${secondsToTime(newT1Exit)} (need ${secondsToTime(timeDiff.targetT1Exit)})</div>
                <div>Still ${secondsToTime(newT1Exit - timeDiff.targetT1Exit)} too slow</div>
            </div>
        `;
    }
    
    updateProjections() {
        this.updateIndividualOutcome();
        this.updateTeamOutcome();
    }
    
    updateIndividualOutcome() {
        const container = document.getElementById('individualOutcome');
        if (!container || !this.athlete) return;
        
        // Get adjustments
        const swimAdjust = parseFloat(document.getElementById('swimPaceAdjust')?.value || 0);
        const t1Adjust = parseInt(document.getElementById('t1Adjust')?.value || 0);
        const runAdjust = parseFloat(document.getElementById('runPaceAdjust')?.value || 0);
        
        // Calculate new times
        const newSwim = this.athlete.actualSwimTime * (1 + swimAdjust / 100);
        const newT1 = Math.max(10, this.athlete.actualT1Time + t1Adjust);
        const newBike = this.selectedPack ? this.selectedPack.avgBikeTime : this.athlete.actualBikeTime;
        const newT2 = this.athlete.actualT2Time;
        const newRun = this.athlete.actualRunTime * (1 + runAdjust / 100);
        const newTotal = newSwim + newT1 + newBike + newT2 + newRun;
        
        // Calculate new position
        const newPosition = this.processedData.filter(a => 
            a.actualTotalTime && a.actualTotalTime < newTotal
        ).length + 1;
        
        const positionChange = this.athlete.finalRank - newPosition;
        const timeChange = newTotal - this.athlete.actualTotalTime;
        
        container.innerHTML = `
            <div class="outcome-comparison">
                <div class="outcome-column actual">
                    <h5>Actual Result</h5>
                    <div class="position-display">
                        <span class="position">#${this.athlete.finalRank}</span>
                        <span class="total-time">${secondsToTime(this.athlete.actualTotalTime)}</span>
                    </div>
                    <div class="splits">
                        <div>Swim: ${secondsToTime(this.athlete.actualSwimTime)}</div>
                        <div>T1: ${secondsToTime(this.athlete.actualT1Time)}</div>
                        <div>Bike: ${secondsToTime(this.athlete.actualBikeTime)}</div>
                        <div>T2: ${secondsToTime(this.athlete.actualT2Time)}</div>
                        <div>Run: ${secondsToTime(this.athlete.actualRunTime)}</div>
                    </div>
                </div>
                
                <div class="outcome-column projected">
                    <h5>Projected Result</h5>
                    <div class="position-display">
                        <span class="position ${positionChange > 0 ? 'better' : positionChange < 0 ? 'worse' : ''}">#${newPosition}</span>
                        <span class="total-time">${secondsToTime(newTotal)}</span>
                    </div>
                    <div class="splits">
                        <div class="${newSwim !== this.athlete.actualSwimTime ? 'changed' : ''}">
                            Swim: ${secondsToTime(newSwim)}
                        </div>
                        <div class="${newT1 !== this.athlete.actualT1Time ? 'changed' : ''}">
                            T1: ${secondsToTime(newT1)}
                        </div>
                        <div class="${newBike !== this.athlete.actualBikeTime ? 'changed' : ''}">
                            Bike: ${secondsToTime(newBike)}
                        </div>
                        <div>T2: ${secondsToTime(newT2)}</div>
                        <div class="${newRun !== this.athlete.actualRunTime ? 'changed' : ''}">
                            Run: ${secondsToTime(newRun)}
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="outcome-impact">
                <div class="impact-item ${positionChange > 0 ? 'positive' : positionChange < 0 ? 'negative' : 'neutral'}">
                    <label>Position Change:</label>
                    <value>${positionChange > 0 ? '↑' : positionChange < 0 ? '↓' : '→'} ${Math.abs(positionChange)} place${Math.abs(positionChange) !== 1 ? 's' : ''}</value>
                </div>
                <div class="impact-item ${timeChange < 0 ? 'positive' : timeChange > 0 ? 'negative' : 'neutral'}">
                    <label>Time Change:</label>
                    <value>${timeChange > 0 ? '+' : ''}${secondsToTime(Math.abs(timeChange))}</value>
                </div>
            </div>
        `;
    }
    
    updateTeamOutcome() {
        const container = document.getElementById('teamOutcome');
        if (!container || !this.teamAthletes.length) return;
        
        // Get current team performance
        const currentTeamPositions = this.teamAthletes
            .map(a => a.finalRank)
            .filter(r => r)
            .sort((a, b) => a - b);
        
        const currentTopThree = currentTeamPositions.slice(0, 3);
        const currentTeamPoints = this.calculateTeamPoints(currentTopThree);
        
        // Calculate projected team performance
        const swimAdjust = parseFloat(document.getElementById('swimPaceAdjust')?.value || 0);
        const t1Adjust = parseInt(document.getElementById('t1Adjust')?.value || 0);
        const runAdjust = parseFloat(document.getElementById('runPaceAdjust')?.value || 0);
        
        const newSwim = this.athlete.actualSwimTime * (1 + swimAdjust / 100);
        const newT1 = Math.max(10, this.athlete.actualT1Time + t1Adjust);
        const newBike = this.selectedPack ? this.selectedPack.avgBikeTime : this.athlete.actualBikeTime;
        const newT2 = this.athlete.actualT2Time;
        const newRun = this.athlete.actualRunTime * (1 + runAdjust / 100);
        const newTotal = newSwim + newT1 + newBike + newT2 + newRun;
        
        const newPosition = this.processedData.filter(a => 
            a.actualTotalTime && a.actualTotalTime < newTotal
        ).length + 1;
        
        // Update team positions
        let projectedTeamPositions = this.teamAthletes
            .map(a => {
                if (a.name === this.athlete.name) {
                    return newPosition;
                }
                return a.finalRank;
            })
            .filter(r => r)
            .sort((a, b) => a - b);
        
        const projectedTopThree = projectedTeamPositions.slice(0, 3);
        const projectedTeamPoints = this.calculateTeamPoints(projectedTopThree);
        
        const pointsChange = currentTeamPoints - projectedTeamPoints; // Lower is better
        
        container.innerHTML = `
            <div class="team-comparison">
                <div class="team-column actual">
                    <h5>Current Team Result</h5>
                    <div class="team-positions">
                        ${this.teamAthletes.map(a => `
                            <div class="teammate ${a.name === this.athlete.name ? 'current' : ''}">
                                <span class="name">${a.baseName || a.name}</span>
                                <span class="position">#${a.finalRank || 'DNF'}</span>
                            </div>
                        `).join('')}
                    </div>
                    <div class="team-score">
                        <label>Team Points (top 3):</label>
                        <value>${currentTeamPoints}</value>
                    </div>
                </div>
                
                <div class="team-column projected">
                    <h5>Projected Team Result</h5>
                    <div class="team-positions">
                        ${this.teamAthletes.map(a => {
                            const projPos = a.name === this.athlete.name ? newPosition : a.finalRank;
                            const changed = a.name === this.athlete.name && projPos !== a.finalRank;
                            return `
                                <div class="teammate ${a.name === this.athlete.name ? 'current' : ''} ${changed ? 'changed' : ''}">
                                    <span class="name">${a.baseName || a.name}</span>
                                    <span class="position">#${projPos || 'DNF'}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="team-score ${pointsChange > 0 ? 'better' : pointsChange < 0 ? 'worse' : ''}">
                        <label>Team Points (top 3):</label>
                        <value>${projectedTeamPoints}</value>
                    </div>
                </div>
            </div>
            
            <div class="team-impact">
                <div class="impact-summary ${pointsChange > 0 ? 'positive' : pointsChange < 0 ? 'negative' : 'neutral'}">
                    ${pointsChange > 0 ? 
                        `✅ Team improves by ${pointsChange} points` : 
                        pointsChange < 0 ? 
                        `⚠️ Team loses ${Math.abs(pointsChange)} points` : 
                        '↔️ No change to team score'}
                </div>
                ${this.getTeamInsights(currentTopThree, projectedTopThree)}
            </div>
        `;
    }
    
    calculateTeamPoints(positions) {
        if (!positions.length) return 999;
        const sum = positions.reduce((a, b) => a + b, 0);
        return sum;
    }
    
    getTeamInsights(currentTop3, projectedTop3) {
        const insights = [];
        
        const currentContains = currentTop3.includes(this.athlete.finalRank);
        const projectedContains = projectedTop3.includes(
            this.processedData.filter(a => 
                a.actualTotalTime && a.actualTotalTime < this.calculateProjectedTotal()
            ).length + 1
        );
        
        if (!currentContains && projectedContains) {
            insights.push('🎯 Athlete enters team scoring positions');
        } else if (currentContains && !projectedContains) {
            insights.push('⚠️ Athlete drops out of team scoring positions');
        }
        
        return insights.length > 0 ? 
            `<div class="team-insights">${insights.join('<br>')}</div>` : '';
    }
    
    calculateProjectedTotal() {
        const swimAdjust = parseFloat(document.getElementById('swimPaceAdjust')?.value || 0);
        const t1Adjust = parseInt(document.getElementById('t1Adjust')?.value || 0);
        const runAdjust = parseFloat(document.getElementById('runPaceAdjust')?.value || 0);
        
        const newSwim = this.athlete.actualSwimTime * (1 + swimAdjust / 100);
        const newT1 = Math.max(10, this.athlete.actualT1Time + t1Adjust);
        const newBike = this.selectedPack ? this.selectedPack.avgBikeTime : this.athlete.actualBikeTime;
        const newT2 = this.athlete.actualT2Time;
        const newRun = this.athlete.actualRunTime * (1 + runAdjust / 100);
        
        return newSwim + newT1 + newBike + newT2 + newRun;
    }
    
    formatSwimPace(paceSeconds) {
        const mins = Math.floor(paceSeconds / 60);
        const secs = Math.round(paceSeconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    formatRunPace(paceMinutes) {
        const mins = Math.floor(paceMinutes);
        const secs = Math.round((paceMinutes - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    formatTimeDiff(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.round(seconds % 60);
        if (mins > 0) {
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
        return `${secs}s`;
    }
}

export const hypotheticalAnalysis = new HypotheticalAnalysis();