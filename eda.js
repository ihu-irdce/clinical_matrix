/* ═══════════════════════════════════════════════════
   eda.js  —  EDA overlay: Demographics · Scores ·
              Missingness · Anthropometrics
   Requires Chart.js from CDN (loaded below)
═══════════════════════════════════════════════════ */
'use strict';

// Inject Chart.js once
(function() {
  if (!document.getElementById('chartjs-cdn')) {
    const s = document.createElement('script');
    s.id  = 'chartjs-cdn';
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    document.head.appendChild(s);
  }
})();

const FONT = "'DM Mono', 'Fira Mono', monospace";
const GRID_COLOR = 'rgba(30,41,59,0.8)';
const TEXT_COLOR = '#475569';
const SRC_COLORS_EDA = { TSASDI:'#3b82f6', REDCAP:'#10b981', DP:'#f59e0b' };
const srcColorEDA = s => SRC_COLORS_EDA[s] || '#6b7280';

// track active charts for destroy-on-redraw
const _charts = {};
function destroyChart(id) { if (_charts[id]) { _charts[id].destroy(); delete _charts[id]; } }

const BASE_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: TEXT_COLOR, font: { family: FONT, size: 9 }, boxWidth: 10, padding: 12 } },
    tooltip: { backgroundColor: '#0a0f20', borderColor: '#1e293b', borderWidth: 1, titleColor: '#e2e8f0', bodyColor: '#94a3b8', titleFont: { family: FONT }, bodyFont: { family: FONT, size: 10 } },
  },
  scales: {
    x: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, font: { family: FONT, size: 8 } } },
    y: { grid: { color: GRID_COLOR }, ticks: { color: TEXT_COLOR, font: { family: FONT, size: 8 } } },
  },
};

function makeChart(id, type, data, options) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  _charts[id] = new Chart(el.getContext('2d'), { type, data, options });
}

// ── UTILS ─────────────────────────────────────────
const toN = v => { if (v===null||v===undefined) return null; const n=parseFloat(v); return isNaN(n)?null:n; };

function histogram(values, bins, lo, hi) {
  const w = (hi-lo)/bins;
  const counts = Array(bins).fill(0);
  values.forEach(v => {
    const idx = Math.min(Math.floor((v-lo)/w), bins-1);
    if (idx >= 0) counts[idx]++;
  });
  const labels = Array.from({length:bins}, (_,i) => `${Math.round(lo+i*w)}`);
  return { labels, counts };
}

function kde(values, lo, hi, steps=80) {
  const bw = 1.06 * Math.sqrt(values.reduce((a,v)=>{const d=v-values.reduce((s,x)=>s+x,0)/values.length;return a+d*d;},0)/values.length) * Math.pow(values.length,-0.2) || 2;
  const pts = Array.from({length:steps}, (_,i) => lo + (hi-lo)*i/(steps-1));
  const dens = pts.map(x => values.reduce((s,v) => s + Math.exp(-0.5*((x-v)/bw)**2),0) / (values.length*bw*Math.sqrt(2*Math.PI)));
  return { xs: pts.map(v=>v.toFixed(1)), ys: dens };
}

