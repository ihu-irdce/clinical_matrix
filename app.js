/* ═══════════════════════════════════════════════════
   app.js  —  Matrix · Filters · Report · CSV export
═══════════════════════════════════════════════════ */
'use strict';

// ── CLINICAL CUTOFFS ──────────────────────────────
const CUTOFFS = {
  ADOS_Total:  { value: 7,   label: 'ADOS ≥7 (ASD range)' },
  ADOS_AS:     { value: 4,   label: 'ADOS AS ≥4' },
  SRS_Total:   { value: 76,  label: 'SRS ≥76 (T-score equiv.)' },
  ADI_A:       { value: 10,  label: 'ADI-R A ≥10' },
  ADHD_Total:  { value: 24,  label: 'ADHD-RS ≥24' },
  VABS_CA_NC:  { value: 70,  label: 'VABS ≤70 (2 SD below)', below: true },
  VABS_Com_NS: { value: 70,  label: 'VABS Com ≤70', below: true },
};

// ── PANEL DEFINITIONS ─────────────────────────────
const PANELS = [
  { id:'diag',  label:'Diagnosis', color:'#0ea5e9', sub:'DSM-5 · Cons · ADx', cols:[
    { key:'DSM5_MET',       label:'DSM5', type:'binary01' },
    { key:'DIAG_CONSENSUS', label:'Cons', type:'binary01' },
    { key:'ADOS_DIAG',      label:'ADx',  type:'cat', domain:[1,2,3], labels:['Aut','TSA','Non'] },
  ]},
  { id:'ados',  label:'ADOS-2',    color:'#f59e0b', sub:'AS · CRR · Total', cols:[
    { key:'ADOS_AS',    label:'AS',  type:'numeric', lo:0,  hi:14 },
    { key:'ADOS_CRR',  label:'CRR', type:'numeric', lo:0,  hi:8  },
    { key:'ADOS_Total',label:'Tot', type:'numeric', lo:0,  hi:22 },
    { key:'ADOS_Mod',  label:'Mod', type:'cat', domain:['T',1,2,3,4], labels:['T','1','2','3','4'] },
  ]},
  { id:'adir',  label:'ADI-R',     color:'#10b981', sub:'A · BV · BNV · C', cols:[
    { key:'ADI_A',   label:'A',   type:'numeric', lo:0, hi:30 },
    { key:'ADI_BV',  label:'BV',  type:'numeric', lo:0, hi:26 },
    { key:'ADI_BNV', label:'BNV', type:'numeric', lo:0, hi:20 },
    { key:'ADI_C',   label:'C',   type:'numeric', lo:0, hi:10 },
  ]},
  { id:'vabs',  label:'Vineland',  color:'#8b5cf6', sub:'Comp · Com · Soc · VQ', cols:[
    { key:'VABS_CA_NC',  label:'Comp', type:'numeric', lo:20, hi:130, rev:true },
    { key:'VABS_Com_NS', label:'Com',  type:'numeric', lo:20, hi:130, rev:true },
    { key:'VABS_Soc_NS', label:'Soc',  type:'numeric', lo:20, hi:130, rev:true },
    { key:'VABS_VQ_NS',  label:'VQ',   type:'numeric', lo:20, hi:130, rev:true },
  ]},
  { id:'srs',   label:'SRS',       color:'#ec4899', cols:[
    { key:'SRS_Total', label:'Tot', type:'numeric', lo:40, hi:160 },
  ]},
  { id:'adhd',  label:'ADHD-RS',   color:'#f97316', sub:'Inat · Sub · Tot', cols:[
    { key:'ADHD_Inatt', label:'Inat', type:'numeric', lo:0, hi:27 },
    { key:'ADHD_Sub',   label:'Sub',  type:'numeric', lo:0, hi:27 },
    { key:'ADHD_Total', label:'Tot',  type:'numeric', lo:0, hi:54 },
  ]},
  { id:'anthr', label:'Anthropo',  color:'#14b8a6', sub:'Wt · Ht', cols:[
    { key:'POIDS',  label:'Wt(kg)', type:'numeric', lo:3,  hi:80  },
    { key:'TAILLE', label:'Ht(cm)', type:'numeric', lo:50, hi:180, rev:true },
  ]},
];

