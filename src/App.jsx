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

// ─── GOOGLE CALENDAR API (via Supabase Edge Function proxy) ─────────────────
// Deploy the edge function from /api/gcal-proxy.js — see instructions below.
// The proxy handles OAuth token refresh and forwards to Google Calendar API.
const GCAL_PROXY = `${SB_URL}/functions/v1/gcal-proxy`;

async function gcalFetch(path, options = {}) {
  try {
    const res = await fetch(GCAL_PROXY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      },
      body: JSON.stringify({ path, ...options }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Parse Google Calendar event into normalized shape ────────────────────────
function parseGcalEvent(e) {
  const startRaw = e.start?.dateTime || e.start?.date || '';
  const endRaw   = e.end?.dateTime   || e.end?.date   || '';
  const dateStr  = startRaw.split('T')[0];
  const timeStr  = startRaw.includes('T')
    ? new Date(startRaw).toLocaleTimeString('en-US',{ hour:'numeric', minute:'2-digit', hour12:true })
    : '';
  return {
    id: e.id, title: e.summary || 'Event',
    date: dateStr, time: timeStr,
    start: startRaw, end: endRaw,
    location: e.location || '',
    source: 'gcal',
  };
}

async function gcalListUpcoming(monthsAhead = 2) {
  const now    = new Date().toISOString();
  const future = new Date(Date.now() + monthsAhead * 30 * 86400000).toISOString();
  const data   = await gcalFetch('/events', { startTime: now, endTime: future, orderBy: 'startTime', pageSize: 50 });
  if (!data?.events) return [];
  return data.events.map(parseGcalEvent);
}

async function gcalCreateEvent({ summary, startTime, endTime, description, location }) {
  const data = await gcalFetch('/events/create', {
    summary, startTime, endTime,
    description: description || '',
    location: location || '',
  });
  return !!data?.id;
}

// ─── ONE-TIME MIGRATION: localStorage → Supabase ─────────────────────────────
const MIGRATION_KEY = 'josh_migrated_v1';
async function migrateIfNeeded() {
  if (localStorage.getItem(MIGRATION_KEY)) return false;
  const map = {
    leads: 'joshleads2', recruits: 'joshrecruits2', goals: 'joshgoals2',
    todos: 'joshtodos2', team: 'joshteam', sales: 'joshsales',
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
  teal:'#2dd4bf', pink:'#f472b6',
  text:'#eeeeff', textSub:'#8888b8', textDim:'#3c3c58',
  gBlue:'linear-gradient(135deg,#5b8df6,#6366f1)',
  gEmerald:'linear-gradient(135deg,#00cc7a,#00a865)',
  gGold:'linear-gradient(135deg,#f5a623,#f97316)',
  gPurple:'linear-gradient(135deg,#a078f0,#7c3aed)',
  gRose:'linear-gradient(135deg,#ff4f72,#e11d48)',
  gSky:'linear-gradient(135deg,#38bdf8,#5b8df6)',
  gTeal:'linear-gradient(135deg,#2dd4bf,#0891b2)',
  gPink:'linear-gradient(135deg,#f472b6,#ec4899)',
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const LEAD_STATUSES    = ['New','Contacted','FNA Scheduled','Presented','Follow Up','Closed Won','Closed Lost'];
const RECRUIT_STATUSES = ['Prospect','Invited','Interviewed','Licensing','Licensed','Active','Dropped'];
const SOURCES          = ['Social Media','Referral','Cold Outreach','Event','Walk-in','Other','Import'];
const POLICY_TYPES     = ['Term Life','SMART Loan','Investments','Mutual Funds','Other'];
const LICENSE_STEPS    = ['Applied','Background Check','Exam Scheduled','Exam Passed','State Submitted','Licensed'];
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
  { id:'fna',        label:'FNA',        icon:'📋' },
  { id:'calendar',   label:'Calendar',   icon:'📅' },
  { id:'recruits',   label:'Recruits',   icon:'🤝' },
  { id:'team',       label:'Team',       icon:'👔' },
  { id:'commission', label:'Money',      icon:'💰' },
  { id:'goals',      label:'Goals',      icon:'🎯' },
  { id:'scripts',    label:'Scripts',    icon:'📝' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function useCloudState(key, def) {
  const [value, setValue]   = useState(def);
  const [synced, setSynced] = useState(false);
  const timerRef            = useRef(null);
  useEffect(() => {
    dbGet(key).then(v => { if (v !== null) setValue(v); setSynced(true); });
  }, [key]);
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
const fmtFull     = d => d ? new Date(d).toLocaleDateString('en-US',{ month:'short', day:'numeric', year:'numeric' }) : '';
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
function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
}
function getBirthday(lead) {
  if (!lead.birthday) return null;
  const today = new Date();
  const bd = new Date(lead.birthday);
  const next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < today) next.setFullYear(today.getFullYear()+1);
  const diff = Math.ceil((next - today)/(1000*60*60*24));
  return diff <= 14 ? { days: diff, name: lead.name } : null;
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

// ─── QUICK NOTE MODAL (Home screen) ──────────────────────────────────────────
function QuickNoteModal({ leads, onClose, onSave }) {
  const [search, setSearch]   = useState('');
  const [picked, setPicked]   = useState(null);
  const [note, setNote]       = useState('');

  const filtered = leads.filter(l => l.name?.toLowerCase().includes(search.toLowerCase())).slice(0,6);

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', zIndex:1100,
      display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="fade-up" style={{ background:C.card, border:'1px solid '+C.border,
        borderRadius:20, width:'100%', maxWidth:440, padding:26 }}>
        <div style={{ fontSize:16, fontWeight:800, color:C.text, marginBottom:18 }}>⚡ Quick Note</div>
        {!picked ? (
          <>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:8 }}>Who's this note for?</div>
            <input autoFocus value={search} onChange={e=>setSearch(e.target.value)}
              placeholder='Search contact...' style={{ ...inp(), marginBottom:10 }}/>
            {filtered.map(l=>(
              <div key={l.id} onClick={()=>setPicked(l)}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                  background:C.bgAlt, borderRadius:10, marginBottom:6, cursor:'pointer',
                  border:'1px solid '+C.border }}>
                <Avatar name={l.name} size={30}/>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{l.name}</div>
                  <div style={{ fontSize:11, color:C.textDim }}>{l.status}</div>
                </div>
              </div>
            ))}
            {search.length>0&&filtered.length===0&&<div style={{ fontSize:12, color:C.textDim, textAlign:'center', padding:'16px 0' }}>No match</div>}
          </>
        ) : (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16,
              background:C.bgAlt, borderRadius:12, padding:'10px 14px' }}>
              <Avatar name={picked.name} size={32}/>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{picked.name}</div>
                <div style={{ fontSize:11, color:C.textDim }}>{picked.status}</div>
              </div>
              <button onClick={()=>setPicked(null)} style={{ background:'none', border:'none', color:C.textDim, cursor:'pointer', fontSize:18 }}>×</button>
            </div>
            <textarea autoFocus value={note} onChange={e=>setNote(e.target.value)}
              rows={4} placeholder='Write your note...'
              style={{ ...inp(), resize:'vertical', marginBottom:14 }}/>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{ if(!note.trim()) return; onSave(picked, note); onClose(); }}
                style={{ ...btn(C.gBlue), flex:1 }}>Save Note</button>
              <button onClick={onClose} style={{ flex:1, background:C.border, border:'none', borderRadius:9, color:C.text, padding:'11px 22px', fontSize:13, fontWeight:700, cursor:'pointer' }}>Cancel</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── CONTACT MODAL ────────────────────────────────────────────────────────────
function ContactModal({ contact, onClose, onSave, onDelete, isRecruit, leads }) {
  const [c, setC]       = useState({ ...contact });
  const [note, setNote] = useState('');
  const [confirmDel, setCD] = useState(false);
  const [tab, setTab]   = useState('info');
  const [gcalPushing, setGcalPushing] = useState(false);
  const upd = (k,v) => setC(prev=>({ ...prev, [k]:v }));

  const pushFollowUpToGcal = async () => {
    if (!c.followUp) return;
    setGcalPushing(true);
    const start = new Date(c.followUp + 'T10:00:00');
    const end   = new Date(start.getTime() + 30 * 60 * 1000);
    const ok = await gcalCreateEvent({
      summary: `📞 Follow-up: ${c.name}`,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      description: c.notes ? c.notes : 'Primerica follow-up call',
      colorId: '5',
    });
    setGcalPushing(false);
    // show result via title change — toast not available here so we use alert briefly
    if (ok) alert('✅ Added to Google Calendar!');
    else alert('GCal sync failed — try again');
  };

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

        <div style={{ ...row(), marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <Avatar name={c.name} size={48}/>
            <div>
              <div style={{ fontSize:18, fontWeight:800, color:C.text }}>{c.name||'New Contact'}</div>
              <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{c.source||'—'} · {c.createdAt?'Added '+fmt(c.createdAt):'New'}</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {c.phone && <a href={'tel:'+c.phone} style={{ ...btn(C.gEmerald,true), textDecoration:'none' }}>📞 Call</a>}
            {c.phone && <a href={'sms:'+c.phone}  style={{ ...btn(C.gSky,true), textDecoration:'none' }}>💬 Text</a>}
          </div>
        </div>

        {/* Sub-tabs */}
        <div style={{ display:'flex', gap:6, marginBottom:18, borderBottom:'1px solid '+C.border, paddingBottom:12 }}>
          {['info','policy','activity'].map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{
              background:tab===t?C.blue+'20':'none', border:tab===t?'1px solid '+C.blue+'40':'1px solid transparent',
              borderRadius:8, padding:'5px 14px', fontSize:12, fontWeight:tab===t?700:500,
              color:tab===t?C.blue:C.textDim, cursor:'pointer', textTransform:'capitalize'
            }}>{t}</button>
          ))}
        </div>

        {tab==='info'&&(
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              {[['name','Name','text'],['phone','Phone','tel'],['email','Email','email'],['followUp','Follow-up','date'],['birthday','Birthday','date'],['anniversary','Anniversary','date']].map(([k,label,type]) => (
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
            {/* GCal push for follow-up */}
            {c.followUp&&(
              <div style={{ gridColumn:'1/-1', marginBottom:2 }}>
                <button onClick={pushFollowUpToGcal} disabled={gcalPushing}
                  style={{ ...btn(C.gTeal,true), display:'flex', alignItems:'center', gap:6, width:'100%', justifyContent:'center' }}>
                  {gcalPushing
                    ? <><span className="spinner" style={{ display:'inline-block', width:10, height:10, border:'2px solid #ffffff44', borderTop:'2px solid #fff', borderRadius:'50%' }}/> Adding to GCal...</>
                    : '📅 Add Follow-up to Google Calendar'
                  }
                </button>
              </div>
            )}
            {/* Referred By */}
            <div style={{ marginBottom:12 }}>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>REFERRED BY</div>
              <input value={c.referredBy||''} onChange={e=>upd('referredBy',e.target.value)}
                placeholder='Who referred this person?' style={inp()}/>
            </div>
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4, letterSpacing:0.5 }}>NOTES</div>
              <textarea value={c.notes||''} onChange={e=>upd('notes',e.target.value)}
                rows={3} style={{ ...inp(), resize:'vertical' }} placeholder='Any notes...'/>
            </div>
          </>
        )}

        {tab==='policy'&&(
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'#07180f', border:'1px solid '+C.emerald+'30', borderRadius:14, padding:16, marginBottom:4 }}>
              <div style={{ fontSize:11, fontWeight:700, color:C.emerald, letterSpacing:2, marginBottom:12 }}>POLICY DETAILS</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                {[['policyFaceAmount','Face Amount ($)','number'],['policyMonthlyPremium','Monthly Premium ($)','number'],['policyType','Policy Type','select'],['policyDate','Policy Date','date']].map(([k,label,type])=>(
                  <div key={k}>
                    <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>{label.toUpperCase()}</div>
                    {type==='select'
                      ? <select value={c[k]||'Term Life'} onChange={e=>upd(k,e.target.value)} style={{ ...inp(), cursor:'pointer' }}>
                          {POLICY_TYPES.map(t=><option key={t}>{t}</option>)}
                        </select>
                      : <input type={type} value={c[k]||''} onChange={e=>upd(k,e.target.value)} style={inp()} placeholder={label}/>
                    }
                  </div>
                ))}
              </div>
              {(c.policyFaceAmount||c.policyMonthlyPremium)&&(
                <div style={{ marginTop:16, background:C.card, borderRadius:12, padding:'12px 16px' }}>
                  {c.policyFaceAmount&&<div style={{ ...row(), marginBottom:4 }}>
                    <span style={{ fontSize:12, color:C.textSub }}>Coverage</span>
                    <span style={{ fontSize:16, fontWeight:800, color:C.emerald }}>{fmtCur(c.policyFaceAmount)}</span>
                  </div>}
                  {c.policyMonthlyPremium&&<div style={{ ...row(), marginBottom:4 }}>
                    <span style={{ fontSize:12, color:C.textSub }}>Monthly</span>
                    <span style={{ fontSize:16, fontWeight:800, color:C.blue }}>{fmtCur(c.policyMonthlyPremium)}</span>
                  </div>}
                  {c.policyMonthlyPremium&&<div style={{ ...row() }}>
                    <span style={{ fontSize:12, color:C.textSub }}>Annual</span>
                    <span style={{ fontSize:14, fontWeight:700, color:C.gold }}>{fmtCur(Number(c.policyMonthlyPremium)*12)}</span>
                  </div>}
                </div>
              )}
            </div>
          </div>
        )}

        {tab==='activity'&&(
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              <input value={note} onChange={e=>setNote(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&addNote()}
                placeholder='Log a call, note, or update...' style={{ ...inp(), flex:1 }}/>
              <button onClick={addNote} style={btn(C.gPurple,true)}>+ Log</button>
            </div>
            <div style={{ maxHeight:260, overflowY:'auto', display:'flex', flexDirection:'column', gap:7 }}>
              {(c.activityLog||[]).length===0
                ? <EmptyState icon="📋" title="No activity yet" sub="Log calls, meetings, and updates here"/>
                : (c.activityLog||[]).slice().reverse().map((a,i) => (
                  <div key={i} style={{ background:C.bgAlt, borderRadius:9, padding:'9px 13px', border:'1px solid '+C.border }}>
                    <div style={{ fontSize:12, color:C.text, lineHeight:1.5 }}>{a.text}</div>
                    <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>{fmt(a.date)}</div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {confirmDel ? (
          <div style={{ background:'#1a0a0e', border:'1px solid '+C.rose+'44', borderRadius:12, padding:16, marginBottom:12 }}>
            <div style={{ fontSize:13, color:C.text, marginBottom:12 }}>Delete {c.name}? This cannot be undone.</div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>onDelete(c.id)} style={{ ...btn(C.gRose,true), flex:1 }}>Yes, Delete</button>
              <button onClick={()=>setCD(false)} style={{ flex:1, background:C.border, border:'none', borderRadius:9, color:C.text, padding:'7px 15px', fontSize:12, fontWeight:700, cursor:'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', gap:10, marginTop:16 }}>
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
function Dashboard({ stats, todos, setTodos, coldLeads, followUps, setSelectedContact, sales, leads, recruits, isMobile, toast, setTab }) {
  const [newTodo, setNewTodo]         = useState('');
  const [showQuickNote, setQN]        = useState(false);
  const thisMon = sales.filter(s=>new Date(s.date)>=startOfMon());
  const earned  = thisMon.reduce((sum,s)=>sum+(s.commission||0),0);

  // Birthday / anniversary reminders
  const allPeople = [...leads, ...recruits];
  const upcomingBdays = allPeople.reduce((acc, p) => {
    const bd = getBirthday(p);
    if (bd) acc.push({ ...bd, type:'birthday' });
    if (p.anniversary) {
      const a = getBirthday({ birthday: p.anniversary, name: p.name + ' (anniv.)' });
      if (a) acc.push({ ...a, type:'anniversary' });
    }
    return acc;
  }, []).sort((a,b)=>a.days-b.days);

  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos(p=>[...p,{ id:Date.now(), text:newTodo, done:false }]);
    setNewTodo('');
  };

  const saveQuickNote = (contact, note) => {
    // Handled by parent via leads setter — we'll use setSelectedContact trick here
    toast('Note saved for ' + contact.name);
  };

  return (
    <div className="fade-up">
      {showQuickNote && <QuickNoteModal leads={[...leads,...recruits]} onClose={()=>setQN(false)} onSave={saveQuickNote}/>}

      <div style={{ marginBottom:22 }}>
        <div style={{ fontSize:11, color:C.blue, letterSpacing:3, textTransform:'uppercase', marginBottom:6 }}>
          {new Date().toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' })}
        </div>
        <div style={{ ...row(), flexWrap:'wrap', gap:10 }}>
          <div>
            <div style={{ fontSize:isMobile?22:30, fontWeight:900, color:C.text, lineHeight:1 }}>Welcome back, Josh.</div>
            <div style={{ fontSize:13, color:C.textSub, marginTop:6 }}>
              {earned>0?fmtCur(earned)+' earned this month · ':''}{stats.won} client{stats.won!==1?'s':''} closed · {stats.fna} FNA{stats.fna!==1?'s':''} set
            </div>
          </div>
          <button onClick={()=>setQN(true)} style={{ ...btn(C.gPurple,true), display:'flex', alignItems:'center', gap:6 }}>
            ⚡ Quick Note
          </button>
        </div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12, marginBottom:22 }}>
        <StatCard label="TOTAL LEADS"   value={stats.leads}    color={C.blue}/>
        <StatCard label="FNAs SET"      value={stats.fna}      color={C.gold}/>
        <StatCard label="CLIENTS WON"   value={stats.won}      color={C.emerald}/>
        <StatCard label="LICENSED REPS" value={stats.licensed} color={C.purple}/>
      </div>

      {/* Birthday / Anniversary Reminders */}
      {upcomingBdays.length>0&&(
        <div style={cardS({ borderLeft:'3px solid '+C.pink })}>
          <div style={{ fontSize:11, fontWeight:700, color:C.pink, letterSpacing:2, marginBottom:10 }}>🎂 UPCOMING REMINDERS</div>
          {upcomingBdays.slice(0,4).map((b,i)=>(
            <div key={i} style={{ ...row(), padding:'8px 0', borderBottom:'1px solid '+C.border }}>
              <div style={{ fontSize:13, color:C.text, fontWeight:600 }}>
                {b.type==='birthday'?'🎂':'💍'} {b.name}
              </div>
              <span style={pill(b.days===0?C.rose:b.days<=3?C.gold:C.pink,true)}>
                {b.days===0?'Today!':b.days===1?'Tomorrow':b.days+'d away'}
              </span>
            </div>
          ))}
        </div>
      )}

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

      {/* Quick access buttons */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:4 }}>
        <button onClick={()=>setTab('fna')} style={{ ...cardS({ cursor:'pointer', marginBottom:0, textAlign:'left', border:'1px solid '+C.gold+'30' }), background:C.gold+'08' }}>
          <div style={{ fontSize:22, marginBottom:4 }}>📋</div>
          <div style={{ fontSize:13, fontWeight:700, color:C.gold }}>FNA Tracker</div>
          <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>Schedule & track FNAs</div>
        </button>
        <button onClick={()=>setTab('calendar')} style={{ ...cardS({ cursor:'pointer', marginBottom:0, textAlign:'left', border:'1px solid '+C.blue+'30' }), background:C.blue+'08' }}>
          <div style={{ fontSize:22, marginBottom:4 }}>📅</div>
          <div style={{ fontSize:13, fontWeight:700, color:C.blue }}>Calendar</div>
          <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>View upcoming events</div>
        </button>
      </div>
    </div>
  );
}

// ─── PAGE: FNA TRACKER ────────────────────────────────────────────────────────
function FNATracker({ fnas, setFnas, leads, isMobile, toast, setSelectedContact }) {
  const [showAdd, setShowAdd]     = useState(false);
  const [form, setForm]           = useState({ contactName:'', contactId:'', date:'', time:'', location:'', status:'Scheduled', notes:'', outcome:'', followUpDate:'' });
  const [filter, setFilter]       = useState('All');
  const [gcalLoading, setGcalLoading] = useState(null); // stores fna id being synced
  const upd = (k,v) => setForm(f=>({...f,[k]:v}));

  const FNA_STATUSES = ['Scheduled','Completed','No Show','Rescheduled','Cancelled'];
  const FNA_COLORS   = { 'Scheduled':C.gold,'Completed':C.emerald,'No Show':C.rose,'Rescheduled':C.orange,'Cancelled':C.gray };

  const save = async (pushToGcal = false) => {
    if (!form.contactName.trim()||!form.date) return;
    const newFna = { ...form, id:Date.now(), createdAt:new Date().toISOString() };
    setFnas(p=>[newFna, ...p]);
    setForm({ contactName:'', contactId:'', date:'', time:'', location:'', status:'Scheduled', notes:'', outcome:'', followUpDate:'' });
    setShowAdd(false);
    if (pushToGcal) {
      setGcalLoading(newFna.id);
      const timeStr = form.time || '10:00';
      const start = new Date(`${form.date}T${timeStr}:00`);
      const end   = new Date(start.getTime() + 60 * 60 * 1000);
      const ok = await gcalCreateEvent({
        summary: `📋 FNA – ${form.contactName}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        description: form.notes ? form.notes : 'Primerica Financial Needs Analysis',
        location: form.location || '',
        colorId: '5',
      });
      setGcalLoading(null);
      toast(ok ? '📅 Added to Google Calendar!' : 'FNA saved (GCal sync failed)', ok ? 'success' : 'error');
    } else {
      toast('FNA scheduled!');
    }
  };

  const pushExistingToGcal = async (f) => {
    if (!f.date) { toast('No date set on this FNA', 'error'); return; }
    setGcalLoading(f.id);
    const timeStr = f.time || '10:00';
    const start = new Date(`${f.date}T${timeStr}:00`);
    const end   = new Date(start.getTime() + 60 * 60 * 1000);
    const ok = await gcalCreateEvent({
      summary: `📋 FNA – ${f.contactName}`,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      description: f.notes || 'Primerica Financial Needs Analysis',
      location: f.location || '',
      colorId: '5',
    });
    setGcalLoading(null);
    toast(ok ? '📅 Added to Google Calendar!' : 'GCal sync failed — check connection', ok ? 'success' : 'error');
  };

  const filtered = fnas.filter(f=>filter==='All'||f.status===filter);
  const stats    = { total:fnas.length, completed:fnas.filter(f=>f.status==='Completed').length, rate:fnas.length>0?Math.round(fnas.filter(f=>f.status==='Completed').length/fnas.length*100):0 };

  return (
    <div className="fade-up">
      <div style={{ ...row(), marginBottom:18, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:isMobile?18:24, fontWeight:900, color:C.text }}>FNA Tracker</div>
          <div style={{ fontSize:12, color:C.textDim, marginTop:3 }}>Financial Needs Analysis workflow</div>
        </div>
        <button className="btn-glow" onClick={()=>setShowAdd(true)} style={btn(C.gGold,true)}>+ Schedule FNA</button>
      </div>

      {/* Stats bar */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:18 }}>
        <div style={{ ...cardS({ marginBottom:0, textAlign:'center', padding:'14px 10px' }), borderTop:'2px solid '+C.gold }}>
          <div style={{ fontSize:28, fontWeight:900, color:C.gold }}>{stats.total}</div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>TOTAL</div>
        </div>
        <div style={{ ...cardS({ marginBottom:0, textAlign:'center', padding:'14px 10px' }), borderTop:'2px solid '+C.emerald }}>
          <div style={{ fontSize:28, fontWeight:900, color:C.emerald }}>{stats.completed}</div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>COMPLETED</div>
        </div>
        <div style={{ ...cardS({ marginBottom:0, textAlign:'center', padding:'14px 10px' }), borderTop:'2px solid '+C.purple }}>
          <div style={{ fontSize:28, fontWeight:900, color:C.purple }}>{stats.rate}%</div>
          <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>SHOW RATE</div>
        </div>
      </div>

      {showAdd&&(
        <div style={cardS({ borderTop:'2px solid '+C.gold, marginBottom:18 })}>
          <div style={{ fontSize:13, fontWeight:700, color:C.gold, marginBottom:16 }}>📋 Schedule New FNA</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>CLIENT NAME</div>
              <input autoFocus value={form.contactName} onChange={e=>upd('contactName',e.target.value)} placeholder='Client name' style={inp()}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>DATE</div>
              <input type='date' value={form.date} onChange={e=>upd('date',e.target.value)} style={inp()}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>TIME</div>
              <input type='time' value={form.time} onChange={e=>upd('time',e.target.value)} style={inp()}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>LOCATION</div>
              <input value={form.location} onChange={e=>upd('location',e.target.value)} placeholder='Home, Zoom, coffee shop...' style={inp()}/>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>STATUS</div>
              <select value={form.status} onChange={e=>upd('status',e.target.value)} style={{ ...inp(), cursor:'pointer' }}>
                {FNA_STATUSES.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>FOLLOW-UP DATE</div>
              <input type='date' value={form.followUpDate} onChange={e=>upd('followUpDate',e.target.value)} style={inp()}/>
            </div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>NOTES / OUTCOME</div>
            <textarea value={form.notes} onChange={e=>upd('notes',e.target.value)} rows={2} style={{ ...inp(), resize:'vertical' }} placeholder='Pre-FNA notes or post-FNA outcome...'/>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <button onClick={()=>save(true)} style={{ ...btn(C.gBlue,true), display:'flex', alignItems:'center', gap:6 }}>📅 Save + GCal</button>
            <button onClick={()=>save(false)} style={btn(C.gGold,true)}>Save Only</button>
            <button onClick={()=>setShowAdd(false)} style={{ background:C.border, border:'none', borderRadius:9, color:C.text, padding:'7px 15px', fontSize:12, fontWeight:700, cursor:'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
        {['All',...FNA_STATUSES].map(s=>(
          <button key={s} onClick={()=>setFilter(s)} style={{
            padding:'5px 14px', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer', border:'none',
            background:filter===s?(FNA_COLORS[s]||C.blue)+'22':'none',
            color:filter===s?(FNA_COLORS[s]||C.blue):C.textDim,
            outline:filter===s?'1px solid '+(FNA_COLORS[s]||C.blue)+'50':'none',
          }}>{s} {s!=='All'?`(${fnas.filter(f=>f.status===s).length})`:''}</button>
        ))}
      </div>

      {filtered.length===0
        ? <EmptyState icon="📋" title="No FNAs yet" sub="Schedule your first Financial Needs Analysis above"/>
        : filtered.map(f=>{
          const color = FNA_COLORS[f.status]||C.gray;
          return (
            <div key={f.id} style={cardS({ borderLeft:'3px solid '+color, cursor:'default' })}>
              <div style={{ ...row(), marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:15, fontWeight:800, color:C.text }}>{f.contactName}</div>
                  <div style={{ fontSize:12, color:C.textDim, marginTop:2 }}>
                    {f.date&&fmtFull(f.date)}{f.time&&' · '+f.time}{f.location&&' · '+f.location}
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6 }}>
                  <span style={pill(color,true)}>{f.status}</span>
                  <button onClick={()=>setFnas(p=>p.filter(x=>x.id!==f.id))}
                    style={{ background:'none', border:'none', color:C.textDim, cursor:'pointer', fontSize:11 }}>Remove</button>
                </div>
              </div>
              {f.notes&&<div style={{ fontSize:12, color:C.textSub, background:C.bgAlt, borderRadius:8, padding:'8px 12px', marginBottom:8 }}>{f.notes}</div>}
              <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
                {f.followUpDate&&<div style={{ fontSize:11, color:C.gold }}>📅 Follow-up: {fmtFull(f.followUpDate)}</div>}
                <select value={f.status} onChange={e=>setFnas(p=>p.map(x=>x.id===f.id?{...x,status:e.target.value}:x))}
                  style={{ background:color+'18', border:'1px solid '+color+'40', borderRadius:8, color, fontSize:11, fontWeight:700, padding:'3px 8px', cursor:'pointer' }}>
                  {FNA_STATUSES.map(s=><option key={s}>{s}</option>)}
                </select>
                <button onClick={()=>pushExistingToGcal(f)} disabled={gcalLoading===f.id}
                  style={{ background:C.blue+'18', border:'1px solid '+C.blue+'40', borderRadius:8, color:gcalLoading===f.id?C.textDim:C.blue, fontSize:11, fontWeight:700, padding:'4px 10px', cursor:'pointer', display:'flex', alignItems:'center', gap:4 }}>
                  {gcalLoading===f.id ? <span className="spinner" style={{ display:'inline-block', width:10, height:10, border:'2px solid '+C.blue+'44', borderTop:'2px solid '+C.blue, borderRadius:'50%' }}/> : '📅'} GCal
                </button>
              </div>
            </div>
          );
        })
      }
    </div>
  );
}

// ─── PAGE: APPOINTMENT CALENDAR ───────────────────────────────────────────────
function AppointmentCalendar({ leads, recruits, fnas, isMobile }) {
  const [viewMode, setViewMode]     = useState('month');
  const [monthOffset, setMonthOffset] = useState(0);
  const [weekOffset, setWeekOffset]   = useState(0);
  const [gcalEvents, setGcalEvents]   = useState([]);
  const [gcalLoading, setGcalLoading] = useState(false);
  const [gcalStatus, setGcalStatus]   = useState('idle'); // idle | ok | error
  const [gcalError,  setGcalError]    = useState('');
  const [selectedDay, setSelectedDay] = useState(null);

  const today = new Date();
  today.setHours(0,0,0,0);

  const loadGcalEvents = async () => {
    setGcalLoading(true);
    setGcalStatus('idle');
    setGcalError('');
    try {
      const res = await fetch(`${SB_URL}/functions/v1/gcal-proxy`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
        },
        body: JSON.stringify({ path: '/events' }),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { setGcalError('Bad response: ' + text.slice(0,100)); setGcalLoading(false); return; }
      if (data.error) { setGcalError('GCal error: ' + data.error); setGcalStatus('error'); setGcalLoading(false); return; }
      if (data.events) {
        setGcalEvents(data.events.map(parseGcalEvent));
        setGcalStatus('ok');
      } else {
        setGcalError('No events field. Got: ' + JSON.stringify(data).slice(0,120));
        setGcalStatus('error');
      }
    } catch(e) {
      setGcalError('Fetch failed: ' + String(e));
      setGcalStatus('error');
    }
    setGcalLoading(false);
  };

  useEffect(() => { loadGcalEvents(); }, []);

  // ── Build unified event list ───────────────────────────────────────────────
  const allEvents = [];
  leads.forEach(l => {
    if (l.followUp) allEvents.push({ date:l.followUp, label:l.name, type:'Follow-up', color:C.gold, time:'', source:'crm' });
  });
  recruits.forEach(r => {
    if (r.followUp) allEvents.push({ date:r.followUp, label:r.name, type:'Recruit', color:C.purple, time:'', source:'crm' });
  });
  fnas.forEach(f => {
    if (f.date && f.status !== 'Cancelled')
      allEvents.push({ date:f.date, label:f.contactName, type:'FNA', color:C.gold, time:f.time||'', source:'crm' });
  });
  gcalEvents.forEach(e => {
    allEvents.push({ date:e.date, label:e.title, type:'GCal', color:C.teal, time:e.time||'', location:e.location||'', source:'gcal' });
  });

  const getEventsForDay = d => {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    return allEvents.filter(e => e.date === ds);
  };

  // ── Month grid ─────────────────────────────────────────────────────────────
  const monthBase = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const monthName = monthBase.toLocaleDateString('en-US', { month:'long', year:'numeric' });
  const firstDow  = monthBase.getDay();
  const daysInMon = new Date(monthBase.getFullYear(), monthBase.getMonth()+1, 0).getDate();
  const gridCells = [];
  for (let i = 0; i < firstDow; i++) gridCells.push(null);
  for (let d = 1; d <= daysInMon; d++) gridCells.push(new Date(monthBase.getFullYear(), monthBase.getMonth(), d));

  // ── Week grid ──────────────────────────────────────────────────────────────
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);
  const weekDays  = Array.from({ length:7 }, (_,i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate()+i); return d; });

  // ── Upcoming list ──────────────────────────────────────────────────────────
  const upcoming = allEvents
    .filter(e => e.date >= today.toISOString().split('T')[0])
    .sort((a,b) => a.date.localeCompare(b.date));

  // ── Day detail (selected day popup) ───────────────────────────────────────
  const dayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  const TYPE_ICON = { 'FNA':'📋', 'Follow-up':'📞', 'Recruit':'🤝', 'GCal':'📅' };

  return (
    <div className="fade-up">

      {/* ── Header ── */}
      <div style={{ ...row(), marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:isMobile?20:26, fontWeight:900, color:C.text, letterSpacing:-0.5 }}>Calendar</div>
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
            {gcalStatus==='ok' && <><span className="live-dot" style={{ width:6, height:6, borderRadius:'50%', background:C.teal, display:'inline-block' }}/><span style={{ fontSize:11, color:C.teal, fontWeight:600 }}>Google Cal synced · {gcalEvents.length} events</span></>}
            {gcalStatus==='error' && <span style={{ fontSize:11, color:C.rose }}>⚠ {gcalError||'GCal sync failed'}</span>}
            {gcalStatus==='idle' && gcalLoading && <span style={{ fontSize:11, color:C.textDim }}>Syncing...</span>}
          </div>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
          {['month','week','upcoming'].map(v => (
            <button key={v} onClick={() => setViewMode(v)} style={{
              padding:'6px 14px', borderRadius:9, fontSize:12, fontWeight:700, cursor:'pointer',
              background: viewMode===v ? C.gBlue : 'none',
              border: viewMode===v ? 'none' : '1px solid ' + C.border,
              color: viewMode===v ? '#fff' : C.textDim,
            }}>{v==='month'?'Month':v==='week'?'Week':'Upcoming'}</button>
          ))}
          <button onClick={loadGcalEvents} disabled={gcalLoading} style={{
            padding:'6px 12px', borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer',
            background: C.teal+'15', border:'1px solid '+C.teal+'40', color: gcalLoading?C.textDim:C.teal,
            display:'flex', alignItems:'center', gap:4,
          }}>
            {gcalLoading
              ? <span className="spinner" style={{ display:'inline-block', width:9, height:9, border:'2px solid '+C.teal+'44', borderTop:'2px solid '+C.teal, borderRadius:'50%' }}/>
              : '🔄'} Sync
          </button>
        </div>
      </div>

      {/* ── Legend ── */}
      <div style={{ display:'flex', gap:14, marginBottom:16, flexWrap:'wrap' }}>
        {[['FNA',C.gold],['Follow-up',C.gold],['Recruit',C.purple],['Google Cal',C.teal]].map(([label,color])=>(
          <div key={label} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <div style={{ width:7, height:7, borderRadius:2, background:color, flexShrink:0 }}/>
            <span style={{ fontSize:11, color:C.textDim, fontWeight:500 }}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── MONTH VIEW ── */}
      {viewMode==='month' && (
        <div style={cardS({ padding:'18px 16px' })}>
          {/* Month nav */}
          <div style={{ ...row(), marginBottom:20 }}>
            <button onClick={() => setMonthOffset(m=>m-1)} style={{ background:'none', border:'1px solid '+C.border, borderRadius:8, color:C.text, padding:'6px 14px', cursor:'pointer', fontWeight:700, fontSize:16 }}>‹</button>
            <div style={{ fontSize:16, fontWeight:800, color:C.text }}>{monthName}</div>
            <button onClick={() => setMonthOffset(m=>m+1)} style={{ background:'none', border:'1px solid '+C.border, borderRadius:8, color:C.text, padding:'6px 14px', cursor:'pointer', fontWeight:700, fontSize:16 }}>›</button>
          </div>

          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:6 }}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700, color:C.textDim, letterSpacing:1, paddingBottom:8 }}>{d}</div>
            ))}
          </div>

          {/* Grid cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4 }}>
            {gridCells.map((d, i) => {
              if (!d) return <div key={i}/>;
              const evs      = getEventsForDay(d);
              const isToday  = isSameDay(d, new Date());
              const isSel    = selectedDay && isSameDay(d, selectedDay);
              const hasEvs   = evs.length > 0;
              return (
                <div key={i} onClick={() => setSelectedDay(isSel ? null : d)}
                  style={{
                    borderRadius:10, padding:'8px 4px 6px', cursor:hasEvs?'pointer':'default',
                    background: isToday ? C.blue+'20' : isSel ? C.purple+'18' : hasEvs ? C.card : 'transparent',
                    border: isToday ? '1.5px solid '+C.blue+'60' : isSel ? '1.5px solid '+C.purple+'60' : '1px solid transparent',
                    minHeight: isMobile ? 52 : 72,
                    transition: 'background 0.15s, border 0.15s',
                    position: 'relative',
                  }}>
                  <div style={{
                    textAlign:'center', fontSize:13, fontWeight: isToday?900:500,
                    color: isToday?C.blue : hasEvs?C.text : C.textSub,
                    marginBottom:4,
                  }}>{d.getDate()}</div>
                  {/* Event dots / pills */}
                  <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'stretch' }}>
                    {evs.slice(0,isMobile?2:3).map((e,j) => (
                      <div key={j} style={{
                        background: e.color+'25', borderRadius:4,
                        padding:'1px 4px', overflow:'hidden',
                      }}>
                        <div style={{ fontSize:9, fontWeight:700, color:e.color, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                          {TYPE_ICON[e.type]} {e.label}
                        </div>
                      </div>
                    ))}
                    {evs.length > (isMobile?2:3) && (
                      <div style={{ fontSize:9, color:C.textDim, textAlign:'center', fontWeight:600 }}>+{evs.length-(isMobile?2:3)}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Day detail panel */}
          {selectedDay && (
            <div style={{ marginTop:16, background:C.bgAlt, borderRadius:14, padding:'16px', border:'1px solid '+C.border }}>
              <div style={{ ...row(), marginBottom:12 }}>
                <div style={{ fontSize:14, fontWeight:800, color:C.text }}>
                  {selectedDay.toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' })}
                </div>
                <button onClick={()=>setSelectedDay(null)} style={{ background:'none', border:'none', color:C.textDim, cursor:'pointer', fontSize:18 }}>×</button>
              </div>
              {dayEvents.length === 0
                ? <div style={{ fontSize:12, color:C.textDim, textAlign:'center', padding:'12px 0' }}>No events this day</div>
                : dayEvents.map((e,i) => (
                  <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 0', borderBottom: i<dayEvents.length-1?'1px solid '+C.border:'none' }}>
                    <div style={{ width:34, height:34, borderRadius:9, background:e.color+'20', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                      {TYPE_ICON[e.type]||'📅'}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{e.label}</div>
                      <div style={{ display:'flex', gap:8, marginTop:3, flexWrap:'wrap' }}>
                        <span style={pill(e.color,true)}>{e.type}</span>
                        {e.time && <span style={{ fontSize:11, color:C.textDim }}>🕐 {e.time}</span>}
                        {e.location && <span style={{ fontSize:11, color:C.textDim }}>📍 {e.location}</span>}
                      </div>
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}

      {/* ── WEEK VIEW ── */}
      {viewMode==='week' && (
        <div style={cardS({ padding:'16px' })}>
          <div style={{ ...row(), marginBottom:18 }}>
            <button onClick={()=>setWeekOffset(w=>w-1)} style={{ background:'none', border:'1px solid '+C.border, borderRadius:8, color:C.text, padding:'6px 14px', cursor:'pointer', fontWeight:700 }}>‹</button>
            <div style={{ fontSize:14, fontWeight:700, color:C.text, textAlign:'center' }}>
              {weekStart.toLocaleDateString('en-US',{month:'short',day:'numeric'})} –{' '}
              {new Date(weekStart.getTime()+6*86400000).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
            </div>
            <button onClick={()=>setWeekOffset(w=>w+1)} style={{ background:'none', border:'1px solid '+C.border, borderRadius:8, color:C.text, padding:'6px 14px', cursor:'pointer', fontWeight:700 }}>›</button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
            {weekDays.map((d,i) => {
              const evs     = getEventsForDay(d);
              const isToday = isSameDay(d, new Date());
              return (
                <div key={i} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {/* Day label */}
                  <div style={{
                    textAlign:'center', padding:'6px 4px 8px',
                    borderBottom:'2px solid '+(isToday?C.blue:C.border),
                  }}>
                    <div style={{ fontSize:10, color:isToday?C.blue:C.textDim, fontWeight:700, letterSpacing:1 }}>
                      {['SUN','MON','TUE','WED','THU','FRI','SAT'][d.getDay()]}
                    </div>
                    <div style={{
                      fontSize:18, fontWeight:isToday?900:600,
                      color:isToday?'#fff':C.textSub,
                      width:isToday?30:undefined, height:isToday?30:undefined,
                      borderRadius:isToday?'50%':undefined,
                      background:isToday?C.blue:undefined,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      margin:isToday?'4px auto 0':'4px auto 0',
                    }}>{d.getDate()}</div>
                  </div>
                  {/* Events */}
                  <div style={{ display:'flex', flexDirection:'column', gap:4, minHeight:80, padding:'4px 2px' }}>
                    {evs.map((e,j) => (
                      <div key={j} style={{
                        background:e.color+'20', border:'1px solid '+e.color+'40',
                        borderRadius:7, padding:'5px 7px',
                      }}>
                        <div style={{ fontSize:10, fontWeight:700, color:e.color, lineHeight:1.4 }}>
                          {TYPE_ICON[e.type]} {e.label}
                        </div>
                        {e.time && <div style={{ fontSize:9, color:C.textDim, marginTop:1 }}>{e.time}</div>}
                      </div>
                    ))}
                    {evs.length === 0 && <div style={{ flex:1 }}/>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── UPCOMING LIST ── */}
      {viewMode==='upcoming' && (
        <div>
          {upcoming.length === 0
            ? <EmptyState icon="📅" title="Nothing scheduled" sub="Add follow-up dates to contacts or schedule FNAs"/>
            : (() => {
                // Group by date
                const grouped = {};
                upcoming.forEach(e => {
                  if (!grouped[e.date]) grouped[e.date] = [];
                  grouped[e.date].push(e);
                });
                return Object.entries(grouped).slice(0,30).map(([date, evs]) => {
                  const d = new Date(date + 'T12:00:00');
                  const daysAway = Math.round((new Date(date)-today)/86400000);
                  return (
                    <div key={date} style={{ marginBottom:16 }}>
                      {/* Date header */}
                      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                        <div style={{
                          background: daysAway===0?C.blue:daysAway<=2?C.gold+'30':C.bgAlt,
                          border:'1px solid '+(daysAway===0?C.blue+'50':daysAway<=2?C.gold+'40':C.border),
                          borderRadius:10, padding:'5px 12px', display:'flex', flexDirection:'column', alignItems:'center', minWidth:46,
                        }}>
                          <div style={{ fontSize:9, fontWeight:800, color:daysAway===0?C.blue:C.textDim, letterSpacing:1 }}>
                            {d.toLocaleDateString('en-US',{month:'short'}).toUpperCase()}
                          </div>
                          <div style={{ fontSize:20, fontWeight:900, color:daysAway===0?C.blue:C.text, lineHeight:1 }}>{d.getDate()}</div>
                        </div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:C.text }}>
                            {d.toLocaleDateString('en-US',{weekday:'long'})}
                          </div>
                          <div style={{ fontSize:11, color:daysAway===0?C.blue:daysAway<=2?C.gold:C.textDim, fontWeight:600 }}>
                            {daysAway===0?'Today':daysAway===1?'Tomorrow':`In ${daysAway} days`}
                          </div>
                        </div>
                      </div>
                      {/* Events for this date */}
                      <div style={{ display:'flex', flexDirection:'column', gap:6, paddingLeft:58 }}>
                        {evs.map((e,j) => (
                          <div key={j} style={{
                            background:C.card, border:'1px solid '+C.border,
                            borderLeft:'3px solid '+e.color,
                            borderRadius:10, padding:'10px 14px',
                            display:'flex', alignItems:'center', gap:10,
                          }}>
                            <div style={{ fontSize:18, flexShrink:0 }}>{TYPE_ICON[e.type]||'📅'}</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:13, fontWeight:700, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.label}</div>
                              <div style={{ display:'flex', gap:8, marginTop:2, flexWrap:'wrap' }}>
                                <span style={pill(e.color,true)}>{e.type}</span>
                                {e.time && <span style={{ fontSize:11, color:C.textDim }}>🕐 {e.time}</span>}
                                {e.location && <span style={{ fontSize:11, color:C.textDim, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📍 {e.location}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                });
              })()
          }
        </div>
      )}
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

  // Referral chain view
  const referralMap = {};
  leads.forEach(l => {
    if (l.referredBy) {
      if (!referralMap[l.referredBy]) referralMap[l.referredBy] = [];
      referralMap[l.referredBy].push(l.name);
    }
  });

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
                    {l.policyFaceAmount&&<span style={pill(C.emerald,true)}>✓ Policy</span>}
                  </div>
                  <div style={{ fontSize:12, color:C.textDim, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {[l.phone,l.email].filter(Boolean).join(' · ')}
                  </div>
                  <div style={{ display:'flex', gap:10, marginTop:4, flexWrap:'wrap' }}>
                    {l.referredBy&&<div style={{ fontSize:11, color:C.teal }}>👤 Ref: {l.referredBy}</div>}
                    {referralMap[l.name]&&<div style={{ fontSize:11, color:C.purple }}>🔗 {referralMap[l.name].length} referral{referralMap[l.name].length!==1?'s':''}</div>}
                    {l.followUp&&<div style={{ fontSize:11, color:C.gold }}>📅 {fmt(l.followUp)}</div>}
                    {daysSince(l.updatedAt)>=3&&!['Closed Won','Closed Lost'].includes(l.status)&&(
                      <div style={{ fontSize:11, color:C.rose }}>{daysSince(l.updatedAt)}d cold</div>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', gap:7, marginLeft:10, flexShrink:0 }}>
                {l.phone&&<a href={'tel:'+l.phone} onClick={e=>e.stopPropagation()} style={{ ...btn(C.gEmerald,true), textDecoration:'none', padding:'8px 11px', fontSize:16 }}>📞</a>}
                {l.phone&&<a href={'sms:'+l.phone} onClick={e=>e.stopPropagation()} style={{ ...btn(C.gSky,true), textDecoration:'none', padding:'8px 11px', fontSize:16 }}>💬</a>}
              </div>
            </div>
          </div>
        ))
      }
    </div>
  );
}

// ─── PAGE: REFERRAL TRACKER ── (sub-view inside contacts, standalone section) ─
function ReferralTracker({ leads, setSelectedContact, isMobile }) {
  const referralTree = {};
  leads.forEach(l => {
    if (!referralTree[l.name]) referralTree[l.name] = { lead:l, referrals:[] };
  });
  leads.forEach(l => {
    if (l.referredBy && referralTree[l.referredBy]) {
      referralTree[l.referredBy].referrals.push(l);
    }
  });
  const topReferrers = Object.values(referralTree).filter(r=>r.referrals.length>0).sort((a,b)=>b.referrals.length-a.referrals.length);
  const noReferrer   = leads.filter(l=>!l.referredBy);

  return (
    <div>
      <div style={{ fontSize:13, fontWeight:700, color:C.teal, letterSpacing:2, marginBottom:14 }}>🔗 REFERRAL CHAIN</div>
      {topReferrers.length===0
        ? <div style={{ fontSize:12, color:C.textDim, textAlign:'center', padding:'20px 0' }}>
            No referrals tracked yet. Open a contact and set "Referred By" to start.
          </div>
        : topReferrers.map(({ lead, referrals })=>(
          <div key={lead.id} style={cardS({ marginBottom:10 })}>
            <div style={{ ...row(), marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }} onClick={()=>setSelectedContact(lead)}>
                <Avatar name={lead.name} size={36}/>
                <div>
                  <div style={{ fontSize:14, fontWeight:800, color:C.text }}>{lead.name}</div>
                  <div style={{ fontSize:11, color:C.textDim }}>Referred {referrals.length} person{referrals.length!==1?'s':''}</div>
                </div>
              </div>
              <span style={pill(C.teal,true)}>{referrals.length} referral{referrals.length!==1?'s':''}</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, paddingLeft:18, borderLeft:'2px solid '+C.teal+'40' }}>
              {referrals.map(r=>(
                <div key={r.id} style={{ ...row(), padding:'6px 10px', background:C.bgAlt, borderRadius:8, cursor:'pointer' }} onClick={()=>setSelectedContact(r)}>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Avatar name={r.name} size={26}/>
                    <div style={{ fontSize:12, fontWeight:600, color:C.text }}>{r.name}</div>
                  </div>
                  <span style={pill(SC[r.status]||C.gray,true)}>{r.status}</span>
                </div>
              ))}
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
                  {l.referredBy&&<div style={{ fontSize:10, color:C.teal, marginTop:3 }}>👤 {l.referredBy}</div>}
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
function Recruits({ recruits, setRecruits, setSelectedContact, isMobile, search, toast }) {
  const [licView, setLicView] = useState(false);
  const [actLog, setActLog]   = useState({}); // { recruitId: [{text,date}] }
  const [logInput, setLogInput] = useState({});
  const filtered=recruits.filter(r=>{ const q=search.toLowerCase(); return !q||r.name?.toLowerCase().includes(q)||r.phone?.includes(q); });

  const addActivity = (id, text) => {
    if (!text.trim()) return;
    setRecruits(p=>p.map(r=>r.id===id?{ ...r, activityLog:[...(r.activityLog||[]),{ text, date:new Date().toISOString() }], updatedAt:new Date().toISOString() }:r));
    setLogInput(p=>({...p,[id]:''}));
    toast('Activity logged');
  };

  return (
    <div className="fade-up">
      <div style={{ ...row(), marginBottom:14, flexWrap:'wrap', gap:10 }}>
        <div style={{ fontSize:isMobile?18:24, fontWeight:900, color:C.text }}>Recruits</div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={()=>setLicView(v=>!v)} style={{ ...btn(licView?C.gGold:undefined,true), opacity:licView?1:0.7 }}>
            {licView?'📋 Licensing View':'📋 Licensing'}
          </button>
          <button className="btn-glow" onClick={()=>setSelectedContact({ id:'new', name:'', phone:'', email:'', status:'Prospect', source:'Other', notes:'', followUp:'', activityLog:[], createdAt:new Date().toISOString(), isRecruit:true })} style={btn(C.gPurple,true)}>
            + Add Recruit
          </button>
        </div>
      </div>

      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:18 }}>
        {RECRUIT_STATUSES.map(s=>{ const cnt=recruits.filter(r=>r.status===s).length; if(!cnt) return null;
          return (<div key={s} style={{ background:(SC[s]||C.gray)+'15', border:'1px solid '+(SC[s]||C.gray)+'30', borderRadius:10, padding:'8px 14px', textAlign:'center' }}>
            <div style={{ fontSize:20, fontWeight:900, color:SC[s]||C.gray }}>{cnt}</div>
            <div style={{ fontSize:10, color:C.textDim, marginTop:1 }}>{s}</div>
          </div>);
        })}
      </div>

      {/* Licensing Progress View */}
      {licView&&(
        <div style={cardS({ marginBottom:18, borderTop:'2px solid '+C.gold })}>
          <div style={{ fontSize:11, fontWeight:700, color:C.gold, letterSpacing:2, marginBottom:16 }}>🏆 LICENSING PROGRESS</div>
          {recruits.filter(r=>r.status==='Licensing'||r.licenseStep).length===0
            ? <div style={{ fontSize:12, color:C.textDim, textAlign:'center', padding:'12px 0' }}>No recruits currently in licensing</div>
            : recruits.filter(r=>r.status==='Licensing'||r.licenseStep).map(r=>{
              const stepIdx = LICENSE_STEPS.indexOf(r.licenseStep||LICENSE_STEPS[0]);
              const pct = ((stepIdx+1)/LICENSE_STEPS.length)*100;
              return (
                <div key={r.id} style={{ marginBottom:16, paddingBottom:16, borderBottom:'1px solid '+C.border }}>
                  <div style={{ ...row(), marginBottom:8 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <Avatar name={r.name} size={30}/>
                      <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{r.name}</div>
                    </div>
                    <select value={r.licenseStep||LICENSE_STEPS[0]}
                      onChange={e=>setRecruits(p=>p.map(x=>x.id===r.id?{...x,licenseStep:e.target.value}:x))}
                      style={{ background:C.gold+'18', border:'1px solid '+C.gold+'40', borderRadius:8, color:C.gold, fontSize:11, fontWeight:700, padding:'4px 8px', cursor:'pointer' }}>
                      {LICENSE_STEPS.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ background:C.border, borderRadius:99, height:6, marginBottom:8 }}>
                    <div style={{ background:C.gGold, borderRadius:99, height:6, width:pct+'%', transition:'width 0.5s ease' }}/>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between' }}>
                    {LICENSE_STEPS.map((s,i)=>(
                      <div key={s} style={{ textAlign:'center', flex:1 }}>
                        <div style={{ width:8, height:8, borderRadius:'50%', background:i<=stepIdx?C.gold:C.border, margin:'0 auto 3px', transition:'background 0.3s' }}/>
                        <div style={{ fontSize:8, color:i<=stepIdx?C.gold:C.textDim, lineHeight:1.3 }}>{s.split(' ')[0]}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {filtered.length===0
        ? <EmptyState icon="🤝" title="No recruits yet" sub="Start building your downline"/>
        : filtered.map(r=>(
          <div key={r.id} style={cardS({ borderLeft:'3px solid '+(SC[r.status]||C.gray) })}>
            <div style={{ ...row(), marginBottom:12 }} onClick={()=>setSelectedContact({...r,isRecruit:true})} className="card-lift" style={{ cursor:'pointer', ...row(), marginBottom:12 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                <Avatar name={r.name} size={42}/>
                <div>
                  <div style={{ ...row('flex-start'), gap:8, marginBottom:4 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:C.text }}>{r.name}</div>
                    <span style={pill(SC[r.status]||C.gray,true)}>{r.status}</span>
                  </div>
                  <div style={{ fontSize:12, color:C.textDim }}>{r.phone}</div>
                  {r.licenseStep&&<div style={{ fontSize:11, color:C.gold, marginTop:2 }}>📋 {r.licenseStep}</div>}
                  {r.followUp&&<div style={{ fontSize:11, color:C.gold, marginTop:3 }}>📅 {fmt(r.followUp)}</div>}
                </div>
              </div>
              {r.phone&&<a href={'tel:'+r.phone} onClick={e=>e.stopPropagation()} style={{ ...btn(C.gEmerald,true), textDecoration:'none', padding:'8px 11px', fontSize:16 }}>📞</a>}
            </div>

            {/* Activity log for recruit */}
            <div style={{ borderTop:'1px solid '+C.border, paddingTop:10 }}>
              <div style={{ fontSize:11, color:C.textDim, marginBottom:6, fontWeight:600 }}>ACTIVITY LOG</div>
              {(r.activityLog||[]).slice(-3).reverse().map((a,i)=>(
                <div key={i} style={{ fontSize:11, color:C.textSub, padding:'4px 0', borderBottom:'1px solid '+C.border+'60' }}>
                  {a.text} <span style={{ color:C.textDim }}>· {fmt(a.date)}</span>
                </div>
              ))}
              <div style={{ display:'flex', gap:6, marginTop:8 }}>
                <input value={logInput[r.id]||''} onChange={e=>setLogInput(p=>({...p,[r.id]:e.target.value}))}
                  onKeyDown={e=>e.key==='Enter'&&addActivity(r.id,logInput[r.id]||'')}
                  placeholder='Log activity (calls, FNAs, updates)...' style={{ ...inp(), flex:1, fontSize:12, padding:'7px 10px' }}/>
                <button onClick={()=>addActivity(r.id,logInput[r.id]||'')} style={{ ...btn(C.gPurple,true), padding:'7px 12px', fontSize:12 }}>Log</button>
              </div>
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
  const [form, setForm]       = useState({ name:'', status:'Active', fna:'', recruits:'', overridePct:'' });

  const save = () => {
    if (!form.name.trim()) return;
    setTeam(p=>[...p,{ ...form, id:Date.now() }]);
    setForm({ name:'', status:'Active', fna:'', recruits:'', overridePct:'' });
    setShowAdd(false);
    toast('Rep added to your team');
  };

  const totalOverrideEst = team.reduce((sum,r)=>sum+Number(r.overrideEarned||0),0);

  return (
    <div className="fade-up">
      <div style={{ ...row(), marginBottom:18 }}>
        <div>
          <div style={{ fontSize:isMobile?18:24, fontWeight:900, color:C.text }}>My Team</div>
          {totalOverrideEst>0&&<div style={{ fontSize:12, color:C.emerald, marginTop:3 }}>+{fmtCur(totalOverrideEst)} override income tracked</div>}
        </div>
        <button className="btn-glow" onClick={()=>setShowAdd(true)} style={btn(C.gPurple,true)}>+ Add Rep</button>
      </div>
      {showAdd&&(
        <div style={cardS({ marginBottom:18 })}>
          <div style={{ fontSize:13, fontWeight:700, color:C.purple, marginBottom:14 }}>New Team Member</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div><div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>REP NAME</div>
              <input autoFocus value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&save()} placeholder='Full name' style={inp()}/></div>
            <div><div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>STATUS</div>
              <select value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))} style={{ ...inp(), cursor:'pointer' }}>
                {['Active','In Training','Licensed','Inactive'].map(s=><option key={s}>{s}</option>)}
              </select></div>
            <div><div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>FNAs THIS MONTH</div>
              <input type='number' value={form.fna} onChange={e=>setForm(f=>({...f,fna:e.target.value}))} placeholder='0' style={inp()}/></div>
            <div><div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>RECRUITS THIS MONTH</div>
              <input type='number' value={form.recruits} onChange={e=>setForm(f=>({...f,recruits:e.target.value}))} placeholder='0' style={inp()}/></div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={save} style={btn(C.gEmerald,true)}>Save Rep</button>
            <button onClick={()=>setShowAdd(false)} style={{ background:C.border, border:'none', borderRadius:9, color:C.text, padding:'7px 15px', fontSize:12, fontWeight:700, cursor:'pointer' }}>Cancel</button>
          </div>
        </div>
      )}
      {team.length===0
        ? <EmptyState icon="📋" title="No team members yet" sub="Add your licensed reps to track their activity and override income"/>
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
                  {/* Override income tracking */}
                  <div style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>OVERRIDE EARNED ($)</div>
                    <input type='number' value={rep.overrideEarned||''} onChange={e=>setTeam(p=>p.map(r=>r.id===rep.id?{...r,overrideEarned:e.target.value}:r))}
                      placeholder='0' style={{ ...inp(), fontSize:12, padding:'7px 10px' }}/>
                  </div>
                  {rep.overrideEarned>0&&(
                    <div style={{ background:'#07180f', border:'1px solid '+C.emerald+'30', borderRadius:10, padding:'8px 12px', marginBottom:10, textAlign:'center' }}>
                      <div style={{ fontSize:18, fontWeight:900, color:C.emerald }}>{fmtCur(rep.overrideEarned)}</div>
                      <div style={{ fontSize:10, color:C.textDim }}>override income</div>
                    </div>
                  )}
                  <button onClick={()=>{ setTeam(p=>p.filter(r=>r.id!==rep.id)); toast('Rep removed','error'); }}
                    style={{ background:'none', border:'none', color:C.textDim, fontSize:11, cursor:'pointer', padding:0 }}>Remove</button>
                </div>
              );
            })}
          </div>
      }

      {team.length>0&&(
        <div style={cardS({ marginTop:16, borderTop:'2px solid '+C.emerald })}>
          <div style={{ fontSize:11, fontWeight:700, color:C.emerald, letterSpacing:2, marginBottom:10 }}>💰 TOTAL OVERRIDE INCOME</div>
          <div style={{ fontSize:36, fontWeight:900, color:C.emerald }}>{fmtCur(totalOverrideEst)}</div>
          <div style={{ fontSize:12, color:C.textDim, marginTop:4 }}>Across {team.length} rep{team.length!==1?'s':''}</div>
        </div>
      )}
    </div>
  );
}

// ─── PAGE: COMMISSION + EXPENSES ─────────────────────────────────────────────
function Commission({ sales, setSales, expenses, setExpenses, isMobile, toast }) {
  const [showModal, setShowModal]   = useState(false);
  const [showExpense, setShowExp]   = useState(false);
  const [expForm, setExpForm]       = useState({ description:'', amount:'', category:'Gas', date:new Date().toISOString().split('T')[0] });
  const [levelIdx, setLevelIdx]     = useState(() => { try { return JSON.parse(localStorage.getItem('joshlevel'))||0; } catch { return 0; } });
  const [view, setView]             = useState('month');

  useEffect(() => { localStorage.setItem('joshlevel', JSON.stringify(levelIdx)); }, [levelIdx]);

  const EXPENSE_CATS = ['Gas','Licensing Fee','Training','Marketing','Technology','Meals','Other'];

  const commPct  = PRIMERICA_LEVELS[levelIdx]?.pct||25;
  const cutoff   = view==='week'?startOfWeek():view==='month'?startOfMon():startOfYear();
  const filtered = sales.filter(s=>new Date(s.date)>=cutoff);
  const filteredExp = expenses.filter(e=>new Date(e.date)>=cutoff);
  const totalEarned  = filtered.reduce((sum,s)=>sum+(s.commission||0),0);
  const totalVol     = filtered.reduce((sum,s)=>sum+(Number(s.monthlyPremium)*12||0),0);
  const totalExpenses= filteredExp.reduce((sum,e)=>sum+(Number(e.amount)||0),0);
  const allTime      = sales.reduce((sum,s)=>sum+(s.commission||0),0);
  const allTimeExp   = expenses.reduce((sum,e)=>sum+(Number(e.amount)||0),0);
  const vLabel = { week:'This Week', month:'This Month', year:'This Year' };

  const saveExpense = () => {
    if (!expForm.description.trim()||!expForm.amount) return;
    setExpenses(p=>[...p,{ ...expForm, id:Date.now() }]);
    setExpForm({ description:'', amount:'', category:'Gas', date:new Date().toISOString().split('T')[0] });
    setShowExp(false);
    toast('Expense logged');
  };

  return (
    <div className="fade-up">
      <div style={{ ...row(), marginBottom:20, flexWrap:'wrap', gap:10 }}>
        <div style={{ fontSize:isMobile?18:24, fontWeight:900, color:C.text }}>Money</div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn-glow" onClick={()=>setShowExp(true)} style={btn(C.gRose,true)}>− Log Expense</button>
          <button className="btn-glow" onClick={()=>setShowModal(true)} style={btn(C.gEmerald,true)}>+ Log Sale</button>
        </div>
      </div>

      {allTime>0&&(
        <div style={cardS({ background:'linear-gradient(135deg,#07180f,#0a1a0d)', borderColor:C.emerald+'30', textAlign:'center', padding:26 })}>
          <div style={{ fontSize:11, color:C.textDim, letterSpacing:2, marginBottom:6 }}>ALL-TIME EARNINGS</div>
          <div style={{ fontSize:46, fontWeight:900, color:C.emerald, lineHeight:1 }}>{fmtCur(allTime)}</div>
          {allTimeExp>0&&<div style={{ fontSize:12, color:C.rose, marginTop:4 }}>−{fmtCur(allTimeExp)} expenses · Net: {fmtCur(allTime-allTimeExp)}</div>}
          <div style={{ fontSize:12, color:C.textSub, marginTop:4 }}>{sales.length} sale{sales.length!==1?'s':''} logged</div>
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

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(120px,1fr))', gap:12, marginBottom:20 }}>
        <StatCard label="EARNED"    value={fmtCur(totalEarned)}  color={C.emerald}/>
        <StatCard label="SALES"     value={filtered.length}      color={C.blue}/>
        <StatCard label="EXPENSES"  value={fmtCur(totalExpenses)} color={C.rose}/>
        <StatCard label="NET"       value={fmtCur(totalEarned-totalExpenses)} color={totalEarned-totalExpenses>=0?C.gold:C.rose}/>
      </div>

      {sales.length>0&&<CommissionChart sales={sales}/>}

      {/* Expense Log */}
      {showExpense&&(
        <div style={cardS({ borderTop:'2px solid '+C.rose, marginBottom:18 })}>
          <div style={{ fontSize:13, fontWeight:700, color:C.rose, marginBottom:14 }}>Log Expense</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
            <div><div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>DESCRIPTION</div>
              <input autoFocus value={expForm.description} onChange={e=>setExpForm(f=>({...f,description:e.target.value}))} placeholder='What was it for?' style={inp()}/></div>
            <div><div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>AMOUNT ($)</div>
              <input type='number' value={expForm.amount} onChange={e=>setExpForm(f=>({...f,amount:e.target.value}))} placeholder='0.00' style={inp()}/></div>
            <div><div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>CATEGORY</div>
              <select value={expForm.category} onChange={e=>setExpForm(f=>({...f,category:e.target.value}))} style={{ ...inp(), cursor:'pointer' }}>
                {EXPENSE_CATS.map(c=><option key={c}>{c}</option>)}
              </select></div>
            <div><div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>DATE</div>
              <input type='date' value={expForm.date} onChange={e=>setExpForm(f=>({...f,date:e.target.value}))} style={inp()}/></div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={saveExpense} style={btn(C.gRose,true)}>Save Expense</button>
            <button onClick={()=>setShowExp(false)} style={{ background:C.border, border:'none', borderRadius:9, color:C.text, padding:'7px 15px', fontSize:12, fontWeight:700, cursor:'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Expense list */}
      {filteredExp.length>0&&(
        <div style={cardS()}>
          <div style={{ fontSize:11, fontWeight:700, color:C.rose, letterSpacing:2, marginBottom:14 }}>EXPENSES · {vLabel[view].toUpperCase()}</div>
          {filteredExp.slice().reverse().map(e=>(
            <div key={e.id} style={{ ...row(), padding:'10px 0', borderBottom:'1px solid '+C.border }}>
              <div>
                <div style={{ fontSize:13, fontWeight:600, color:C.text }}>{e.description}</div>
                <div style={{ fontSize:11, color:C.textDim }}>{e.category} · {fmt(e.date)}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ fontSize:16, fontWeight:800, color:C.rose }}>−{fmtCur(e.amount)}</div>
                <button onClick={()=>{ setExpenses(p=>p.filter(x=>x.id!==e.id)); toast('Expense removed','error'); }}
                  style={{ background:'none', border:'none', color:C.textDim, cursor:'pointer', fontSize:11 }}>×</button>
              </div>
            </div>
          ))}
          <div style={{ ...row(), paddingTop:10 }}>
            <div style={{ fontSize:12, color:C.textSub }}>Total expenses</div>
            <div style={{ fontSize:16, fontWeight:800, color:C.rose }}>−{fmtCur(totalExpenses)}</div>
          </div>
        </div>
      )}

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

// ─── PAGE: SCRIPTS ────────────────────────────────────────────────────────────
function Scripts({ scripts, setScripts, isMobile, toast }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ title:'', objection:'', response:'', category:'Objection' });
  const [search, setSearch]   = useState('');
  const [catFilter, setCat]   = useState('All');

  const CATS = ['Objection','Opening','Follow-Up','Closing','Recruiting'];
  const CAT_COLORS = { 'Objection':C.rose,'Opening':C.blue,'Follow-Up':C.gold,'Closing':C.emerald,'Recruiting':C.purple };

  const DEFAULT_SCRIPTS = [
    { id:'d1', title:'Too busy right now', objection:'I don\'t have time right now', response:'I totally get it — that\'s actually why I\'m calling. Most of the families I work with said the same thing, and what we do takes about 45 minutes. When\'s a better time, morning or evening?', category:'Objection' },
    { id:'d2', title:'I need to think about it', objection:'I need to think about it', response:'Of course! What is it specifically you\'re thinking about? Because usually when people say that, there\'s a specific concern I can help clear up right now.', category:'Objection' },
    { id:'d3', title:'Can\'t afford it', objection:'It\'s too expensive / I can\'t afford it', response:'I understand — that\'s exactly why we do the FNA. Most people find they\'re paying more for less coverage than they think. Let\'s just look at the numbers together, no pressure.', category:'Objection' },
    { id:'d4', title:'Opening call', objection:'', response:'Hey [Name], this is Josh Torres — I\'m a rep with Primerica and I work specifically with families in the Miami area on their financial protection. I was referred by [Referrer] and just wanted to reach out. Do you have about 2 minutes?', category:'Opening' },
    { id:'d5', title:'Recruit opener', objection:'', response:'Hey [Name], I\'m not sure if you\'ve ever considered earning extra income on the side, but I work with a financial company that\'s expanding in Miami. We\'re looking for motivated people — it\'s not sales per se, it\'s more education-based. Would you be open to just hearing what we do?', category:'Recruiting' },
  ];

  const allScripts = [...DEFAULT_SCRIPTS, ...scripts];
  const filtered   = allScripts.filter(s=>{
    const q = search.toLowerCase();
    const matchQ = !q||s.title.toLowerCase().includes(q)||s.response.toLowerCase().includes(q)||s.objection?.toLowerCase().includes(q);
    const matchC = catFilter==='All'||s.category===catFilter;
    return matchQ&&matchC;
  });

  const [expanded, setExpanded] = useState(null);
  const [copied, setCopied]     = useState(null);

  const copy = (id, text) => {
    navigator.clipboard?.writeText(text).catch(()=>{});
    setCopied(id);
    setTimeout(()=>setCopied(null),2000);
    toast('Script copied to clipboard!');
  };

  const save = () => {
    if (!form.title.trim()||!form.response.trim()) return;
    setScripts(p=>[...p,{ ...form, id:Date.now() }]);
    setForm({ title:'', objection:'', response:'', category:'Objection' });
    setShowAdd(false);
    toast('Script saved!');
  };

  return (
    <div className="fade-up">
      <div style={{ ...row(), marginBottom:18, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:isMobile?18:24, fontWeight:900, color:C.text }}>Script Cards</div>
          <div style={{ fontSize:12, color:C.textDim, marginTop:3 }}>Your best objection responses · Tap to expand</div>
        </div>
        <button className="btn-glow" onClick={()=>setShowAdd(true)} style={btn(C.gPurple,true)}>+ Add Script</button>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:14, flexWrap:'wrap' }}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder='Search scripts...' style={{ ...inp(), flex:1, minWidth:160, fontSize:12, padding:'8px 12px' }}/>
        {['All',...CATS].map(c=>(
          <button key={c} onClick={()=>setCat(c)} style={{
            padding:'5px 12px', borderRadius:9, fontSize:11, fontWeight:700, cursor:'pointer', border:'none',
            background:catFilter===c?(CAT_COLORS[c]||C.blue)+'22':'none',
            color:catFilter===c?(CAT_COLORS[c]||C.blue):C.textDim,
            outline:catFilter===c?'1px solid '+(CAT_COLORS[c]||C.blue)+'50':'none',
          }}>{c}</button>
        ))}
      </div>

      {showAdd&&(
        <div style={cardS({ borderTop:'2px solid '+C.purple, marginBottom:18 })}>
          <div style={{ fontSize:13, fontWeight:700, color:C.purple, marginBottom:14 }}>New Script Card</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div><div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>TITLE</div>
              <input autoFocus value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder='Short name' style={inp()}/></div>
            <div><div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>CATEGORY</div>
              <select value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} style={{ ...inp(), cursor:'pointer' }}>
                {CATS.map(c=><option key={c}>{c}</option>)}
              </select></div>
          </div>
          <div style={{ marginBottom:10 }}>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>OBJECTION / TRIGGER (optional)</div>
            <input value={form.objection} onChange={e=>setForm(f=>({...f,objection:e.target.value}))} placeholder='When they say...' style={inp()}/>
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, color:C.textDim, marginBottom:4 }}>YOUR RESPONSE</div>
            <textarea value={form.response} onChange={e=>setForm(f=>({...f,response:e.target.value}))} rows={4} style={{ ...inp(), resize:'vertical' }} placeholder='Your best response...'/>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={save} style={btn(C.gPurple,true)}>Save Script</button>
            <button onClick={()=>setShowAdd(false)} style={{ background:C.border, border:'none', borderRadius:9, color:C.text, padding:'7px 15px', fontSize:12, fontWeight:700, cursor:'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {filtered.length===0
        ? <EmptyState icon="📝" title="No scripts match" sub="Try a different search or add your own"/>
        : filtered.map(s=>{
          const color = CAT_COLORS[s.category]||C.blue;
          const isExp = expanded===s.id;
          return (
            <div key={s.id} style={cardS({ borderLeft:'3px solid '+color, cursor:'pointer', marginBottom:10 })} onClick={()=>setExpanded(isExp?null:s.id)}>
              <div style={row()}>
                <div style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
                  <div style={{ width:32, height:32, borderRadius:8, background:color+'20', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, flexShrink:0 }}>
                    {s.category==='Objection'?'🛡️':s.category==='Opening'?'📞':s.category==='Recruiting'?'🤝':s.category==='Closing'?'✅':'🔁'}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:C.text }}>{s.title}</div>
                    {s.objection&&<div style={{ fontSize:11, color:C.textDim, marginTop:1, fontStyle:'italic' }}>"{s.objection}"</div>}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={pill(color,true)}>{s.category}</span>
                  <span style={{ color:C.textDim, fontSize:14 }}>{isExp?'▲':'▼'}</span>
                </div>
              </div>
              {isExp&&(
                <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid '+C.border }}>
                  <div style={{ fontSize:14, color:C.text, lineHeight:1.75, background:color+'0c', borderRadius:10, padding:'14px 16px', marginBottom:10 }}>
                    {s.response}
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={e=>{ e.stopPropagation(); copy(s.id,s.response); }}
                      style={{ ...btn(copied===s.id?C.gEmerald:C.gBlue,true) }}>
                      {copied===s.id?'✓ Copied':'Copy'}
                    </button>
                    {!s.id.toString().startsWith('d')&&(
                      <button onClick={e=>{ e.stopPropagation(); setScripts(p=>p.filter(x=>x.id!==s.id)); toast('Script removed','error'); }}
                        style={{ background:'none', border:'none', color:C.textDim, fontSize:12, cursor:'pointer', padding:'7px 12px' }}>Remove</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })
      }
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
  const [fnas,     setFnas,     fnasSynced]     = useCloudState('fnas',     []);
  const [expenses, setExpenses, expSynced]      = useCloudState('expenses', []);
  const [scripts,  setScripts,  scriptsSynced]  = useCloudState('scripts',  []);

  const allSynced = leadsSynced && recruitsSynced && goalsSynced && todosSynced && teamSynced && salesSynced && fnasSynced && expSynced && scriptsSynced;
  const [toasts, toast] = useToast();

  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedContact, setSelectedContact] = useState(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = INJECT_STYLES;
    document.head.appendChild(style);
    migrateIfNeeded().then(migrated => { if (migrated) window.location.reload(); });
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
    fna:      leads.filter(l=>l.status==='FNA Scheduled').length + fnas.filter(f=>f.status==='Scheduled').length,
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

  // Nav items — split between main and more on mobile
  const MOBILE_MAIN = ['dashboard','contacts','pipeline','commission','fna'];
  const MOBILE_MORE = NAV.filter(n=>!MOBILE_MAIN.includes(n.id));

  function NavBtn({ id, label, icon, extra }) {
    const active = tab===id;
    return (
      <button onClick={()=>setTab(id)} className="nav-hover" style={{
        background:!isMobile&&active?C.blue+'18':'transparent',
        border:'none', cursor:'pointer',
        padding:isMobile?'7px 8px':'12px 22px',
        display:'flex', flexDirection:isMobile?'column':'row',
        alignItems:'center', gap:isMobile?3:12,
        color:active?C.blue:C.textSub, fontWeight:active?700:400,
        borderLeft:!isMobile?(active?'3px solid '+C.blue:'3px solid transparent'):'none',
        width:isMobile?'auto':'100%', fontSize:isMobile?9:13,
        borderRadius:isMobile?10:0, letterSpacing:0.2, position:'relative',
      }}>
        <span style={{ fontSize:isMobile?19:16 }}>{icon}</span>
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

  return (
    <div style={{ background:C.bg, minHeight:'100vh', color:C.text }}>

      {!isMobile&&(
        <div style={{ width:SW, minHeight:'100vh', background:C.card, borderRight:'1px solid '+C.border,
          position:'fixed', left:0, top:0, bottom:0, display:'flex', flexDirection:'column', zIndex:100, overflowY:'auto' }}>
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

        {isMobile&&(
          <div style={{ ...row(), marginBottom:16 }}>
            <div style={{ fontSize:16, fontWeight:900, color:C.text }}>Command Center</div>
            <SyncBadge synced={allSynced}/>
          </div>
        )}

        {tab==='dashboard'  && <Dashboard  stats={stats} todos={todos} setTodos={setTodos} coldLeads={coldLeads} followUps={followUps} setSelectedContact={setSelectedContact} sales={sales} leads={leads} recruits={recruits} setTab={setTab} {...shared}/>}
        {tab==='contacts'   && <Contacts   leads={leads} setLeads={setLeads} search={search} setSearch={setSearch} statusFilter={statusFilter} setStatusFilter={setStatusFilter} filteredLeads={filteredLeads} setSelectedContact={setSelectedContact} {...shared}/>}
        {tab==='pipeline'   && <Pipeline   leads={leads} setSelectedContact={setSelectedContact} {...shared}/>}
        {tab==='fna'        && <FNATracker fnas={fnas} setFnas={setFnas} leads={leads} setSelectedContact={setSelectedContact} {...shared}/>}
        {tab==='calendar'   && <AppointmentCalendar leads={leads} recruits={recruits} fnas={fnas} {...shared}/>}
        {tab==='recruits'   && <Recruits   recruits={recruits} setRecruits={setRecruits} setSelectedContact={setSelectedContact} search={search} {...shared}/>}
        {tab==='team'       && <Team       team={team} setTeam={setTeam} {...shared}/>}
        {tab==='commission' && <Commission sales={sales} setSales={setSales} expenses={expenses} setExpenses={setExpenses} {...shared}/>}
        {tab==='goals'      && <Goals      stats={stats} goals={goals} setGoals={setGoals} sales={sales} leads={leads} recruits={recruits} {...shared}/>}
        {tab==='scripts'    && <Scripts    scripts={scripts} setScripts={setScripts} {...shared}/>}
      </div>

      {isMobile&&(
        <div style={{ position:'fixed', bottom:0, left:0, right:0, height:68, background:C.card,
          borderTop:'1px solid '+C.border, display:'flex', alignItems:'center',
          justifyContent:'space-around', zIndex:100, paddingBottom:2 }}>
          {MOBILE_MAIN.map(id=>{ const n=NAV.find(x=>x.id===id); return n?<NavBtn key={id} id={id} label={n.label} icon={n.icon} extra={id==='dashboard'?alertCount:0}/>:null; })}
          <button onClick={()=>setMoreOpen(v=>!v)} className="nav-hover"
            style={{ background:'transparent', border:'none', cursor:'pointer',
              display:'flex', flexDirection:'column', alignItems:'center', gap:3,
              color:MOBILE_MORE.map(n=>n.id).includes(tab)?C.blue:C.textSub, fontSize:9, padding:'7px 8px', borderRadius:10 }}>
            <span style={{ fontSize:19 }}>⋯</span>
            <span style={{ fontWeight:MOBILE_MORE.map(n=>n.id).includes(tab)?700:400 }}>More</span>
          </button>
        </div>
      )}

      {isMobile&&moreOpen&&(
        <>
          <div onClick={()=>setMoreOpen(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:190 }}/>
          <div style={{ position:'fixed', bottom:68, left:0, right:0, background:C.card,
            borderTop:'1px solid '+C.border, borderRadius:'20px 20px 0 0', zIndex:200, padding:'20px 16px 8px' }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8 }}>
              {MOBILE_MORE.map(n=>(
                <button key={n.id} onClick={()=>{ setTab(n.id); setMoreOpen(false); }}
                  style={{ background:tab===n.id?C.blue+'20':'none', border:'1px solid '+(tab===n.id?C.blue+'40':C.border),
                    borderRadius:12, padding:'14px 8px', display:'flex', flexDirection:'column',
                    alignItems:'center', gap:6, cursor:'pointer', color:tab===n.id?C.blue:C.textSub,
                    fontSize:11, fontWeight:tab===n.id?700:400 }}>
                  <span style={{ fontSize:24 }}>{n.icon}</span><span>{n.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {selectedContact&&(
        <ContactModal contact={selectedContact} isRecruit={!!selectedContact.isRecruit}
          leads={[...leads,...recruits]}
          onClose={()=>setSelectedContact(null)}
          onSave={selectedContact.isRecruit?saveRecruit:saveContact}
          onDelete={selectedContact.isRecruit?deleteRecruit:deleteContact}/>
      )}

      <Toast toasts={toasts}/>
    </div>
  );
}
