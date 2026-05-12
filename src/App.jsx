import { useState, useEffect, useRef } from "react";
const TABS = ["Dashboard", "Lead Pipeline", "Content Lab", "AI Coach"];
const initialLeads = [
{ id: 1, name: "Marcus D.", status: "New", phone: "305-xxx-xxxx", note: "Met at gym", follo
{ id: 2, name: "Keisha R.", status: "Contacted", phone: "786-xxx-xxxx", note: "Warm referra
{ id: 3, name: "Tony V.", status: "FNA Scheduled", phone: "954-xxx-xxxx", note: "Interested
{ id: 4, name: "Destiny M.", status: "Follow Up", phone: "305-xxx-xxxx", note: "Said call b
];
const initialContent = [
{ id: 1, platform: "Instagram", type: "Reel", caption: "Why young people NEED life insuranc
{ id: 2, platform: "Facebook", type: "Post", caption: "My team is growing — here's what we
{ id: 3, platform: "Instagram", type: "Story", caption: "POV: you finally got your license
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
const PLATFORM_ICONS = { Instagram: " ", Facebook: " ", TikTok: " ", Twitter: " " };
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
const [newLead, setNewLead] = useState({ name: "", status: "New", phone: "", note: "", foll
const [newContent, setNewContent] = useState({ platform: "Instagram", type: "Reel", caption
// AI Coach state
const [coachMode, setCoachMode] = useState("script"); // script | objection | caption | pra
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
useEffect(() => { practiceEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [pract
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
script: `You are a Primerica coach helping Josh Torres, a licensed Primerica rep objection: `You are a Primerica sales coach. Josh Torres is a Miami rep handling caption: `You are a social media strategist for @JoshMiami, a young Miami Primerica rep
in Mia
object
};
const userMsg = `${coachMode === "script" ? "Prospect info" : coachMode === "objection" ?
const result = await callClaude([{ role: "user", content: userMsg }], systemMap[coachMode
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
const system = `You are roleplaying as a skeptical but realistic prospect that Josh Torre
const result = await callClaude(newHistory, system);
setPracticeHistory([...newHistory, { role: "assistant", content: result }]);
setPracticeLoading(false);
}
async function handleContentAI() {
if (!contentPrompt.trim()) return;
setContentAiLoading(true);
setContentAiOutput("");
const system = `You are a content strategist for @JoshMiami, a young Primerica financial
const result = await callClaude([{ role: "user", content: contentPrompt }], system);
setContentAiOutput(result);
setContentAiLoading(false);
}
const todayFollowUps = leads.filter(l => l.followUp === new Date().toISOString().split("T")
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
<div style={{ fontSize: 11, letterSpacing: 3, color: "#38bdf8", textTransform: "upp
<div style={{ fontSize: 22, fontWeight: 800, background: "linear-gradient(90deg, #3
Command Center
</div>
</div>
<div style={{ fontSize: 12, color: "#64748b", textAlign: "right" }}>
<div style={{ color: "#34d399", fontWeight: 600 }}>● Live</div>
<div>Miami, FL</div>
</div>
</div>
{/* Tabs */}
<div style={{ display: "flex", borderBottom: "1px solid #1e293b", background: "#0a1120"
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
<div style={{ flex: 1, padding: "24px 20px", maxWidth: 900, width: "100%", margin: "0 a
{/* DASHBOARD */}
{activeTab === "Dashboard" && (
<div>
{[
<div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160p
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
</div>
<div style={{ fontSize: 32, fontWeight: 800, color: s.color }}>{s.value}</d
<div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{s.label}</di
))}
</div>
<div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 1
<div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom: 14
{todayFollowUps.length === 0
? <div style={{ color: "#475569", fontSize: 13 }}>No follow-ups scheduled for
: todayFollowUps.map(l => (
<div key={l.id} style={{ display: "flex", justifyContent: "space-between",
<div>
<div style={{ fontWeight: 600 }}>{l.name}</div>
<div style={{ fontSize: 12, color: "#64748b" }}>{l.note}</div>
</div>
<span style={{ background: STATUS_COLORS[l.status] + "22", color: STATUS_
</div>
))}
</div>
<div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 1
<div style={{ fontSize: 13, fontWeight: 700, color: "#fb923c", marginBottom: 14
{content.slice(0, 3).map(c => (
<div key={c.id} style={{ display: "flex", justifyContent: "space-between", al
<div>
<div style={{ fontWeight: 600, fontSize: 13 }}>{PLATFORM_ICONS[c.platform
<div style={{ fontSize: 11, color: "#64748b" }}>{c.type} · {c.date}</div>
</div>
<span style={{ background: CONTENT_STATUS_COLORS[c.status] + "22", color: C
</div>
))}
</div>
</div>
)}
{/* LEAD PIPELINE */}
{activeTab === "Lead Pipeline" && (
<div>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "cent
<div style={{ fontSize: 15, fontWeight: 700, color: "#e2e8f0" }}>Lead Pipeline<
<button onClick={() => setShowAddLead(!showAddLead)} style={{
background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
border: "none", borderRadius: 8, color: "#fff", padding: "9px 18px", fontSize
}}>+ Add Lead</button>
</div>
{showAddLead && (
<div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius:
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margi
{[["name", "Name"], ["phone", "Phone"], ["note", "Note"], ["followUp", "Fol
<input key={k} placeholder={label} type={k === "followUp" ? "date" : "tex
value={newLead[k]} onChange={e => setNewLead({ ...newLead, [k]: e.targe
style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadi
))}
</div>
<select value={newLead.status} onChange={e => setNewLead({ ...newLead, status
style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius:
{Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
</select>
<button onClick={() => {
if (!newLead.name) return;
setLeads([...leads, { ...newLead, id: Date.now() }]);
setNewLead({ name: "", status: "New", phone: "", note: "", followUp: setShowAddLead(false);
}} style={{ background: "#34d399", border: "none", borderRadius: 8, color: "#
</div>
"" });
)}
}}>
{leads.map(lead => (
<div key={lead.id} style={{
background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 12, padding
borderLeft: `3px solid ${STATUS_COLORS[lead.status] || "#38bdf8"}`,
display: "flex", justifyContent: "space-between", alignItems: "flex-start",
<div>
<div style={{ fontWeight: 700, marginBottom: 4 }}>{lead.name}</div>
<div style={{ fontSize: 12, color: "#64748b" }}>{lead.phone}</div>
<div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{lead.note}</
{lead.followUp && <div style={{ fontSize: 11, color: "#38bdf8", marginTop:
</div>
<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end
<span style={{ background: STATUS_COLORS[lead.status] + "22", color: STATUS
<select value={lead.status} onChange={e => setLeads(leads.map(l => l.id ===
style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius
{Object.keys(STATUS_COLORS).map(s => <option key={s}>{s}</option>)}
</select>
<button onClick={() => setLeads(leads.filter(l => l.id !== lead.id))}
style={{ background: "none", border: "none", color: "#475569", cursor: "p
</div>
</div>
))}
</div>
)}
{/* CONTENT LAB */}
{activeTab === "Content Lab" && (
<div>
<div style={{ display: "flex", justifyContent: "space-between", alignItems: "cent
<div style={{ fontSize: 15, fontWeight: 700 }}>Content Lab</div>
<button onClick={() => setShowAddContent(!showAddContent)} style={{
background: "linear-gradient(135deg, #f97316, #a855f7)", border: "none", bord
}}>+ Add Content</button>
</div>
{/* AI Content Generator */}
<div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 1
<div style={{ fontSize: 13, fontWeight: 700, color: "#fb923c", marginBottom: 12
<textarea placeholder="Describe your content idea (e.g. 'Show how I got my lice
value={contentPrompt} onChange={e => setContentPrompt(e.target.value)}
rows={3}
style={{ width: "100%", background: "#0a1120", border: "1px solid #1e3a5f", b
<button onClick={handleContentAI} disabled={contentAiLoading}
style={{ marginTop: 10, background: "linear-gradient(135deg, #f97316, #a855f7
{contentAiLoading ? "Generating..." : "Generate Full Content Pack"}
</button>
{contentAiOutput && (
<div style={{ marginTop: 14, background: "#070e1a", borderRadius: 8, padding:
{contentAiOutput}
</div>
)}
</div>
{showAddContent && (
<div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius:
<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margi
<select value={newContent.platform} onChange={e => setNewContent({ ...newCo
style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius
{["Instagram", "Facebook", "TikTok", "Twitter"].map(p => <option key={p}>
</select>
<select value={newContent.type} onChange={e => setNewContent({ ...newConten
style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius
{["Reel", "Post", "Story", "Carousel"].map(t => <option key={t}>{t}</opti
</select>
<select value={newContent.status} onChange={e => setNewContent({ ...newCont
style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius
{["Draft", "Scheduled", "Posted"].map(s => <option key={s}>{s}</option>)}
</select>
<input type="date" value={newContent.date} onChange={e => setNewContent({ .
style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius
</div>
<textarea placeholder="Caption / content description" value={newContent.capti
rows={2} style={{ width: "100%", background: "#0a1120", border: "1px solid
<button onClick={() => {
if (!newContent.caption) return;
setContent([...content, { ...newContent, id: Date.now() }]);
setNewContent({ platform: "Instagram", type: "Reel", caption: "", status: "
setShowAddContent(false);
}} style={{ background: "#34d399", border: "none", borderRadius: 8, color: "#
</div>
)}
{content.map(c => (
<div key={c.id} style={{
background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius: 12, padding
borderLeft: `3px solid ${CONTENT_STATUS_COLORS[c.status]}`,
display: "flex", justifyContent: "space-between", alignItems: "flex-start",
}}>
<div>
<div style={{ fontWeight: 700, marginBottom: 4 }}>{PLATFORM_ICONS[c.platfor
<div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6 }}>{c.caption
<div style={{ fontSize: 11, color: "#64748b" }}> {c.date}</div>
</div>
<div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end
<span style={{ background: CONTENT_STATUS_COLORS[c.status] + "22", color: C
<select value={c.status} onChange={e => setContent(content.map(x => x.id ==
style={{ background: "#0a1120", border: "1px solid #1e3a5f", borderRadius
{["Draft", "Scheduled", "Posted"].map(s => <option key={s}>{s}</option>)}
</select>
<button onClick={() => setContent(content.filter(x => x.id !== c.id))}
style={{ background: "none", border: "none", color: "#475569", cursor: "p
</div>
</div>
))}
</div>
)}
{/* AI COACH */}
{activeTab === "AI Coach" && (
<div>
{[
<div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
{ key: "script", label: " Script Generator" },
{ key: "objection", label: " Objection Handler" },
{ key: "caption", label: " Caption Writer" },
{ key: "practice", label: " Live Practice" },
].map(m => (
<button key={m.key} onClick={() => { setCoachMode(m.key); setAiOutput(""); se
style={{
padding: "9px 16px", borderRadius: 8, border: "none", fontSize: 12, fontW
background: coachMode === m.key ? "linear-gradient(135deg, #0ea5e9, #6366
color: coachMode === m.key ? "#fff" : "#64748b",
border: coachMode === m.key ? "none" : "1px solid #1e3a5f",
}}>{m.label}</button>
))}
</div>
{coachMode !== "practice" && (
<div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius:
<div style={{ fontSize: 13, fontWeight: 700, color: "#38bdf8", marginBottom:
{coachMode === "script" && "Describe your prospect"}
{coachMode === "objection" && "Enter the objection you're hearing"}
{coachMode === "caption" && "Describe your post topic"}
</div>
<textarea value={aiInput} onChange={e => setAiInput(e.target.value)} rows={3}
placeholder={
coachMode === "script" ? "e.g. 25yo single mom, works at Target, no life
coachMode === "objection" ? "e.g. I already have insurance through "e.g. First week as a licensed Primerica rep in Miami..."
work..
}
style={{ width: "100%", background: "#070e1a", border: "1px solid #1e3a5f",
<button onClick={handleAIGenerate} disabled={aiLoading}
style={{ marginTop: 12, background: "linear-gradient(135deg, #0ea5e9, #6366
{aiLoading ? "Generating..." : "Generate"}
</button>
{aiOutput && (
<div style={{ marginTop: 16, background: "#070e1a", borderRadius: 8, {aiOutput}
</div>
paddin
)}
</div>
)}
{coachMode === "practice" && (
<div style={{ background: "#0f1f35", border: "1px solid #1e3a5f", borderRadius:
<div style={{ fontSize: 13, fontWeight: 700, color: "#34d399", marginBottom:
<div style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>Practice ha
<div style={{ minHeight: 240, maxHeight: 340, overflowY: "auto", marginBottom
{practiceHistory.length === 0 && (
<div style={{ color: "#475569", fontSize: 13, textAlign: "center", margin
)}
{practiceHistory.map((msg, i) => (
<div key={i} style={{
alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
background: msg.role === "user" ? "linear-gradient(135deg, #0ea5e9, #63
border: msg.role === "assistant" ? "1px solid #1e3a5f" : "none",
borderRadius: 10, padding: "10px 14px", maxWidth: "80%", fontSize: 13,
}}>
<div style={{ fontSize: 10, color: msg.role === "user" ? "#bfdbfe" : "#
{msg.content}
</div>
))}
{practiceLoading && (
<div style={{ alignSelf: "flex-start", background: "#0a1a2e", border: "1p
)}
</div>
<div ref={practiceEndRef} />
<div style={{ display: "flex", gap: 8 }}>
<input value={practiceInput} onChange={e => setPracticeInput(e.target.value
onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefaul
placeholder="Type your response..."
style={{ flex: 1, background: "#070e1a", border: "1px solid #1e3a5f", bor
<button onClick={handlePracticeMessage} disabled={practiceLoading}
style={{ background: "linear-gradient(135deg, #34d399, #0ea5e9)", border:
</div>
<button onClick={() => setPracticeHistory([])}
style={{ marginTop: 10, background: "none", border: "none", color: "#475569
</div>
)}
</div>
)}
</div>
</div>
);
}