const SRC_COLORS = { TSASDI:'#3b82f6', REDCAP:'#10b981', DP:'#f59e0b' };
const srcColor = s => SRC_COLORS[s] || '#6b7280';

// ── STATE ─────────────────────────────────────────
let RAW = [];
const ST = { sort:'SOURCE', src:'ALL', sex:'ALL', ageBand:'ALL', diag:'ALL', zoom:20, highlight:null, legend:true, cutoffs:false, search:'' };

// ── UTILS ─────────────────────────────────────────
const toNum = v => { if (v===null||v===undefined) return null; const n=parseFloat(v); return isNaN(n)?null:n; };
const fmt   = (v,d=1) => { const n=toNum(v); return n===null?null:+n.toFixed(d); };

function normaliseRow(r, i) {
  const g = (...ks) => { for (const k of ks) if (r[k]!==null&&r[k]!==undefined) return r[k]; return null; };
  return {
    id:     g('SUBJECT_ID','id') || `S${String(i+1).padStart(4,'0')}`,
    SOURCE: g('UNIT_DB','SOURCE') || 'UNKNOWN',
    SEX:    String(g('SEXE','SEX')||'?').toUpperCase()[0]||'?',
    AGE:    fmt(g('AGE_YEARS','AGE')),
    DSM5_MET:       toNum(g('DSM5_MET')),
    DIAG_CONSENSUS: toNum(g('DIAG_CONSENSUS')),
    ADOS_DIAG:      toNum(g('ADOS_DIAG')),
    ADOS_AS:    toNum(g('ADOS_AS')),    ADOS_CRR:   toNum(g('ADOS_CRR')),
    ADOS_Total: toNum(g('ADOS_Total')), ADOS_Mod:   g('ADOS_Mod'),
    ADI_A:   toNum(g('ADI_A')),  ADI_BV:  toNum(g('ADI_BV')),
    ADI_BNV: toNum(g('ADI_BNV')),ADI_C:   toNum(g('ADI_C')),
    VABS_CA_NC:  toNum(g('VABS_CA_NC')),  VABS_Com_NS: toNum(g('VABS_Com_NS')),
    VABS_Soc_NS: toNum(g('VABS_Soc_NS')), VABS_VQ_NS:  toNum(g('VABS_VQ_NS')),
    SRS_Total:  toNum(g('SRS_Total')),
    ADHD_Inatt: toNum(g('ADHD_Inatt')), ADHD_Sub:   toNum(g('ADHD_Sub')),  ADHD_Total: toNum(g('ADHD_Total')),
    POIDS: toNum(g('POIDS')), TAILLE: toNum(g('TAILLE')),
  };
}

// ── CELL RENDER ───────────────────────────────────
function cellStyle(val, col, color) {
  if (val === 9999) return { bg:'#1e293b', label:'—',  tc:'#475569', tip:'Age N/A' };
  if (val === null) return { bg:'#060b18', label:'',   tc:'#1e293b', tip:'No data' };
  if (col.type==='binary01') {
    const pos = val===1||val==='1';
    return { bg:pos?color+'cc':'#1e293b', label:pos?'✓':'○', tc:pos?'#fff':'#475569', tip:pos?'Yes':'No' };
  }
  if (col.type==='cat') {
    const idx  = col.domain.indexOf(val)!==-1?col.domain.indexOf(val):col.domain.indexOf(+val);
    const hues = ['#60a5fa','#34d399','#fbbf24','#f87171','#a78bfa'];
    const bg   = idx>=0?hues[idx%hues.length]+'99':'#334155';
    const lbl  = col.labels?(col.labels[idx]??String(val)):String(val);
    return { bg, label:lbl.slice(0,4), tc:'#e2e8f0', tip:String(val) };
  }
  if (col.type==='numeric') {
    const n = toNum(val); if (n===null) return { bg:'#060b18', label:'', tc:'#1e293b', tip:'No data' };
    const t = Math.max(0,Math.min(1,(n-col.lo)/(col.hi-col.lo)));
    const i = col.rev?1-t:t;
    const alpha = Math.round(20+i*210).toString(16).padStart(2,'0');
    return { bg:color+alpha, label:String(Math.round(n)), tc:i>0.55?'#fff':'#94a3b8', tip:`${col.key}: ${n}` };
  }
  return { bg:'#1e293b', label:String(val).slice(0,4), tc:'#94a3b8', tip:String(val) };
}

