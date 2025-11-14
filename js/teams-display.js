// teams-display.js
import { RaceConfig } from './config/race-config.js';
import { secondsToTime, secondsToMinSec, getFlag, getTeamIcon } from './utils/formatters.js';

export class TeamsDisplay {
    constructor() {
        this.processedData = null;
        this.colorScale = null;
        this.isNCAA = false;
        this.currentCheckpoint = 'finish';
        this.checkpoints = ['swim', 't1', 'bike', 't2', 'finish'];
        this.checkpointLabels = {
            'swim': 'After Swim',
            't1': 'After T1',
            'bike': 'After Bike',
            't2': 'After T2',
            'finish': 'Final Results'
        };
        this.checkpointStandings = {}; // Cache all checkpoint calculations
    }

    setData(data, colorScale, isNCAA) {
        this.processedData = data;
        this.colorScale = colorScale;
        this.isNCAA = isNCAA;
        
        // Pre-calculate all checkpoint standings if NCAA
        if (isNCAA) {
            this.calculateAllCheckpoints();
        }
    }

    calculateAllCheckpoints() {
        // Calculate standings for each checkpoint once
        this.checkpoints.forEach(checkpoint => {
            this.checkpointStandings[checkpoint] = this.calculateTeamStats(checkpoint);
        });
    }

    display() {
        if (!this.processedData) return;
        
        const teamsContent = document.getElementById('teamsContent');
        const teamsTitle = document.getElementById('teamsTitle');
        if (!teamsContent) return;

        // Update title
        if (teamsTitle) {
            teamsTitle.textContent = this.isNCAA ? '🏅 Team Performances' : '🌍 Country Analysis';
        }

        let html = '';

        // Add checkpoint navigation for NCAA only
        if (this.isNCAA) {
            html += this.createCheckpointNavigation();
        }

        // Add info box for World Triathlon
        if (!this.isNCAA) {
            html += `
                <div class="country-info-box">
                    <h3>📊 Country Performance Analysis</h3>
                    <p>Athletes grouped by country and ranked by average finishing time. 
                    This analysis shows which countries had the strongest overall performances.</p>
                </div>
            `;
        }

        // Get team stats (from cache for NCAA, calculate once for World Triathlon)
        const teamStats = this.isNCAA ? 
            this.checkpointStandings[this.currentCheckpoint] : 
            this.calculateTeamStats('finish');
            
        html += this.renderTeamRankings(teamStats);

        // Footer notes
        html += this.renderFooterNotes(teamStats);

        teamsContent.innerHTML = html;

        // Setup checkpoint navigation listeners
        if (this.isNCAA) {
            this.setupCheckpointListeners();
        }
    }

    createCheckpointNavigation() {
        const currentIndex = this.checkpoints.indexOf(this.currentCheckpoint);
        const canGoBack = currentIndex > 0;
        const canGoForward = currentIndex < this.checkpoints.length - 1;

        // Add position change summary
        const positionChanges = this.getPositionChanges();

        return `
            <div class="checkpoint-navigation">
                <button class="checkpoint-nav-btn prev ${!canGoBack ? 'disabled' : ''}" 
                    data-direction="prev" ${!canGoBack ? 'disabled' : ''}>
                    <span class="arrow">←</span>
                </button>
                <div class="checkpoint-info">
                    <div class="checkpoint-label">Team Standings</div>
                    <div class="checkpoint-name">${this.checkpointLabels[this.currentCheckpoint]}</div>
                    <div class="checkpoint-indicator">
                        ${this.checkpoints.map((cp, idx) => `
                            <span class="dot ${idx === currentIndex ? 'active' : ''} ${idx < currentIndex ? 'passed' : ''}"></span>
                        `).join('')}
                    </div>
                    ${positionChanges ? `<div class="position-changes">${positionChanges}</div>` : ''}
                </div>
                <button class="checkpoint-nav-btn next ${!canGoForward ? 'disabled' : ''}" 
                    data-direction="next" ${!canGoForward ? 'disabled' : ''}>
                    <span class="arrow">→</span>
                </button>
            </div>
        `;
    }

