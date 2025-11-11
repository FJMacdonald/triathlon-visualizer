import { BaseChart } from './base-chart.js';
import { ChartConfig } from '../config/chart-config.js';
import { tooltipManager } from '../ui/tooltips.js';
import { secondsToTime } from '../utils/formatters.js';
import { responsiveManager } from '../utils/responsive.js';

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
        this.zoomMode = false;
        this.onAthleteClick = null;
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
        
        // Restore visibility for all paths and circles based on current state
        this.data.forEach((athlete, index) => {
            const isVisible = this.athleteVisibility[athlete.name] !== false;
            d3.selectAll(`.athlete-path-${index}`).classed("hidden", !isVisible);
            d3.selectAll(`.athlete-path-hitarea-${index}`).classed("hidden", !isVisible);
            d3.selectAll(`.athlete-circle-${index}`).classed("hidden", !isVisible);
        });
        
        // Redraw team highlights
        this.drawTeamHighlights();
        
        // Recalculate and update scales based on visible athletes
        this.update();
    }
    
    draw() {
        if (!this.data || this.data.length === 0) return;
        
        this.clear();
        
        const racers = this.data.filter(a => a.status !== 'DNS');
        const { svg, g, width, height, margin } = this.createSVG();
        const isMobile = responsiveManager.isMobile;
        
        // Add clipping path
        svg.append("defs")
            .append("clipPath")
            .attr("id", "chart-clip")
            .append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", height);
        
        // Calculate stage positions
        this.calculateStagePositions(racers);
        
        // Process chart data
        this.processChartData(racers);
        
        // Setup scales
        const maxTimeBehind = d3.max(this.chartData, d => d3.max(d.values, v => v.timeBehind));
        
        this.originalXScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, width]);
        
        this.originalYScale = d3.scaleLinear()
            .domain([-maxTimeBehind - 10, 10])
            .range([height, 0]);
        
        this.xScale = this.originalXScale.copy();
        this.yScale = this.originalYScale.copy();
        
        // Create line generator
        this.lineGenerator = d3.line()
            .x(d => this.xScale(d.distance))
            .y(d => this.yScale(-d.timeBehind))
            .curve(d3.curveLinear);
        
        // Setup axes
        this.setupAxes(this.xScale, this.yScale, "Race Progress", "Time Behind Leader");
        this.customizeAxes(g, width, height, isMobile);
        
        // Draw transition lines
        this.drawTransitionLines(g, height);
        
        // Create content group with clipping
        const chartContent = g.append("g")
            .attr("class", "chart-content")
            .attr("clip-path", "url(#chart-clip)");
        
        // Draw athlete paths
        this.drawAthletePaths(chartContent);

        // Draw athlete paths
        this.drawAthletePaths(chartContent);
        
        // Draw team highlights if any
        this.drawTeamHighlights();
        this.restoreState();
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
        const leader = racers.filter(a => !['DNF', 'DSQ', 'LAP'].includes(a.status))[0];
        
        this.chartData = racers.map(athlete => {
            const values = [{stage: "Start", distance: 0, timeBehind: 0, cumTime: 0}];
            
            if (athlete.actualSwimTime) {
                values.push({
                    stage: "Swim",
                    distance: this.stageDist.swim,
                    timeBehind: athlete.swimCumulative - leader.swimCumulative,
                    cumTime: athlete.swimCumulative
                });
            }
            if (athlete.actualT1Time) {
                values.push({
                    stage: "T1",
                    distance: this.stageDist.t1,
                    timeBehind: athlete.t1Cumulative - leader.t1Cumulative,
                    cumTime: athlete.t1Cumulative
                });
            }
            if (athlete.actualBikeTime) {
                values.push({
                    stage: "Bike",
                    distance: this.stageDist.bike,
                    timeBehind: athlete.bikeCumulative - leader.bikeCumulative,
                    cumTime: athlete.bikeCumulative
                });
            }
            if (athlete.actualT2Time) {
                values.push({
                    stage: "T2",
                    distance: this.stageDist.t2,
                    timeBehind: athlete.t2Cumulative - leader.t2Cumulative,
                    cumTime: athlete.t2Cumulative
                });
            }
            if (athlete.actualRunTime) {
                values.push({
                    stage: "Finish",
                    distance: 100,
                    timeBehind: athlete.totalCumulative - leader.totalCumulative,
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
    
    customizeAxes(g, width, height, isMobile) {
        // Customize x-axis with stage labels
        g.select(".x-axis")
            .call(d3.axisBottom(this.xScale)
                .tickValues([0, this.stageDist.swim, this.stageDist.t1, this.stageDist.bike, this.stageDist.t2, 100])
                .tickFormat("")
            );
        
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
        
        // Customize y-axis for time format
        g.select('.y-axis')
            .call(d3.axisLeft(this.yScale)
                .tickFormat(d => {
                    const absD = Math.abs(d);
                    if (isMobile) {
                        return Math.floor(absD / 60).toString();
                    }
                    return secondsToTime(absD);
                })
                .ticks(isMobile ? 5 : undefined)
            );
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
        this.chartData.forEach((athlete, index) => {
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
                .attr("stroke-dasharray", strokeDasharray)
                .attr("pointer-events", "none")
                .classed("hidden", !isVisible);
            
            // Add hover events to hit area
            this.addPathHoverEvents(hitArea, athlete);
            
            // Draw circles at each stage point
            this.drawStageCircles(chartContent, athlete, isVisible);
        });
    }
    
    addPathHoverEvents(hitArea, athlete) {
        hitArea.on("mouseover", (event) => {
            d3.selectAll(`.athlete-path-${athlete.athleteIndex}`)
                .style("stroke-width", "3px")
                .style("opacity", "1");
            d3.selectAll(`.athlete-circle-${athlete.athleteIndex}`)
                .attr("r", 5)
                .attr("opacity", 1);
            
            const athleteName = athlete.athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '');
            const finishTime = athlete.athlete.actualTotalTime || 0;
            const timeDiff = Math.abs(athlete.values[athlete.values.length - 1].timeBehind);
            
            const content = `
                <strong>${athleteName} (${athlete.athlete.finalRank || 'N/A'}) ${athlete.athlete.country}</strong><br/>
                Finish Time: ${secondsToTime(finishTime)}<br/>
                ${timeDiff > 0 ? `Behind Leader: ${secondsToTime(timeDiff)}` : 'Race Leader'}
            `;
            
            tooltipManager.show(content, window.innerWidth - 250, event.pageY);
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
    
    drawStageCircles(chartContent, athlete, isVisible) {
        athlete.values.forEach((point) => {
            const circle = chartContent.append("circle")
                .attr("class", `athlete-circle athlete-circle-${athlete.athleteIndex}`)
                .attr("data-x", point.distance)
                .attr("data-y", -point.timeBehind)
                .attr("data-stage", point.stage)
                .attr("cx", this.xScale(point.distance))
                .attr("cy", this.yScale(-point.timeBehind))
                .attr("r", 4)
                .attr("fill", this.colorScale(athlete.name))
                .style("cursor", "pointer")
                .classed("hidden", !isVisible);
            
            // Long-press for hypothetical analysis
            let longPressTimer;
            
            circle.on("mousedown", () => {
                longPressTimer = setTimeout(() => {
                    if (this.onAthleteClick) {
                        this.onAthleteClick(athlete.athlete, point.stage);
                    }
                }, 500);
            })
            .on("mouseup mouseleave", () => {
                if (longPressTimer) clearTimeout(longPressTimer);
            })
            .on("mouseover", (event) => {
                d3.selectAll(`.athlete-path-${athlete.athleteIndex}`)
                    .attr("stroke-width", 3)
                    .attr("opacity", 1);
                d3.select(event.target).attr("r", 6);
                
                // Calculate leader time at this stage
                const leaderTime = Math.min(...this.chartData
                    .filter(a => a.values.some(v => v.stage === point.stage))
                    .map(a => {
                        const stageData = a.values.find(v => v.stage === point.stage);
                        return stageData ? stageData.cumTime : Infinity;
                    }));
                
                const timeBehindLeader = point.cumTime - leaderTime;
                const content = tooltipManager.stagePoint(athlete.athlete, point.stage, point.cumTime, timeBehindLeader);
                
                // Position tooltip - check if near right edge
                const isNearRightEdge = point.stage === 'Finish' || this.xScale(point.distance) > this.dimensions.width * 0.8;
                tooltipManager.show(content, event.pageX, event.pageY, { preferLeft: isNearRightEdge });
            })
            .on("mouseout", (event) => {
                d3.selectAll(`.athlete-path-${athlete.athleteIndex}`)
                    .attr("stroke-width", 1.5)
                    .attr("opacity", 0.4);
                d3.select(event.target).attr("r", 4);
                tooltipManager.hide();
            });
        });
    }
    
    drawTeamHighlights() {
        if (!this.g || !this.chartData) return;
        
        // Remove existing highlights
        this.g.selectAll(".team-highlight-path").remove();
        
        // Find selected countries
        const selectedCountries = Object.keys(this.countryVisibility)
            .filter(country => this.countryVisibility[country] === 'selected');
        
        if (selectedCountries.length === 0) return;
        
        // Create highlight layer
        let highlightLayer = this.g.select(".team-highlight-layer");
        if (highlightLayer.empty()) {
            highlightLayer = this.g.select(".chart-content")
                .insert("g", ":first-child")
                .attr("class", "team-highlight-layer")
                .attr("clip-path", "url(#chart-clip)");
        }
        
        // Draw highlights for selected countries
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
            
            // Update X scale based on section
            this.xScale.domain([bounds.start, bounds.end]);
            
            // Calculate relevant Y range ONLY for VISIBLE athletes
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
            
            // If we have data, scale to it, otherwise use defaults
            if (relevantData.length > 0) {
                const minTime = d3.min(relevantData);
                const maxTime = d3.max(relevantData);
                // Add padding to make the chart more readable
                const padding = Math.max(5, (maxTime - minTime) * 0.1);
                this.yScale.domain([-(maxTime + padding), Math.max(10, -minTime + padding)]);
            } else {
                // No visible athletes, use original scale
                this.yScale.domain(this.originalYScale.domain());
            }
        }
        
        // Animate updates
        const duration = 750;
        const isMobile = responsiveManager.isMobile;
        
        // Update axes
        this.g.select(".x-axis")
            .transition()
            .duration(duration)
            .call(d3.axisBottom(this.xScale).tickFormat(""));
        
        this.g.select(".y-axis")
            .transition()
            .duration(duration)
            .call(d3.axisLeft(this.yScale)
                .tickFormat(d => {
                    const absD = Math.abs(d);
                    return isMobile ? Math.floor(absD / 60).toString() : secondsToTime(absD);
                })
                .ticks(isMobile ? 5 : undefined)
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
        
        // Update transition lines
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
        
        // Update line generator with current scales
        this.lineGenerator
            .x(d => this.xScale(d.distance))
            .y(d => this.yScale(-d.timeBehind));
        
        // Update paths
        this.g.select(".chart-content").selectAll(".athlete-path")
            .transition()
            .duration(duration)
            .attr("d", this.lineGenerator);
        
        this.g.select(".chart-content").selectAll(".athlete-path-hitarea")
            .transition()
            .duration(duration)
            .attr("d", this.lineGenerator);
        
        // Update circles with proper context
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
        
        // Update x-axis labels and title based on section
        if (this.currentSection === 'all') {
            this.g.selectAll(".x-labels text").style("display", "block");
            this.g.select(".x-axis-label").text("Race Progress");
        } else if (this.currentSection === 'zoom') {
            this.g.selectAll(".x-labels text").style("display", "none");
            this.g.select(".x-axis-label").text("Race Progress (Zoomed)");
        } else {
            this.g.selectAll(".x-labels text").style("display", "none");
            
            // Update label with segment leader info
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

    // Replace the enableZoomMode method with this fixed version:

    enableZoomMode() {
        this.currentSection = 'zoom';
        this.zoomMode = true;
        
        const zoomHint = document.getElementById('zoomHint');
        if (zoomHint) {
            zoomHint.classList.add('active');
            zoomHint.innerHTML = 'Hold <strong>Shift</strong> and drag to select area to zoom';
            zoomHint.style.background = 'rgba(102, 126, 234, 0.95)';
        }
        
        if (!this.svg || !this.dimensions) return;
        
        const margin = this.dimensions.margin;
        let isDragging = false;
        let overlayActive = false;
        let zoomRect = null;
        let zoomStartX = null;
        let zoomStartY = null;
        
        // Remove any existing overlay
        this.svg.select(".zoom-overlay").remove();
        this.svg.select(".zoom-selection").remove();
        
        const zoomOverlay = this.svg.append("rect")
            .attr("class", "zoom-overlay")
            .attr("x", margin.left)
            .attr("y", margin.top)
            .attr("width", this.dimensions.width)
            .attr("height", this.dimensions.height)
            .style("fill", "none")
            .style("pointer-events", "none")
            .style("cursor", "crosshair");
        
        const svgNode = this.svg.node();
        const self = this;
        
        // Store handlers so we can remove them later
        this.zoomKeydownHandler = function(event) {
            if (event.key === 'Shift' && self.zoomMode && !isDragging) {
                zoomOverlay.style("pointer-events", "all").classed("active", true);
                overlayActive = true;
                if (zoomHint) {
                    zoomHint.innerHTML = '✓ Shift held - Drag to select zoom area';
                    zoomHint.style.background = 'rgba(40, 167, 69, 0.95)';
                }
            }
        };
        
        this.zoomKeyupHandler = function(event) {
            if (event.key === 'Shift' && !isDragging) {
                zoomOverlay.style("pointer-events", "none").classed("active", false);
                overlayActive = false;
                if (zoomHint) {
                    zoomHint.innerHTML = 'Hold <strong>Shift</strong> and drag to select area to zoom';
                    zoomHint.style.background = 'rgba(102, 126, 234, 0.95)';
                }
            }
        };
        
        this.zoomMousemoveHandler = function(event) {
            if (!self.zoomMode || !isDragging || !zoomRect) return;
            
            const rect = svgNode.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            const currentX = Math.min(Math.max(margin.left, x), margin.left + self.dimensions.width);
            const currentY = Math.min(Math.max(margin.top, y), margin.top + self.dimensions.height);
            
            const startX = zoomStartX + margin.left;
            const startY = zoomStartY + margin.top;
            
            const width = Math.abs(currentX - startX);
            const height = Math.abs(currentY - startY);
            
            zoomRect
                .attr("x", Math.min(currentX, startX))
                .attr("y", Math.min(currentY, startY))
                .attr("width", width)
                .attr("height", height);
        };
        
        this.zoomMouseupHandler = function(event) {
            if (!self.zoomMode || !isDragging || !zoomRect) return;
            
            isDragging = false;
            
            const rect = svgNode.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            const endX = Math.min(Math.max(margin.left, x), margin.left + self.dimensions.width) - margin.left;
            const endY = Math.min(Math.max(margin.top, y), margin.top + self.dimensions.height) - margin.top;
            
            // Check if drag was significant (at least 20px in both directions)
            if (Math.abs(endX - zoomStartX) > 20 && Math.abs(endY - zoomStartY) > 20) {
                const x1 = Math.min(zoomStartX, endX);
                const x2 = Math.max(zoomStartX, endX);
                const y1 = Math.min(zoomStartY, endY);
                const y2 = Math.max(zoomStartY, endY);
                
                // Convert pixel coordinates to data coordinates
                const xDomain = [
                    self.xScale.invert(x1),
                    self.xScale.invert(x2)
                ];
                const yDomain = [
                    self.yScale.invert(y2),  // Inverted because y-axis is flipped
                    self.yScale.invert(y1)
                ];
                
                // Apply new domains
                self.xScale.domain(xDomain);
                self.yScale.domain(yDomain);
                
                // Update the chart
                self.update();
                
                if (zoomHint) {
                    zoomHint.innerHTML = 'Zoomed! Hold <strong>Shift</strong> to zoom again or click Reset';
                }
            }
            
            // Clean up
            self.svg.select(".zoom-selection").remove();
            if (!event.shiftKey) {
                zoomOverlay.style("pointer-events", "none").classed("active", false);
                overlayActive = false;
                if (zoomHint) {
                    zoomHint.innerHTML = 'Hold <strong>Shift</strong> and drag to select area to zoom';
                    zoomHint.style.background = 'rgba(102, 126, 234, 0.95)';
                }
            }
            zoomRect = null;
            zoomStartX = null;
            zoomStartY = null;
        };
        
        // Attach event listeners
        d3.select(window).on("keydown.zoom", this.zoomKeydownHandler);
        d3.select(window).on("keyup.zoom", this.zoomKeyupHandler);
        d3.select(window).on("mousemove.zoom", this.zoomMousemoveHandler);
        d3.select(window).on("mouseup.zoom", this.zoomMouseupHandler);
        
        zoomOverlay.on("mousedown", function(event) {
            if (!self.zoomMode || !overlayActive) return;
            
            isDragging = true;
            const [x, y] = d3.pointer(event, this);
            zoomStartX = x - margin.left;
            zoomStartY = y - margin.top;
            
            self.svg.select(".zoom-selection").remove();
            
            zoomRect = self.svg.append("rect")
                .attr("class", "zoom-selection")
                .attr("x", x)
                .attr("y", y)
                .attr("width", 0)
                .attr("height", 0);
            
            event.preventDefault();
        });
    }

    // Update disableZoomMode to clean up properly:

    disableZoomMode() {
        this.zoomMode = false;
        
        const zoomHint = document.getElementById('zoomHint');
        if (zoomHint) {
            zoomHint.classList.remove('active');
        }
        
        if (this.svg) {
            this.svg.select(".zoom-overlay").remove();
            this.svg.select(".zoom-selection").remove();
        }
        
        // Remove all event listeners
        d3.select(window).on("mousemove.zoom", null);
        d3.select(window).on("mouseup.zoom", null);
        d3.select(window).on("keydown.zoom", null);
        d3.select(window).on("keyup.zoom", null);
        
        // Clear handler references
        this.zoomKeydownHandler = null;
        this.zoomKeyupHandler = null;
        this.zoomMousemoveHandler = null;
        this.zoomMouseupHandler = null;
    }

    showSection(section) {
        if (section === 'zoom') {
            this.enableZoomMode();
            // Don't call update here - zoom mode will handle its own updates
        } else {
            this.disableZoomMode();
            this.currentSection = section;
            this.update();
        }
    }




    showAllAthletes(show) {
        const countries = [...new Set(this.data.map(d => d.country))];
        countries.forEach(country => {
            this.countryVisibility[country] = show;  // Reset to boolean, not 'selected'
        });
        
        // Reset team colors when hiding all
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
        this.drawTeamHighlights();  // This will clear highlights since no countries are 'selected'
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