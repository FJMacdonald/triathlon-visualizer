import { responsiveManager } from '../utils/responsive.js';

export const ChartConfig = {
    // Get margins based on chart type and device
    getMargins(chartType = 'default', isMobile = false, containerWidth = 800) {
        if (chartType === 'spider') {
            const margin = isMobile ? 40 : 60;
            return { top: margin, right: margin, bottom: margin, left: margin };
        }
        
        if (chartType === 'rank') {
            // Rank chart needs more space on right for names, less on left
            if (isMobile) {
                return {
                    top: 30,
                    right: Math.min(140, containerWidth * 0.35),
                    bottom: 50,
                    left: 40
                };
            }
            return {
                top: 40,
                right: Math.min(200, containerWidth * 0.2),
                bottom: 60,
                left: 60
            };
        }
        
        // Development chart - maximize width usage
        if (isMobile) {
            return {
                top: 30,
                right: 20,
                bottom: 50,
                left: 50
            };
        }
        
        return {
            top: 40,
            right: 30,
            bottom: 70,
            left: 80
        };
    },   
    // Calculate optimal dimensions for a chart
    getDimensions(containerId, chartType = 'default', data = null) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.warn(`Container ${containerId} not found`);
            return this.getDefaultDimensions(chartType);
        }
        
        const parent = container.parentElement;
        const { width: containerWidth, isMobile } = responsiveManager.getContainerDimensions(parent);
        const margin = this.getMargins(chartType, isMobile, containerWidth);
        
        if (chartType === 'spider') {
            // Spider chart should be square and smaller
            const maxSize = isMobile ? 
                Math.min(350, containerWidth - 40) : 
                Math.min(500, containerWidth * 0.5);
            const size = maxSize - margin.left - margin.right;
            return { width: size, height: size, margin };
        }
        
        // Calculate available width
        const availableWidth = containerWidth - 40; // 20px padding each side
        const width = availableWidth - margin.left - margin.right;
        
        // Calculate height based on chart type and data
        let height;
        if (chartType === 'rank' && data) {
            const rowHeight = isMobile ? 12 : 15;
            height = Math.max(400, data.length * rowHeight);
        } else {
            // Development chart - use viewport-based height
            const maxHeight = window.innerHeight * 0.7;
            height = isMobile ? 
                Math.min(500, maxHeight) : 
                Math.min(600, maxHeight);
        }
        
        height = height - margin.top - margin.bottom;
        
        return { width, height, margin };
    },
    
    getDefaultDimensions(chartType) {
        const isMobile = responsiveManager.isMobile;
        const margin = this.getMargins(chartType, isMobile);
        
        if (chartType === 'spider') {
            const size = isMobile ? 280 : 400;
            return { width: size, height: size, margin };
        }
        
        return {
            width: isMobile ? 300 : 800,
            height: isMobile ? 400 : 500,
            margin
        };
    },
    
    // Get font sizes based on device
    getFontSizes(isMobile = false) {
        if (isMobile) {
            return {
                axis: '10px',
                label: '12px',
                title: '16px',
                tooltip: '11px'
            };
        }
        return {
            axis: '12px',
            label: '14px',
            title: '24px',
            tooltip: '12px'
        };
    },
    
    // Common axis setup
    setupAxes(g, xScale, yScale, height, width, xLabel = null, yLabel = null, isMobile = false) {
        const fontSize = this.getFontSizes(isMobile);
        
        // X-axis grid
        g.append("g")
            .attr("class", "grid grid-x")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickSize(-height).tickFormat(""));
        
        // Y-axis grid
        g.append("g")
            .attr("class", "grid grid-y")
            .call(d3.axisLeft(yScale).tickSize(-width).tickFormat(""));
        
        // X-axis
        g.append("g")
            .attr("class", "x-axis axis")
            .attr("transform", `translate(0,${height})`)
            .call(d3.axisBottom(xScale));
        
        // Y-axis
        const yAxis = g.append("g")
            .attr("class", "y-axis axis")
            .call(d3.axisLeft(yScale));
        
        // Adjust tick count for mobile
        if (isMobile) {
            yAxis.call(d3.axisLeft(yScale).ticks(5));
        }
        
        // X-axis label
        if (xLabel) {
            g.append("text")
                .attr("class", "x-axis-label axis-label")
                .attr("transform", `translate(${width/2}, ${height + (isMobile ? 35 : 50)})`)
                .style("text-anchor", "middle")
                .style("font-size", fontSize.label)
                .text(xLabel);
        }
        
        // Y-axis label
        if (yLabel) {
            g.append("text")
                .attr("class", "y-axis-label axis-label")
                .attr("transform", "rotate(-90)")
                .attr("y", isMobile ? -40 : -70)
                .attr("x", -(height / 2))
                .attr("dy", "1em")
                .style("text-anchor", "middle")
                .style("font-size", fontSize.label)
                .text(yLabel);
        }
    },
    
    // Create color scale
    createColorScale(data) {
        const colors = [
            '#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00',
            '#a65628', '#f781bf', '#999999', '#66c2a5', '#fc8d62',
            '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494',
            '#b3b3b3', '#1b9e77', '#d95f02', '#7570b3', '#e7298a',
            '#66a61e', '#e6ab02', '#a6761d', '#666666'
        ];
        
        // Extend colors if needed
        while (colors.length < data.length) {
            colors.push(`hsl(${Math.random() * 360}, 70%, 50%)`);
        }
        
        return d3.scaleOrdinal()
            .domain(data.map(d => d.name))
            .range(colors);
    },
    
    // Team colors for highlighting
    teamColorPalette: [
        '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', 
        '#dfe6e9', '#a29bfe', '#fd79a8', '#fdcb6e', '#6c5ce7'
    ]
};