import { useState, useRef } from "react";

// ─── API LAYER ────────────────────────────────────────────────────────────────
// All calls go through /api/* — Vercel serverless functions inject the keys.
// In local dev, vite.config.js proxies /api → localhost:3000 (or just use vercel dev).

async function callClaude(messages, systemPrompt, maxTokens = 1500) {
  const res = await fetch('/api/anthropic', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || `API error ${res.status}`)
  const text = data.content?.[0]?.text
  if (!text) throw new Error('Empty response')
  return text
}

// GPT-4o vision — handles image understanding
async function callVision(images, prompt, systemPrompt) {
  const res = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images, prompt, systemPrompt }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error || `Vision API error ${res.status}`)
  return data.text
}

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const BRAND_QUESTIONS_NEW = [
  { id: "name", q: "What's the brand name?", type: "text", placeholder: "e.g. Iced London" },
  { id: "category", q: "What category does the brand operate in?", type: "text", placeholder: "e.g. jewellery, streetwear, beauty, footwear..." },
  { id: "founding_why", q: "Why does this brand exist? Not what it sells — why.", type: "textarea", placeholder: "The conviction behind it. The gap it fills. The thing you couldn't stop thinking about." },
  { id: "feeling", q: "What feeling should someone have the moment they encounter this brand — before they read a single word?", type: "textarea", placeholder: "Describe the immediate emotional hit." },
  { id: "target_customer", q: "Describe your target customer as a person. Not demographics — a human being.", type: "textarea", placeholder: "Their day, their aspirations, what they're trying to signal, what they fear, what they love." },
  { id: "price_point", q: "Where does this brand sit in the market?", type: "select", options: ["Mass market", "Mid-market", "Premium", "Luxury", "Ultra-luxury"] },
  { id: "competitors_admire", q: "Name 3 brands — inside or outside your category — whose creative output you genuinely admire. And say why.", type: "textarea", placeholder: "These don't have to be competitors. They could be anyone whose work moves you." },
  { id: "anti_references", q: "Name brands or aesthetics you absolutely want to avoid. What would feel like failure?", type: "textarea", placeholder: "Be honest. This is as useful as the positive references." },
  { id: "channels", q: "Where will this brand live primarily?", type: "multiselect", options: ["Instagram", "TikTok", "Pinterest", "Website / E-comm", "Physical retail", "Wholesale", "YouTube"] },
  { id: "launch_timeline", q: "What's the launch timeline or current stage?", type: "text", placeholder: "e.g. launching in 3 months, pre-launch, day one..." },
]

const BRAND_QUESTIONS_EXISTING = [
  { id: "name", q: "What's the brand name?", type: "text", placeholder: "e.g. Iced London" },
  { id: "category", q: "What category does the brand operate in?", type: "text", placeholder: "e.g. jewellery, streetwear, beauty, footwear..." },
  { id: "age", q: "How long has the brand been trading?", type: "text", placeholder: "e.g. 2 years" },
  { id: "founding_why", q: "What was the original conviction behind it? Has that changed?", type: "textarea", placeholder: "The original reason, and whether it's still the north star." },
  { id: "current_customer", q: "Who is your actual customer right now — based on data, DMs, reviews, and intuition?", type: "textarea", placeholder: "Be specific. Age range, location, what they buy beyond you, what they say about you." },
  { id: "intended_customer", q: "Who did you intend to reach — and is that the same person buying?", type: "textarea", placeholder: "Any drift or mismatch here is critical information." },
  { id: "revenue", q: "Current revenue range? (Optional — helps calibrate advice)", type: "select", options: ["Pre-revenue", "Under £50k", "£50k–£250k", "£250k–£1M", "£1M–£5M", "£5M+", "Prefer not to say"] },
  { id: "what_working", q: "What's working right now — creatively and commercially?", type: "textarea", placeholder: "The things you'd protect at all costs." },
  { id: "what_broken", q: "What's not working? What feels off, inconsistent, or below the brand you want to be?", type: "textarea", placeholder: "Be ruthless here. This is where the real work starts." },
  { id: "rebrand_question", q: "Are you considering a rebrand, evolution, or optimising what exists?", type: "select", options: ["Optimising what exists", "Gradual evolution", "Significant rebrand", "Not sure yet"] },
  { id: "competitors_admire", q: "Name 3 brands whose creative output you genuinely admire right now. And say why.", type: "textarea", placeholder: "Inside or outside category." },
  { id: "channels", q: "Where does the brand currently live?", type: "multiselect", options: ["Instagram", "TikTok", "Pinterest", "Website / E-comm", "Physical retail", "Wholesale", "YouTube"] },
]

