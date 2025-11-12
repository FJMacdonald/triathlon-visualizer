import { BaseChart } from './base-chart.js';
import { ChartConfig } from '../config/chart-config.js';
import { tooltipManager } from '../ui/tooltips.js';
import { secondsToTime, getFlag } from '../utils/formatters.js';
import { responsiveManager } from '../utils/responsive.js';

export class RankChart extends BaseChart {
    constructor(containerId) {
        super(containerId, 'rank');
        this.stages = [];
        this.athletePositions = {};
        this.rowHeight = 20; // Height per athlete row
    }
    
    draw() {
        if (!this.data || this.data.length === 0) return;
        
        this.clear();
        
        // Filter and sort data
        const dsqAthletes = this.data.filter(a => a.status === 'DSQ')
            .sort((a, b) => {
                const aTime = (a.actualSwimTime || 0) + (a.actualT1Time || 0) + 
                             (a.actualBikeTime || 0) + (a.actualT2Time || 0) + (a.actualRunTime || 0);
                const bTime = (b.actualSwimTime || 0) + (b.actualT1Time || 0) + 
                             (b.actualBikeTime || 0) + (b.actualT2Time || 0) + (b.actualRunTime || 0);
                return aTime - bTime;
            });
        const nonDsqData = this.data.filter(a => a.status !== 'DSQ');
        
        this.drawScrollableChart(nonDsqData, dsqAthletes);
    }
    