// ── TAB: DEMOGRAPHICS ─────────────────────────────
function renderDemographics(data) {
  const sources = [...new Set(data.map(r=>r.SOURCE))].sort();

  // stats
  const ages = data.map(r=>toN(r.AGE)).filter(v=>v!==null&&v>0&&v<80);
  const avgAge = ages.length ? (ages.reduce((a,b)=>a+b,0)/ages.length).toFixed(1) : '—';
  const maleN  = data.filter(r=>r.SEX==='M').length;
  const femaleN= data.filter(r=>r.SEX==='F').length;
  const ratio  = femaleN>0 ? (maleN/femaleN).toFixed(1) : '—';
  const dsm5N  = data.filter(r=>toN(r.DSM5_MET)===1).length;

  document.getElementById('eda-body').innerHTML = `
    <div class="eda-stat-row">
      <div class="eda-stat"><div class="eda-stat-val" style="color:#3b82f6">${data.length}</div><div class="eda-stat-lbl">SUBJECTS</div></div>
      <div class="eda-stat"><div class="eda-stat-val" style="color:#f59e0b">${avgAge}</div><div class="eda-stat-lbl">MEAN AGE (yr)</div></div>
      <div class="eda-stat"><div class="eda-stat-val" style="color:#10b981">${ratio}</div><div class="eda-stat-lbl">M:F RATIO</div></div>
      <div class="eda-stat"><div class="eda-stat-val" style="color:#4ade80">${dsm5N}</div><div class="eda-stat-lbl">DSM5+</div></div>
    </div>
    <div class="eda-grid">
      <div class="eda-card"><div class="eda-card-title">Sex by Database</div><div style="height:200px"><canvas id="chart-sex"></canvas></div></div>
      <div class="eda-card"><div class="eda-card-title">Age Distribution (all)</div><div style="height:200px"><canvas id="chart-age-hist"></canvas></div></div>
      <div class="eda-card"><div class="eda-card-title">Age KDE by Source</div><div style="height:200px"><canvas id="chart-age-kde"></canvas></div></div>
      <div class="eda-card"><div class="eda-card-title">Age Bands by Source</div><div style="height:200px"><canvas id="chart-agebands"></canvas></div></div>
    </div>`;

  waitForChartJS(() => {
    // Sex by DB stacked bar
    const sexData = {};
    sources.forEach(s => {
      const rows = data.filter(r=>r.SOURCE===s);
      sexData[s] = { M: rows.filter(r=>r.SEX==='M').length, F: rows.filter(r=>r.SEX==='F').length };
    });
    makeChart('chart-sex','bar',{
      labels: sources,
      datasets:[
        { label:'Male',   data:sources.map(s=>sexData[s].M), backgroundColor:'#60a5fa99', borderColor:'#3b82f6', borderWidth:1 },
        { label:'Female', data:sources.map(s=>sexData[s].F), backgroundColor:'#f472b699', borderColor:'#ec4899', borderWidth:1 },
      ]
    }, mergeOpts({ plugins:{ legend:{display:true} }, scales:{ x:{stacked:true}, y:{stacked:true} } }));

    // Age histogram
    const validAges = data.map(r=>toN(r.AGE)).filter(v=>v!==null&&v>0&&v<50);
    const {labels,counts} = histogram(validAges, 20, 0, 40);
    makeChart('chart-age-hist','bar',{
      labels,
      datasets:[{ label:'N subjects', data:counts, backgroundColor:'#3b82f666', borderColor:'#3b82f6', borderWidth:1 }]
    }, mergeOpts({ plugins:{legend:{display:false}} }));

    // Age KDE by source
    const kdeDatasets = sources.map(s => {
      const vals = data.filter(r=>r.SOURCE===s).map(r=>toN(r.AGE)).filter(v=>v!==null&&v>0&&v<50);
      if (!vals.length) return null;
      const k = kde(vals,0,40);
      return { label:s, data:k.ys.map((y,i)=>({x:+k.xs[i],y})), borderColor:srcColorEDA(s), backgroundColor:'transparent', borderWidth:2, pointRadius:0, fill:false, tension:.4 };
    }).filter(Boolean);
    makeChart('chart-age-kde','line',{ datasets:kdeDatasets },
      mergeOpts({ parsing:false, scales:{ x:{ type:'linear', title:{display:true,text:'Age (yr)',color:TEXT_COLOR,font:{family:FONT,size:8}} }, y:{ title:{display:true,text:'Density',color:TEXT_COLOR,font:{family:FONT,size:8}} } }, plugins:{legend:{display:true}} }));

    // Age bands stacked
    const bands = ['<3yr','3–6','6–12','12–18','18+'];
    const bandFn = a => a<3?'<3yr':a<6?'3–6':a<12?'6–12':a<18?'12–18':'18+';
    const bandColors = ['#3b82f6','#10b981','#f59e0b','#8b5cf6','#ec4899'];
    const bandDatasets = bands.map((b,bi) => ({
      label:b,
      data: sources.map(s => data.filter(r=>r.SOURCE===s&&r.AGE!==null&&r.AGE>0).filter(r=>bandFn(r.AGE)===b).length),
      backgroundColor: bandColors[bi]+'99', borderColor: bandColors[bi], borderWidth:1
    }));
    makeChart('chart-agebands','bar',{ labels:sources, datasets:bandDatasets },
      mergeOpts({ scales:{ x:{stacked:true}, y:{stacked:true} }, plugins:{legend:{display:true, labels:{font:{family:FONT,size:8},boxWidth:8}}} }));
  });
}

