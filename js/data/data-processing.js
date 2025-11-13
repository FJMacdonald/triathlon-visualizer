import { timeToSeconds } from '../utils/formatters.js';

export class DataProcessor {
    constructor() {
        this.rawData = null;
        this.processedData = null;
        this.segmentLeaders = {};
        this.raceType = null; // 'ncaa' or 'worldtriathlon'
        this.raceDistance = null; // 'sprint' or 'olympic'
    }
    
    parseCSV(text) {
        const lines = text.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;
            const values = lines[i].split(',');
            const row = {};
            headers.forEach((header, index) => {
                row[header] = values[index] ? values[index].trim() : '';
            });
            data.push(row);
        }
        
        this.rawData = data;
        this.detectRaceType(data);
        return data;
    }
    
    detectRaceType(data) {
        // Check if this is NCAA or World Triathlon based on country codes
        const ncaaTeams = ['UoA', 'QU', 'UD', 'ASU', 'TCU', 'ETSU', 'USD', 'USF', 
                          'Duquesne', 'Navy', 'DSU', 'LaSalle', 'Wagner', 'NKU', 'CSU'];
        
        if (data.length > 0) {
            const firstCountry = data[0].Country;
            this.raceType = ncaaTeams.includes(firstCountry) ? 'ncaa' : 'worldtriathlon';
        }
    }
    
    detectRaceDistance(data) {
        // Use first 3 finishers to estimate race distance
        const finishers = data
            .filter(a => a.actualTotalTime && !['DNS', 'DNF', 'DSQ'].includes(a.status))
            .slice(0, 3);
        
        if (finishers.length === 0) return 'olympic';
        
        const avgTotal = finishers.reduce((sum, a) => sum + a.actualTotalTime, 0) / finishers.length;
        
        // Sprint races typically finish in 55-65 minutes for top athletes
        // Olympic races typically finish in 1:50-2:00 for top athletes
        this.raceDistance = avgTotal < 4200 ? 'sprint' : 'olympic'; // 70 minutes as threshold
        
        return this.raceDistance;
    }
    
    processRaceData(data) {
        const processed = [];
        const penaltyTime = 99 * 3600;
        
        data.forEach((athlete) => {
            const swimTime = timeToSeconds(athlete.Swim);
            const t1Time = timeToSeconds(athlete.T1);
            const bikeTime = timeToSeconds(athlete.Bike);
            const t2Time = timeToSeconds(athlete.T2);
            const runTime = timeToSeconds(athlete.Run);
            const totalTime = timeToSeconds(athlete['Total Time']);
            const status = athlete.Status || '';
            
            let displayName, baseName;
            if (athlete['Athlete First Name'] && athlete['Athlete Last Name']) {
                displayName = `${athlete['Athlete First Name']} ${athlete['Athlete Last Name']}`;
                baseName = displayName;
            } else if (athlete.Name) {
                displayName = athlete.Name;
                baseName = athlete.Name;
            } else {
                return;
            }
            
            const processedAthlete = {
                name: displayName,
                baseName: baseName,
                country: athlete.Country,
                position: athlete.Position ? parseInt(athlete.Position) : null,
                status: status,
                swimTime: swimTime || (status === 'DNS' ? penaltyTime : 0),
                t1Time: t1Time || (status === 'DNS' ? penaltyTime : 0),
                bikeTime: bikeTime || penaltyTime,
                t2Time: t2Time || penaltyTime,
                runTime: runTime || penaltyTime,
                actualSwimTime: swimTime,
                actualT1Time: t1Time,
                actualBikeTime: bikeTime,
                actualT2Time: t2Time,
                actualRunTime: runTime
            };
            
            // Calculate cumulative times
            processedAthlete.swimCumulative = processedAthlete.swimTime;
            processedAthlete.t1Cumulative = processedAthlete.swimCumulative + processedAthlete.t1Time;
            processedAthlete.bikeCumulative = processedAthlete.t1Cumulative + processedAthlete.bikeTime;
            processedAthlete.t2Cumulative = processedAthlete.bikeCumulative + processedAthlete.t2Time;
            processedAthlete.totalCumulative = processedAthlete.t2Cumulative + processedAthlete.runTime;
            processedAthlete.actualTotalTime = totalTime;
            
            processed.push(processedAthlete);
        });
        
        // Sort by total time
        processed.sort((a, b) => a.totalCumulative - b.totalCumulative);
        
        // Detect race distance and apply config
        const distance = this.detectRaceDistance(processed);
        
        // Assign final ranks
        this.assignRanks(processed);
        
        // Calculate segment ranks
        this.calculateSegmentRanks(processed);
        
        // Calculate gaps to leader
        this.calculateGaps(processed);
        
        // Find segment leaders
        this.findSegmentLeaders(processed);
        
        this.processedData = processed;
        return processed;
    }
    
    assignRanks(processed) {
        let currentRank = 1;
        processed.forEach((athlete) => {
            if (['DSQ', 'DNF', 'LAP', 'DNS'].includes(athlete.status)) {
                athlete.finalRank = null;
            } else {
                athlete.finalRank = currentRank++;
            }
        });
    }
    
    calculateSegmentRanks(processed) {
        const finishers = processed.filter(a => !['DNF', 'DSQ', 'LAP', 'DNS'].includes(a.status));
        
        processed.forEach((athlete) => {
            // Race position ranks (cumulative)
            if (athlete.actualSwimTime) {
                const fasterSwimmers = processed.filter(a => 
                    a.actualSwimTime && a.swimCumulative < athlete.swimCumulative
                ).length;
                athlete.swimRank = fasterSwimmers + 1;
            }
            
            if (athlete.actualT1Time) {
                athlete.t1Rank = processed.filter(a => 
                    a.actualT1Time && a.t1Cumulative < athlete.t1Cumulative
                ).length + 1;
            }
            
            if (athlete.actualBikeTime) {
                athlete.bikeRank = processed.filter(a => 
                    a.actualBikeTime && a.bikeCumulative < athlete.bikeCumulative
                ).length + 1;
            }
            
            if (athlete.actualT2Time) {
                athlete.t2Rank = processed.filter(a => 
                    a.actualT2Time && a.t2Cumulative < athlete.t2Cumulative
                ).length + 1;
            }
            
            // Segment-specific ranks
            if (athlete.actualSwimTime) {
                athlete.swimSegmentRank = finishers.filter(a => 
                    a.actualSwimTime && a.actualSwimTime < athlete.actualSwimTime
                ).length + 1;
            }
            
            if (athlete.actualT1Time) {
                athlete.t1SegmentRank = finishers.filter(a => 
                    a.actualT1Time && a.actualT1Time < athlete.actualT1Time
                ).length + 1;
            }
            
            if (athlete.actualBikeTime) {
                athlete.bikeSegmentRank = finishers.filter(a => 
                    a.actualBikeTime && a.actualBikeTime < athlete.actualBikeTime
                ).length + 1;
            }
            
            if (athlete.actualT2Time) {
                athlete.t2SegmentRank = finishers.filter(a => 
                    a.actualT2Time && a.actualT2Time < athlete.actualT2Time
                ).length + 1;
            }
            
            if (athlete.actualRunTime) {
                athlete.runSegmentRank = finishers.filter(a => 
                    a.actualRunTime && a.actualRunTime < athlete.actualRunTime
                ).length + 1;
            }
        });
    }
    
    calculateGaps(processed) {
        const swimLeader = Math.min(...processed.map(a => a.swimCumulative));
        const t1Leader = Math.min(...processed.map(a => a.t1Cumulative));
        const bikeLeader = Math.min(...processed.map(a => a.bikeCumulative));
        const t2Leader = Math.min(...processed.map(a => a.t2Cumulative));
        const runLeader = Math.min(...processed.map(a => a.totalCumulative));
        
        processed.forEach(athlete => {
            athlete.swimGap = athlete.swimCumulative - swimLeader;
            athlete.t1Gap = athlete.t1Cumulative - t1Leader;
            athlete.bikeGap = athlete.bikeCumulative - bikeLeader;
            athlete.t2Gap = athlete.t2Cumulative - t2Leader;
            athlete.runGap = athlete.totalCumulative - runLeader;
        });
    }
    
    findSegmentLeaders(data) {
        const finishers = data.filter(a => 
            !['DNF', 'DSQ', 'LAP', 'DNS'].includes(a.status) && a.actualSwimTime
        );
        
        if (finishers.length > 0) {
            this.segmentLeaders.swim = finishers.reduce((min, athlete) => 
                (athlete.actualSwimTime && athlete.actualSwimTime < min.actualSwimTime) ? athlete : min, 
                finishers[0]
            );
            
            this.segmentLeaders.t1 = finishers.reduce((min, athlete) => 
                (athlete.actualT1Time && athlete.actualT1Time < min.actualT1Time) ? athlete : min, 
                finishers[0]
            );
            
            this.segmentLeaders.bike = finishers.reduce((min, athlete) => 
                (athlete.actualBikeTime && athlete.actualBikeTime < min.actualBikeTime) ? athlete : min, 
                finishers[0]
            );
            
            this.segmentLeaders.t2 = finishers.reduce((min, athlete) => 
                (athlete.actualT2Time && athlete.actualT2Time < min.actualT2Time) ? athlete : min, 
                finishers[0]
            );
            
            this.segmentLeaders.run = finishers.reduce((min, athlete) => 
                (athlete.actualRunTime && athlete.actualRunTime < min.actualRunTime) ? athlete : min, 
                finishers[0]
            );
        }
    }
    
    getStatistics() {
        if (!this.processedData) return null;
        
        const finishers = this.processedData.filter(a => 
            !['DNF', 'DSQ', 'LAP', 'DNS'].includes(a.status)
        );
        const starters = this.processedData.filter(a => a.status !== 'DNS');
        
        return {
            totalAthletes: this.processedData.length,
            finishers: finishers.length,
            starters: starters.length,
            avgSwim: d3.mean(finishers, d => d.actualSwimTime || 0),
            avgT1: d3.mean(finishers, d => d.actualT1Time || 0),
            avgBike: d3.mean(finishers, d => d.actualBikeTime || 0),
            avgT2: d3.mean(finishers, d => d.actualT2Time || 0),
            avgRun: d3.mean(finishers, d => d.actualRunTime || 0),
            winner: finishers.find(a => a.finalRank === 1)
        };
    }
    
    getCountries() {
        if (!this.processedData) return [];
        return [...new Set(this.processedData.map(d => d.country))].sort();
    }
    
    getAthletesSortedByRank() {
        if (!this.processedData) return [];
        return [...this.processedData].sort((a, b) => {
            if (a.finalRank && b.finalRank) return a.finalRank - b.finalRank;
            if (a.finalRank) return -1;
            if (b.finalRank) return 1;
            return a.name.localeCompare(b.name);
        });
    }
    
    isNCAA() {
        return this.raceType === 'ncaa';
    }
}

export const dataProcessor = new DataProcessor();