const BRIEF_QUESTIONS = [
  { id: "project_name", q: "What's this project called?", type: "text", placeholder: "e.g. Summer campaign, Chain collection launch..." },
  { id: "objective", q: "What is this actually trying to achieve?", type: "textarea", placeholder: "Not just 'shoot product'. What's the commercial or brand objective?" },
  { id: "deliverables", q: "What deliverables are needed?", type: "multiselect", options: ["Hero campaign images", "Product cut-downs", "Video / Reels", "BTS content", "Story formats", "Print assets", "Website hero", "Lookbook"] },
  { id: "platform", q: "Where will this content live primarily?", type: "multiselect", options: ["Instagram feed", "Instagram Reels", "TikTok", "Pinterest", "Website", "Paid ads", "Email"] },
  { id: "feeling", q: "What feeling should this shoot communicate?", type: "textarea", placeholder: "One or two sentences. Visceral, not vague." },
  { id: "talent", q: "Talent direction", type: "textarea", placeholder: "Gender, energy, casting notes, model or non-model..." },
  { id: "location_city", q: "Which city are you shooting in?", type: "text", placeholder: "e.g. London, New York, Paris..." },
  { id: "location_type", q: "Location preference?", type: "select", options: ["Studio — neutral", "Studio — set-dressed", "Real location / outdoor", "Interior space", "Urban / street", "Undecided — suggest something"] },
  { id: "budget_range", q: "Shoot budget range?", type: "select", options: ["Under £500", "£500–£2k", "£2k–£5k", "£5k–£15k", "£15k+"] },
  { id: "timeline", q: "Shoot date or timeline?", type: "text", placeholder: "e.g. within 3 weeks, specific date..." },
]

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --ink: #0e0e0e;
    --ink2: #3a3a3a;
    --ink3: #7a7a7a;
    --paper: #f5f2ee;
    --paper2: #edeae5;
    --paper3: #e4e0da;
    --gold: #c9a84c;
    --gold2: #e8c97a;
    --white: #faf9f7;
    --red: #c0392b;
    --green: #2d6a4f;
    --border: rgba(14,14,14,0.1);
    --border2: rgba(14,14,14,0.2);
    --font-display: 'Playfair Display', Georgia, serif;
    --font-body: 'DM Sans', sans-serif;
    --radius: 4px;
    --radius-lg: 10px;
    --shadow: 0 2px 20px rgba(0,0,0,0.08);
    --shadow-lg: 0 8px 40px rgba(0,0,0,0.12);
  }

  body { font-family: var(--font-body); background: var(--paper); color: var(--ink); line-height: 1.6; }
  .app { display: flex; height: 100vh; overflow: hidden; }

  .sidebar {
    width: 220px; flex-shrink: 0;
    background: var(--ink); color: var(--white);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .sidebar-logo { padding: 28px 24px 24px; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .sidebar-logo h1 { font-family: var(--font-display); font-size: 18px; font-weight: 700; color: var(--white); }
  .sidebar-logo span { font-size: 11px; color: var(--gold); letter-spacing: 2px; text-transform: uppercase; display: block; margin-top: 3px; }
  .sidebar-nav { flex: 1; padding: 16px 0; overflow-y: auto; }
  .nav-section-label { font-size: 9px; letter-spacing: 2.5px; text-transform: uppercase; color: rgba(255,255,255,0.3); padding: 16px 24px 6px; }
  .nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 24px; cursor: pointer; font-size: 13px; color: rgba(255,255,255,0.55); transition: all 0.15s; border-left: 2px solid transparent; white-space: nowrap; }
  .nav-item:hover { color: var(--white); background: rgba(255,255,255,0.04); }
  .nav-item.active { color: var(--white); border-left-color: var(--gold); background: rgba(201,168,76,0.08); }
  .nav-item .nav-icon { font-size: 14px; width: 18px; text-align: center; }
  .nav-item .nav-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--green); margin-left: auto; flex-shrink: 0; }
  .sidebar-brand { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.08); }
  .sidebar-brand .sb-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: rgba(255,255,255,0.3); margin-bottom: 4px; }
  .sidebar-brand .sb-name { font-size: 13px; font-weight: 500; color: var(--white); }
  .sidebar-brand .sb-meta { font-size: 11px; color: rgba(255,255,255,0.4); }

  .main { flex: 1; overflow-y: auto; background: var(--paper); }

  .page-header { padding: 40px 48px 24px; border-bottom: 1px solid var(--border); background: var(--white); }
  .page-header-eyebrow { font-size: 10px; letter-spacing: 3px; text-transform: uppercase; color: var(--gold); font-weight: 500; margin-bottom: 8px; }
  .page-header h2 { font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--ink); letter-spacing: -0.5px; }
  .page-header p { font-size: 14px; color: var(--ink3); margin-top: 6px; max-width: 600px; }

  .page-content { padding: 36px 48px 60px; }

  .card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 28px; box-shadow: var(--shadow); }
  .card + .card { margin-top: 16px; }
  .card-title { font-family: var(--font-display); font-size: 16px; font-weight: 700; color: var(--ink); margin-bottom: 4px; }
  .card-sub { font-size: 13px; color: var(--ink3); margin-bottom: 20px; }

  .form-group { margin-bottom: 24px; }
  .form-label { display: block; font-size: 13px; font-weight: 500; color: var(--ink2); margin-bottom: 8px; line-height: 1.4; }
  .form-label .q-number { font-size: 10px; letter-spacing: 1.5px; color: var(--gold); text-transform: uppercase; display: block; margin-bottom: 4px; }
  input[type="text"], textarea, select { width: 100%; padding: 12px 14px; font-family: var(--font-body); font-size: 14px; color: var(--ink); background: var(--paper); border: 1.5px solid var(--border2); border-radius: var(--radius); outline: none; transition: border-color 0.15s, box-shadow 0.15s; resize: vertical; }
  input:focus, textarea:focus, select:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(201,168,76,0.12); }
  textarea { min-height: 90px; }
  textarea.big { min-height: 130px; }
  select { cursor: pointer; }

  .multiselect-grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .ms-option { padding: 7px 14px; border-radius: 20px; border: 1.5px solid var(--border2); cursor: pointer; font-size: 12px; font-weight: 500; color: var(--ink2); background: var(--paper); transition: all 0.15s; user-select: none; }
  .ms-option.selected { background: var(--ink); color: var(--white); border-color: var(--ink); }

  .btn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 22px; border-radius: var(--radius); font-family: var(--font-body); font-size: 13px; font-weight: 500; cursor: pointer; transition: all 0.15s; border: none; }
  .btn-primary { background: var(--ink); color: var(--white); }
  .btn-primary:hover { background: #2a2a2a; }
  .btn-gold { background: var(--gold); color: var(--ink); }
  .btn-gold:hover { background: var(--gold2); }
  .btn-outline { background: transparent; color: var(--ink); border: 1.5px solid var(--border2); }
  .btn-outline:hover { border-color: var(--ink); }
  .btn-sm { padding: 7px 14px; font-size: 12px; }
  .btn:disabled { opacity: 0.45; cursor: not-allowed; }

  .ai-response { background: linear-gradient(135deg, #0e0e0e 0%, #1a1a1a 100%); border-radius: var(--radius-lg); padding: 28px 32px; color: var(--white); position: relative; overflow: hidden; }
  .ai-response::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, var(--gold), transparent); }
  .ai-response .ai-label { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: var(--gold); margin-bottom: 14px; font-weight: 500; }
  .ai-response .ai-text { font-size: 14px; line-height: 1.8; color: rgba(255,255,255,0.88); white-space: pre-wrap; }

  .vision-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: #f0f4ff; border: 1px solid #c8d8ff; border-radius: 20px; font-size: 11px; color: #2244bb; font-weight: 500; margin-bottom: 12px; }

  .error-box { margin-top: 16px; padding: 14px 18px; background: #fef0ef; border: 1px solid #fcd5d2; border-radius: var(--radius); }
  .error-box .error-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--red); font-weight: 600; margin-bottom: 4px; }
  .error-box p { font-size: 13px; color: #5a2020; line-height: 1.5; }

  .upload-zone { border: 2px dashed var(--border2); border-radius: var(--radius-lg); padding: 32px; text-align: center; cursor: pointer; transition: all 0.2s; background: var(--paper); }
  .upload-zone:hover, .upload-zone.drag-over { border-color: var(--gold); background: rgba(201,168,76,0.04); }
  .upload-zone .uz-icon { font-size: 28px; margin-bottom: 10px; }
  .upload-zone h4 { font-size: 14px; font-weight: 500; color: var(--ink); margin-bottom: 4px; }
  .upload-zone p { font-size: 12px; color: var(--ink3); }

  .image-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; margin-top: 16px; }
  .image-thumb { aspect-ratio: 1; border-radius: var(--radius); overflow: hidden; position: relative; background: var(--paper2); border: 1px solid var(--border); }
  .image-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .image-thumb .img-remove { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); color: white; border: none; width: 20px; height: 20px; border-radius: 50%; cursor: pointer; font-size: 11px; display: flex; align-items: center; justify-content: center; }

  .loading-pulse { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--ink3); padding: 12px 0; }
  .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--gold); animation: pulse-anim 1.4s ease-in-out infinite; }
  .pulse-dot:nth-child(2) { animation-delay: 0.2s; }
  .pulse-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes pulse-anim { 0%,80%,100% { transform: scale(0.6); opacity: 0.4; } 40% { transform: scale(1); opacity: 1; } }

  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
  .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
  .row { display: flex; gap: 12px; align-items: center; }
  .row-between { display: flex; justify-content: space-between; align-items: center; }
  .mt8 { margin-top: 8px; } .mt16 { margin-top: 16px; } .mt24 { margin-top: 24px; }
  .mb16 { margin-bottom: 16px; } .mb24 { margin-bottom: 24px; }

  .stat-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px 24px; }
  .stat-label { font-size: 10px; letter-spacing: 2px; text-transform: uppercase; color: var(--ink3); margin-bottom: 8px; }
  .stat-value { font-family: var(--font-display); font-size: 32px; font-weight: 700; color: var(--ink); }
  .stat-sub { font-size: 12px; color: var(--ink3); margin-top: 4px; }

  .idea-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
  .idea-card { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 20px; cursor: pointer; transition: all 0.15s; box-shadow: var(--shadow); }
  .idea-card:hover { box-shadow: var(--shadow-lg); transform: translateY(-1px); }
  .idea-card-status { display: inline-flex; align-items: center; gap: 5px; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 600; padding: 3px 10px; border-radius: 10px; margin-bottom: 12px; }
  .status-capture { background: #e8f4ea; color: var(--green); }
  .status-filter { background: #fff4e0; color: #8a5f00; }
  .status-brief { background: #e8e8ff; color: #3333aa; }
  .status-approved { background: #e0ffe8; color: #1a6b35; }
  .idea-card-title { font-size: 15px; font-weight: 500; color: var(--ink); margin-bottom: 8px; }
  .idea-card-desc { font-size: 13px; color: var(--ink3); line-height: 1.5; }
  .idea-card-footer { margin-top: 14px; display: flex; justify-content: space-between; align-items: center; }

  .brief-doc { background: var(--white); border: 1px solid var(--border); border-radius: var(--radius-lg); overflow: hidden; }
  .brief-header { background: var(--ink); color: var(--white); padding: 28px 36px; position: relative; }
  .brief-header::after { content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, var(--gold), transparent); }
  .brief-header .brief-eyebrow { font-size: 9px; letter-spacing: 3px; text-transform: uppercase; color: var(--gold); margin-bottom: 10px; }
  .brief-header h3 { font-family: var(--font-display); font-size: 24px; font-weight: 700; margin-bottom: 6px; }
  .brief-header .brief-meta { font-size: 12px; color: rgba(255,255,255,0.5); }
  .brief-body { padding: 32px 36px; }

  .empty-state { text-align: center; padding: 60px 20px; }
  .empty-state .es-icon { font-size: 36px; margin-bottom: 16px; opacity: 0.5; }
  .empty-state h3 { font-family: var(--font-display); font-size: 20px; margin-bottom: 8px; color: var(--ink); }
  .empty-state p { font-size: 14px; color: var(--ink3); max-width: 360px; margin: 0 auto 24px; }

  .tab-bar { display: flex; gap: 0; margin-bottom: 28px; border-bottom: 1px solid var(--border); }
  .tab-btn { padding: 10px 20px; background: none; border: none; cursor: pointer; font-size: 13px; font-family: var(--font-body); color: var(--ink3); border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s; }
  .tab-btn.active { font-weight: 600; color: var(--ink); border-bottom-color: var(--gold); }

  .badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 10px; font-size: 10px; letter-spacing: 1px; font-weight: 600; text-transform: uppercase; }
  .badge-new { background: #e0ffe8; color: #1a6b35; }
  .badge-existing { background: #e8e8ff; color: #3333aa; }

  .notif { position: fixed; bottom: 24px; right: 24px; z-index: 999; background: var(--ink); color: var(--white); padding: 12px 20px; border-radius: var(--radius); font-size: 13px; box-shadow: var(--shadow-lg); animation: slide-in 0.25s ease; }
  @keyframes slide-in { from { transform: translateY(10px); opacity: 0; } }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 3px; }
`

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────
const Loading = ({ text = "Thinking..." }) => (
  <div className="loading-pulse">
    <div className="pulse-dot" /><div className="pulse-dot" /><div className="pulse-dot" />
    <span>{text}</span>
  </div>
)

const ErrorBox = ({ message }) => (
  <div className="error-box">
    <div className="error-label">Error</div>
    <p>{message}</p>
  </div>
)

const MultiSelect = ({ options, value = [], onChange }) => (
  <div className="multiselect-grid">
    {options.map(o => (
      <div key={o} className={`ms-option${value.includes(o) ? " selected" : ""}`}
        onClick={() => onChange(value.includes(o) ? value.filter(x => x !== o) : [...value, o])}>
        {o}
      </div>
    ))}
  </div>
)

const UploadZone = ({ images, onImages, label, hint }) => {
  const ref = useRef()
  const [drag, setDrag] = useState(false)
  const handleFiles = files => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/"))
    Promise.all(arr.map(f => new Promise(resolve => {
      const r = new FileReader()
      r.onload = e => resolve({ url: e.target.result, name: f.name })
      r.readAsDataURL(f)
    }))).then(imgs => onImages([...images, ...imgs]))
  }
  return (
    <div>
      <div className={`upload-zone${drag ? " drag-over" : ""}`}
        onClick={() => ref.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFiles(e.dataTransfer.files) }}>
        <div className="uz-icon">📎</div>
        <h4>{label || "Drop images here or click to upload"}</h4>
        <p>{hint || "JPG, PNG, WEBP"}</p>
        <input ref={ref} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
      </div>
      {images.length > 0 && (
        <div className="image-grid">
          {images.map((img, i) => (
            <div key={i} className="image-thumb">
              <img src={img.url} alt={img.name} />
              <button className="img-remove" onClick={() => onImages(images.filter((_, j) => j !== i))}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const QuestionForm = ({ questions, answers, onChange }) => (
  <div>
    {questions.map((q, i) => (
      <div key={q.id} className="form-group">
        <label className="form-label">
          <span className="q-number">Question {i + 1} of {questions.length}</span>
          {q.q}
        </label>
        {q.type === "text" && <input type="text" placeholder={q.placeholder} value={answers[q.id] || ""} onChange={e => onChange(q.id, e.target.value)} />}
        {q.type === "textarea" && <textarea className="big" placeholder={q.placeholder} value={answers[q.id] || ""} onChange={e => onChange(q.id, e.target.value)} />}
        {q.type === "select" && (
          <select value={answers[q.id] || ""} onChange={e => onChange(q.id, e.target.value)}>
            <option value="">Select...</option>
            {q.options.map(o => <option key={o}>{o}</option>)}
          </select>
        )}
        {q.type === "multiselect" && <MultiSelect options={q.options} value={answers[q.id]} onChange={v => onChange(q.id, v)} />}
      </div>
    ))}
  </div>
)

// ─── BRAND ONBOARDING ─────────────────────────────────────────────────────────
function BrandOnboarding({ brand, setBrand }) {
  const [step, setStep] = useState(brand ? "profile" : "type")
  const [brandType, setBrandType] = useState(brand?.type || null)
  const [answers, setAnswers] = useState(brand?.answers || {})
  const [images, setImages] = useState(brand?.images || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState(brand?.profile || null)
  const [notif, setNotif] = useState(null)

  const questions = brandType === "new" ? BRAND_QUESTIONS_NEW : BRAND_QUESTIONS_EXISTING
  const showNotif = msg => { setNotif(msg); setTimeout(() => setNotif(null), 3000) }

  const BRAND_SYSTEM = `You are a panel of the world's top creative directors and brand strategists — Virgil Abloh, Tom Ford, Lou Stoppard, Wieden+Kennedy, LVMH's brand architects. You have built and killed billion-dollar brands. You are here to be honest, not pleasing.

Analyse this brand and produce:

1. BRAND FOUNDATION — The core truth. Not what they said — what you read between the lines.
2. CREATIVE DIRECTION — The visual and emotional territory this brand must own. Specific.
3. BRAND CODES — 4-5 repeatable visual/tonal signals to build recognition over time.
4. TARGET CUSTOMER (REAL) — Who this person actually is based on all signals.
5. HONEST PUSHBACK — What is weak, contradictory, or naive. What will kill this brand if unaddressed.
6. STRATEGIC PRIORITIES — The 3 things they must get right before anything else.

Be authoritative. Do not flatter. Do not hedge.`

  const generateProfile = async () => {
    setLoading(true)
    setError(null)

    const filledAnswers = Object.entries(answers)
      .filter(([, v]) => v && (Array.isArray(v) ? v.length : String(v).trim()))
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : v}`)
      .join("\n")

    try {
      let result

      if (images.length > 0) {
        // Use GPT-4o vision for image-aware brand analysis
        const imageUrls = images.slice(0, 6).map(img => img.url)
        const prompt = `Brand questionnaire (${brandType} brand):\n\n${filledAnswers}\n\n${images.length} reference images uploaded above. Analyse answers AND images together.`
        result = await callVision(imageUrls, prompt, BRAND_SYSTEM)
      } else {
        result = await callClaude(
          [{ role: "user", content: `Brand questionnaire (${brandType} brand):\n\n${filledAnswers}` }],
          BRAND_SYSTEM,
          2000
        )
      }

      // Conflict analysis for existing brands
      let conflictResult = null
      if (brandType === "existing" && answers.current_customer && answers.intended_customer) {
        try {
          conflictResult = await callClaude(
            [{ role: "user", content: `Current customer: ${answers.current_customer}\nIntended customer: ${answers.intended_customer}\nBrand: ${answers.name}, Category: ${answers.category}\nRebrand status: ${answers.rebrand_question || "not specified"}` }],
            `Senior brand strategist. Analyse gap between actual and intended customers. Flag specific conflicts. If rebrand is suggested, flag risks. Direct. 2-3 paragraphs.`
          )
        } catch (_) {}
      }

      const newBrand = { type: brandType, answers, images, profile: result, conflict: conflictResult }
      setBrand(newBrand)
      setProfile(result)
      setStep("profile")
      showNotif("Brand profile generated")
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  if (step === "type") return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Brand Setup</div>
        <h2>Add your brand</h2>
        <p>Everything calibrates from this first answer. Be honest.</p>
      </div>
      <div className="page-content">
        <div className="two-col">
          {[
            { type: "new", icon: "✦", title: "New brand", desc: "Building from scratch. Vision exists but no established customer base yet.", badge: "badge-new", badgeText: "Starting fresh" },
            { type: "existing", icon: "◈", title: "Existing brand", desc: "Already trading. Real customer data, existing output, a track record to work with.", badge: "badge-existing", badgeText: "Already trading" }
          ].map(o => (
            <div key={o.type} className="card" onClick={() => setBrandType(o.type)}
              style={{ cursor: "pointer", border: `2px solid ${brandType === o.type ? "var(--gold)" : "var(--border)"}`, background: brandType === o.type ? "#fffbf0" : "var(--white)" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>{o.icon}</div>
              <div className="card-title" style={{ fontSize: 18, marginBottom: 6 }}>{o.title}</div>
              <p style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 12 }}>{o.desc}</p>
              <span className={`badge ${o.badge}`}>{o.badgeText}</span>
            </div>
          ))}
        </div>
        {brandType && (
          <div className="mt24">
            <button className="btn btn-primary" onClick={() => setStep("questions")}>Continue as {brandType} brand →</button>
          </div>
        )}
      </div>
    </div>
  )

  if (step === "questions") return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Brand Setup · {brandType === "new" ? "New brand" : "Existing brand"}</div>
        <h2>Tell us everything</h2>
        <p>Designed by the world's best brand strategists. Every answer shapes your creative foundation. Don't rush them.</p>
      </div>
      <div className="page-content">
        <div className="card">
          <QuestionForm questions={questions} answers={answers} onChange={(id, val) => setAnswers(p => ({ ...p, [id]: val }))} />
        </div>
        <div className="card mt16">
          <div className="card-title">Upload visual references</div>
          <div className="card-sub">
            Images tell us 80% of what words can't. These are analysed by GPT-4o vision — it reads mood, aesthetic territory, cultural signals, and quality markers.
          </div>
          <div className="vision-badge">👁 GPT-4o Vision — deep image analysis</div>
          <UploadZone images={images} onImages={setImages}
            label="Brand references, competitor examples, aspirational imagery"
            hint="Up to 6 images analysed in full detail alongside your answers" />
        </div>
        <div className="row mt24">
          <button className="btn btn-gold" onClick={generateProfile} disabled={loading || !answers.name}>
            {loading ? "Generating..." : "Generate brand profile →"}
          </button>
          <button className="btn btn-outline" onClick={() => setStep("type")}>Back</button>
        </div>
        {loading && <Loading text={images.length > 0 ? "GPT-4o reading your images + Claude building your profile..." : "Building your brand profile..."} />}
        {error && <ErrorBox message={error} />}
      </div>
      {notif && <div className="notif">{notif}</div>}
    </div>
  )

  if (step === "profile" && profile) return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Brand Profile · {brand?.answers?.name}</div>
        <h2>Your creative foundation</h2>
        <p>Generated from your answers{brand?.images?.length > 0 ? ` and ${brand.images.length} reference images` : ""}. This is your source of truth.</p>
      </div>
      <div className="page-content">
        {brand?.images?.length > 0 && (
          <div className="vision-badge mb16">👁 GPT-4o Vision analysed {brand.images.length} reference images</div>
        )}
        <div className="ai-response">
          <div className="ai-label">◈ Creative OS · Brand Analysis</div>
          <div className="ai-text">{profile}</div>
        </div>
        {brand?.conflict && (
          <div className="mt16" style={{ borderLeft: "3px solid var(--red)", background: "#fef8f8", padding: "16px 20px", borderRadius: "0 var(--radius) var(--radius) 0" }}>
            <div style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "var(--red)", fontWeight: 600, marginBottom: 6 }}>⚠ Customer conflict detected</div>
            <p style={{ fontSize: 13, color: "#5a2020", lineHeight: 1.6 }}>{brand.conflict}</p>
          </div>
        )}
        <div className="row mt24">
          <button className="btn btn-outline" onClick={() => setStep("questions")}>Refine answers →</button>
        </div>
      </div>
      {notif && <div className="notif">{notif}</div>}
    </div>
  )

  return null
}

