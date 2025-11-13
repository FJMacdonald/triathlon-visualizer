import { BaseChart } from './base-chart.js';
import { RaceConfig } from '../config/race-config.js';
import { responsiveManager } from '../utils/responsive.js';
import { secondsToTime } from '../utils/formatters.js';
import { tooltipManager } from '../ui/tooltips.js';

export class SpiderChart extends BaseChart {
    constructor(containerId) {
        super(containerId, 'spider');
        this.athleteVisibility = {};
        this.radarData = null;
        this.axes = [
            {axis: "Swim", key: "swimTime", rankKey: "swimSegmentRank"},
            {axis: "T1", key: "t1Time", rankKey: "t1SegmentRank"},
            {axis: "Bike", key: "bikeTime", rankKey: "bikeSegmentRank"},
            {axis: "T2", key: "t2Time", rankKey: "t2SegmentRank"},
            {axis: "Run", key: "runTime", rankKey: "runSegmentRank"}
        ];
    }
    
    setVisibility(athleteVisibility) {
        this.athleteVisibility = athleteVisibility;
    }
    
    draw() {
        if (!this.data || this.data.length === 0) return;
        
        this.clear();
        
        const container = document.getElementById(this.containerId);
        const isMobile = responsiveManager.isMobile || window.innerWidth < 768;
        
        // Setup container based on screen size
        if (isMobile) {
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.alignItems = 'center';
        } else {
            container.style.display = 'flex';
            container.style.flexDirection = 'row';
            container.style.alignItems = 'flex-start';
            container.style.gap = '20px';
        }
        
        // Create chart container
        const chartContainer = document.createElement('div');
        chartContainer.id = `${this.containerId}-chart`;
        chartContainer.style.flex = isMobile ? '1' : '0 0 50%';
        chartContainer.style.display = 'flex';
        chartContainer.style.justifyContent = 'center';
        chartContainer.style.alignItems = 'center';
        chartContainer.style.minHeight = isMobile ? '300px' : '400px';
        container.appendChild(chartContainer);
        
        // Create table container
        const tableContainer = document.createElement('div');
        tableContainer.id = `${this.containerId}-table`;
        tableContainer.style.flex = isMobile ? '1' : '0 0 50%';
        tableContainer.style.overflowX = 'auto';
        tableContainer.style.marginTop = isMobile ? '20px' : '0';
        tableContainer.style.maxHeight = isMobile ? '400px' : '500px'; // Increase height on mobile
        tableContainer.style.overflowY = 'auto';
        tableContainer.style.width = '100%';
        tableContainer.style.webkitOverflowScrolling = 'touch'; // Enable momentum scrolling
        tableContainer.style.touchAction = 'pan-x pan-y'; // Allow both directions
        container.appendChild(tableContainer);

        requestAnimationFrame(() => {
            if (isMobile) {
                // Set explicit height for table container based on available space
                const chartRect = chartContainer.getBoundingClientRect();
                const viewportHeight = window.innerHeight;
                const availableHeight = viewportHeight - chartRect.bottom - 100; // Leave some margin
                
                if (availableHeight > 200) {
                    tableContainer.style.maxHeight = `${Math.min(availableHeight, 400)}px`;
                }
            }
        });
        const { svg, g, width, height, margin } = this.createSVGInContainer(chartContainer);
        const radius = Math.min(width, height) / 2;
        
        // Center the chart
        g.attr("transform", `translate(${(width + margin.left + margin.right)/2},${(height + margin.top + margin.bottom)/2})`);
        
        // Calculate percentiles for normalization
        const percentiles = this.calculatePercentiles();
        
        // Setup scales
        const rScale = d3.scaleLinear()
            .domain([0, 1.2])
            .range([0, radius * 1.2]);
        
        const angleSlice = Math.PI * 2 / this.axes.length;
        
        // Draw background
        this.drawBackground(g, radius, rScale, angleSlice);
        
        // Process radar data
        this.processRadarData(percentiles);
        
        // Draw athlete areas
        this.drawAthleteAreas(g, rScale, angleSlice);
        
        // Draw comparison table
        this.drawComparisonTable(tableContainer);
    }
    
