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
import { secondsToTime, secondsToMinSec, getFlag, getTeamIcon } from './utils/formatters.js';
import { TeamsDisplay } from './teams-display.js';

class TriathlonVisualizer {
    constructor() {
        this.rankChart = null;
        this.developmentChart = null;
        this.spiderChart = null;
        this.colorScale = null;
        this.currentTab = 'summary';
        this.teamsDisplay = new TeamsDisplay();

        this.init();
    }
    
    init() {
        this.setupFileUpload();
        this.setupTabNavigation();
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
                    if (this.currentTab === 'teams') {
                        this.teamsDisplay.refresh();
                    }
                    
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
        // Apply race config based on detected distance
        if (dataProcessor.raceDistance === 'sprint') {
            RaceConfig.applyPreset('sprint');
        } else {
            RaceConfig.applyPreset('olympic');
        }
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

        // Initialize teams display
        this.teamsDisplay.setData(data, this.colorScale, dataProcessor.isNCAA());

        
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
                    this.developmentChart.athleteVisibility = {...this.athleteVisibility};
                    this.developmentChart.countryVisibility = {...this.countryVisibility};
                    this.developmentChart.draw();
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
                this.teamsDisplay.display();
                break;                
                
            case 'settings':
                sidebarManager.hide();
                this.displaySettingsPage(); 
                break;
        }
    }

    displaySettingsPage() {
        const settingsContent = document.getElementById('settingsContent');
        if (!settingsContent) return;
        
        const html = `
            <div class="settings-group">
                <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">Race Type:</label>
                <select id="raceTypeSelect" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;">
                    <option value="standard">Standard Distance (1.5km / 40km / 10km)</option>
                    <option value="sprint">Sprint Distance (750m / 20km / 5km)</option>
                    <option value="olympic">Olympic Distance (1.5km / 40km / 10km)</option>
                    <option value="custom">Custom</option>
                </select>
            </div>
            
            <div class="settings-group">
                <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">
                    Swim Distance (meters):
                    <span id="swimDistanceValue" style="float: right; color: #667eea; font-weight: 700;">${RaceConfig.distances.swim}m</span>
                </label>
                <input type="range" id="swimDistance" value="${RaceConfig.distances.swim}" min="100" max="3800" step="50" 
                    style="width: 100%; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #999; margin-top: 4px;">
                    <span>100m</span>
                    <span>3800m</span>
                </div>
            </div>
            
            <div class="settings-group">
                <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">
                    Bike Distance (km):
                    <span id="bikeDistanceValue" style="float: right; color: #667eea; font-weight: 700;">${RaceConfig.distances.bike}km</span>
                </label>
                <input type="range" id="bikeDistance" value="${RaceConfig.distances.bike}" min="5" max="180" step="1" 
                    style="width: 100%; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #999; margin-top: 4px;">
                    <span>5km</span>
                    <span>180km</span>
                </div>
            </div>
            
            <div class="settings-group">
                <label style="display: block; font-weight: 600; margin-bottom: 8px; font-size: 14px;">
                    Run Distance (km):
                    <span id="runDistanceValue" style="float: right; color: #667eea; font-weight: 700;">${RaceConfig.distances.run}km</span>
                </label>
                <input type="range" id="runDistance" value="${RaceConfig.distances.run}" min="1" max="42.2" step="0.1" 
                    style="width: 100%; cursor: pointer;">
                <div style="display: flex; justify-content: space-between; font-size: 11px; color: #999; margin-top: 4px;">
                    <span>1km</span>
                    <span>42.2km</span>
                </div>
            </div>
            
            <button class="btn" id="saveRaceConfig" style="width: 100%; padding: 12px; font-size: 16px;">
                💾 Save Configuration
            </button>
            
            <div class="country-info-box" style="margin-top: var(--spacing-lg);">
                <p style="margin: 0; font-size: 13px;">
                    <strong>Note:</strong> Changing these distances will update pace and speed calculations throughout the application.
                </p>
            </div>
        `;
        
        settingsContent.innerHTML = html;
        
        // Setup event listeners
        const raceTypeSelect = document.getElementById('raceTypeSelect');
        const swimInput = document.getElementById('swimDistance');
        const bikeInput = document.getElementById('bikeDistance');
        const runInput = document.getElementById('runDistance');
        const saveButton = document.getElementById('saveRaceConfig');
        
        // Update value displays
        swimInput?.addEventListener('input', (e) => {
            document.getElementById('swimDistanceValue').textContent = e.target.value + 'm';
        });
        
        bikeInput?.addEventListener('input', (e) => {
            document.getElementById('bikeDistanceValue').textContent = e.target.value + 'km';
        });
        
        runInput?.addEventListener('input', (e) => {
            document.getElementById('runDistanceValue').textContent = e.target.value + 'km';
        });
        
        // Handle preset selection
        raceTypeSelect?.addEventListener('change', (e) => {
            const type = e.target.value;
            if (type !== 'custom') {
                RaceConfig.applyPreset(type);
                swimInput.value = RaceConfig.distances.swim;
                bikeInput.value = RaceConfig.distances.bike;
                runInput.value = RaceConfig.distances.run;
                document.getElementById('swimDistanceValue').textContent = RaceConfig.distances.swim + 'm';
                document.getElementById('bikeDistanceValue').textContent = RaceConfig.distances.bike + 'km';
                document.getElementById('runDistanceValue').textContent = RaceConfig.distances.run + 'km';
            }
        });
        
        // Save configuration
        saveButton?.addEventListener('click', () => {
            RaceConfig.setDistances(
                parseFloat(swimInput.value),
                parseFloat(bikeInput.value),
                parseFloat(runInput.value)
            );
            
            // Show confirmation
            saveButton.textContent = '✓ Saved!';
            saveButton.style.background = '#28a745';
            
            setTimeout(() => {
                saveButton.textContent = '💾 Save Configuration';
                saveButton.style.background = '';
            }, 2000);
            
            // Refresh data displays
            if (this.processedData) {
                summaryDisplay.displayTopPerformances(this.processedData);
            }
            
            // Refresh spider chart if visible
            if (this.spiderChart && this.athleteVisibility) {
                this.spiderChart.redraw();
            }
        });
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
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TriathlonVisualizer();
});