// ─── MOODBOARD ────────────────────────────────────────────────────────────────
function Moodboard({ brand }) {
  const [tab, setTab] = useState("upload")
  const [uploads, setUploads] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [searchQ, setSearchQ] = useState("")
  const [trends, setTrends] = useState(null)

  const brandCtx = brand ? `Brand: ${brand.answers.name}, ${brand.answers.category}, ${brand.answers.price_point || "premium"}` : "Premium fashion/lifestyle brand"

  const analyseImages = async () => {
    if (!uploads.length) return
    setLoading(true); setError(null)
    try {
      const imageUrls = uploads.slice(0, 8).map(img => img.url)
      const prompt = `Analyse these ${uploads.length} images as creative references for a brand moodboard.\nBrand context: ${brandCtx}\n\nProvide:\n1. VISUAL TERRITORY — What aesthetic world do these images collectively point to?\n2. RECURRING SIGNALS — Specific visual elements, lighting, colour, composition patterns\n3. CULTURAL REFERENCES — Subcultures, movements, eras, aesthetics being drawn from\n4. TENSION POINTS — Any conflicting signals? Strongest vs weakest reference?\n5. SHOOT DIRECTION — Lighting, location, talent energy, styling direction based on these refs\n6. WHAT'S MISSING — What reference would complete this moodboard?\n\nBe specific about what you actually see. Not generic.`
      const sys = `Senior creative director with the visual intelligence of the world's best art directors. Analyse moodboard images with precision. Identify what images actually communicate, not what someone hopes they do.`
      const result = await callVision(imageUrls, prompt, sys)
      setAnalysis(result)
      setTab("analysis")
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const findTrends = async () => {
    setLoading(true); setError(null)
    try {
      const result = await callClaude(
        [{ role: "user", content: `${brandCtx}\nTheme: ${searchQ || "current visual trends"}\n\nIdentify current trends and cultural references for a creative shoot.` }],
        `Cultural intelligence analyst and trend forecaster. Knowledge of BOF, Dazed, 032c, Highsnobiety, i-D. Context: 2025-2026.\n\nProvide:\n1. ENTERING RELEVANCE — 3-4 aesthetic trends gaining momentum (not peaked, not dead)\n2. CULTURAL TOUCHSTONES — Specific artists, photographers, directors, films referenced in forward-thinking work right now\n3. VISUAL DIRECTIONS — Specific shoot concepts emerging (lighting, location, casting, styling)\n4. WHAT TO AVOID — What's oversaturated right now? What screams 2022?\n5. REFERENCES TO FIND — 5-6 specific reference images to search for on Pinterest (describe them precisely)\n6. THE COUNTER-INTUITIVE MOVE — What would the most culturally intelligent brands do that nobody else is?\n\nBe specific. Name names.`,
        2000
      )
      setTrends(result)
      setTab("trends")
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Creative Intelligence</div>
        <h2>Moodboard + references</h2>
        <p>Upload references. GPT-4o reads them and tells you what creative territory you're actually in — not what you hope you're in.</p>
      </div>
      <div className="page-content">
        <div className="tab-bar">
          {[["upload","Upload references"],["analysis","Image analysis"],["trends","Trend intelligence"]].map(([id, label]) => (
            <button key={id} className={`tab-btn${tab === id ? " active" : ""}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>

        {tab === "upload" && (
          <div className="card">
            <div className="card-title">Reference images</div>
            <div className="card-sub">Upload anything that represents the aesthetic territory you're exploring. The more honest, the better the analysis.</div>
            <div className="vision-badge">👁 GPT-4o Vision — reads aesthetic signals, cultural references, conflicts</div>
            <UploadZone images={uploads} onImages={setUploads}
              label="Reference images, inspo, competitor examples, mood references"
              hint="Up to 8 images — GPT-4o analyses each in full detail" />
            {uploads.length > 0 && (
              <div className="mt16">
                <button className="btn btn-primary" onClick={analyseImages} disabled={loading}>
                  {loading ? "Analysing..." : `Analyse ${uploads.length} image${uploads.length > 1 ? "s" : ""} →`}
                </button>
              </div>
            )}
            {loading && <Loading text="GPT-4o reading visual signals, cultural references, aesthetic territory..." />}
            {error && <ErrorBox message={error} />}
          </div>
        )}

        {tab === "analysis" && (
          analysis ? (
            <div className="ai-response">
              <div className="vision-badge" style={{ marginBottom: 16 }}>👁 GPT-4o Vision Analysis</div>
              <div className="ai-label">◈ Visual Intelligence</div>
              <div className="ai-text">{analysis}</div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="es-icon">👁</div>
              <h3>No analysis yet</h3>
              <p>Upload images in the references tab and run analysis.</p>
              <button className="btn btn-outline" onClick={() => setTab("upload")}>Upload references</button>
            </div>
          )
        )}

        {tab === "trends" && (
          <div>
            <div className="card mb16">
              <div className="card-title">Cultural intelligence</div>
              <div className="card-sub">What's entering relevance right now — before it's everywhere.</div>
              <div className="row mt8">
                <input type="text" placeholder="e.g. jewellery campaign, quiet luxury, SS26 menswear, urban streetwear..."
                  value={searchQ} onChange={e => setSearchQ(e.target.value)}
                  style={{ flex: 1 }} onKeyDown={e => e.key === "Enter" && findTrends()} />
                <button className="btn btn-gold" onClick={findTrends} disabled={loading}>
                  {loading ? "Searching..." : "Find trends →"}
                </button>
              </div>
              {loading && <Loading text="Scanning cultural signals and trend intelligence..." />}
              {error && <ErrorBox message={error} />}
            </div>
            {trends && (
              <div className="ai-response">
                <div className="ai-label">◈ Trend + Cultural Intelligence</div>
                <div className="ai-text">{trends}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── IDEA CAPTURE ─────────────────────────────────────────────────────────────
function IdeaCapture({ brand, ideas, setIdeas }) {
  const [view, setView] = useState("board")
  const [form, setForm] = useState({ title: "", desc: "", images: [] })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeIdea, setActiveIdea] = useState(null)

  const brandCtx = brand
    ? `Brand: ${brand.answers.name}\nCategory: ${brand.answers.category}\nProfile: ${brand.profile?.substring(0, 400) || ""}`
    : "Fashion/lifestyle brand"

  const submitIdea = () => {
    if (!form.title) return
    setIdeas(p => [{ id: Date.now(), ...form, status: "capture", createdAt: new Date().toISOString(), aiFilter: null }, ...p])
    setForm({ title: "", desc: "", images: [] })
    setView("board")
  }

  const filterIdea = async idea => {
    setLoading(true); setError(null); setActiveIdea(idea)
    try {
      let result
      const filterSystem = `Creative director running an idea filter. Assess whether this idea should advance, be developed, or be killed. Direct.\n\nOutput:\nVERDICT: Advance / Develop further / Kill it\nBRAND FIT: 1-5\nWHY: One paragraph — what's right, wrong, missing.\nPUSHBACK: The uncomfortable question this idea hasn't answered.\nIF WE ADVANCE: The one thing that must be true for this to work.`

      if (idea.images?.length > 0) {
        const imageUrls = idea.images.slice(0, 4).map(img => img.url)
        result = await callVision(imageUrls, `${brandCtx}\n\nIdea: ${idea.title}\nDescription: ${idea.desc}\n\nFilter this idea through the brand lens.`, filterSystem)
      } else {
        result = await callClaude(
          [{ role: "user", content: `${brandCtx}\n\nIdea: ${idea.title}\nDescription: ${idea.desc}` }],
          filterSystem
        )
      }
      const updated = { ...idea, status: "filter", aiFilter: result }
      setIdeas(p => p.map(i => i.id === idea.id ? updated : i))
      setActiveIdea(updated)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const statusColors = { capture: "status-capture", filter: "status-filter", brief: "status-brief", approved: "status-approved" }
  const statusLabels = { capture: "Captured", filter: "In review", brief: "Briefed", approved: "Approved" }

  if (view === "submit") return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Idea Capture</div>
        <h2>Submit an idea</h2>
        <p>Be messy. Be incomplete. Get it out of your head and into the system.</p>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="form-group">
            <label className="form-label">What's the idea?</label>
            <input type="text" placeholder="e.g. Underground car park shoot, Candlelit gold editorial..." value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Describe it. As much or as little as you have.</label>
            <textarea className="big" placeholder="The feeling, location, talent, product, vibe — whatever you have. Unfiltered." value={form.desc} onChange={e => setForm(p => ({ ...p, desc: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Reference images (optional)</label>
            <div className="vision-badge">👁 GPT-4o will analyse these when filtering the idea</div>
            <UploadZone images={form.images} onImages={imgs => setForm(p => ({ ...p, images: imgs }))}
              label="Any visual references for this idea" hint="Screenshots, saves, anything capturing the feeling" />
          </div>
          <div className="row mt16">
            <button className="btn btn-primary" onClick={submitIdea} disabled={!form.title}>Submit idea →</button>
            <button className="btn btn-outline" onClick={() => setView("board")}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Creative Pipeline</div>
        <h2>Idea board</h2>
        <p>Capture → Filter → Brief → Approved. AI filters at every stage.</p>
      </div>
      <div className="page-content">
        <div className="row-between mb24">
          <div className="row">
            {["capture","filter","brief","approved"].map(s => (
              <span key={s} style={{ fontSize: 12, padding: "3px 10px", borderRadius: 10, background: ideas.filter(i=>i.status===s).length ? "var(--ink)" : "var(--paper2)", color: ideas.filter(i=>i.status===s).length ? "var(--white)" : "var(--ink3)", marginRight: 4 }}>
                {statusLabels[s]} ({ideas.filter(i => i.status === s).length})
              </span>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => setView("submit")}>+ Capture idea</button>
        </div>

        {ideas.length === 0 ? (
          <div className="empty-state">
            <div className="es-icon">💡</div>
            <h3>No ideas yet</h3>
            <p>Submit anything — a feeling, a location, a reference image. The system tightens it.</p>
            <button className="btn btn-gold" onClick={() => setView("submit")}>Submit your first idea</button>
          </div>
        ) : (
          <div className="idea-grid">
            {ideas.map(idea => (
              <div key={idea.id} className="idea-card" onClick={() => setActiveIdea(activeIdea?.id === idea.id ? null : idea)}>
                <span className={`idea-card-status ${statusColors[idea.status]}`}>{statusLabels[idea.status]}</span>
                <div className="idea-card-title">{idea.title}</div>
                <div className="idea-card-desc">{idea.desc?.substring(0, 100)}{idea.desc?.length > 100 ? "..." : ""}</div>
                {idea.images?.length > 0 && (
                  <div className="row mt8" style={{ gap: 4 }}>
                    {idea.images.slice(0, 3).map((img, i) => <img key={i} src={img.url} style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4 }} />)}
                  </div>
                )}
                <div className="idea-card-footer">
                  <span style={{ fontSize: 11, color: "var(--ink3)" }}>{new Date(idea.createdAt).toLocaleDateString()}</span>
                  <div className="row" style={{ gap: 6 }}>
                    {idea.status === "capture" && <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); filterIdea(idea) }}>Filter →</button>}
                    {idea.status === "filter" && <button className="btn btn-sm btn-outline" onClick={e => { e.stopPropagation(); setIdeas(p => p.map(i => i.id === idea.id ? { ...i, status: "brief" } : i)) }}>To brief →</button>}
                    {idea.status === "brief" && <button className="btn btn-sm" style={{ background: "var(--green)", color: "white", border: "none", padding: "7px 14px", borderRadius: 4, fontSize: 12, cursor: "pointer" }} onClick={e => { e.stopPropagation(); setIdeas(p => p.map(i => i.id === idea.id ? { ...i, status: "approved" } : i)) }}>Approve ✓</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeIdea?.aiFilter && (
          <div className="card mt24">
            <div className="row-between mb16">
              <div className="card-title">Filter result: {activeIdea.title}</div>
              <button className="btn btn-sm btn-outline" onClick={() => setActiveIdea(null)}>Close</button>
            </div>
            <div className="ai-response">
              <div className="ai-label">◈ Creative Director Filter{activeIdea.images?.length > 0 ? " · GPT-4o Vision" : ""}</div>
              <div className="ai-text">{activeIdea.aiFilter}</div>
            </div>
          </div>
        )}
        {loading && <Loading text="Filtering idea through brand lens..." />}
        {error && <ErrorBox message={error} />}
      </div>
    </div>
  )
}

// ─── BRIEF BUILDER ────────────────────────────────────────────────────────────
function BriefBuilder({ brand, briefs, setBriefs }) {
  const [view, setView] = useState("list")
  const [answers, setAnswers] = useState({})
  const [images, setImages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeBrief, setActiveBrief] = useState(null)
  const [feedback, setFeedback] = useState("")
  const [iterating, setIterating] = useState(false)

  const BRIEF_SYSTEM = `Senior creative director and production lead building a shoot brief handed to photographer, stylist, talent, lighting director. Clear enough to run without you in the room. Alive enough that the team is excited.\n\nSections:\nPROJECT OVERVIEW — What, for what purpose, what success looks like.\nCREATIVE CONCEPT — The idea. Feeling, story, world. What the team needs to feel before stepping on set.\nVISUAL DIRECTION — Lighting quality, colour temperature, contrast, composition, camera angles. Specific.\nTALENT + CASTING — Energy, presence, physicality, styling. What does ideal talent feel like?\nLOCATION + SET — Precise. What does the space look, smell, feel like?\nSHOT LIST — Required shots (non-negotiable) and creative shots (where magic happens). Numbered list.\nTECHNICAL SPECS — Format, resolution, deliverable sizes per platform, file naming.\nCREATIVE PUSHBACK — The biggest risk this brief doesn't account for. The question that must be answered before shoot day.\n\nWorld-class creative agency quality. Specific. Alive. Executable.`

  const generateBrief = async () => {
    setLoading(true); setError(null)
    const brandCtx = brand ? `Brand: ${brand.answers.name}\nCategory: ${brand.answers.category}\nProfile: ${brand.profile?.substring(0, 500) || ""}` : ""
    const answersText = BRIEF_QUESTIONS.map(q => `${q.q}: ${Array.isArray(answers[q.id]) ? answers[q.id].join(", ") : answers[q.id] || "Not specified"}`).join("\n")

    try {
      let result
      if (images.length > 0) {
        const imageUrls = images.slice(0, 6).map(img => img.url)
        result = await callVision(imageUrls, `${brandCtx}\n\nBrief inputs:\n${answersText}\n\nVisual references: ${images.length} images uploaded above. Incorporate visual analysis into the brief direction.`, BRIEF_SYSTEM)
      } else {
        result = await callClaude([{ role: "user", content: `${brandCtx}\n\nBrief inputs:\n${answersText}` }], BRIEF_SYSTEM, 2500)
      }
      const newBrief = { id: Date.now(), title: answers.project_name || "Untitled brief", content: result, answers, images, createdAt: new Date().toISOString(), version: 1, history: [result] }
      setBriefs(p => [newBrief, ...p])
      setActiveBrief(newBrief)
      setView("brief")
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const iterateBrief = async () => {
    if (!feedback || !activeBrief) return
    setIterating(true)
    try {
      const result = await callClaude(
        [{ role: "user", content: `Current brief:\n\n${activeBrief.content}\n\nFeedback: ${feedback}\n\nRevise the brief based on this feedback. Output the full revised brief.` }],
        `Senior creative director who wrote this brief. Take feedback and revise. Don't hedge. Make it better.`,
        2500
      )
      const updated = { ...activeBrief, content: result, version: activeBrief.version + 1, history: [...activeBrief.history, result] }
      setActiveBrief(updated)
      setBriefs(p => p.map(b => b.id === activeBrief.id ? updated : b))
      setFeedback("")
    } catch (e) { setError(e.message) }
    setIterating(false)
  }

  if (view === "create") return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Brief Builder</div>
        <h2>Build a shoot brief</h2>
        <p>Answer what you know. Leave blank what you don't. The AI fills gaps and calls out what's missing.</p>
      </div>
      <div className="page-content">
        <div className="card">
          <QuestionForm questions={BRIEF_QUESTIONS} answers={answers} onChange={(id, val) => setAnswers(p => ({ ...p, [id]: val }))} />
        </div>
        <div className="card mt16">
          <div className="card-title">Reference images for this brief</div>
          <div className="card-sub">Images specific to this shoot — location ideas, talent direction, styling references, mood.</div>
          <div className="vision-badge">👁 GPT-4o Vision — visual direction incorporated directly into the brief</div>
          <UploadZone images={images} onImages={setImages} label="Shoot references, location inspo, talent direction" hint="GPT-4o analyses and incorporates into brief direction" />
        </div>
        <div className="row mt24">
          <button className="btn btn-gold" onClick={generateBrief} disabled={loading}>
            {loading ? "Building brief..." : "Generate brief →"}
          </button>
          <button className="btn btn-outline" onClick={() => setView("list")}>Cancel</button>
        </div>
        {loading && <Loading text={images.length > 0 ? "GPT-4o reading references + building brief..." : "Building your shoot brief..."} />}
        {error && <ErrorBox message={error} />}
      </div>
    </div>
  )

  if (view === "brief" && activeBrief) return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Brief · v{activeBrief.version}</div>
        <h2>{activeBrief.title}</h2>
        <p>{new Date(activeBrief.createdAt).toLocaleDateString()} · {activeBrief.history.length} version{activeBrief.history.length > 1 ? "s" : ""}</p>
      </div>
      <div className="page-content">
        <div className="brief-doc">
          <div className="brief-header">
            <div className="brief-eyebrow">Creative Brief · {brand?.answers?.name || "Brand"}</div>
            <h3>{activeBrief.title}</h3>
            <div className="brief-meta">v{activeBrief.version} · {new Date(activeBrief.createdAt).toLocaleDateString()}{activeBrief.images?.length > 0 ? ` · GPT-4o vision analysis included` : ""}</div>
          </div>
          <div className="brief-body">
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "var(--ink2)", lineHeight: 1.8 }}>{activeBrief.content}</div>
          </div>
        </div>
        <div className="card mt24">
          <div className="card-title">Iterate with feedback</div>
          <div className="card-sub">Tell the AI what to change. It rewrites the full brief. Every version saved.</div>
          <textarea placeholder="e.g. Location direction too vague. Push the casting harder. Remove product shots, focus on lifestyle..." value={feedback} onChange={e => setFeedback(e.target.value)} style={{ minHeight: 80 }} />
          <div className="row mt12">
            <button className="btn btn-primary" onClick={iterateBrief} disabled={iterating || !feedback}>
              {iterating ? "Rewriting..." : "Iterate brief →"}
            </button>
            <button className="btn btn-outline" onClick={() => setView("list")}>Back to briefs</button>
          </div>
          {iterating && <Loading text="Rewriting brief based on your feedback..." />}
          {error && <ErrorBox message={error} />}
        </div>
      </div>
    </div>
  )

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Production</div>
        <h2>Brief library</h2>
        <p>Every brief created, versioned, ready to share with your production team.</p>
      </div>
      <div className="page-content">
        <div className="row-between mb24">
          <span style={{ fontSize: 13, color: "var(--ink3)" }}>{briefs.length} brief{briefs.length !== 1 ? "s" : ""}</span>
          <button className="btn btn-primary" onClick={() => { setAnswers({}); setImages([]); setView("create") }}>+ New brief</button>
        </div>
        {briefs.length === 0 ? (
          <div className="empty-state">
            <div className="es-icon">📋</div>
            <h3>No briefs yet</h3>
            <p>Build your first brief. Answer what you know — the AI builds the full document.</p>
            <button className="btn btn-gold" onClick={() => setView("create")}>Create first brief</button>
          </div>
        ) : (
          <div className="idea-grid">
            {briefs.map(brief => (
              <div key={brief.id} className="idea-card" onClick={() => { setActiveBrief(brief); setView("brief") }}>
                <span className="idea-card-status status-approved">Brief v{brief.version}</span>
                <div className="idea-card-title">{brief.title}</div>
                <div className="idea-card-desc">{brief.content?.substring(0, 120)}...</div>
                <div className="idea-card-footer">
                  <span style={{ fontSize: 11, color: "var(--ink3)" }}>{new Date(brief.createdAt).toLocaleDateString()}</span>
                  <span style={{ fontSize: 11, color: "var(--gold)" }}>Open →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LOCATION FINDER ──────────────────────────────────────────────────────────
function LocationFinder({ brand }) {
  const [city, setCity] = useState("")
  const [type, setType] = useState("")
  const [vibe, setVibe] = useState("")
  const [budget, setBudget] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState(null)

  const find = async () => {
    if (!city) return
    setLoading(true); setError(null)
    const brandCtx = brand ? `Brand: ${brand.answers.name}, ${brand.answers.category}, ${brand.answers.price_point || "premium"}` : "Premium fashion brand"
    try {
      const result = await callClaude(
        [{ role: "user", content: `${brandCtx}\nCity: ${city}\nType: ${type || "flexible"}\nVibe: ${vibe || "not specified"}\nBudget: ${budget || "not specified"}` }],
        `Senior production manager and location scout. Real knowledge of global shoot locations — actual studios, scouts, real locations.\n\nProvide:\n1. TOP 3 STUDIOS — Named studios in this city. Name, what makes it right, day rate range, insider notes.\n2. TOP 3 REAL LOCATIONS — Specific named places. Area/address, permit requirements, best time of day, access notes.\n3. LOCATION SCOUTS — Specific agencies or scouts operating in this city.\n4. PRODUCTION COMPANIES — 2-3 local companies specialising in fashion/commercial shoots.\n5. PRACTICAL NOTES — Permit process, seasonal considerations, common trip-ups.\n6. THE UNEXPECTED OPTION — One left-field location few brands have used but would be perfect.\n\nBe specific. Real names. Flag uncertainty rather than invent.`,
        2000
      )
      setResults(result)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Production Intelligence</div>
        <h2>Location + studio finder</h2>
        <p>Real studios, locations, scouts and production contacts — by city.</p>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="two-col">
            <div className="form-group">
              <label className="form-label">City</label>
              <input type="text" placeholder="London, Paris, New York, Lagos, Tokyo..." value={city} onChange={e => setCity(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Location type</label>
              <select value={type} onChange={e => setType(e.target.value)}>
                <option value="">Any / suggest</option>
                {["Studio — white cyc","Studio — set-dressed","Studio — industrial","Outdoor — urban","Outdoor — natural","Interior — residential","Interior — commercial","Rooftop","Brutalist architecture"].map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Creative vibe</label>
            <input type="text" placeholder="raw industrial, soft luxury, cinematic, street-level gritty, editorial clean..." value={vibe} onChange={e => setVibe(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Budget range</label>
            <select value={budget} onChange={e => setBudget(e.target.value)}>
              <option value="">Not specified</option>
              {["Under £500/day","£500–£1,500/day","£1,500–£3,000/day","£3,000+/day"].map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <button className="btn btn-gold" onClick={find} disabled={loading || !city}>
            {loading ? "Searching..." : "Find locations →"}
          </button>
          {loading && <Loading text="Finding studios, locations, scouts and production contacts..." />}
          {error && <ErrorBox message={error} />}
        </div>
        {results && (
          <div className="ai-response mt16">
            <div className="ai-label">◈ Location Intelligence · {city}</div>
            <div className="ai-text">{results}</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── SHOT LIST ────────────────────────────────────────────────────────────────
function ShotList({ brand, briefs }) {
  const [selectedBriefId, setSelectedBriefId] = useState("")
  const [product, setProduct] = useState("")
  const [formats, setFormats] = useState([])
  const [notes, setNotes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  const generate = async () => {
    setLoading(true); setError(null)
    const brief = briefs.find(b => b.id === parseInt(selectedBriefId))
    const brandCtx = brand ? `Brand: ${brand.answers.name}, ${brand.answers.category}` : "Fashion brand"
    try {
      const res = await callClaude(
        [{ role: "user", content: `${brandCtx}\n${brief ? `Brief: ${brief.title}\n${brief.content?.substring(0,500)}` : ""}\nProduct: ${product}\nFormats: ${formats.join(", ")}\nNotes: ${notes}` }],
        `Production director building a comprehensive shot list for a fashion/product shoot. You've done hundreds. You know what gets missed.\n\nBuild:\nMANDATORY SHOTS — Non-negotiable product coverage. Numbered. Shot type, framing, styling, technical notes.\nHERO SHOTS — The 3-5 campaign-defining images. What they need to look like, feel like, deliver.\nFORMAT CUTS — Platform-specific framing to plan for. Which shots need to be composed for which platform.\nDETAIL SHOTS — Product close-ups, material stories, credibility shots.\nLIFESTYLE MOMENTS — Product in a world. Not just on body — the surrounding story.\nBTS CONTENT — 3-4 specific BTS shots worth capturing.\nPRODUCTION NOTES — Flagged risks, sequence recommendations, photographer pre-arrival notes.\n\nClean, numbered, usable on set.`,
        2000
      )
      setResult(res)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Production</div>
        <h2>Shot list generator</h2>
        <p>Tell the AI what you're shooting and what formats you need. It builds a complete ordered shot list for the photographer.</p>
      </div>
      <div className="page-content">
        <div className="card">
          {briefs.length > 0 && (
            <div className="form-group">
              <label className="form-label">Pull from an existing brief (optional)</label>
              <select value={selectedBriefId} onChange={e => setSelectedBriefId(e.target.value)}>
                <option value="">No brief — manual inputs</option>
                {briefs.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
              </select>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Product / collection</label>
            <input type="text" placeholder="e.g. Diamond Cuban chain, SS26 ring collection..." value={product} onChange={e => setProduct(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Deliverable formats</label>
            <MultiSelect
              options={["Instagram square 1:1","Instagram portrait 4:5","Instagram Reels 9:16","TikTok 9:16","Website hero 16:9","Pinterest 2:3","Print A4","Email banner"]}
              value={formats} onChange={setFormats} />
          </div>
          <div className="form-group">
            <label className="form-label">Additional notes</label>
            <textarea placeholder="Lighting, specific angles, restrictions, talent notes..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button className="btn btn-gold" onClick={generate} disabled={loading || !product}>
            {loading ? "Building..." : "Generate shot list →"}
          </button>
          {loading && <Loading text="Building a complete shot list..." />}
          {error && <ErrorBox message={error} />}
        </div>
        {result && (
          <div className="brief-doc mt16">
            <div className="brief-header">
              <div className="brief-eyebrow">Shot List · {brand?.answers?.name || "Brand"}</div>
              <h3>{product}</h3>
              <div className="brief-meta">{formats.join(" · ")}</div>
            </div>
            <div className="brief-body">
              <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "var(--ink2)", lineHeight: 1.8 }}>{result}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ brand, ideas, briefs, setActive }) {
  return (
    <div>
      <div className="page-header">
        <div className="page-header-eyebrow">Overview</div>
        <h2>{brand ? brand.answers.name || "Your Brand" : "Creative OS"}</h2>
        <p>{brand ? "Your creative intelligence system is active." : "Add your brand to get started."}</p>
      </div>
      <div className="page-content">
        {!brand ? (
          <div className="empty-state">
            <div className="es-icon">◎</div>
            <h3>No brand added yet</h3>
            <p>Start by adding your brand. The system asks the right questions, analyses your references with GPT-4o vision, and builds your creative foundation.</p>
            <button className="btn btn-primary" onClick={() => setActive("brand")}>Add your brand →</button>
          </div>
        ) : (
          <>
            <div className="three-col mb24">
              <div className="stat-card">
                <div className="stat-label">Brand type</div>
                <div className="stat-value" style={{ fontSize: 24 }}>{brand.type === "new" ? "New" : "Existing"}</div>
                <div className="stat-sub">{brand.answers.category || "—"}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Ideas captured</div>
                <div className="stat-value">{ideas.length}</div>
                <div className="stat-sub">{ideas.filter(i => i.status === "approved").length} approved</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Briefs created</div>
                <div className="stat-value">{briefs.length}</div>
                <div className="stat-sub">Ready to execute</div>
              </div>
            </div>
            {brand.profile && (
              <div className="card">
                <div className="card-title">Brand foundation</div>
                <div className="card-sub">Core principles from your onboarding{brand.images?.length > 0 ? ` · ${brand.images.length} images analysed by GPT-4o` : ""}</div>
                <div style={{ whiteSpace: "pre-wrap", fontSize: 14, color: "var(--ink2)", lineHeight: 1.7 }}>{brand.profile.substring(0, 600)}...</div>
                <button className="btn btn-outline btn-sm mt16" onClick={() => setActive("brand")}>View full profile →</button>
              </div>
            )}
            <div className="two-col mt16">
              <div className="card" style={{ cursor: "pointer" }} onClick={() => setActive("ideas")}>
                <div className="card-title">💡 Idea capture</div>
                <div className="card-sub">Submit ideas through the brand filter pipeline</div>
                <button className="btn btn-outline btn-sm mt16">Open →</button>
              </div>
              <div className="card" style={{ cursor: "pointer" }} onClick={() => setActive("brief")}>
                <div className="card-title">📋 Brief builder</div>
                <div className="card-sub">Create and iterate shoot briefs with AI + vision</div>
                <button className="btn btn-outline btn-sm mt16">Open →</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ─── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState("home")
  const [brand, setBrand] = useState(null)
  const [ideas, setIdeas] = useState([])
  const [briefs, setBriefs] = useState([])

  const nav = [
    { section: "Brand", items: [
      { id: "home", icon: "◉", label: "Dashboard" },
      { id: "brand", icon: "◈", label: "Brand profile", dot: !!brand },
    ]},
    { section: "Creative", items: [
      { id: "moodboard", icon: "▣", label: "Moodboard + refs" },
      { id: "ideas", icon: "◇", label: "Idea capture", dot: ideas.some(i => i.status === "approved") },
    ]},
    { section: "Production", items: [
      { id: "brief", icon: "▤", label: "Brief builder" },
      { id: "shots", icon: "⊡", label: "Shot list" },
      { id: "location", icon: "⊕", label: "Location finder" },
    ]},
  ]

  const pages = { home: <Dashboard brand={brand} ideas={ideas} briefs={briefs} setActive={setActive} />, brand: <BrandOnboarding brand={brand} setBrand={setBrand} />, moodboard: <Moodboard brand={brand} />, ideas: <IdeaCapture brand={brand} ideas={ideas} setIdeas={setIdeas} />, brief: <BriefBuilder brand={brand} briefs={briefs} setBriefs={setBriefs} />, shots: <ShotList brand={brand} briefs={briefs} />, location: <LocationFinder brand={brand} /> }

  return (
    <>
      <style>{styles}</style>
      <div className="app">
        <div className="sidebar">
          <div className="sidebar-logo">
            <h1>Creative OS</h1>
            <span>Brand intelligence</span>
          </div>
          <nav className="sidebar-nav">
            {nav.map(section => (
              <div key={section.section}>
                <div className="nav-section-label">{section.section}</div>
                {section.items.map(item => (
                  <div key={item.id} className={`nav-item${active === item.id ? " active" : ""}`} onClick={() => setActive(item.id)}>
                    <span className="nav-icon">{item.icon}</span>
                    {item.label}
                    {item.dot && <span className="nav-dot" />}
                  </div>
                ))}
              </div>
            ))}
          </nav>
          {brand && (
            <div className="sidebar-brand">
              <div className="sb-label">Active brand</div>
              <div className="sb-name">{brand.answers.name}</div>
              <div className="sb-meta">{brand.answers.category} · {brand.type}</div>
            </div>
          )}
        </div>
        <main className="main">{pages[active]}</main>
      </div>
    </>
  )
}
