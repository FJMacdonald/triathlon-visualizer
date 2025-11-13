import { secondsToTime } from '../utils/formatters.js';
import { RaceConfig } from '../config/race-config.js';

export class TooltipManager {
    constructor() {
        this.tooltip = null;
        this.hideTimeout = null;
        this.init();
    }
    
    init() {
        this.tooltip = d3.select('#tooltip');
        if (this.tooltip.empty()) {
            this.tooltip = d3.select('body')
                .append('div')
                .attr('class', 'tooltip')
                .attr('id', 'tooltip');
        }
        
        // Add global touch handler to dismiss tooltip
        this.setupGlobalDismiss();
    }
    
    setupGlobalDismiss() {
        // Dismiss tooltip on any touch outside
        document.addEventListener('touchstart', (e) => {
            // Don't dismiss if touching the tooltip itself
            if (!e.target.closest('.tooltip')) {
                this.hide(0);
            }
        }, { passive: true });
        
        // Also dismiss on scroll
        document.addEventListener('scroll', () => {
            this.hide(0);
        }, { passive: true });
        
        // Dismiss on orientation change
        window.addEventListener('orientationchange', () => {
            this.hide(0);
        });
    }
    
    show(content, x, y, options = {}) {
        const { 
            offsetX = 10, 
            offsetY = -28,
            maxWidth = 250,
            preferLeft = false 
        } = options;
        
        // Clear any pending hide
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        
        // Get viewport dimensions
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const isMobile = viewportWidth <= 768;
        
        // On mobile, position tooltip more carefully
        let posX, posY;
        
        if (isMobile) {
            // On mobile, show tooltip at top of screen or bottom, centered
            const tooltipWidth = Math.min(maxWidth, viewportWidth - 20);
            posX = (viewportWidth - tooltipWidth) / 2;
            
            // Position at top if touch is in bottom half, otherwise at bottom
            if (y > viewportHeight / 2) {
                posY = 60; // Below any fixed header
            } else {
                posY = viewportHeight - 150; // Above bottom
            }
            
            this.tooltip.style('max-width', `${tooltipWidth}px`);
        } else {
            posX = x + offsetX;
            posY = y + offsetY;
            
            // Check if tooltip would go off screen
            if (preferLeft || (posX + maxWidth > viewportWidth)) {
                posX = x - maxWidth - offsetX;
            }
            
            // Ensure tooltip stays in viewport
            if (posX < 10) posX = 10;
            if (posY < 10) posY = 10;
            
            this.tooltip.style('max-width', `${maxWidth}px`);
        }
        
        this.tooltip
            .html(content)
            .style('left', `${posX}px`)
            .style('top', `${posY}px`)
            .style('position', 'fixed') // Use fixed positioning
            .transition()
            .duration(200)
            .style('opacity', 0.9);
        
        // Auto-hide on mobile after delay
        if (isMobile) {
            this.hideTimeout = setTimeout(() => this.hide(300), 4000);
        }
    }
    
    hide(delay = 500) {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
            this.hideTimeout = null;
        }
        
