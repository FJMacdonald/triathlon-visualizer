import { secondsToMinSec } from '../utils/formatters.js';
import { RaceConfig } from '../config/race-config.js';

export class SummaryDisplay {
    constructor() {
        this.finishersContainer = document.getElementById('finishersData');
        this.performancesContainer = document.getElementById('topPerformances');
    }
    
    displayAll(data) {
        this.displayFinishers(data);
        this.displayTopPerformances(data);
    }
    

    
    displayFinishers(data) {
        if (!this.finishersContainer) return;
        
        const finishers = data.filter(a => !['DNF', 'DSQ', 'LAP', 'DNS'].includes(a.status));
        const starters = data.filter(a => a.status !== 'DNS');
        const avgSwim = d3.mean(finishers, d => d.actualSwimTime || 0);
        const avgBike = d3.mean(finishers, d => d.actualBikeTime || 0);
        const avgRun = d3.mean(finishers, d => d.actualRunTime || 0);
        
        const html = `
            <div class="stat-item">
                <div class="stat-value">${finishers.length}/${starters.length}</div>
                <div class="stat-label">Finishers/Starters</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${secondsToMinSec(avgSwim)}</div>
                <div class="stat-label">Avg Swim</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${secondsToMinSec(avgBike)}</div>
                <div class="stat-label">Avg Bike</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${secondsToMinSec(avgRun)}</div>
                <div class="stat-label">Avg Run</div>
            </div>
        `;
        
        this.finishersContainer.innerHTML = html;
    }
    
    displayTopPerformances(data) {
        if (!this.performancesContainer) return;
        
        const finishers = data.filter(a => !['DNF', 'DSQ', 'LAP', 'DNS'].includes(a.status));
        
        let html = '<h2 style="margin-bottom: 20px;">Top 3 Performances</h2>';
        
        // Overall top 3
        const top3Overall = finishers
            .sort((a, b) => (a.finalRank || 999) - (b.finalRank || 999))
            .slice(0, 3);
        
        html += this.createPerformanceSection('🏆 Overall', top3Overall, athlete => {
            return secondsToTime(athlete.actualTotalTime || 0);
        });

        // Segment leaders with pace info using RaceConfig
        const segments = [
            { 
                name: 'Swim', 
                key: 'actualSwimTime', 
                icon: '🏊',
                paceFormatter: (athlete) => {
                    const pace = (athlete.actualSwimTime / RaceConfig.distances.swim) * 100; // per 100m
                    return `Pace: ${secondsToTime(pace)}/100m`;
                }
            },
            { 
                name: 'Bike', 
                key: 'actualBikeTime', 
                icon: '🚴',
                paceFormatter: (athlete) => {
                    const speed = (RaceConfig.distances.bike / (athlete.actualBikeTime / 3600)).toFixed(1);
                    return `Speed: ${speed} km/hr`;
                }
            },
            { 
                name: 'Run', 
                key: 'actualRunTime', 
                icon: '🏃',
                paceFormatter: (athlete) => {
                    const pace = athlete.actualRunTime / RaceConfig.distances.run / 60; // min/km
                    const mins = Math.floor(pace);
                    const secs = Math.round((pace % 1) * 60);
                    return `Pace: ${mins}:${secs.toString().padStart(2, '0')}/km`;
                }
            }
        ];
        
        segments.forEach(segment => {
            const validAthletes = finishers.filter(a => a[segment.key] && a[segment.key] > 0);
            const top3 = validAthletes
                .sort((a, b) => a[segment.key] - b[segment.key])
                .slice(0, 3);
            
            html += this.createPerformanceSectionWithPace(
                `${segment.icon} Best ${segment.name} Times`,
                top3,
                athlete => secondsToMinSec(athlete[segment.key]),
                segment.paceFormatter
            );
        });
        
        this.performancesContainer.innerHTML = html;
    }
    // Add new method:
    createPerformanceSectionWithPace(title, athletes, timeFormatter, paceFormatter) {
        let html = '<div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px;">';
        html += `<h3 style="color: #667eea; margin-bottom: 10px;">${title}</h3>`;
        
        athletes.forEach((athlete, i) => {
            html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: white; border-radius: 5px; margin-bottom: 5px;">
                <div>
                    <div><strong>${i + 1}.</strong> ${athlete.baseName} (${athlete.country})</div>
                    <div class="pace-info">${paceFormatter(athlete)}</div>
                </div>
                <strong>${timeFormatter(athlete)}</strong>
            </div>`;
        });
        
        html += '</div>';
        return html;
    }
    createPerformanceSection(title, athletes, timeFormatter) {
        let html = '<div style="background: #f8f9fa; padding: 15px; border-radius: 10px; margin-bottom: 20px;">';
        html += `<h3 style="color: #667eea; margin-bottom: 10px;">${title}</h3>`;
        
        athletes.forEach((athlete, i) => {
            html += `<div style="display: flex; justify-content: space-between; padding: 8px; background: white; border-radius: 5px; margin-bottom: 5px;">
                <span><strong>${i + 1}.</strong> ${athlete.baseName} (${athlete.country})</span>
                <strong>${timeFormatter(athlete)}</strong>
            </div>`;
        });
        
        html += '</div>';
        return html;
    }
}



// Helper function (duplicated to avoid circular dependency)
function secondsToTime(seconds) {
    if (seconds === null || seconds === undefined) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export const summaryDisplay = new SummaryDisplay();