function isAboveCutoff(key, val) {
  const c = CUTOFFS[key]; if (!c) return false;
  const n = toNum(val); if (n===null||n===9999) return false;
  return c.below ? n < c.value : n >= c.value;
}

// ── FILTER + SORT ─────────────────────────────────
function ageBandMatch(age, band) {
  if (band==='ALL') return true;
  if (age===null) return false;
  if (band==='0-3')   return age < 3;
  if (band==='3-6')   return age >= 3  && age < 6;
  if (band==='6-12')  return age >= 6  && age < 12;
  if (band==='12-18') return age >= 12 && age < 18;
  if (band==='18+')   return age >= 18;
  return true;
}

function diagMatch(row, diag) {
  if (diag==='ALL')  return true;
  if (diag==='DSM5') return row.DSM5_MET===1;
  if (diag==='ADOS') return toNum(row.ADOS_DIAG)===1 || toNum(row.ADOS_DIAG)===2;
  if (diag==='NONE') return row.DSM5_MET!==1 && toNum(row.ADOS_DIAG)!==1 && toNum(row.ADOS_DIAG)!==2;
  return true;
}

function getDisplayData() {
  let d = RAW.slice();
  if (ST.src!=='ALL')     d = d.filter(r => r.SOURCE===ST.src);
  if (ST.sex!=='ALL')     d = d.filter(r => r.SEX===ST.sex);
  if (ST.ageBand!=='ALL') d = d.filter(r => ageBandMatch(r.AGE, ST.ageBand));
  if (ST.diag!=='ALL')    d = d.filter(r => diagMatch(r, ST.diag));
  d.sort((a,b) => {
    if (ST.sort==='SOURCE') return (a.SOURCE||'').localeCompare(b.SOURCE||'') || (a.AGE??99)-(b.AGE??99);
    if (ST.sort==='AGE')    return (a.AGE??999)-(b.AGE??999);
    if (ST.sort==='DSM5')   return (b.DSM5_MET??-1)-(a.DSM5_MET??-1);
    if (ST.sort==='ADOS')   return (b.ADOS_Total??-1)-(a.ADOS_Total??-1);
    return 0;
  });
  return d;
}

