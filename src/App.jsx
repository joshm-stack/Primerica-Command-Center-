import { useState, useEffect, useRef } from 'react';

// ─── THEME ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#070b12', card: '#0d1829', border: '#1a3050', borderLight: '#1e3a5f',
  cyan: '#06b6d4', purple: '#8b5cf6', green: '#10b981', amber: '#f59e0b',
  orange: '#f97316', red: '#ef4444', gray: '#64748b',
  text: '#f1f5f9', textSub: '#94a3b8', textMuted: '#475569',
  gradCyan: 'linear-gradient(135deg,#06b6d4,#0ea5e9)',
  gradPurple: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
  gradGreen: 'linear-gradient(135deg,#10b981,#059669)',
  gradAmber: 'linear-gradient(135deg,#f59e0b,#f97316)',
  gradDark: 'linear-gradient(135deg,#0d1829,#0a1520)',
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const LEAD_STATUSES = ['New','Contacted','FNA Scheduled','Presented','Follow Up','Closed Won','Closed Lost'];
const RECRUIT_STATUSES = ['Prospect','Invited','Interviewed','Licensing','Licensed','Active','Dropped'];
const SOURCES = ['Social Media','Referral','Cold Outreach','Event','Walk-in','Other'];

const STATUS_COLOR = {
  'New': C.cyan, 'Contacted': C.purple, 'FNA Scheduled': C.amber,
  'Presented': '#3b82f6', 'Follow Up': C.orange, 'Closed Won': C.green, 'Closed Lost': C.gray,
  'Prospect': C.cyan, 'Invited': C.purple, 'Interviewed': C.amber,
  'Licensing': C.orange, 'Licensed': '#3b82f6', 'Active': C.green, 'Dropped': C.gray,
};

const NAV = [
  { id: 'dashboard', label: 'Home', icon: '⬛' },
  { id: 'contacts', label: 'Contacts', icon: '👥' },
  { id: 'pipeline', label: 'Pipeline', icon: '🔄' },
  { id: 'recruits', label: 'Recruits', icon: '🤝' },
  { id: 'coach', label: 'AI Coach', icon: '🤖' },
  { id: 'team', label: 'Team', icon: '📋' },
  { id: 'commission', label: 'Commission', icon: '💰' },
  { id: 'content', label: 'Content', icon: '📱' },
  { id: 'goals', label: 'Goals', icon: '🎯' },
];

const MOBILE_NAV = ['dashboard','contacts','pipeline','coach','more'];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function useLS(key, def) {
  const [v, setV] = useState(() => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; } });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }, [key, v]);
  return [v, setV];
}

async function callClaude(messages, system) {
  try {
    const r = await fetch('/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1000, system, messages }),
    });
    const d = await r.json();
    if (d.error) return 'Error: ' + JSON.stringify(d.error);
    return d.content?.[0]?.text || 'No response.';
  } catch (e) { return 'Error: ' + e.message; }
}

function parseVCard(text) {
  const contacts = [];
  const cards = text.split('END:VCARD');
  cards.forEach(card => {
    const name = (card.match(/FN:(.+)/)?.[1] || '').trim();
    const phone = (card.match(/TEL[^:]*:(.+)/)?.[1] || '').trim().replace(/\s/g,'');
    const email = (card.match(/EMAIL[^:]*:(.+)/)?.[1] || '').trim();
    if (name) contacts.push({ id: Date.now() + Math.random(), name, phone, email, status: 'New', source: 'Import', notes: '', followUp: '', activityLog: [], createdAt: new Date().toISOString() });
  });
  return contacts;
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr)) / 86400000);
}

function fmt(date) { return date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''; }

