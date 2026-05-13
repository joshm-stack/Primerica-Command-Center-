import { useState, useEffect, useRef } from 'react';

const TABS = ['Dashboard', 'Leads', 'Recruits', 'Content', 'AI Coach', 'Goals'];

const STATUS_COLORS = {
  New: '#22d3ee',
  Contacted: '#a78bfa',
  'FNA Scheduled': '#34d399',
  'Follow Up': '#fb923c',
  Closed: '#4ade80',
  Dead: '#6b7280',
};

const RECRUIT_COLORS = {
  Prospect: '#22d3ee',
  Invited: '#a78bfa',
  Interviewed: '#fb923c',
  Licensed: '#34d399',
  Active: '#4ade80',
  Dropped: '#6b7280',
};

const CONTENT_STATUS_COLORS = {
  Draft: '#fb923c',
  Scheduled: '#a78bfa',
  Posted: '#34d399',
};

const PLATFORM_ICONS = { Instagram: '📸', Facebook: '📘', TikTok: '🎵', Twitter: '🐦' };

const DEFAULT_LEADS = [
  { id: 1, name: 'Marcus D.', status: 'New', phone: '305-xxx-xxxx', note: 'Met at gym', followUp: '2026-05-14' },
  { id: 2, name: 'Keisha R.', status: 'Contacted', phone: '786-xxx-xxxx', note: 'Warm referral', followUp: '2026-05-13' },
];

const DEFAULT_RECRUITS = [
  { id: 1, name: 'Sample Recruit', status: 'Prospect', phone: '', note: 'Add your recruits here', followUp: '' },
];

const DEFAULT_CONTENT = [
  { id: 1, platform: 'Instagram', type: 'Reel', caption: 'Why young people NEED life insurance', status: 'Draft', date: '2026-05-13' },
];

const DEFAULT_GOALS = {
  monthlyFNA: 10,
  monthlyRecruits: 4,
  monthlyPremium: 5000,
  why: 'My child and my family',
};

function useLocalStorage(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value]);

  return [value, setValue];
}

async function callClaude(messages, systemPrompt) {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });
    const data = await response.json();
    if (data.error) return 'Error: ' + data.error;
    if (data.type === 'error') return 'Error: ' + data.error?.message;
    return data.content?.[0]?.text || JSON.stringify(data);
  } catch (e) {
    return 'Error: ' + e.message;
  }
}