// ── RENDER ─────────────────────────────────────────
function render() {
  const data = getDisplayData();
  const CS   = ST.zoom;
  const IW   = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--id-col-w'))||90;
  document.documentElement.style.setProperty('--cell-size', `${CS}px`);
  const fs = Math.max(5, CS/4);
  const q  = ST.search.toLowerCase().trim();

  // source badges
  const counts = {};
  data.forEach(r => { counts[r.SOURCE]=(counts[r.SOURCE]||0)+1; });
  document.getElementById('source-badges').innerHTML =
    Object.entries(counts).map(([src,n]) => {
      const c=srcColor(src);
      return `<span class="src-badge" style="background:${c}1a;border:1px solid ${c}44;color:${c}">${src} n=${n}</span>`;
    }).join('');

  // completeness footer
  const ci = document.getElementById('completeness-items');
  ci.innerHTML = '';
  PANELS.forEach(p => p.cols.forEach(col => {
    const filled = data.filter(r=>r[col.key]!==null&&r[col.key]!==9999).length;
    const pct = data.length? filled/data.length*100 : 0;
    const fgcol = pct>60?p.color:'var(--subtle)';
    const el = document.createElement('div'); el.className='c-item';
    el.innerHTML=`<div class="c-lbl">${col.label}</div><div class="c-bar"><div class="c-fill" style="width:${pct.toFixed(0)}%;background:${p.color}"></div></div><div class="c-pct" style="color:${fgcol}">${Math.round(pct)}%</div>`;
    ci.appendChild(el);
  }));

  // active filter pills
  const pills = document.getElementById('active-filter-pills');
  pills.innerHTML = '';
  const addPill = (label,color) => { const d=document.createElement('div'); d.className='filter-pill'; d.style.borderColor=color||''; d.style.color=color||''; d.textContent=label; pills.appendChild(d); };
  if (ST.src!=='ALL')     addPill(ST.src, srcColor(ST.src));
  if (ST.sex!=='ALL')     addPill(`Sex: ${ST.sex}`, '#7c3aed');
  if (ST.ageBand!=='ALL') addPill(`Age: ${ST.ageBand}`, '#0e7490');
  if (ST.diag!=='ALL')    addPill(`Diag: ${ST.diag}`, '#166534');
  if (q)                  addPill(`Search: "${q}"`, '#f59e0b');
  if (ST.cutoffs)         addPill('Cutoffs ON', '#fbbf24');

  // build table
  const parts = [];
  parts.push('<thead><tr>');
  parts.push(`<th class="th-id" rowspan="2" style="width:${IW}px">ID</th>`);
  parts.push(`<th colspan="3" class="th-panel" style="background:var(--surface);border-left:none;width:${CS*3}px"><span style="font-size:7px;color:var(--muted);letter-spacing:2px">META</span></th>`);
  PANELS.forEach(p => {
    parts.push(`<th colspan="${p.cols.length}" class="th-panel" style="background:${p.color}12;border-top:2px solid ${p.color}88;color:${p.color};width:${CS*p.cols.length}px">${p.label}${p.sub?`<div class="th-panel-sub">${p.sub}</div>`:''}</th>`);
  });
  parts.push('</tr><tr>');
  ['SRC','SEX','AGE'].forEach((m,mi)=>{
    const bdr=mi===2?'border-right:2px solid var(--border);':'';
    parts.push(`<th class="th-meta" style="width:${CS}px;${bdr}">${m}</th>`);
  });
  PANELS.forEach(p => p.cols.forEach((col,ci)=>{
    const bdrL  = ci===0?'border-left:2px solid var(--border);':'border-left:1px solid var(--surface2);';
    const isHl  = ST.highlight===col.key;
    const hlBg  = isHl?`background:${p.color}28;`:'';
    const hlCol = isHl?`color:${p.color};`:'';
    parts.push(`<th class="th-col${isHl?' hl':''}" data-key="${col.key}" style="width:${CS}px;${bdrL}border-bottom-color:${p.color}66;${hlBg}${hlCol}" title="${col.key}"><span style="display:block;overflow:hidden;text-overflow:ellipsis">${col.label}</span></th>`);
  }));
  parts.push('</tr></thead><tbody>');

  data.forEach((row,ri) => {
    const sc      = srcColor(row.SOURCE);
    const prevSrc = ri>0?data[ri-1].SOURCE:null;
    if (row.SOURCE!==prevSrc && ri>0 && ST.sort==='SOURCE') {
      parts.push(`<tr class="sep-row" style="color:${sc}55"><td colspan="999"></td></tr>`);
    }
    const age    = row.AGE!==null?row.AGE:'';
    const sexCol = row.SEX==='M'?'#60a5fa':row.SEX==='F'?'#f472b6':'#94a3b8';
    const matchQ = q ? row.id.toLowerCase().includes(q) : false;
    const rowCls = q ? (matchQ?'data-row search-match':'data-row search-no-match') : 'data-row';
    parts.push(`<tr class="${rowCls}" data-idx="${ri}">`);
    parts.push(`<td class="td-id" style="width:${IW}px;height:${CS}px;font-size:${Math.max(6,CS/3.8)}px"><span style="color:${sc}88;margin-right:2px">▐</span>${row.id}</td>`);
    parts.push(`<td class="td-meta" style="width:${CS}px;height:${CS}px;background:${sc}18;font-size:${fs}px;color:${sc};font-weight:700">${row.SOURCE.slice(0,2)}</td>`);
    parts.push(`<td class="td-meta" style="width:${CS}px;height:${CS}px;font-size:${fs}px;color:${sexCol}">${row.SEX}</td>`);
    parts.push(`<td class="td-meta td-age" style="width:${CS}px;height:${CS}px;font-size:${fs}px;color:#94a3b8">${age}</td>`);
    PANELS.forEach(p => p.cols.forEach((col,ci)=>{
      const {bg,label,tc,tip} = cellStyle(row[col.key],col,p.color);
      const bdrL   = ci===0?'border-left:2px solid var(--border);':'border-left:1px solid var(--border2);';
      const isHl   = ST.highlight===col.key;
      const hlOut  = isHl?`outline:1px solid ${p.color}55;outline-offset:-1px;`:'';
      const cutoff = ST.cutoffs && isAboveCutoff(col.key, row[col.key]) ? ' above-cutoff' : '';
      parts.push(`<td class="td-cell${cutoff}" style="width:${CS}px;height:${CS}px;background:${bg};${bdrL}${hlOut}" title="${tip}"><span style="font-size:${fs}px;color:${tc};line-height:${CS}px">${label}</span></td>`);
    }));
    parts.push('</tr>');
  });
  parts.push('</tbody>');

  const tbl = document.getElementById('matrix-table');
  tbl.innerHTML = parts.join('');

  tbl.querySelectorAll('.th-col').forEach(th => {
    th.addEventListener('click',()=>{ const k=th.dataset.key; ST.highlight=ST.highlight===k?null:k; render(); });
  });
  tbl.querySelectorAll('.data-row').forEach(tr => {
    tr.addEventListener('click',()=>{ openReport(data[+tr.dataset.idx]); });
  });

  // scroll to first match
  if (q) {
    const first = tbl.querySelector('.search-match');
    if (first) first.scrollIntoView({block:'center',behavior:'smooth'});
  }
}