// ── TAB: SCORE DISTRIBUTIONS ──────────────────────
function renderScores(data) {
  const SCORE_DEFS = [
    { key:'ADOS_Total',  label:'ADOS-2 Total',    color:'#f59e0b', lo:0,  hi:22, cutoff:7   },
    { key:'ADOS_AS',     label:'ADOS Affect Soc.', color:'#fbbf24', lo:0,  hi:14, cutoff:4   },
    { key:'ADI_A',       label:'ADI-R Social (A)', color:'#10b981', lo:0,  hi:35, cutoff:10  },
    { key:'ADI_BV',      label:'ADI-R Comm (BV)',  color:'#34d399', lo:0,  hi:26             },
    { key:'VABS_CA_NC',  label:'VABS Composite',   color:'#8b5cf6', lo:20, hi:130,cutoff:70, below:true },
    { key:'VABS_Com_NS', label:'VABS Communication',color:'#a78bfa',lo:20, hi:130 },
    { key:'SRS_Total',   label:'SRS Total',         color:'#ec4899', lo:40, hi:160,cutoff:76 },
    { key:'ADHD_Total',  label:'ADHD-RS Total',     color:'#f97316', lo:0,  hi:54, cutoff:24 },
  ];
  const sources = [...new Set(data.map(r=>r.SOURCE))].sort();

  document.getElementById('eda-body').innerHTML = `<div class="eda-grid">${SCORE_DEFS.map(sd=>`
    <div class="eda-card">
      <div class="eda-card-title">${sd.label}</div>
      <div style="height:160px"><canvas id="chart-sc-${sd.key}"></canvas></div>
    </div>`).join('')}</div>`;

  waitForChartJS(() => {
    SCORE_DEFS.forEach(sd => {
      const datasets = sources.map(src => {
        const vals = data.filter(r=>r.SOURCE===src).map(r=>toN(r[sd.key])).filter(v=>v!==null&&v!==9999&&v>=sd.lo&&v<=sd.hi);
        if (!vals.length) return null;
        const { labels, counts } = histogram(vals, 15, sd.lo, sd.hi);
        return { label:src, data:counts, labels, backgroundColor:srcColorEDA(src)+'88', borderColor:srcColorEDA(src), borderWidth:1 };
      }).filter(Boolean);

      if (!datasets.length) return;
      const allLabels = datasets[0].labels;

      const annotations = {};
      if (sd.cutoff !== undefined) {
        // find bin containing cutoff
        const w = (sd.hi-sd.lo)/15;
        const binIdx = Math.min(Math.floor((sd.cutoff-sd.lo)/w),14);
        annotations['cutoffLine'] = {
          type:'line', scaleID:'x', value: sd.below ? binIdx-0.5 : binIdx+0.5,
          borderColor:'#fbbf24', borderWidth:1, borderDash:[4,3],
          label:{ content:'cutoff', display:true, color:'#fbbf24', font:{family:FONT,size:7}, position:'end' }
        };
      }

      makeChart(`chart-sc-${sd.key}`,'bar',
        { labels:allLabels, datasets:datasets.map(d=>({label:d.label,data:d.data,backgroundColor:d.backgroundColor,borderColor:d.borderColor,borderWidth:d.borderWidth})) },
        mergeOpts({ scales:{ x:{ stacked:true, title:{display:true,text:'Score',color:TEXT_COLOR,font:{family:FONT,size:7}} }, y:{ stacked:true, title:{display:true,text:'N',color:TEXT_COLOR,font:{family:FONT,size:7}} } }, plugins:{ legend:{ display:true, labels:{font:{family:FONT,size:8},boxWidth:8} } } })
      );
    });
  });
}