    drawScrollableChart(nonDsqData, dsqAthletes) {
        const container = d3.select(this.container);
        const containerWidth = container.node().getBoundingClientRect().width;
        const isMobile = responsiveManager.isMobile;
        
        // Calculate dimensions - adjusted margins since Y label is outside
        const margin = { top: 10, right: 100, bottom: 10, left: 35 };
        const width = containerWidth - margin.left - margin.right - 30; // Extra space for external label
        const totalAthletes = this.data.length;
        const fullHeight = totalAthletes * this.rowHeight;
        
        // Viewport height based on screen size
        const maxViewportHeight = isMobile ? 
            Math.min(window.innerHeight * 0.5, 350) : 
            Math.min(window.innerHeight * 0.6, 500);
        const viewportHeight = Math.min(fullHeight, maxViewportHeight);
        
        // Clear and setup container
        container.html('');
        container.style('position', 'relative');
        
        // Create main wrapper with flexbox for Y-axis label
        const wrapper = container.append('div')
            .attr('class', 'chart-wrapper')
            .style('display', 'flex')
            .style('align-items', 'stretch');
        
        // Y-axis label (outside scroll area)
        wrapper.append('div')
            .attr('class', 'y-axis-label-container')
            .style('writing-mode', 'vertical-rl')
            .style('transform', 'rotate(180deg)')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center')
            .style('padding', '0 5px')
            .style('font-size', isMobile ? '12px' : '14px')
            .style('font-weight', 'bold')
            .style('color', '#333')
            .text('Position');
        
        // Main chart area
        const chartArea = wrapper.append('div')
            .attr('class', 'chart-area')
            .style('flex', '1')
            .style('display', 'flex')
            .style('flex-direction', 'column');
        
        // Add navigation controls
        this.addNavigationControls(chartArea, totalAthletes);
        
        // Create fixed header for X-axis
        const headerHeight = 35;
        const headerSvg = chartArea.append('svg')
            .attr('class', 'chart-header')
            .attr('width', containerWidth - 30)
            .attr('height', headerHeight);
        
        const headerG = headerSvg.append('g')
            .attr('transform', `translate(${margin.left}, ${headerHeight - 5})`);
        
        // Create scrollable container
        const scrollContainer = chartArea.append('div')
            .attr('class', 'scroll-container')
            .style('height', `${viewportHeight}px`)
            .style('overflow-y', 'auto')
            .style('overflow-x', 'hidden')
            .style('border', '1px solid #ddd')
            .style('border-radius', '4px')
            .style('background', '#fafafa');
        
        // Create the main SVG inside scrollable container
        const svg = scrollContainer.append('svg')
            .attr('width', containerWidth - 30)
            .attr('height', fullHeight);
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, 0)`);
        
        // Setup scales
        const stageProportions = this.calculateStageProportions();
        
        const xScale = d3.scaleLinear()
            .domain([0, 1])
            .range([0, width]);
        
        const totalPositions = this.data.length + dsqAthletes.length;
        const yScale = d3.scaleLinear()
            .domain([1, totalPositions + 1])
            .range([this.rowHeight / 2, fullHeight - this.rowHeight / 2]);
        
        // Draw header (X-axis labels)
        this.drawXAxisHeader(headerG, xScale, stageProportions, width);
        
        // Draw background grid
        this.drawGrid(g, xScale, yScale, width, fullHeight, stageProportions, totalPositions);
        
        // Calculate athlete positions
        this.calculateAthletePositions(nonDsqData, dsqAthletes);
        
        // Draw Y-axis with all positions
        this.drawYAxis(g, yScale, totalPositions);
        
        // Draw athlete lines
        this.drawAthleteLines(g, xScale, yScale, stageProportions, nonDsqData);
        
        // Draw labels (without position numbers)
        this.drawLabels(g, yScale, width, nonDsqData, dsqAthletes);
        
        // Add scroll info and mini-map
        this.addScrollFeatures(chartArea, scrollContainer, viewportHeight, fullHeight, totalAthletes);
    }
    
    addNavigationControls(container, totalAthletes) {
        const navControls = container.append('div')
            .attr('class', 'scroll-nav-controls')
            .style('margin-bottom', '8px')
            .style('text-align', 'center');
        
        const jumpButtons = [
            { label: '🥇 Top 10', position: 0 },
            { label: '📊 Mid Pack', position: Math.floor(totalAthletes / 2) - 5 },
            { label: '🏁 Back', position: Math.max(0, totalAthletes - 12) }
        ];
        
        jumpButtons.forEach(btn => {
            navControls.append('button')
                .style('padding', '6px 10px')
                .style('margin', '2px')
                .style('border-radius', '4px')
                .style('border', '1px solid #ccc')
                .style('background', 'white')
                .style('cursor', 'pointer')
                .style('font-size', '11px')
                .style('transition', 'background 0.2s')
                .text(btn.label)
                .on('click', () => {
                    const scrollTarget = btn.position * this.rowHeight;
                    d3.select('.scroll-container').node().scrollTop = scrollTarget;
                })
                .on('mouseover', function() {
                    d3.select(this).style('background', '#e3f2fd');
                })
                .on('mouseout', function() {
                    d3.select(this).style('background', 'white');
                });
        });
    }
    
    drawXAxisHeader(g, xScale, proportions, width) {
        const xLabels = [
            { pos: proportions.swimEnd / 2, text: 'SWIM' },
            { pos: (proportions.swimEnd + proportions.t1End) / 2, text: 'T1' },
            { pos: (proportions.t1End + proportions.bikeEnd) / 2, text: 'BIKE' },
            { pos: (proportions.bikeEnd + proportions.t2End) / 2, text: 'T2' },
            { pos: (proportions.t2End + 1) / 2, text: 'RUN' }
        ];
        
        // Background for header
        g.append('rect')
            .attr('x', 0)
            .attr('y', -25)
            .attr('width', width)
            .attr('height', 25)
            .attr('fill', '#f5f5f5')
            .attr('rx', 3);
        
        xLabels.forEach(label => {
            g.append("text")
                .attr("x", xScale(label.pos))
                .attr("y", -8)
                .style("text-anchor", "middle")
                .style("font-size", "11px")
                .style("font-weight", "bold")
                .style("fill", "#333")
                .text(label.text);
        });
        
        // Stage separators
        const positions = [0, proportions.swimEnd, proportions.t1End, proportions.bikeEnd, proportions.t2End, 1];
        positions.forEach(pos => {
            g.append("line")
                .attr("x1", xScale(pos))
                .attr("x2", xScale(pos))
                .attr("y1", -25)
                .attr("y2", 0)
                .attr("stroke", "#ccc")
                .attr("stroke-width", 1);
        });
    }
    
    drawGrid(g, xScale, yScale, width, height, proportions, totalPositions) {
        // Vertical stage dividers
        const positions = [proportions.swimEnd, proportions.t1End, proportions.bikeEnd, proportions.t2End];
        positions.forEach(pos => {
            g.append("line")
                .attr("x1", xScale(pos))
                .attr("x2", xScale(pos))
                .attr("y1", 0)
                .attr("y2", height)
                .attr("stroke", "#e0e0e0")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3");
        });
        
        // Horizontal lines for every position
        for (let i = 1; i <= totalPositions; i++) {
            g.append("line")
                .attr("x1", 0)
                .attr("x2", width)
                .attr("y1", yScale(i))
                .attr("y2", yScale(i))
                .attr("stroke", i % 5 === 0 ? "#ddd" : "#f0f0f0")
                .attr("stroke-width", i % 5 === 0 ? 1 : 0.5);
        }
    }
    
    drawYAxis(g, yScale, totalPositions) {
        // Draw position number for EVERY athlete
        for (let i = 1; i <= totalPositions; i++) {
            g.append("text")
                .attr("x", -8)
                .attr("y", yScale(i))
                .attr("dy", "0.35em")
                .style("text-anchor", "end")
                .style("font-size", "9px")
                .style("fill", i <= 3 ? "#d4af37" : (i <= 10 ? "#666" : "#999"))
                .style("font-weight", i <= 3 ? "bold" : "normal")
                .text(i);
        }
    }
    
    addScrollFeatures(container, scrollContainer, viewportHeight, fullHeight, totalAthletes) {
        // Scroll info display
        const scrollInfo = container.append('div')
            .attr('class', 'scroll-info')
            .style('text-align', 'center')
            .style('font-size', '11px')
            .style('color', '#666')
            .style('margin-top', '5px')
            .style('padding', '4px')
            .style('background', '#f5f5f5')
            .style('border-radius', '3px');
        
        // Update scroll info on scroll
        const updateScrollInfo = () => {
            const scrollTop = scrollContainer.node().scrollTop;
            const currentPosition = Math.floor(scrollTop / this.rowHeight) + 1;
            const endPosition = Math.min(
                currentPosition + Math.floor(viewportHeight / this.rowHeight) - 1, 
                totalAthletes
            );
            scrollInfo.text(`Viewing positions ${currentPosition} - ${endPosition} of ${totalAthletes}`);
        };
        
        scrollContainer.on('scroll', updateScrollInfo);
        updateScrollInfo(); // Initial update
        
        // Add keyboard navigation hint
        container.append('div')
            .style('text-align', 'center')
            .style('font-size', '10px')
            .style('color', '#999')
            .style('margin-top', '3px')
            .text('Scroll or use buttons to navigate • Hover over lines for details');
    }
    
    calculateStageProportions() {
        const finishers = this.data.filter(a => !['DNF', 'DSQ', 'LAP', 'DNS'].includes(a.status));
        
        const avgSwim = d3.mean(finishers, d => d.actualSwimTime || 0);
        const avgT1 = d3.mean(finishers, d => d.actualT1Time || 0);
        const avgBike = d3.mean(finishers, d => d.actualBikeTime || 0);
        const avgT2 = d3.mean(finishers, d => d.actualT2Time || 0);
        const avgRun = d3.mean(finishers, d => d.actualRunTime || 0);
        
        const t1Boost = avgT1 * 4;
        const t2Boost = avgT2 * 4;
        const totalBoost = t1Boost + t2Boost;
        
        const swimProp = avgSwim / (avgSwim + avgBike + avgRun);
        const bikeProp = avgBike / (avgSwim + avgBike + avgRun);
        const runProp = avgRun / (avgSwim + avgBike + avgRun);
        
        const adjustedSwim = avgSwim - (totalBoost * swimProp);
        const adjustedBike = avgBike - (totalBoost * bikeProp);
        const adjustedRun = avgRun - (totalBoost * runProp);
        const adjustedT1 = avgT1 * 5;
        const adjustedT2 = avgT2 * 5;
        
        const adjustedTotal = adjustedSwim + adjustedT1 + adjustedBike + adjustedT2 + adjustedRun;
        
        return {
            swimEnd: adjustedSwim / adjustedTotal,
            t1End: (adjustedSwim + adjustedT1) / adjustedTotal,
            bikeEnd: (adjustedSwim + adjustedT1 + adjustedBike) / adjustedTotal,
            t2End: (adjustedSwim + adjustedT1 + adjustedBike + adjustedT2) / adjustedTotal
        };
    }
    
    calculateAthletePositions(nonDsqData, dsqAthletes) {
        let dnfPosition = Math.max(...this.data.filter(a => a.finalRank).map(a => a.finalRank || 0)) + 1;
        
        this.data.forEach((athlete) => {
            if (athlete.finalRank) {
                this.athletePositions[athlete.name] = athlete.finalRank;
            } else if (athlete.status === 'DSQ') {
                const dsqIndex = dsqAthletes.indexOf(athlete);
                this.athletePositions[athlete.name] = nonDsqData.length + dsqIndex + 1;
            } else {
                this.athletePositions[athlete.name] = dnfPosition++;
            }
        });
    }
    
    drawAthleteLines(g, xScale, yScale, proportions, nonDsqData) {
        const stages = [
            {name: "Start", key: "swimRank", position: 0},
            {name: "Swim", key: "swimRank", position: proportions.swimEnd},
            {name: "T1", key: "t1Rank", position: proportions.t1End},
            {name: "Bike", key: "bikeRank", position: proportions.bikeEnd},
            {name: "T2", key: "t2Rank", position: proportions.t2End},
            {name: "Finish", key: "finalRank", position: 1}
        ];
        
        this.data.forEach((athlete, athleteIndex) => {
            const finalPosition = this.athletePositions[athlete.name];
            const lineData = stages.map(stage => {
                let rank = stage.key === 'finalRank' ? 
                    finalPosition : 
                    (athlete[stage.key] || finalPosition);
                return { x: stage.position, y: rank };
            });
            
            const athleteGroup = g.append("g")
                .attr("class", `athlete-group-${athleteIndex}`)
                .attr("pointer-events", "all");
            
            const strokeDasharray = this.getStrokeDasharray(athlete.status);
            const baseOpacity = athlete.finalRank && athlete.finalRank <= 10 ? 0.6 : 0.3;
            const baseWidth = athlete.finalRank && athlete.finalRank <= 3 ? 2.5 : 1.5;
            
            for (let i = 0; i < lineData.length - 1; i++) {
                athleteGroup.append("line")
                    .attr("class", "athlete-line-hitarea")
                    .attr("x1", xScale(lineData[i].x))
                    .attr("y1", yScale(lineData[i].y))
                    .attr("x2", xScale(lineData[i + 1].x))
                    .attr("y2", yScale(lineData[i + 1].y))
                    .attr("stroke", "transparent")
                    .attr("stroke-width", 12)
                    .attr("pointer-events", "stroke");
                
                athleteGroup.append("line")
                    .attr("class", "athlete-line")
                    .attr("x1", xScale(lineData[i].x))
                    .attr("y1", yScale(lineData[i].y))
                    .attr("x2", xScale(lineData[i + 1].x))
                    .attr("y2", yScale(lineData[i + 1].y))
                    .attr("stroke", this.colorScale(athlete.name))
                    .attr("stroke-width", baseWidth)
                    .attr("stroke-dasharray", strokeDasharray)
                    .attr("opacity", baseOpacity)
                    .attr("pointer-events", "none");
            }
            
            this.addAthleteHoverEvents(athleteGroup, athlete, baseWidth, baseOpacity);
        });
    }
    
    addAthleteHoverEvents(group, athlete, baseWidth, baseOpacity) {
        group.on("mouseover", (event) => {
            // Highlight this athlete
            group.selectAll(".athlete-line")
                .style("stroke-width", "4px")
                .style("opacity", "1");
            
            // Dim other athletes
            d3.selectAll('[class^="athlete-group-"]').each(function() {
                if (this !== group.node()) {
                    d3.select(this).selectAll(".athlete-line")
                        .style("opacity", "0.1");
                }
            });
            
            const content = tooltipManager.athleteSummary(athlete);
            tooltipManager.show(content, window.innerWidth - 250, event.pageY);
        })
        .on("mouseout", () => {
            // Restore this athlete
            group.selectAll(".athlete-line")
                .style("stroke-width", `${baseWidth}px`)
                .style("opacity", baseOpacity);
            
            // Restore other athletes
            d3.selectAll('[class^="athlete-group-"]').each(function() {
                const grp = d3.select(this);
                const athleteData = grp.datum && grp.datum();
                grp.selectAll(".athlete-line")
                    .style("opacity", null); // Reset to CSS/inline default
            });
            
            // Re-apply base opacities
            this.data.forEach((ath, idx) => {
                const op = ath.finalRank && ath.finalRank <= 10 ? 0.6 : 0.3;
                const w = ath.finalRank && ath.finalRank <= 3 ? 2.5 : 1.5;
                d3.select(`.athlete-group-${idx}`).selectAll(".athlete-line")
                    .style("opacity", op)
                    .style("stroke-width", `${w}px`);
            });
            
            tooltipManager.hide();
        });
    }
    
    drawLabels(g, yScale, width, nonDsqData, dsqAthletes) {
        const isMobile = responsiveManager.isMobile;
        const fontSize = isMobile ? "9px" : "10px";
        
        nonDsqData.forEach((athlete) => {
            const displayY = yScale(this.athletePositions[athlete.name]);
            const baseName = athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '');
            
            // Just name and flag, no position number (it's on the Y-axis now)
            let displayText = `${baseName} ${getFlag(athlete.country)}`;
            if (!athlete.finalRank && athlete.status) {
                displayText += ` (${athlete.status})`;
            }
            
            g.append("text")
                .attr("x", width + 8)
                .attr("y", displayY)
                .attr("dy", "0.35em")
                .style("font-size", fontSize)
                .style("fill", this.colorScale(athlete.name))
                .style("font-weight", athlete.finalRank && athlete.finalRank <= 3 ? "bold" : "normal")
                .text(displayText);
        });
        
        dsqAthletes.forEach((athlete) => {
            const baseName = athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '');
            const displayText = `${baseName} ${getFlag(athlete.country)} (DSQ)`;
            const displayY = yScale(this.athletePositions[athlete.name]);
            
            g.append("text")
                .attr("x", width + 8)
                .attr("y", displayY)
                .attr("dy", "0.35em")
                .style("font-size", fontSize)
                .style("fill", this.colorScale(athlete.name))
                .text(displayText);
        });
    }
}