// ── SUBJECT REPORT ──────────────────────────────────
function diagLabel(v) {
  const n=toNum(v);
  if (n===null) return {text:'—',color:'var(--subtle)'};
  if (n===1)    return {text:'YES',color:'#4ade80'};
  if (n===0)    return {text:'NO', color:'#f87171'};
  return {text:String(v),color:'#94a3b8'};
}

function adosDiagLabel(v) {
  const map={1:'Autism',2:'ASD',3:'Non-Spectrum'};
  const n=toNum(v); return n!==null&&map[n]?map[n]:'—';
}

function scoreCard(label, val, col, color) {
  if (val===9999) return `<div class="report-card" style="--card-color:${color}"><div class="rc-label">${label}</div><div class="rc-value rc-na" style="font-size:13px;color:var(--subtle)">Age N/A</div></div>`;
  const n=toNum(val);
  if (n===null)   return `<div class="report-card" style="--card-color:${color}"><div class="rc-label">${label}</div><div class="rc-value rc-na">—</div></div>`;
  let bar='', cutoffHtml='';
  if (col&&col.type==='numeric') {
    const t = Math.max(0,Math.min(1,(n-col.lo)/(col.hi-col.lo)));
    const pct = col.rev?(1-t)*100:t*100;
    bar = `<div class="rc-bar-wrap"><div class="rc-bar-fill" style="width:${pct.toFixed(0)}%;background:${color}"></div></div>`;
  }
  const ck = col?col.key:'';
  const co = CUTOFFS[ck];
  if (co) {
    const triggered = co.below ? n < co.value : n >= co.value;
    if (triggered) cutoffHtml = `<div class="cutoff-flag">⚠ ${co.label}</div>`;
  }
  return `<div class="report-card" style="--card-color:${color}"><div class="rc-label">${label}</div><div class="rc-value">${n%1===0?n:n.toFixed(1)}</div>${bar}${cutoffHtml}</div>`;
}