    getPositionChanges() {
        // Show what changed from previous checkpoint
        const currentIndex = this.checkpoints.indexOf(this.currentCheckpoint);
        if (currentIndex === 0) return null;

        const prevCheckpoint = this.checkpoints[currentIndex - 1];
        const currentStandings = this.checkpointStandings[this.currentCheckpoint];
        const prevStandings = this.checkpointStandings[prevCheckpoint];

        if (!currentStandings || !prevStandings) return null;

        const changes = [];
        currentStandings.slice(0, 5).forEach((team, idx) => {
            const prevIdx = prevStandings.findIndex(t => t.country === team.country);
            if (prevIdx !== idx) {
                const diff = prevIdx - idx;
                if (diff > 0) {
                    changes.push(`${team.country} ↑${diff}`);
                } else if (diff < 0) {
                    changes.push(`${team.country} ↓${Math.abs(diff)}`);
                }
            }
        });

        return changes.length > 0 ? changes.join(', ') : 'No changes in top 5';
    }

    setupCheckpointListeners() {
        const prevBtn = document.querySelector('.checkpoint-nav-btn.prev');
        const nextBtn = document.querySelector('.checkpoint-nav-btn.next');

        prevBtn?.addEventListener('click', () => {
            const currentIndex = this.checkpoints.indexOf(this.currentCheckpoint);
            if (currentIndex > 0) {
                this.currentCheckpoint = this.checkpoints[currentIndex - 1];
                this.display();
            }
        });

        nextBtn?.addEventListener('click', () => {
            const currentIndex = this.checkpoints.indexOf(this.currentCheckpoint);
            if (currentIndex < this.checkpoints.length - 1) {
                this.currentCheckpoint = this.checkpoints[currentIndex + 1];
                this.display();
            }
        });
    }