        this.tooltip
            .transition()
            .duration(delay)
            .style('opacity', 0);
    }
 
        
    stagePoint(athlete, stage, cumTime, timeBehindLeader) {
        const name = athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '');
        let content = `<strong>${name} (${athlete.country})</strong><br/>`;
        content += `<strong>Overall: ${athlete.finalRank || 'N/A'}</strong><br/>`;
        content += `<hr style="margin: 5px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.3);">`;
        
        const behindText = timeBehindLeader === 0 ? 'Leader' : '+' + secondsToTime(timeBehindLeader);
        
        switch(stage) {
            case 'Swim':
                if (athlete.actualSwimTime) {
                    const swimPace = RaceConfig.getSwimPace(athlete.actualSwimTime);
                    content += `<strong>End of Swim</strong><br/>`;
                    content += `Time: ${secondsToTime(athlete.actualSwimTime)}<br/>`;
                    content += `Pace: ${secondsToTime(swimPace)}/100m<br/>`;
                    content += `Segment Rank: ${athlete.swimSegmentRank}<br/>`;
                    content += `Behind Leader: ${behindText}`;
                }
                break;
                
            case 'T1':
                if (athlete.actualT1Time) {
                    content += `<strong>End of T1</strong><br/>`;
                    content += `Time: ${secondsToTime(athlete.actualT1Time)}<br/>`;
                    content += `Segment Rank: ${athlete.t1SegmentRank}<br/>`;
                    content += `Behind Leader: ${behindText}`;
                }
                break;
                
            case 'Bike':
                if (athlete.actualBikeTime) {
                    const bikeSpeed = RaceConfig.getBikeSpeed(athlete.actualBikeTime);
                    content += `<strong>End of Bike</strong><br/>`;
                    content += `Time: ${secondsToTime(athlete.actualBikeTime)}<br/>`;
                    content += `Speed: ${bikeSpeed.toFixed(1)} km/hr<br/>`;
                    content += `Segment Rank: ${athlete.bikeSegmentRank}<br/>`;
                    content += `Behind Leader: ${behindText}`;
                }
                break;
                
            case 'T2':
                if (athlete.actualT2Time) {
                    content += `<strong>End of T2</strong><br/>`;
                    content += `Time: ${secondsToTime(athlete.actualT2Time)}<br/>`;
                    content += `Segment Rank: ${athlete.t2SegmentRank}<br/>`;
                    content += `Behind Leader: ${behindText}`;
                }
                break;
                
            case 'Finish':
                if (athlete.actualRunTime) {
                    const runPace = RaceConfig.getRunPace(athlete.actualRunTime);
                    content += `<strong>End of Run (Finish)</strong><br/>`;
                    content += `Time: ${secondsToTime(athlete.actualRunTime)}<br/>`;
                    content += `Pace: ${Math.floor(runPace)}:${Math.round((runPace % 1) * 60).toString().padStart(2, '0')}/km<br/>`;
                    content += `Segment Rank: ${athlete.runSegmentRank}<br/>`;
                    content += `Behind Leader: ${behindText}`;
                }
                break;
        }
        
        const isMobile = window.innerWidth <= 768;
        if (!isMobile) {
            content += `<br/><br/><em style="font-size: 10px;">Long press for hypothetical analysis</em>`;
        }
        
        return content;
    }
    
    spiderAthlete(athlete) {
        const name = athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '');
        let content = `<strong>${name} ${athlete.country}</strong><br/>`;
        
        if (athlete.actualSwimTime) {
            const swimPace = RaceConfig.getSwimPace(athlete.actualSwimTime);
            content += `Swim: ${secondsToTime(athlete.actualSwimTime)} (${secondsToTime(swimPace)}/100m) - Rank ${athlete.swimSegmentRank || 'N/A'}<br/>`;
        }
        if (athlete.actualT1Time) {
            content += `T1: ${secondsToTime(athlete.actualT1Time)} (${athlete.t1SegmentRank || 'N/A'})<br/>`;
        }
        if (athlete.actualBikeTime) {
            const bikeSpeed = RaceConfig.getBikeSpeed(athlete.actualBikeTime);
            content += `Bike: ${secondsToTime(athlete.actualBikeTime)} (${bikeSpeed.toFixed(1)} km/hr) - Rank ${athlete.bikeSegmentRank || 'N/A'}<br/>`;
        } else if (['DNF', 'LAP'].includes(athlete.status)) {
            content += `Bike: DNF<br/>`;
        }
        if (athlete.actualT2Time) {
            content += `T2: ${secondsToTime(athlete.actualT2Time)} (${athlete.t2SegmentRank || 'N/A'})<br/>`;
        }
        if (athlete.actualRunTime) {
            const runPace = RaceConfig.getRunPace(athlete.actualRunTime);
            const paceStr = `${Math.floor(runPace)}:${Math.round((runPace % 1) * 60).toString().padStart(2, '0')}`;
            content += `Run: ${secondsToTime(athlete.actualRunTime)} (${paceStr}/km) - Rank ${athlete.runSegmentRank || 'N/A'}<br/>`;
        } else if (['DNF', 'LAP'].includes(athlete.status) && athlete.actualBikeTime) {
            content += `Run: DNF<br/>`;
        }
        
        content += `<hr style="margin: 5px 0; border: 0; border-top: 1px solid rgba(255,255,255,0.3);">`;
        
        if (athlete.status && !['OK', ''].includes(athlete.status)) {
            content += `Status: ${athlete.status}`;
        } else {
            const totalTime = athlete.actualTotalTime || 0;
            content += `Total: ${secondsToTime(totalTime)} (${athlete.position || athlete.finalRank})`;
        }
        
        return content;
    }
}

export const tooltipManager = new TooltipManager();