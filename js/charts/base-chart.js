import { ChartConfig } from '../config/chart-config.js';
import { responsiveManager } from '../utils/responsive.js';

export class BaseChart {
    constructor(containerId, chartType = 'default') {
        this.containerId = containerId;
        this.chartType = chartType;
        this.container = document.getElementById(containerId);
        this.svg = null;
        this.g = null;
        this.data = null;
        this.colorScale = null;
        this.dimensions = null;
        
        // Set up resize observer
        this.setupResizeObserver();
    }
    
    setupResizeObserver() {
        if (this.container) {
            responsiveManager.observe(this.container.parentElement, (rect, isMobile) => {
                if (this.data) {
                    this.redraw();
                }
            });
        }
    }
    
    setData(data) {
        this.data = data;
    }
    
    setColorScale(colorScale) {
        this.colorScale = colorScale;
    }
    
    getDimensions() {
        return ChartConfig.getDimensions(this.containerId, this.chartType, this.data);
    }
    
    clear() {
        d3.select(`#${this.containerId}`).selectAll("*").remove();
        this.svg = null;
        this.g = null;
    }
    
    createSVG() {
        this.dimensions = this.getDimensions();
        const { width, height, margin } = this.dimensions;
        
        this.svg = d3.select(`#${this.containerId}`)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom);
        
        this.g = this.svg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);
        
        return { svg: this.svg, g: this.g, width, height, margin };
    }
    
    setupAxes(xScale, yScale, xLabel = null, yLabel = null) {
        if (!this.g || !this.dimensions) return;
        
        const { width, height } = this.dimensions;
        const isMobile = responsiveManager.isMobile;
        
        ChartConfig.setupAxes(this.g, xScale, yScale, height, width, xLabel, yLabel, isMobile);
    }
    
    getStrokeDasharray(status) {
        if (status === 'DSQ') return "3,3";
        if (status === 'DNF' || status === 'LAP') return "8,4";
        if (status === 'DNS') return "8,4";
        return "";
    }
    
    draw() {
        throw new Error('draw() must be implemented by subclass');
    }
    
    redraw() {
        this.clear();
        if (this.data) {
            this.draw();
        }
    }
    
    destroy() {
        if (this.container) {
            responsiveManager.unobserve(this.container.parentElement);
        }
        this.clear();
    }
}