    calculateTeamStats(checkpoint) {
        // Group athletes by country/team
        const teams = {};
        this.processedData.forEach(athlete => {
            if (!teams[athlete.country]) {
                teams[athlete.country] = [];
            }
            teams[athlete.country].push(athlete);
        });

        // Calculate positions at checkpoint
        let allAthletesAtCheckpoint = [];
        
        if (checkpoint === 'finish') {
            // Use final rankings directly
            allAthletesAtCheckpoint = this.processedData
                .filter(a => a.finalRank)
                .map(a => ({
                    name: a.name,
                    country: a.country,
                    position: a.finalRank,
                    time: a.actualTotalTime
                }))
                .sort((a, b) => a.position - b.position);
        } else {
            // Calculate cumulative times and positions
            const athleteTimes = this.processedData.map(athlete => {
                let cumulativeTime = 0;
                let hasTime = true;
                
                // Add times up to checkpoint
                if (athlete.actualSwimTime) {
                    cumulativeTime += athlete.actualSwimTime;
                } else {
                    hasTime = false;
                }
                
                if (checkpoint !== 'swim' && hasTime) {
                    if (athlete.t1Time) {
                        cumulativeTime += athlete.t1Time;
                    }
                }
                
                if ((checkpoint === 'bike' || checkpoint === 't2') && hasTime) {
                    if (athlete.actualBikeTime) {
                        cumulativeTime += athlete.actualBikeTime;
                    } else {
                        hasTime = false;
                    }
                }
                
                if (checkpoint === 't2' && hasTime) {
                    if (athlete.t2Time) {
                        cumulativeTime += athlete.t2Time;
                    }
                }

                return {
                    name: athlete.name,
                    country: athlete.country,
                    time: hasTime ? cumulativeTime : null,
                    athlete: athlete
                };
            }).filter(a => a.time !== null)
              .sort((a, b) => a.time - b.time);

            // Assign positions
            athleteTimes.forEach((item, idx) => {
                item.position = idx + 1;
            });

            allAthletesAtCheckpoint = athleteTimes;
        }

        // Build team stats
        const teamStats = [];
        Object.keys(teams).forEach(country => {
            const athletes = teams[country];
            
            // Get athletes with positions at this checkpoint
            const teamAthletesAtCheckpoint = athletes.map(athlete => {
                const checkpointData = allAthletesAtCheckpoint.find(a => a.name === athlete.name);
                if (checkpointData) {
                    return {
                        ...athlete,
                        checkpointPosition: checkpointData.position,
                        checkpointTime: checkpointData.time
                    };
                }
                return null;
            }).filter(a => a !== null)
              .sort((a, b) => a.checkpointPosition - b.checkpointPosition);

            if (teamAthletesAtCheckpoint.length === 0) return;

            // Calculate team score and averages
            let score = null;
            let scoringAthletes = [];
            let displacers = [];
            let complete = false;

            if (this.isNCAA) {
                if (teamAthletesAtCheckpoint.length >= 5) {
                    scoringAthletes = teamAthletesAtCheckpoint.slice(0, 5);
                    score = scoringAthletes.reduce((sum, a) => sum + a.checkpointPosition, 0);
                    displacers = teamAthletesAtCheckpoint.slice(5, 7);
                    complete = true;
                } else {
                    scoringAthletes = teamAthletesAtCheckpoint;
                    score = teamAthletesAtCheckpoint.reduce((sum, a) => sum + a.checkpointPosition, 0) + 
                        (5 - teamAthletesAtCheckpoint.length) * 100;
                    complete = false;
                }
            } else {
                scoringAthletes = teamAthletesAtCheckpoint;
            }

            const avgTime = scoringAthletes.reduce((sum, a) => sum + a.checkpointTime, 0) / scoringAthletes.length;
            const avgPosition = scoringAthletes.reduce((sum, a) => sum + a.checkpointPosition, 0) / scoringAthletes.length;

            // Add segment averages only for final results
            let segmentAverages = {};
            if (checkpoint === 'finish') {
                segmentAverages = {
                    avgSwimPace: scoringAthletes.reduce((sum, a) => 
                        sum + (a.actualSwimTime / RaceConfig.distances.swim) * 100, 0) / scoringAthletes.length,
                    avgBikeSpeed: scoringAthletes.reduce((sum, a) => 
                        sum + (RaceConfig.distances.bike / (a.actualBikeTime / 3600)), 0) / scoringAthletes.length,
                    avgRunPace: scoringAthletes.reduce((sum, a) => 
                        sum + (a.actualRunTime / RaceConfig.distances.run / 60), 0) / scoringAthletes.length
                };
            }

            teamStats.push({
                country,
                score,
                avgPosition,
                avgFinishTime: avgTime,
                scoringAthletes,
                displacers,
                allAthletes: athletes,
                finishers: teamAthletesAtCheckpoint,
                complete,
                checkpoint,
                ...segmentAverages
            });
        });

        // Sort teams
        if (this.isNCAA) {
            teamStats.sort((a, b) => a.score - b.score);
        } else {
            teamStats.sort((a, b) => a.avgFinishTime - b.avgFinishTime);
        }

        return teamStats;
    }

