import { ChartConfig } from './config/chart-config.js';
import { RaceConfig } from './config/race-config.js';
import { dataProcessor } from './data/data-processing.js';
import { RankChart } from './charts/rank-chart.js';
import { DevelopmentChart } from './charts/development-chart.js';
import { SpiderChart } from './charts/spider-chart.js';
import { sidebarManager } from './ui/sidebar.js';
import { summaryDisplay } from './ui/controls.js';
import { hypotheticalAnalysis } from './hypothetical.js';
import { responsiveManager } from './utils/responsive.js';
import { secondsToTime, secondsToMinSec } from './utils/formatters.js';

class TriathlonVisualizer {
    constructor() {
        this.rankChart = null;
        this.developmentChart = null;
        this.spiderChart = null;
        this.colorScale = null;
        this.currentTab = 'summary';
        
        this.init();
    }
    
    init() {
        this.setupFileUpload();
        this.setupTabNavigation();
        this.setupRaceConfigDialog();
        this.setupSidebarToggle();
    }
    
    setupFileUpload() {
        const fileInput = document.getElementById('csvFile');
        const fileLabel = document.getElementById('fileLabel');
        const fileName = document.getElementById('fileName');
        const uploadSection = document.getElementById('uploadSection');
        const loading = document.getElementById('loading');
        const resultsSection = document.getElementById('resultsSection');
        const errorMessage = document.getElementById('errorMessage');
        
        fileInput?.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (!file) return;
            
            fileName.textContent = `Selected: ${file.name}`;
            fileLabel.classList.add('has-file');
            fileLabel.textContent = '✓ File Selected';
            uploadSection.classList.add('has-data');
            loading.classList.add('active');
            
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result;
                    dataProcessor.parseCSV(text);
                    const processedData = dataProcessor.processRaceData(dataProcessor.rawData);
                    
                    loading.classList.remove('active');
                    resultsSection.style.display = 'block';
                    
                    this.initializeCharts(processedData);
                    
                } catch (error) {
                    console.error('Error processing file:', error);
                    errorMessage.textContent = 'Error processing file: ' + error.message;
                    errorMessage.style.display = 'block';
                    loading.classList.remove('active');
                }
            };
            
            reader.readAsText(file);
        });
    }
    
    initializeCharts(data) {
        // Create color scale
        this.colorScale = ChartConfig.createColorScale(data);
        
        // Initialize visibility states
        const athleteVisibility = {};
        const countryVisibility = {};
        const spiderVisibility = {};
        
        const countries = new Set();
        data.forEach(athlete => {
            athleteVisibility[athlete.name] = true;
            spiderVisibility[athlete.name] = athlete.finalRank && athlete.finalRank <= 5 && !['DNF', 'LAP', 'DSQ'].includes(athlete.status);
            countries.add(athlete.country);
        });
        
        countries.forEach(country => {
            countryVisibility[country] = true;
        });
        
        // Display summary
        summaryDisplay.displayAll(data);
        
        // Create charts
        this.rankChart = new RankChart('rankChart');
        this.rankChart.setData(data);
        this.rankChart.setColorScale(this.colorScale);
        
        this.developmentChart = new DevelopmentChart('developmentChart');
        this.developmentChart.setData(data);
        this.developmentChart.setColorScale(this.colorScale);
        this.developmentChart.setVisibility(athleteVisibility, countryVisibility);
        this.developmentChart.setSegmentLeaders(dataProcessor.segmentLeaders);
        this.developmentChart.onAthleteClick = (athlete, stage) => {
            hypotheticalAnalysis.open(athlete, stage, data);
        };
        
        this.spiderChart = new SpiderChart('spiderChart');
        this.spiderChart.setData(data);
        this.spiderChart.setColorScale(this.colorScale);
        this.spiderChart.setVisibility(spiderVisibility);
        
        // Draw initial chart (rank chart is shown by default after switching to rank tab)
        this.rankChart.draw();
        
        // Store references for later use
        this.athleteVisibility = athleteVisibility;
        this.countryVisibility = countryVisibility;
        this.spiderVisibility = spiderVisibility;
        this.processedData = data;
    }
    
    setupTabNavigation() {
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabNav = document.querySelector('.tab-navigation');
        
        // Track scrolling state to prevent accidental clicks
        let isScrolling = false;
        let scrollTimeout = null;
        let touchStartY = 0;
        let touchStartX = 0;
        
        // Detect scroll start
        if (tabNav) {
            tabNav.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
                touchStartX = e.touches[0].clientX;
            }, { passive: true });
            
            tabNav.addEventListener('touchmove', (e) => {
                const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
                const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
                
                // If moved more than threshold, consider it scrolling
                if (deltaY > 10 || deltaX > 10) {
                    isScrolling = true;
                }
            }, { passive: true });
            
            tabNav.addEventListener('touchend', () => {
                // Reset after a short delay
                scrollTimeout = setTimeout(() => {
                    isScrolling = false;
                }, 100);
            }, { passive: true });
        }
        
        // Also track page scroll
        window.addEventListener('scroll', () => {
            isScrolling = true;
            if (scrollTimeout) clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                isScrolling = false;
            }, 150);
        }, { passive: true });
        
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Prevent click if user was scrolling
                if (isScrolling) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                
                const tab = btn.dataset.tab;
                if (!tab) return;
                
                // Update button states
                tabButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Update sections
                document.querySelectorAll('.chart-section').forEach(section => {
                    section.classList.remove('active');
                });
                document.getElementById(tab + 'Section')?.classList.add('active');
                
                // Handle sidebar and chart drawing
                this.handleTabChange(tab);
            });
            
            // Prevent ghost clicks on mobile
            btn.addEventListener('touchend', (e) => {
                if (isScrolling) {
                    e.preventDefault();
                }
            });
        });
    }
    
    handleTabChange(tab) {
        this.currentTab = tab;
        const wasOpen = sidebarManager.isOpen;
        
        switch(tab) {
            case 'summary':
                sidebarManager.hide();
                break;
                
            case 'rank':
                sidebarManager.hide();
                setTimeout(() => {
                    if (this.rankChart) {
                        this.rankChart.redraw();
                    }
                }, wasOpen ? 350 : 50);
                break;
                
            case 'development':
                sidebarManager.show();
                if (this.developmentChart) {
                    // CRITICAL: Set visibility BEFORE drawing
                    this.developmentChart.athleteVisibility = {...this.athleteVisibility};
                    this.developmentChart.countryVisibility = {...this.countryVisibility};
                    this.developmentChart.draw();
                    // Restore state is now called at end of draw()
                }
                this.populateDevelopmentSidebar();
                break;
                
            case 'spider':
                sidebarManager.show();
                if (this.spiderChart) {
                    this.spiderChart.athleteVisibility = {...this.spiderVisibility};
                    this.spiderChart.draw();
                }
                this.populateSpiderSidebar();
                break;
                
            case 'teams':
                sidebarManager.hide();
                this.displayTeamPerformances();
                break;
                
            case 'settings':
                sidebarManager.hide();
                this.openRaceConfigDialog();
                break;
        }
    }
    populateDevelopmentSidebar() {
        if (!this.processedData) return;
        
        // Sync the reference, don't copy
        this.athleteVisibility = this.developmentChart.athleteVisibility;
        this.countryVisibility = this.developmentChart.countryVisibility;
        
        sidebarManager.populateDevelopmentControls(this.processedData, {
            onSectionChange: (section) => {
                if (section === 'reset') {
                    this.developmentChart.resetZoom();
                } else {
                    this.developmentChart.showSection(section);
                }
            },
            onToggleAll: (show) => {
                this.developmentChart.showAllAthletes(show);
                // State is now maintained in the chart
                sidebarManager.resetAllButtonStates(show);
            },
            onToggleGroup: (group) => {
                this.toggleDevelopmentGroup(group);
            },
            onToggleAthlete: (name, index) => {
                this.developmentChart.toggleAthlete(name, index);
                sidebarManager.updateAthleteButtonState(name, this.developmentChart.athleteVisibility[name]);
            },
            onToggleCountry: (country) => {
                this.developmentChart.toggleCountry(country);
                this.processedData.forEach(athlete => {
                    if (athlete.country === country) {
                        sidebarManager.updateAthleteButtonState(athlete.name, this.developmentChart.athleteVisibility[athlete.name]);
                    }
                });
                sidebarManager.updateCountryButtonState(country, this.developmentChart.countryVisibility[country]);
            },
            athleteVisibility: this.developmentChart.athleteVisibility,
            colorScale: this.colorScale,
            currentSection: this.developmentChart.currentSection
        });
    }


    toggleDevelopmentGroup(group) {
        if (!this.processedData) return;
        
        this.processedData.forEach((athlete, index) => {
            let inGroup = false;
            if (group.special) {
                inGroup = ['DNF', 'DSQ', 'LAP'].includes(athlete.status);
            } else {
                const pos = athlete.finalRank || 999;
                inGroup = pos >= group.range[0] && pos <= group.range[1];
            }
            
            if (inGroup) {
                this.developmentChart.toggleAthlete(athlete.name, index);
                this.athleteVisibility[athlete.name] = this.developmentChart.athleteVisibility[athlete.name];
                sidebarManager.updateAthleteButtonState(athlete.name, this.athleteVisibility[athlete.name]);
            }
        });
    }    
    populateSpiderSidebar() {
        if (!this.processedData) return;
        
        sidebarManager.populateSpiderControls(this.processedData, {
            onToggleAll: (show) => {
                this.spiderChart.showAllAthletes(show);
                this.updateVisibilityState('spider', show);
            },
            onToggleGroup: (group) => {
                this.spiderChart.showGroup(group.range);
            },
            onToggleAthlete: (name) => {
                this.spiderChart.toggleAthlete(name);
            },
            onToggleCountry: (country) => {
                this.spiderChart.toggleCountry(country);
            },
            athleteVisibility: this.spiderVisibility,
            colorScale: this.colorScale
        });
    }
    
    toggleAthleteGroup(chartType, group) {
        if (!this.processedData) return;
        
        this.processedData.forEach((athlete, index) => {
            let inGroup = false;
            if (group.special) {
                inGroup = ['DNF', 'DSQ', 'LAP'].includes(athlete.status);
            } else {
                const pos = athlete.finalRank || 999;
                inGroup = pos >= group.range[0] && pos <= group.range[1];
            }
            
            if (inGroup) {
                if (chartType === 'development') {
                    this.developmentChart.toggleAthlete(athlete.name, index);
                    sidebarManager.updateAthleteButton(athlete.name, this.athleteVisibility[athlete.name]);
                } else if (chartType === 'spider') {
                    this.spiderChart.toggleAthlete(athlete.name);
                    sidebarManager.updateAthleteButton(athlete.name, this.spiderVisibility[athlete.name]);
                }
            }
        });
    }
    
    updateVisibilityState(chartType, show) {
        if (chartType === 'development') {
            Object.keys(this.athleteVisibility).forEach(key => {
                this.athleteVisibility[key] = show;
            });
            Object.keys(this.countryVisibility).forEach(key => {
                this.countryVisibility[key] = show;
            });
        } else if (chartType === 'spider') {
            Object.keys(this.spiderVisibility).forEach(key => {
                this.spiderVisibility[key] = show;
            });
        }
    }
    
    setupRaceConfigDialog() {
        const dialog = document.getElementById('raceConfigDialog');
        if (!dialog) return;
        
        dialog.innerHTML = RaceConfig.createDialogHTML();
        
        document.getElementById('closeRaceConfig')?.addEventListener('click', () => {
            dialog.style.display = 'none';
        });
        
        document.getElementById('raceTypeSelect')?.addEventListener('change', (e) => {
            const type = e.target.value;
            if (type !== 'custom') {
                RaceConfig.applyPreset(type);
                document.getElementById('swimDistance').value = RaceConfig.distances.swim;
                document.getElementById('bikeDistance').value = RaceConfig.distances.bike;
                document.getElementById('runDistance').value = RaceConfig.distances.run;
            }
        });
        
        document.getElementById('saveRaceConfig')?.addEventListener('click', () => {
            RaceConfig.setDistances(
                parseFloat(document.getElementById('swimDistance').value),
                parseFloat(document.getElementById('bikeDistance').value),
                parseFloat(document.getElementById('runDistance').value)
            );
            dialog.style.display = 'none';

            if (this.processedData) {
                summaryDisplay.displayTopPerformances(this.processedData);
            }
            
            // Refresh spider chart if active
            if (this.currentTab === 'spider' && this.spiderChart) {
                this.spiderChart.redraw();
            }
        });
    }
    
    openRaceConfigDialog() {
        const dialog = document.getElementById('raceConfigDialog');
        if (dialog) {
            document.getElementById('swimDistance').value = RaceConfig.distances.swim;
            document.getElementById('bikeDistance').value = RaceConfig.distances.bike;
            document.getElementById('runDistance').value = RaceConfig.distances.run;
            dialog.style.display = 'flex';
        }
    }
    
    setupSidebarToggle() {
        const toggle = document.getElementById('sidebarToggle');
        toggle?.addEventListener('click', () => {
            sidebarManager.toggleSidebar();
            
            // Redraw current chart after sidebar animation
            if (!responsiveManager.isMobile) {
                setTimeout(() => {
                    if (this.currentTab === 'rank' && this.rankChart) {
                        this.rankChart.redraw();
                    } else if (this.currentTab === 'development' && this.developmentChart) {
                        this.developmentChart.update();
                    }
                }, 350);
            }
        });
    }
    displayTeamPerformances() {
        if (!this.processedData) return;
        
        const teamsContent = document.getElementById('teamsContent'); 
        if (!teamsContent) return;
        
        // Group athletes by country
        const teams = {};
        this.processedData.forEach(athlete => {
            if (!teams[athlete.country]) {
                teams[athlete.country] = [];
            }
            teams[athlete.country].push(athlete);
        });
        
        // Calculate team scores (top 5 score, next 2 displace)
        const teamScores = [];
        Object.keys(teams).forEach(country => {
            const athletes = teams[country];
            const finishers = athletes
                .filter(a => a.finalRank)
                .sort((a, b) => a.finalRank - b.finalRank);
            
            if (finishers.length >= 5) {
                const scoringAthletes = finishers.slice(0, 5);
                const score = scoringAthletes.reduce((sum, a) => sum + a.finalRank, 0);
                const displacers = finishers.slice(5, 7);
                
                // Calculate team averages for scoring athletes
                const avgSwimPace = scoringAthletes.reduce((sum, a) => sum + (a.actualSwimTime / RaceConfig.distances.swim) * 100, 0) / 5;
                const avgBikeSpeed = scoringAthletes.reduce((sum, a) => sum + (RaceConfig.distances.bike / (a.actualBikeTime / 3600)), 0) / 5;
                const avgRunPace = scoringAthletes.reduce((sum, a) => sum + (a.actualRunTime / RaceConfig.distances.run / 60), 0) / 5;
                
                teamScores.push({
                    country,
                    score,
                    scoringAthletes,
                    displacers,
                    allAthletes: athletes,
                    complete: true,
                    avgSwimPace,
                    avgBikeSpeed,
                    avgRunPace
                });
            } else if (finishers.length > 0) {
                const score = finishers.reduce((sum, a) => sum + a.finalRank, 0) + 
                            (5 - finishers.length) * 100;
                
                const avgSwimPace = finishers.reduce((sum, a) => sum + (a.actualSwimTime / RaceConfig.distances.swim) * 100, 0) / finishers.length;
                const avgBikeSpeed = finishers.reduce((sum, a) => sum + (RaceConfig.distances.bike / (a.actualBikeTime / 3600)), 0) / finishers.length;
                const avgRunPace = finishers.reduce((sum, a) => sum + (a.actualRunTime / RaceConfig.distances.run / 60), 0) / finishers.length;
                
                teamScores.push({
                    country,
                    score,
                    scoringAthletes: finishers,
                    displacers: [],
                    allAthletes: athletes,
                    complete: false,
                    avgSwimPace,
                    avgBikeSpeed,
                    avgRunPace
                });
            }
        });
        
        // Sort by score (lower is better)
        teamScores.sort((a, b) => a.score - b.score);
        
        // Get team color
        const getTeamColor = (country) => {
            const teamAthlete = this.processedData.find(a => a.country === country);
            return teamAthlete ? this.colorScale(teamAthlete.name) : '#666';
        };
        
        let html = '<div class="team-rankings">';
        
        const medals = ['🥇', '🥈', '🥉'];
        const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
        
        teamScores.forEach((team, index) => {
            const flag = this.getFlag(team.country);
            const medal = index < 3 ? medals[index] : `${index + 1}.`;
            const borderColor = index < 3 ? podiumColors[index] : '#ddd';
            const teamColor = getTeamColor(team.country);
            
            // Format averages
            const avgSwimFormatted = secondsToTime(team.avgSwimPace) + '/100m';
            const avgBikeFormatted = team.avgBikeSpeed.toFixed(1) + ' km/h';
            const avgRunMins = Math.floor(team.avgRunPace);
            const avgRunSecs = Math.round((team.avgRunPace % 1) * 60);
            const avgRunFormatted = `${avgRunMins}:${avgRunSecs.toString().padStart(2, '0')}/km`;
            
            html += `
                <div class="team-row ${index < 3 ? 'podium' : ''}" style="border-left: 4px solid ${borderColor};">
                    <div class="team-summary" onclick="this.parentElement.classList.toggle('expanded')">
                        <div class="team-rank">${medal}</div>
                        <div class="team-info">
                            <span class="team-name" style="color: ${teamColor};">${flag} ${team.country}</span>
                            <span class="team-score">${team.score}${!team.complete ? '*' : ''} pts</span>
                        </div>
                        <div class="team-averages">
                            <span class="avg swim" title="Avg Swim Pace">🏊 ${avgSwimFormatted}</span>
                            <span class="avg bike" title="Avg Bike Speed">🚴 ${avgBikeFormatted}</span>
                            <span class="avg run" title="Avg Run Pace">🏃 ${avgRunFormatted}</span>
                        </div>
                        <div class="scoring-positions">
                            ${team.scoringAthletes.map(a => `<span class="pos scoring" style="background: ${teamColor};">#${a.finalRank}</span>`).join('')}
                            ${team.displacers.map(a => `<span class="pos displacer">#${a.finalRank}</span>`).join('')}
                        </div>
                        <div class="expand-icon">▼</div>
                    </div>
                    <div class="team-details">
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
                                ${team.scoringAthletes.map(athlete => this.createAthleteTableRow(athlete, true, teamColor)).join('')}
                                ${team.displacers.length > 0 ? `
                                    <tr class="divider-row"><td colspan="6">Displacers</td></tr>
                                    ${team.displacers.map(athlete => this.createAthleteTableRow(athlete, false, teamColor)).join('')}
                                ` : ''}
                            </tbody>
                        </table>
                        ${team.allAthletes.length > team.scoringAthletes.length + team.displacers.length ? `
                            <div class="other-athletes">
                                Other: ${team.allAthletes
                                    .filter(a => !team.scoringAthletes.includes(a) && !team.displacers.includes(a))
                                    .map(a => `${a.baseName} (${a.finalRank ? '#' + a.finalRank : a.status})`)
                                    .join(', ')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        if (teamScores.some(t => !t.complete)) {
            html += '<p class="scoring-note">* Team did not have 5 finishers. Penalty of 100 points per missing athlete applied.</p>';
        }
        
        html += `
            <div class="scoring-rules">
                <strong>Scoring:</strong> Sum of positions for top 5 finishers (lower is better). 
                Next 2 finishers are displacers. Averages based on scoring athletes only.
            </div>
        `;
        
        // Add styles
        html += `
            <style>
                .team-rankings {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                }
                .team-row {
                    background: white;
                    border-radius: 4px;
                    overflow: hidden;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
                }
                .team-row.podium {
                    background: linear-gradient(to right, #fffdf5, white);
                }
                .team-summary {
                    display: flex;
                    align-items: center;
                    padding: 10px 12px;
                    cursor: pointer;
                    user-select: none;
                    gap: 10px;
                    transition: background 0.2s;
                }
                .team-summary:hover {
                    background: rgba(0,0,0,0.03);
                }
                .team-rank {
                    font-size: 16px;
                    font-weight: 700;
                    min-width: 32px;
                    color: #333;
                }
                .team-info {
                    display: flex;
                    flex-direction: column;
                    min-width: 100px;
                }
                .team-name {
                    font-weight: 700;
                    font-size: 14px;
                }
                .team-score {
                    font-size: 12px;
                    color: #666;
                    font-weight: 500;
                }
                .team-averages {
                    display: flex;
                    gap: 8px;
                    font-size: 11px;
                    color: #555;
                }
                .avg {
                    background: #f5f5f5;
                    padding: 2px 6px;
                    border-radius: 3px;
                    white-space: nowrap;
                }
                .avg.swim { border-left: 2px solid #0891b2; }
                .avg.bike { border-left: 2px solid #059669; }
                .avg.run { border-left: 2px solid #dc2626; }
                .scoring-positions {
                    display: flex;
                    gap: 3px;
                    flex-wrap: wrap;
                    flex: 1;
                    justify-content: flex-end;
                }
                .pos {
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 10px;
                    font-weight: 600;
                }
                .pos.scoring {
                    color: white;
                }
                .pos.displacer {
                    background: #e0e0e0;
                    color: #666;
                }
                .expand-icon {
                    color: #999;
                    font-size: 10px;
                    transition: transform 0.3s ease;
                    margin-left: 4px;
                }
                .team-row.expanded .expand-icon {
                    transform: rotate(180deg);
                }
                .team-details {
                    display: none;
                    padding: 8px 12px 12px 12px;
                    background: #fafafa;
                    border-top: 1px solid #eee;
                }
                .team-row.expanded .team-details {
                    display: block;
                }
                .athletes-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 11px;
                }
                .athletes-table th {
                    text-align: left;
                    padding: 4px 8px;
                    font-weight: 600;
                    color: #666;
                    border-bottom: 1px solid #ddd;
                    font-size: 10px;
                    text-transform: uppercase;
                }
                .athletes-table td {
                    padding: 6px 8px;
                    border-bottom: 1px solid #eee;
                }
                .athletes-table tr:last-child td {
                    border-bottom: none;
                }
                .athletes-table .athlete-name-cell {
                    font-weight: 600;
                }
                .athletes-table .time-cell {
                    font-family: monospace;
                }
                .athletes-table .pace-cell {
                    font-size: 10px;
                    color: #888;
                }
                .athletes-table tr.displacer {
                    opacity: 0.7;
                    background: #f5f5f5;
                }
                .divider-row td {
                    font-size: 9px;
                    font-weight: 600;
                    color: #999;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    padding: 8px;
                    border-bottom: 1px dashed #ddd;
                    background: #f0f0f0;
                }
                .other-athletes {
                    margin-top: 8px;
                    font-size: 10px;
                    color: #888;
                    font-style: italic;
                }
                .scoring-note {
                    font-size: 11px;
                    color: #666;
                    margin-top: 12px;
                }
                .scoring-rules {
                    margin-top: 12px;
                    padding: 10px 14px;
                    background: #f8f9fa;
                    border-radius: 6px;
                    font-size: 11px;
                    color: #555;
                    border: 1px solid #e0e7ff;
                }
                
                @media (max-width: 768px) {
                    .team-averages {
                        display: none;
                    }
                    .athletes-table {
                        font-size: 10px;
                    }
                }
            </style>
        `;
        
        teamsContent.innerHTML = html;
    }

    createAthleteTableRow(athlete, isScoring, teamColor) {
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



    getFlag(countryCode) {
        const flags = {
            'AUS': '🇦🇺', 'ITA': '🇮🇹', 'HUN': '🇭🇺', 'JPN': '🇯🇵', 'ESP': '🇪🇸',
            'CZE': '🇨🇿', 'CHI': '🇨🇱', 'CHL': '🇨🇱', 'FRA': '🇫🇷', 'CAN': '🇨🇦', 
            'SUI': '🇨🇭', 'NED': '🇳🇱', 'GER': '🇩🇪', 'BEL': '🇧🇪', 'GBR': '🇬🇧', 
            'USA': '🇺🇸', 'NZL': '🇳🇿', 'AUT': '🇦🇹', 'POR': '🇵🇹', 'BRA': '🇧🇷', 
            'MEX': '🇲🇽', 'ARG': '🇦🇷', 'RSA': '🇿🇦', 'NOR': '🇳🇴', 'SWE': '🇸🇪', 
            'DEN': '🇩🇰'
        };
        return flags[countryCode] || '🏴';
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TriathlonVisualizer();
});