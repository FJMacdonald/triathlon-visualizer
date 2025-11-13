import { BaseChart } from './base-chart.js';
import { ChartConfig } from '../config/chart-config.js';
import { tooltipManager } from '../ui/tooltips.js';
import { secondsToTime } from '../utils/formatters.js';
import { responsiveManager } from '../utils/responsive.js';
import { RaceConfig } from '../config/race-config.js';

export class DevelopmentChart extends BaseChart {
    constructor(containerId) {
        super(containerId, 'development');
        this.chartData = null;
        this.athleteVisibility = {};
        this.countryVisibility = {};
        this.teamColors = {};
        this.teamColorIndex = 0;
        this.currentSection = 'all';
        this.xScale = null;
        this.yScale = null;
        this.originalXScale = null;
        this.originalYScale = null;
        this.lineGenerator = null;
        this.stageDist = {};
        this.sectionBounds = {};
        this.segmentLeaders = {};
        this.stageLeaderTimes = {};
        this.zoomMode = false;
        this.onAthleteClick = null;
        this.useScrollable = false;
        this.heightMultiplier = 1.0; // User control for chart height
    }
    
    setSegmentLeaders(leaders) {
        this.segmentLeaders = leaders;
    }
    
    setVisibility(athleteVisibility, countryVisibility) {
        this.athleteVisibility = athleteVisibility;
        this.countryVisibility = countryVisibility;
    }

    restoreState() {
        if (!this.data || !this.chartData) return;
        
        this.data.forEach((athlete, index) => {
            const isVisible = this.athleteVisibility[athlete.name] !== false;
            d3.selectAll(`.athlete-path-${index}`).classed("hidden", !isVisible);
            d3.selectAll(`.athlete-path-hitarea-${index}`).classed("hidden", !isVisible);
            d3.selectAll(`.athlete-circle-${index}`).classed("hidden", !isVisible);
        });
        
        this.drawTeamHighlights();
        this.update();
    }
    
    draw() {
        if (!this.data || this.data.length === 0) return;
        
        this.clear();
        
        const racers = this.data.filter(a => a.status !== 'DNS');
        const isMobile = responsiveManager.isMobile;
        
        // Calculate stage positions first
        this.calculateStagePositions(racers);
        
        // Calculate leader times at each stage
        this.calculateStageLeaderTimes(racers);
        
        // Process chart data
        this.processChartData(racers);
        
        // Determine if we should use scrollable view
        this.useScrollable = this.data.length > 40 || (isMobile && this.data.length > 25);
        
        if (this.useScrollable) {
            this.drawScrollableChart(racers);
        } else {
            this.drawStandardChart(racers);
        }
    }
    
    calculateStageLeaderTimes(racers) {
        const validRacers = racers.filter(a => !['DNF', 'DSQ', 'LAP'].includes(a.status));
        
        this.stageLeaderTimes = {
            swim: d3.min(validRacers.filter(a => a.actualSwimTime), a => a.swimCumulative) || 0,
            t1: d3.min(validRacers.filter(a => a.actualT1Time), a => a.t1Cumulative) || 0,
            bike: d3.min(validRacers.filter(a => a.actualBikeTime), a => a.bikeCumulative) || 0,
            t2: d3.min(validRacers.filter(a => a.actualT2Time), a => a.t2Cumulative) || 0,
            finish: d3.min(validRacers.filter(a => a.actualRunTime), a => a.totalCumulative) || 0
        };
    }
    