    createSVGInContainer(container) {
        const { width: containerWidth, height: containerHeight } = container.getBoundingClientRect();
        const isMobile = responsiveManager.isMobile || window.innerWidth < 768;
        
        const margin = { top: 50, right: 50, bottom: 50, left: 50 };
        const spiderSize = isMobile ? 300 : 400;
        const width = Math.min(containerWidth || spiderSize, spiderSize) - margin.left - margin.right;
        const height = Math.min(spiderSize, containerHeight || spiderSize) - margin.top - margin.bottom;
        
        const svg = d3.select(container)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);
        
        const g = svg.append("g");
        
        this.svg = svg;
        this.g = g;
        this.width = width;
        this.height = height;
        this.margin = margin;
        
        return { svg, g, width, height, margin };
    }
    
    calculatePercentiles() {
        const percentiles = {};
        
        this.axes.forEach(ax => {
            const actualKey = ax.key.replace('Time', 'Time')
                .replace('swim', 'actualSwim')
                .replace('t1', 'actualT1')
                .replace('bike', 'actualBike')
                .replace('t2', 'actualT2')
                .replace('run', 'actualRun');
            
            const values = this.data
                .filter(d => {
                    if (d.status === 'DSQ') return false;
                    const val = actualKey.includes('actual') ? d[actualKey] : d[ax.key];
                    return val && val < 99 * 3600;
                })
                .map(d => actualKey.includes('actual') ? d[actualKey] : d[ax.key])
                .sort((a, b) => a - b);
            
            percentiles[ax.key] = {
                min: values[0] || 0,
                max: values[values.length - 1] || 1,
                best: values[0] || 0,
                worst: values[values.length - 1] || 1
            };
        });
        
        return percentiles;
    }
    
    drawBackground(g, radius, rScale, angleSlice) {
        // Draw concentric circles
        const levels = 5;
        for (let level = 0; level < levels; level++) {
            g.append("circle")
                .attr("r", radius * ((level + 1) / levels))
                .style("fill", "none")
                .style("stroke", "#CDCDCD")
                .style("stroke-opacity", 0.5);
        }
        
        // Draw axis lines and labels
        const axis = g.selectAll(".axis")
            .data(this.axes)
            .enter()
            .append("g")
            .attr("class", "axis");
        
        axis.append("line")
            .attr("x1", 0)
            .attr("y1", 0)
            .attr("x2", (d, i) => rScale(1) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("y2", (d, i) => rScale(1) * Math.sin(angleSlice * i - Math.PI / 2))
            .style("stroke", "#CDCDCD")
            .style("stroke-width", "1px");
        
        axis.append("text")
            .attr("class", "axis-label")
            .attr("dy", "0.35em")
            .attr("x", (d, i) => rScale(1.15) * Math.cos(angleSlice * i - Math.PI / 2))
            .attr("y", (d, i) => rScale(1.15) * Math.sin(angleSlice * i - Math.PI / 2))
            .style("text-anchor", "middle")
            .text(d => d.axis);
    }
    
    processRadarData(percentiles) {
        this.radarData = this.data.map(athlete => {
            return {
                athlete: athlete,
                values: this.axes.map(ax => {
                    let actualValue;
                    if (ax.key === 'swimTime') actualValue = athlete.actualSwimTime;
                    else if (ax.key === 't1Time') actualValue = athlete.actualT1Time;
                    else if (ax.key === 'bikeTime') actualValue = athlete.actualBikeTime;
                    else if (ax.key === 't2Time') actualValue = athlete.actualT2Time;
                    else if (ax.key === 'runTime') actualValue = athlete.actualRunTime;
                    
                    if (!actualValue || actualValue >= 99 * 3600) {
                        return {
                            axis: ax.axis,
                            value: 0,
                            rank: null,
                            incomplete: true
                        };
                    }
                    
                    const normalized = 1 - (actualValue - percentiles[ax.key].best) / 
                                          (percentiles[ax.key].worst - percentiles[ax.key].best);
                    return {
                        axis: ax.axis,
                        value: normalized,
                        rank: athlete[ax.rankKey],
                        incomplete: false
                    };
                })
            };
        });
    }
    
    drawAthleteAreas(g, rScale, angleSlice) {
        const radarLine = d3.lineRadial()
            .radius(d => rScale(d.value))
            .angle((d, i) => i * angleSlice)
            .curve(d3.curveLinearClosed);
        
        this.data.forEach((athlete, athleteIndex) => {
            const athleteData = this.radarData[athleteIndex].values;
            const hasData = athleteData.some(d => !d.incomplete);
            
            if (!hasData) return;
            
            const isVisible = this.athleteVisibility[athlete.name] === true;
            const strokeDasharray = this.getStrokeDasharray(athlete.status);
            
            const pathData = athleteData.map(d => d.incomplete ? { value: 0 } : d);
            
            // Draw area
            const area = g.append("path")
                .datum(pathData)
                .attr("class", `radar-area radar-area-${athleteIndex}`)
                .attr("d", radarLine)
                .style("fill", this.colorScale(athlete.name))
                .style("stroke", this.colorScale(athlete.name))
                .style("stroke-dasharray", strokeDasharray)
                .classed("hidden", !isVisible);
            
            // Add hover events with percentile tooltip
            area.on("mouseover", (event) => {
                if (!this.athleteVisibility[athlete.name]) return;
                
                d3.select(event.target)
                    .style("fill-opacity", 0.4)
                    .style("stroke-width", 3);
                
                // Show percentile tooltip
                const content = this.createPercentileTooltip(athlete, athleteData);
                tooltipManager.show(content, event.pageX, event.pageY);
            })
            .on("mouseout", (event) => {
                if (!this.athleteVisibility[athlete.name]) return;
                
                d3.select(event.target)
                    .style("fill-opacity", 0.2)
                    .style("stroke-width", 2);
                
                tooltipManager.hide();
            });
            
            // Touch events for mobile
            let touchTimeout;
            let touchStartX, touchStartY;
            let touchMoved = false;
            area.on("touchstart", (event) => {
                if (!this.athleteVisibility[athlete.name]) return;
                
                // Store initial touch position
                touchStartX = event.touches[0].clientX;
                touchStartY = event.touches[0].clientY;
                touchMoved = false;
            })
            .on("touchmove", (event) => {
                // Check if user is scrolling
                const touch = event.touches[0];
                const deltaX = Math.abs(touch.clientX - touchStartX);
                const deltaY = Math.abs(touch.clientY - touchStartY);
                
                if (deltaX > 10 || deltaY > 10) {
                    touchMoved = true;
                    tooltipManager.hide();
                }
            })
            .on("touchend", (event) => {
                if (!this.athleteVisibility[athlete.name] || touchMoved) return;
                
                event.preventDefault(); // Prevent click event
                
                d3.select(event.target)
                    .style("fill-opacity", 0.4)
                    .style("stroke-width", 3);
                
                // Use touch position from the target element instead
                const rect = event.target.getBoundingClientRect();
                const x = rect.left + rect.width / 2 + window.scrollX;
                const y = rect.top + window.scrollY;
                
                const content = this.createPercentileTooltip(athlete, athleteData);
                tooltipManager.show(content, x, y);
                
                // Auto-hide after delay
                touchTimeout = setTimeout(() => {
                    d3.select(event.target)
                        .style("fill-opacity", 0.2)
                        .style("stroke-width", 2);
                    tooltipManager.hide();
                }, 3000);
            });            // Draw dots at vertices
            g.selectAll(`.radar-dots-${athleteIndex}`)
                .data(athleteData.filter(d => !d.incomplete))
                .enter()
                .append("circle")
                .attr("class", `radar-dots radar-dots-${athleteIndex}`)
                .attr("cx", (d, i) => {
                    const actualIndex = this.axes.findIndex(ax => ax.axis === d.axis);
                    return rScale(d.value) * Math.cos(angleSlice * actualIndex - Math.PI / 2);
                })
                .attr("cy", (d, i) => {
                    const actualIndex = this.axes.findIndex(ax => ax.axis === d.axis);
                    return rScale(d.value) * Math.sin(angleSlice * actualIndex - Math.PI / 2);
                })
                .attr("r", 4)
                .style("fill", this.colorScale(athlete.name))
                .classed("hidden", !isVisible);
        });
    }

    createPercentileTooltip(athlete, athleteData) {
        const name = athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '');
        const totalAthletes = this.data.filter(a => !['DNS', 'DSQ'].includes(a.status)).length;
        
        let html = `<div style="font-size: 12px;">`;
        html += `<div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">${name} (${athlete.country})</div>`;
        html += `<div style="margin-bottom: 6px;">Overall: #${athlete.finalRank || 'N/A'}</div>`;
        html += `<table style="width: 100%; border-collapse: collapse;">`;
        html += `<tr style="font-size: 10px; opacity: 0.8;">`;
        html += `<th style="text-align: left; padding: 2px;">Segment</th>`;
        html += `<th style="text-align: right; padding: 2px;">Rank</th>`;
        html += `<th style="text-align: right; padding: 2px;">Percentile</th>`;
        html += `</tr>`;
        
        athleteData.forEach(d => {
            if (d.incomplete) return;
            
            const percentile = Math.round((1 - (d.rank - 1) / totalAthletes) * 100);
            const percentileColor = percentile >= 80 ? '#4ade80' : 
                                    percentile >= 60 ? '#fbbf24' : 
                                    percentile >= 40 ? '#fb923c' : '#f87171';
            
            html += `<tr>`;
            html += `<td style="padding: 3px;">${d.axis}</td>`;
            html += `<td style="text-align: right; padding: 3px;">#${d.rank}</td>`;
            html += `<td style="text-align: right; padding: 3px; color: ${percentileColor}; font-weight: bold;">Top ${100 - percentile}%</td>`;
            html += `</tr>`;
        });
        
        html += `</table>`;
        html += `</div>`;
        
        return html;
    }
    
    drawComparisonTable(container) {
        // Get visible athletes
        const visibleAthletes = this.data.filter(a => this.athleteVisibility[a.name] === true);
        
        if (visibleAthletes.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">Select athletes to compare their times and paces</p>';
            return;
        }
        
        // Create table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.fontSize = '13px';
        
        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Athlete name header
        const nameHeader = document.createElement('th');
        nameHeader.textContent = 'Athlete';
        nameHeader.style.cssText = 'padding: 10px 8px; border: 1px solid #ddd; background: #f5f5f5; text-align: left; position: sticky; top: 0; z-index: 10;';
        headerRow.appendChild(nameHeader);
        
        // Segment headers
        this.axes.forEach(ax => {
            const header = document.createElement('th');
            header.textContent = ax.axis;
            header.style.cssText = 'padding: 10px 8px; border: 1px solid #ddd; background: #f5f5f5; text-align: center; position: sticky; top: 0; z-index: 10;';
            headerRow.appendChild(header);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Create body
        const tbody = document.createElement('tbody');
        
        visibleAthletes.forEach(athlete => {
            const row = document.createElement('tr');
            
            // Athlete name with color indicator
            const nameCell = document.createElement('td');
            nameCell.style.cssText = 'padding: 8px; border: 1px solid #ddd; white-space: nowrap;';
            
            const colorDot = document.createElement('span');
            colorDot.style.cssText = `display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: ${this.colorScale(athlete.name)}; margin-right: 6px; vertical-align: middle;`;
            nameCell.appendChild(colorDot);
            
            const nameText = document.createElement('span');
            nameText.textContent = `${athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '')}`;
            nameText.style.verticalAlign = 'middle';
            nameCell.appendChild(nameText);
            
            const countryText = document.createElement('div');
            countryText.textContent = athlete.country;
            countryText.style.cssText = 'font-size: 11px; color: #666; margin-left: 16px;';
            nameCell.appendChild(countryText);
            
            row.appendChild(nameCell);
            
            // times (clickable to show pace)
            this.axes.forEach(ax => {
                const cell = document.createElement('td');
                cell.style.cssText = 'padding: 8px; border: 1px solid #ddd; text-align: center;';
                
                let actualValue;
                if (ax.key === 'swimTime') actualValue = athlete.actualSwimTime;
                else if (ax.key === 't1Time') actualValue = athlete.actualT1Time;
                else if (ax.key === 'bikeTime') actualValue = athlete.actualBikeTime;
                else if (ax.key === 't2Time') actualValue = athlete.actualT2Time;
                else if (ax.key === 'runTime') actualValue = athlete.actualRunTime;
                
                if (actualValue && actualValue < 99 * 3600) {
                    const timeStr = this.formatTime(actualValue);
                    const rank = athlete[ax.rankKey];
                    
                    // Create time display
                    const timeDisplay = document.createElement('div');
                    timeDisplay.textContent = timeStr;
                    timeDisplay.style.fontWeight = '500';
                    
                    // Create rank display
                    const rankDisplay = document.createElement('div');
                    rankDisplay.textContent = rank ? `#${rank}` : '';
                    rankDisplay.style.cssText = 'font-size: 11px; color: #666;';
                    
                    // Create pace display - ALWAYS SHOW
                    const paceDisplay = document.createElement('div');
                    paceDisplay.style.cssText = 'font-size: 10px; color: #0066cc; margin-top: 3px; font-weight: 500;';
                    
                    // Calculate pace based on segment type
                    if (ax.axis === 'Swim' && athlete.actualSwimTime) {
                        const swimPace = RaceConfig.getSwimPace(athlete.actualSwimTime);
                        paceDisplay.textContent = `${secondsToTime(swimPace)}/100m`;
                    } else if (ax.axis === 'Bike' && athlete.actualBikeTime) {
                        const bikeSpeed = RaceConfig.getBikeSpeed(athlete.actualBikeTime);
                        paceDisplay.textContent = `${bikeSpeed.toFixed(1)} km/hr`;
                    } else if (ax.axis === 'Run' && athlete.actualRunTime) {
                        const runPace = RaceConfig.getRunPace(athlete.actualRunTime);
                        const mins = Math.floor(runPace);
                        const secs = Math.round((runPace % 1) * 60);
                        paceDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}/km`;
                    }
                    
                    cell.appendChild(timeDisplay);
                    cell.appendChild(rankDisplay);
                    if (paceDisplay.textContent) {
                        cell.appendChild(paceDisplay);
                    }
                } else {
                    cell.textContent = '-';
                }
                
                row.appendChild(cell);
            });
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        container.innerHTML = '';
        container.appendChild(table);
        
    }
    
    formatTime(seconds) {
        if (!seconds || seconds >= 99 * 3600) return '-';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    toggleAthlete(athleteName) {
        this.athleteVisibility[athleteName] = !this.athleteVisibility[athleteName];
        this.redraw();
    }
    
    toggleCountry(country) {
        const athletes = this.data.filter(a => a.country === country);
        const anyVisible = athletes.some(a => this.athleteVisibility[a.name]);
        const newVisibility = !anyVisible;
        
        athletes.forEach(athlete => {
            this.athleteVisibility[athlete.name] = newVisibility;
        });
        
        this.redraw();
    }
    
    showAllAthletes(show) {
        this.data.forEach(athlete => {
            this.athleteVisibility[athlete.name] = show;
        });
        this.redraw();
    }
    
    showGroup(range) {
        this.data.forEach(athlete => {
            const pos = athlete.finalRank || 999;
            if (pos >= range[0] && pos <= range[1]) {
                this.athleteVisibility[athlete.name] = true;
            }
        });
        this.redraw();
    }
    
    clear() {
        const container = document.getElementById(this.containerId);
        if (container) {
            container.innerHTML = '';
        }
    }
}