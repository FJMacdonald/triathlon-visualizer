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
        
        // Create SVG
        const { svg, g, width, height, margin } = this.createSVG();
        const isMobile = responsiveManager.isMobile;
        
        // Calculate stage proportions based on average times
        const stageProportions = this.calculateStageProportions();
        
        // Setup scales
        const xScale = d3.scaleLinear()
            .domain([0, 1])
            .range([0, width]);
        
        const totalPositions = this.data.length + dsqAthletes.length;
        const yScale = d3.scaleLinear()
            .domain([1, totalPositions + 1])
            .range([0, height]);
        
        // Setup axes
        // X-axis grid
        g.append("g")
            .attr("class", "grid grid-x")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickSize(-height).tickFormat(""));

        // Y-axis grid - every 5 positions
        g.append("g")
            .attr("class", "grid grid-y")
            .call(d3.axisLeft(yScale)
                .tickValues(d3.range(0, totalPositions + 5, 5))
                .tickSize(-width)
                .tickFormat("")
            );

        // X-axis
        g.append("g")
            .attr("class", "x-axis axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(xScale));

        // Y-axis - every 5 positions
        g.append("g")
            .attr("class", "y-axis axis")
            .call(d3.axisLeft(yScale)
                .tickValues(d3.range(0, totalPositions + 5, 5))
                .tickFormat(d => d === 0 ? '' : d)
            );

        // Y-axis label
        g.append("text")
            .attr("class", "y-axis-label axis-label")
            .attr("transform", "rotate(-90)")
            .attr("y", isMobile ? -35 : -50)
            .attr("x", -(height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size", isMobile ? "12px" : "14px")
            .text("Position");        
        // Customize x-axis
        this.customizeXAxis(g, xScale, stageProportions, height, isMobile);
        
        // Draw transition lines
        this.drawTransitionLines(g, xScale, stageProportions, height);
        
        // Calculate athlete positions
        this.calculateAthletePositions(nonDsqData, dsqAthletes);
        
        // Draw athlete lines
        this.drawAthleteLines(g, xScale, yScale, stageProportions, nonDsqData);
        
        // Draw labels
        this.drawLabels(g, yScale, width, nonDsqData, dsqAthletes);
    }
    
    calculateStageProportions() {
        const finishers = this.data.filter(a => !['DNF', 'DSQ', 'LAP', 'DNS'].includes(a.status));
        
        const avgSwim = d3.mean(finishers, d => d.actualSwimTime || 0);
        const avgT1 = d3.mean(finishers, d => d.actualT1Time || 0);
        const avgBike = d3.mean(finishers, d => d.actualBikeTime || 0);
        const avgT2 = d3.mean(finishers, d => d.actualT2Time || 0);
        const avgRun = d3.mean(finishers, d => d.actualRunTime || 0);
        
        // Boost transition visibility
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
    
    customizeXAxis(g, xScale, proportions, height, isMobile) {
        const stages = [
            {name: "Start", position: 0},
            {name: "Swim", position: proportions.swimEnd},
            {name: "T1", position: proportions.t1End},
            {name: "Bike", position: proportions.bikeEnd},
            {name: "T2", position: proportions.t2End},
            {name: "Finish", position: 1}
        ];
        
        const xAxis = g.select('.x-axis');
        xAxis.call(d3.axisBottom(xScale)
            .tickValues(stages.map(s => s.position))
            .tickFormat("")
        );
        
        // Add stage labels between markers
        const xLabels = [
            { pos: proportions.swimEnd / 2, text: 'Swim' },
            { pos: (proportions.swimEnd + proportions.t1End) / 2, text: 'T1' },
            { pos: (proportions.t1End + proportions.bikeEnd) / 2, text: 'Bike' },
            { pos: (proportions.bikeEnd + proportions.t2End) / 2, text: 'T2' },
            { pos: (proportions.t2End + 1) / 2, text: 'Run' }
        ];
        
        xLabels.forEach(label => {
            xAxis.append("text")
                .attr("x", xScale(label.pos))
                .attr("y", isMobile ? 25 : 30)
                .style("text-anchor", "middle")
                .style("font-size", isMobile ? "10px" : "12px")
                .style("fill", "black")
                .text(label.text);
        });
    }
    
    drawTransitionLines(g, xScale, proportions, height) {
        const transitionLines = g.append("g")
            .attr("class", "transition-lines");

        const positions = [
            proportions.swimEnd,
            proportions.t1End,
            proportions.bikeEnd,
            proportions.t2End
        ];

        positions.forEach(pos => {
            transitionLines.append("line")
                .attr("x1", xScale(pos))
                .attr("x2", xScale(pos))
                .attr("y1", 0)
                .attr("y2", height)
                .attr("stroke", "#e0e0e0")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3")
                .attr("opacity", 0.5);
        });
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
            
            // Draw line segments
            for (let i = 0; i < lineData.length - 1; i++) {
                // Invisible hit area
                athleteGroup.append("line")
                    .attr("class", "athlete-line-hitarea")
                    .attr("x1", xScale(lineData[i].x))
                    .attr("y1", yScale(lineData[i].y))
                    .attr("x2", xScale(lineData[i + 1].x))
                    .attr("y2", yScale(lineData[i + 1].y))
                    .attr("stroke", "transparent")
                    .attr("stroke-width", 10)
                    .attr("pointer-events", "stroke");
                
                // Visible line
                athleteGroup.append("line")
                    .attr("class", "athlete-line")
                    .attr("x1", xScale(lineData[i].x))
                    .attr("y1", yScale(lineData[i].y))
                    .attr("x2", xScale(lineData[i + 1].x))
                    .attr("y2", yScale(lineData[i + 1].y))
                    .attr("stroke", this.colorScale(athlete.name))
                    .attr("stroke-width", 1.5)
                    .attr("stroke-dasharray", strokeDasharray)
                    .attr("opacity", 0.4)
                    .attr("pointer-events", "none");
            }
            
            // Add hover events
            this.addAthleteHoverEvents(athleteGroup, athlete);
        });
    }
    
    addAthleteHoverEvents(group, athlete) {
        group.on("mouseover", (event) => {
            group.selectAll(".athlete-line")
                .style("stroke-width", "3px")
                .style("opacity", "1");
            
            const content = tooltipManager.athleteSummary(athlete);
            tooltipManager.show(content, window.innerWidth - 250, event.pageY);
        })
        .on("mouseout", () => {
            group.selectAll(".athlete-line")
                .style("stroke-width", "1.5px")
                .style("opacity", "0.4");
            
            tooltipManager.hide();
        });
    }
    
    drawLabels(g, yScale, width, nonDsqData, dsqAthletes) {
        let nonFinisherPosition = Math.max(...nonDsqData.filter(a => a.finalRank).map(a => a.finalRank || 0)) + 1;
        const isMobile = responsiveManager.isMobile;
        const fontSize = isMobile ? "9px" : "10px";
        
        nonDsqData.forEach((athlete) => {
            let displayY;
            if (athlete.finalRank) {
                displayY = yScale(athlete.finalRank);
            } else {
                displayY = yScale(nonFinisherPosition++);
            }
            
            const baseName = athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '');
            let displayText = '';
            
            if (athlete.finalRank) {
                displayText = `${athlete.finalRank}. ${baseName} ${getFlag(athlete.country)}`;
            } else if (athlete.status) {
                displayText = `${baseName} ${getFlag(athlete.country)} (${athlete.status})`;
            }
            
            g.append("text")
                .attr("x", width + 10)
                .attr("y", displayY)
                .attr("dy", "0.35em")
                .style("font-size", fontSize)
                .style("fill", this.colorScale(athlete.name))
                .text(displayText);
        });
        
        // DSQ athletes at the end
        dsqAthletes.forEach((athlete, index) => {
            const baseName = athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '');
            const displayText = `${baseName} ${getFlag(athlete.country)} (DSQ)`;
            const displayY = yScale(nonFinisherPosition + index);
            
            g.append("text")
                .attr("x", width + 10)
                .attr("y", displayY)
                .attr("dy", "0.35em")
                .style("font-size", fontSize)
                .style("fill", this.colorScale(athlete.name))
                .text(displayText);
        });
    }
}