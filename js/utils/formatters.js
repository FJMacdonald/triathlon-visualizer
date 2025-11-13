export function timeToSeconds(timeStr) {
    if (!timeStr || timeStr === '' || timeStr === 'DNF' || timeStr === 'DSQ') return null;
    
    // Handle malformed times like "00:01:00:01" (should be 00:01:01)
    const parts = timeStr.split(':');
    
    if (parts.length === 4) {
        // Format: HH:MM:SS:CS or malformed 00:01:00:01
        // Assume it's HH:MM+MM:SS where middle two should be combined
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    } else if (parts.length === 3) {
        // Normal format: HH:MM:SS
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    
    return null;
}

export function secondsToTime(seconds) {
    if (seconds === null || seconds === undefined) return '';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function secondsToMinSec(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (seconds >=  3600) {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function formatPace(paceInMinutes) {
    const mins = Math.floor(paceInMinutes);
    const secs = Math.round((paceInMinutes % 1) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// NCAA Team Logos mapping
export const ncaaTeamLogos = {
    'UoA': 'UoA.avif',
    'QU': 'QU.avif',
    'UD': 'UD.avif',
    'ASU': 'ASU.avif',
    'TCU': 'TCU.avif',
    'ETSU': 'ETSU.avif',
    'USD': 'USD.avif',
    'USF': 'USF.avif',
    'Duquesne': 'Duquesne.avif',
    'Navy': 'Navy.avif',
    'DSU': 'DSU.avif',
    'LaSalle': 'LaSalle.avif',
    'Wagner': 'Wagner.avif',
    'NKU': 'NKU.avif',
    'CSU': 'CSU.avif'
};


// Country flags
export const countryFlags = {
    'AFG': '🇦🇫', 'ALA': '🇦🇽', 'ALB': '🇦🇱', 'DZA': '🇩🇿', 'ASM': '🇦🇸',
    'AND': '🇦🇩', 'AGO': '🇦🇴', 'AIA': '🇦🇮', 'ATA': '🇦🇶', 'ATG': '🇦🇬',
    'ARG': '🇦🇷', 'ARM': '🇦🇲', 'ABW': '🇦🇼', 'AUS': '🇦🇺', 'AUT': '🇦🇹',
    'AZE': '🇦🇿', 'BHS': '🇧🇸', 'BHR': '🇧🇭', 'BGD': '🇧🇩', 'BRB': '🇧🇧',
    'BLR': '🇧🇾', 'BEL': '🇧🇪', 'BLZ': '🇧🇿', 'BEN': '🇧🇯', 'BMU': '🇧🇲',
    'BTN': '🇧🇹', 'BOL': '🇧🇴', 'BIH': '🇧🇦', 'BWA': '🇧🇼', 'BVT': '🇧🇻',
    'BRA': '🇧🇷', 'IOT': '🇮🇴', 'BRN': '🇧🇳', 'BGR': '🇧🇬', 'BFA': '🇧🇫',
    'BDI': '🇧🇮', 'KHM': '🇰🇭', 'CMR': '🇨🇲', 'CAN': '🇨🇦', 'CPV': '🇨🇻',
    'CYM': '🇰🇾', 'CAF': '🇨🇫', 'TCD': '🇹🇩', 'CHL': '🇨🇱', 'CHN': '🇨🇳',
    'CXR': '🇨🇽', 'CCK': '🇨🇨', 'COL': '🇨🇴', 'COM': '🇰🇲', 'COG': '🇨🇬',
    'COD': '🇨🇩', 'COK': '🇨🇰', 'CRI': '🇨🇷', 'CIV': '🇨🇮', 'HRV': '🇭🇷',
    'CUB': '🇨🇺', 'CYP': '🇨🇾', 'CZE': '🇨🇿', 'DNK': '🇩🇰', 'DJI': '🇩🇯',
    'DMA': '🇩🇲', 'DOM': '🇩🇴', 'ECU': '🇪🇨', 'EGY': '🇪🇬', 'SLV': '🇸🇻',
    'GNQ': '🇬🇶', 'ERI': '🇪🇷', 'EST': '🇪🇪', 'ETH': '🇪🇹', 'FLK': '🇫🇰',
    'FRO': '🇫🇴', 'FJI': '🇫🇯', 'FIN': '🇫🇮', 'FRA': '🇫🇷', 'GUF': '🇬🇫',
    'PYF': '🇵🇫', 'ATF': '🇹🇫', 'GAB': '🇬🇦', 'GMB': '🇬🇲', 'GEO': '🇬🇪',
    'DEU': '🇩🇪', 'GHA': '🇬🇭', 'GIB': '🇬🇮', 'GRC': '🇬🇷', 'GRL': '🇬🇱',
    'GRD': '🇬🇩', 'GLP': '🇬🇵', 'GUM': '🇬🇺', 'GTM': '🇬🇹', 'GGY': '🇬🇬',
    'GIN': '🇬🇳', 'GNB': '🇬🇼', 'GUY': '🇬🇾', 'HTI': '🇭🇹', 'HMD': '🇭🇲',
    'VAT': '🇻🇦', 'HND': '🇭🇳', 'HKG': '🇭🇰', 'HUN': '🇭🇺', 'ISL': '🇮🇸',
    'IND': '🇮🇳', 'IDN': '🇮🇩', 'IRN': '🇮🇷', 'IRQ': '🇮🇶', 'IRL': '🇮🇪',
    'IMN': '🇮🇲', 'ISR': '🇮🇱', 'ITA': '🇮🇹', 'JAM': '🇯🇲', 'JPN': '🇯🇵',
    'JEY': '🇯🇪', 'JOR': '🇯🇴', 'KAZ': '🇰🇿', 'TRI': '🇹🇹', 'POR': '🇵🇹',
    'KEN': '🇰🇪', 'KIR': '🇰🇮', 'PRK': '🇰🇵', 'KOR': '🇰🇷', 'KWT': '🇰🇼',
    'KGZ': '🇰🇬', 'LAO': '🇱🇦', 'LVA': '🇱🇻', 'LBN': '🇱🇧', 'LSO': '🇱🇸',
    'LBR': '🇱🇷', 'LBY': '🇱🇾', 'LIE': '🇱🇮', 'LTU': '🇱🇹', 'LUX': '🇱🇺',
    'MAC': '🇲🇴', 'MKD': '🇲🇰', 'MDG': '🇲🇬', 'MWI': '🇲🇼', 'MYS': '🇲🇾',
    'MDV': '🇲🇻', 'MLI': '🇲🇱', 'MLT': '🇲🇹', 'MHL': '🇲🇭', 'MTQ': '🇲🇶',
    'MRT': '🇲🇷', 'MUS': '🇲🇺', 'MYT': '🇾🇹', 'MEX': '🇲🇽', 'FSM': '🇫🇲',
    'MDA': '🇲🇩', 'MCO': '🇲🇨', 'MNG': '🇲🇳', 'MNE': '🇲🇪', 'MSR': '🇲🇸',
    'MAR': '🇲🇦', 'MOZ': '🇲🇿', 'MMR': '🇲🇲', 'NAM': '🇳🇦', 'NRU': '🇳🇷',
    'NPL': '🇳🇵', 'NLD': '🇳🇱', 'NCL': '🇳🇨', 'NZL': '🇳🇿', 'NIC': '🇳🇮',
    'NER': '🇳🇪', 'NGA': '🇳🇬', 'NIU': '🇳🇺', 'NFK': '🇳🇫', 'MNP': '🇲🇵',
    'NOR': '🇳🇴', 'OMN': '🇴🇲', 'PAK': '🇵🇰', 'PLW': '🇵🇼', 'PSE': '🇵🇸',
    'PAN': '🇵🇦', 'PNG': '🇵🇬', 'PRY': '🇵🇾', 'PER': '🇵🇪', 'PHL': '🇵🇭',
    'PCN': '🇵🇳', 'POL': '🇵🇱', 'PRT': '🇵🇹', 'PRI': '🇵🇷', 'QAT': '🇶🇦',
    'REU': '🇷🇪', 'ROU': '🇷🇴', 'RUS': '🇷🇺', 'RWA': '🇷🇼', 'BLM': '🇧🇱',
    'SHN': '🇸🇭', 'KNA': '🇰🇳', 'LCA': '🇱🇨', 'MAF': '🇲🇫', 'SPM': '🇵🇲',
    'VCT': '🇻🇨', 'WSM': '🇼🇸', 'SMR': '🇸🇲', 'STP': '🇸🇹', 'SAU': '🇸🇦',
    'SEN': '🇸🇳', 'SRB': '🇷🇸', 'SYC': '🇸🇨', 'SLE': '🇸🇱', 'SGP': '🇸🇬',
    'SXM': '🇸🇽', 'SVK': '🇸🇰', 'SVN': '🇸🇮', 'SLB': '🇸🇧', 'SOM': '🇸🇴',
    'ZAF': '🇿🇦', 'USA': '🇺🇸', 'GER': '🇩🇪', 'ESP': '🇪🇸', 'NED': '🇳🇱',
    'DEN': '🇩🇰', 'GBR': '🇬🇧', 'RSA': '🇿🇦', 'SUI': '🇨🇭', 'CHI': '🇨🇱',
    'BER': '🇧🇲', 'ZIM': '🇿🇼', 'VEN': '🇻🇪', 'CRC': '🇨🇷', 'GUA': '🇬🇹',
    'PHI': '🇵🇭', 'ARU': '🇦🇼', 'BAH': '🇧🇸', 'PUR': '🇵🇷', 'BAR': '🇧🇧',
    'MAS': '🇲🇾',
};


export function getFlag(countryCode) {
    return countryFlags[countryCode] || '🏴';
}

export function getTeamIcon(teamCode, isNCAA = false) {
    if (isNCAA && ncaaTeamLogos[teamCode]) {
        return `<img src="logos/${ncaaTeamLogos[teamCode]}" alt="${teamCode}" class="team-logo" />`;
    }
    return getFlag(teamCode);
}