function openReport(row) {
  const sc=srcColor(row.SOURCE);
  const sexCol=row.SEX==='M'?'#60a5fa':row.SEX==='F'?'#f472b6':'#94a3b8';
  const w=toNum(row.POIDS), h=toNum(row.TAILLE);
  let bmiHtml='';
  if (w&&h&&h>0) {
    const bmi=(w/((h/100)**2)).toFixed(1);
    const cat = bmi<18.5?'Underweight':bmi<25?'Normal':bmi<30?'Overweight':'Obese';
    const catCol = bmi<18.5?'#60a5fa':bmi<25?'#4ade80':bmi<30?'#fbbf24':'#f87171';
    bmiHtml=`<div class="anthr-card"><div class="anthr-lbl">BMI</div><div><span class="anthr-val">${bmi}</span><span class="anthr-unit">kg/m²</span></div><div class="bmi-note" style="color:${catCol}">${cat}</div></div>`;
  }
  document.getElementById('report-content').innerHTML = `
    <div class="report-eyebrow">Subject Report</div>
    <div class="report-id">${row.id}</div>
    <div class="report-meta-row">
      <span class="report-badge" style="background:${sc}22;border:1px solid ${sc}44;color:${sc}">${row.SOURCE}</span>
      <span class="report-badge" style="background:${sexCol}22;border:1px solid ${sexCol}44;color:${sexCol}">Sex: ${row.SEX}</span>
      ${row.AGE!==null?`<span class="report-badge" style="background:var(--border);color:var(--text)">Age: ${row.AGE} yr</span>`:''}
    </div>
    <div class="report-section-title">Diagnosis</div>
    <div class="diag-row">
      ${['DSM5_MET','DIAG_CONSENSUS'].map(k=>{const d=diagLabel(row[k]);return `<div class="diag-flag"><span class="diag-dot" style="background:${d.color}"></span><span class="diag-name">${k==='DSM5_MET'?'DSM-5 Criteria':'Clinical Consensus'}</span><span class="diag-val" style="color:${d.color}">${d.text}</span></div>`;}).join('')}
      <div class="diag-flag"><span class="diag-dot" style="background:#f59e0b"></span><span class="diag-name">ADOS-2 Diagnosis</span><span class="diag-val" style="color:#f59e0b">${adosDiagLabel(row.ADOS_DIAG)}</span></div>
    </div>
    <div class="report-divider"></div>
    <div class="report-section-title">ADOS-2</div>
    <div class="report-grid">${scoreCard('Affect Social',row.ADOS_AS,PANELS[1].cols[0],'#f59e0b')}${scoreCard('CRR',row.ADOS_CRR,PANELS[1].cols[1],'#f59e0b')}${scoreCard('Total',row.ADOS_Total,PANELS[1].cols[2],'#f59e0b')}${scoreCard('Module',row.ADOS_Mod,null,'#f59e0b')}</div>
    <div class="report-divider"></div>
    <div class="report-section-title">ADI-R</div>
    <div class="report-grid">${scoreCard('Social (A)',row.ADI_A,PANELS[2].cols[0],'#10b981')}${scoreCard('Comm Verbal (BV)',row.ADI_BV,PANELS[2].cols[1],'#10b981')}${scoreCard('Non-Verbal (BNV)',row.ADI_BNV,PANELS[2].cols[2],'#10b981')}${scoreCard('Repetitive (C)',row.ADI_C,PANELS[2].cols[3],'#10b981')}</div>
    <div class="report-divider"></div>
    <div class="report-section-title">Vineland (VABS-II)</div>
    <div class="report-grid">${scoreCard('Composite NC',row.VABS_CA_NC,PANELS[3].cols[0],'#8b5cf6')}${scoreCard('Communication',row.VABS_Com_NS,PANELS[3].cols[1],'#8b5cf6')}${scoreCard('Socialisation',row.VABS_Soc_NS,PANELS[3].cols[2],'#8b5cf6')}${scoreCard('Daily Living',row.VABS_VQ_NS,PANELS[3].cols[3],'#8b5cf6')}</div>
    <div class="report-divider"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;flex-wrap:wrap">
      <div><div class="report-section-title">SRS</div><div class="report-grid" style="grid-template-columns:1fr">${scoreCard('Total Score',row.SRS_Total,PANELS[4].cols[0],'#ec4899')}</div></div>
      <div><div class="report-section-title">ADHD-RS</div><div class="report-grid">${scoreCard('Inattention',row.ADHD_Inatt,PANELS[5].cols[0],'#f97316')}${scoreCard('Hyperact.',row.ADHD_Sub,PANELS[5].cols[1],'#f97316')}${scoreCard('Total',row.ADHD_Total,PANELS[5].cols[2],'#f97316')}</div></div>
    </div>
    <div class="report-divider"></div>
    <div class="report-section-title">Anthropometrics</div>
    <div class="anthr-row">
      <div class="anthr-card"><div class="anthr-lbl">WEIGHT</div>${w!==null?`<div><span class="anthr-val">${w}</span><span class="anthr-unit">kg</span></div>`:`<div><span class="anthr-val rc-na" style="color:var(--subtle)">—</span></div>`}</div>
      <div class="anthr-card"><div class="anthr-lbl">HEIGHT</div>${h!==null?`<div><span class="anthr-val">${h}</span><span class="anthr-unit">cm</span></div>`:`<div><span class="anthr-val rc-na" style="color:var(--subtle)">—</span></div>`}</div>
      ${bmiHtml}
    </div>`;
  document.getElementById('subject-overlay').removeAttribute('hidden');
}