// ── TAB: MISSINGNESS ──────────────────────────────
function renderMissingness(data) {
  const sources = [...new Set(data.map(r=>r.SOURCE))].sort();
  const allCols = window.PANELS ? window.PANELS.flatMap(p=>p.cols) : [];

  // compute missingness pct per source × col
  const table = allCols.map(col => {
    const row = { key: col.key, label: col.label, panel: '' };
    window.PANELS.forEach(p => { if (p.cols.find(c=>c.key===col.key)) row.panel=p.label; });
    sources.forEach(src => {
      const rows = data.filter(r=>r.SOURCE===src);
      const missing = rows.filter(r=>r[col.key]===null).length;
      const invalid = rows.filter(r=>r[col.key]===9999).length;
      row[src+'_miss'] = rows.length ? (missing/rows.length*100).toFixed(0) : 100;
      row[src+'_inv']  = rows.length ? (invalid/rows.length*100).toFixed(0) : 0;
    });
    return row;
  });

  // heatmap grid
  const cellW = Math.max(60, Math.floor((720-120)/(sources.length||1)));
  const cellH = 22;

  let grid = `<div style="overflow-x:auto">
    <div style="display:grid;grid-template-columns:120px ${sources.map(()=>`${cellW}px`).join(' ')};gap:1px;min-width:fit-content">
      <div class="miss-axis-label" style="padding:4px 0;font-size:8px;letter-spacing:2px;color:var(--muted)">INSTRUMENT</div>
      ${sources.map(s=>`<div class="miss-axis-label" style="text-align:center;padding:4px 2px;color:${srcColorEDA(s)};font-weight:600">${s}</div>`).join('')}`;

  let lastPanel = '';
  table.forEach(row => {
    if (row.panel !== lastPanel) {
      grid += `<div style="grid-column:1/-1;padding:5px 0 3px;font-size:7px;letter-spacing:3px;color:var(--muted);border-top:1px solid var(--border)">${row.panel.toUpperCase()}</div>`;
      lastPanel = row.panel;
    }
    grid += `<div class="miss-axis-label" style="padding:2px 4px;height:${cellH}px;display:flex;align-items:center;font-size:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${row.key}">${row.label}</div>`;
    sources.forEach(src => {
      const m = +row[src+'_miss'];
      const inv = +row[src+'_inv'];
      if (inv > 50) {
        grid += `<div class="miss-cell" style="height:${cellH}px;background:#1e293b;display:flex;align-items:center;justify-content:center;font-size:7px;color:#475569" title="Age N/A">N/A</div>`;
      } else {
        const pres = 100-m;
        const r=Math.floor(14+(1-pres/100)*20), g=Math.floor(pres/100*120+20), b=Math.floor(60+(1-pres/100)*30);
        const bg = `rgb(${r},${g},${b})`;
        const tc = pres>50?'#fff':'#64748b';
        grid += `<div class="miss-cell" style="height:${cellH}px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:7px;color:${tc};font-weight:600" title="${row.key} (${src}): ${pres}% present">${pres}%</div>`;
      }
    });
  });
  grid += '</div></div>';

  // overall bar chart
  document.getElementById('eda-body').innerHTML = `
    <div class="eda-grid-wide">
      <div class="eda-card">
        <div class="eda-card-title">Missingness Heatmap — % Data Present per Instrument × Database</div>
        <div style="margin-bottom:10px;font-size:9px;color:var(--muted)">Green = present · Dark = missing · N/A = age-invalid (9999)</div>
        ${grid}
      </div>
      <div class="eda-card">
        <div class="eda-card-title">Overall Completeness by Instrument</div>
        <div style="height:280px"><canvas id="chart-miss-overall"></canvas></div>
      </div>
    </div>`;

  waitForChartJS(() => {
    const datasets = sources.map(src => ({
      label: src,
      data: table.map(row => 100 - +row[src+'_miss']),
      backgroundColor: srcColorEDA(src)+'88',
      borderColor: srcColorEDA(src),
      borderWidth: 1,
    }));
    makeChart('chart-miss-overall','bar',
      { labels: table.map(r=>r.label), datasets },
      mergeOpts({ indexAxis:'y', scales:{ x:{ min:0, max:100, title:{display:true,text:'% Present',color:TEXT_COLOR,font:{family:FONT,size:8}} }, y:{ ticks:{font:{family:FONT,size:7},color:TEXT_COLOR} } }, plugins:{ legend:{display:true,labels:{font:{family:FONT,size:8},boxWidth:8}} } })
    );
  });
}

