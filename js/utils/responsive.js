// Responsive utilities using ResizeObserver
export class ResponsiveManager {
    constructor() {
        this.observers = new Map();
        this.isMobile = this.checkMobile();
        this.setupWindowListener();
    }
    
    checkMobile() {
        return window.innerWidth <= 768;
    }
    
    setupWindowListener() {
        window.addEventListener('resize', this.debounce(() => {
            this.isMobile = this.checkMobile();
            this.notifyAll();
        }, 250));
    }
    
    observe(element, callback) {
        if (!element) return;
        
        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                callback(entry.contentRect, this.isMobile);
            }
        });
        
        observer.observe(element);
        this.observers.set(element, { observer, callback });
    }
    
    unobserve(element) {
        const data = this.observers.get(element);
        if (data) {
            data.observer.disconnect();
            this.observers.delete(element);
        }
    }
    
    notifyAll() {
        this.observers.forEach(({ callback }, element) => {
            const rect = element.getBoundingClientRect();
            callback(rect, this.isMobile);
        });
    }
    
    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    getContainerDimensions(element) {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        
        return {
            width: rect.width - paddingX,
            height: rect.height - paddingY,
            isMobile: this.isMobile
        };
    }
}

export const responsiveManager = new ResponsiveManager();