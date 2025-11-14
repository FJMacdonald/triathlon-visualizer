// teams-display.js
import { RaceConfig } from './config/race-config.js';
import { secondsToTime, secondsToMinSec, getFlag, getTeamIcon } from './utils/formatters.js';

export class TeamsDisplay {
    constructor() {
        this.processedData = null;
        this.colorScale = null;
        this.isNCAA = false;
        this.currentCheckpoint = 'finish';
        this.checkpoints = ['swim', 't1', 'bike', 't2', 'run', 'finish'];
        this.checkpointLabels = {
            'swim': 'After Swim',
            't1': 'After T1',
            'bike': 'After Bike',
            't2': 'After T2', 
            'run': 'After Run',
            'finish': 'Final Results'
        };
    }

    setData(data, colorScale, isNCAA) {
        this.processedData = data;
        this.colorScale = colorScale;
        this.isNCAA = isNCAA;
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

        // Calculate and display team stats for current checkpoint
        const teamStats = this.calculateTeamStats(this.currentCheckpoint);
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
                </div>
                <button class="checkpoint-nav-btn next ${!canGoForward ? 'disabled' : ''}" 
                    data-direction="next" ${!canGoForward ? 'disabled' : ''}>
                    <span class="arrow">→</span>
                </button>
            </div>
        `;
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

        // Calculate cumulative times up to checkpoint
        const teamStats = [];
        Object.keys(teams).forEach(country => {
            const athletes = teams[country];
            
            // Calculate positions at checkpoint
            const athletesWithTime = athletes.map(athlete => {
                let cumulativeTime = 0;
                let hasTime = true;
                
                // Calculate cumulative time up to checkpoint
                if (checkpoint === 'swim' || checkpoint === 't1' || checkpoint === 'bike' || 
                    checkpoint === 't2' || checkpoint === 'run' || checkpoint === 'finish') {
                    if (athlete.actualSwimTime) cumulativeTime += athlete.actualSwimTime;
                    else hasTime = false;
                }
                if ((checkpoint === 't1' || checkpoint === 'bike' || checkpoint === 't2' || 
                     checkpoint === 'run' || checkpoint === 'finish') && hasTime) {
                    if (athlete.t1Time) cumulativeTime += athlete.t1Time;
                    else if (checkpoint !== 'swim') hasTime = false;
                }
                if ((checkpoint === 'bike' || checkpoint === 't2' || checkpoint === 'run' || 
                     checkpoint === 'finish') && hasTime) {
                    if (athlete.actualBikeTime) cumulativeTime += athlete.actualBikeTime;
                    else hasTime = false;
                }
                if ((checkpoint === 't2' || checkpoint === 'run' || checkpoint === 'finish') && hasTime) {
                    if (athlete.t2Time) cumulativeTime += athlete.t2Time;
                    else if (checkpoint !== 'bike' && checkpoint !== 't1' && checkpoint !== 'swim') hasTime = false;
                }
                if ((checkpoint === 'run' || checkpoint === 'finish') && hasTime) {
                    if (athlete.actualRunTime) cumulativeTime += athlete.actualRunTime;
                    else if (checkpoint === 'finish') hasTime = false;
                }

                return {
                    ...athlete,
                    checkpointTime: hasTime ? cumulativeTime : null,
                    hasTime
                };
            }).filter(a => a.hasTime);

            if (athletesWithTime.length === 0) return;

            // Sort all athletes by checkpoint time to get positions
            const allAthletesAtCheckpoint = this.processedData.map(athlete => {
                let cumulativeTime = 0;
                let hasTime = true;
                
                // Same calculation as above
                if (checkpoint === 'swim' || checkpoint === 't1' || checkpoint === 'bike' || 
                    checkpoint === 't2' || checkpoint === 'run' || checkpoint === 'finish') {
                    if (athlete.actualSwimTime) cumulativeTime += athlete.actualSwimTime;
                    else hasTime = false;
                }
                if ((checkpoint === 't1' || checkpoint === 'bike' || checkpoint === 't2' || 
                     checkpoint === 'run' || checkpoint === 'finish') && hasTime) {
                    if (athlete.t1Time) cumulativeTime += athlete.t1Time;
                }
                if ((checkpoint === 'bike' || checkpoint === 't2' || checkpoint === 'run' || 
                     checkpoint === 'finish') && hasTime) {
                    if (athlete.actualBikeTime) cumulativeTime += athlete.actualBikeTime;
                    else hasTime = false;
                }
                if ((checkpoint === 't2' || checkpoint === 'run' || checkpoint === 'finish') && hasTime) {
                    if (athlete.t2Time) cumulativeTime += athlete.t2Time;
                }
                if ((checkpoint === 'run' || checkpoint === 'finish') && hasTime) {
                    if (athlete.actualRunTime) cumulativeTime += athlete.actualRunTime;
                    else if (checkpoint === 'finish') hasTime = false;
                }

                return {
                    name: athlete.name,
                    country: athlete.country,
                    time: hasTime ? cumulativeTime : Infinity
                };
            }).filter(a => a.time !== Infinity)
              .sort((a, b) => a.time - b.time);

            // Assign positions
            athletesWithTime.forEach(athlete => {
                const position = allAthletesAtCheckpoint.findIndex(a => a.name === athlete.name) + 1;
                athlete.checkpointPosition = position;
            });

            // Sort team athletes by position
            athletesWithTime.sort((a, b) => a.checkpointPosition - b.checkpointPosition);

            // Use checkpoint-specific logic for final results
            if (checkpoint === 'finish') {
                // Use actual final rankings
                const finishers = athletes
                    .filter(a => a.finalRank)
                    .sort((a, b) => a.finalRank - b.finalRank);
                
                if (finishers.length === 0) return;

                // Standard team stats calculation
                this.addTeamStatsForFinish(teamStats, country, finishers, athletes);
            } else {
                // Calculate based on checkpoint positions
                this.addTeamStatsForCheckpoint(teamStats, country, athletesWithTime, athletes, checkpoint);
            }
        });

        // Sort teams
        if (this.isNCAA) {
            teamStats.sort((a, b) => a.score - b.score);
        } else {
            teamStats.sort((a, b) => a.avgFinishTime - b.avgFinishTime);
        }

        return teamStats;
    }

    addTeamStatsForCheckpoint(teamStats, country, athletesWithTime, allAthletes, checkpoint) {
        if (athletesWithTime.length === 0) return;

        // Calculate average time
        const avgTime = athletesWithTime.reduce((sum, a) => sum + a.checkpointTime, 0) / athletesWithTime.length;
        
        let score = null;
        let scoringAthletes = [];
        let displacers = [];
        let complete = false;

        if (this.isNCAA) {
            if (athletesWithTime.length >= 5) {
                scoringAthletes = athletesWithTime.slice(0, 5);
                score = scoringAthletes.reduce((sum, a) => sum + a.checkpointPosition, 0);
                displacers = athletesWithTime.slice(5, 7);
                complete = true;
            } else {
                scoringAthletes = athletesWithTime;
                score = athletesWithTime.reduce((sum, a) => sum + a.checkpointPosition, 0) + 
                    (5 - athletesWithTime.length) * 100;
                complete = false;
            }
        } else {
            scoringAthletes = athletesWithTime;
        }

        teamStats.push({
            country,
            score,
            avgPosition: athletesWithTime.reduce((sum, a) => sum + a.checkpointPosition, 0) / athletesWithTime.length,
            avgFinishTime: avgTime,
            scoringAthletes,
            displacers,
            allAthletes,
            finishers: athletesWithTime,
            complete,
            checkpoint
        });
    }

    addTeamStatsForFinish(teamStats, country, finishers, allAthletes) {
        // Standard finish calculation (existing logic)
        const avgPosition = finishers.reduce((sum, a) => sum + a.finalRank, 0) / finishers.length;
        const avgFinishTime = finishers.reduce((sum, a) => sum + a.actualTotalTime, 0) / finishers.length;
        
        let score = null;
        let scoringAthletes = [];
        let displacers = [];
        let complete = false;
        
        if (this.isNCAA) {
            if (finishers.length >= 5) {
                scoringAthletes = finishers.slice(0, 5);
                score = scoringAthletes.reduce((sum, a) => sum + a.finalRank, 0);
                displacers = finishers.slice(5, 7);
                complete = true;
            } else {
                scoringAthletes = finishers;
                score = finishers.reduce((sum, a) => sum + a.finalRank, 0) + 
                    (5 - finishers.length) * 100;
                complete = false;
            }
        } else {
            scoringAthletes = finishers;
        }
        
        // Calculate averages only for finish
        const avgSwimPace = scoringAthletes.reduce((sum, a) => 
            sum + (a.actualSwimTime / RaceConfig.distances.swim) * 100, 0) / scoringAthletes.length;
        const avgBikeSpeed = scoringAthletes.reduce((sum, a) => 
            sum + (RaceConfig.distances.bike / (a.actualBikeTime / 3600)), 0) / scoringAthletes.length;
        const avgRunPace = scoringAthletes.reduce((sum, a) => 
            sum + (a.actualRunTime / RaceConfig.distances.run / 60), 0) / scoringAthletes.length;
        
        teamStats.push({
            country,
            score,
            avgPosition,
            avgFinishTime,
            scoringAthletes,
            displacers,
            allAthletes,
            finishers,
            complete,
            avgSwimPace,
            avgBikeSpeed,
            avgRunPace,
            checkpoint: 'finish'
        });
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
            const positionDisplay = this.currentCheckpoint === 'finish' ? 
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
                                    const pos = this.currentCheckpoint === 'finish' ? a.finalRank : a.checkpointPosition;
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
        // Re-display with current checkpoint
        this.display();
    }
}