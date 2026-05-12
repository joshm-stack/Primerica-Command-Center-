import { useState, useEffect, useRef } from "react";

const TABS = ["Dashboard", "Lead Pipeline", "Content Lab", "AI Coach"];

const initialLeads = [
  { id: 1, name: "Marcus D.", status: "New", phone: "305-xxx-xxxx", note: "Met at gym", followUp: "2026-05-14" },
  { id: 2, name: "Keisha R.", status: "Contacted", phone: "786-xxx-xxxx", note: "Warm referral from mom", followUp: "2026-05-13" },
  { id: 3, name: "Tony V.", status: "FNA Scheduled", phone: "954-xxx-xxxx", note: "Interested in life insurance", followUp: "2026-05-15" },
  { id: 4, name: "Destiny M.", status: "Follow Up", phone: "305-xxx-xxxx", note: "Said call back in 2 weeks", followUp: "2026-05-20" },
];

const initialContent = [
  { id: 1, platform: "Instagram", type: "Reel", caption: "Why young people NEED life insurance 🔥", status: "Draft", date: "2026-05-13" },
  { id: 2, platform: "Facebook", type: "Post", caption: "My team is growing — here's what we built in 30 days", status: "Scheduled", date: "2026-05-14" },
  { id: 3, platform: "Instagram", type: "Story", caption: "POV: you finally got your license 💼", status: "Posted", date: "2026-05-11" },
];

const STATUS_COLORS = {
  "New": "#22d3ee",
  "Contacted": "#a78bfa",
  "FNA Scheduled": "#34d399",
  "Follow Up": "#fb923c",
  "Closed": "#4ade80",
  "Dead": "#6b7280",
};

const CONTENT_STATUS_COLORS = {
  "Draft": "#fb923c",
  "Scheduled": "#a78bfa",
  "Posted": "#34d399",
};

const PLATFORM_ICONS = { Instagram: "📸", Facebook: "📘", TikTok: "🎵", Twitter: "🐦" };

async function callClaude(messages, systemPrompt) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });
  const data = await response.json();
  return data.content?.[0]?.text || "No response.";
}