// ── LOAD DATA ─────────────────────────────────────
function loadData(parsed, filename) {
  RAW = parsed.map(normaliseRow);

  document.getElementById('legend-panels').innerHTML =
    PANELS.map(p=>`<div class="legend-item"><span class="swatch" style="background:${p.color}cc"></span>${p.label}</div>`).join('');
  document.getElementById('legend-sources').innerHTML =
    Object.entries(SRC_COLORS).map(([s,c])=>`<div class="legend-item"><span class="swatch" style="background:${c}"></span>${s}</div>`).join('');

  const dbGroup = document.getElementById('db-filter-group');
  dbGroup.querySelectorAll('[data-db]').forEach(b=>b.remove());
  const sources = [...new Set(RAW.map(r=>r.SOURCE))].sort();
  ['ALL',...sources].forEach(src => {
    const btn=document.createElement('button');
    btn.className='ctrl-btn'+(src==='ALL'?' active':'');
    btn.dataset.db=src; btn.textContent=src==='ALL'?'All':src;
    btn.addEventListener('click',()=>{
      ST.src=src;
      dbGroup.querySelectorAll('[data-db]').forEach(b=>{ const it=b.dataset.db===src; b.classList.toggle('active',it); b.style.background=it&&src!=='ALL'?srcColor(src):''; b.style.color=it&&src!=='ALL'?'#fff':''; });
      render();
    });
    dbGroup.appendChild(btn);
  });

  const warn = RAW.length>500?`<span class="warn">⚠ ${RAW.length} rows — use df_unique for one row per subject</span>`:'';
  document.getElementById('file-info').innerHTML=`<span class="ok">✓ ${filename}</span>&nbsp;&nbsp;<span>${RAW.length} rows · ${sources.join(' · ')}</span>${warn}`;
  document.getElementById('upload-screen').style.display='none';
  document.getElementById('matrix-screen').removeAttribute('hidden');
  render();
}