    renderTeamRankings(teamStats) {
        let html = `<div class="${this.isNCAA ? 'team-rankings' : 'country-rankings'}">`;
        
        const medals = ['🥇', '🥈', '🥉'];
        const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
        
        teamStats.forEach((team, index) => {
            const teamIcon = this.getTeamIconForDisplay(team.country);
            const medal = index < 3 ? medals[index] : `${index + 1}.`;
            const borderColor = index < 3 ? podiumColors[index] : '#ddd';
            const teamColor = this.getTeamColorForDisplay(team.country);
            
            // Position display based on checkpoint
            const positionDisplay = team.checkpoint === 'finish' ? 
                team.scoringAthletes.map(a => a.finalRank) :
                team.scoringAthletes.map(a => a.checkpointPosition);

            html += `
                <div class="team-row ${index < 3 ? 'podium' : ''}" style="border-left: 4px solid ${borderColor};">
                    <div class="team-summary" onclick="this.parentElement.classList.toggle('expanded')">
                        <div class="team-rank">${medal}</div>
                        <div class="team-info">
                            <span class="team-name" style="color: ${teamColor};">${teamIcon} ${team.country}</span>
                            ${this.isNCAA ? 
                                `<span class="team-score">${team.score}${!team.complete ? '*' : ''} pts</span>` :
                                `<span class="team-score">Avg: ${secondsToTime(team.avgFinishTime)} (${team.finishers.length} athlete${team.finishers.length !== 1 ? 's' : ''})</span>`
                            }
                        </div>
                        ${team.checkpoint === 'finish' ? `
                            <div class="team-averages">
                                <span class="avg swim" title="Avg Swim Pace">🏊 ${this.formatSwimPace(team.avgSwimPace)}</span>
                                <span class="avg bike" title="Avg Bike Speed">🚴 ${team.avgBikeSpeed.toFixed(1)} km/h</span>
                                <span class="avg run" title="Avg Run Pace">🏃 ${this.formatRunPace(team.avgRunPace)}</span>
                            </div>
                        ` : ''}
                        <div class="scoring-positions">
                            ${positionDisplay.map((pos, idx) => 
                                `<span class="pos ${this.isNCAA && idx < 5 ? 'scoring' : 'counting'}" 
                                    style="background: ${teamColor};">#${pos}</span>`
                            ).join('')}
                            ${this.isNCAA && team.displacers.length > 0 ? 
                                team.displacers.map(a => {
                                    const pos = team.checkpoint === 'finish' ? a.finalRank : a.checkpointPosition;
                                    return `<span class="pos displacer">#${pos}</span>`;
                                }).join('') : ''
                            }
                        </div>
                        <div class="expand-icon">▼</div>
                    </div>
                    <div class="team-details">
                        ${this.renderAthleteTable(team)}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        return html;
    }

    renderAthleteTable(team) {
        if (this.currentCheckpoint === 'finish') {
            // Full table for finish
            return `
                <table class="athletes-table">
                    <thead>
                        <tr>
                            <th>Pos</th>
                            <th>Athlete</th>
                            <th>Total</th>
                            <th>Swim</th>
                            <th>Bike</th>
                            <th>Run</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${team.scoringAthletes.map((athlete, idx) => 
                            this.createAthleteTableRow(athlete, this.isNCAA && idx < 5)
                        ).join('')}
                        ${this.isNCAA && team.displacers.length > 0 ? `
                            <tr class="divider-row"><td colspan="6">Displacers</td></tr>
                            ${team.displacers.map(athlete => 
                                this.createAthleteTableRow(athlete, false)
                            ).join('')}
                        ` : ''}
                    </tbody>
                </table>
                ${team.allAthletes.length > team.scoringAthletes.length + team.displacers.length ? `
                    <div class="other-athletes">
                        ${this.isNCAA ? 'Other:' : 'Did not finish:'} ${team.allAthletes
                            .filter(a => !team.scoringAthletes.includes(a) && !team.displacers.includes(a))
                            .map(a => `${a.baseName} (${a.finalRank ? '#' + a.finalRank : a.status})`)
                            .join(', ')}
                    </div>
                ` : ''}
            `;
        } else {
            // Simplified table for checkpoints
            return `
                <table class="athletes-table">
                    <thead>
                        <tr>
                            <th>Pos</th>
                            <th>Athlete</th>
                            <th>Time at ${this.checkpointLabels[this.currentCheckpoint]}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${team.scoringAthletes.map((athlete, idx) => `
                            <tr class="${this.isNCAA && idx >= 5 ? 'displacer' : ''}">
                                <td style="color: ${this.getTeamColorForDisplay(team.country)}; font-weight: 700;">
                                    #${athlete.checkpointPosition}
                                </td>
                                <td class="athlete-name-cell">${athlete.baseName}</td>
                                <td class="time-cell">${secondsToTime(athlete.checkpointTime)}</td>
                            </tr>
                        `).join('')}
                        ${this.isNCAA && team.displacers.length > 0 ? `
                            <tr class="divider-row"><td colspan="3">Displacers</td></tr>
                            ${team.displacers.map(athlete => `
                                <tr class="displacer">
                                    <td style="font-weight: 700;">#${athlete.checkpointPosition}</td>
                                    <td class="athlete-name-cell">${athlete.baseName}</td>
                                    <td class="time-cell">${secondsToTime(athlete.checkpointTime)}</td>
                                </tr>
                            `).join('')}
                        ` : ''}
                    </tbody>
                </table>
            `;
        }
    }