// ── TAB: ANTHROPOMETRICS ──────────────────────────
function renderAnthropometrics(data) {
  const sources = [...new Set(data.map(r=>r.SOURCE))].sort();

  const pairs = data.filter(r=>r.POIDS!==null&&r.TAILLE!==null&&r.POIDS>0&&r.TAILLE>30&&r.POIDS<200&&r.TAILLE<250);
  const bmis  = pairs.map(r=>+(r.POIDS/((r.TAILLE/100)**2)).toFixed(1)).filter(v=>v>5&&v<80);
  const avgBMI = bmis.length?(bmis.reduce((a,b)=>a+b,0)/bmis.length).toFixed(1):'—';
  const avgW  = pairs.length?(pairs.reduce((a,r)=>a+r.POIDS,0)/pairs.length).toFixed(1):'—';
  const avgH  = pairs.length?(pairs.reduce((a,r)=>a+r.TAILLE,0)/pairs.length).toFixed(1):'—';

  document.getElementById('eda-body').innerHTML = `
    <div class="eda-stat-row">
      <div class="eda-stat"><div class="eda-stat-val" style="color:#14b8a6">${pairs.length}</div><div class="eda-stat-lbl">W×H PAIRS</div></div>
      <div class="eda-stat"><div class="eda-stat-val" style="color:#14b8a6">${avgW}</div><div class="eda-stat-lbl">MEAN WEIGHT (kg)</div></div>
      <div class="eda-stat"><div class="eda-stat-val" style="color:#14b8a6">${avgH}</div><div class="eda-stat-lbl">MEAN HEIGHT (cm)</div></div>
      <div class="eda-stat"><div class="eda-stat-val" style="color:#14b8a6">${avgBMI}</div><div class="eda-stat-lbl">MEAN BMI</div></div>
    </div>
    <div class="eda-grid">
      <div class="eda-card" style="grid-column:span 2"><div class="eda-card-title">Weight × Height Scatter (coloured by source)</div><div style="height:280px"><canvas id="chart-wh-scatter"></canvas></div></div>
      <div class="eda-card"><div class="eda-card-title">BMI Distribution</div><div style="height:200px"><canvas id="chart-bmi-hist"></canvas></div></div>
      <div class="eda-card"><div class="eda-card-title">Weight Distribution by Source</div><div style="height:200px"><canvas id="chart-weight-src"></canvas></div></div>
    </div>`;

  waitForChartJS(() => {
    // Scatter: weight × height by source
    const scatterDatasets = sources.map(src => ({
      label: src,
      data: pairs.filter(r=>r.SOURCE===src).map(r=>({ x:r.TAILLE, y:r.POIDS })),
      backgroundColor: srcColorEDA(src)+'88',
      borderColor: srcColorEDA(src),
      borderWidth: 1, pointRadius: 3, pointHoverRadius: 5,
    }));
    makeChart('chart-wh-scatter','scatter',{ datasets:scatterDatasets },
      mergeOpts({ scales:{
        x:{ title:{display:true,text:'Height (cm)',color:TEXT_COLOR,font:{family:FONT,size:8}} },
        y:{ title:{display:true,text:'Weight (kg)',color:TEXT_COLOR,font:{family:FONT,size:8}} }
      }, plugins:{ legend:{display:true,labels:{font:{family:FONT,size:9},boxWidth:8}} } })
    );

    // BMI histogram
    const {labels,counts} = histogram(bmis, 20, 10, 50);
    // colour bars by BMI category
    const catColors = labels.map(l => {
      const v=+l; return v<18.5?'#60a5fa99':v<25?'#4ade8099':v<30?'#fbbf2499':'#f8717199';
    });
    makeChart('chart-bmi-hist','bar',{
      labels,
      datasets:[{ label:'N', data:counts, backgroundColor:catColors, borderColor:catColors.map(c=>c.replace('99','ff')), borderWidth:1 }]
    }, mergeOpts({ plugins:{legend:{display:false}} }));

    // Weight distribution by source
    const wDatasets = sources.map(src => {
      const vals = data.filter(r=>r.SOURCE===src).map(r=>toN(r.POIDS)).filter(v=>v!==null&&v>0&&v<200);
      if (!vals.length) return null;
      const {labels:wl,counts:wc} = histogram(vals,15,0,100);
      return { label:src, data:wc, labels:wl, backgroundColor:srcColorEDA(src)+'88', borderColor:srcColorEDA(src), borderWidth:1 };
    }).filter(Boolean);
    if (wDatasets.length) {
      makeChart('chart-weight-src','bar',
        { labels:wDatasets[0].labels, datasets:wDatasets },
        mergeOpts({ scales:{ x:{stacked:true}, y:{stacked:true} }, plugins:{legend:{display:true,labels:{font:{family:FONT,size:8},boxWidth:8}}} })
      );
    }
  });
}

