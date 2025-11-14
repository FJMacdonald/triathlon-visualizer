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
        this.allTeams = {};
        
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
                            Athletes grouped by similar T2 entry times. Click on a pack to see athletes.
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
                                    <label>Swim Performance</label>
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
                                    <label>T1 Performance</label>
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
                            <h5>T2 & Run Performance</h5>
                            <div class="adjustment-grid">
                                <div class="control-group">
                                    <label>T2 Performance</label>
                                    <div class="time-adjuster">
                                        <input type="range" id="t2Adjust" min="-30" max="30" value="0" step="1">
                                        <div class="time-display">
                                            <span id="t2Value">0</span>s
                                        </div>
                                    </div>
                                    <div id="t2Details" class="time-details"></div>
                                </div>
                                
                                <div class="control-group">
                                    <label>Run Performance</label>
                                    <div class="pace-adjuster">
                                        <input type="range" id="runPaceAdjust" min="-10" max="10" value="0" step="0.5">
                                        <div class="pace-display">
                                            <span id="runPaceValue">0</span>%
                                            <span id="runTimeChange" class="time-change"></span>
                                        </div>
                                    </div>
                                    <div id="runDetails" class="pace-details"></div>
                                </div>
                            </div>
                            <div id="runFatigueWarning" class="fatigue-warning"></div>
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
        
        document.getElementById('targetPack')?.addEventListener('change', (e) => {
            this.selectPack(e.target.value);
        });
        
        document.getElementById('swimPaceAdjust')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('swimPaceValue').textContent = value.toFixed(1);
            this.updateSwimDetails();
            this.checkPackFeasibility();
            this.updateProjections();
        });
        
        document.getElementById('t1Adjust')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('t1Value').textContent = value;
            this.updateT1Details();
            this.checkPackFeasibility();
            this.updateProjections();
        });
        
        document.getElementById('t2Adjust')?.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            document.getElementById('t2Value').textContent = value;
            this.updateT2Details();
            this.updateProjections();
        });
        
        document.getElementById('runPaceAdjust')?.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            document.getElementById('runPaceValue').textContent = value.toFixed(1);
            this.updateRunDetails();
            this.updateProjections();
        });
        
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
        this.calculateAllTeamRankings();
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
    
    calculateAllTeamRankings() {
        if (!this.processedData) return;
        
        this.allTeams = {};
        
        this.processedData.forEach(a => {
            if (!this.allTeams[a.country]) {
                this.allTeams[a.country] = [];
            }
            if (a.finalRank) {
                this.allTeams[a.country].push(a.finalRank);
            }
        });
        
        Object.keys(this.allTeams).forEach(country => {
            this.allTeams[country].sort((a, b) => a - b);
        });
    }
    
    calculateTeamScore(positions) {
        if (positions.length < 5) return Infinity;
        const scoringPositions = positions.slice(0, 5);
        return scoringPositions.reduce((sum, pos) => sum + pos, 0);
    }
    
    getTeamBreakdown(positions) {
        const scoring = positions.slice(0, 5);
        const displacers = positions.slice(5, 7);
        return { scoring, displacers };
    }
    
    getTeamRankings(teamScores) {
        const sorted = Object.entries(teamScores)
            .filter(([country, score]) => score < Infinity)
            .sort((a, b) => a[1] - b[1]);
        
        const rankings = {};
        sorted.forEach(([country, score], index) => {
            rankings[country] = {
                rank: index + 1,
                score: score
            };
        });
        
        return rankings;
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
        
        const PACK_GAP_THRESHOLD = 15;
        
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
        
        const t1Exits = pack.members.map(m => m.t1Exit);
        pack.earliestT1Exit = Math.min(...t1Exits);
        pack.latestT1Exit = Math.max(...t1Exits);
        pack.avgT1Exit = d3.mean(t1Exits);
        
        const t2Entries = pack.members.map(m => m.t2Entry);
        pack.avgT2Entry = d3.mean(t2Entries);
        pack.t2EntrySpread = Math.max(...t2Entries) - Math.min(...t2Entries);
        
        const bikeTimes = pack.members.map(m => m.bikeTime);
        pack.avgBikeTime = d3.mean(bikeTimes);
        pack.fastestBikeTime = Math.min(...bikeTimes);
        pack.slowestBikeTime = Math.max(...bikeTimes);
        pack.avgBikeSpeed = RaceConfig.getBikeSpeed(pack.avgBikeTime);
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
    
    getPackLabel(pack) {
        if (pack === this.athletePack) {
            return { name: 'Current Pack', badge: 'ACTUAL', badgeClass: 'current-badge' };
        }
        
        const packIndex = this.packs.indexOf(pack);
        const athletePackIndex = this.packs.indexOf(this.athletePack);
        
        if (packIndex < athletePackIndex) {
            const packsAhead = athletePackIndex - packIndex;
            if (packIndex === 0) {
                return { name: 'Lead Pack', badge: `${packsAhead} AHEAD`, badgeClass: 'ahead-badge' };
            } else if (pack.size >= 5) {
                return { name: `Chase Pack`, badge: `${packsAhead} AHEAD`, badgeClass: 'ahead-badge' };
            } else if (pack.size >= 2) {
                return { name: `Small Group`, badge: `${packsAhead} AHEAD`, badgeClass: 'ahead-badge' };
            } else {
                return { name: `Solo`, badge: `${packsAhead} AHEAD`, badgeClass: 'ahead-badge' };
            }
        } else {
            const packsBehind = packIndex - athletePackIndex;
            if (pack.size >= 5) {
                return { name: `Chase Pack`, badge: `${packsBehind} BEHIND`, badgeClass: 'behind-badge' };
            } else if (pack.size >= 2) {
                return { name: `Small Group`, badge: `${packsBehind} BEHIND`, badgeClass: 'behind-badge' };
            } else {
                return { name: `Solo`, badge: `${packsBehind} BEHIND`, badgeClass: 'behind-badge' };
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
            const packLabel = this.getPackLabel(pack);
            
            html += `
                <div class="pack-card ${isCurrentPack ? 'current' : ''} ${hasTeammates ? 'has-teammates' : ''}" 
                     data-pack-id="${pack.id}">
                    <div class="pack-header" data-pack-toggle="${pack.id}">
                        <div class="pack-title">
                            <span class="pack-name">${packLabel.name}</span>
                            <span class="pack-size">${pack.size} athlete${pack.size > 1 ? 's' : ''}</span>
                            <span class="pack-badge ${packLabel.badgeClass}">${packLabel.badge}</span>
                        </div>
                        <span class="expand-icon" id="expandIcon${pack.id}">▼</span>
                    </div>
                    
                    <div class="pack-stats">
                        <div class="stat">
                            <label>T1 Exit Range</label>
                            <value>${secondsToTime(pack.earliestT1Exit)} - ${secondsToTime(pack.latestT1Exit)}</value>
                        </div>
                        <div class="stat">
                            <label>Avg Bike Time</label>
                            <value>${secondsToTime(pack.avgBikeTime)}</value>
                        </div>
                        <div class="stat">
                            <label>Avg Speed</label>
                            <value>${pack.avgBikeSpeed.toFixed(1)} km/h</value>
                        </div>
                    </div>
                    
                    <div class="pack-members-container" id="packMembers${pack.id}" style="display: none;">
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
                                        <span class="member-rank">#${m.athlete.finalRank || 'DNF'}</span>
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
        
        // Bind click events for pack toggles
        container.querySelectorAll('[data-pack-toggle]').forEach(header => {
            header.addEventListener('click', () => {
                const packId = header.dataset.packToggle;
                this.togglePackMembers(packId);
            });
        });
    }
    
    togglePackMembers(packId) {
        const membersEl = document.getElementById(`packMembers${packId}`);
        const iconEl = document.getElementById(`expandIcon${packId}`);
        
        if (membersEl && iconEl) {
            const isVisible = membersEl.style.display !== 'none';
            membersEl.style.display = isVisible ? 'none' : 'block';
            iconEl.textContent = isVisible ? '▼' : '▲';
        }
    }
    
    populatePackSelector() {
        const select = document.getElementById('targetPack');
        if (!select) return;
        
        let html = '<option value="current">Current Pack (Actual Performance)</option>';
        
        this.packs.forEach(pack => {
            if (pack !== this.athletePack) {
                const timeDiff = this.calculateTimeToJoinPack(pack);
                const packLabel = this.getPackLabel(pack);
                const direction = timeDiff.total < 0 ? 'faster' : timeDiff.total > 0 ? 'easier' : 'same';
                const teammates = pack.members.filter(m => 
                    m.athlete.country === this.athlete.country
                ).length;
                
                html += `
                    <option value="${pack.id}">
                        ${packLabel.name} (${packLabel.badge}) - ${this.formatTimeDiff(Math.abs(timeDiff.total))} ${direction}
                        ${teammates > 0 ? ` (${teammates} teammate${teammates > 1 ? 's' : ''})` : ''}
                    </option>
                `;
            }
        });
        
        select.innerHTML = html;
    }
    
    calculateTimeToJoinPack(pack) {
        const currentT1Exit = this.athlete.swimCumulative + this.athlete.actualT1Time;
        const targetT1Exit = pack.latestT1Exit;
        const timeDiff = targetT1Exit - currentT1Exit;
        
        return {
            total: timeDiff,
            targetT1Exit: targetT1Exit,
            currentT1Exit: currentT1Exit,
            suggestedSwimChange: timeDiff * 0.8,
            suggestedT1Change: timeDiff * 0.2
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
                    <p>Adjust swim/T1/T2/run to explore alternative outcomes.</p>
                </div>
            `;
            return;
        }
        
        const timeDiff = this.calculateTimeToJoinPack(this.selectedPack);
        const bikeTimeDiff = this.selectedPack.avgBikeTime - this.athlete.actualBikeTime;
        const packLabel = this.getPackLabel(this.selectedPack);
        
        const timeClass = timeDiff.total < 0 ? 'time-cost' : 'time-saved';
        const effortText = timeDiff.total < 0 ? 'Time to make up' : 'Time buffer available';
        
        panel.innerHTML = `
            <div class="pack-requirements">
                <div class="requirement-header">
                    <h5>To Join ${packLabel.name}</h5>
                </div>
                
                <div class="time-requirement ${timeClass}">
                    <div class="time-main">
                        <span class="time-label">${effortText}:</span>
                        <span class="time-value">${this.formatTimeDiff(Math.abs(timeDiff.total))}</span>
                    </div>
                    <div class="time-breakdown">
                        <div>Target T1 exit: ${secondsToTime(timeDiff.targetT1Exit)}</div>
                        <div>Your T1 exit: ${secondsToTime(timeDiff.currentT1Exit)}</div>
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
    
    suggestAdjustments() {
        if (this.selectedPack === this.athletePack) {
            this.resetAdjustments();
            return;
        }
        
        const timeDiff = this.calculateTimeToJoinPack(this.selectedPack);
        
        // Positive slider value = faster performance = negative time change
        // So if we need to be faster (timeDiff < 0), slider should be positive
        const swimPaceChange = -(timeDiff.suggestedSwimChange / this.athlete.actualSwimTime) * 100;
        const t1Change = -timeDiff.suggestedT1Change;
        
        document.getElementById('swimPaceAdjust').value = swimPaceChange;
        document.getElementById('swimPaceValue').textContent = swimPaceChange.toFixed(1);
        document.getElementById('t1Adjust').value = t1Change;
        document.getElementById('t1Value').textContent = Math.round(t1Change);
        
        const bikeTimeDiff = this.selectedPack.avgBikeTime - this.athlete.actualBikeTime;
        let runImpact = 0;
        
        if (bikeTimeDiff < 0) {
            // Harder bike = slower run (negative adjustment = slower)
            runImpact = -(Math.abs(bikeTimeDiff) / this.athlete.actualBikeTime) * 100 * 0.5;
        } else {
            // Easier bike = faster run (positive adjustment = faster)
            runImpact = (bikeTimeDiff / this.athlete.actualBikeTime) * 100 * 0.3;
        }
        
        document.getElementById('runPaceAdjust').value = runImpact;
        document.getElementById('runPaceValue').textContent = runImpact.toFixed(1);
        
        this.updateSwimDetails();
        this.updateT1Details();
        this.updateT2Details();
        this.updateRunDetails();
        this.checkPackFeasibility();
    }
    
    resetAdjustments() {
        ['swimPaceAdjust', 't1Adjust', 't2Adjust', 'runPaceAdjust'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = 0;
        });
        
        document.getElementById('swimPaceValue').textContent = '0';
        document.getElementById('t1Value').textContent = '0';
        document.getElementById('t2Value').textContent = '0';
        document.getElementById('runPaceValue').textContent = '0';
        
        this.updateSwimDetails();
        this.updateT1Details();
        this.updateT2Details();
        this.updateRunDetails();
    }
    
    updateSwimDetails() {
        const details = document.getElementById('swimDetails');
        const paceAdjust = parseFloat(document.getElementById('swimPaceAdjust')?.value || 0);
        
        const currentPace = RaceConfig.getSwimPace(this.athlete.actualSwimTime);
        // Positive adjustment = faster = lower time
        const newTime = this.athlete.actualSwimTime * (1 - paceAdjust / 100);
        const newPace = currentPace * (1 - paceAdjust / 100);
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
        
        // Positive adjustment = faster = lower time
        const newTime = Math.max(10, this.athlete.actualT1Time - adjustment);
        
        if (details) {
            details.innerHTML = `
                <div>Current: ${secondsToTime(this.athlete.actualT1Time)}</div>
                <div>New: ${secondsToTime(newTime)}</div>
            `;
        }
    }
    
    updateT2Details() {
        const details = document.getElementById('t2Details');
        const adjustment = parseInt(document.getElementById('t2Adjust')?.value || 0);
        
        // Positive adjustment = faster = lower time
        const newTime = Math.max(10, this.athlete.actualT2Time - adjustment);
        
        if (details) {
            details.innerHTML = `
                <div>Current: ${secondsToTime(this.athlete.actualT2Time)}</div>
                <div>New: ${secondsToTime(newTime)}</div>
            `;
        }
    }
    
    updateRunDetails() {
        const details = document.getElementById('runDetails');
        const warning = document.getElementById('runFatigueWarning');
        const paceAdjust = parseFloat(document.getElementById('runPaceAdjust')?.value || 0);
        
        const currentPace = RaceConfig.getRunPace(this.athlete.actualRunTime);
        // Positive adjustment = faster = lower time
        const newTime = this.athlete.actualRunTime * (1 - paceAdjust / 100);
        const newPace = currentPace * (1 - paceAdjust / 100);
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
        
        // Positive adjustment = faster = lower time
        const newSwimTime = this.athlete.actualSwimTime * (1 - swimAdjust / 100);
        const newT1Time = Math.max(10, this.athlete.actualT1Time - t1Adjust);
        const newT1Exit = this.athlete.swimCumulative - this.athlete.actualSwimTime + newSwimTime + newT1Time;
        
        const timeDiff = this.calculateTimeToJoinPack(this.selectedPack);
        const canMake = newT1Exit <= timeDiff.targetT1Exit + 5;
        
        container.innerHTML = canMake ? `
            <div class="feasibility-success">
                ✅ Can join pack with these adjustments
                <div>T1 exit: ${secondsToTime(newT1Exit)} (need by ${secondsToTime(timeDiff.targetT1Exit)})</div>
            </div>
        ` : `
            <div class="feasibility-fail">
                ❌ Cannot make pack with current adjustments
                <div>T1 exit: ${secondsToTime(newT1Exit)} (need by ${secondsToTime(timeDiff.targetT1Exit)})</div>
                <div>Still ${secondsToTime(newT1Exit - timeDiff.targetT1Exit)} too slow</div>
            </div>
        `;
    }
    
    updateProjections() {
        this.updateIndividualOutcome();
        this.updateTeamOutcome();
    }
    
    calculateNewRankings(athleteNewTotal) {
        // Create array of all athletes with their times
        const allAthletes = this.processedData
            .filter(a => a.actualTotalTime)
            .map(a => ({
                name: a.name,
                country: a.country,
                originalRank: a.finalRank,
                time: a.name === this.athlete.name ? athleteNewTotal : a.actualTotalTime
            }))
            .sort((a, b) => a.time - b.time);
        
        // Assign new ranks
        const newRankings = {};
        allAthletes.forEach((a, index) => {
            newRankings[a.name] = {
                newRank: index + 1,
                originalRank: a.originalRank,
                country: a.country
            };
        });
        
        return newRankings;
    }
    
    updateIndividualOutcome() {
        const container = document.getElementById('individualOutcome');
        if (!container || !this.athlete) return;
        
        const swimAdjust = parseFloat(document.getElementById('swimPaceAdjust')?.value || 0);
        const t1Adjust = parseInt(document.getElementById('t1Adjust')?.value || 0);
        const t2Adjust = parseInt(document.getElementById('t2Adjust')?.value || 0);
        const runAdjust = parseFloat(document.getElementById('runPaceAdjust')?.value || 0);
        
        // Positive adjustment = faster = lower time
        const newSwim = this.athlete.actualSwimTime * (1 - swimAdjust / 100);
        const newT1 = Math.max(10, this.athlete.actualT1Time - t1Adjust);
        const newBike = this.selectedPack ? this.selectedPack.avgBikeTime : this.athlete.actualBikeTime;
        const newT2 = Math.max(10, this.athlete.actualT2Time - t2Adjust);
        const newRun = this.athlete.actualRunTime * (1 - runAdjust / 100);
        const newTotal = newSwim + newT1 + newBike + newT2 + newRun;
        
        const newRankings = this.calculateNewRankings(newTotal);
        const newPosition = newRankings[this.athlete.name].newRank;
        
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
                        <div class="${Math.abs(newSwim - this.athlete.actualSwimTime) > 0.5 ? 'changed' : ''}">
                            Swim: ${secondsToTime(newSwim)}
                        </div>
                        <div class="${newT1 !== this.athlete.actualT1Time ? 'changed' : ''}">
                            T1: ${secondsToTime(newT1)}
                        </div>
                        <div class="${Math.abs(newBike - this.athlete.actualBikeTime) > 0.5 ? 'changed' : ''}">
                            Bike: ${secondsToTime(newBike)}
                        </div>
                        <div class="${newT2 !== this.athlete.actualT2Time ? 'changed' : ''}">
                            T2: ${secondsToTime(newT2)}
                        </div>
                        <div class="${Math.abs(newRun - this.athlete.actualRunTime) > 0.5 ? 'changed' : ''}">
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
        
        // Calculate new total time
        const swimAdjust = parseFloat(document.getElementById('swimPaceAdjust')?.value || 0);
        const t1Adjust = parseInt(document.getElementById('t1Adjust')?.value || 0);
        const t2Adjust = parseInt(document.getElementById('t2Adjust')?.value || 0);
        const runAdjust = parseFloat(document.getElementById('runPaceAdjust')?.value || 0);
        
        const newSwim = this.athlete.actualSwimTime * (1 - swimAdjust / 100);
        const newT1 = Math.max(10, this.athlete.actualT1Time - t1Adjust);
        const newBike = this.selectedPack ? this.selectedPack.avgBikeTime : this.athlete.actualBikeTime;
        const newT2 = Math.max(10, this.athlete.actualT2Time - t2Adjust);
        const newRun = this.athlete.actualRunTime * (1 - runAdjust / 100);
        const newTotal = newSwim + newT1 + newBike + newT2 + newRun;
        
        // Get new rankings for all athletes
        const newRankings = this.calculateNewRankings(newTotal);
        
        // Calculate current team scores
        const currentTeamScores = {};
        Object.keys(this.allTeams).forEach(country => {
            currentTeamScores[country] = this.calculateTeamScore(this.allTeams[country]);
        });
        const currentRankings = this.getTeamRankings(currentTeamScores);
        
        // Calculate projected team positions based on new individual rankings
        const projectedTeams = {};
        Object.entries(newRankings).forEach(([name, data]) => {
            if (!projectedTeams[data.country]) {
                projectedTeams[data.country] = [];
            }
            projectedTeams[data.country].push(data.newRank);
        });
        
        Object.keys(projectedTeams).forEach(country => {
            projectedTeams[country].sort((a, b) => a - b);
        });
        
        const projectedTeamScores = {};
        Object.keys(projectedTeams).forEach(country => {
            projectedTeamScores[country] = this.calculateTeamScore(projectedTeams[country]);
        });
        const projectedRankings = this.getTeamRankings(projectedTeamScores);
        
        const athleteCountry = this.athlete.country;
        const currentTeamRank = currentRankings[athleteCountry]?.rank || 'N/A';
        const projectedTeamRank = projectedRankings[athleteCountry]?.rank || 'N/A';
        const teamRankChange = currentTeamRank - projectedTeamRank;
        
        const currentTeamScore = currentTeamScores[athleteCountry];
        const projectedTeamScore = projectedTeamScores[athleteCountry];
        const scoreChange = currentTeamScore - projectedTeamScore;
        
        const currentBreakdown = this.getTeamBreakdown(this.allTeams[athleteCountry]);
        const projectedBreakdown = this.getTeamBreakdown(projectedTeams[athleteCountry] || []);
        
        const newAthleteRank = newRankings[this.athlete.name].newRank;
        
        container.innerHTML = `
            <div class="team-comparison">
                <div class="team-column actual">
                    <h5>Current Team Result (${athleteCountry})</h5>
                    <div class="team-ranking">
                        <span class="team-rank">#${currentTeamRank}</span>
                        <span class="team-score-label">Team Ranking</span>
                    </div>
                    <div class="team-breakdown">
                        <div class="breakdown-section">
                            <label>Scoring (Top 5):</label>
                            <div class="breakdown-positions">
                                ${currentBreakdown.scoring.map(pos => {
                                    const athlete = this.teamAthletes.find(a => a.finalRank === pos);
                                    const isCurrent = athlete?.name === this.athlete.name;
                                    return `<span class="scoring-pos ${isCurrent ? 'current' : ''}">#${pos}</span>`;
                                }).join('')}
                            </div>
                            <div class="breakdown-total">= ${currentTeamScore} pts</div>
                        </div>
                        ${currentBreakdown.displacers.length > 0 ? `
                            <div class="breakdown-section displacers">
                                <label>Displacers (Next 2):</label>
                                <div class="breakdown-positions">
                                    ${currentBreakdown.displacers.map(pos => {
                                        const athlete = this.teamAthletes.find(a => a.finalRank === pos);
                                        const isCurrent = athlete?.name === this.athlete.name;
                                        return `<span class="displacer-pos ${isCurrent ? 'current' : ''}">#${pos}</span>`;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="team-athletes">
                        ${this.teamAthletes.map(a => `
                            <div class="teammate ${a.name === this.athlete.name ? 'current' : ''}">
                                <span class="name">${a.baseName || a.name}</span>
                                <span class="position">#${a.finalRank || 'DNF'}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div class="team-column projected">
                    <h5>Projected Team Result</h5>
                    <div class="team-ranking ${teamRankChange > 0 ? 'better' : teamRankChange < 0 ? 'worse' : ''}">
                        <span class="team-rank">#${projectedTeamRank}</span>
                        <span class="team-score-label">Team Ranking</span>
                    </div>
                    <div class="team-breakdown">
                        <div class="breakdown-section">
                            <label>Scoring (Top 5):</label>
                            <div class="breakdown-positions">
                                ${projectedBreakdown.scoring.map(pos => {
                                    const isAthlete = pos === newAthleteRank;
                                    const changed = isAthlete && newAthleteRank !== this.athlete.finalRank;
                                    return `<span class="scoring-pos ${isAthlete ? 'current' : ''} ${changed ? 'changed' : ''}">#${pos}</span>`;
                                }).join('')}
                            </div>
                            <div class="breakdown-total ${scoreChange > 0 ? 'better' : scoreChange < 0 ? 'worse' : ''}">= ${projectedTeamScore} pts</div>
                        </div>
                        ${projectedBreakdown.displacers.length > 0 ? `
                            <div class="breakdown-section displacers">
                                <label>Displacers (Next 2):</label>
                                <div class="breakdown-positions">
                                    ${projectedBreakdown.displacers.map(pos => {
                                        const isAthlete = pos === newAthleteRank;
                                        return `<span class="displacer-pos ${isAthlete ? 'current' : ''}">#${pos}</span>`;
                                    }).join('')}
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="team-athletes">
                        ${this.teamAthletes.map(a => {
                            const projPos = newRankings[a.name]?.newRank || a.finalRank;
                            const changed = a.name === this.athlete.name && projPos !== a.finalRank;
                            return `
                                <div class="teammate ${a.name === this.athlete.name ? 'current' : ''} ${changed ? 'changed' : ''}">
                                    <span class="name">${a.baseName || a.name}</span>
                                    <span class="position">#${projPos || 'DNF'}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
            
            <div class="team-impact">
                <div class="impact-grid">
                    <div class="impact-item ${teamRankChange > 0 ? 'positive' : teamRankChange < 0 ? 'negative' : 'neutral'}">
                        <label>Team Ranking Change:</label>
                        <value>${teamRankChange > 0 ? '↑' : teamRankChange < 0 ? '↓' : '→'} ${Math.abs(teamRankChange)} position${Math.abs(teamRankChange) !== 1 ? 's' : ''}</value>
                    </div>
                    <div class="impact-item ${scoreChange > 0 ? 'positive' : scoreChange < 0 ? 'negative' : 'neutral'}">
                        <label>Points Change:</label>
                        <value>${scoreChange > 0 ? '-' : scoreChange < 0 ? '+' : ''}${Math.abs(scoreChange)} pts</value>
                    </div>
                </div>
                ${this.getTeamRankingContext(currentRankings, projectedRankings, athleteCountry)}
            </div>
        `;
    }
    
    getTeamRankingContext(currentRankings, projectedRankings, athleteCountry) {
        const current = currentRankings[athleteCountry];
        const projected = projectedRankings[athleteCountry];
        
        if (!current || !projected) return '';
        
        const nearbyTeams = [];
        Object.entries(projectedRankings).forEach(([country, data]) => {
            if (country !== athleteCountry && Math.abs(data.rank - projected.rank) <= 2) {
                nearbyTeams.push({
                    country,
                    rank: data.rank,
                    score: data.score
                });
            }
        });
        
        nearbyTeams.sort((a, b) => a.rank - b.rank);
        
        let contextHTML = '<div class="team-context">';
        contextHTML += '<h6>Final Team Standings</h6>';
        contextHTML += '<div class="rankings-list">';
        
        nearbyTeams.forEach(team => {
            if (team.rank < projected.rank) {
                contextHTML += `
                    <div class="context-team">
                        <span class="rank">#${team.rank}</span>
                        <span class="country">${team.country}</span>
                        <span class="score">${team.score} pts</span>
                        <span class="gap">${projected.score - team.score} pts ahead</span>
                    </div>
                `;
            }
        });
        
        contextHTML += `
            <div class="context-team your-team">
                <span class="rank">#${projected.rank}</span>
                <span class="country">${athleteCountry}</span>
                <span class="score">${projected.score} pts</span>
                <span class="gap">YOUR TEAM</span>
            </div>
        `;
        
        nearbyTeams.forEach(team => {
            if (team.rank > projected.rank) {
                contextHTML += `
                    <div class="context-team">
                        <span class="rank">#${team.rank}</span>
                        <span class="country">${team.country}</span>
                        <span class="score">${team.score} pts</span>
                        <span class="gap">${team.score - projected.score} pts behind</span>
                    </div>
                `;
            }
        });
        
        contextHTML += '</div></div>';
        
        return contextHTML;
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