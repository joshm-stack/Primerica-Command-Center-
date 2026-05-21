import { useState, useEffect, useRef } from 'react';

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SB_URL = 'https://fnewbbocusfifoqandxk.supabase.co';
const SB_KEY = 'sb_publishable_oSN5qULEGM8F17CzcNZXHQ_VB__5xLx';

async function dbGet(key) {
  try {
    const r = await fetch(`${SB_URL}/rest/v1/app_data?key=eq.${key}&select=value`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }
    });
    const data = await r.json();
    return data?.[0]?.value ?? null;
  } catch { return null; }
}

async function dbSet(key, value) {
  try {
    await fetch(`${SB_URL}/rest/v1/app_data`, {
      method: 'POST',
      headers: {
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({ key, value, updated_at: new Date().toISOString() })
    });
  } catch {}
}

// ─── ONE-TIME MIGRATION: localStorage → Supabase ─────────────────────────────
const MIGRATION_KEY = 'josh_migrated_v1';
async function migrateIfNeeded() {
  if (localStorage.getItem(MIGRATION_KEY)) return false;
  const map = {
    leads:    'joshleads2',
    recruits: 'joshrecruits2',
    goals:    'joshgoals2',
    todos:    'joshtodos2',
    team:     'joshteam',
    sales:    'joshsales',
  };
  let migrated = false;
  for (const [cloudKey, lsKey] of Object.entries(map)) {
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const isEmpty = Array.isArray(parsed) ? parsed.length === 0 : Object.keys(parsed).length === 0;
      if (isEmpty) continue;
      const existing = await dbGet(cloudKey);
      const cloudEmpty = existing === null || (Array.isArray(existing) && existing.length === 0);
      if (cloudEmpty) { await dbSet(cloudKey, parsed); migrated = true; }
    } catch {}
  }
  localStorage.setItem(MIGRATION_KEY, '1');
  return migrated;
}

