/* global React, ReactDOM, TweaksPanel, useTweaks, TweakSection, TweakSlider, TweakRadio, TweakColor, TweakToggle, TweakSelect */
const { useState, useEffect, useMemo, useRef, useCallback } = React;

// ─────────────────────────────────────────────────────────────────────
// Seed data — derived from the YW Team spreadsheet.
// L3 reporting is an assumption (AG/Redi → Thanh, BM → Nhut); editable.
// ─────────────────────────────────────────────────────────────────────
const SEED = [
  { id: "u1", name: "Mathew George",  role: "Director",        scope: "Design & Business", email: "mathew@yw.com", level: 1, parent: null, skills: ["Strategy", "Design", "Business"] },
  { id: "u2", name: "Sam Nguyen",     role: "Project Manager", scope: "",                  email: "sam@yw.com",    level: 2, parent: "u1", skills: ["Delivery", "Planning"] },
  { id: "u3", name: "Nhut Pham",      role: "Director",        scope: "Operations",        email: "nhut@yw.com",   level: 2, parent: "u1", skills: ["Ops", "Finance"] },
  { id: "u4", name: "Thanh Nguyen",   role: "Design Manager",  scope: "",                  email: "thanh@yw.com",  level: 2, parent: "u1", skills: ["Design", "Mentoring"] },
  { id: "u5", name: "Khoa Nguyen",    role: "Lead",            scope: "AG",                email: "khoa@yw.com",   level: 3, parent: "u4", skills: ["AG", "Concept"] },
  { id: "u6", name: "Quynh Nguyen",   role: "Lead",            scope: "AG",                email: "quynh@yw.com",  level: 3, parent: "u4", skills: ["AG", "Documentation"] },
  { id: "u7", name: "Duy Nguyen",     role: "Lead",            scope: "BM",                email: "duy@yw.com",    level: 3, parent: "u3", skills: ["BM", "Ops"] },
  { id: "u8", name: "Giao Nguyen",    role: "Lead",            scope: "Redi",              email: "giao@yw.com",   level: 3, parent: "u4", skills: ["Redi", "Design"] },
  { id: "u9", name: "Dang Nguyen",    role: "QS Lead",         scope: "Redi",              email: "dang@yw.com",   level: 3, parent: "u4", skills: ["Redi", "QS"] },
];

// ─────────────────────────────────────────────────────────────────────
// Firebase config — paste your values from Firebase Console:
// Project Settings → Your apps → Firebase SDK snippet → Config
// ─────────────────────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  apiKey:            "AIzaSyCi-jRNUhbujCe0cN4z2ch7QIX5EJN3qQA",
  authDomain:        "org-chart-b2ae0.firebaseapp.com",
  databaseURL:       "https://org-chart-b2ae0-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "org-chart-b2ae0",
  storageBucket:     "org-chart-b2ae0.firebasestorage.app",
  messagingSenderId: "761712205749",
  appId:             "1:761712205749:web:10ad131c696e719ced03fc",
};
firebase.initializeApp(FIREBASE_CONFIG);
const PEOPLE_REF = firebase.database().ref("orgchart/people");
const EDIT_REF   = firebase.database().ref("orgchart/lastEdit");

const timeAgo = (ts) => {
  const d = Date.now() - ts;
  if (d < 60000)     return "just now";
  if (d < 3600000)   return Math.floor(d / 60000) + "m ago";
  if (d < 86400000)  return Math.floor(d / 3600000) + "h ago";
  return Math.floor(d / 86400000) + "d ago";
};

const initials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ─────────────────────────────────────────────────────────────────────
// Tweaks defaults — wrapped in EDITMODE markers so host can persist them
// ─────────────────────────────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#4A90E2",
  "density": "regular",
  "showEmail": false,
  "showScope": true,
  "showIds": false,
  "nodeSpacing": 26,
  "lineColor": "#C9C9C9",
  "lineWeight": 1,
  "lineStyle": "solid"
}/*EDITMODE-END*/;

