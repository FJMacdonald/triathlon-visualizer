import { BaseChart } from './base-chart.js';
import { ChartConfig } from '../config/chart-config.js';
import { tooltipManager } from '../ui/tooltips.js';
import { responsiveManager } from '../utils/responsive.js';

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
        
        // Force container centering
        const container = document.getElementById(this.containerId);
        container.style.display = 'flex';
        container.style.justifyContent = 'center';
        container.style.alignItems = 'center';
        container.style.minHeight = '400px';
        
        const { svg, g, width, height, margin } = this.createSVG();
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
            
            // Create path data, using 0 for incomplete values
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
            
            // Add hover events
            area.on("mouseover", (event) => {
                if (!this.athleteVisibility[athlete.name]) return;
                
                d3.select(event.target)
                    .style("fill-opacity", 0.4)
                    .style("stroke-width", 3);
                
                const content = tooltipManager.spiderAthlete(athlete);
                tooltipManager.show(content, event.pageX, event.pageY);
            })
            .on("mouseout", (event) => {
                if (!this.athleteVisibility[athlete.name]) return;
                
                d3.select(event.target)
                    .style("fill-opacity", 0.2)
                    .style("stroke-width", 2);
                
                tooltipManager.hide();
            });
            
            // Draw dots at vertices
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
}