export default function App() {
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [leads, setLeads] = useState(initialLeads);
  const [content, setContent] = useState(initialContent);
  const [showAddLead, setShowAddLead] = useState(false);
  const [showAddContent, setShowAddContent] = useState(false);
  const [newLead, setNewLead] = useState({ name: "", status: "New", phone: "", note: "", followUp: "" });
  const [newContent, setNewContent] = useState({ platform: "Instagram", type: "Reel", caption: "", status: "Draft", date: "" });

  // AI Coach state
  const [coachMode, setCoachMode] = useState("script"); // script | objection | caption | practice
  const [aiInput, setAiInput] = useState("");
  const [aiOutput, setAiOutput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [practiceHistory, setPracticeHistory] = useState([]);
  const [practiceInput, setPracticeInput] = useState("");
  const [practiceLoading, setPracticeLoading] = useState(false);

  // Content Lab AI
  const [contentPrompt, setContentPrompt] = useState("");
  const [contentAiOutput, setContentAiOutput] = useState("");
  const [contentAiLoading, setContentAiLoading] = useState(false);

  const practiceEndRef = useRef(null);
  useEffect(() => { practiceEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [practiceHistory]);

  const stats = {
    total: leads.length,
    fna: leads.filter(l => l.status === "FNA Scheduled").length,
    contacted: leads.filter(l => l.status === "Contacted").length,
    posted: content.filter(c => c.status === "Posted").length,
  };

  async function handleAIGenerate() {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiOutput("");
    const systemMap = {
      script: `You are a Primerica coach helping Josh Torres, a licensed Primerica rep in Miami. Generate a short, natural, conversational outreach script for the prospect described. Keep it under 120 words, warm but professional, focused on the FNA (Financial Needs Analysis). End with a soft call to action.`,
      objection: `You are a Primerica sales coach. Josh Torres is a Miami rep handling objections. For the objection given, write a confident, empathetic 2-3 sentence response that acknowledges the concern, pivots, and re-opens the conversation. Keep it natural and not pushy.`,
      caption: `You are a social media strategist for @JoshMiami, a young Miami Primerica rep building his brand. Write an engaging Instagram/Facebook caption for the topic described. Use Miami energy, emojis, and a CTA. Under 100 words.`,
    };
    const userMsg = `${coachMode === "script" ? "Prospect info" : coachMode === "objection" ? "Objection" : "Caption topic"}: ${aiInput}`;
    const result = await callClaude([{ role: "user", content: userMsg }], systemMap[coachMode]);
    setAiOutput(result);
    setAiLoading(false);
  }

  async function handlePracticeMessage() {
    if (!practiceInput.trim()) return;
    const userMessage = practiceInput;
    setPracticeInput("");
    const newHistory = [...practiceHistory, { role: "user", content: userMessage }];
    setPracticeHistory(newHistory);
    setPracticeLoading(true);
    const system = `You are roleplaying as a skeptical but realistic prospect that Josh Torres, a Primerica rep in Miami, is trying to set an FNA appointment with. Be resistant but not rude. Use common objections like "I can't afford it", "I'm not interested", "I already have insurance", "I need to think about it". After 3-4 exchanges, warm up slightly if Josh handles objections well. Stay in character at all times. Keep responses short (1-3 sentences).`;
    const result = await callClaude(newHistory, system);
    setPracticeHistory([...newHistory, { role: "assistant", content: result }]);
    setPracticeLoading(false);
  }

  async function handleContentAI() {
    if (!contentPrompt.trim()) return;
    setContentAiLoading(true);
    setContentAiOutput("");
    const system = `You are a content strategist for @JoshMiami, a young Primerica financial rep in Miami building his personal brand. Generate a full content package: 1) Instagram caption (with emojis + CTA), 2) Facebook post version (slightly longer), 3) 3 story ideas, 4) one short hook for a Reel. Keep the Miami energy, aspirational but relatable tone.`;
    const result = await callClaude([{ role: "user", content: contentPrompt }], system);
    setContentAiOutput(result);
    setContentAiLoading(false);
  }

  const todayFollowUps = leads.filter(l => l.followUp === new Date().toISOString().split("T")[0]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#080c14",
      color: "#e2e8f0",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #0c1a2e 100%)",
        borderBottom: "1px solid #1e3a5f",
        padding: "18px 28px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: "#38bdf8", textTransform: "uppercase", marginBottom: 2 }}>Primerica × @JoshMiami</div>
          <div style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(90deg, #38bdf8, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Command Center
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>
          <div style={{ color: "#34d399", fontWeight: 600 }}>● Live</div>
          <div>Miami, FL</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #1e293b", background: "#0a1120", overflowX: "auto" }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "13px 22px",
            background: "none",
            border: "none",
            color: activeTab === tab ? "#38bdf8" : "#64748b",
            borderBottom: activeTab === tab ? "2px solid #38bdf8" : "2px solid transparent",
            fontWeight: activeTab === tab ? 700 : 400,
            fontSize: 13,
            cursor: "pointer",
            whiteSpace: "nowrap",
            transition: "all 0.2s",
          }}>{tab}</button>
        ))}
      </div>

      <div style={{ flex: 1, padding: "24px 20px", maxWidth: 900, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>

        {/* DASHBOARD */}
        {activeTab === "Dashboard" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
              {[
                { label: "Total Leads", value: stats.total, color: "#38bdf8" },
                { label: "FNAs Set", value: stats.fna, color: "#34d399" },
                { label: "Contacted", value: stats.contacted, color: "#a78bfa" },
                { label: "Posts Live", value: stats.posted, color: "#fb923c" },
              ].map(s => (
                <div key={s.label} style={{
                  background: "#0f1f35",
                  border: "1px solid #1e3a5f",
                  borderRadius: 12,
                  padding: "18px 20px",
                  borderLeft: `3px solid ${s.color}`,
                }}>
                  <div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 12, padding: 20, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom: 14, letterSpacing: 1 }}>📅 TODAY'S FOLLOW-UPS</div>
              {todayFollowUps.length === 0
                ? <div style={{ color: "#475569", fontSize: 13 }}>No follow-ups scheduled for today.</div>
                : todayFollowUps.map(l => (
                  <div key={l.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e293b" }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{l.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{l.note}</div>
                    </div>
                    <span style={{ background: STATUS_COLORS[l.status] + "22", color: STATUS_COLORS[l.status], borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{l.status}</span>
                  </div>
                ))}
            </div>

            <div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 12, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fb923c", marginBottom: 14, letterSpacing: 1 }}>📋 RECENT CONTENT</div>
              {content.slice(0, 3).map(c => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #1e293b" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{PLATFORM_ICONS[c.platform]} {c.caption.slice(0, 45)}...</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{c.type} · {c.date}</div>
                  </div>
                  <span style={{ background: CONTENT_STATUS_COLORS[c.status] + "22", color: CONTENT_STATUS_COLORS[c.status], borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{c.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* LEAD PIPELINE */}
        {activeTab === "Lead Pipeline" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>Lead Pipeline</div>
              <button onClick={() => setShowAddLead(!showAddLead)} style={{
                background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
                border: "none", borderRadius: 8, color: "#fff", padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>+ Add Lead</button>
            </div>

            {showAddLead && (
              <div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 12, padding: 20, marginBottom: 18 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  {[["name", "Name"], ["phone", "Phone"], ["note", "Note"], ["followUp", "Follow-up Date"]].map(([k, label]) => (
                    <input key={k} placeholder={label} type={k === "followUp" ? "date" : "text"}
                      value={newLead[k]} onChange={e => setNewLead({ ...newLead, [k]: e.target.value })}
                      style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius: 8, color: "#e2e8f0", padding: "9px 12px", fontSize: 13 }} />
                  ))}
                </div>
                <select value={newLead.status} onChange={e => setNewLead({ ...newLead, status: e.target.value })}
                  style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius: 8, color: "#e2e8f0", padding: "9px 12px", fontSize: 13, marginBottom: 10, width: "100%" }}>
                  {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
                </select>
                <button onClick={() => {
                  if (!newLead.name) return;
                  setLeads([...leads, { ...newLead, id: Date.now() }]);
                  setNewLead({ name: "", status: "New", phone: "", note: "", followUp: "" });
                  setShowAddLead(false);
                }} style={{ background: "#34d399", border: "none", borderRadius: 8, color: "#0a1120", padding: "9px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Save Lead</button>
              </div>
            )}

            {leads.map(lead => (
              <div key={lead.id} style={{
                background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 12, padding: "16px 18px", marginBottom: 10,
                borderLeft: `3px solid ${STATUS_COLORS[lead.status] || "#38bdf8"}`,
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{lead.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>{lead.phone}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{lead.note}</div>
                  {lead.followUp && <div style={{ fontSize: 11, color: "#38bdf8", marginTop: 6 }}>📅 Follow-up: {lead.followUp}</div>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <span style={{ background: STATUS_COLORS[lead.status] + "22", color: STATUS_COLORS[lead.status], borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{lead.status}</span>
                  <select value={lead.status} onChange={e => setLeads(leads.map(l => l.id === lead.id ? { ...l, status: e.target.value } : l))}
                    style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius: 6, color: "#94a3b8", padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>
                    {Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setLeads(leads.filter(l => l.id !== lead.id))}
                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11 }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CONTENT LAB */}
        {activeTab === "Content Lab" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>Content Lab</div>
              <button onClick={() => setShowAddContent(!showAddContent)} style={{
                background: "linear-gradient(135deg, #f97316, #a855f7)", border: "none", borderRadius: 8, color: "#fff", padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}>+ Add Content</button>
            </div>

            {/* AI Content Generator */}
            <div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 12, padding: 20, marginBottom: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fb923c", marginBottom: 12 }}>🤖 AI Content Generator</div>
              <textarea placeholder="Describe your content idea (e.g. 'Show how I got my license at 19 in Miami')"
                value={contentPrompt} onChange={e => setContentPrompt(e.target.value)}
                rows={3}
                style={{ width: "100%", background: "#0a1120", border: "1px solid #1e3a5f", borderRadius: 8, color: "#e2e8f0", padding: "10px 12px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
              <button onClick={handleContentAI} disabled={contentAiLoading}
                style={{ marginTop: 10, background: "linear-gradient(135deg, #f97316, #a855f7)", border: "none", borderRadius: 8, color: "#fff", padding: "10px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13, opacity: contentAiLoading ? 0.7 : 1 }}>
                {contentAiLoading ? "Generating..." : "Generate Full Content Pack"}
              </button>
              {contentAiOutput && (
                <div style={{ marginTop: 14, background: "#070e1a", borderRadius: 8, padding: 14, fontSize: 13, color: "#cbd5e1", lineHeight: 1.7, whiteSpace: "pre-wrap", border: "1px solid #1e3a5f" }}>
                  {contentAiOutput}
                </div>
              )}
            </div>

            {showAddContent && (
              <div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 12, padding: 20, marginBottom: 18 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <select value={newContent.platform} onChange={e => setNewContent({ ...newContent, platform: e.target.value })}
                    style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius: 8, color: "#e2e8f0", padding: "9px 12px", fontSize: 13 }}>
                    {["Instagram", "Facebook", "TikTok", "Twitter"].map(p => <option key={p}>{p}</option>)}
                  </select>
                  <select value={newContent.type} onChange={e => setNewContent({ ...newContent, type: e.target.value })}
                    style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius: 8, color: "#e2e8f0", padding: "9px 12px", fontSize: 13 }}>
                    {["Reel", "Post", "Story", "Carousel"].map(t => <option key={t}>{t}</option>)}
                  </select>
                  <select value={newContent.status} onChange={e => setNewContent({ ...newContent, status: e.target.value })}
                    style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius: 8, color: "#e2e8f0", padding: "9px 12px", fontSize: 13 }}>
                    {["Draft", "Scheduled", "Posted"].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <input type="date" value={newContent.date} onChange={e => setNewContent({ ...newContent, date: e.target.value })}
                    style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius: 8, color: "#e2e8f0", padding: "9px 12px", fontSize: 13 }} />
                </div>
                <textarea placeholder="Caption / content description" value={newContent.caption} onChange={e => setNewContent({ ...newContent, caption: e.target.value })}
                  rows={2} style={{ width: "100%", background: "#0a1120", border: "1px solid #1e3a5f", borderRadius: 8, color: "#e2e8f0", padding: "9px 12px", fontSize: 13, marginBottom: 10, resize: "none", boxSizing: "border-box" }} />
                <button onClick={() => {
                  if (!newContent.caption) return;
                  setContent([...content, { ...newContent, id: Date.now() }]);
                  setNewContent({ platform: "Instagram", type: "Reel", caption: "", status: "Draft", date: "" });
                  setShowAddContent(false);
                }} style={{ background: "#34d399", border: "none", borderRadius: 8, color: "#0a1120", padding: "9px 20px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>Save</button>
              </div>
            )}

            {content.map(c => (
              <div key={c.id} style={{
                background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 12, padding: "16px 18px", marginBottom: 10,
                borderLeft: `3px solid ${CONTENT_STATUS_COLORS[c.status]}`,
                display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              }}>
                <div>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{PLATFORM_ICONS[c.platform]} {c.platform} · {c.type}</div>
                  <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>{c.caption}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>📅 {c.date}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                  <span style={{ background: CONTENT_STATUS_COLORS[c.status] + "22", color: CONTENT_STATUS_COLORS[c.status], borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{c.status}</span>
                  <select value={c.status} onChange={e => setContent(content.map(x => x.id === c.id ? { ...x, status: e.target.value } : x))}
                    style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius: 6, color: "#94a3b8", padding: "4px 8px", fontSize: 11 }}>
                    {["Draft", "Scheduled", "Posted"].map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setContent(content.filter(x => x.id !== c.id))}
                    style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11 }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* AI COACH */}
        {activeTab === "AI Coach" && (
          <div>
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { key: "script", label: "📝 Script Generator" },
                { key: "objection", label: "🛡️ Objection Handler" },
                { key: "caption", label: "✍️ Caption Writer" },
                { key: "practice", label: "🎯 Live Practice" },
              ].map(m => (
                <button key={m.key} onClick={() => { setCoachMode(m.key); setAiOutput(""); setAiInput(""); }}
                  style={{
                    padding: "9px 16px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: coachMode === m.key ? "linear-gradient(135deg, #0ea5e9, #6366f1)" : "#0f1f35",
                    color: coachMode === m.key ? "#fff" : "#64748b",
                    border: coachMode === m.key ? "none" : "1px solid #1e3a5f",
                  }}>{m.label}</button>
              ))}
            </div>

            {coachMode !== "practice" && (
              <div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom: 10 }}>
                  {coachMode === "script" && "Describe your prospect"}
                  {coachMode === "objection" && "Enter the objection you're hearing"}
                  {coachMode === "caption" && "Describe your post topic"}
                </div>
                <textarea value={aiInput} onChange={e => setAiInput(e.target.value)} rows={3}
                  placeholder={
                    coachMode === "script" ? "e.g. 25yo single mom, works at Target, no life insurance..." :
                    coachMode === "objection" ? "e.g. I already have insurance through work..." :
                    "e.g. First week as a licensed Primerica rep in Miami..."
                  }
                  style={{ width: "100%", background: "#070e1a", border: "1px solid #1e3a5f", borderRadius: 8, color: "#e2e8f0", padding: "10px 12px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
                <button onClick={handleAIGenerate} disabled={aiLoading}
                  style={{ marginTop: 12, background: "linear-gradient(135deg, #0ea5e9, #6366f1)", border: "none", borderRadius: 8, color: "#fff", padding: "10px 22px", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: aiLoading ? 0.7 : 1 }}>
                  {aiLoading ? "Generating..." : "Generate"}
                </button>

                {aiOutput && (
                  <div style={{ marginTop: 16, background: "#070e1a", borderRadius: 8, padding: 16, fontSize: 13, color: "#cbd5e1", lineHeight: 1.8, whiteSpace: "pre-wrap", border: "1px solid #1e3a5f" }}>
                    {aiOutput}
                  </div>
                )}
              </div>
            )}

            {coachMode === "practice" && (
              <div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 12, padding: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399", marginBottom: 6 }}>🎯 Live Prospect Roleplay</div>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Practice handling real objections. The AI plays a skeptical Miami prospect. Try to set the FNA appointment.</div>

                <div style={{ minHeight: 240, maxHeight: 340, overflowY: "auto", marginBottom: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                  {practiceHistory.length === 0 && (
                    <div style={{ color: "#475569", fontSize: 13, textAlign: "center", marginTop: 60 }}>Start the conversation — say hello to your prospect 👋</div>
                  )}
                  {practiceHistory.map((msg, i) => (
                    <div key={i} style={{
                      alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                      background: msg.role === "user" ? "linear-gradient(135deg, #0ea5e9, #6366f1)" : "#0a1a2e",
                      border: msg.role === "assistant" ? "1px solid #1e3a5f" : "none",
                      borderRadius: 10, padding: "10px 14px", maxWidth: "80%", fontSize: 13, color: "#e2e8f0", lineHeight: 1.6,
                    }}>
                      <div style={{ fontSize: 10, color: msg.role === "user" ? "#bfdbfe" : "#475569", marginBottom: 4 }}>{msg.role === "user" ? "You" : "Prospect"}</div>
                      {msg.content}
                    </div>
                  ))}
                  {practiceLoading && (
                    <div style={{ alignSelf: "flex-start", background: "#0a1a2e", border: "1px solid #1e3a5f", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#64748b" }}>Prospect is typing...</div>
                  )}
                  <div ref={practiceEndRef} />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <input value={practiceInput} onChange={e => setPracticeInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handlePracticeMessage(); } }}
                    placeholder="Type your response..."
                    style={{ flex: 1, background: "#070e1a", border: "1px solid #1e3a5f", borderRadius: 8, color: "#e2e8f0", padding: "10px 14px", fontSize: 13 }} />
                  <button onClick={handlePracticeMessage} disabled={practiceLoading}
                    style={{ background: "linear-gradient(135deg, #34d399, #0ea5e9)", border: "none", borderRadius: 8, color: "#0a1120", padding: "10px 18px", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>→</button>
                </div>
                <button onClick={() => setPracticeHistory([])}
                  style={{ marginTop: 10, background: "none", border: "none", color: "#475569", fontSize: 12, cursor: "pointer" }}>Reset conversation</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}