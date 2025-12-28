let currentTime = 'AM';
let data = [];
let chart = null;

const $ = id => document.getElementById(id);

function getLocalDateString(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function initDate() {
    const today = getLocalDateString();
    $('readingDate').value = today;
    $('readingDate').max = today;
    updateDateDisplay();
}

function updateDateDisplay() {
    const inputVal = $('readingDate').value;
    const [year, month, day] = inputVal.split('-').map(Number);
    const selected = new Date(year, month - 1, day);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selected.setHours(0, 0, 0, 0);
    
    const diffDays = Math.round((today - selected) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) $('dateDisplay').textContent = 'Today';
    else if (diffDays === 1) $('dateDisplay').textContent = 'Yesterday';
    else if (diffDays < 7) $('dateDisplay').textContent = selected.toLocaleDateString('en', { weekday: 'long' });
    else $('dateDisplay').textContent = selected.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function shiftDate(days) {
    const inputVal = $('readingDate').value;
    const [year, month, day] = inputVal.split('-').map(Number);
    const current = new Date(year, month - 1, day);
    current.setDate(current.getDate() + days);
    
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (current > today) return;
    
    $('readingDate').value = getLocalDateString(current);
    updateDateDisplay();
}

function setToday() {
    $('readingDate').value = getLocalDateString();
    updateDateDisplay();
}

function loadData() {
    const saved = localStorage.getItem('bp-data-csv');
    if (saved) data = parseCSV(saved);
}

function saveData() {
    localStorage.setItem('bp-data-csv', generateCSV());
}

function parseCSV(csv) {
    const lines = csv.trim().split('\n');
    if (lines.length < 2) return [];
    
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const v = lines[i].split(',');
        if (v.length >= 5) {
            result.push({
                id: parseInt(v[0]) || Date.now() + i,
                date: v[1],
                time: v[2],
                systolic: parseInt(v[3]),
                diastolic: parseInt(v[4]),
                heartRate: v[5] ? parseInt(v[5]) : null
            });
        }
    }
    return result;
}

function generateCSV() {
    let csv = 'id,date,time,systolic,diastolic,heartRate\n';
    data.forEach(r => {
        csv += `${r.id},${r.date},${r.time},${r.systolic},${r.diastolic},${r.heartRate || ''}\n`;
    });
    return csv;
}

function setTime(time) {
    currentTime = time;
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.time === time);
    });
}

function getBPStatus(sys, dia) {
    if (sys >= 180 || dia >= 120) return { text: 'Crisis', class: 'status-crisis' };
    if (sys >= 140 || dia >= 90) return { text: 'Stage 2', class: 'status-danger' };
    if ((sys >= 130 && sys < 140) || (dia >= 80 && dia < 90)) return { text: 'Stage 1', class: 'status-high' };
    if (sys >= 120 && sys < 130 && dia < 80) return { text: 'Elevated', class: 'status-elevated' };
    if (sys < 120 && dia < 80) return { text: 'Normal', class: 'status-normal' };
    return { text: 'Normal', class: 'status-normal' };
}

function updateStatusDisplay() {
    const sys = parseInt($('systolic').value);
    const dia = parseInt($('diastolic').value);
    
    if (sys && dia) {
        const status = getBPStatus(sys, dia);
        $('statusDisplay').innerHTML = `<span class="status-badge ${status.class}">${status.text}</span>`;
    } else {
        $('statusDisplay').innerHTML = '';
    }
}

function saveReading() {
    const sys = parseInt($('systolic').value);
    const dia = parseInt($('diastolic').value);
    const hr = parseInt($('heartRate').value);
    const selectedDate = $('readingDate').value;

    if (!sys || !dia) {
        $('systolic').focus();
        return;
    }

    const reading = {
        id: Date.now(),
        date: selectedDate,
        time: currentTime,
        systolic: sys,
        diastolic: dia,
        heartRate: hr || null
    };

    const existingIndex = data.findIndex(r => r.date === selectedDate && r.time === currentTime);
    if (existingIndex >= 0) {
        if (!confirm('Replace existing ' + currentTime + ' reading for this date?')) return;
        data.splice(existingIndex, 1);
    }

    data.unshift(reading);
    data.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return a.time === 'PM' ? -1 : 1;
    });
    
    saveData();
    
    $('systolic').value = '';
    $('diastolic').value = '';
    $('heartRate').value = '';
    $('statusDisplay').innerHTML = '';

    if (currentTime === 'AM') setTime('PM');

    const btn = $('saveBtn');
    btn.textContent = 'Saved';
    btn.style.background = '#22863a';
    setTimeout(() => {
        btn.textContent = 'Save Reading';
        btn.style.background = '';
    }, 800);

    $('systolic').focus();
    renderAll();
}

