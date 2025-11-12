import { getFlag } from '../utils/formatters.js';
import { responsiveManager } from '../utils/responsive.js';

export class SidebarManager {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.content = document.getElementById('sidebarContent');
        this.toggleBtn = document.getElementById('sidebarToggle'); // Renamed to avoid conflict
        this.mainContent = document.getElementById('mainContent');
        this.isOpen = false;
        this.athleteVisibilityRef = null;
        
        // Don't setup listeners here - let main.js handle it
    }
    
    toggleSidebar() {
        this.isOpen = !this.isOpen;
        
        if (this.sidebar) {
            this.sidebar.classList.toggle('open', this.isOpen);
        }
        
        if (this.mainContent && !responsiveManager.isMobile) {
            this.mainContent.classList.toggle('sidebar-open', this.isOpen);
        }
    }
    
    open() {
        if (!this.isOpen) {
            this.toggleSidebar();
        }
    }
    
    close() {
        if (this.isOpen) {
            this.toggleSidebar();
        }
    }
    
    show() {
        if (this.toggleBtn) {
            this.toggleBtn.style.display = 'block';
        }
    }
    
    hide() {
        this.close();
        if (this.toggleBtn) {
            this.toggleBtn.style.display = 'none';
        }
    }
    
    setContent(html) {
        if (this.content) {
            this.content.innerHTML = html;
        }
    }
    
    populateDevelopmentControls(data, config) {
        if (!data || !this.content) return;
        
        const { 
            onSectionChange,
            onToggleAll,
            onToggleGroup,
            onToggleAthlete,
            onToggleCountry,
            athleteVisibility,
            colorScale,
            currentSection = 'all'
        } = config;
        
        this.colorScale = colorScale;
        this.athleteVisibilityRef = athleteVisibility;
        
        let html = '';
        
        // Section controls
        html += '<div class="sidebar-section">';
        html += '<div class="sidebar-section-title">Race Sections</div>';
        html += '<div class="controls" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 5px;">';
        
        const sections = [
            { key: 'all', label: 'All' },
            { key: 'swim', label: 'Swim' },
            { key: 't1', label: 'T1' },
            { key: 'bike', label: 'Bike' },
            { key: 't2', label: 'T2' },
            { key: 'run', label: 'Run' }
        ];
        
        sections.forEach(section => {
            const activeClass = currentSection === section.key ? 'active' : '';
            html += `<button class="btn ${activeClass}" data-section="${section.key}" style="padding: 8px 12px; font-size: 13px;">${section.label}</button>`;
        });
        
        if (!responsiveManager.isMobile) {
            html += `<button class="btn" id="zoomModeBtn" style="padding: 8px 12px; font-size: 13px; grid-column: span 2;">🔍 Zoom (Hold Shift)</button>`;
            html += `<button class="btn" id="resetZoomBtn" style="padding: 8px 12px; font-size: 13px; grid-column: span 2; display: none;">↩️ Reset Zoom</button>`;
        }
        
        html += '</div></div>';
        
        html += this.generateAthleteControls(data, {
            athleteVisibility,
            colorScale,
            toggleBtnId: 'athleteToggleBtn',
            defaultVisibility: () => true,
            groupLabels: [
                { name: "Top 10", range: [1, 10] },
                { name: "11-20", range: [11, 20] },
                { name: "21-30", range: [21, 30] },
                { name: "31+", range: [31, Infinity] },
                { name: "DNF/DSQ", special: true }
            ]
        });
        
        this.setContent(html);
        
        // Add event listeners
        this.content.querySelectorAll('[data-section]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (onSectionChange) onSectionChange(btn.dataset.section);
                this.updateSectionButtons(btn.dataset.section);
                
                const resetBtn = document.getElementById('resetZoomBtn');
                if (resetBtn) {
                    resetBtn.style.display = 'none';
                }
            });
        });
        
        const zoomBtn = document.getElementById('zoomModeBtn');
        const resetBtn = document.getElementById('resetZoomBtn');

        zoomBtn?.addEventListener('click', () => {
            if (onSectionChange) {
                onSectionChange('zoom');
            }
            
            this.content.querySelectorAll('[data-section]').forEach(btn => {
                btn.classList.remove('active');
            });
            zoomBtn.classList.add('active');
            
            if (resetBtn) {
                resetBtn.style.display = 'block';
            }
        });

        resetBtn?.addEventListener('click', () => {
            if (onSectionChange) {
                onSectionChange('reset');
            }
            
            this.updateSectionButtons('all');
            zoomBtn.classList.remove('active');
            resetBtn.style.display = 'none';
        });       
        
        this.content.querySelector('#athleteToggleBtn')?.addEventListener('click', (e) => {
            const showAll = e.target.textContent === 'Show All';
            e.target.textContent = showAll ? 'Hide All' : 'Show All';
            if (onToggleAll) onToggleAll(showAll);
        });
        
        this.content.querySelectorAll('[data-group]').forEach(btn => {
            btn.addEventListener('click', () => {
                const groupData = JSON.parse(btn.dataset.group);
                if (onToggleGroup) onToggleGroup(groupData);
            });
        });
        
        this.content.querySelectorAll('[data-athlete]').forEach(btn => {
            btn.addEventListener('click', () => {
                const athleteData = JSON.parse(btn.dataset.athlete);
                if (onToggleAthlete) onToggleAthlete(athleteData.name, athleteData.index);
            });
        });
        
        this.content.querySelectorAll('[data-country]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (onToggleCountry) onToggleCountry(btn.dataset.country);
            });
        });
    }

    generateAthleteControls(data, config) {
        const { athleteVisibility, colorScale, toggleBtnId, defaultVisibility, groupLabels } = config;
        
        let html = '<div class="sidebar-section">';
        html += '<div class="sidebar-section-title">Athletes</div>';
        
        html += '<div style="margin-bottom: 15px;">';
        html += `<button class="btn toggle-all" id="${toggleBtnId}">Hide All</button>`;
        html += '</div>';
        
        html += '<div><strong>Groups:</strong></div>';
        html += '<div class="athlete-list" style="max-height: 120px; margin-bottom: 15px;">';
        
        groupLabels.forEach(group => {
            html += `<button class="btn" data-group='${JSON.stringify(group)}' style="font-size: 12px; padding: 8px 12px; margin: 2px; width: calc(100% - 4px);">${group.name}</button>`;
        });
        
        html += '</div>';
        
        html += '<div style="margin-top: 15px; margin-bottom: 10px;"><strong>Individual Athletes:</strong></div>';
        html += '<div class="athlete-list">';
        
        const sortedAthletes = [...data].sort((a, b) => {
            if (a.finalRank && b.finalRank) return a.finalRank - b.finalRank;
            if (a.finalRank) return -1;
            if (b.finalRank) return 1;
            return a.name.localeCompare(b.name);
        });
        
        sortedAthletes.forEach((athlete) => {
            const athleteIndex = data.indexOf(athlete);
            const isVisible = athleteVisibility[athlete.name] !== false;
            const color = colorScale(athlete.name);
            const rank = athlete.finalRank ?`${athlete.finalRank}.` : '';
            const flag = getFlag(athlete.country);
            const name = athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '');
            
            const bgColor = isVisible ? (color + '99') : '#cccccc';
            const opacity = isVisible ? '1' : '0.4';
            
            html += `<button class="btn athlete-btn" 
                data-athlete='${JSON.stringify({name: athlete.name, index: athleteIndex})}'
                data-athlete-name="${athlete.name}"
                data-color="${color}"
                style="width: 100%; text-align: left; padding: 8px 12px; font-size: 12px; margin-bottom: 2px; height: 36px; background-color: ${bgColor}; border: 2px solid ${color}; color: #000; opacity: ${opacity};">
                ${rank} ${name} ${flag}
            </button>`;
        });
        
        html += '</div>';
        
        html += '<div style="margin-top: 15px; margin-bottom: 10px;"><strong>Countries:</strong></div>';
        html += '<div class="country-list">';
        
        const countries = [...new Set(data.map(d => d.country))].sort();
        countries.forEach(country => {
            const flag = getFlag(country);
            html += `<button class="btn country-btn" data-country="${country}" title="${country}" style="font-size: 11px; padding: 6px 4px; margin: 0; height: 36px; display: flex; align-items: center; justify-content: center;">
                <span class="country-flag">${flag}</span><span>${country}</span>
            </button>`;
        });
        
        html += '</div></div>';
        
        return html;
    }

    syncAllButtonStates(athleteVisibility) {
        if (!this.content) return;
        
        this.content.querySelectorAll('.athlete-btn').forEach(btn => {
            const athleteName = btn.dataset.athleteName;
            const color = btn.dataset.color;
            const isVisible = athleteVisibility[athleteName] === true;
            
            if (isVisible) {
                btn.style.opacity = '1';
                btn.style.backgroundColor = color + '99';
            } else {
                btn.style.opacity = '0.4';
                btn.style.backgroundColor = '#cccccc';
            }
        });
        
        const hasAnyVisible = Object.values(athleteVisibility).some(v => v === true);
        const toggleBtn = this.content.querySelector('#athleteToggleBtn, #spiderToggleBtn');
        if (toggleBtn) {
            toggleBtn.textContent = hasAnyVisible ? 'Hide All' : 'Show All';
        }
    }

    updateAthleteButtonState(athleteName, isVisible) {
        const btn = this.content?.querySelector(`[data-athlete-name="${athleteName}"]`);
        if (btn) {
            const color = btn.dataset.color;
            if (isVisible) {
                btn.style.opacity = '1';
                btn.style.backgroundColor = color + '99';
            } else {
                btn.style.opacity = '0.4';
                btn.style.backgroundColor = '#cccccc';
            }
        }
    }

    updateCountryButtonState(country, state) {
        const btn = this.content?.querySelector(`[data-country="${country}"]`);
        if (btn) {
            if (state === 'selected') {
                btn.style.opacity = '1';
                btn.style.border = '2px solid #4CAF50';
                btn.style.fontWeight = 'bold';
            } else if (state === true) {
                btn.style.opacity = '1';
                btn.style.border = '';
                btn.style.fontWeight = '';
            } else {
                btn.style.opacity = '0.4';
                btn.style.border = '';
                btn.style.fontWeight = '';
            }
        }
    }

    resetAllButtonStates(show) {
        this.content.querySelectorAll('.athlete-btn').forEach(btn => {
            const color = btn.dataset.color;
            if (show) {
                btn.style.opacity = '1';
                btn.style.backgroundColor = color + '99';
            } else {
                btn.style.opacity = '0.4';
                btn.style.backgroundColor = '#cccccc';
            }
        });
        
        this.content.querySelectorAll('.country-btn').forEach(btn => {
            if (show) {
                btn.style.opacity = '1';
            } else {
                btn.style.opacity = '0.4';
            }
        });
    }

    populateSpiderControls(data, config) {
        if (!data || !this.content) return;
        
        const { 
            onToggleAll,
            onToggleGroup,
            onToggleAthlete,
            onToggleCountry,
            athleteVisibility,
            colorScale
        } = config;
        
        this.colorScale = colorScale;
        this.athleteVisibilityRef = athleteVisibility;
        
        let html = this.generateAthleteControls(data, {
            athleteVisibility,
            colorScale,
            toggleBtnId: 'spiderToggleBtn',
            defaultVisibility: (athlete) => athlete.finalRank && athlete.finalRank <= 5 && !['DNF', 'LAP', 'DSQ'].includes(athlete.status),
            groupLabels: [
                { name: "Top 5", range: [1, 5] },
                { name: "6-10", range: [6, 10] },
                { name: "11-20", range: [11, 20] },
                { name: "21+", range: [21, Infinity] }
            ]
        });
        
        this.setContent(html);
        
        this.content.querySelector('#spiderToggleBtn')?.addEventListener('click', (e) => {
            const showAll = e.target.textContent === 'Show All';
            e.target.textContent = showAll ? 'Hide All' : 'Show All';
            if (onToggleAll) onToggleAll(showAll);
            this.syncAllButtonStates(athleteVisibility);
        });
        
        this.content.querySelectorAll('[data-group]').forEach(btn => {
            btn.addEventListener('click', () => {
                const groupData = JSON.parse(btn.dataset.group);
                if (onToggleGroup) onToggleGroup(groupData);
                // Need to sync after group toggle
                setTimeout(() => this.syncAllButtonStates(athleteVisibility), 50);
            });
        });
        
        this.content.querySelectorAll('[data-athlete]').forEach(btn => {
            btn.addEventListener('click', () => {
                const athleteName = btn.dataset.athleteName;
                if (onToggleAthlete) onToggleAthlete(athleteName);
                // Update this button immediately
                const color = btn.dataset.color;
                const isCurrentlyVisible = btn.style.opacity !== '0.4';
                const newVisibility = !isCurrentlyVisible;
                btn.style.opacity = newVisibility ? '1' : '0.4';
                btn.style.backgroundColor = newVisibility ? color + '99' : '#cccccc';
            });
        });
        
        this.content.querySelectorAll('[data-country]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (onToggleCountry) onToggleCountry(btn.dataset.country);
                setTimeout(() => this.syncAllButtonStates(athleteVisibility), 50);
            });
        });
    }
    
    updateSectionButtons(activeSection) {
        this.content.querySelectorAll('[data-section]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === activeSection);
        });
    }
}

export const sidebarManager = new SidebarManager();