    drawScrollableChart(racers) {
        const container = d3.select(this.container);
        const containerRect = container.node().getBoundingClientRect();
        const containerWidth = containerRect.width;
        const isMobile = responsiveManager.isMobile;
        
        // Calculate dimensions - ensure we account for all padding/margins
        const margin = { 
            top: 10, 
            right: isMobile ? 15 : 30, 
            bottom: 20, 
            left: isMobile ? 45 : 55 
        };
        
        // Calculate actual available width
        const yAxisLabelWidth = isMobile ? 20 : 25;
        const scrollbarWidth = 15; // Account for scrollbar
        const availableWidth = containerWidth - yAxisLabelWidth - scrollbarWidth;
        const width = Math.max(200, availableWidth - margin.left - margin.right);
        
        // Calculate max time behind for height calculation
        const maxTimeBehind = d3.max(this.chartData, d => d3.max(d.values, v => v.timeBehind)) || 100;
        
        // Apply height multiplier for user control
        const baseHeight = Math.max(300, (maxTimeBehind + 20) * 1.2);
        const fullHeight = baseHeight * this.heightMultiplier;
        
        const maxViewportHeight = isMobile ? 
            Math.min(window.innerHeight * 0.5, 350) : 
            Math.min(window.innerHeight * 0.6, 500);
        const viewportHeight = Math.min(fullHeight + 50, maxViewportHeight);
        
        // Clear and setup container
        container.html('');
        container.style('position', 'relative');
        
        // Create main wrapper with flexbox for Y-axis label
        const wrapper = container.append('div')
            .attr('class', 'chart-wrapper')
            .style('display', 'flex')
            .style('align-items', 'stretch')
            .style('width', '100%');
        
        // Y-axis label (outside scroll area)
        wrapper.append('div')
            .attr('class', 'y-axis-label-container')
            .style('writing-mode', 'vertical-rl')
            .style('transform', 'rotate(180deg)')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('justify-content', 'center')
            .style('padding', '0 2px')
            .style('font-size', isMobile ? '10px' : '14px')
            .style('font-weight', 'bold')
            .style('color', '#333')
            .style('flex-shrink', '0')
            .style('width', `${yAxisLabelWidth}px`)
            .text('Time Behind Leader (seconds)');
        
        // Main chart area
        const chartArea = wrapper.append('div')
            .attr('class', 'chart-area')
            .style('flex', '1')
            .style('display', 'flex')
            .style('flex-direction', 'column')
            .style('min-width', '0'); // Important for flex shrinking
        
        // Height control slider
        this.addHeightControl(chartArea);
        
        // Create fixed header for X-axis
        const headerHeight = 40;
        const totalSvgWidth = width + margin.left + margin.right;
        
        const headerSvg = chartArea.append('svg')
            .attr('class', 'chart-header')
            .attr('width', totalSvgWidth)
            .attr('height', headerHeight)
            .style('display', 'block');
        
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
            .style('background', '#fafafa')
            .style('width', '100%');
        
        // Create the main SVG inside scrollable container
        const svg = scrollContainer.append('svg')
            .attr('width', totalSvgWidth)
            .attr('height', fullHeight + margin.bottom + 20)
            .style('display', 'block');
        
        // Add clipping path
        svg.append("defs")
            .append("clipPath")
            .attr("id", "chart-clip")
            .append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width + 10)
            .attr("height", fullHeight + margin.bottom);
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left}, 5)`);
        
        // Setup scales
        this.originalXScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, width]);
        
        this.originalYScale = d3.scaleLinear()
            .domain([0, maxTimeBehind + 10])
            .range([0, fullHeight]);
        
        this.xScale = this.originalXScale.copy();
        this.yScale = this.originalYScale.copy();
        
        // Create line generator
        this.lineGenerator = d3.line()
            .x(d => this.xScale(d.distance))
            .y(d => this.yScale(d.timeBehind))
            .curve(d3.curveLinear);
        
        // Store references
        this.svg = svg;
        this.g = g;
        this.headerG = headerG;
        this.dimensions = { width, height: fullHeight, margin };
        this.scrollContainer = scrollContainer;
        
        // Draw chart elements
        this.drawXAxisHeader(headerG, this.xScale, width);
        this.drawYAxisScrollable(g, fullHeight, isMobile);
        this.drawGridScrollable(g, width, fullHeight);
        this.drawTransitionLines(g, fullHeight);
        
        // Create content group with clipping
        const chartContent = g.append("g")
            .attr("class", "chart-content")
            .attr("clip-path", "url(#chart-clip)");
        
        // Draw athlete paths
        this.drawAthletePaths(chartContent);
        this.drawTeamHighlights();
        
        // Add scroll info
        chartArea.append('div')
            .attr('class', 'scroll-info')
            .style('text-align', 'center')
            .style('font-size', '11px')
            .style('color', '#666')
            .style('margin-top', '5px')
            .style('padding', '4px')
            .style('background', '#f5f5f5')
            .style('border-radius', '3px')
            .text('Scroll to see athletes further behind • Use slider above to adjust spread');
        
        this.restoreState();
    }    
    addHeightControl(container) {
        const controlDiv = container.append('div')
            .attr('class', 'height-control')
            .style('margin-bottom', '8px')
            .style('padding', '8px')
            .style('background', '#f0f0f0')
            .style('border-radius', '4px')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('gap', '10px')
            .style('font-size', '12px');
        
        controlDiv.append('label')
            .text('Chart Height:')
            .style('font-weight', 'bold')
            .style('white-space', 'nowrap');
        
        const sliderContainer = controlDiv.append('div')
            .style('flex', '1')
            .style('display', 'flex')
            .style('align-items', 'center')
            .style('gap', '8px');
        
        sliderContainer.append('span')
            .text('Compact')
            .style('font-size', '10px')
            .style('color', '#666');
        
        const slider = sliderContainer.append('input')
            .attr('type', 'range')
            .attr('min', '0.5')
            .attr('max', '3')
            .attr('step', '0.1')
            .attr('value', this.heightMultiplier)
            .style('flex', '1')
            .style('cursor', 'pointer');
        
        sliderContainer.append('span')
            .text('Expanded')
            .style('font-size', '10px')
            .style('color', '#666');
        
        const valueDisplay = controlDiv.append('span')
            .attr('class', 'height-value')
            .text(`${this.heightMultiplier.toFixed(1)}x`)
            .style('min-width', '35px')
            .style('text-align', 'right');
        
        slider.on('input', (event) => {
            this.heightMultiplier = parseFloat(event.target.value);
            valueDisplay.text(`${this.heightMultiplier.toFixed(1)}x`);
        });
        
        slider.on('change', () => {
            // Redraw chart with new height
            this.draw();
        });
    }
    
    drawStandardChart(racers) {
        const { svg, g, width, height, margin } = this.createSVG();
        const isMobile = responsiveManager.isMobile;
        
        // Add clipping path with extra space for finish circles
        svg.append("defs")
            .append("clipPath")
            .attr("id", "chart-clip")
            .append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width + 10)
            .attr("height", height + 5)
            .attr("viewBox", `0 0 ${width + margin.left + margin.right} ${height + margin.top + margin.bottom}`)
            .attr("preserveAspectRatio", "xMinYMid meet");
        
        // Setup scales
        const maxTimeBehind = d3.max(this.chartData, d => d3.max(d.values, v => v.timeBehind)) || 100;
        
        this.originalXScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, width]);
        
        this.originalYScale = d3.scaleLinear()
            .domain([0, maxTimeBehind + 10])
            .range([0, height]);
        
        this.xScale = this.originalXScale.copy();
        this.yScale = this.originalYScale.copy();
        
        // Create line generator
        this.lineGenerator = d3.line()
            .x(d => this.xScale(d.distance))
            .y(d => this.yScale(d.timeBehind))
            .curve(d3.curveLinear);
        
        // Setup axes
        this.setupAxesStandard(g, width, height, isMobile);
        
        // Draw transition lines
        this.drawTransitionLines(g, height);
        
        // Create content group with clipping
        const chartContent = g.append("g")
            .attr("class", "chart-content")
            .attr("clip-path", "url(#chart-clip)");
        
        // Draw athlete paths
        this.drawAthletePaths(chartContent);
        
        // Draw team highlights
        this.drawTeamHighlights();
        this.restoreState();
    }
    
    setupAxesStandard(g, width, height, isMobile) {
        // X-axis
        g.append("g")
            .attr("class", "x-axis axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(this.xScale)
                .tickValues([0, this.stageDist.swim, this.stageDist.t1, this.stageDist.bike, this.stageDist.t2, 100])
                .tickFormat("")
            );
        
        // Add x-axis labels
        const xLabels = g.select('.x-axis').append("g").attr("class", "x-labels");
        const labels = [
            { x: this.stageDist.swim / 2, text: 'Swim', class: 'x-label-swim' },
            { x: (this.stageDist.swim + this.stageDist.t1) / 2, text: 'T1', class: 'x-label-t1' },
            { x: (this.stageDist.t1 + this.stageDist.bike) / 2, text: 'Bike', class: 'x-label-bike' },
            { x: (this.stageDist.bike + this.stageDist.t2) / 2, text: 'T2', class: 'x-label-t2' },
            { x: (this.stageDist.t2 + 100) / 2, text: 'Run', class: 'x-label-run' }
        ];
        
        labels.forEach(label => {
            xLabels.append("text")
                .attr("class", label.class)
                .attr("x", this.xScale(label.x))
                .attr("y", isMobile ? 25 : 30)
                .style("text-anchor", "middle")
                .style("font-size", isMobile ? "10px" : "12px")
                .style("fill", "black")
                .text(label.text);
        });
        
        // Y-axis
        g.append("g")
            .attr("class", "y-axis axis")
            .call(d3.axisLeft(this.yScale)
                .tickFormat(d => {
                    if (d === 0) return 'Leader';
                    if (isMobile) return Math.floor(d / 60) + 'm';
                    return secondsToTime(d);
                })
                .ticks(isMobile ? 5 : 10)
            );
        
        // Y-axis label
        g.append("text")
            .attr("class", "y-axis-label axis-label")
            .attr("transform", "rotate(-90)")
            .attr("y", isMobile ? -40 : -55)
            .attr("x", -(height / 2))
            .attr("dy", "1em")
            .style("text-anchor", "middle")
            .style("font-size", isMobile ? "12px" : "14px")
            .text("Time Behind Leader");
        
        // X-axis label
        g.append("text")
            .attr("class", "x-axis-label axis-label")
            .attr("x", width / 2)
            .attr("y", height + (isMobile ? 45 : 50))
            .style("text-anchor", "middle")
            .style("font-size", isMobile ? "12px" : "14px")
            .text("Race Progress");
        
        // Grid lines
        g.append("g")
            .attr("class", "grid grid-x")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(this.xScale).tickSize(-height).tickFormat(""));
        
        g.append("g")
            .attr("class", "grid grid-y")
            .call(d3.axisLeft(this.yScale).tickSize(-width).tickFormat(""));
    }
    
    drawXAxisHeader(g, xScale, width) {
        const xLabels = [
            { pos: this.stageDist.swim / 2, text: 'SWIM', class: 'x-label-swim' },
            { pos: (this.stageDist.swim + this.stageDist.t1) / 2, text: 'T1', class: 'x-label-t1' },
            { pos: (this.stageDist.t1 + this.stageDist.bike) / 2, text: 'BIKE', class: 'x-label-bike' },
            { pos: (this.stageDist.bike + this.stageDist.t2) / 2, text: 'T2', class: 'x-label-t2' },
            { pos: (this.stageDist.t2 + 100) / 2, text: 'RUN', class: 'x-label-run' }
        ];
        
        // Background for header
        g.append('rect')
            .attr('class', 'header-bg')
            .attr('x', 0)
            .attr('y', -30)
            .attr('width', width)
            .attr('height', 30)
            .attr('fill', '#f5f5f5')
            .attr('rx', 3);
        
        xLabels.forEach(label => {
            g.append("text")
                .attr("class", label.class)
                .attr("x", xScale(label.pos))
                .attr("y", -10)
                .style("text-anchor", "middle")
                .style("font-size", "11px")
                .style("font-weight", "bold")
                .style("fill", "#333")
                .text(label.text);
        });
        
        // Stage separators in header
        const positions = [0, this.stageDist.swim, this.stageDist.t1, this.stageDist.bike, this.stageDist.t2, 100];

    }
    
    drawYAxisScrollable(g, height, isMobile) {
        const yAxis = d3.axisLeft(this.yScale)
            .tickFormat(d => {
                if (d === 0) return 'Leader';
                if (isMobile) return Math.floor(d / 60) + 'm';
                return secondsToTime(d);
            })
            .ticks(isMobile ? 8 : 12);
        
        g.append("g")
            .attr("class", "y-axis")
            .call(yAxis);
    }
    
    drawGridScrollable(g, width, height) {
        // Vertical grid lines for stages
        const positions = [
            { pos: this.stageDist.swim, class: 'grid-line-swim' },
            { pos: this.stageDist.t1, class: 'grid-line-t1' },
            { pos: this.stageDist.bike, class: 'grid-line-bike' },
            { pos: this.stageDist.t2, class: 'grid-line-t2' }
        ];
        
        const gridGroup = g.append("g").attr("class", "vertical-grid");
        
        positions.forEach(item => {
            gridGroup.append("line")
                .attr("class", item.class)
                .attr("x1", this.xScale(item.pos))
                .attr("x2", this.xScale(item.pos))
                .attr("y1", 0)
                .attr("y2", height)
                .attr("stroke", "#e0e0e0")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3");
        });
        
        // Horizontal grid lines
        const yTicks = this.yScale.ticks(10);
        yTicks.forEach(tick => {
            g.append("line")
                .attr("x1", 0)
                .attr("x2", width)
                .attr("y1", this.yScale(tick))
                .attr("y2", this.yScale(tick))
                .attr("stroke", "#f0f0f0")
                .attr("stroke-width", 0.5);
        });
    }
    
    calculateStagePositions(racers) {
        const finishers = racers.filter(a => !['DNF', 'DSQ', 'LAP'].includes(a.status));
        
        const avgSwim = d3.mean(finishers, d => d.actualSwimTime || 0);
        const avgT1 = d3.mean(finishers, d => d.actualT1Time || 0);
        const avgBike = d3.mean(finishers, d => d.actualBikeTime || 0);
        const avgT2 = d3.mean(finishers, d => d.actualT2Time || 0);
        const avgRun = d3.mean(finishers, d => d.actualRunTime || 0);
        const totalAvg = avgSwim + avgT1 + avgBike + avgT2 + avgRun;
        
        const swimDist = (avgSwim / totalAvg) * 100;
        const t1Dist = swimDist + (avgT1 / totalAvg) * 100;
        const bikeDist = t1Dist + (avgBike / totalAvg) * 100;
        const t2Dist = bikeDist + (avgT2 / totalAvg) * 100;
        
        this.stageDist = { swim: swimDist, t1: t1Dist, bike: bikeDist, t2: t2Dist };
        
        const t1Width = t1Dist - swimDist;
        const t2Width = t2Dist - bikeDist;
        const t1Center = swimDist + t1Width / 2;
        const t2Center = bikeDist + t2Width / 2;
        const zoomWidth = 5;
        
        this.sectionBounds = {
            'all': { start: 0, end: 100, type: 'all' },
            'swim': { start: 0, end: t1Dist, type: 'swim' },
            't1': { start: Math.max(0, t1Center - zoomWidth/2), end: Math.min(100, t1Center + zoomWidth/2), type: 'transition' },
            'bike': { start: t1Dist, end: t2Dist, type: 'bike' },
            't2': { start: Math.max(0, t2Center - zoomWidth/2), end: Math.min(100, t2Center + zoomWidth/2), type: 'transition' },
            'run': { start: bikeDist, end: 100, type: 'run' }
        };
    }
    
    processChartData(racers) {
        this.chartData = racers.map(athlete => {
            const values = [{stage: "Start", distance: 0, timeBehind: 0, cumTime: 0}];
            
            if (athlete.actualSwimTime) {
                values.push({
                    stage: "Swim",
                    distance: this.stageDist.swim,
                    timeBehind: athlete.swimCumulative - this.stageLeaderTimes.swim,
                    cumTime: athlete.swimCumulative
                });
            }
            if (athlete.actualT1Time) {
                values.push({
                    stage: "T1",
                    distance: this.stageDist.t1,
                    timeBehind: athlete.t1Cumulative - this.stageLeaderTimes.t1,
                    cumTime: athlete.t1Cumulative
                });
            }
            if (athlete.actualBikeTime) {
                values.push({
                    stage: "Bike",
                    distance: this.stageDist.bike,
                    timeBehind: athlete.bikeCumulative - this.stageLeaderTimes.bike,
                    cumTime: athlete.bikeCumulative
                });
            }
            if (athlete.actualT2Time) {
                values.push({
                    stage: "T2",
                    distance: this.stageDist.t2,
                    timeBehind: athlete.t2Cumulative - this.stageLeaderTimes.t2,
                    cumTime: athlete.t2Cumulative
                });
            }
            if (athlete.actualRunTime) {
                values.push({
                    stage: "Finish",
                    distance: 100,
                    timeBehind: athlete.totalCumulative - this.stageLeaderTimes.finish,
                    cumTime: athlete.totalCumulative
                });
            }
            
            return {
                name: athlete.name,
                country: athlete.country,
                athleteIndex: racers.indexOf(athlete),
                athlete: athlete,
                status: athlete.status,
                values: values
            };
        });
    }
    
    drawTransitionLines(g, height) {
        const transitionLines = g.append("g")
            .attr("class", "transition-lines");
        
        const positions = [
            { x: this.stageDist.swim, class: 'transition-line-t1-start' },
            { x: this.stageDist.t1, class: 'transition-line-t1-end' },
            { x: this.stageDist.bike, class: 'transition-line-t2-start' },
            { x: this.stageDist.t2, class: 'transition-line-t2-end' }
        ];
        
        positions.forEach(trans => {
            transitionLines.append("line")
                .attr("class", trans.class)
                .attr("x1", this.xScale(trans.x))
                .attr("x2", this.xScale(trans.x))
                .attr("y1", 0)
                .attr("y2", height)
                .attr("stroke", "#e0e0e0")
                .attr("stroke-width", 1)
                .attr("stroke-dasharray", "3,3")
                .attr("opacity", 0.8);
        });
    }
    
    drawAthletePaths(chartContent) {
        this.chartData.forEach((athlete) => {
            const isVisible = this.athleteVisibility[athlete.name] !== false;
            const strokeDasharray = this.getStrokeDasharray(athlete.status);
            
            // Invisible hit area
            const hitArea = chartContent.append("path")
                .datum(athlete.values)
                .attr("class", `athlete-path-hitarea athlete-path-hitarea-${athlete.athleteIndex}`)
                .attr("d", this.lineGenerator)
                .attr("fill", "none")
                .attr("stroke", "transparent")
                .attr("stroke-width", 10)
                .attr("pointer-events", "stroke")
                .classed("hidden", !isVisible);
            
            // Visible path
            chartContent.append("path")
                .datum(athlete.values)
                .attr("class", `athlete-path athlete-path-${athlete.athleteIndex}`)
                .attr("d", this.lineGenerator)
                .attr("fill", "none")
                .attr("stroke", this.colorScale(athlete.name))
                .attr("stroke-width", 1.5)
                .attr("opacity", 0.4)
                .attr("stroke-dasharray", strokeDasharray)
                .attr("pointer-events", "none")
                .classed("hidden", !isVisible);
            
            // Add hover events
            this.addPathHoverEvents(hitArea, athlete);
            
            // Draw circles at each stage point
            this.drawStageCircles(chartContent, athlete, isVisible);
        });
    }
    
    addPathHoverEvents(hitArea, athlete) {
        const isMobile = responsiveManager.isMobile || window.innerWidth <= 768;
        
        // Long press handler for hypothetical analysis
        let longPressTimer;
        let touchStartTime = 0;
        let hasMoved = false;
        
        hitArea.on("touchstart", (event) => {
            event.preventDefault();
            touchStartTime = Date.now();
            hasMoved = false;
            
            longPressTimer = setTimeout(() => {
                if (this.onAthleteClick && !hasMoved) {
                    this.onAthleteClick(athlete.athlete, 'Finish');
                    if (navigator.vibrate) navigator.vibrate(50);
                }
            }, 600);
        })
        .on("touchmove", () => {
            hasMoved = true;
            if (longPressTimer) clearTimeout(longPressTimer);
        })
        .on("touchend touchcancel", (event) => {
            if (longPressTimer) clearTimeout(longPressTimer);
            
            const touchDuration = Date.now() - touchStartTime;
            if (touchDuration < 300 && !hasMoved) {
                event.preventDefault();
                this.showLineTooltip(event, athlete);
            }
        });
        
        // Desktop events
        hitArea.on("mousedown", () => {
            longPressTimer = setTimeout(() => {
                if (this.onAthleteClick) {
                    this.onAthleteClick(athlete.athlete, 'Finish');
                }
            }, 500);
        })
        .on("mouseup", () => {
            if (longPressTimer) clearTimeout(longPressTimer);
        });
        
        hitArea.on("mouseover", (event) => {
            d3.selectAll(`.athlete-path-${athlete.athleteIndex}`)
                .style("stroke-width", "3px")
                .style("opacity", "1");
            d3.selectAll(`.athlete-circle-${athlete.athleteIndex}`)
                .attr("r", 5)
                .attr("opacity", 1);
            
            this.showLineTooltip(event, athlete);
        })
        .on("mouseout", () => {
            d3.selectAll(`.athlete-path-${athlete.athleteIndex}`)
                .style("stroke-width", "1.5px")
                .style("opacity", "0.4");
            d3.selectAll(`.athlete-circle-${athlete.athleteIndex}`)
                .attr("r", 4)
                .attr("opacity", 0.8);
            
            tooltipManager.hide();
        });
    }

    showLineTooltip(event, athlete) {
        const content = this.createLineTooltipContent(athlete.athlete);
        const x = event.pageX || (event.touches && event.touches[0] ? event.touches[0].pageX : 0);
        const y = event.pageY || (event.touches && event.touches[0] ? event.touches[0].pageY : 0);
        
        tooltipManager.show(content, x, y);
    }

    createLineTooltipContent(athlete) {
        const name = athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '');
        
        let html = `<table style="width: 100%; border-collapse: collapse; font-size: 11px;">`;
        html += `<thead><tr style="background: rgba(255,255,255,0.1);">`;
        html += `<th colspan="3" style="padding: 6px; text-align: left; font-size: 13px;">`;
        html += `${name} - #${athlete.finalRank || 'N/A'} - ${secondsToTime(athlete.actualTotalTime || 0)}`;
        html += `</th></tr>`;
        html += `<tr style="font-size: 10px; opacity: 0.8;">`;
        html += `<th style="padding: 3px;">Segment</th>`;
        html += `<th style="padding: 3px; text-align: right;">Time</th>`;
        html += `<th style="padding: 3px; text-align: right;">Rank (Pace)</th>`;
        html += `</tr></thead><tbody>`;
        
        // Swim
        if (athlete.actualSwimTime) {
            const swimPace = RaceConfig.getSwimPace(athlete.actualSwimTime);
            html += `<tr>`;
            html += `<td style="padding: 4px;">Swim</td>`;
            html += `<td style="padding: 4px; text-align: right;">${secondsToTime(athlete.actualSwimTime)}</td>`;
            html += `<td style="padding: 4px; text-align: right;">#${athlete.swimRank || 'N/A'} (${secondsToTime(swimPace)}/100m)</td>`;
            html += `</tr>`;
        }
        
        // T1
        if (athlete.actualT1Time) {
            html += `<tr>`;
            html += `<td style="padding: 4px;">T1</td>`;
            html += `<td style="padding: 4px; text-align: right;">${secondsToTime(athlete.actualT1Time)}</td>`;
            html += `<td style="padding: 4px; text-align: right;">#${athlete.t1Rank || 'N/A'}</td>`;
            html += `</tr>`;
        }
        
        // Bike
        if (athlete.actualBikeTime) {
            const bikeSpeed = RaceConfig.getBikeSpeed(athlete.actualBikeTime);
            html += `<tr>`;
            html += `<td style="padding: 4px;">Bike</td>`;
            html += `<td style="padding: 4px; text-align: right;">${secondsToTime(athlete.actualBikeTime)}</td>`;
            html += `<td style="padding: 4px; text-align: right;">#${athlete.bikeRank || 'N/A'} (${bikeSpeed.toFixed(1)} km/h)</td>`;
            html += `</tr>`;
        }
        
        // T2
        if (athlete.actualT2Time) {
            html += `<tr>`;
            html += `<td style="padding: 4px;">T2</td>`;
            html += `<td style="padding: 4px; text-align: right;">${secondsToTime(athlete.actualT2Time)}</td>`;
            html += `<td style="padding: 4px; text-align: right;">#${athlete.t2Rank || 'N/A'}</td>`;
            html += `</tr>`;
        }
        
        // Run
        if (athlete.actualRunTime) {
            const runPace = RaceConfig.getRunPace(athlete.actualRunTime);
            const paceStr = `${Math.floor(runPace)}:${Math.round((runPace % 1) * 60).toString().padStart(2, '0')}`;
            html += `<tr>`;
            html += `<td style="padding: 4px;">Run</td>`;
            html += `<td style="padding: 4px; text-align: right;">${secondsToTime(athlete.actualRunTime)}</td>`;
            html += `<td style="padding: 4px; text-align: right;">#${athlete.finalRank || '-'} (${paceStr}/km)</td>`;
            html += `</tr>`;
        }
        
        html += `</tbody></table>`;
        
        return html;
    }
        
    drawStageCircles(chartContent, athlete, isVisible) {
        const isMobile = responsiveManager.isMobile || window.innerWidth <= 768;
        
        athlete.values.forEach((point) => {
            const circle = chartContent.append("circle")
                .attr("class", `athlete-circle athlete-circle-${athlete.athleteIndex}`)
                .attr("data-x", point.distance)
                .attr("data-y", point.timeBehind)
                .attr("data-stage", point.stage)
                .attr("cx", this.xScale(point.distance))
                .attr("cy", this.yScale(point.timeBehind))
                .attr("r", isMobile ? 6 : 4) // Larger touch target on mobile
                .attr("fill", this.colorScale(athlete.name))
                .style("cursor", "pointer")
                .classed("hidden", !isVisible);
            
            // Long-press for hypothetical analysis
            let longPressTimer;
            let touchStartTime = 0;
            let hasMoved = false;
            
            // Mouse events (desktop)
            circle.on("mousedown", () => {
                longPressTimer = setTimeout(() => {
                    if (this.onAthleteClick) {
                        this.onAthleteClick(athlete.athlete, point.stage);
                    }
                }, 500);
            })
            .on("mouseup mouseleave", () => {
                if (longPressTimer) clearTimeout(longPressTimer);
            });
            
            // Touch events (mobile)
            circle.on("touchstart", (event) => {
                event.preventDefault(); // Prevent scroll
                touchStartTime = Date.now();
                hasMoved = false;
                
                longPressTimer = setTimeout(() => {
                    if (this.onAthleteClick && !hasMoved) {
                        this.onAthleteClick(athlete.athlete, point.stage);
                        // Provide haptic feedback if available
                        if (navigator.vibrate) {
                            navigator.vibrate(50);
                        }
                    }
                }, 600); // Slightly longer for touch
            })
            .on("touchmove", () => {
                hasMoved = true;
                if (longPressTimer) clearTimeout(longPressTimer);
            })
            .on("touchend touchcancel", (event) => {
                if (longPressTimer) clearTimeout(longPressTimer);
                
                // Show tooltip on short tap
                const touchDuration = Date.now() - touchStartTime;
                if (touchDuration < 300 && !hasMoved) {
                    event.preventDefault();
                    this.showCircleTooltip(event, athlete, point);
                }
            });
            
            // Desktop hover events
            circle.on("mouseover", (event) => {
                if (isMobile) return; // Skip on mobile
                
                d3.selectAll(`.athlete-path-${athlete.athleteIndex}`)
                    .attr("stroke-width", 3)
                    .attr("opacity", 1);
                d3.select(event.target).attr("r", 6);
                
                this.showCircleTooltip(event, athlete, point);
            })
            .on("mouseout", (event) => {
                if (isMobile) return;
                
                d3.selectAll(`.athlete-path-${athlete.athleteIndex}`)
                    .attr("stroke-width", 1.5)
                    .attr("opacity", 0.4);
                d3.select(event.target).attr("r", 4);
                tooltipManager.hide();
            });
        });
    }

    showCircleTooltip(event, athlete, point) {
        const leaderTimeAtStage = this.getLeaderTimeAtStage(point.stage);
        const timeBehindLeader = point.cumTime - leaderTimeAtStage;
        const content = this.createCircleTooltipContent(athlete.athlete, point.stage, timeBehindLeader);
        
        const isNearRightEdge = point.stage === 'Finish' || this.xScale(point.distance) > this.dimensions.width * 0.8;
        
        // Get position from event
        const x = event.pageX || (event.touches && event.touches[0] ? event.touches[0].pageX : 0);
        const y = event.pageY || (event.touches && event.touches[0] ? event.touches[0].pageY : 0);
        
        tooltipManager.show(content, x, y, { preferLeft: isNearRightEdge });
    }

    createCircleTooltipContent(athlete, highlightStage, timeBehindLeaderAtStage) {
        const name = athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '');
        
        let html = `<table style="width: 100%; border-collapse: collapse; font-size: 11px;">`;
        html += `<thead><tr style="background: rgba(255,255,255,0.1);">`;
        html += `<th colspan="3" style="padding: 6px; text-align: left; font-size: 13px;">`;
        html += `${name} - #${athlete.finalRank || 'N/A'} - ${secondsToTime(athlete.actualTotalTime || 0)}`;
        html += `</th></tr></thead><tbody>`;
        
        const stages = [
            { name: 'Swim', time: athlete.actualSwimTime, behind: athlete.swimCumulative - this.stageLeaderTimes.swim },
            { name: 'T1', time: athlete.actualT1Time, behind: athlete.t1Cumulative - this.stageLeaderTimes.t1 },
            { name: 'Bike', time: athlete.actualBikeTime, behind: athlete.bikeCumulative - this.stageLeaderTimes.bike },
            { name: 'T2', time: athlete.actualT2Time, behind: athlete.t2Cumulative - this.stageLeaderTimes.t2 },
            { name: 'Run', time: athlete.actualRunTime, behind: athlete.totalCumulative - this.stageLeaderTimes.finish }
        ];
        
        stages.forEach(stage => {
            if (!stage.time) return;
            
            const isHighlighted = stage.name === highlightStage || 
                                (highlightStage === 'Finish' && stage.name === 'Run');
            const bgColor = isHighlighted ? 'rgba(255,255,0,0.3)' : 'transparent';
            const fontWeight = isHighlighted ? 'bold' : 'normal';
            
            const behindText = stage.behind <= 0 ? 'Leader' : `+${secondsToTime(stage.behind)}`;
            
            html += `<tr style="background: ${bgColor};">`;
            html += `<td style="padding: 4px; font-weight: ${fontWeight};">${stage.name}</td>`;
            html += `<td style="padding: 4px; text-align: right;">${secondsToTime(stage.time)}</td>`;
            html += `<td style="padding: 4px; text-align: right; color: ${stage.behind <= 0 ? '#4ade80' : '#fbbf24'};">${behindText}</td>`;
            html += `</tr>`;
        });
        
        html += `</tbody></table>`;
        
        const isMobile = responsiveManager.isMobile || window.innerWidth <= 768;
        if (!isMobile) {
            html += `<div style="margin-top: 8px; font-size: 10px; opacity: 0.7; text-align: center;">Long press for hypothetical analysis</div>`;
        }
        
        return html;
    }    
    getLeaderTimeAtStage(stage) {
        switch(stage) {
            case 'Swim': return this.stageLeaderTimes.swim;
            case 'T1': return this.stageLeaderTimes.t1;
            case 'Bike': return this.stageLeaderTimes.bike;
            case 'T2': return this.stageLeaderTimes.t2;
            case 'Finish': return this.stageLeaderTimes.finish;
            default: return 0;
        }
    }
    
    drawTeamHighlights() {
        if (!this.g || !this.chartData) return;
        
        this.g.selectAll(".team-highlight-path").remove();
        
        const selectedCountries = Object.keys(this.countryVisibility)
            .filter(country => this.countryVisibility[country] === 'selected');
        
        if (selectedCountries.length === 0) return;
        
        let highlightLayer = this.g.select(".team-highlight-layer");
        if (highlightLayer.empty()) {
            highlightLayer = this.g.select(".chart-content")
                .insert("g", ":first-child")
                .attr("class", "team-highlight-layer")
                .attr("clip-path", "url(#chart-clip)");
        }
        
        selectedCountries.forEach(country => {
            const teamColor = this.getTeamColor(country);
            
            this.chartData.forEach((athlete) => {
                if (athlete.country === country && this.athleteVisibility[athlete.name]) {
                    highlightLayer.append("path")
                        .datum(athlete.values)
                        .attr("class", `team-highlight-path team-highlight-${country}`)
                        .attr("d", this.lineGenerator)
                        .attr("fill", "none")
                        .attr("stroke", teamColor)
                        .attr("stroke-width", 6)
                        .attr("opacity", 0.4)
                        .attr("pointer-events", "none");
                }
            });
        });
    }
    
    getTeamColor(country) {
        if (!this.teamColors[country]) {
            this.teamColors[country] = ChartConfig.teamColorPalette[this.teamColorIndex % ChartConfig.teamColorPalette.length];
            this.teamColorIndex++;
        }
        return this.teamColors[country];
    }

    update() {
        if (!this.xScale || !this.yScale || !this.chartData) return;
        
        if (this.currentSection !== 'zoom') {
            const bounds = this.sectionBounds[this.currentSection];
            if (!bounds) return;
            
            this.xScale.domain([bounds.start, bounds.end]);
            
            // Calculate Y range for visible athletes in this section
            let relevantData = [];
            this.chartData.forEach(athlete => {
                const isVisible = this.athleteVisibility[athlete.name] !== false;
                if (isVisible) {
                    athlete.values.forEach(point => {
                        if (point.distance >= bounds.start && point.distance <= bounds.end) {
                            relevantData.push(point.timeBehind);
                        }
                    });
                }
            });
            
            if (relevantData.length > 0) {
                const minTime = d3.min(relevantData);
                const maxTime = d3.max(relevantData);
                const padding = Math.max(5, (maxTime - minTime) * 0.1);
                this.yScale.domain([Math.max(0, minTime - padding), maxTime + padding]);
            } else {
                this.yScale.domain(this.originalYScale.domain());
            }
        }
        
        const duration = 750;
        const isMobile = responsiveManager.isMobile;
        
        // Update axes (for standard chart)
        if (!this.useScrollable) {
            this.g.select(".x-axis")
                .transition()
                .duration(duration)
                .call(d3.axisBottom(this.xScale).tickFormat(""));
            
            this.g.select(".y-axis")
                .transition()
                .duration(duration)
                .call(d3.axisLeft(this.yScale)
                    .tickFormat(d => {
                        if (d === 0) return 'Leader';
                        return isMobile ? Math.floor(d / 60).toString() : secondsToTime(d);
                    })
                    .ticks(isMobile ? 5 : 10)
                );
            
            // Update grids
            this.g.select(".grid-x")
                .transition()
                .duration(duration)
                .call(d3.axisBottom(this.xScale).tickSize(-this.dimensions.height).tickFormat(""));
            
            this.g.select(".grid-y")
                .transition()
                .duration(duration)
                .call(d3.axisLeft(this.yScale).tickSize(-this.dimensions.width).tickFormat(""));
        }
        
        // Update x-axis header labels and dividers for scrollable chart
        if (this.useScrollable && this.headerG) {
            this.updateXAxisLabelsScrollable(this.headerG);
        } else if (!this.useScrollable) {
            this.updateXAxisLabels(this.g.select('.x-labels'));
        }
        
        // Update transition lines (grid lines at T1/T2)
        const transitionUpdates = [
            { class: '.transition-line-t1-start', pos: this.stageDist.swim },
            { class: '.transition-line-t1-end', pos: this.stageDist.t1 },
            { class: '.transition-line-t2-start', pos: this.stageDist.bike },
            { class: '.transition-line-t2-end', pos: this.stageDist.t2 }
        ];
        
        transitionUpdates.forEach(trans => {
            this.g.select(trans.class)
                .transition()
                .duration(duration)
                .attr("x1", this.xScale(trans.pos))
                .attr("x2", this.xScale(trans.pos));
        });
        
        // Update scrollable grid lines
        if (this.useScrollable) {
            const gridUpdates = [
                { class: '.grid-line-swim', pos: this.stageDist.swim },
                { class: '.grid-line-t1', pos: this.stageDist.t1 },
                { class: '.grid-line-bike', pos: this.stageDist.bike },
                { class: '.grid-line-t2', pos: this.stageDist.t2 }
            ];
            
            gridUpdates.forEach(item => {
                this.g.select(item.class)
                    .transition()
                    .duration(duration)
                    .attr("x1", this.xScale(item.pos))
                    .attr("x2", this.xScale(item.pos));
            });
        }
        
        // Update line generator
        this.lineGenerator
            .x(d => this.xScale(d.distance))
            .y(d => this.yScale(d.timeBehind));
        
        // Update paths
        this.g.select(".chart-content").selectAll(".athlete-path")
            .transition()
            .duration(duration)
            .attr("d", this.lineGenerator);
        
        this.g.select(".chart-content").selectAll(".athlete-path-hitarea")
            .transition()
            .duration(duration)
            .attr("d", this.lineGenerator);
        
        // Update circles
        const self = this;
        this.g.select(".chart-content").selectAll(".athlete-circle")
            .transition()
            .duration(duration)
            .attr("cx", function() {
                const x = parseFloat(d3.select(this).attr("data-x"));
                return self.xScale(x);
            })
            .attr("cy", function() {
                const y = parseFloat(d3.select(this).attr("data-y"));
                return self.yScale(y);
            });
        
        // Update team highlights
        this.drawTeamHighlights();
        
        // Update main x-axis label (for standard chart)
        if (!this.useScrollable) {
            this.updateMainXAxisLabel();
        }
    }
    
    updateXAxisLabelsScrollable(container) {
        const bounds = this.sectionBounds[this.currentSection];
        if (!bounds) return;
        
        const labels = ['swim', 't1', 'bike', 't2', 'run'];
        const labelData = {
            'swim': { pos: this.stageDist.swim / 2, text: 'SWIM' },
            't1': { pos: (this.stageDist.swim + this.stageDist.t1) / 2, text: 'T1' },
            'bike': { pos: (this.stageDist.t1 + this.stageDist.bike) / 2, text: 'BIKE' },
            't2': { pos: (this.stageDist.bike + this.stageDist.t2) / 2, text: 'T2' },
            'run': { pos: (this.stageDist.t2 + 100) / 2, text: 'RUN' }
        };
        
        // Update label positions and visibility
        labels.forEach(label => {
            const data = labelData[label];
            const isInView = data.pos >= bounds.start && data.pos <= bounds.end;
            
            container.select(`.x-label-${label}`)
                .transition()
                .duration(750)
                .attr("x", this.xScale(data.pos))
                .style("display", this.currentSection === 'all' || isInView ? "block" : "none");
        });
        
        // Update header dividers
        const dividerPositions = [0, this.stageDist.swim, this.stageDist.t1, this.stageDist.bike, this.stageDist.t2, 100];
        
        // Update header background
        container.select('.header-bg')
            .transition()
            .duration(750)
            .attr('width', this.dimensions.width);
    }
    
    updateXAxisLabels(container) {
        const bounds = this.sectionBounds[this.currentSection];
        if (!bounds) return;
        
        const labels = ['swim', 't1', 'bike', 't2', 'run'];
        const labelData = {
            'swim': { pos: this.stageDist.swim / 2, text: 'Swim' },
            't1': { pos: (this.stageDist.swim + this.stageDist.t1) / 2, text: 'T1' },
            'bike': { pos: (this.stageDist.t1 + this.stageDist.bike) / 2, text: 'Bike' },
            't2': { pos: (this.stageDist.bike + this.stageDist.t2) / 2, text: 'T2' },
            'run': { pos: (this.stageDist.t2 + 100) / 2, text: 'Run' }
        };
        
        labels.forEach(label => {
            const data = labelData[label];
            const isInView = data.pos >= bounds.start && data.pos <= bounds.end;
            
            container.select(`.x-label-${label}`)
                .transition()
                .duration(750)
                .attr("x", this.xScale(data.pos))
                .style("display", this.currentSection === 'all' || isInView ? "block" : "none");
        });
    }
    
    updateMainXAxisLabel() {
        if (this.currentSection === 'all') {
            this.g.select(".x-axis-label").text("Race Progress");
        } else if (this.currentSection === 'zoom') {
            this.g.select(".x-axis-label").text("Race Progress (Zoomed)");
        } else {
            let leader, time, section;
            switch(this.currentSection) {
                case 'swim':
                    leader = this.segmentLeaders.swim;
                    time = leader?.actualSwimTime;
                    section = 'Swim';
                    break;
                case 't1':
                    leader = this.segmentLeaders.t1;
                    time = leader?.actualT1Time;
                    section = 'T1';
                    break;
                case 'bike':
                    leader = this.segmentLeaders.bike;
                    time = leader?.actualBikeTime;
                    section = 'Bike';
                    break;
                case 't2':
                    leader = this.segmentLeaders.t2;
                    time = leader?.actualT2Time;
                    section = 'T2';
                    break;
                case 'run':
                    leader = this.segmentLeaders.run;
                    time = leader?.actualRunTime;
                    section = 'Run';
                    break;
            }
            
            if (leader) {
                const leaderName = leader.baseName || leader.name.split(' ')[1] || leader.name;
                this.g.select(".x-axis-label")
                    .html(`${section} Progress - Leader: ${leaderName} (${secondsToTime(time)})`);
            }
        }
    }



    showSection(section) {
        if (section === 'zoom') {
            if (this.useScrollable) {
                alert('Zoom mode is not available in scrollable view.');
                return;
            }
        } else {

            this.currentSection = section;
            this.update();
        }
    }

    showAllAthletes(show) {
        const countries = [...new Set(this.data.map(d => d.country))];
        countries.forEach(country => {
            this.countryVisibility[country] = show;
        });
        
        if (!show) {
            this.teamColors = {};
            this.teamColorIndex = 0;
        }
        
        this.data.forEach((athlete, index) => {
            this.athleteVisibility[athlete.name] = show;
            d3.selectAll(`.athlete-path-${index}`).classed("hidden", !show);
            d3.selectAll(`.athlete-path-hitarea-${index}`).classed("hidden", !show);
            d3.selectAll(`.athlete-circle-${index}`).classed("hidden", !show);
        });
        
        this.update();
        this.drawTeamHighlights();
    }
    
    toggleAthlete(athleteName, athleteIndex) {
        this.athleteVisibility[athleteName] = !this.athleteVisibility[athleteName];
        const isVisible = this.athleteVisibility[athleteName];
        
        d3.selectAll(`.athlete-path-${athleteIndex}`).classed("hidden", !isVisible);
        d3.selectAll(`.athlete-path-hitarea-${athleteIndex}`).classed("hidden", !isVisible);
        d3.selectAll(`.athlete-circle-${athleteIndex}`).classed("hidden", !isVisible);
        
        this.update();
    }
    
    toggleCountry(country) {
        if (this.countryVisibility[country] === 'selected') {
            this.countryVisibility[country] = false;
            
            this.chartData.forEach((athlete) => {
                if (athlete.country === country) {
                    this.athleteVisibility[athlete.name] = false;
                    d3.selectAll(`.athlete-path-${athlete.athleteIndex}`).classed("hidden", true);
                    d3.selectAll(`.athlete-path-hitarea-${athlete.athleteIndex}`).classed("hidden", true);
                    d3.selectAll(`.athlete-circle-${athlete.athleteIndex}`).classed("hidden", true);
                }
            });
        } else {
            this.countryVisibility[country] = 'selected';
            
            this.chartData.forEach((athlete) => {
                if (athlete.country === country) {
                    this.athleteVisibility[athlete.name] = true;
                    d3.selectAll(`.athlete-path-${athlete.athleteIndex}`).classed("hidden", false);
                    d3.selectAll(`.athlete-path-hitarea-${athlete.athleteIndex}`).classed("hidden", false);
                    d3.selectAll(`.athlete-circle-${athlete.athleteIndex}`).classed("hidden", false);
                }
            });
        }
        
        this.update();
        this.drawTeamHighlights();
    }
    
    resetZoom() {
        if (this.originalXScale && this.originalYScale) {
            this.disableZoomMode();
            this.xScale.domain(this.originalXScale.domain());
            this.yScale.domain(this.originalYScale.domain());
            this.currentSection = 'all';
            this.update();
        }
    }
}