function deleteReading(id) {
    if (confirm('Delete this reading?')) {
        data = data.filter(r => r.id !== id);
        saveData();
        renderAll();
    }
}

function exportCSV() {
    const blob = new Blob([generateCSV()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bp-data-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const imported = parseCSV(e.target.result);
        if (imported.length > 0) {
            if (confirm(`Import ${imported.length} readings? This will replace current data.`)) {
                data = imported;
                saveData();
                renderAll();
            }
        } else {
            alert('No valid data found in CSV');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

function calculateStats() {
    if (data.length === 0) return null;

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const getDaysAgo = (dateStr) => {
        const diff = (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24);
        return Math.floor(diff);
    };

    const last7Days = data.filter(r => getDaysAgo(r.date) <= 7);
    const prev7Days = data.filter(r => getDaysAgo(r.date) > 7 && getDaysAgo(r.date) <= 14);

    const uniqueDays = [...new Set(data.map(r => r.date))].length;
    const uniqueLast7 = [...new Set(last7Days.map(r => r.date))].length;

    const last7Sys = avg(last7Days.map(r => r.systolic));
    const prev7Sys = avg(prev7Days.map(r => r.systolic));
    const trend = prev7Days.length > 0 ? last7Sys - prev7Sys : null;

    return {
        avgSys: avg(data.map(r => r.systolic)),
        avgDia: avg(data.map(r => r.diastolic)),
        avgHR: avg(data.filter(r => r.heartRate).map(r => r.heartRate)),
        totalReadings: data.length,
        totalDays: uniqueDays,
        last7Days: uniqueLast7,
        last7Sys,
        last7Dia: avg(last7Days.map(r => r.diastolic)),
        trend,
        highest: data.length ? Math.max(...data.map(r => r.systolic)) : 0,
        lowest: data.length ? Math.min(...data.map(r => r.systolic)) : 0
    };
}

function renderStats() {
    const stats = calculateStats();

    if (!stats || stats.totalReadings === 0) {
        $('statsRow').innerHTML = '';
        return;
    }

    const status = getBPStatus(stats.avgSys, stats.avgDia);
    const weekStatus = getBPStatus(stats.last7Sys, stats.last7Dia);
    
    let trendText = '';
    let trendClass = '';
    if (stats.trend !== null) {
        if (stats.trend < -5) { trendText = 'Improving'; trendClass = 'trend-good'; }
        else if (stats.trend > 5) { trendText = 'Rising'; trendClass = 'trend-bad'; }
        else { trendText = 'Stable'; trendClass = 'trend-neutral'; }
    }

    $('statsRow').innerHTML = `
        <div class="stat-card">
            <div class="label">This Week Avg</div>
            <div class="value">${stats.last7Sys || '-'}/${stats.last7Dia || '-'}</div>
            <span class="status-badge ${weekStatus.class}">${weekStatus.text}</span>
            ${trendText ? `<div class="trend ${trendClass}">${trendText}</div>` : ''}
        </div>
        <div class="stat-card">
            <div class="label">Overall Avg</div>
            <div class="value">${stats.avgSys}/${stats.avgDia}</div>
            <span class="status-badge ${status.class}">${status.text}</span>
        </div>
        <div class="stat-card">
            <div class="label">Range</div>
            <div class="value">${stats.lowest}-${stats.highest}</div>
            <div class="sub">systolic</div>
        </div>
        <div class="stat-card">
            <div class="label">Tracked</div>
            <div class="value">${stats.totalDays}</div>
            <div class="sub">days (${stats.totalReadings} readings)</div>
        </div>
    `;
}

function renderChart() {
    const ctx = $('bpChart').getContext('2d');
    
    const last14 = {};
    const now = new Date();
    
    for (let i = 13; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        last14[date.toISOString().split('T')[0]] = { sys: [], dia: [] };
    }

    data.forEach(r => {
        if (last14[r.date]) {
            last14[r.date].sys.push(r.systolic);
            last14[r.date].dia.push(r.diastolic);
        }
    });

    const labels = Object.keys(last14).map(d => 
        new Date(d).toLocaleDateString('en', { month: 'short', day: 'numeric' })
    );

    const avg = arr => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Systolic',
                    data: Object.values(last14).map(d => avg(d.sys)),
                    borderColor: '#111',
                    tension: 0.35,
                    spanGaps: true,
                    pointRadius: 3,
                    pointBackgroundColor: '#111'
                },
                {
                    label: 'Diastolic',
                    data: Object.values(last14).map(d => avg(d.dia)),
                    borderColor: '#888',
                    tension: 0.35,
                    spanGaps: true,
                    pointRadius: 3,
                    pointBackgroundColor: '#888'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'DM Sans', size: 12 }, usePointStyle: true, padding: 20 }
                },
                annotation: {
                    annotations: {
                        crisis: { type: 'line', yMin: 180, yMax: 180, borderColor: '#dc2626', borderWidth: 1, borderDash: [5, 5] },
                        stage2: { type: 'line', yMin: 140, yMax: 140, borderColor: '#ea580c', borderWidth: 1, borderDash: [5, 5] },
                        stage1: { type: 'line', yMin: 130, yMax: 130, borderColor: '#ca8a04', borderWidth: 1, borderDash: [5, 5] },
                        normal: { type: 'line', yMin: 120, yMax: 120, borderColor: '#16a34a', borderWidth: 1, borderDash: [5, 5] }
                    }
                }
            },
            scales: {
                y: { min: 50, max: 220, grid: { color: '#f5f5f5' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function renderHistory() {
    if (data.length === 0) {
        $('historyTable').innerHTML = '<div class="empty-state">No readings yet</div>';
        return;
    }

    const rows = data.slice(0, 50).map(r => {
        const dateStr = new Date(r.date + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' });
        const status = getBPStatus(r.systolic, r.diastolic);
        
        return `<tr>
            <td>${dateStr}</td>
            <td>${r.time}</td>
            <td class="bp-value">${r.systolic}/${r.diastolic}</td>
            <td>${r.heartRate || '-'}</td>
            <td><span class="status-badge ${status.class}">${status.text}</span></td>
            <td><button class="delete-btn" onclick="deleteReading(${r.id})">x</button></td>
        </tr>`;
    }).join('');

    $('historyTable').innerHTML = `
        <table>
            <thead><tr><th>Date</th><th>Time</th><th>BP</th><th>HR</th><th>Status</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function renderAll() {
    renderStats();
    renderChart();
    renderHistory();
}

function initEventListeners() {
    $('prevDay').addEventListener('click', () => shiftDate(-1));
    $('nextDay').addEventListener('click', () => shiftDate(1));
    $('todayBtn').addEventListener('click', setToday);
    $('readingDate').addEventListener('change', updateDateDisplay);
    
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', () => setTime(btn.dataset.time));
    });
    
    $('systolic').addEventListener('input', updateStatusDisplay);
    $('diastolic').addEventListener('input', updateStatusDisplay);
    
    $('saveBtn').addEventListener('click', saveReading);
    $('exportBtn').addEventListener('click', exportCSV);
    $('importBtn').addEventListener('click', () => $('fileInput').click());
    $('fileInput').addEventListener('change', handleFileImport);
    
    document.addEventListener('keydown', function(e) {
        const inInput = ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
        
        if (e.key === 'Enter' && inInput) {
            e.preventDefault();
            saveReading();
        }
        
        if (!inInput) {
            if (e.key === 'ArrowLeft') shiftDate(-1);
            if (e.key === 'ArrowRight') shiftDate(1);
            if (e.key.toLowerCase() === 'm') setTime('AM');
            if (e.key.toLowerCase() === 'e') setTime('PM');
        }
    });
}

loadData();
initDate();
initEventListeners();
renderAll();
$('systolic').focus();