export default function App() {
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [leads, setLeads] = useLocalStorage('joshleads', DEFAULT_LEADS);
  const [recruits, setRecruits] = useLocalStorage('joshrecruits', DEFAULT_RECRUITS);
  const [content, setContent] = useLocalStorage('joshcontent', DEFAULT_CONTENT);
  const [goals, setGoals] = useLocalStorage('joshgoals', DEFAULT_GOALS);
  const [todos, setTodos] = useLocalStorage('joshtodos', []);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddRecruit, setShowAddRecruit] = useState(false);
  const [showAddContent, setShowAddContent] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', status: 'New', phone: '', note: '', followUp: '' });
  const [newRecruit, setNewRecruit] = useState({ name: '', status: 'Prospect', phone: '', note: '', followUp: '' });
  const [newContent, setNewContent] = useState({ platform: 'Instagram', type: 'Reel', caption: '', status: 'Draft', date: '' });
  const [newTodo, setNewTodo] = useState('');
  const [coachMode, setCoachMode] = useState('script');
  const [aiInput, setAiInput] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState([]);
  const [practiceInput, setPracticeInput] = useState('');
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [contentPrompt, setContentPrompt] = useState('');
  const [contentAiOutput, setContentAiOutput] = useLocalStorage('joshcontentai', '');
  const [contentAiLoading, setContentAiLoading] = useState(false);
  const practiceEndRef = useRef(null);

  useEffect(() => { practiceEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [practiceHistory]);

  const today = new Date().toISOString().split('T')[0];
  const todayFollowUps = [...leads, ...recruits].filter(l => l.followUp === today);
  const stats = {
    totalLeads: leads.length,
    fnaSet: leads.filter(l => l.status === 'FNA Scheduled').length,
    licensed: recruits.filter(r => r.status === 'Licensed' || r.status === 'Active').length,
    posted: content.filter(c => c.status === 'Posted').length,
  };

  async function handleAIGenerate() {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiOutput('');
    const systemMap = {
      script: 'You are a Primerica coach helping Josh Torres, a licensed rep in Miami. Generate a short natural outreach script under 120 words focused on setting an FNA appointment.',
      objection: 'You are a Primerica sales coach for Josh Torres in Miami. Write a confident 2-3 sentence response to the objection that acknowledges it, pivots, and reopens the conversation.',
      caption: 'You are a social media strategist for @JoshMiami, a young Miami Primerica rep. Write an Instagram caption with emojis and a CTA under 100 words.',
    };
    const result = await callClaude([{ role: 'user', content: aiInput }], systemMap[coachMode]);
    setAiOutput(result);
    setAiLoading(false);
  }

  async function handlePracticeMessage() {
    if (!practiceInput.trim()) return;
    const userMessage = practiceInput;
    setPracticeInput('');
    const newHistory = [...practiceHistory, { role: 'user', content: userMessage }];
    setPracticeHistory(newHistory);
    setPracticeLoading(true);
    const system = 'You are roleplaying as a skeptical Miami prospect that Josh Torres is trying to set an FNA appointment with. Be resistant but realistic. Use objections like cannot afford it, not interested, already have insurance, need to think about it. Warm up slightly after 3-4 exchanges if Josh handles objections well. Keep responses short.';
    const result = await callClaude(newHistory, system);
    setPracticeHistory([...newHistory, { role: 'assistant', content: result }]);
    setPracticeLoading(false);
  }

  async function handleContentAI() {
    if (!contentPrompt.trim()) return;
    setContentAiLoading(true);
    setContentAiOutput('');
    const system = 'You are a content strategist for @JoshMiami, a young Primerica rep in Miami. Generate a full content package: 1) Instagram caption with emojis and CTA, 2) Facebook post version, 3) Three story ideas, 4) One Reel hook. Keep Miami energy, aspirational but relatable.';
    const result = await callClaude([{ role: 'user', content: contentPrompt }], system);
    setContentAiOutput(result);
    setContentAiLoading(false);
  }

  const s = {
    app: { minHeight: '100vh', background: '#080c14', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column' },
    header: { background: 'linear-gradient(135deg, #0f172a, #0c1a2e)', borderBottom: '1px solid #1e3a5f', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    tabs: { display: 'flex', borderBottom: '1px solid #1e293b', background: '#0a1120', overflowX: 'auto' },
    tab: (active) => ({ padding: '12px 18px', background: 'none', border: 'none', color: active ? '#38bdf8' : '#64748b', borderBottom: active ? '2px solid #38bdf8' : '2px solid transparent', fontWeight: active ? 700 : 400, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }),
    body: { flex: 1, padding: '20px 16px', maxWidth: 900, width: '100%', margin: '0 auto', boxSizing: 'border-box' },
    card: { background: '#0f1f35', border: '1px solid #1e3a5f', borderRadius: 12, padding: 18, marginBottom: 14 },
    btn: (color) => ({ background: color || 'linear-gradient(135deg, #0ea5e9, #6366f1)', border: 'none', borderRadius: 8, color: '#fff', padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }),
    input: { background: '#0a1120', border: '1px solid #1e3a5f', borderRadius: 8, color: '#e2e8f0', padding: '9px 12px', fontSize: 13, width: '100%', boxSizing: 'border-box' },
    badge: (color) => ({ background: color + '22', color: color, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 600 }),
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 },
    label: { fontSize: 11, color: '#64748b', marginBottom: 4 },
    sectionTitle: (color) => ({ fontSize: 13, fontWeight: 700, color: color || '#38bdf8', marginBottom: 12, letterSpacing: 1 }),
  };

  return (
    <div style={s.app}>
      <div style={s.header}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: 3, color: '#38bdf8', textTransform: 'uppercase', marginBottom: 2 }}>Josh Torres</div>
          <div style={{ fontSize: 20, fontWeight: 800, background: 'linear-gradient(90deg, #38bdf8, #818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Command Center</div>
        </div>
        <div style={{ fontSize: 11, color: '#64748b', textAlign: 'right' }}>
          <div style={{ color: '#34d399', fontWeight: 600 }}>● Live</div>
          <div>Miami, FL</div>
        </div>
      </div>

      <div style={s.tabs}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={s.tab(activeTab === tab)}>{tab}</button>
        ))}
      </div>

      <div style={s.body}>

        {activeTab === 'Dashboard' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
              {[
                { label: 'Total Leads', value: stats.totalLeads, color: '#38bdf8' },
                { label: 'FNAs Set', value: stats.fnaSet, color: '#34d399' },
                { label: 'Licensed Reps', value: stats.licensed, color: '#a78bfa' },
                { label: 'Posts Live', value: stats.posted, color: '#fb923c' },
              ].map(stat => (
                <div key={stat.label} style={{ ...s.card, borderLeft: `3px solid ${stat.color}`, padding: '16px 18px', marginBottom: 0 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            <div style={s.card}>
              <div style={s.sectionTitle('#fb923c')}>TODAY - {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
              <div style={{ marginBottom: 16 }}>
                <div style={s.label}>ADD TO-DO</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={newTodo} onChange={e => setNewTodo(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newTodo.trim()) { setTodos([...todos, { id: Date.now(), text: newTodo, done: false }]); setNewTodo(''); } }} placeholder='Add a task...' style={{ ...s.input, flex: 1 }} />
                  <button onClick={() => { if (newTodo.trim()) { setTodos([...todos, { id: Date.now(), text: newTodo, done: false }]); setNewTodo(''); } }} style={s.btn()}>+</button>
                </div>
              </div>
              {todos.length === 0 && <div style={{ color: '#475569', fontSize: 13 }}>No tasks yet — add your daily goals above</div>}
              {todos.map(todo => (
                <div key={todo.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #1e293b' }}>
                  <input type='checkbox' checked={todo.done} onChange={() => setTodos(todos.map(t => t.id === todo.id ? { ...t, done: !t.done } : t))} />
                  <span style={{ flex: 1, fontSize: 13, textDecoration: todo.done ? 'line-through' : 'none', color: todo.done ? '#475569' : '#e2e8f0' }}>{todo.text}</span>
                  <button onClick={() => setTodos(todos.filter(t => t.id !== todo.id))} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 11 }}>✕</button>
                </div>
              ))}
              {todos.length > 0 && <button onClick={() => setTodos([])} style={{ marginTop: 10, background: 'none', border: 'none', color: '#475569', fontSize: 11, cursor: 'pointer' }}>Clear all</button>}
            </div>

            {todayFollowUps.length > 0 && (
              <div style={s.card}>
                <div style={s.sectionTitle('#38bdf8')}>FOLLOW-UPS TODAY</div>
                {todayFollowUps.map(l => (
                  <div key={l.id} style={{ ...s.row, padding: '10px 0', borderBottom: '1px solid #1e293b' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{l.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>{l.note}</div>
                    </div>
                    <span style={s.badge(STATUS_COLORS[l.status] || '#38bdf8')}>{l.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'Leads' && (
          <div>
            <div style={{ ...s.row, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Lead Pipeline</div>
              <button onClick={() => setShowAddLead(!showAddLead)} style={s.btn()}>+ Add Lead</button>
            </div>
            {showAddLead && (
              <div style={s.card}>
                <div style={s.grid2}>
                  <input placeholder='Name' value={newLead.name} onChange={e => setNewLead({ ...newLead, name: e.target.value })} style={s.input} />
                  <input placeholder='Phone' value={newLead.phone} onChange={e => setNewLead({ ...newLead, phone: e.target.value })} style={s.input} />
                  <input placeholder='Note' value={newLead.note} onChange={e => setNewLead({ ...newLead, note: e.target.value })} style={s.input} />
                  <input type='date' value={newLead.followUp} onChange={e => setNewLead({ ...newLead, followUp: e.target.value })} style={s.input} />
                </div>
                <select value={newLead.status} onChange={e => setNewLead({ ...newLead, status: e.target.value })} style={{ ...s.input, marginBottom: 10 }}>
                  {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
                </select>
                <button onClick={() => { if (!newLead.name) return; setLeads([...leads, { ...newLead, id: Date.now() }]); setNewLead({ name: '', status: 'New', phone: '', note: '', followUp: '' }); setShowAddLead(false); }} style={s.btn('#34d399')}>Save Lead</button>
              </div>
            )}
            {leads.map(lead => (
              <div key={lead.id} style={{ ...s.card, borderLeft: `3px solid ${STATUS_COLORS[lead.status] || '#38bdf8'}` }}>
                <div style={s.row}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{lead.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{lead.phone}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{lead.note}</div>
                    {lead.followUp && <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 6 }}>Follow-up: {lead.followUp}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span style={s.badge(STATUS_COLORS[lead.status])}>{lead.status}</span>
                    <select value={lead.status} onChange={e => setLeads(leads.map(l => l.id === lead.id ? { ...l, status: e.target.value } : l))} style={{ background: '#0a1120', border: '1px solid #1e3a5f', borderRadius: 6, color: '#94a3b8', padding: '4px 8px', fontSize: 11 }}>
                      {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
                    </select>
                    <button onClick={() => setLeads(leads.filter(l => l.id !== lead.id))} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 11 }}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Recruits' && (
          <div>
            <div style={{ ...s.row, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Recruit Pipeline</div>
              <button onClick={() => setShowAddRecruit(!showAddRecruit)} style={s.btn()}>+ Add Recruit</button>
            </div>
            {showAddRecruit && (
              <div style={s.card}>
                <div style={s.grid2}>
                  <input placeholder='Name' value={newRecruit.name} onChange={e => setNewRecruit({ ...newRecruit, name: e.target.value })} style={s.input} />
                  <input placeholder='Phone' value={newRecruit.phone} onChange={e => setNewRecruit({ ...newRecruit, phone: e.target.value })} style={s.input} />
                  <input placeholder='Note' value={newRecruit.note} onChange={e => setNewRecruit({ ...newRecruit, note: e.target.value })} style={s.input} />
                  <input type='date' value={newRecruit.followUp} onChange={e => setNewRecruit({ ...newRecruit, followUp: e.target.value })} style={s.input} />
                </div>
                <select value={newRecruit.status} onChange={e => setNewRecruit({ ...newRecruit, status: e.target.value })} style={{ ...s.input, marginBottom: 10 }}>
                  {Object.keys(RECRUIT_COLORS).map(s => <option key={s}>{s}</option>)}
                </select>
                <button onClick={() => { if (!newRecruit.name) return; setRecruits([...recruits, { ...newRecruit, id: Date.now() }]); setNewRecruit({ name: '', status: 'Prospect', phone: '', note: '', followUp: '' }); setShowAddRecruit(false); }} style={s.btn('#34d399')}>Save Recruit</button>
              </div>
            )}
            {recruits.map(recruit => (
              <div key={recruit.id} style={{ ...s.card, borderLeft: `3px solid ${RECRUIT_COLORS[recruit.status] || '#38bdf8'}` }}>
                <div style={s.row}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{recruit.name}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{recruit.phone}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>{recruit.note}</div>
                    {recruit.followUp && <div style={{ fontSize: 11, color: '#38bdf8', marginTop: 6 }}>Follow-up: {recruit.followUp}</div>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span style={s.badge(RECRUIT_COLORS[recruit.status])}>{recruit.status}</span>
                    <select value={recruit.status} onChange={e => setRecruits(recruits.map(r => r.id === recruit.id ? { ...r, status: e.target.value } : r))} style={{ background: '#0a1120', border: '1px solid #1e3a5f', borderRadius: 6, color: '#94a3b8', padding: '4px 8px', fontSize: 11 }}>
                      {Object.keys(RECRUIT_COLORS).map(s => <option key={s}>{s}</option>)}
                    </select>
                    <button onClick={() => setRecruits(recruits.filter(r => r.id !== recruit.id))} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 11 }}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Content' && (
          <div>
            <div style={{ ...s.row, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Content Lab</div>
              <button onClick={() => setShowAddContent(!showAddContent)} style={s.btn('linear-gradient(135deg, #f97316, #a855f7)')}>+ Add Post</button>
            </div>

            <div style={s.card}>
              <div style={s.sectionTitle('#fb923c')}>AI CONTENT GENERATOR</div>
              <textarea placeholder='Describe your content idea...' value={contentPrompt} onChange={e => setContentPrompt(e.target.value)} rows={3} style={{ ...s.input, resize: 'vertical', marginBottom: 10 }} />
              <button onClick={handleContentAI} disabled={contentAiLoading} style={s.btn('linear-gradient(135deg, #f97316, #a855f7)')}>
                {contentAiLoading ? 'Generating...' : 'Generate Content Pack'}
              </button>
              {contentAiOutput && (
                <div style={{ marginTop: 14, background: '#070e1a', borderRadius: 8, padding: 14, fontSize: 13, color: '#cbd5e1', lineHeight: 1.7, whiteSpace: 'pre-wrap', border: '1px solid #1e3a5f' }}>
                  {contentAiOutput}
                </div>
              )}
            </div>

            {showAddContent && (
              <div style={s.card}>
                <div style={s.grid2}>
                  <select value={newContent.platform} onChange={e => setNewContent({ ...newContent, platform: e.target.value })} style={s.input}>
                    {['Instagram', 'Facebook', 'TikTok', 'Twitter'].map(p => <option key={p}>{p}</option>)}
                  </select>
                  <select value={newContent.type} onChange={e => setNewContent({ ...newContent, type: e.target.value })} style={s.input}>
                    {['Reel', 'Post', 'Story', 'Carousel'].map(t => <option key={t}>{t}</option>)}
                  </select>
                  <select value={newContent.status} onChange={e => setNewContent({ ...newContent, status: e.target.value })} style={s.input}>
                    {['Draft', 'Scheduled', 'Posted'].map(st => <option key={st}>{st}</option>)}
                  </select>
                  <input type='date' value={newContent.date} onChange={e => setNewContent({ ...newContent, date: e.target.value })} style={s.input} />
                </div>
                <textarea placeholder='Caption / description' value={newContent.caption} onChange={e => setNewContent({ ...newContent, caption: e.target.value })} rows={2} style={{ ...s.input, resize: 'none', marginBottom: 10 }} />
                <button onClick={() => { if (!newContent.caption) return; setContent([...content, { ...newContent, id: Date.now() }]); setNewContent({ platform: 'Instagram', type: 'Reel', caption: '', status: 'Draft', date: '' }); setShowAddContent(false); }} style={s.btn('#34d399')}>Save</button>
              </div>
            )}

            {content.map(c => (
              <div key={c.id} style={{ ...s.card, borderLeft: `3px solid ${CONTENT_STATUS_COLORS[c.status]}` }}>
                <div style={s.row}>
                  <div>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{PLATFORM_ICONS[c.platform]} {c.platform} - {c.type}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 6 }}>{c.caption}</div>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{c.date}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span style={s.badge(CONTENT_STATUS_COLORS[c.status])}>{c.status}</span>
                    <select value={c.status} onChange={e => setContent(content.map(x => x.id === c.id ? { ...x, status: e.target.value } : x))} style={{ background: '#0a1120', border: '1px solid #1e3a5f', borderRadius: 6, color: '#94a3b8', padding: '4px 8px', fontSize: 11 }}>
                      {['Draft', 'Scheduled', 'Posted'].map(st => <option key={st}>{st}</option>)}
                    </select>
                    <button onClick={() => setContent(content.filter(x => x.id !== c.id))} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 11 }}>Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'AI Coach' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
              {[
                { key: 'script', label: 'Script Generator' },
                { key: 'objection', label: 'Objection Handler' },
                { key: 'caption', label: 'Caption Writer' },
                { key: 'practice', label: 'Live Practice' },
              ].map(m => (
                <button key={m.key} onClick={() => { setCoachMode(m.key); setAiOutput(''); setAiInput(''); }}
                  style={{ padding: '9px 16px', borderRadius: 8, border: coachMode === m.key ? 'none' : '1px solid #1e3a5f', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: coachMode === m.key ? 'linear-gradient(135deg, #0ea5e9, #6366f1)' : '#0f1f35', color: coachMode === m.key ? '#fff' : '#64748b' }}>
                  {m.label}
                </button>
              ))}
            </div>

            {coachMode !== 'practice' && (
              <div style={s.card}>
                <div style={s.sectionTitle()}>
                  {coachMode === 'script' && 'Describe your prospect'}
                  {coachMode === 'objection' && 'Enter the objection'}
                  {coachMode === 'caption' && 'Describe your post topic'}
                </div>
                <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} rows={3}
                  placeholder={coachMode === 'script' ? 'e.g. 25yo single mom, works at Target, no life insurance...' : coachMode === 'objection' ? 'e.g. I already have insurance through work...' : 'e.g. First week as a licensed Primerica rep in Miami...'}
                  style={{ ...s.input, resize: 'vertical', marginBottom: 10 }} />
                <button onClick={handleAIGenerate} disabled={aiLoading} style={{ ...s.btn(), opacity: aiLoading ? 0.7 : 1 }}>
                  {aiLoading ? 'Generating...' : 'Generate'}
                </button>
                {aiOutput && (
                  <div style={{ marginTop: 14, background: '#070e1a', borderRadius: 8, padding: 14, fontSize: 13, color: '#cbd5e1', lineHeight: 1.8, whiteSpace: 'pre-wrap', border: '1px solid #1e3a5f' }}>
                    {aiOutput}
                  </div>
                )}
              </div>
            )}

            {coachMode === 'practice' && (
              <div style={s.card}>
                <div style={s.sectionTitle('#34d399')}>LIVE PROSPECT ROLEPLAY</div>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14 }}>Practice handling objections. AI plays a skeptical Miami prospect. Try to set the FNA.</div>
                <div style={{ minHeight: 200, maxHeight: 320, overflowY: 'auto', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {practiceHistory.length === 0 && <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', marginTop: 40 }}>Say hello to start the roleplay</div>}
                  {practiceHistory.map((msg, i) => (
                    <div key={i} style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', background: msg.role === 'user' ? 'linear-gradient(135deg, #0ea5e9, #6366f1)' : '#0a1a2e', border: msg.role === 'assistant' ? '1px solid #1e3a5f' : 'none', borderRadius: 10, padding: '10px 14px', maxWidth: '80%', fontSize: 13, color: '#e2e8f0', lineHeight: 1.6 }}>
                      <div style={{ fontSize: 10, color: msg.role === 'user' ? '#bfdbfe' : '#475569', marginBottom: 4 }}>{msg.role === 'user' ? 'You' : 'Prospect'}</div>
                      {msg.content}
                    </div>
                  ))}
                  {practiceLoading && <div style={{ alignSelf: 'flex-start', background: '#0a1a2e', border: '1px solid #1e3a5f', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#64748b' }}>Prospect is typing...</div>}
                  <div ref={practiceEndRef} />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input value={practiceInput} onChange={e => setPracticeInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePracticeMessage(); } }} placeholder='Type your response...' style={{ ...s.input, flex: 1 }} />
                  <button onClick={handlePracticeMessage} disabled={practiceLoading} style={s.btn('linear-gradient(135deg, #34d399, #0ea5e9)')}>Send</button>
                </div>
                <button onClick={() => setPracticeHistory([])} style={{ marginTop: 10, background: 'none', border: 'none', color: '#475569', fontSize: 11, cursor: 'pointer' }}>Reset</button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Goals' && (
          <div>
            <div style={s.card}>
              <div style={s.sectionTitle('#34d399')}>MONTHLY TARGETS</div>
              {[
                { key: 'monthlyFNA', label: 'FNA Appointments Goal' },
                { key: 'monthlyRecruits', label: 'New Recruits Goal' },
                { key: 'monthlyPremium', label: 'Premium Volume Goal ($)' },
              ].map(g => (
                <div key={g.key} style={{ marginBottom: 14 }}>
                  <div style={s.label}>{g.label}</div>
                  <input type='number' value={goals[g.key]} onChange={e => setGoals({ ...goals, [g.key]: e.target.value })} style={s.input} />
                </div>
              ))}
            </div>

            <div style={s.card}>
              <div style={s.sectionTitle('#a78bfa')}>MY WHY</div>
              <textarea value={goals.why} onChange={e => setGoals({ ...goals, why: e.target.value })} rows={4} placeholder='Why are you building this business?' style={{ ...s.input, resize: 'vertical' }} />
            </div>

            <div style={s.card}>
              <div style={s.sectionTitle('#38bdf8')}>PROGRESS THIS MONTH</div>
              {[
                { label: 'FNAs Set', current: stats.fnaSet, goal: goals.monthlyFNA, color: '#34d399' },
                { label: 'Recruits Licensed', current: stats.licensed, goal: goals.monthlyRecruits, color: '#a78bfa' },
              ].map(p => (
                <div key={p.label} style={{ marginBottom: 16 }}>
                  <div style={{ ...s.row, marginBottom: 6 }}>
                    <div style={{ fontSize: 13 }}>{p.label}</div>
                    <div style={{ fontSize: 13, color: p.color }}>{p.current} / {p.goal}</div>
                  </div>
                  <div style={{ background: '#1e293b', borderRadius: 99, height: 8 }}>
                    <div style={{ background: p.color, borderRadius: 99, height: 8, width: `${Math.min(100, (p.current / p.goal) * 100)}%`, transition: 'width 0.3s' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}