// ─────────────────────────────────────────────────────────────────────
// Avatar — circular, initials fallback, optional image
// ─────────────────────────────────────────────────────────────────────
function Avatar({ src, name }) {
  return (
    <div className="avatar">
      {src ? <img src={src} alt={name} /> : <span>{initials(name)}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Node card
// ─────────────────────────────────────────────────────────────────────
function NodeCard({ person, onEdit, showEmail, showScope, showId, drag, canEdit }) {
  const isDragging = drag.draggingId === person.id;
  const isTarget   = drag.dropTargetId === person.id;
  const isInvalid  = drag.draggingId && drag.invalidIds.has(person.id) && !isDragging;

  const cls = [
    "node",
    isDragging && "is-dragging",
    isTarget && "drop-target",
    isInvalid && "drop-invalid",
  ].filter(Boolean).join(" ");

  const cardStyle = person.color ? { borderTopColor: person.color } : {};

  return (
    <div className={cls} style={cardStyle}
      draggable={canEdit && !isInvalid}
      onDragStart={canEdit ? (e) => {
        e.dataTransfer.setData("text/x-orgchart-id", person.id);
        e.dataTransfer.effectAllowed = "move";
        drag.onDragStart(person.id);
      } : undefined}
      onDragEnd={canEdit ? () => drag.onDragEnd() : undefined}
      onDragOver={canEdit ? (e) => {
        if (!drag.draggingId || isDragging || isInvalid) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        drag.onDragOver(person.id);
      } : undefined}
      onDragLeave={canEdit ? () => drag.onDragLeave(person.id) : undefined}
      onDrop={canEdit ? (e) => {
        e.preventDefault();
        if (!drag.draggingId || isDragging || isInvalid) return;
        drag.onDrop(person.id);
      } : undefined}
      onClick={() => { if (canEdit && !drag.draggingId) onEdit(person.id); }}
      role={canEdit ? "button" : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onKeyDown={canEdit ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onEdit(person.id); } } : undefined}>
      {showId && <span className="node-id">L{person.level} · {person.id.toUpperCase()}</span>}
      {canEdit && (
        <button className="node-edit" aria-label="Edit" onClick={(e) => { e.stopPropagation(); onEdit(person.id); }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
          </svg>
        </button>
      )}
      <Avatar src={person.avatar} name={person.name} />
      <h3 className="node-name">{person.name}</h3>
      <p className="node-role">{person.role}</p>
      {showEmail && person.email && <div className="node-email">{person.email}</div>}
      {(person.skills?.length > 0 || (showScope && person.scope)) && (
        <div className="tags">
          {showScope && person.scope && <span className="tag accent">{person.scope}</span>}
          {(person.skills || []).map((s, i) => <span key={i} className="tag">{s}</span>)}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Tree renderer — recursive <ul><li>
// ─────────────────────────────────────────────────────────────────────
function TreeNode({ id, byParent, peopleById, onEdit, opts, drag, canEdit }) {
  const person = peopleById[id];
  const children = byParent[id] || [];
  if (!person) return null;
  return (
    <li>
      <NodeCard person={person} onEdit={onEdit}
        showEmail={opts.showEmail} showScope={opts.showScope} showId={opts.showIds}
        drag={drag} canEdit={canEdit} />
      {children.length > 0 && (
        <ul>
          {children.map((c) => (
            <TreeNode key={c.id} id={c.id} byParent={byParent} peopleById={peopleById}
                      onEdit={onEdit} opts={opts} drag={drag} canEdit={canEdit} />
          ))}
        </ul>
      )}
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Edit modal
// ─────────────────────────────────────────────────────────────────────
function EditModal({ person, allPeople, onClose, onSave, onDelete }) {
  const [draft, setDraft] = useState(person);
  const [skillInput, setSkillInput] = useState("");
  const fileRef = useRef(null);

  useEffect(() => { setDraft(person); setSkillInput(""); }, [person]);

  // Esc to close
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const handleAvatar = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 1_200_000) { alert("Image is large — please pick something under 1.2MB."); return; }
    const reader = new FileReader();
    reader.onload = () => set("avatar", reader.result);
    reader.readAsDataURL(f);
  };

  const addSkill = (s) => {
    const v = (s || "").trim();
    if (!v) return;
    if ((draft.skills || []).includes(v)) return;
    set("skills", [...(draft.skills || []), v]);
    setSkillInput("");
  };
  const removeSkill = (s) => set("skills", (draft.skills || []).filter(x => x !== s));

  // parent options: anyone except this person and their descendants
  const parentOptions = useMemo(() => {
    const banned = new Set([draft.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const p of allPeople) {
        if (p.parent && banned.has(p.parent) && !banned.has(p.id)) {
          banned.add(p.id); grew = true;
        }
      }
    }
    return allPeople.filter(p => !banned.has(p.id));
  }, [allPeople, draft.id]);

  const submit = (e) => {
    e?.preventDefault?.();
    // re-derive level from parent depth
    let level = 1;
    const byId = Object.fromEntries(allPeople.map(p => [p.id, p]));
    let cur = draft.parent;
    while (cur && byId[cur]) { level++; cur = byId[cur].parent; }
    onSave({ ...draft, level });
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Edit team member">
        <div className="modal-hd">
          <div>
            <h2>Edit team member</h2>
            <div className="sub">{draft.id.toUpperCase()} · Level {draft.level}</div>
          </div>
          <button className="modal-x" onClick={onClose} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18"/>
            </svg>
          </button>
        </div>

        <form className="modal-body" onSubmit={submit}>
          <div className="avatar-row">
            <Avatar src={draft.avatar} name={draft.name} />
            <div className="avatar-actions">
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                {draft.avatar ? "Replace photo" : "Upload photo"}
              </button>
              {draft.avatar && (
                <button type="button" className="btn btn-ghost" onClick={() => set("avatar", null)}>
                  Remove
                </button>
              )}
              <div className="hint">PNG / JPG · 60×60 minimum</div>
              <input ref={fileRef} type="file" accept="image/*" className="visually-hidden" onChange={handleAvatar} />
            </div>
          </div>

          <div className="field">
            <label htmlFor="f-name">Name</label>
            <input id="f-name" type="text" value={draft.name} onChange={(e) => set("name", e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="f-role">Role</label>
            <input id="f-role" type="text" value={draft.role} onChange={(e) => set("role", e.target.value)} required />
          </div>

          <div className="field">
            <label htmlFor="f-scope">Scope / Core competency</label>
            <input id="f-scope" type="text" placeholder="e.g. Operations, AG, Redi…"
                   value={draft.scope || ""} onChange={(e) => set("scope", e.target.value)} />
          </div>

          <div className="field">
            <label htmlFor="f-email">Email</label>
            <input id="f-email" type="email" value={draft.email || ""} onChange={(e) => set("email", e.target.value)} />
          </div>

          <div className="field">
            <label>Key skills</label>
            <div className="chips-editor" onClick={() => document.getElementById("f-skill")?.focus()}>
              {(draft.skills || []).map((s) => (
                <span key={s} className="tag">
                  {s}
                  <button type="button" aria-label={`Remove ${s}`} onClick={() => removeSkill(s)}>×</button>
                </span>
              ))}
              <input id="f-skill" type="text" placeholder="Add a skill, press Enter"
                     value={skillInput}
                     onChange={(e) => setSkillInput(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addSkill(skillInput); }
                       else if (e.key === "Backspace" && !skillInput && (draft.skills || []).length) {
                         removeSkill(draft.skills[draft.skills.length - 1]);
                       }
                     }} />
            </div>
          </div>

          <div className="field">
            <label>Card colour</label>
            <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              {["#4A90E2","#1F8A5B","#D97757","#7A5AE0","#E05A8A","#0EA5A0","#2D2D2D","#C0392B"].map(c => (
                <button key={c} type="button"
                  onClick={() => set("color", c)}
                  style={{
                    width:28, height:28, borderRadius:"50%", background:c, border:"none",
                    cursor:"default", flexShrink:0,
                    outline: draft.color === c ? "3px solid " + c : "2px solid transparent",
                    outlineOffset:2,
                    opacity: draft.color === c ? 1 : 0.75,
                  }} />
              ))}
              <input type="color"
                value={draft.color || "#4A90E2"}
                onChange={(e) => set("color", e.target.value)}
                title="Custom colour"
                style={{ width:28, height:28, borderRadius:"50%", border:"1px solid #E6E6E6", padding:2, cursor:"default" }} />
              {draft.color && (
                <button type="button" className="btn btn-ghost"
                  style={{ fontSize:11, padding:"4px 8px" }}
                  onClick={() => set("color", null)}>Reset</button>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="f-parent">Reports to</label>
            <select id="f-parent" value={draft.parent || ""}
                    onChange={(e) => set("parent", e.target.value || null)}>
              <option value="">— No one (top of org)</option>
              {parentOptions.map(p => (
                <option key={p.id} value={p.id}>{p.name} · {p.role}</option>
              ))}
            </select>
          </div>
        </form>

        <div className="modal-ft">
          <button type="button" className="btn btn-danger" onClick={() => {
            if (confirm(`Remove ${draft.name} from the org? Their direct reports will be re-parented one level up.`)) onDelete(draft.id);
          }}>Delete</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={submit}>Save changes</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Top bar
// ─────────────────────────────────────────────────────────────────────
function TopBar({ onAdd, onReset, onFit, count, lastEditInfo, user, canEdit, onSignIn, onSignOut }) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">YW</div>
        <div>
          <div className="brand-title">Team Organisation</div>
          <div className="brand-sub">YW · Australia × Vietnam</div>
        </div>
      </div>
      <div className="topbar-right">
        <div className="meta-pill"><b>{count}</b> members</div>
        {lastEditInfo && (
          <div className="meta-pill" title={lastEditInfo.email}>
            ✏ <b>{lastEditInfo.name.split(" ")[0]}</b> · {timeAgo(lastEditInfo.time)}
          </div>
        )}
        <button className="btn" onClick={onFit} title="Fit chart to screen">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
          </svg>
          Fit
        </button>
        <button className="btn" onClick={() => window.print()} title="Print / Export PDF">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9V2h12v7"/><rect x="6" y="17" width="12" height="5"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          </svg>
          Print PDF
        </button>
        {canEdit && <button className="btn" onClick={onReset} title="Restore seed data">Reset</button>}
        {canEdit && (
          <button className="btn btn-primary" onClick={onAdd}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add member
          </button>
        )}
        {user ? (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            {user.photoURL && (
              <img src={user.photoURL} alt={user.displayName}
                style={{ width:28, height:28, borderRadius:"50%", border:"1px solid #E6E6E6" }} />
            )}
            <button className="btn btn-ghost" onClick={onSignOut}
              style={{ fontSize:11 }} title={"Signed in as " + user.email}>
              Sign out
            </button>
          </div>
        ) : (
          <button className="btn" onClick={onSignIn}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            Sign in to edit
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Stats strip
// ─────────────────────────────────────────────────────────────────────
function Stats({ people }) {
  const byLevel = useMemo(() => {
    const m = {};
    for (const p of people) m[p.level] = (m[p.level] || 0) + 1;
    return m;
  }, [people]);
  const scopes = useMemo(() => {
    const s = new Set();
    for (const p of people) if (p.scope) s.add(p.scope);
    return s.size;
  }, [people]);
  return (
    <div className="stats">
      <div className="stat"><div className="num">{people.length}</div><div className="lbl">Total members</div></div>
      <div className="stat"><div className="num">{byLevel[1] || 0}</div><div className="lbl">Directors · L1</div></div>
      <div className="stat"><div className="num">{byLevel[2] || 0}</div><div className="lbl">Managers · L2</div></div>
      <div className="stat"><div className="num">{byLevel[3] || 0}</div><div className="lbl">Leads · L3</div></div>
      <div className="stat"><div className="num">{scopes}</div><div className="lbl">Active scopes</div></div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────
function App() {
  const [people, setPeople] = useState(SEED);
  const [loading, setLoading] = useState(true);
  const isRemoteUpdate = useRef(false);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState("");
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [lastEditInfo, setLastEditInfo] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [dropTargetId, setDropTargetId] = useState(null);
  const [rootDropOver, setRootDropOver] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef(null);
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Auth state listener
  useEffect(() => {
    return firebase.auth().onAuthStateChanged((u) => {
      setUser(u);
      setAuthReady(true);
    });
  }, []);

  // Edit tracking listener
  useEffect(() => {
    EDIT_REF.on("value", (snap) => setLastEditInfo(snap.val()));
    return () => EDIT_REF.off();
  }, []);

  const signIn = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider);
  };
  const signOut = () => firebase.auth().signOut();

  const trackEdit = useCallback((action) => {
    if (!user) return;
    EDIT_REF.set({ name: user.displayName, email: user.email, photoURL: user.photoURL || null, action, time: Date.now() });
  }, [user]);

  // Load from Firebase + subscribe to real-time changes
  useEffect(() => {
    let firstLoad = true;
    const handler = (snapshot) => {
      const val = snapshot.val();
      if (firstLoad) {
        firstLoad = false;
        if (val && Array.isArray(val)) {
          isRemoteUpdate.current = true;
          setPeople(val);
        }
        setLoading(false);
      } else if (val && Array.isArray(val)) {
        isRemoteUpdate.current = true;
        setPeople(val);
      }
    };
    PEOPLE_REF.on("value", handler, () => setLoading(false));
    return () => PEOPLE_REF.off("value", handler);
  }, []);

  // Save to Firebase on every local change
  useEffect(() => {
    if (loading) return;
    if (isRemoteUpdate.current) { isRemoteUpdate.current = false; return; }
    PEOPLE_REF.set(people);
  }, [people, loading]);

  // apply accent + line styling
  useEffect(() => {
    const r = document.documentElement.style;
    r.setProperty("--accent", t.accent);
    r.setProperty("--gap-h", `${t.nodeSpacing}px`);
    r.setProperty("--line-color", t.lineColor);
    r.setProperty("--line-weight", `${t.lineWeight}px`);
    r.setProperty("--line-style", t.lineStyle);
  }, [t.accent, t.nodeSpacing, t.lineColor, t.lineWeight, t.lineStyle]);

  const peopleById = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people]);
  const byParent = useMemo(() => {
    const m = {};
    for (const p of people) {
      const k = p.parent || "__root__";
      (m[k] = m[k] || []).push(p);
    }
    // stable-ish ordering by level then name
    for (const k in m) m[k].sort((a,b) => a.level - b.level || a.name.localeCompare(b.name));
    return m;
  }, [people]);
  const roots = byParent["__root__"] || [];

  // descendants of a node (used to mark invalid drop targets — can't re-parent to your own subtree)
  const descendantsOf = useCallback((id) => {
    const out = new Set();
    if (!id) return out;
    const stack = [id];
    while (stack.length) {
      const cur = stack.pop();
      for (const p of people) {
        if (p.parent === cur && !out.has(p.id)) { out.add(p.id); stack.push(p.id); }
      }
    }
    return out;
  }, [people]);

  const invalidIds = useMemo(() => {
    const s = descendantsOf(draggingId);
    if (draggingId) s.add(draggingId);
    return s;
  }, [draggingId, descendantsOf]);

  // re-parent: source becomes a direct report of newParentId (null = root)
  const reparent = useCallback((sourceId, newParentId) => {
    setPeople((arr) => {
      const byId = Object.fromEntries(arr.map(p => [p.id, p]));
      const source = byId[sourceId];
      if (!source) return arr;
      if (source.parent === newParentId) return arr; // no change

      // recompute levels for source + all descendants
      const newParent = newParentId ? byId[newParentId] : null;
      const baseLevel = newParent ? (newParent.level || 1) + 1 : 1;
      const delta = baseLevel - source.level;

      // collect subtree
      const subtree = new Set([sourceId]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const p of arr) {
          if (p.parent && subtree.has(p.parent) && !subtree.has(p.id)) {
            subtree.add(p.id); grew = true;
          }
        }
      }

      return arr.map(p => {
        if (p.id === sourceId) return { ...p, parent: newParentId, level: baseLevel };
        if (subtree.has(p.id))  return { ...p, level: p.level + delta };
        return p;
      });
    });
    const src = peopleById[sourceId];
    const dst = newParentId ? peopleById[newParentId] : null;
    if (src) {
      const msg = dst ? `${src.name} now reports to ${dst.name}` : `${src.name} is now top of org`;
      flash(msg);
      trackEdit(msg);
    }
  }, [peopleById]);

  const handleFit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setZoom(1);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!canvasRef.current) return;
      const scale = Math.min(
        canvas.clientWidth  / canvas.scrollWidth,
        canvas.clientHeight / canvas.scrollHeight
      );
      setZoom(Math.max(0.1, Math.min(1, scale)));
    }));
  }, []);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 1800);
  };

  const onSave = (next) => {
    setPeople((arr) => arr.map(p => p.id === next.id ? next : p));
    setEditingId(null);
    trackEdit("edited " + next.name);
    flash(`Saved · ${next.name}`);
  };

  const onDelete = (id) => {
    const target = people.find(p => p.id === id);
    setPeople((arr) => {
      if (!target) return arr;
      return arr
        .filter(p => p.id !== id)
        .map(p => p.parent === id ? { ...p, parent: target.parent } : p);
    });
    setEditingId(null);
    if (target) trackEdit("removed " + target.name);
    flash("Removed");
  };

  const onAdd = () => {
    const id = "u" + (Math.max(0, ...people.map(p => parseInt(p.id.slice(1)) || 0)) + 1);
    const newPerson = {
      id, name: "New Member", role: "Role", scope: "", email: "",
      level: 2, parent: roots[0]?.id || null, skills: []
    };
    setPeople(arr => [...arr, newPerson]);
    setEditingId(id);
    trackEdit("added new member");
  };

  const onReset = () => {
    if (!confirm("Reset to original team data? Edits will be lost.")) return;
    setPeople(SEED);
    flash("Reset to seed");
  };

  // drag state propagated to nodes
  useEffect(() => {
    document.body.classList.toggle("is-dragging", !!draggingId);
  }, [draggingId]);

  const drag = {
    draggingId,
    dropTargetId,
    invalidIds,
    onDragStart: (id) => { setDraggingId(id); setDropTargetId(null); },
    onDragEnd: () => { setDraggingId(null); setDropTargetId(null); setRootDropOver(false); },
    onDragOver: (id) => { if (dropTargetId !== id) setDropTargetId(id); },
    onDragLeave: (id) => { if (dropTargetId === id) setDropTargetId(null); },
    onDrop: (targetId) => {
      const src = draggingId;
      setDropTargetId(null); setDraggingId(null);
      if (src && targetId && src !== targetId && !invalidIds.has(targetId)) reparent(src, targetId);
    },
  };

  const editing = editingId ? peopleById[editingId] : null;
  const densityClass = "density-" + (t.density || "regular");
  const canEdit = !!user;

  if (loading || !authReady) return (
    <div style={{ display:"grid", placeItems:"center", height:"100vh",
                  fontFamily:"JetBrains Mono,monospace", fontSize:12,
                  color:"var(--ink-faint)", letterSpacing:".08em" }}>
      Connecting…
    </div>
  );

  return (
    <div className={densityClass}>
      <TopBar onAdd={onAdd} onReset={onReset} onFit={handleFit} count={people.length}
              lastEditInfo={lastEditInfo} user={user} canEdit={canEdit}
              onSignIn={signIn} onSignOut={signOut} />
      <Stats people={people} />

      <div className="canvas" ref={canvasRef}>
        <div className="canvas-inner" style={zoom !== 1 ? { zoom } : undefined}>
          <ul className="tree">
            {roots.map(r => (
              <TreeNode key={r.id} id={r.id} byParent={byParent} peopleById={peopleById}
                        onEdit={setEditingId}
                        opts={{ showEmail: t.showEmail, showScope: t.showScope, showIds: t.showIds }}
                        drag={drag} canEdit={canEdit} />
            ))}
          </ul>
        </div>
      </div>

      {/* Drop zone for promoting a node to top-of-org */}
      {canEdit && <div
        className={"root-drop " + (rootDropOver ? "over" : "")}
        onDragOver={(e) => {
          if (!draggingId) return;
          // can always drop to root unless already root
          const src = peopleById[draggingId];
          if (src && src.parent === null) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setRootDropOver(true);
        }}
        onDragLeave={() => setRootDropOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          const src = draggingId;
          setRootDropOver(false); setDraggingId(null); setDropTargetId(null);
          if (src) reparent(src, null);
        }}>
        ↑ Drop here to make top of org
      </div>}

      {editing && (
        <EditModal person={editing} allPeople={people}
                   onClose={() => setEditingId(null)}
                   onSave={onSave} onDelete={onDelete} />
      )}

      <div className={"toast " + (toast ? "show" : "")}>{toast}</div>

      <TweaksPanel>
        <TweakSection label="Display" />
        <TweakRadio label="Density" value={t.density}
          options={["compact", "regular"]}
          onChange={(v) => setTweak("density", v)} />
        <TweakSlider label="Node spacing" value={t.nodeSpacing} min={12} max={64} step={2} unit="px"
          onChange={(v) => setTweak("nodeSpacing", v)} />
        <TweakToggle label="Show scope tag"  value={t.showScope}  onChange={(v) => setTweak("showScope", v)} />
        <TweakToggle label="Show email"      value={t.showEmail}  onChange={(v) => setTweak("showEmail", v)} />
        <TweakToggle label="Show node IDs"   value={t.showIds}    onChange={(v) => setTweak("showIds", v)} />

        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={t.accent}
          options={["#4A90E2", "#2D2D2D", "#1F8A5B", "#D97757", "#7A5AE0"]}
          onChange={(v) => setTweak("accent", v)} />

        <TweakSection label="Connector lines" />
        <TweakColor label="Line color" value={t.lineColor}
          options={["#C9C9C9", "#2D2D2D", "#4A90E2", "#9B9B9B", "#E8E8E8"]}
          onChange={(v) => setTweak("lineColor", v)} />
        <TweakSlider label="Line weight" value={t.lineWeight} min={1} max={4} step={0.5} unit="px"
          onChange={(v) => setTweak("lineWeight", v)} />
        <TweakRadio label="Line style" value={t.lineStyle}
          options={["solid", "dashed", "dotted"]}
          onChange={(v) => setTweak("lineStyle", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