// ─── GLOBAL STYLES ────────────────────────────────────────────────────────────
const INJECT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body { font-family: 'Outfit', system-ui, sans-serif; background: #06060d; color: #eeeeff; -webkit-font-smoothing: antialiased; }
  input, select, textarea, button { font-family: 'Outfit', system-ui, sans-serif; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #1c1c2e; border-radius: 99px; }
  @keyframes fadeUp  { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes slideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
  @keyframes toastIn { from { opacity:0; transform:translateY(16px) scale(0.96); } to { opacity:1; transform:translateY(0) scale(1); } }
  @keyframes blink   { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
  @keyframes spin    { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }
  .fade-up   { animation: fadeUp 0.3s ease both; }
  .slide-up  { animation: slideUp 0.32s cubic-bezier(0.32,0.72,0,1); }
  .card-lift { transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
  .card-lift:hover { transform: translateY(-2px); box-shadow: 0 12px 40px rgba(0,0,0,0.5) !important; border-color: #252545 !important; }
  .btn-glow  { transition: filter 0.15s ease, transform 0.15s ease; }
  .btn-glow:hover { filter: brightness(1.12); transform: translateY(-1px); }
  .live-dot  { animation: blink 2s ease infinite; }
  .nav-hover { transition: background 0.15s ease, color 0.15s ease; }
  .nav-hover:hover { background: rgba(91,141,246,0.1) !important; color: #c8d8ff !important; }
  .spinner   { animation: spin 0.8s linear infinite; }
`;

// ─── THEME ────────────────────────────────────────────────────────────────────
const C = {
  bg:'#06060d', bgAlt:'#09091a', card:'#0d0d1e', border:'#1a1a2e',
  blue:'#5b8df6', emerald:'#00cc7a', gold:'#f5a623', purple:'#a078f0',
  rose:'#ff4f72', sky:'#38bdf8', orange:'#fb923c', gray:'#4a4a6a',
  text:'#eeeeff', textSub:'#8888b8', textDim:'#3c3c58',
  gBlue:'linear-gradient(135deg,#5b8df6,#6366f1)',
  gEmerald:'linear-gradient(135deg,#00cc7a,#00a865)',
  gGold:'linear-gradient(135deg,#f5a623,#f97316)',
  gPurple:'linear-gradient(135deg,#a078f0,#7c3aed)',
  gRose:'linear-gradient(135deg,#ff4f72,#e11d48)',
  gSky:'linear-gradient(135deg,#38bdf8,#5b8df6)',
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const LEAD_STATUSES    = ['New','Contacted','FNA Scheduled','Presented','Follow Up','Closed Won','Closed Lost'];
const RECRUIT_STATUSES = ['Prospect','Invited','Interviewed','Licensing','Licensed','Active','Dropped'];
const SOURCES          = ['Social Media','Referral','Cold Outreach','Event','Walk-in','Other','Import'];
const POLICY_TYPES     = ['Term Life','SMART Loan','Investments','Mutual Funds','Other'];
const PRIMERICA_LEVELS = [
  { label:'Representative',        pct:25 },
  { label:'Senior Representative', pct:35 },
  { label:'District Leader',       pct:50 },
  { label:'Division Leader',       pct:65 },
  { label:'Regional Leader',       pct:70 },
  { label:'RVP',                   pct:95 },
];
const SC = {
  'New':'#38bdf8','Contacted':'#818cf8','FNA Scheduled':'#f5a623',
  'Presented':'#5b8df6','Follow Up':'#fb923c','Closed Won':'#00cc7a','Closed Lost':'#4a4a6a',
  'Prospect':'#38bdf8','Invited':'#818cf8','Interviewed':'#f5a623',
  'Licensing':'#fb923c','Licensed':'#5b8df6','Active':'#00cc7a','Dropped':'#4a4a6a',
};
const NAV = [
  { id:'dashboard',  label:'Home',       icon:'⚡' },
  { id:'contacts',   label:'Contacts',   icon:'👥' },
  { id:'pipeline',   label:'Pipeline',   icon:'🔁' },
  { id:'recruits',   label:'Recruits',   icon:'🤝' },
  { id:'team',       label:'Team',       icon:'📋' },
  { id:'commission', label:'Commission', icon:'💰' },
  { id:'goals',      label:'Goals',      icon:'🎯' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function useCloudState(key, def) {
  const [value, setValue]   = useState(def);
  const [synced, setSynced] = useState(false);
  const timerRef            = useRef(null);

  // Load from cloud on mount
  useEffect(() => {
    dbGet(key).then(v => {
      if (v !== null) setValue(v);
      setSynced(true);
    });
  }, [key]);

  // Save to cloud with debounce (500ms) after synced
  const set = (updater) => {
    setValue(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (synced) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => dbSet(key, next), 500);
      }
      return next;
    });
  };

  return [value, set, synced];
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const toast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 2800);
  };
  return [toasts, toast];
}

const daysSince   = d => d ? Math.floor((Date.now() - new Date(d)) / 86400000) : 999;
const fmt         = d => d ? new Date(d).toLocaleDateString('en-US',{ month:'short', day:'numeric' }) : '';
const fmtCur      = n => '$' + Number(n||0).toLocaleString(undefined,{ maximumFractionDigits:0 });
const startOfWeek = () => { const d=new Date(); d.setDate(d.getDate()-d.getDay()); d.setHours(0,0,0,0); return d; };
const startOfMon  = () => { const d=new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; };
const startOfYear = () => { const d=new Date(); d.setMonth(0,1); d.setHours(0,0,0,0); return d; };

function parseVCard(text) {
  return text.split('END:VCARD').reduce((acc, block) => {
    const name  = (block.match(/FN:(.+)/)?.[1]||'').trim();
    const phone = (block.match(/TEL[^:]*:(.+)/)?.[1]||'').trim().replace(/\s/g,'');
    const email = (block.match(/EMAIL[^:]*:(.+)/)?.[1]||'').trim();
    if (name) acc.push({ id:Date.now()+Math.random(), name, phone, email,
      status:'New', source:'Import', notes:'', followUp:'',
      activityLog:[], createdAt:new Date().toISOString() });
    return acc;
  }, []);
}

function initials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]?.toUpperCase()||'').join('');
}
function avatarColor(name) {
  const hues=[210,260,160,30,340,190,290,140];
  const idx=(name||'').charCodeAt(0)%hues.length;
  return { bg:`hsl(${hues[idx]},55%,14%)`, fg:`hsl(${hues[idx]},70%,65%)` };
}
function getWeeklyBars(sales, count=8) {
  const now=new Date(); now.setHours(0,0,0,0);
  return Array.from({ length:count },(_,i) => {
    const s=new Date(now); s.setDate(s.getDate()-s.getDay()-(count-1-i)*7);
    const e=new Date(s); e.setDate(e.getDate()+7);
    const ws=sales.filter(x=>{ const d=new Date(x.date); return d>=s&&d<e; });
    return { label:s.toLocaleDateString('en-US',{month:'short',day:'numeric'}),
      earned:ws.reduce((sum,x)=>sum+(x.commission||0),0), count:ws.length };
  });
}

// ─── STYLE HELPERS ────────────────────────────────────────────────────────────
const pill = (color,sm) => ({
  background:color+'20', color, borderRadius:99,
  padding:sm?'2px 8px':'3px 11px', fontSize:sm?10:11,
  fontWeight:700, display:'inline-block', letterSpacing:0.3, whiteSpace:'nowrap',
});
const btn = (grad,sm) => ({
  background:grad||C.gBlue, border:'none', borderRadius:9,
  color:'#fff', padding:sm?'7px 15px':'11px 22px',
  fontSize:sm?12:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap',
});
const inp = () => ({
  background:'#07071a', border:'1px solid '+C.border, borderRadius:9,
  color:C.text, padding:'10px 14px', fontSize:13,
  width:'100%', boxSizing:'border-box', outline:'none',
});
const cardS = (extra) => ({
  background:C.card, border:'1px solid '+C.border,
  borderRadius:16, padding:20, marginBottom:14, ...extra,
});
const row = jc => ({ display:'flex', alignItems:'center', justifyContent:jc||'space-between' });

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
function Avatar({ name, size=40 }) {
  const { bg, fg } = avatarColor(name);
  return (
    <div style={{ width:size, height:size, borderRadius:'50%', background:bg, color:fg,
      display:'flex', alignItems:'center', justifyContent:'center',
      fontSize:size*0.36, fontWeight:800, flexShrink:0 }}>
      {initials(name)}
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{ ...cardS(), borderTop:'2px solid '+color, marginBottom:0, padding:'18px 20px', flex:1, minWidth:110 }}>
      <div style={{ fontSize:32, fontWeight:900, color, lineHeight:1 }}>{value}</div>
      <div style={{ fontSize:11, color:C.textDim, marginTop:5, letterSpacing:0.5 }}>{label}</div>
    </div>
  );
}

function SyncBadge({ synced }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11,
      color:synced?C.emerald:C.gold, fontWeight:600 }}>
      {synced
        ? <><span className="live-dot" style={{ width:6, height:6, borderRadius:'50%', background:C.emerald, display:'inline-block' }}/> Synced</>
        : <><span className="spinner" style={{ display:'inline-block', width:10, height:10, border:'2px solid '+C.gold+'44', borderTop:'2px solid '+C.gold, borderRadius:'50%' }}/> Syncing...</>
      }
    </div>
  );
}

function RingProgress({ value, max, color, label }) {
  const r=30, circ=2*Math.PI*r;
  const pct=Math.min(1,value/Math.max(max,1));
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6 }}>
      <svg width={80} height={80} viewBox="0 0 80 80">
        <circle cx={40} cy={40} r={r} fill="none" stroke={C.border} strokeWidth={6}/>
        <circle cx={40} cy={40} r={r} fill="none" stroke={color} strokeWidth={6}
          strokeDasharray={circ} strokeDashoffset={circ*(1-pct)}
          strokeLinecap="round" transform="rotate(-90 40 40)"
          style={{ transition:'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)' }}/>
        <text x={40} y={40} textAnchor="middle" dominantBaseline="middle"
          fill={color} fontSize={15} fontWeight={800} fontFamily="Outfit,sans-serif">{value}</text>
      </svg>
      <div style={{ fontSize:11, color:C.text, fontWeight:600, textAlign:'center' }}>{label}</div>
      <div style={{ fontSize:10, color:C.textDim }}>of {max}</div>
    </div>
  );
}

function CommissionChart({ sales }) {
  const bars=getWeeklyBars(sales,8);
  const maxE=Math.max(...bars.map(b=>b.earned),1);
  return (
    <div style={cardS()}>
      <div style={{ fontSize:11, fontWeight:700, color:C.emerald, letterSpacing:2, marginBottom:16 }}>WEEKLY EARNINGS</div>
      <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:100 }}>
        {bars.map((b,i) => (
          <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
            {b.earned>0 && <div style={{ fontSize:9, color:C.textSub, fontWeight:700, textAlign:'center' }}>{fmtCur(b.earned)}</div>}
            <div style={{ width:'100%', borderRadius:'4px 4px 0 0',
              height:Math.max(4,(b.earned/maxE)*76),
              background:b.earned>0?C.gEmerald:C.border, transition:'height 0.5s ease' }}/>
            <div style={{ fontSize:8, color:C.textDim, textAlign:'center', lineHeight:1.3 }}>{b.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Toast({ toasts }) {
  return (
    <div style={{ position:'fixed', bottom:80, right:16, zIndex:9999,
      display:'flex', flexDirection:'column', gap:8, pointerEvents:'none' }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background:t.type==='success'?'#0a1f15':t.type==='error'?'#1f0a10':'#0a0f1f',
          border:`1px solid ${t.type==='success'?C.emerald:t.type==='error'?C.rose:C.blue}40`,
          borderRadius:12, padding:'10px 16px',
          color:t.type==='success'?C.emerald:t.type==='error'?C.rose:C.blue,
          fontSize:13, fontWeight:600, animation:'toastIn 0.25s ease',
          minWidth:200, boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
        }}>
          {t.type==='success'?'✓ ':t.type==='error'?'✗ ':'ℹ '}{t.message}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{ textAlign:'center', padding:'60px 20px' }}>
      <div style={{ fontSize:48, marginBottom:12, opacity:0.3 }}>{icon}</div>
      <div style={{ fontSize:15, fontWeight:700, color:C.textSub, marginBottom:6 }}>{title}</div>
      <div style={{ fontSize:12, color:C.textDim }}>{sub}</div>
    </div>
  );
}

// ─── CONTACT MODAL ────────────────────────────────────────────────────────────
function ContactModal({ contact, onClose, onSave, onDelete, isRecruit }) {
  const [c, setC]     = useState({ ...contact });
  const [note, setNote] = useState('');
  const [confirmDel, setCD] = useState(false);
  const upd = (k,v) => setC(prev=>({ ...prev, [k]:v }));

  useEffect(() => {
    const fn = e => { if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  const addNote = () => {
    if (!note.trim()) return;
    setC(prev=>({ ...prev, activityLog:[...(prev.activityLog||[]),{ text:note, date:new Date().toISOString() }] }));
    setNote('');
  };

  const statuses = isRecruit ? RECRUIT_STATUSES : LEAD_STATUSES;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:1000,
      display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="slide-up" style={{ background:C.card, border:'1px solid '+C.border,
        borderRadius:'22px 22px 0 0', width:'100%', maxWidth:600, maxHeight:'92vh', overflowY:'auto', padding:26 }}>

        <div style={{ ...row(), marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <Avatar name={c.name} size={48}/>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:C.text }}>{c.name||'New Contact'}</div>
              <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{c.source||'—'} · {c.createdAt?'Added '+fmt(c.createdAt):'New'}</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {c.phone && <a href={'tel:'+c.phone} style={{ ...btn(C.gEmerald,true), textDecoration:'none' }}>📞 Call</a>}
            {c.phone && <a href={'sms:'+c.phone}  style={{ ...btn(C.gSky,true),     textDecoration:'none' }}>💬 Text</a>}
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          {[['name','Name','text'],['phone','Phone','tel'],['email','Email','email'],['followUp','Follow-up','date']].map(([k,label,type]) => (
            <div key={k}>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>{label.toUpperCase()}</div>
              <input type={type} value={c[k]||''} onChange={e=>upd(k,e.target.value)} style={inp()} placeholder={label}/>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          <div>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>STATUS</div>
            <select value={c.status} onChange={e=>upd('status',e.target.value)} style={{ ...inp(), cursor:'pointer' }}>
              {statuses.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>SOURCE</div>
            <select value={c.source||'Other'} onChange={e=>upd('source',e.target.value)} style={{ ...inp(), cursor:'pointer' }}>
              {SOURCES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom:14 }}>
          <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>NOTES</div>
          <textarea value={c.notes||''} onChange={e=>upd('notes',e.target.value)}
            rows={3} style={{ ...inp(), resize:'vertical' }} placeholder='Any notes...'/>
        </div>

        <div style={{ marginBottom:20 }}>
          <div style={{ fontSize:11, fontWeight:700, color:C.blue, letterSpacing:2, marginBottom:10 }}>ACTIVITY LOG</div>
          <div style={{ display:'flex', gap:8, marginBottom:10 }}>
            <input value={note} onChange={e=>setNote(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&addNote()}
              placeholder='Log a call, note, or update...' style={{ ...inp(), flex:1 }}/>
            <button onClick={addNote} style={btn(C.gPurple,true)}>+ Log</button>
          </div>
          <div style={{ maxHeight:150, overflowY:'auto', display:'flex', flexDirection:'column', gap:7 }}>
            {(c.activityLog||[]).length===0
              ? <div style={{ fontSize:12, color:C.textDim, textAlign:'center', padding:'12px 0' }}>No activity yet</div>
              : (c.activityLog||[]).slice().reverse().map((a,i) => (
                <div key={i} style={{ background:C.bgAlt, borderRadius:9, padding:'9px 13px', border:'1px solid '+C.border }}>
                  <div style={{ fontSize:12, color:C.text, lineHeight:1.5 }}>{a.text}</div>
                  <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>{fmt(a.date)}</div>
                </div>
              ))
            }
          </div>
        </div>

        {confirmDel ? (
          <div style={{ background:'#1a0a0e', border:'1px solid '+C.rose+'44', borderRadius:12, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:13, color:C.text, marginBottom:12 }}>Delete {c.name}? This cannot be undone.</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>onDelete(c.id)} style={{ ...btn(C.gRose,true), flex:1 }}>Yes, Delete</button>
              <button onClick={()=>setCD(false)} style={{ flex:1, background:C.border, border:'none', borderRadius:9, color:C.text, padding:'7px 15px', fontSize:12, fontWeight:700, cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={()=>onSave(c)} style={{ ...btn(C.gEmerald), flex:1 }}>Save</button>
            <button onClick={onClose} style={{ flex:1, background:C.border, border:'none', borderRadius:9, color:C.text, padding:'11px 22px', fontSize:13, fontWeight:700, cursor:'pointer' }}>Cancel</button>
            {contact.id&&contact.id!=='new' && (
              <button onClick={()=>setCD(true)} style={{ background:C.rose+'22', border:'none', borderRadius:9, color:C.rose, padding:'11px 16px', fontSize:13, fontWeight:700, cursor:'pointer' }}>Delete</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SALE MODAL ───────────────────────────────────────────────────────────────
function SaleModal({ onClose, onSave, commPct }) {
  const [s, setS] = useState({ clientName:'', monthlyPremium:'', policyType:'Term Life', date:new Date().toISOString().split('T')[0] });
  const upd = (k,v) => setS(p=>({...p,[k]:v}));
  const ann  = Number(s.monthlyPremium||0)*12;
  const comm = ann*(commPct/100);

  useEffect(() => {
    const fn = e => { if(e.key==='Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.9)', zIndex:1000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="fade-up" style={{ background:C.card, border:'1px solid '+C.border,
        borderRadius:20, width:'100%', maxWidth:420, padding:28 }}>
        <div style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:22 }}>Log a Sale 🎉</div>
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>CLIENT NAME</div>
            <input value={s.clientName} onChange={e=>upd('clientName',e.target.value)} placeholder='Full name' style={inp()} autoFocus/>
          </div>
          <div>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>MONTHLY PREMIUM ($)</div>
            <input type='number' value={s.monthlyPremium} onChange={e=>upd('monthlyPremium',e.target.value)} placeholder='0.00' style={inp()}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>POLICY TYPE</div>
              <select value={s.policyType} onChange={e=>upd('policyType',e.target.value)} style={{ ...inp(), cursor:'pointer' }}>
                {POLICY_TYPES.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>DATE CLOSED</div>
              <input type='date' value={s.date} onChange={e=>upd('date',e.target.value)} style={inp()}/>
            </div>
          </div>
          <div style={{ background:'#07180f', border:'1px solid '+C.emerald+'33', borderRadius:14, padding:18, textAlign:'center' }}>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>YOUR COMMISSION · {commPct}%</div>
            <div style={{ fontSize:38, fontWeight:900, color:C.emerald, lineHeight:1 }}>{fmtCur(comm)}</div>
            <div style={{ fontSize:11, color:C.textSub, marginTop:6 }}>{fmtCur(ann)} annualized · {fmtCur(s.monthlyPremium)}/mo</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:10, marginTop:20 }}>
          <button onClick={()=>{
            if(!s.clientName.trim()||!s.monthlyPremium) return;
            onSave({ ...s, id:Date.now(), commission:Number(comm.toFixed(2)) });
          }} style={{ ...btn(C.gEmerald), flex:1 }}>Save Sale</button>
          <button onClick={onClose} style={{ flex:1, background:C.border, border:'none', borderRadius:9, color:C.text, padding:'11px 22px', fontSize:13, fontWeight:700, cursor:'pointer' }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGE: DASHBOARD ──────────────────────────────────────────────────────────
function Dashboard({ stats, todos, setTodos, coldLeads, followUps, setSelectedContact, sales, isMobile, toast }) {
  const [newTodo, setNewTodo] = useState('');
  const thisMon = sales.filter(s=>new Date(s.date)>=startOfMon());
  const earned  = thisMon.reduce((sum,s)=>sum+(s.commission||0),0);

  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos(p=>[...p,{ id:Date.now(), text:newTodo, done:false }]);
    setNewTodo('');
  };

  return (
    <div className="fade-up">
      <div style={{ marginBottom:28 }}>
        <div style={{ fontSize:11, color:C.blue, letterSpacing:3, textTransform:'uppercase', marginBottom:6 }}>
          {new Date().toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' })}
        </div>
        <div style={{ fontSize:isMobile?24:32, fontWeight:900, color:C.text, lineHeight:1 }}>Welcome back, Josh.</div>
        <div style={{ fontSize:13, color:C.textSub, marginTop:8 }}>
          {earned>0?fmtCur(earned)+' earned this month · ':''}{stats.won} client{stats.won!==1?'s':''} closed · {stats.fna} FNA{stats.fna!==1?'s':''} set
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12, marginBottom:22 }}>
        <StatCard label="TOTAL LEADS"   value={stats.leads}    color={C.blue}/>
        <StatCard label="FNAs SET"      value={stats.fna}      color={C.gold}/>
        <StatCard label="CLIENTS WON"   value={stats.won}      color={C.emerald}/>
        <StatCard label="LICENSED REPS" value={stats.licensed} color={C.purple}/>
      </div>

      {coldLeads.length>0 && (
        <div style={cardS({ borderLeft:'3px solid '+C.rose })}>
          <div style={{ ...row(), marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:C.rose, letterSpacing:2 }}>🔥 COLD LEADS · NEEDS CONTACT</div>
            <span style={pill(C.rose,true)}>{coldLeads.length}</span>
          </div>
          {coldLeads.slice(0,4).map(l=>(
            <div key={l.id} onClick={()=>setSelectedContact(l)} className="card-lift"
              style={{ ...row(), padding:'10px 0', borderBottom:'1px solid '+C.border, cursor:'pointer' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Avatar name={l.name} size={32}/>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{l.name}</div>
                  <div style={{ fontSize:11, color:C.textDim }}>{daysSince(l.updatedAt)}d since contact</div>
                </div>
              </div>
              <span style={pill(SC[l.status]||C.gray,true)}>{l.status}</span>
            </div>
          ))}
          {coldLeads.length>4&&<div style={{ fontSize:11, color:C.textDim, textAlign:'center', paddingTop:10 }}>+{coldLeads.length-4} more</div>}
        </div>
      )}

      {followUps.length>0 && (
        <div style={cardS({ borderLeft:'3px solid '+C.gold })}>
          <div style={{ fontSize:11, fontWeight:700, color:C.gold, letterSpacing:2, marginBottom:12 }}>📅 FOLLOW-UPS TODAY</div>
          {followUps.map(l=>(
            <div key={l.id} onClick={()=>setSelectedContact(l)} className="card-lift"
              style={{ ...row(), padding:'10px 0', borderBottom:'1px solid '+C.border, cursor:'pointer' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Avatar name={l.name} size={32}/>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{l.name}</div>
                  <div style={{ fontSize:11, color:C.textDim }}>{l.phone}</div>
                </div>
              </div>
              {l.phone&&<a href={'tel:'+l.phone} onClick={e=>e.stopPropagation()} style={{ ...btn(C.gEmerald,true), textDecoration:'none' }}>📞</a>}
            </div>
          ))}
        </div>
      )}

      <div style={cardS()}>
        <div style={{ fontSize:11, fontWeight:700, color:C.gold, letterSpacing:2, marginBottom:14 }}>TODAY'S TASKS</div>
        <div style={{ display:'flex', gap:8, marginBottom:12 }}>
          <input value={newTodo} onChange={e=>setNewTodo(e.target.value)}
            onKeyDown={e=>e.key==='Enter'&&addTodo()}
            placeholder='Add a task for today...' style={{ ...inp(), flex:1 }}/>
          <button onClick={addTodo} style={btn(C.gGold,true)}>Add</button>
        </div>
        {todos.length===0
          ? <EmptyState icon="✅" title="All clear" sub="Add your daily goals above"/>
          : todos.map(t=>(
            <div key={t.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom:'1px solid '+C.border }}>
              <input type='checkbox' checked={t.done} onChange={()=>setTodos(p=>p.map(x=>x.id===t.id?{...x,done:!x.done}:x))}
                style={{ width:16, height:16, cursor:'pointer', accentColor:C.emerald, flexShrink:0 }}/>
              <span style={{ flex:1, fontSize:13, color:t.done?C.textDim:C.text, textDecoration:t.done?'line-through':'none' }}>{t.text}</span>
              <button onClick={()=>setTodos(p=>p.filter(x=>x.id!==t.id))}
                style={{ background:'none', border:'none', color:C.textDim, cursor:'pointer', fontSize:18, lineHeight:1, padding:'0 4px' }}>×</button>
            </div>
          ))
        }
        {todos.length>0&&(
          <div style={{ ...row(), paddingTop:10 }}>
            <div style={{ fontSize:11, color:C.textDim }}>{todos.filter(t=>t.done).length}/{todos.length} done</div>
            <button onClick={()=>setTodos([])} style={{ background:'none', border:'none', color:C.textDim, fontSize:11, cursor:'pointer' }}>Clear all</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PAGE: CONTACTS ───────────────────────────────────────────────────────────
function Contacts({ leads, setLeads, search, setSearch, statusFilter, setStatusFilter, filteredLeads, setSelectedContact, isMobile, toast }) {
  function importVCard(e) {
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>{ const contacts=parseVCard(ev.target.result); setLeads(p=>[...contacts,...p]); toast(contacts.length+' contacts imported!'); };
    reader.readAsText(file); e.target.value='';
  }
  return (
    <div className="fade-up">
      <div style={{ ...row(), marginBottom:18, flexWrap:'wrap', gap:10 }}>
        <div style={{ fontSize:isMobile?18:24, fontWeight:900, color:C.text }}>Contacts</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <label className="btn-glow" style={{ ...btn(C.gPurple,true), cursor:'pointer' }}>
            Import .vcf<input type='file' accept='.vcf' onChange={importVCard} style={{ display:'none' }}/>
          </label>
          <button className="btn-glow" onClick={()=>setSelectedContact({ id:'new', name:'', phone:'', email:'', status:'New', source:'Other', notes:'', followUp:'', activityLog:[], createdAt:new Date().toISOString() })} style={btn(C.gBlue,true)}>
            + New Contact
          </button>
        </div>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder='Search name, phone, email...' style={{ ...inp(), flex:1, minWidth:180 }}/>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{ ...inp(), width:'auto', cursor:'pointer', minWidth:140 }}>
          <option>All</option>{LEAD_STATUSES.map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ fontSize:11, color:C.textDim, marginBottom:12 }}>{filteredLeads.length} {filteredLeads.length===1?'contact':'contacts'}</div>
      {filteredLeads.length===0
        ? <EmptyState icon="👥" title="No contacts yet" sub="Add one manually or import from your phone"/>
        : filteredLeads.map(l=>(
          <div key={l.id} onClick={()=>setSelectedContact(l)} className="card-lift"
            style={cardS({ borderLeft:'3px solid '+(SC[l.status]||C.gray), cursor:'pointer', padding:'14px 18px' })}>
            <div style={row()}>
              <div style={{ display:'flex', alignItems:'center', gap:12, flex:1, minWidth:0 }}>
                <Avatar name={l.name} size={42}/>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ ...row('flex-start'), gap:8, marginBottom:4, flexWrap:'wrap' }}>
                    <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{l.name}</div>
                    <span style={pill(SC[l.status]||C.gray,true)}>{l.status}</span>
                  </div>
                  <div style={{ fontSize:12, color:C.textDim, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {[l.phone,l.email].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ display:'flex', gap:10, marginTop:4, flexWrap:'wrap' }}>
                    {l.followUp&&<div style={{ fontSize:11, color:C.gold }}>📅 {fmt(l.followUp)}</div>}
                    {daysSince(l.updatedAt)>=3&&!['Closed Won','Closed Lost'].includes(l.status)&&(
                      <div style={{ fontSize:11, color:C.rose }}>{daysSince(l.updatedAt)}d cold</div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:7, marginLeft:10, flexShrink:0 }}>
                {l.phone&&<a href={'tel:'+l.phone} onClick={e=>e.stopPropagation()} style={{ ...btn(C.gEmerald,true), textDecoration:'none', padding:'8px 11px', fontSize:16 }}>📞</a>}
                {l.phone&&<a href={'sms:'+l.phone}  onClick={e=>e.stopPropagation()} style={{ ...btn(C.gSky,true),     textDecoration:'none', padding:'8px 11px', fontSize:16 }}>💬</a>}
              </div>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── PAGE: PIPELINE ───────────────────────────────────────────────────────────
function Pipeline({ leads, setSelectedContact, isMobile }) {
  const stages=LEAD_STATUSES.slice(0,-1);
  const active=leads.filter(l=>!['Closed Won','Closed Lost'].includes(l.status)).length;
  return (
    <div className="fade-up">
      <div style={{ ...row(), marginBottom:6 }}>
        <div style={{ fontSize:isMobile?18:24, fontWeight:900, color:C.text }}>Pipeline</div>
        <div style={{ fontSize:12, color:C.textDim }}>{active} active lead{active!==1?'s':''}</div>
      </div>
      <div style={{ fontSize:12, color:C.textDim, marginBottom:18 }}>Tap any card to edit or move a lead</div>
      <div style={{ display:'flex', gap:12, overflowX:'auto', paddingBottom:16 }}>
        {stages.map(stage=>{
          const sl=leads.filter(l=>l.status===stage);
          const color=SC[stage]||C.gray;
          return (
            <div key={stage} style={{ minWidth:200, flex:'0 0 200px', background:C.card, border:'1px solid '+C.border, borderRadius:14, padding:14, borderTop:'3px solid '+color }}>
              <div style={{ ...row(), marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:800, color, letterSpacing:1.5 }}>{stage.toUpperCase()}</div>
                <span style={pill(color,true)}>{sl.length}</span>
              </div>
              {sl.map(l=>(
                <div key={l.id} onClick={()=>setSelectedContact(l)} className="card-lift"
                  style={{ background:C.bgAlt, border:'1px solid '+C.border, borderRadius:10, padding:'10px 12px', marginBottom:8, cursor:'pointer' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
                    <Avatar name={l.name} size={26}/>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.name}</div>
                  </div>
                  <div style={{ fontSize:11, color:C.textDim }}>{l.phone}</div>
                  {l.followUp&&<div style={{ fontSize:10, color:C.gold, marginTop:4 }}>📅 {fmt(l.followUp)}</div>}
                  {daysSince(l.updatedAt)>=3&&<div style={{ fontSize:10, color:C.rose, marginTop:2 }}>{daysSince(l.updatedAt)}d cold</div>}
                </div>
              ))}
              {sl.length===0&&<div style={{ fontSize:11, color:C.textDim, textAlign:'center', padding:'20px 0' }}>Empty</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── PAGE: RECRUITS ───────────────────────────────────────────────────────────
function Recruits({ recruits, setSelectedContact, isMobile, search }) {
  const filtered=recruits.filter(r=>{ const q=search.toLowerCase(); return !q||r.name?.toLowerCase().includes(q)||r.phone?.includes(q); });
  return (
    <div className="fade-up">
      <div style={{ ...row(), marginBottom:18 }}>
        <div style={{ fontSize:isMobile?18:24, fontWeight:900, color:C.text }}>Recruits</div>
        <button className="btn-glow" onClick={()=>setSelectedContact({ id:'new', name:'', phone:'', email:'', status:'Prospect', source:'Other', notes:'', followUp:'', activityLog:[], createdAt:new Date().toISOString(), isRecruit:true })} style={btn(C.gPurple,true)}>
          + Add Recruit
        </button>
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18 }}>
        {RECRUIT_STATUSES.map(s=>{ const cnt=recruits.filter(r=>r.status===s).length; if(!cnt) return null;
          return (<div key={s} style={{ background:(SC[s]||C.gray)+'15', border:'1px solid '+(SC[s]||C.gray)+'30', borderRadius:10, padding:'8px 14px', textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:900, color:SC[s]||C.gray }}>{cnt}</div>
            <div style={{ fontSize:10, color:C.textDim, marginTop:1 }}>{s}</div>
          </div>);
        })}
      </div>
      {filtered.length===0
        ? <EmptyState icon="🤝" title="No recruits yet" sub="Start building your downline"/>
        : filtered.map(r=>(
          <div key={r.id} onClick={()=>setSelectedContact({...r,isRecruit:true})} className="card-lift"
            style={cardS({ borderLeft:'3px solid '+(SC[r.status]||C.gray), cursor:'pointer', padding:'14px 18px' })}>
            <div style={row()}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <Avatar name={r.name} size={42}/>
                <div>
                  <div style={{ ...row('flex-start'), gap:8, marginBottom:4 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{r.name}</div>
                    <span style={pill(SC[r.status]||C.gray,true)}>{r.status}</span>
                  </div>
                  <div style={{ fontSize:12, color:C.textDim }}>{r.phone}</div>
                  {r.followUp&&<div style={{ fontSize:11, color:C.gold, marginTop:3 }}>📅 {fmt(r.followUp)}</div>}
                </div>
              </div>
              {r.phone&&<a href={'tel:'+r.phone} onClick={e=>e.stopPropagation()} style={{ ...btn(C.gEmerald,true), textDecoration:'none', padding:'8px 11px', fontSize:16 }}>📞</a>}
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── PAGE: TEAM ───────────────────────────────────────────────────────────────
function Team({ team, setTeam, isMobile, toast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ name:'', status:'Active', fna:'', recruits:'' });

  const save = () => {
    if (!form.name.trim()) return;
    setTeam(p=>[...p,{ ...form, id:Date.now() }]);
    setForm({ name:'', status:'Active', fna:'', recruits:'' });
    setShowAdd(false);
    toast('Rep added to your team');
  };

  return (
    <div className="fade-up">
      <div style={{ ...row(), marginBottom:18 }}>
        <div style={{ fontSize:isMobile?18:24, fontWeight:900, color:C.text }}>My Team</div>
        <button className="btn-glow" onClick={()=>setShowAdd(true)} style={btn(C.gPurple,true)}>+ Add Rep</button>
      </div>
      {showAdd&&(
        <div style={cardS({ marginBottom:18 })}>
          <div style={{ fontSize:13, fontWeight:700, color:C.purple, marginBottom:14 }}>New Team Member</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>REP NAME</div>
              <input autoFocus value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&save()} placeholder='Full name' style={inp()}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>STATUS</div>
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{ ...inp(), cursor:'pointer' }}>
                {['Active','In Training','Licensed','Inactive'].map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>FNAs THIS MONTH</div>
              <input type='number' value={form.fna} onChange={e=>setForm(f=>({...f,fna:e.target.value}))} placeholder='0' style={inp()}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>RECRUITS THIS MONTH</div>
              <input type='number' value={form.recruits} onChange={e=>setForm(f=>({...f,recruits:e.target.value}))} placeholder='0' style={inp()}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={save} style={btn(C.gEmerald,true)}>Save Rep</button>
            <button onClick={()=>setShowAdd(false)} style={{ background:C.border, border:'none', borderRadius:9, color:C.text, padding:'7px 15px', fontSize:12, fontWeight:700, cursor:'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
      {team.length===0
        ? <EmptyState icon="📋" title="No team members yet" sub="Add your licensed reps to track their activity"/>
        : <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:14 }}>
            {team.map(rep=>{
              const active=rep.status==='Active'||rep.status==='Licensed';
              return (
                <div key={rep.id} style={cardS({ borderTop:'2px solid '+(active?C.emerald:C.gray), marginBottom:0 })}>
                  <div style={{ ...row(), marginBottom:14 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <Avatar name={rep.name} size={38}/>
                      <div>
                        <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{rep.name}</div>
                        <span style={pill(active?C.emerald:C.gray,true)}>{rep.status}</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
                    <div style={{ background:C.bgAlt, borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
                      <div style={{ fontSize:26, fontWeight:900, color:C.gold }}>{rep.fna||0}</div>
                      <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>FNAs</div>
                    </div>
                    <div style={{ background:C.bgAlt, borderRadius:10, padding:'10px 14px', textAlign:'center' }}>
                      <div style={{ fontSize:26, fontWeight:900, color:C.purple }}>{rep.recruits||0}</div>
                      <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>Recruits</div>
                    </div>
                  </div>
                  <button onClick={()=>{ setTeam(p=>p.filter(r=>r.id!==rep.id)); toast('Rep removed','error'); }}
                    style={{ background:'none', border:'none', color:C.textDim, fontSize:11, cursor:'pointer', padding:0 }}>Remove</button>
                </div>
              );
            })}
          </div>
      }
    </div>
  );
}

// ─── PAGE: COMMISSION ─────────────────────────────────────────────────────────
function Commission({ sales, setSales, isMobile, toast }) {
  const [showModal, setShowModal] = useState(false);
  const [levelIdx, setLevelIdx]   = useState(() => { try { return JSON.parse(localStorage.getItem('joshlevel'))||0; } catch { return 0; } });
  const [view, setView]           = useState('month');

  useEffect(() => { localStorage.setItem('joshlevel', JSON.stringify(levelIdx)); }, [levelIdx]);

  const commPct  = PRIMERICA_LEVELS[levelIdx]?.pct||25;
  const cutoff   = view==='week'?startOfWeek():view==='month'?startOfMon():startOfYear();
  const filtered = sales.filter(s=>new Date(s.date)>=cutoff);
  const totalEarned = filtered.reduce((sum,s)=>sum+(s.commission||0),0);
  const totalVol    = filtered.reduce((sum,s)=>sum+(Number(s.monthlyPremium)*12||0),0);
  const allTime     = sales.reduce((sum,s)=>sum+(s.commission||0),0);
  const vLabel = { week:'This Week', month:'This Month', year:'This Year' };

  return (
    <div className="fade-up">
      <div style={{ ...row(), marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div style={{ fontSize:isMobile?18:24, fontWeight:900, color:C.text }}>Commission</div>
        <button className="btn-glow" onClick={()=>setShowModal(true)} style={btn(C.gEmerald,true)}>+ Log Sale</button>
      </div>
      {allTime>0&&(
        <div style={cardS({ background:'linear-gradient(135deg,#07180f,#0a1a0d)', borderColor:C.emerald+'30', textAlign:'center', padding:26 })}>
          <div style={{ fontSize:11, color:C.textDim, letterSpacing:2, marginBottom:6 }}>ALL-TIME EARNINGS</div>
          <div style={{ fontSize:46, fontWeight:900, color:C.emerald, lineHeight:1 }}>{fmtCur(allTime)}</div>
          <div style={{ fontSize:12, color:C.textSub, marginTop:6 }}>{sales.length} sale{sales.length!==1?'s':''} logged</div>
        </div>
      )}
      <div style={cardS()}>
        <div style={{ fontSize:11, fontWeight:700, color:C.gold, letterSpacing:2, marginBottom:14 }}>MY PRIMERICA LEVEL</div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          {PRIMERICA_LEVELS.map((l,i)=>(
            <button key={l.label} onClick={()=>setLevelIdx(i)} className="btn-glow" style={{
              padding:'6px 14px', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer',
              background:levelIdx===i?C.gGold:'none', border:levelIdx===i?'none':'1px solid '+C.border,
              color:levelIdx===i?'#000':C.textDim,
            }}>{l.label} · {l.pct}%</button>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {['week','month','year'].map(v=>(
          <button key={v} onClick={()=>setView(v)} style={{
            padding:'7px 18px', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer',
            background:view===v?C.gBlue:'none', border:view===v?'none':'1px solid '+C.border,
            color:view===v?'#fff':C.textDim,
          }}>{vLabel[v]}</button>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:12, marginBottom:20 }}>
        <StatCard label="EARNED"  value={fmtCur(totalEarned)} color={C.emerald}/>
        <StatCard label="SALES"   value={filtered.length}     color={C.blue}/>
        <StatCard label="VOLUME"  value={fmtCur(totalVol)}    color={C.gold}/>
        <StatCard label="MY RATE" value={commPct+'%'}          color={C.purple}/>
      </div>
      {sales.length>0&&<CommissionChart sales={sales}/>}
      <div style={cardS()}>
        <div style={{ fontSize:11, fontWeight:700, color:C.emerald, letterSpacing:2, marginBottom:16 }}>SALES LOG · {vLabel[view].toUpperCase()}</div>
        {filtered.length===0
          ? <EmptyState icon="📈" title={'No sales '+vLabel[view].toLowerCase()} sub="Tap + Log Sale right after Primerica confirms your deal"/>
          : filtered.slice().reverse().map(s=>(
            <div key={s.id} style={{ ...row(), padding:'13px 0', borderBottom:'1px solid '+C.border }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, flex:1 }}>
                <Avatar name={s.clientName} size={40}/>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:C.text }}>{s.clientName}</div>
                  <div style={{ fontSize:12, color:C.textDim }}>{s.policyType} · {fmt(s.date)}</div>
                  <div style={{ fontSize:11, color:C.textDim }}>{fmtCur(s.monthlyPremium)}/mo · {fmtCur(Number(s.monthlyPremium)*12)} annualized</div>
                </div>
              </div>
              <div style={{ textAlign:'right', flexShrink:0 }}>
                <div style={{ fontSize:22, fontWeight:900, color:C.emerald }}>{fmtCur(s.commission)}</div>
                <button onClick={()=>{ setSales(p=>p.filter(x=>x.id!==s.id)); toast('Sale removed','error'); }}
                  style={{ background:'none', border:'none', color:C.textDim, cursor:'pointer', fontSize:11, marginTop:4 }}>Remove</button>
              </div>
            </div>
          ))
        }
      </div>
      {showModal&&<SaleModal commPct={commPct} onClose={()=>setShowModal(false)}
        onSave={sale=>{ setSales(p=>[...p,sale]); setShowModal(false); toast('Sale logged — great work! 🔥'); }}/>}
    </div>
  );
}

// ─── PAGE: GOALS ──────────────────────────────────────────────────────────────
function Goals({ stats, goals, setGoals, sales, leads, recruits, isMobile }) {
  const thisMon   = sales.filter(s=>new Date(s.date)>=startOfMon());
  const earned    = thisMon.reduce((sum,s)=>sum+(s.commission||0),0);
  const closeRate = stats.fna>0?((stats.won/stats.fna)*100).toFixed(0):null;

  const suggestions = [
    { color:C.gold, icon:'📅', label:'FNA Appointments',
      tip: stats.fna===0?'No FNAs set yet. Start with a goal of 5 this month to build rhythm.'
        : stats.fna<5?`${stats.fna} FNA${stats.fna>1?'s':''} set. Top reps do 10+ per month — push to ${Math.ceil(stats.fna*2)}.`
        : `Good momentum at ${stats.fna} FNAs. A 30% stretch = ${Math.ceil(stats.fna*1.3)}.` },
    { color:C.emerald, icon:'💰', label:'Close Rate',
      tip: !closeRate?'Set FNAs and close sales to see your close rate here.'
        : Number(closeRate)>=40?`Excellent — ${closeRate}% close rate. Primerica elite averages 40–60%. Keep it up.`
        : `${closeRate}% close rate. Focus on your FNA presentation to move this number up.` },
    { color:C.purple, icon:'🤝', label:'Recruit Pipeline',
      tip: recruits.length===0?'No recruits yet. One licensed rep can double your income ceiling.'
        : stats.licensed===0?`${recruits.length} in pipeline. Push one through licensing this month.`
        : `${stats.licensed} licensed rep${stats.licensed>1?'s':''}. Add ${Math.max(1,Math.ceil(stats.licensed*0.5))} more for override income growth.` },
    { color:C.blue, icon:'💵', label:'Monthly Earnings',
      tip: earned===0?'No sales logged. Log your first sale and watch this track automatically.'
        : earned<2000?`${fmtCur(earned)} this month. Target $150+ monthly premium clients to accelerate.`
        : `${fmtCur(earned)} this month = ${fmtCur(earned*12)}/year run rate. Push +20% next month.` },
  ];

  const progress = [
    { label:'FNAs',     cur:stats.fna,      goal:Number(goals.fna)||10,     color:C.gold },
    { label:'Clients',  cur:stats.won,       goal:Math.max(1,Math.ceil((Number(goals.fna)||10)*0.4)), color:C.emerald },
    { label:'Recruits', cur:recruits.length, goal:Number(goals.recruits)||4, color:C.purple },
  ];

  return (
    <div className="fade-up">
      <div style={{ fontSize:isMobile?18:24, fontWeight:900, color:C.text, marginBottom:22 }}>Goals</div>
      <div style={cardS({ borderTop:'2px solid '+C.gold })}>
        <div style={{ fontSize:11, fontWeight:700, color:C.gold, letterSpacing:2, marginBottom:16 }}>💡 SMART SUGGESTIONS</div>
        {suggestions.map(({ color, icon, label, tip })=>(
          <div key={label} style={{ display:'flex', gap:14, padding:'12px 0', borderBottom:'1px solid '+C.border }}>
            <div style={{ width:36, height:36, borderRadius:10, background:color+'15', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{icon}</div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:3 }}>{label}</div>
              <div style={{ fontSize:12, color:C.textSub, lineHeight:1.6 }}>{tip}</div>
            </div>
          </div>
        ))}
      </div>
      <div style={cardS()}>
        <div style={{ fontSize:11, fontWeight:700, color:C.blue, letterSpacing:2, marginBottom:18 }}>THIS MONTH'S PROGRESS</div>
        <div style={{ display:'flex', justifyContent:'space-around', flexWrap:'wrap', gap:20, marginBottom:18 }}>
          {progress.map(p=><RingProgress key={p.label} value={p.cur} max={p.goal} color={p.color} label={p.label}/>)}
        </div>
        <div style={{ ...row(), padding:'12px 0', borderTop:'1px solid '+C.border }}>
          <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>Earnings This Month</div>
          <div style={{ fontSize:20, fontWeight:900, color:C.emerald }}>{fmtCur(earned)}</div>
        </div>
        {Number(goals.premium)>0&&(
          <div style={{ marginTop:12 }}>
            <div style={{ ...row(), marginBottom:6 }}>
              <div style={{ fontSize:12, color:C.textSub }}>Earnings Goal</div>
              <div style={{ fontSize:12, color:C.text }}>{fmtCur(earned)} / {fmtCur(goals.premium)}</div>
            </div>
            <div style={{ background:C.border, borderRadius:99, height:6 }}>
              <div style={{ background:C.gEmerald, borderRadius:99, height:6, width:Math.min(100,(earned/Math.max(Number(goals.premium),1))*100)+'%', transition:'width 0.6s ease' }}/>
            </div>
          </div>
        )}
      </div>
      <div style={cardS()}>
        <div style={{ fontSize:11, fontWeight:700, color:C.emerald, letterSpacing:2, marginBottom:16 }}>MONTHLY TARGETS</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {[['fna','FNA Goal'],['recruits','Recruit Goal'],['premium','Earnings Goal ($)']].map(([k,label])=>(
            <div key={k} style={{ gridColumn:k==='premium'?'1/-1':undefined }}>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>{label.toUpperCase()}</div>
              <input type='number' value={goals[k]} onChange={e=>setGoals(p=>({...p,[k]:e.target.value}))} style={inp()}/>
            </div>
          ))}
        </div>
      </div>
      <div style={cardS({ borderLeft:'3px solid '+C.purple })}>
        <div style={{ fontSize:11, fontWeight:700, color:C.purple, letterSpacing:2, marginBottom:10 }}>MY WHY</div>
        <textarea value={goals.why} onChange={e=>setGoals(p=>({...p,why:e.target.value}))}
          rows={4} placeholder='What drives you? Your family, your freedom, your legacy...'
          style={{ ...inp(), resize:'vertical', lineHeight:1.7 }}/>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]           = useState(() => localStorage.getItem('joshtab')||'dashboard');
  const [moreOpen, setMoreOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  const [leads,    setLeads,    leadsSynced]    = useCloudState('leads',    []);
  const [recruits, setRecruits, recruitsSynced] = useCloudState('recruits', []);
  const [goals,    setGoals,    goalsSynced]    = useCloudState('goals',    { fna:10, recruits:4, premium:5000, why:'' });
  const [todos,    setTodos,    todosSynced]    = useCloudState('todos',    []);
  const [team,     setTeam,     teamSynced]     = useCloudState('team',     []);
  const [sales,    setSales,    salesSynced]    = useCloudState('sales',    []);

  const allSynced = leadsSynced && recruitsSynced && goalsSynced && todosSynced && teamSynced && salesSynced;
  const [toasts, toast] = useToast();

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedContact, setSelectedContact] = useState(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = INJECT_STYLES;
    document.head.appendChild(style);
    // Run one-time migration from localStorage to Supabase
    migrateIfNeeded().then(migrated => {
      if (migrated) window.location.reload();
    });
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => { localStorage.setItem('joshtab', tab); setMoreOpen(false); }, [tab]);

  const today      = new Date().toISOString().split('T')[0];
  const followUps  = [...leads,...recruits].filter(l=>l.followUp===today);
  const coldLeads  = leads.filter(l=>daysSince(l.updatedAt)>=3&&!['Closed Won','Closed Lost'].includes(l.status));
  const alertCount = coldLeads.length+followUps.length;

  const stats = {
    leads:    leads.length,
    fna:      leads.filter(l=>l.status==='FNA Scheduled').length,
    won:      leads.filter(l=>l.status==='Closed Won').length,
    licensed: recruits.filter(r=>['Licensed','Active'].includes(r.status)).length,
  };

  const filteredLeads = leads.filter(l=>{
    const q=search.toLowerCase();
    const ok=!q||l.name?.toLowerCase().includes(q)||l.phone?.includes(q)||l.email?.toLowerCase().includes(q);
    return ok&&(statusFilter==='All'||l.status===statusFilter);
  });

  function saveContact(c) {
    const u={ ...c, updatedAt:new Date().toISOString() };
    if(!c.id||c.id==='new'){ u.id=Date.now(); u.createdAt=new Date().toISOString(); setLeads(p=>[u,...p]); }
    else setLeads(p=>p.map(l=>l.id===c.id?u:l));
    setSelectedContact(null); toast('Contact saved');
  }
  function saveRecruit(c) {
    const u={ ...c, updatedAt:new Date().toISOString() };
    if(!c.id||c.id==='new'){ u.id=Date.now(); u.createdAt=new Date().toISOString(); setRecruits(p=>[u,...p]); }
    else setRecruits(p=>p.map(r=>r.id===c.id?u:r));
    setSelectedContact(null); toast('Recruit saved');
  }
  function deleteContact(id)  { setLeads(p=>p.filter(l=>l.id!==id));    setSelectedContact(null); toast('Contact deleted','error'); }
  function deleteRecruit(id)  { setRecruits(p=>p.filter(r=>r.id!==id)); setSelectedContact(null); toast('Recruit deleted','error'); }

  const SW = 240;

  function NavBtn({ id, label, icon, extra }) {
    const active = tab===id;
    return (
      <button onClick={()=>setTab(id)} className="nav-hover" style={{
        background:!isMobile&&active?C.blue+'18':'transparent',
        border:'none', cursor:'pointer',
        padding:isMobile?'7px 9px':'12px 22px',
        display:'flex', flexDirection:isMobile?'column':'row',
        alignItems:'center', gap:isMobile?3:12,
        color:active?C.blue:C.textSub, fontWeight:active?700:400,
        borderLeft:!isMobile?(active?'3px solid '+C.blue:'3px solid transparent'):'none',
        width:isMobile?'auto':'100%', fontSize:isMobile?10:13,
        borderRadius:isMobile?10:0, letterSpacing:0.2, position:'relative',
      }}>
        <span style={{ fontSize:isMobile?20:16 }}>{icon}</span>
        <span>{label}</span>
        {extra>0&&<span style={{ position:'absolute', top:isMobile?4:8, right:isMobile?4:14,
          background:C.rose, borderRadius:99, width:16, height:16, fontSize:9, fontWeight:800,
          color:'#fff', display:'flex', alignItems:'center', justifyContent:'center' }}>
          {extra>9?'9+':extra}
        </span>}
      </button>
    );
  }

  const shared = { isMobile, toast };
  const moreIds = ['team','recruits','goals'];

  return (
    <div style={{ background:C.bg, minHeight:'100vh', color:C.text }}>

      {!isMobile&&(
        <div style={{ width:SW, minHeight:'100vh', background:C.card, borderRight:'1px solid '+C.border,
          position:'fixed', left:0, top:0, bottom:0, display:'flex', flexDirection:'column', zIndex:100 }}>
          <div style={{ padding:'26px 22px 24px', borderBottom:'1px solid '+C.border }}>
            <div style={{ fontSize:9, letterSpacing:4, color:C.blue, textTransform:'uppercase', marginBottom:5 }}>Josh Torres</div>
            <div style={{ fontSize:18, fontWeight:900, color:C.text, letterSpacing:-0.5 }}>Command Center</div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                <span className="live-dot" style={{ width:7, height:7, borderRadius:'50%', background:C.emerald, display:'inline-block' }}/>
                <span style={{ fontSize:11, color:C.emerald, fontWeight:600 }}>Miami FL</span>
              </div>
              <SyncBadge synced={allSynced}/>
            </div>
          </div>
          <div style={{ flex:1, paddingTop:8 }}>
            {NAV.map(n=><NavBtn key={n.id} id={n.id} label={n.label} icon={n.icon} extra={n.id==='dashboard'?alertCount:0}/>)}
          </div>
          <div style={{ padding:'16px 22px', borderTop:'1px solid '+C.border }}>
            <div style={{ fontSize:11, color:C.textDim }}>Primerica Rep · Licensed 2-14</div>
          </div>
        </div>
      )}

      <div style={{ marginLeft:isMobile?0:SW, marginBottom:isMobile?72:0, minHeight:'100vh',
        padding:isMobile?'18px 14px':'30px 40px', maxWidth:isMobile?'100%':'calc(100% - '+SW+'px)' }}>

        {/* Mobile sync indicator */}
        {isMobile&&(
          <div style={{ ...row(), marginBottom:16 }}>
            <div style={{ fontSize:16, fontWeight:900, color:C.text }}>Command Center</div>
            <SyncBadge synced={allSynced}/>
          </div>
        )}

        {tab==='dashboard'  && <Dashboard  stats={stats} todos={todos} setTodos={setTodos} coldLeads={coldLeads} followUps={followUps} setSelectedContact={setSelectedContact} sales={sales} {...shared}/>}
        {tab==='contacts'   && <Contacts   leads={leads} setLeads={setLeads} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} filteredLeads={filteredLeads} setSelectedContact={setSelectedContact} {...shared}/>}
        {tab==='pipeline'   && <Pipeline   leads={leads} setSelectedContact={setSelectedContact} {...shared}/>}
        {tab==='recruits'   && <Recruits   recruits={recruits} setSelectedContact={setSelectedContact} search={search} {...shared}/>}
        {tab==='team'       && <Team       team={team} setTeam={setTeam} {...shared}/>}
        {tab==='commission' && <Commission sales={sales} setSales={setSales} {...shared}/>}
        {tab==='goals'      && <Goals      stats={stats} goals={goals} setGoals={setGoals} sales={sales} leads={leads} recruits={recruits} {...shared}/>}
      </div>

      {isMobile&&(
        <div style={{ position:'fixed', bottom:0, left:0, right:0, height:68, background:C.card,
          borderTop:'1px solid '+C.border, display:'flex', alignItems:'center',
          justifyContent:'space-around', zIndex:100, paddingBottom:2 }}>
          <NavBtn id='dashboard'  label='Home'  icon='⚡' extra={alertCount}/>
          <NavBtn id='contacts'   label='Leads' icon='👥' extra={0}/>
          <NavBtn id='pipeline'   label='Flow'  icon='🔁' extra={0}/>
          <NavBtn id='commission' label='$$$'   icon='💰' extra={0}/>
          <button onClick={()=>setMoreOpen(v=>!v)} className="nav-hover"
            style={{ background:'transparent', border:'none', cursor:'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              color:moreIds.includes(tab)?C.blue:C.textSub, fontSize:10, padding:'7px 9px', borderRadius:10 }}>
            <span style={{ fontSize:20 }}>⋯</span>
            <span style={{ fontWeight:moreIds.includes(tab)?700:400 }}>More</span>
          </button>
        </div>
      )}

      {isMobile&&moreOpen&&(
        <>
          <div onClick={()=>setMoreOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:190 }}/>
          <div style={{ position:'fixed', bottom:68, left:0, right:0, background:C.card,
            borderTop:'1px solid '+C.border, borderRadius:'20px 20px 0 0', zIndex:200, padding:'20px 16px 8px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              {moreIds.map(id=>{ const n=NAV.find(x=>x.id===id); return n?(
                <button key={id} onClick={()=>{ setTab(id); setMoreOpen(false); }}
                  style={{ background:tab===id?C.blue+'20':'none', border:'1px solid '+(tab===id?C.blue+'40':C.border),
                    borderRadius:12, padding:'14px 8px', display:'flex', flexDirection:'column',
                    alignItems:'center', gap:6, cursor:'pointer', color:tab===id?C.blue:C.textSub,
                    fontSize:11, fontWeight:tab===id?700:400 }}>
                  <span style={{ fontSize:24 }}>{n.icon}</span><span>{n.label}</span>
                </button>
              ):null; })}
            </div>
          </div>
        </>
      )}

      {selectedContact&&(
        <ContactModal contact={selectedContact} isRecruit={!!selectedContact.isRecruit}
          onClose={()=>setSelectedContact(null)}
          onSave={selectedContact.isRecruit?saveRecruit:saveContact}
          onDelete={selectedContact.isRecruit?deleteRecruit:deleteContact}/>
      )}

      <Toast toasts={toasts}/>
    </div>
  );
}