    createAthleteTableRow(athlete, isScoring) {
        const teamColor = this.getTeamColorForDisplay(athlete.country);
        const swimPace = athlete.actualSwimTime ? 
            secondsToTime((athlete.actualSwimTime / RaceConfig.distances.swim) * 100) + '/100m' : 'N/A';
        const bikeSpeed = athlete.actualBikeTime ? 
            ((RaceConfig.distances.bike / (athlete.actualBikeTime / 3600)).toFixed(1) + ' km/h') : 'N/A';
        const runPace = athlete.actualRunTime ? 
            (() => {
                const pace = athlete.actualRunTime / RaceConfig.distances.run / 60;
                const mins = Math.floor(pace);
                const secs = Math.round((pace % 1) * 60);
                return `${mins}:${secs.toString().padStart(2, '0')}/km`;
            })() : 'N/A';
        
        return `
            <tr class="${!isScoring ? 'displacer' : ''}">
                <td style="color: ${teamColor}; font-weight: 700;">#${athlete.finalRank}</td>
                <td class="athlete-name-cell">${athlete.baseName}</td>
                <td class="time-cell">${secondsToTime(athlete.actualTotalTime)}</td>
                <td>
                    <div class="time-cell">${secondsToMinSec(athlete.actualSwimTime)}</div>
                    <div class="pace-cell">${swimPace}</div>
                </td>
                <td>
                    <div class="time-cell">${secondsToMinSec(athlete.actualBikeTime)}</div>
                    <div class="pace-cell">${bikeSpeed}</div>
                </td>
                <td>
                    <div class="time-cell">${secondsToMinSec(athlete.actualRunTime)}</div>
                    <div class="pace-cell">${runPace}</div>
                </td>
            </tr>
        `;
    }

    renderFooterNotes(teamStats) {
        let html = '';
        
        if (this.isNCAA) {
            if (teamStats.some(t => !t.complete)) {
                html += '<p class="scoring-note">* Team did not have 5 finishers. Penalty of 100 points per missing athlete applied.</p>';
            }
            html += `
                <div class="scoring-rules">
                    <strong>NCAA Scoring:</strong> Sum of positions for top 5 finishers (lower is better). 
                    Next 2 finishers are displacers. ${this.currentCheckpoint !== 'finish' ? 
                        'Positions shown are at ' + this.checkpointLabels[this.currentCheckpoint] + '.' : 
                        'Averages based on scoring athletes only.'}
                </div>
            `;
        } else {
            html += `
                <div class="scoring-rules">
                    <strong>Analysis Method:</strong> Countries ranked by average finishing time of all finishers. 
                    Performance averages calculated across all athletes from each country.
                </div>
            `;
        }
        
        return html;
    }

    // Helper methods
    getTeamColorForDisplay(country) {
        const teamAthlete = this.processedData.find(a => a.country === country);
        return teamAthlete ? this.colorScale(teamAthlete.name) : '#666';
    }

    getTeamIconForDisplay(country) {
        if (this.isNCAA) {
            return getTeamIcon(country, true);
        }
        return getFlag(country);
    }

    formatSwimPace(pace) {
        return secondsToTime(pace) + '/100m';
    }

    formatRunPace(pace) {
        const mins = Math.floor(pace);
        const secs = Math.round((pace % 1) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}/km`;
    }


    refresh() {
        // Recalculate all checkpoints if NCAA
        if (this.isNCAA) {
            this.calculateAllCheckpoints();
        }
        // Re-display with current checkpoint
        this.display();
    }
}