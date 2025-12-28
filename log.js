#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'bp-data.csv');
const HEADERS = 'id,date,time,systolic,diastolic,heartRate';

function loadData() {
    if (!fs.existsSync(DATA_FILE)) return [];
    
    const lines = fs.readFileSync(DATA_FILE, 'utf8').trim().split('\n');
    if (lines.length < 2) return [];
    
    return lines.slice(1).map(line => {
        const [id, date, time, sys, dia, hr] = line.split(',');
        return {
            id: parseInt(id),
            date,
            time,
            systolic: parseInt(sys),
            diastolic: parseInt(dia),
            heartRate: hr ? parseInt(hr) : null
        };
    });
}

function saveData(data) {
    let csv = HEADERS + '\n';
    data.forEach(r => {
        csv += `${r.id},${r.date},${r.time},${r.systolic},${r.diastolic},${r.heartRate || ''}\n`;
    });
    fs.writeFileSync(DATA_FILE, csv);
}

function getBPStatus(sys, dia) {
    if (sys < 120 && dia < 80) return 'Normal';
    if (sys < 130 && dia < 80) return 'Elevated';
    if (sys < 140 || dia < 90) return 'High-1';
    return 'High-2';
}

function parseDate(dateArg) {
    if (!dateArg) return new Date().toISOString().split('T')[0];
    
    if (dateArg.startsWith('-')) {
        const d = new Date();
        d.setDate(d.getDate() + parseInt(dateArg));
        return d.toISOString().split('T')[0];
    }
    
    if (dateArg.match(/^\d{4}-\d{2}-\d{2}$/)) return dateArg;
    
    return new Date().toISOString().split('T')[0];
}

function addReading(sys, dia, hr, time, dateArg) {
    const data = loadData();
    const targetDate = parseDate(dateArg);
    
    const reading = {
        id: Date.now(),
        date: targetDate,
        time: time || 'AM',
        systolic: parseInt(sys),
        diastolic: parseInt(dia),
        heartRate: hr ? parseInt(hr) : null
    };
    
    const existingIndex = data.findIndex(r => r.date === targetDate && r.time === reading.time);
    if (existingIndex >= 0) {
        console.log('\n  Replacing existing ' + reading.time + ' reading for ' + targetDate);
        data.splice(existingIndex, 1);
    }
    
    data.unshift(reading);
    data.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return a.time === 'PM' ? -1 : 1;
    });
    
    saveData(data);
    
    const hrStr = reading.heartRate ? ' HR:' + reading.heartRate : '';
    console.log(`\n  Saved: ${reading.systolic}/${reading.diastolic}${hrStr} [${reading.time}] ${targetDate} - ${getBPStatus(reading.systolic, reading.diastolic)}\n`);
}

function viewReadings(count = 10) {
    const data = loadData();
    
    if (data.length === 0) {
        console.log('\n  No readings yet.\n');
        return;
    }
    
    console.log('\n  DATE        TIME   BP         HR    STATUS');
    console.log('  ' + '-'.repeat(50));
    
    data.slice(0, count).forEach(r => {
        const bp = (r.systolic + '/' + r.diastolic).padEnd(10);
        const hr = (r.heartRate || '-').toString().padEnd(5);
        console.log(`  ${r.date}  ${r.time.padEnd(4)}   ${bp} ${hr} ${getBPStatus(r.systolic, r.diastolic)}`);
    });
    
    console.log('');
}

function showStats() {
    const data = loadData();
    
    if (data.length === 0) {
        console.log('\n  No readings yet.\n');
        return;
    }
    
    const avg = arr => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    
    const allSys = data.map(r => r.systolic);
    const allDia = data.map(r => r.diastolic);
    const allHR = data.filter(r => r.heartRate).map(r => r.heartRate);
    
    const last7 = data.filter(r => {
        const diff = (new Date() - new Date(r.date)) / (1000 * 60 * 60 * 24);
        return diff <= 7;
    });
    
    console.log('\n  BP Statistics');
    console.log('  ' + '-'.repeat(30));
    console.log('  Total readings:  ' + data.length);
    console.log('  Last 7 days:     ' + last7.length);
    console.log('');
    console.log('  Average BP:      ' + avg(allSys) + '/' + avg(allDia) + ' (' + getBPStatus(avg(allSys), avg(allDia)) + ')');
    if (allHR.length) console.log('  Average HR:      ' + avg(allHR) + ' bpm');
    console.log('');
    console.log('  Highest:         ' + Math.max(...allSys) + '/' + Math.max(...allDia));
    console.log('  Lowest:          ' + Math.min(...allSys) + '/' + Math.min(...allDia));
    console.log('');
}

function showHelp() {
    console.log(`
  BP Logger

  Usage:
    node log.js <systolic> <diastolic> [heartrate] [AM|PM] [date]
  
  Examples:
    node log.js 120 80              Today, AM, no HR
    node log.js 118 78 72 PM        Today, PM, with HR
    node log.js 120 80 AM -1        Yesterday morning
    node log.js 118 78 72 PM -3     3 days ago evening
    node log.js 120 80 AM 2024-12-25
  
  Commands:
    --view [n]     View last n readings (default 10)
    --stats        Show statistics
    --help         Show this help

  Data: ${DATA_FILE}
`);
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    showHelp();
} else if (args[0] === '--view' || args[0] === '-v') {
    viewReadings(parseInt(args[1]) || 10);
} else if (args[0] === '--stats' || args[0] === '-s') {
    showStats();
} else {
    const [sys, dia, ...rest] = args;
    
    if (!sys || !dia) {
        console.log('  Error: systolic and diastolic required');
        process.exit(1);
    }
    
    let hr = null, time = 'AM', dateArg = null;
    
    for (const arg of rest) {
        if (arg.toUpperCase() === 'AM' || arg.toUpperCase() === 'PM') {
            time = arg.toUpperCase();
        } else if (arg.startsWith('-') && !isNaN(parseInt(arg))) {
            dateArg = arg;
        } else if (arg.match(/^\d{4}-\d{2}-\d{2}$/)) {
            dateArg = arg;
        } else if (!isNaN(parseInt(arg))) {
            hr = arg;
        }
    }
    
    addReading(sys, dia, hr, time, dateArg);
}
