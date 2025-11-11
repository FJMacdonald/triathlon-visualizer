import { getFlag } from '../utils/formatters.js';
import { responsiveManager } from '../utils/responsive.js';

export class SidebarManager {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.content = document.getElementById('sidebarContent');
        this.toggle = document.getElementById('sidebarToggle');
        this.mainContent = document.getElementById('mainContent');
        this.isOpen = false;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        if (this.toggle) {
            this.toggle.addEventListener('click', () => this.toggle());
        }
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
        if (this.toggle) {
            this.toggle.style.display = 'block';
        }
    }
    
    hide() {
        this.close();
        if (this.toggle) {
            this.toggle.style.display = 'none';
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
        
        // Add zoom button (spans full width)
        if (!responsiveManager.isMobile) {
            html += `<button class="btn" id="zoomModeBtn" style="padding: 8px 12px; font-size: 13px; grid-column: span 2;">🔍 Zoom (Hold Shift)</button>`;
            html += `<button class="btn" id="resetZoomBtn" style="padding: 8px 12px; font-size: 13px; grid-column: span 2; display: none;">↩️ Reset Zoom</button>`;
        }
        
        html += '</div></div>';

        
        // Athlete controls
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
                
                // Show/hide reset button
                const resetBtn = document.getElementById('resetZoomBtn');
                if (resetBtn) {
                    resetBtn.style.display = 'none';
                }
            });
        });
        
        // Zoom button
        const zoomBtn = document.getElementById('zoomModeBtn');
        const resetBtn = document.getElementById('resetZoomBtn');

        zoomBtn?.addEventListener('click', () => {
            if (onSectionChange) {
                onSectionChange('zoom');
            }
            
            // Update button states
            this.content.querySelectorAll('[data-section]').forEach(btn => {
                btn.classList.remove('active');
            });
            zoomBtn.classList.add('active');
            
            // Show reset button
            if (resetBtn) {
                resetBtn.style.display = 'block';
            }
        });

        resetBtn?.addEventListener('click', () => {
            if (onSectionChange) {
                onSectionChange('reset');
            }
            
            // Reset to 'all' section
            this.updateSectionButtons('all');
            zoomBtn.classList.remove('active');
            resetBtn.style.display = 'none';
        });       
        this.content.querySelector('#athleteToggleBtn')?.addEventListener('click', (e) => {
            const showAll = e.target.textContent === 'Show All';
            e.target.textContent = showAll ? 'Hide All' : 'Show All';
            if (onToggleAll) onToggleAll(showAll);
            this.updateAllAthleteButtons(showAll);
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
                btn.classList.toggle('hidden');
            });
        });
        
        this.content.querySelectorAll('[data-country]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (onToggleCountry) onToggleCountry(btn.dataset.country);
                btn.classList.toggle('hidden');
            });
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
        
        // Add event listeners
        this.content.querySelector('#spiderToggleBtn')?.addEventListener('click', (e) => {
            const showAll = e.target.textContent === 'Show All';
            e.target.textContent = showAll ? 'Hide All' : 'Show All';
            if (onToggleAll) onToggleAll(showAll);
            this.updateAllAthleteButtons(showAll);
        });
        
        this.content.querySelectorAll('[data-group]').forEach(btn => {
            btn.addEventListener('click', () => {
                const groupData = JSON.parse(btn.dataset.group);
                if (onToggleGroup) onToggleGroup(groupData);
            });
        });
        
        this.content.querySelectorAll('[data-athlete]').forEach(btn => {
            btn.addEventListener('click', () => {
                const athleteName = btn.dataset.athleteName;
                if (onToggleAthlete) onToggleAthlete(athleteName);
                btn.classList.toggle('hidden');
            });
        });
        
        this.content.querySelectorAll('[data-country]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (onToggleCountry) onToggleCountry(btn.dataset.country);
                btn.classList.toggle('hidden');
            });
        });
    }
    
    generateAthleteControls(data, config) {
        const { athleteVisibility, colorScale, toggleBtnId, defaultVisibility, groupLabels } = config;
        
        let html = '<div class="sidebar-section">';
        html += '<div class="sidebar-section-title">Athletes</div>';
        
        // Toggle all button
        html += '<div style="margin-bottom: 15px;">';
        html += `<button class="btn toggle-all" id="${toggleBtnId}">Hide All</button>`;
        html += '</div>';
        
        // Group selection
        html += '<div><strong>Groups:</strong></div>';
        html += '<div class="athlete-list" style="max-height: 120px; margin-bottom: 15px;">';
        
        groupLabels.forEach(group => {
            html += `<button class="btn" data-group='${JSON.stringify(group)}' style="font-size: 12px; padding: 8px 12px; margin: 2px; width: calc(100% - 4px);">${group.name}</button>`;
        });
        
        html += '</div>';
        
        // Individual athletes
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
            const hiddenClass = isVisible ? '' : 'hidden';
            const color = colorScale(athlete.name);
            const rank = athlete.finalRank ? `${athlete.finalRank}.` : '';
            const flag = getFlag(athlete.country);
            const name = athlete.baseName || athlete.name.replace(/ \([^)]*\)$/, '');
            
            html += `<button class="btn ${hiddenClass}" 
                data-athlete='${JSON.stringify({name: athlete.name, index: athleteIndex})}'
                data-athlete-name="${athlete.name}"
                style="width: 100%; text-align: left; padding: 8px 12px; font-size: 12px; margin-bottom: 2px; height: 36px; background-color: ${color}99; border: 2px solid ${color}; color: #000;">
                ${rank} ${name} ${flag}
            </button>`;
        });
        
        html += '</div>';
        
        // Country selection
        html += '<div style="margin-top: 15px; margin-bottom: 10px;"><strong>Countries:</strong></div>';
        html += '<div class="country-list">';
        
        const countries = [...new Set(data.map(d => d.country))].sort();
        countries.forEach(country => {
            const flag = getFlag(country);
            html += `<button class="btn" data-country="${country}" title="${country}" style="font-size: 11px; padding: 6px 4px; margin: 0; height: 36px; display: flex; align-items: center; justify-content: center;">
                <span class="country-flag">${flag}</span><span>${country}</span>
            </button>`;
        });
        
        html += '</div></div>';
        
        return html;
    }
    
    updateSectionButtons(activeSection) {
        this.content.querySelectorAll('[data-section]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === activeSection);
        });
    }
    
    updateAllAthleteButtons(show) {
        this.content.querySelectorAll('[data-athlete], [data-country]').forEach(btn => {
            if (show) {
                btn.classList.remove('hidden');
                btn.style.opacity = '';
                btn.style.backgroundColor = '';
            } else {
                btn.classList.add('hidden');
                btn.style.opacity = '0.3';
            }
        });
    }
    
    updateAthleteButton(athleteName, isVisible) {
        const btn = this.content.querySelector(`[data-athlete-name="${athleteName}"]`);
        if (btn) {
            btn.classList.toggle('hidden', !isVisible);
        }
    }
    updateAthleteButtonState(athleteName, isVisible) {
        const btn = this.content?.querySelector(`[data-athlete-name="${athleteName}"]`);
        if (btn) {
            btn.classList.toggle('hidden', !isVisible);
            if (isVisible) {
                btn.style.opacity = '';
            } else {
                btn.style.opacity = '0.3';
            }
        }
    }

    updateCountryButtonState(country, state) {
        const btn = this.content?.querySelector(`[data-country="${country}"]`);
        if (btn) {
            if (state === 'selected') {
                btn.classList.remove('hidden');
                btn.style.opacity = '1';
                // Could add border or background color here
            } else if (state === true) {
                btn.classList.remove('hidden');
                btn.style.opacity = '0.7';
            } else {
                btn.classList.add('hidden');
                btn.style.opacity = '0.3';
            }
        }
    }

    resetAllButtonStates(show) {
        const buttons = this.content?.querySelectorAll('[data-athlete], [data-athlete-name], [data-country]');
        buttons?.forEach(btn => {
            if (show) {
                btn.classList.remove('hidden');
                btn.style.opacity = '';
                btn.style.backgroundColor = '';
                btn.style.border = '';
            } else {
                btn.classList.add('hidden');
                btn.style.opacity = '0.3';
            }
        });
    }
}

export const sidebarManager = new SidebarManager();