// ── MERGE CHART OPTIONS ───────────────────────────
function mergeOpts(extra={}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false, labels: { color: TEXT_COLOR, font: { family: FONT, size: 9 }, boxWidth: 10, padding: 10 } },
      tooltip: BASE_OPTS.plugins.tooltip,
      ...( extra.plugins || {} ),
    },
    scales: {
      x: { grid:{color:GRID_COLOR}, ticks:{color:TEXT_COLOR,font:{family:FONT,size:8}}, ...(extra.scales?.x||{}) },
      y: { grid:{color:GRID_COLOR}, ticks:{color:TEXT_COLOR,font:{family:FONT,size:8}}, ...(extra.scales?.y||{}) },
    },
    indexAxis: extra.indexAxis,
    parsing: extra.parsing,
  };
}

// ── ENTRY POINT ───────────────────────────────────
function waitForChartJS(cb, tries=0) {
  if (typeof Chart !== 'undefined') { cb(); return; }
  if (tries > 30) { console.warn('Chart.js failed to load'); return; }
  setTimeout(() => waitForChartJS(cb, tries+1), 150);
}

window.renderEDA = function(tab) {
  const data = window.getRAW ? window.getRAW() : [];
  if (!data.length) {
    document.getElementById('eda-body').innerHTML = '<div style="padding:40px;text-align:center;color:var(--muted)">No data loaded yet.</div>';
    return;
  }
  // destroy all existing charts on tab switch
  Object.keys(_charts).forEach(destroyChart);

  if (tab==='demographics')  renderDemographics(data);
  else if (tab==='scores')   renderScores(data);
  else if (tab==='missingness') renderMissingness(data);
  else if (tab==='anthropo') renderAnthropometrics(data);
};