// ─── STYLE HELPERS ───────────────────────────────────────────────────────────
const pill = (color) => ({ background: color + '22', color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, display: 'inline-block' });
const btn = (grad, sm) => ({ background: grad || C.gradCyan, border: 'none', borderRadius: 8, color: '#fff', padding: sm ? '7px 14px' : '10px 20px', fontSize: sm ? 12 : 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' });
const inp = { background: '#070b12', border: '1px solid ' + C.border, borderRadius: 8, color: C.text, padding: '10px 13px', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none' };
const card = { background: C.card, border: '1px solid ' + C.border, borderRadius: 14, padding: 18, marginBottom: 14 };
const row = (jc) => ({ display: 'flex', alignItems: 'center', justifyContent: jc || 'space-between' });

// ─── SUB COMPONENTS ──────────────────────────────────────────────────────────
function StatCard({ label, value, color, sub }) {
  return (
    <div style={{ ...card, borderLeft: '3px solid ' + color, padding: '16px 18px', marginBottom: 0, flex: 1, minWidth: 120 }}>
      <div style={{ fontSize: 30, fontWeight: 800, color }}>{value}</div>
      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ContactModal({ contact, onClose, onSave, onDelete }) {
  const [c, setC] = useState({ ...contact });
  const [note, setNote] = useState('');
  const upd = (k, v) => setC(prev => ({ ...prev, [k]: v }));
  const addNote = () => {
    if (!note.trim()) return;
    const log = [...(c.activityLog || []), { type: 'Note', text: note, date: new Date().toISOString() }];
    setC(prev => ({ ...prev, activityLog: log }));
    setNote('');
  };
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <div style={{ background: C.card, border: '1px solid ' + C.border, borderRadius: '20px 20px 0 0', width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto', padding: 24 }}>
        <div style={{ ...row(), marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.text }}>{c.name || 'New Contact'}</div>
            <div style={{ fontSize: 12, color: C.gray }}>{c.source} · Added {fmt(c.createdAt)}</div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {c.phone && <a href={'tel:' + c.phone} style={{ ...btn(C.gradGreen, true), textDecoration: 'none' }}>📞 Call</a>}
            {c.phone && <a href={'sms:' + c.phone} style={{ ...btn(C.gradCyan, true), textDecoration: 'none' }}>💬 Text</a>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          {[['name','Name'],['phone','Phone'],['email','Email'],['followUp','Follow-up','date']].map(([k,label,type]) => (
            <div key={k}>
              <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>{label}</div>
              <input type={type||'text'} value={c[k]||''} onChange={e => upd(k, e.target.value)} style={inp} />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>Status</div>
            <select value={c.status} onChange={e => upd('status', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              {LEAD_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>Source</div>
            <select value={c.source||'Other'} onChange={e => upd('source', e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              {SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>Notes</div>
          <textarea value={c.notes||''} onChange={e => upd('notes', e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' }} />
        </div>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, marginBottom: 10 }}>ACTIVITY LOG</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder='Log a call, note, or update...' style={{ ...inp, flex: 1 }} />
            <button onClick={addNote} style={btn(C.gradPurple, true)}>+ Log</button>
          </div>
          <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(c.activityLog || []).slice().reverse().map((a, i) => (
              <div key={i} style={{ background: '#070b12', borderRadius: 8, padding: '8px 12px', border: '1px solid ' + C.border }}>
                <div style={{ fontSize: 12, color: C.text }}>{a.text}</div>
                <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>{fmt(a.date)}</div>
              </div>
            ))}
            {!(c.activityLog?.length) && <div style={{ fontSize: 12, color: C.textMuted, textAlign: 'center', padding: 16 }}>No activity yet</div>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => onSave(c)} style={{ ...btn(C.gradGreen), flex: 1 }}>Save Contact</button>
          <button onClick={onClose} style={{ ...btn('none'), flex: 1, background: C.border, color: C.text }}>Cancel</button>
          {contact.id && <button onClick={() => onDelete(contact.id)} style={btn(C.red + '44', true)}>Delete</button>}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useLS('joshtab', 'dashboard');
  const [moreOpen, setMoreOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [leads, setLeads] = useLS('joshleads2', []);
  const [recruits, setRecruits] = useLS('joshrecruits2', []);
  const [content, setContent] = useLS('joshcontent2', []);
  const [goals, setGoals] = useLS('joshgoals2', { fna: 10, recruits: 4, premium: 5000, why: 'My daughter and my family' });
  const [todos, setTodos] = useLS('joshtodos2', []);
  const [team, setTeam] = useLS('joshteam', []);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedContact, setSelectedContact] = useState(null);
  const [showAddLead, setShowAddLead] = useState(false);
  const [newTodo, setNewTodo] = useState('');
  const [coachMode, setCoachMode] = useState('script');
  const [aiInput, setAiInput] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState([]);
  const [practiceInput, setPracticeInput] = useState('');
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [contentPrompt, setContentPrompt] = useState('');
  const [contentAiOut, setContentAiOut] = useLS('joshcontentai2', '');
  const [contentAiLoading, setContentAiLoading] = useState(false);
  const [premium, setPremium] = useState(1000);
  const [showAddContent, setShowAddContent] = useState(false);
  const [newContent, setNewContent] = useState({ platform: 'Instagram', type: 'Reel', caption: '', status: 'Draft', date: '' });
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', status: 'Active', fna: 0, recruits: 0 });
  const [showRecruit, setShowRecruit] = useState(false);
  const practiceEnd = useRef(null);

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => { practiceEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [practiceHistory]);

  const today = new Date().toISOString().split('T')[0];
  const followUps = [...leads, ...recruits].filter(l => l.followUp === today);
  const coldLeads = leads.filter(l => daysSince(l.updatedAt) >= 3 && !['Closed Won','Closed Lost'].includes(l.status));
  const stats = {
    leads: leads.length,
    fna: leads.filter(l => l.status === 'FNA Scheduled').length,
    won: leads.filter(l => l.status === 'Closed Won').length,
    licensed: recruits.filter(r => ['Licensed','Active'].includes(r.status)).length,
  };

  const filteredLeads = leads.filter(l => {
    const q = search.toLowerCase();
    const match = !q || l.name?.toLowerCase().includes(q) || l.phone?.includes(q) || l.email?.toLowerCase().includes(q);
    const sf = statusFilter === 'All' || l.status === statusFilter;
    return match && sf;
  });

  function saveContact(c) {
    const updated = { ...c, updatedAt: new Date().toISOString() };
    if (!c.id || c.id === 'new') {
      updated.id = Date.now();
      updated.createdAt = new Date().toISOString();
      setLeads(prev => [updated, ...prev]);
    } else {
      setLeads(prev => prev.map(l => l.id === c.id ? updated : l));
    }
    setSelectedContact(null);
    setShowAddLead(false);
  }

  function deleteContact(id) {
    setLeads(prev => prev.filter(l => l.id !== id));
    setSelectedContact(null);
  }

  function saveRecruit(c) {
    const updated = { ...c, updatedAt: new Date().toISOString() };
    if (!c.id || c.id === 'new') {
      updated.id = Date.now();
      updated.createdAt = new Date().toISOString();
      setRecruits(prev => [updated, ...prev]);
    } else {
      setRecruits(prev => prev.map(r => r.id === c.id ? updated : r));
    }
    setSelectedContact(null);
    setShowRecruit(false);
  }

  function importVCard(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const contacts = parseVCard(ev.target.result);
      setLeads(prev => [...contacts, ...prev]);
      alert(contacts.length + ' contacts imported!');
    };
    reader.readAsText(file);
  }

  async function handleAI() {
    if (!aiInput.trim()) return;
    setAiLoading(true); setAiOutput('');
    const sys = {
      script: 'You are a Primerica coach for Josh Torres, a licensed rep in Miami. Write a short natural outreach script under 120 words to set an FNA appointment. Sound human, not salesy.',
      objection: 'You are a Primerica sales coach for Josh Torres in Miami. Write a confident 2-3 sentence response to this objection. Acknowledge it, pivot, and reopen the door.',
      caption: 'You are @JoshMiami social media strategist. Write a fire Instagram caption with emojis and CTA under 100 words. Miami energy, aspirational, real.',
    };
    setAiOutput(await callClaude([{ role: 'user', content: aiInput }], sys[coachMode]));
    setAiLoading(false);
  }

  async function handlePractice() {
    if (!practiceInput.trim()) return;
    const msg = practiceInput; setPracticeInput('');
    const hist = [...practiceHistory, { role: 'user', content: msg }];
    setPracticeHistory(hist); setPracticeLoading(true);
    const result = await callClaude(hist, 'Roleplay as a skeptical Miami prospect. Josh Torres a Primerica rep is trying to set an FNA. Be resistant but realistic. Common objections: cant afford it, already have insurance, need to think, too busy. Warm up after 3-4 good responses. Short replies only.');
    setPracticeHistory([...hist, { role: 'assistant', content: result }]);
    setPracticeLoading(false);
  }

  async function handleContentAI() {
    if (!contentPrompt.trim()) return;
    setContentAiLoading(true); setContentAiOut('');
    setContentAiOut(await callClaude([{ role: 'user', content: contentPrompt }], 'You are content strategist for @JoshMiami, young Primerica rep in Miami. Create: 1) Instagram caption with emojis+CTA, 2) Facebook version, 3) Three story ideas, 4) One Reel hook. Miami energy, aspirational, authentic.'));
    setContentAiLoading(false);
  }

  const commission = (() => {
    const annualized = premium * 12;
    const p = annualized * 0.25;
    const ol = annualized * 0.05;
    return { annualized: annualized.toFixed(0), personal: p.toFixed(0), override: ol.toFixed(0), total: (p + ol).toFixed(0) };
  })();

  // ─── LAYOUT ───────────────────────────────────────────────────────────────
  const sidebarW = 220;

  const sidebarStyle = {
    width: sidebarW, minHeight: '100vh', background: C.card, borderRight: '1px solid ' + C.border,
    position: 'fixed', left: 0, top: 0, bottom: 0, display: 'flex', flexDirection: 'column',
    padding: '24px 0', zIndex: 100,
  };

  const mainStyle = {
    marginLeft: isMobile ? 0 : sidebarW,
    marginBottom: isMobile ? 70 : 0,
    minHeight: '100vh', background: C.bg, padding: isMobile ? '16px 14px' : '24px 32px',
    maxWidth: isMobile ? '100%' : 'calc(100% - ' + sidebarW + 'px)',
  };

  const bottomNavStyle = {
    position: 'fixed', bottom: 0, left: 0, right: 0, height: 64,
    background: C.card, borderTop: '1px solid ' + C.border,
    display: 'flex', alignItems: 'center', justifyContent: 'space-around', zIndex: 100,
  };

  function NavItem({ id, label, icon, onClick }) {
    const active = tab === id;
    return (
      <button onClick={onClick || (() => setTab(id))} style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: isMobile ? '8px 12px' : '10px 20px',
        display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', gap: isMobile ? 2 : 10,
        color: active ? C.cyan : C.gray, fontWeight: active ? 700 : 400,
        borderLeft: !isMobile && active ? '3px solid ' + C.cyan : !isMobile ? '3px solid transparent' : 'none',
        width: isMobile ? 'auto' : '100%', fontSize: isMobile ? 10 : 13, borderRadius: isMobile ? 8 : 0,
        background: !isMobile && active ? C.cyan + '11' : 'none',
      }}>
        <span style={{ fontSize: isMobile ? 18 : 16 }}>{icon}</span>
        <span>{label}</span>
      </button>
    );
  }

  // ─── PAGES ────────────────────────────────────────────────────────────────

  function Dashboard() {
    return (
      <div>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: C.cyan, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 4 }}>Welcome back</div>
          <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, background: 'linear-gradient(90deg,' + C.cyan + ',' + C.purple + ')', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Josh Torres</div>
          <div style={{ fontSize: 13, color: C.gray }}>{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · Miami, FL</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 12, marginBottom: 20 }}>
          <StatCard label='Total Leads' value={stats.leads} color={C.cyan} />
          <StatCard label='FNAs Set' value={stats.fna} color={C.amber} />
          <StatCard label='Clients Won' value={stats.won} color={C.green} />
          <StatCard label='Licensed Reps' value={stats.licensed} color={C.purple} />
        </div>

        {coldLeads.length > 0 && (
          <div style={{ ...card, borderLeft: '3px solid ' + C.red, marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 10 }}>COLD LEADS — NEEDS ATTENTION</div>
            {coldLeads.slice(0,3).map(l => (
              <div key={l.id} onClick={() => setSelectedContact(l)} style={{ ...row(), padding: '8px 0', borderBottom: '1px solid ' + C.border, cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: C.gray }}>{daysSince(l.updatedAt)}d since last contact</div>
                </div>
                <span style={pill(STATUS_COLOR[l.status] || C.gray)}>{l.status}</span>
              </div>
            ))}
          </div>
        )}

        {followUps.length > 0 && (
          <div style={{ ...card, borderLeft: '3px solid ' + C.amber }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 10 }}>FOLLOW-UPS TODAY</div>
            {followUps.map(l => (
              <div key={l.id} onClick={() => setSelectedContact(l)} style={{ ...row(), padding: '8px 0', borderBottom: '1px solid ' + C.border, cursor: 'pointer' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{l.name}</div>
                  <div style={{ fontSize: 11, color: C.gray }}>{l.phone}</div>
                </div>
                <span style={pill(STATUS_COLOR[l.status] || C.gray)}>{l.status}</span>
              </div>
            ))}
          </div>
        )}

        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 12 }}>TODAY'S TASKS</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTodo.trim()) { setTodos(prev => [...prev, { id: Date.now(), text: newTodo, done: false }]); setNewTodo(''); } }} placeholder='Add a task...' style={{ ...inp, flex: 1 }} />
            <button onClick={() => { if (newTodo.trim()) { setTodos(prev => [...prev, { id: Date.now(), text: newTodo, done: false }]); setNewTodo(''); } }} style={btn(C.gradAmber, true)}>+</button>
          </div>
          {todos.length === 0 && <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 12 }}>No tasks yet — add your daily goals</div>}
          {todos.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', borderBottom: '1px solid ' + C.border }}>
              <input type='checkbox' checked={t.done} onChange={() => setTodos(prev => prev.map(x => x.id === t.id ? { ...x, done: !x.done } : x))} style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <span style={{ flex: 1, fontSize: 13, textDecoration: t.done ? 'line-through' : 'none', color: t.done ? C.textMuted : C.text }}>{t.text}</span>
              <button onClick={() => setTodos(prev => prev.filter(x => x.id !== t.id))} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14 }}>x</button>
            </div>
          ))}
          {todos.length > 0 && <button onClick={() => setTodos([])} style={{ marginTop: 10, background: 'none', border: 'none', color: C.textMuted, fontSize: 11, cursor: 'pointer' }}>Clear all</button>}
        </div>
      </div>
    );
  }

  function Contacts() {
    return (
      <div>
        <div style={{ ...row(), marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text }}>Contacts</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ ...btn(C.gradPurple, true), cursor: 'pointer' }}>
              Import .vcf
              <input type='file' accept='.vcf' onChange={importVCard} style={{ display: 'none' }} />
            </label>
            <button onClick={() => setSelectedContact({ id: 'new', name: '', phone: '', email: '', status: 'New', source: 'Other', notes: '', followUp: '', activityLog: [], createdAt: new Date().toISOString() })} style={btn(C.gradCyan, true)}>+ New Contact</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder='Search name, phone, email...' style={{ ...inp, flex: 1, minWidth: 200 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>
            <option>All</option>
            {LEAD_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        <div style={{ fontSize: 11, color: C.gray, marginBottom: 10 }}>{filteredLeads.length} contacts</div>

        {filteredLeads.map(l => (
          <div key={l.id} onClick={() => setSelectedContact(l)} style={{ ...card, cursor: 'pointer', borderLeft: '3px solid ' + (STATUS_COLOR[l.status] || C.gray), padding: '14px 16px', transition: 'opacity 0.15s' }}>
            <div style={row()}>
              <div style={{ flex: 1 }}>
                <div style={{ ...row('flex-start'), gap: 10, marginBottom: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{l.name}</div>
                  <span style={pill(STATUS_COLOR[l.status] || C.gray)}>{l.status}</span>
                </div>
                <div style={{ fontSize: 12, color: C.gray }}>{l.phone} {l.email ? '· ' + l.email : ''}</div>
                {l.followUp && <div style={{ fontSize: 11, color: C.amber, marginTop: 4 }}>Follow-up: {fmt(l.followUp)}</div>}
                {daysSince(l.updatedAt) >= 3 && !['Closed Won','Closed Lost'].includes(l.status) && (
                  <div style={{ fontSize: 11, color: C.red, marginTop: 2 }}>{daysSince(l.updatedAt)}d since last contact</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 10 }}>
                {l.phone && <a href={'tel:' + l.phone} onClick={e => e.stopPropagation()} style={{ ...btn(C.gradGreen, true), textDecoration: 'none', fontSize: 16, padding: '8px 10px' }}>📞</a>}
                {l.phone && <a href={'sms:' + l.phone} onClick={e => e.stopPropagation()} style={{ ...btn(C.gradCyan, true), textDecoration: 'none', fontSize: 16, padding: '8px 10px' }}>💬</a>}
              </div>
            </div>
          </div>
        ))}
        {filteredLeads.length === 0 && <div style={{ textAlign: 'center', color: C.textMuted, padding: 40 }}>No contacts yet. Add your first contact or import from your phone.</div>}
      </div>
    );
  }

  function Pipeline() {
    const stages = LEAD_STATUSES.slice(0, -1);
    return (
      <div>
        <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text, marginBottom: 20 }}>Pipeline</div>
        <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16 }}>
          {stages.map(stage => {
            const stageLeads = leads.filter(l => l.status === stage);
            return (
              <div key={stage} style={{ minWidth: 220, flex: '0 0 220px', background: C.card, border: '1px solid ' + C.border, borderRadius: 12, padding: 14 }}>
                <div style={{ ...row(), marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: STATUS_COLOR[stage] || C.gray }}>{stage.toUpperCase()}</div>
                  <div style={{ ...pill(STATUS_COLOR[stage] || C.gray), fontSize: 10 }}>{stageLeads.length}</div>
                </div>
                {stageLeads.map(l => (
                  <div key={l.id} onClick={() => setSelectedContact(l)} style={{ background: C.bg, border: '1px solid ' + C.border, borderRadius: 8, padding: '10px 12px', marginBottom: 8, cursor: 'pointer' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 2 }}>{l.name}</div>
                    <div style={{ fontSize: 11, color: C.gray }}>{l.phone}</div>
                    {l.followUp && <div style={{ fontSize: 10, color: C.amber, marginTop: 4 }}>Follow-up: {fmt(l.followUp)}</div>}
                  </div>
                ))}
                {stageLeads.length === 0 && <div style={{ fontSize: 11, color: C.textMuted, textAlign: 'center', padding: 16 }}>Empty</div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function Recruits() {
    const filteredRecruits = recruits.filter(r => {
      const q = search.toLowerCase();
      return !q || r.name?.toLowerCase().includes(q) || r.phone?.includes(q);
    });
    return (
      <div>
        <div style={{ ...row(), marginBottom: 16 }}>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text }}>Recruit Pipeline</div>
          <button onClick={() => setSelectedContact({ id: 'new', name: '', phone: '', email: '', status: 'Prospect', source: 'Other', notes: '', followUp: '', activityLog: [], createdAt: new Date().toISOString(), isRecruit: true })} style={btn(C.gradPurple, true)}>+ Add Recruit</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10, marginBottom: 20 }}>
          {RECRUIT_STATUSES.map(s => {
            const count = recruits.filter(r => r.status === s).length;
            return count > 0 ? (
              <div key={s} style={{ background: C.card, border: '1px solid ' + (STATUS_COLOR[s] || C.gray) + '44', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: STATUS_COLOR[s] || C.gray }}>{count}</div>
                <div style={{ fontSize: 11, color: C.gray }}>{s}</div>
              </div>
            ) : null;
          })}
        </div>
        {filteredRecruits.map(r => (
          <div key={r.id} onClick={() => setSelectedContact({ ...r, isRecruit: true })} style={{ ...card, cursor: 'pointer', borderLeft: '3px solid ' + (STATUS_COLOR[r.status] || C.gray), padding: '14px 16px' }}>
            <div style={row()}>
              <div>
                <div style={{ ...row('flex-start'), gap: 8, marginBottom: 4 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{r.name}</div>
                  <span style={pill(STATUS_COLOR[r.status] || C.gray)}>{r.status}</span>
                </div>
                <div style={{ fontSize: 12, color: C.gray }}>{r.phone}</div>
                {r.notes && <div style={{ fontSize: 12, color: C.textSub, marginTop: 4 }}>{r.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {r.phone && <a href={'tel:' + r.phone} onClick={e => e.stopPropagation()} style={{ ...btn(C.gradGreen, true), textDecoration: 'none', fontSize: 16, padding: '8px 10px' }}>📞</a>}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  function AICoach() {
    return (
      <div>
        <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text, marginBottom: 20 }}>AI Coach</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {[['script','Script Gen'],['objection','Objection'],['caption','Caption'],['practice','Roleplay']].map(([k,l]) => (
            <button key={k} onClick={() => { setCoachMode(k); setAiOutput(''); setAiInput(''); }}
              style={{ padding: '9px 16px', borderRadius: 8, border: coachMode === k ? 'none' : '1px solid ' + C.border, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: coachMode === k ? C.gradCyan : C.card, color: coachMode === k ? '#fff' : C.gray }}>
              {l}
            </button>
          ))}
        </div>

        {coachMode !== 'practice' ? (
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, marginBottom: 10 }}>
              {coachMode === 'script' ? 'DESCRIBE YOUR PROSPECT' : coachMode === 'objection' ? 'ENTER THE OBJECTION' : 'DESCRIBE YOUR POST TOPIC'}
            </div>
            <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} rows={3}
              placeholder={coachMode === 'script' ? 'e.g. 25yo single mom, works at Target, no life insurance...' : coachMode === 'objection' ? 'e.g. I already have insurance through work...' : 'e.g. My first week as a licensed rep in Miami...'}
              style={{ ...inp, resize: 'vertical', marginBottom: 12 }} />
            <button onClick={handleAI} disabled={aiLoading} style={{ ...btn(C.gradCyan), opacity: aiLoading ? 0.7 : 1 }}>
              {aiLoading ? 'Generating...' : 'Generate'}
            </button>
            {aiOutput && (
              <div style={{ marginTop: 16, background: C.bg, borderRadius: 10, padding: 16, fontSize: 13, color: C.textSub, lineHeight: 1.8, whiteSpace: 'pre-wrap', border: '1px solid ' + C.border }}>
                {aiOutput}
                <button onClick={() => navigator.clipboard?.writeText(aiOutput)} style={{ ...btn('none', true), marginTop: 10, background: C.border, color: C.text, display: 'block' }}>Copy</button>
              </div>
            )}
          </div>
        ) : (
          <div style={card}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 6 }}>LIVE PROSPECT ROLEPLAY</div>
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 14 }}>Practice objections. AI plays a skeptical Miami prospect. Your goal: set the FNA.</div>
            <div style={{ minHeight: 200, maxHeight: 340, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {practiceHistory.length === 0 && <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', marginTop: 40 }}>Say hello to start</div>}
              {practiceHistory.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', background: m.role === 'user' ? C.gradCyan : C.bg, border: m.role === 'assistant' ? '1px solid ' + C.border : 'none', borderRadius: 12, padding: '10px 14px', maxWidth: '80%', fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                  <div style={{ fontSize: 10, color: m.role === 'user' ? '#bfdbfe' : C.gray, marginBottom: 3 }}>{m.role === 'user' ? 'You' : 'Prospect'}</div>
                  {m.content}
                </div>
              ))}
              {practiceLoading && <div style={{ alignSelf: 'flex-start', background: C.bg, border: '1px solid ' + C.border, borderRadius: 12, padding: '10px 14px', fontSize: 13, color: C.gray }}>Prospect is typing...</div>}
              <div ref={practiceEnd} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input value={practiceInput} onChange={e => setPracticeInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePractice(); } }} placeholder='Type your response...' style={{ ...inp, flex: 1 }} />
              <button onClick={handlePractice} disabled={practiceLoading} style={btn(C.gradGreen, true)}>Send</button>
            </div>
            <button onClick={() => setPracticeHistory([])} style={{ marginTop: 10, background: 'none', border: 'none', color: C.textMuted, fontSize: 11, cursor: 'pointer' }}>Reset</button>
          </div>
        )}
      </div>
    );
  }

  function Team() {
    return (
      <div>
        <div style={{ ...row(), marginBottom: 16 }}>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text }}>My Team</div>
          <button onClick={() => setShowAddTeam(true)} style={btn(C.gradPurple, true)}>+ Add Rep</button>
        </div>
        {showAddTeam && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <input placeholder='Rep Name' value={newTeam.name} onChange={e => setNewTeam({ ...newTeam, name: e.target.value })} style={inp} />
              <select value={newTeam.status} onChange={e => setNewTeam({ ...newTeam, status: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                {['Active','Inactive','In Training','Licensed'].map(s => <option key={s}>{s}</option>)}
              </select>
              <input type='number' placeholder='FNAs this month' value={newTeam.fna} onChange={e => setNewTeam({ ...newTeam, fna: e.target.value })} style={inp} />
              <input type='number' placeholder='Recruits this month' value={newTeam.recruits} onChange={e => setNewTeam({ ...newTeam, recruits: e.target.value })} style={inp} />
            </div>
            <button onClick={() => { if (!newTeam.name) return; setTeam(prev => [...prev, { ...newTeam, id: Date.now() }]); setNewTeam({ name: '', status: 'Active', fna: 0, recruits: 0 }); setShowAddTeam(false); }} style={btn(C.gradGreen, true)}>Save</button>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 14 }}>
          {team.map(rep => (
            <div key={rep.id} style={{ ...card, borderLeft: '3px solid ' + (rep.status === 'Active' ? C.green : C.gray), marginBottom: 0 }}>
              <div style={{ ...row(), marginBottom: 10 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{rep.name}</div>
                <span style={pill(rep.status === 'Active' ? C.green : C.gray)}>{rep.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: C.bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.amber }}>{rep.fna}</div>
                  <div style={{ fontSize: 10, color: C.gray }}>FNAs</div>
                </div>
                <div style={{ background: C.bg, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: C.purple }}>{rep.recruits}</div>
                  <div style={{ fontSize: 10, color: C.gray }}>Recruits</div>
                </div>
              </div>
              <button onClick={() => setTeam(prev => prev.filter(r => r.id !== rep.id))} style={{ marginTop: 10, background: 'none', border: 'none', color: C.textMuted, fontSize: 11, cursor: 'pointer' }}>Remove</button>
            </div>
          ))}
          {team.length === 0 && <div style={{ color: C.textMuted, fontSize: 13, textAlign: 'center', padding: 40, gridColumn: '1/-1' }}>Add your team members to track their activity</div>}
        </div>
      </div>
    );
  }

  function Commission() {
    return (
      <div>
        <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text, marginBottom: 20 }}>Commission Calculator</div>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 16 }}>MONTHLY PREMIUM WRITTEN</div>
          <input type='number' value={premium} onChange={e => setPremium(Number(e.target.value))} style={{ ...inp, fontSize: 24, fontWeight: 800, textAlign: 'center', marginBottom: 20, color: C.green }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Annualized Premium', value: '$' + Number(commission.annualized).toLocaleString(), color: C.cyan },
              { label: 'Personal Commission (25%)', value: '$' + Number(commission.personal).toLocaleString(), color: C.green },
              { label: 'Override Income (5%)', value: '$' + Number(commission.override).toLocaleString(), color: C.purple },
              { label: 'Total Estimated', value: '$' + Number(commission.total).toLocaleString(), color: C.amber },
            ].map(item => (
              <div key={item.label} style={{ background: C.bg, border: '1px solid ' + C.border, borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, fontSize: 11, color: C.textMuted, textAlign: 'center' }}>Estimates based on standard Primerica rep commission rates. Actual income varies.</div>
        </div>
      </div>
    );
  }

  function Content() {
    return (
      <div>
        <div style={{ ...row(), marginBottom: 16 }}>
          <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text }}>Content Lab</div>
          <button onClick={() => setShowAddContent(true)} style={btn(C.gradAmber, true)}>+ Add Post</button>
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 12 }}>AI CONTENT GENERATOR</div>
          <textarea placeholder='Describe your content idea...' value={contentPrompt} onChange={e => setContentPrompt(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical', marginBottom: 10 }} />
          <button onClick={handleContentAI} disabled={contentAiLoading} style={btn(C.gradAmber)}>{contentAiLoading ? 'Generating...' : 'Generate Full Content Pack'}</button>
          {contentAiOut && (
            <div style={{ marginTop: 14, background: C.bg, borderRadius: 10, padding: 16, fontSize: 13, color: C.textSub, lineHeight: 1.8, whiteSpace: 'pre-wrap', border: '1px solid ' + C.border }}>
              {contentAiOut}
              <button onClick={() => navigator.clipboard?.writeText(contentAiOut)} style={{ ...btn('none', true), marginTop: 10, background: C.border, color: C.text, display: 'block' }}>Copy</button>
            </div>
          )}
        </div>
        {showAddContent && (
          <div style={{ ...card, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <select value={newContent.platform} onChange={e => setNewContent({ ...newContent, platform: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                {['Instagram','Facebook','TikTok','Twitter'].map(p => <option key={p}>{p}</option>)}
              </select>
              <select value={newContent.type} onChange={e => setNewContent({ ...newContent, type: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                {['Reel','Post','Story','Carousel'].map(t => <option key={t}>{t}</option>)}
              </select>
              <select value={newContent.status} onChange={e => setNewContent({ ...newContent, status: e.target.value })} style={{ ...inp, cursor: 'pointer' }}>
                {['Draft','Scheduled','Posted'].map(s => <option key={s}>{s}</option>)}
              </select>
              <input type='date' value={newContent.date} onChange={e => setNewContent({ ...newContent, date: e.target.value })} style={inp} />
            </div>
            <textarea placeholder='Caption or description...' value={newContent.caption} onChange={e => setNewContent({ ...newContent, caption: e.target.value })} rows={2} style={{ ...inp, resize: 'none', marginBottom: 10 }} />
            <button onClick={() => { if (!newContent.caption) return; setContent(prev => [...prev, { ...newContent, id: Date.now() }]); setNewContent({ platform: 'Instagram', type: 'Reel', caption: '', status: 'Draft', date: '' }); setShowAddContent(false); }} style={btn(C.gradGreen, true)}>Save</button>
          </div>
        )}
        {content.map(c => {
          const sc = { Draft: C.orange, Scheduled: C.purple, Posted: C.green };
          return (
            <div key={c.id} style={{ ...card, borderLeft: '3px solid ' + (sc[c.status] || C.gray), padding: '14px 16px' }}>
              <div style={row()}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 3, color: C.text }}>{c.platform} · {c.type}</div>
                  <div style={{ fontSize: 13, color: C.textSub }}>{c.caption}</div>
                  <div style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>{c.date}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                  <span style={pill(sc[c.status] || C.gray)}>{c.status}</span>
                  <button onClick={() => setContent(prev => prev.filter(x => x.id !== c.id))} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 11 }}>Remove</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function Goals() {
    return (
      <div>
        <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: C.text, marginBottom: 20 }}>Goals</div>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 16 }}>MONTHLY TARGETS</div>
          {[['fna','FNA Appointments'],['recruits','New Recruits'],['premium','Premium Volume ($)']].map(([k,label]) => (
            <div key={k} style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, color: C.gray, marginBottom: 4 }}>{label}</div>
              <input type='number' value={goals[k]} onChange={e => setGoals(prev => ({ ...prev, [k]: e.target.value }))} style={inp} />
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.purple, marginBottom: 12 }}>MY WHY</div>
          <textarea value={goals.why} onChange={e => setGoals(prev => ({ ...prev, why: e.target.value }))} rows={4} placeholder='Why are you building this?' style={{ ...inp, resize: 'vertical' }} />
        </div>
        <div style={card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.cyan, marginBottom: 16 }}>PROGRESS THIS MONTH</div>
          {[
            { label: 'FNAs Set', cur: stats.fna, goal: goals.fna, color: C.amber },
            { label: 'Clients Won', cur: stats.won, goal: Math.ceil(goals.fna * 0.4), color: C.green },
            { label: 'Licensed Reps', cur: stats.licensed, goal: goals.recruits, color: C.purple },
          ].map(p => (
            <div key={p.label} style={{ marginBottom: 16 }}>
              <div style={{ ...row(), marginBottom: 6 }}>
                <div style={{ fontSize: 13 }}>{p.label}</div>
                <div style={{ fontSize: 13, color: p.color, fontWeight: 700 }}>{p.cur} / {p.goal}</div>
              </div>
              <div style={{ background: C.border, borderRadius: 99, height: 8 }}>
                <div style={{ background: p.color, borderRadius: 99, height: 8, width: Math.min(100, (p.cur / Math.max(p.goal, 1)) * 100) + '%', transition: 'width 0.4s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pages = { dashboard: <Dashboard />, contacts: <Contacts />, pipeline: <Pipeline />, recruits: <Recruits />, coach: <AICoach />, team: <Team />, commission: <Commission />, content: <Content />, goals: <Goals /> };

  const moreItems = NAV.filter(n => !MOBILE_NAV.slice(0,-1).includes(n.id));

  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: 'system-ui,-apple-system,sans-serif' }}>

      {/* Desktop Sidebar */}
      {!isMobile && (
        <div style={sidebarStyle}>
          <div style={{ padding: '0 20px 24px' }}>
            <div style={{ fontSize: 9, letterSpacing: 3, color: C.cyan, textTransform: 'uppercase', marginBottom: 2 }}>Josh Torres</div>
            <div style={{ fontSize: 16, fontWeight: 800, background: 'linear-gradient(90deg,' + C.cyan + ',' + C.purple + ')', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Command Center</div>
            <div style={{ fontSize: 10, color: C.green, marginTop: 2 }}>● Live · Miami FL</div>
          </div>
          <div style={{ flex: 1 }}>
            {NAV.map(n => <NavItem key={n.id} {...n} />)}
          </div>
          <div style={{ padding: '0 20px', borderTop: '1px solid ' + C.border, paddingTop: 16 }}>
            <div style={{ fontSize: 11, color: C.textMuted }}>Primerica Rep · Licensed 2-14</div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div style={mainStyle}>
        {pages[tab] || <Dashboard />}
      </div>

      {/* Mobile Bottom Nav */}
      {isMobile && (
        <div style={bottomNavStyle}>
          {MOBILE_NAV.slice(0,-1).map(id => {
            const n = NAV.find(x => x.id === id);
            return n ? <NavItem key={id} {...n} /> : null;
          })}
          <button onClick={() => setMoreOpen(!moreOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, color: C.gray, fontSize: 10 }}>
            <span style={{ fontSize: 18 }}>⋯</span>
            <span>More</span>
          </button>
        </div>
      )}

      {/* Mobile More Menu */}
      {isMobile && moreOpen && (
        <div style={{ position: 'fixed', bottom: 64, left: 0, right: 0, background: C.card, border: '1px solid ' + C.border, borderRadius: '20px 20px 0 0', zIndex: 200, padding: '20px 0' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {moreItems.map(n => (
              <button key={n.id} onClick={() => { setTab(n.id); setMoreOpen(false); }} style={{ background: tab === n.id ? C.cyan + '22' : 'none', border: 'none', cursor: 'pointer', padding: '14px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, color: tab === n.id ? C.cyan : C.gray, fontSize: 11, fontWeight: tab === n.id ? 700 : 400, borderRadius: 10 }}>
                <span style={{ fontSize: 22 }}>{n.icon}</span>
                <span>{n.label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => setMoreOpen(false)} style={{ display: 'block', margin: '10px auto 0', background: 'none', border: 'none', color: C.gray, cursor: 'pointer', fontSize: 13 }}>Close</button>
        </div>
      )}

      {/* Contact Modal */}
      {selectedContact && (
        <ContactModal
          contact={selectedContact}
          onClose={() => setSelectedContact(null)}
          onSave={selectedContact.isRecruit ? saveRecruit : saveContact}
          onDelete={selectedContact.isRecruit ? (id) => { setRecruits(prev => prev.filter(r => r.id !== id)); setSelectedContact(null); } : deleteContact}
        />
      )}
    </div>
  );
}