// ── CSV EXPORT ────────────────────────────────────
function exportCSV() {
  const data = getDisplayData();
  const allKeys = ['id','SOURCE','SEX','AGE',...PANELS.flatMap(p=>p.cols.map(c=>c.key))];
  const header  = allKeys.join(',');
  const rows    = data.map(r => allKeys.map(k => {
    const v = r[k]; if (v===null||v===undefined) return '';
    const s = String(v); return s.includes(',')||s.includes('"')?`"${s.replace(/"/g,'""')}"`:s;
  }).join(','));
  const csv = [header,...rows].join('\n');
  const blob = new Blob([csv],{type:'text/csv'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download='clinical_filtered.csv'; a.click();
  URL.revokeObjectURL(url);
}

// ── FILE INPUT ────────────────────────────────────
function processFile(file) {
  if (!file) return;
  document.getElementById('load-error').textContent='';
  const reader=new FileReader();
  reader.onload=ev=>{
    try {
      const parsed=JSON.parse(ev.target.result);
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array (orient="records")');
      if (!parsed.length) throw new Error('JSON file is empty');
      loadData(parsed, file.name);
    } catch(e) { document.getElementById('load-error').textContent='⚠ '+e.message; }
  };
  reader.readAsText(file);
}

const dropZone  = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
dropZone.addEventListener('click',()=>fileInput.click());
dropZone.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')fileInput.click();});
fileInput.addEventListener('change',e=>{processFile(e.target.files[0]);fileInput.value='';});
dropZone.addEventListener('dragover',e=>{e.preventDefault();dropZone.classList.add('drag-over');});
dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop',e=>{e.preventDefault();dropZone.classList.remove('drag-over');processFile(e.dataTransfer.files[0]);});

// ── CONTROLS ──────────────────────────────────────
document.querySelectorAll('[data-sort]').forEach(btn=>{ btn.addEventListener('click',()=>{ ST.sort=btn.dataset.sort; document.querySelectorAll('[data-sort]').forEach(b=>b.classList.toggle('active',b.dataset.sort===ST.sort)); render(); }); });

document.querySelectorAll('[data-sex]').forEach(btn=>{ btn.addEventListener('click',()=>{ ST.sex=btn.dataset.sex; document.querySelectorAll('[data-sex]').forEach(b=>b.classList.toggle('sex-active',b.dataset.sex===ST.sex)); render(); }); });

document.querySelectorAll('[data-age]').forEach(btn=>{ btn.addEventListener('click',()=>{ ST.ageBand=btn.dataset.age; document.querySelectorAll('[data-age]').forEach(b=>b.classList.toggle('age-active',b.dataset.age===ST.ageBand)); render(); }); });

document.querySelectorAll('[data-diag]').forEach(btn=>{ btn.addEventListener('click',()=>{ ST.diag=btn.dataset.diag; document.querySelectorAll('[data-diag]').forEach(b=>b.classList.toggle('diag-active',b.dataset.diag===ST.diag)); render(); }); });

document.querySelectorAll('[data-zoom]').forEach(btn=>{ btn.addEventListener('click',()=>{ ST.zoom=+btn.dataset.zoom; document.querySelectorAll('[data-zoom]').forEach(b=>b.classList.toggle('active',+b.dataset.zoom===ST.zoom)); render(); }); });

document.getElementById('toggle-cutoffs-btn').addEventListener('click',function(){
  ST.cutoffs=!ST.cutoffs;
  this.textContent=ST.cutoffs?'Cutoffs ON':'Cutoffs OFF';
  this.classList.toggle('cutoffs-on',ST.cutoffs);
  document.getElementById('cutoff-legend-item').hidden=!ST.cutoffs;
  render();
});

document.getElementById('toggle-legend-btn').addEventListener('click',()=>{
  ST.legend=!ST.legend;
  document.getElementById('legend-bar').classList.toggle('hidden',!ST.legend);
});

document.getElementById('reload-btn').addEventListener('click',()=>{
  document.getElementById('upload-screen').style.display='';
  document.getElementById('matrix-screen').setAttribute('hidden','');
  Object.assign(ST,{sort:'SOURCE',src:'ALL',sex:'ALL',ageBand:'ALL',diag:'ALL',highlight:null,search:'',cutoffs:false});
});

document.getElementById('export-csv-btn').addEventListener('click', exportCSV);

// search
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
let searchTimer;
searchInput.addEventListener('input',()=>{ clearTimeout(searchTimer); searchTimer=setTimeout(()=>{ ST.search=searchInput.value; render(); },180); });
searchClear.addEventListener('click',()=>{ searchInput.value=''; ST.search=''; render(); });

// overlay close
document.getElementById('close-report').addEventListener('click',()=>document.getElementById('subject-overlay').setAttribute('hidden',''));
document.getElementById('subject-overlay').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.setAttribute('hidden','');});
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ document.getElementById('subject-overlay').setAttribute('hidden',''); document.getElementById('eda-overlay').setAttribute('hidden',''); } });

// EDA open/close
document.getElementById('open-eda-btn').addEventListener('click',()=>{
  document.getElementById('eda-overlay').removeAttribute('hidden');
  if (typeof renderEDA === 'function') renderEDA('demographics');
});
document.getElementById('close-eda').addEventListener('click',()=>document.getElementById('eda-overlay').setAttribute('hidden',''));
document.getElementById('eda-overlay').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.setAttribute('hidden','');});

document.querySelectorAll('.eda-tab').forEach(tab=>{
  tab.addEventListener('click',()=>{
    document.querySelectorAll('.eda-tab').forEach(t=>t.classList.toggle('active',t===tab));
    if (typeof renderEDA==='function') renderEDA(tab.dataset.tab);
  });
});

// resize
let resizeTimer;
window.addEventListener('resize',()=>{ clearTimeout(resizeTimer); resizeTimer=setTimeout(()=>{ if(!document.getElementById('matrix-screen').hidden&&RAW.length) render(); },120); });

// expose for eda.js
window.getRAW = () => RAW;
window.getDisplayData = getDisplayData;
window.PANELS = PANELS;
