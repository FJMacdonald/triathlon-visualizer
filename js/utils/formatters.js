// Time formatting utilities
export function timeToSeconds(timeStr) {
    if (!timeStr || timeStr === '' || timeStr === 'DNF' || timeStr === 'DSQ') return null;
    const parts = timeStr.split(':');
    if (parts.length !== 3) return null;
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
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
    if (seconds >= 3600) {
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

// Country flags
export const countryFlags = {
    'AUS': '🇦🇺', 'ITA': '🇮🇹', 'HUN': '🇭🇺', 'JPN': '🇯🇵', 'ESP': '🇪🇸',
    'CZE': '🇨🇿', 'CHI': '🇨🇱', 'CHL': '🇨🇱', 'FRA': '🇫🇷', 'CAN': '🇨🇦', 
    'SUI': '🇨🇭', 'NED': '🇳🇱', 'GER': '🇩🇪', 'BEL': '🇧🇪', 'GBR': '🇬🇧', 
    'USA': '🇺🇸', 'NZL': '🇳🇿', 'AUT': '🇦🇹', 'POR': '🇵🇹', 'BRA': '🇧🇷', 
    'MEX': '🇲🇽', 'ARG': '🇦🇷', 'RSA': '🇿🇦', 'NOR': '🇳🇴', 'SWE': '🇸🇪', 
    'DEN': '🇩🇰'
};

export function getFlag(countryCode) {
    return countryFlags[countryCode] || '🏴';
}