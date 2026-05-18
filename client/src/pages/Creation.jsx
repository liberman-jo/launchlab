import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import useStore from "../lib/store";
import { api } from "../lib/api";
import { C, FH, FB, btn, btnO, inp, lbl, card, badge, WorkflowRail, GuidePanel, ErrorBox, DownloadBtn, Spinner } from "../components";

const CAT_CLR = { Legal: C.disc, Financial: C.mgmt, Digital: C.crea, Operations: C.warn, Marketing: C.mktg };

// Detect what concrete result to collect from guided/manual tasks
function getResultMeta(taskName) {
  const n = (taskName || "").toLowerCase();
  if (/stripe|payment|invoic/.test(n))        return { label: "Stripe Dashboard URL",      hint: "Paste your Stripe dashboard link after connecting",   placeholder: "https://dashboard.stripe.com/acct_..." };
  if (/domain|namecheap|hosting|dns/.test(n)) return { label: "Domain name registered",    hint: "The exact domain you purchased",                      placeholder: "mybusiness.com" };
  if (/google|gmb|local listing|maps/.test(n))return { label: "Google Business URL",       hint: "Link to your Google Business Profile",                placeholder: "https://business.google.com/..." };
  if (/calendly|booking|schedul/.test(n))      return { label: "Calendly booking link",     hint: "Your public Calendly page URL",                       placeholder: "https://calendly.com/yourname" };
  if (/llc|incorporat|register|legal/.test(n)) return { label: "EIN / Company number",      hint: "From your IRS or state confirmation",                 placeholder: "12-3456789" };
  if (/bank|checking|mercury/.test(n))         return { label: "Bank & account type",       hint: "e.g. Mercury Business Checking",                      placeholder: "Mercury — Business Checking" };
  if (/email|gmail/.test(n))                   return { label: "Business email address",    hint: "Your new business email",                             placeholder: "hello@mybusiness.com" };
  if (/insurance|liability/.test(n))           return { label: "Policy / provider",         hint: "From your insurance certificate",                     placeholder: "Next Insurance — GL #..." };
  return { label: "What did you complete?",   hint: "Describe what you set up, or paste a link/reference number", placeholder: "e.g. Created account at stripe.com — account ID: acct_..." };
}

export default function Creation() {
  const { id: businessId } = useParams();
  const { user, tasks: allTasks, setTasks, updateTask, addTask, removeTask } = useStore();
  const [business,    setBusiness]    = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [taskError,   setTaskError]   = useState("");
  const [openTaskId,  setOpenTaskId]  = useState(null);
  const [runningIds,  setRunningIds]  = useState(new Set());
  const [editingOut,  setEditingOut]  = useState(null);
  const [addingTask,  setAddingTask]  = useState(false);
  const [newTaskForm, setNewTaskForm] = useState({ name: "", category: "Operations", description: "" });
  const [chatOpen,    setChatOpen]    = useState(false);
  const [chatMsgs,    setChatMsgs]    = useState([{ role: "ai", text: "Hello — I'm here to help with your business setup. Ask me anything or click 'Get help' on any step." }]);
  const [outputs,     setOutputs]     = useState({});
  const [resultVals,  setResultVals]  = useState({});   // { [taskId]: string }
  const navigate = useNavigate();

  const tasks = allTasks[businessId] || [];
  const done  = tasks.filter(t => t.status === "done").length;
  const pct   = tasks.length ? Math.round(done / tasks.length * 100) : 0;

  useEffect(() => {
    Promise.all([
      api.businesses.get(businessId),
      api.tasks.list(businessId),
    ]).then(([{ business: b }, { tasks: t }]) => {
      setBusiness(b);
      setTasks(businessId, t);
      const outs = {};
      t.forEach(task => { if (task.outputData) outs[task.id] = task.outputData; });
      setOutputs(outs);
    }).catch(e => setTaskError(e.message))
      .finally(() => setLoading(false));
  }, [businessId]);

  // Auto-trigger generation when an auto task is opened
  useEffect(() => {
    if (!openTaskId) return;
    const t = tasks.find(t => t.id === openTaskId);
    if (t && t.canAutomate && t.mode === "auto" && t.status === "pending" && !runningIds.has(openTaskId)) {
      runTask(openTaskId);
    }
  }, [openTaskId]);

  const runTask = async (taskId) => {
    setRunningIds(p => new Set([...p, taskId]));
    setTaskError("");
    try {
      const { task } = await api.tasks.run(taskId);
      updateTask(businessId, taskId, { status: "done", outputData: task.outputData });
      if (task.outputData) setOutputs(p => ({ ...p, [taskId]: task.outputData }));
    } catch (e) {
      setTaskError(e.message);
      updateTask(businessId, taskId, { status: "pending" });
    } finally {
      setRunningIds(p => { const n = new Set(p); n.delete(taskId); return n; });
    }
  };

  const setMode = async (taskId, mode) => {
    updateTask(businessId, taskId, { mode });
    await api.tasks.update(taskId, { mode }).catch(() => {});
  };

  // Submit a real result (credential / URL / etc.) → marks task done
  const submitResult = async (taskId, label, value) => {
    if (!value.trim()) return;
    const outputData = { fields: [{ label, value: value.trim() }] };
    updateTask(businessId, taskId, { status: "done", outputData });
    setOutputs(p => ({ ...p, [taskId]: outputData }));
    await api.tasks.update(taskId, { status: "done", outputData }).catch(() => {});
  };

  // Advance guided step
  const advanceGuided = async (taskId, task) => {
    const cur = task.guidedStep || 0;
    const len = task.steps?.length || 0;
    if (cur >= len - 1) {
      // All steps done — stay pending until result submitted
    } else {
      updateTask(businessId, taskId, { guidedStep: cur + 1 });
    }
  };

  const undoTask = async (taskId) => {
    updateTask(businessId, taskId, { status: "pending", guidedStep: 0 });
    setOutputs(p => { const n = { ...p }; delete n[taskId]; return n; });
    await api.tasks.update(taskId, { status: "pending", outputData: null }).catch(() => {});
  };

  const deleteTask = async (taskId) => {
    removeTask(businessId, taskId);
    if (openTaskId === taskId) setOpenTaskId(null);
    await api.tasks.delete(taskId).catch(() => {});
  };

  const addCustomTask = async () => {
    if (!newTaskForm.name.trim()) return;
    const { task } = await api.tasks.create(businessId, { ...newTaskForm, canAutomate: false, steps: [], mode: "manual" });
    addTask(businessId, task);
    setNewTaskForm({ name: "", category: "Operations", description: "" });
    setAddingTask(false);
  };

  const saveOutputEdit = async (taskId, fields) => {
    const updated = { ...outputs[taskId], fields };
    setOutputs(p => ({ ...p, [taskId]: updated }));
    await api.tasks.update(taskId, { outputData: updated }).catch(() => {});
    setEditingOut(null);
  };

  const sendChat = async (msg) => {
    setChatMsgs(p => [...p, { role: "user", text: msg }]);
    try {
      const { reply } = await api.generate.chat(msg, businessId);
      setChatMsgs(p => [...p, { role: "ai", text: reply }]);
    } catch {
      setChatMsgs(p => [...p, { role: "ai", text: "Sorry, couldn't process that. Try again." }]);
    }
  };

  const askHelp = (stepText, taskName) => {
    const msg = `I'm working on "${taskName}" and I need help with this step: "${stepText}". What should I do?`;
    setChatOpen(true);
    sendChat(msg);
  };

  const goLive = async () => {
    await api.businesses.update(businessId, { status: "live" }).catch(() => {});
    navigate(`/hub/${businessId}`);
  };

  if (loading) return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center" }}><Spinner /><p style={{ color: C.muted, marginTop: 16, fontFamily: FB }}>Loading your setup plan...</p></div>
    </div>
  );

  const idea = (() => { try { return JSON.parse(business?.ideaData || "{}"); } catch { return {}; } })();

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: FB }}>
      <WorkflowRail currentStage="creation" completedStages={["discovery"]} userName={user?.name} businessName={business?.name}
        onNavigate={k => { if (k === "discovery") navigate("/results"); else if (k === "hub") navigate(`/hub/${businessId}`); }} />

      <div style={{ flex: 1, background: "#F4F3EF", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{ height: 52, background: "#fff", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", flexShrink: 0 }}>
          <span style={{ fontFamily: FH, fontWeight: 600, fontSize: 15 }}>{business?.name || "Setup"}</span>
          <button onClick={goLive} style={btn(pct === 100 ? C.ok : C.warn)}>{pct === 100 ? "Go to dashboard" : "Go live now"}</button>
        </div>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Main task list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "28px 28px 100px" }}>
            <ErrorBox msg={taskError} onRetry={() => setTaskError("")} />

            {/* Progress */}
            <div style={{ ...card("14px 20px"), marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{done} of {tasks.length} tasks complete</span>
                <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 18, color: C.crea }}>{pct}%</span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: C.border }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${C.crea}, ${C.mgmt})`, borderRadius: 4, transition: "width 0.5s" }} />
              </div>
            </div>

            {/* Tasks */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {tasks.map(task => {
                const isOpen     = openTaskId === task.id;
                const isRunning  = runningIds.has(task.id);
                const cc         = CAT_CLR[task.category] ?? C.muted;
                const out        = outputs[task.id];
                const guidedStep = task.guidedStep || 0;
                const allStepsDone = guidedStep >= (task.steps?.length || 0);
                const statusClr  = task.status === "done" ? C.ok : isRunning ? C.crea : C.muted;
                const statusBg   = task.status === "done" ? C.okBg : isRunning ? "#E0F2FE" : C.bg;
                const resultMeta = getResultMeta(task.name);

                return (
                  <div key={task.id} style={{ ...card(), border: `1px solid ${isOpen ? C.crea : C.border}`, padding: "14px 18px", transition: "border-color 0.15s" }}>
                    {/* Row header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div onClick={() => setOpenTaskId(isOpen ? null : task.id)}
                        style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: statusBg, border: `1.5px solid ${statusClr}40`, color: statusClr, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        {task.status === "done" ? "✓" : isRunning ? "…" : ""}
                      </div>
                      <div onClick={() => setOpenTaskId(isOpen ? null : task.id)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 3 }}>
                          <span style={{ fontSize: 14, fontWeight: 500, color: task.status === "done" ? C.muted : C.text, textDecoration: task.status === "done" ? "line-through" : "none" }}>{task.name}</span>
                          <span style={badge(cc, cc + "15")}>{task.category}</span>
                        </div>
                        <div style={{ fontSize: 11, color: C.muted }}>{task.estimatedTime} · {task.estimatedCost}</div>
                      </div>
                      <span style={badge(
                        task.mode === "auto" ? C.mgmt : task.mode === "guided" ? C.disc : C.muted,
                        task.mode === "auto" ? C.mgmtBg : task.mode === "guided" ? "#EEEEFF" : C.bg
                      )}>{task.mode === "auto" ? "auto" : task.mode === "guided" ? "guided" : "manual"}</span>
                      <span style={badge(statusClr, statusBg)}>{task.status === "done" ? "done" : isRunning ? "running" : "pending"}</span>
                      <button onClick={() => setOpenTaskId(isOpen ? null : task.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 12 }}>{isOpen ? "▲" : "▼"}</button>
                      <button onClick={() => deleteTask(task.id)} style={{ background: "none", border: `1px solid ${C.border}`, borderRadius: 6, cursor: "pointer", color: C.muted, fontSize: 14, padding: "2px 7px", lineHeight: 1 }} title="Remove">×</button>
                    </div>

                    {/* ── Expanded content ────────────────────────────────────────── */}
                    {isOpen && (
                      <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
                        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.75, marginBottom: 18 }}>{task.description}</p>

                        {/* Mode selector — only when not done */}
                        {task.status !== "done" && (
                          <div style={{ marginBottom: 18 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 9, textTransform: "uppercase", letterSpacing: "0.6px" }}>Completion mode</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {(task.canAutomate ? ["auto", "guided", "manual"] : ["guided", "manual"]).map(m => {
                                const active = task.mode === m;
                                const mClr   = m === "auto" ? C.mgmt : m === "guided" ? C.disc : C.muted;
                                const mBg    = m === "auto" ? C.mgmtBg : m === "guided" ? "#EEEEFF" : C.bg;
                                return (
                                  <button key={m} onClick={() => setMode(task.id, m)}
                                    style={{ background: active ? mBg : "transparent", color: active ? mClr : C.muted, border: `1.5px solid ${active ? mClr : C.border}`, borderRadius: 8, padding: "7px 14px", fontSize: 12, fontWeight: active ? 600 : 400, cursor: "pointer", transition: "all 0.12s" }}>
                                    {m === "auto" ? "Auto-generate" : m === "guided" ? "Guide me step by step" : "I'll do it myself"}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* ── AUTO MODE ─────────────────────────────────────────────── */}
                        {task.mode === "auto" && task.status !== "done" && (
                          <div>
                            {isRunning ? (
                              <div style={{ ...card("20px"), background: C.creaBg, border: `1px solid ${C.crea}20`, display: "flex", alignItems: "center", gap: 16 }}>
                                <Spinner color={C.crea} size={24} />
                                <div>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: C.crea, marginBottom: 3 }}>Generating your {task.name.toLowerCase()}…</div>
                                  <div style={{ fontSize: 12, color: C.muted }}>This usually takes 15–30 seconds. Sit tight.</div>
                                </div>
                              </div>
                            ) : (
                              <div style={{ ...card("16px 18px"), background: C.mgmtBg, border: `1px solid ${C.mgmt}20` }}>
                                <div style={{ fontSize: 13, color: C.muted, marginBottom: 14, lineHeight: 1.6 }}>
                                  LaunchLab will generate a complete output for this task using AI — tailored to <strong>{business?.name}</strong>. Review and adjust before saving.
                                </div>
                                <button onClick={() => runTask(task.id)} style={btn(C.mgmt)}>Generate now</button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* ── AUTO MODE — done: output review ───────────────────────── */}
                        {task.mode === "auto" && task.status === "done" && out && (
                          <div style={{ ...card("16px"), background: C.okBg, border: `1px solid ${C.ok}20` }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: C.ok, textTransform: "uppercase", letterSpacing: "0.5px" }}>Generated output — saved to Hub</div>
                              <div style={{ display: "flex", gap: 8 }}>
                                {out.downloadAvailable && out.content && (
                                  <DownloadBtn content={out.content} filename={`${business?.name?.replace(/\s+/g, "-").toLowerCase() || "output"}-${out.type || "document"}.html`} label="Download" />
                                )}
                                <button onClick={() => setEditingOut(editingOut === task.id ? null : task.id)} style={{ ...btnO(editingOut === task.id ? C.disc : C.muted, 11), padding: "4px 10px" }}>
                                  {editingOut === task.id ? "Done" : "Edit"}
                                </button>
                              </div>
                            </div>
                            {(out.fields || []).map((field, fi) => (
                              <div key={fi} style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 4 }}>{field.label}</div>
                                {editingOut === task.id
                                  ? <input value={field.value} onChange={e => {
                                      const v = e.target.value;
                                      setOutputs(p => ({ ...p, [task.id]: { ...p[task.id], fields: p[task.id].fields.map((f, i) => i === fi ? { ...f, value: v } : f) } }));
                                    }} style={{ ...inp(), fontSize: 13, padding: "7px 10px" }} />
                                  : <div style={{ fontSize: 13, color: C.text, fontWeight: 500, lineHeight: 1.5 }}>
                                      {field.value && field.value.startsWith("http")
                                        ? <a href={field.value} target="_blank" rel="noopener noreferrer" style={{ color: C.disc }}>{field.value} ↗</a>
                                        : field.value}
                                    </div>
                                }
                              </div>
                            ))}
                            {editingOut === task.id && (
                              <button onClick={() => saveOutputEdit(task.id, outputs[task.id].fields)} style={{ ...btn(C.disc, "#fff", 12), marginTop: 8 }}>Save changes</button>
                            )}
                          </div>
                        )}

                        {/* ── GUIDED MODE ──────────────────────────────────────────── */}
                        {task.mode === "guided" && task.status !== "done" && task.steps?.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 600, color: C.disc, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>
                              Step {Math.min(guidedStep + 1, task.steps.length)} of {task.steps.length}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                              {task.steps.map((s, si) => {
                                const stepText  = typeof s === "string" ? s : (s?.text || "");
                                const stepUrl   = typeof s === "object" && s?.url ? s.url : null;
                                const isStepDone   = si < guidedStep;
                                const isStepActive = si === guidedStep;
                                const isStepFuture = si > guidedStep;
                                return (
                                  <div key={si} style={{ display: "flex", gap: 12, alignItems: "flex-start", opacity: isStepFuture ? 0.35 : 1, transition: "opacity 0.2s" }}>
                                    <div style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: isStepDone ? C.ok : isStepActive ? C.disc : "transparent", border: `2px solid ${isStepDone ? C.ok : isStepActive ? C.disc : C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff", fontWeight: 700, marginTop: 1 }}>
                                      {isStepDone ? "✓" : si + 1}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                      <div style={{ fontSize: 13, color: isStepActive ? C.text : C.muted, lineHeight: 1.6, fontWeight: isStepActive ? 500 : 400 }}>{stepText}</div>
                                      {isStepActive && (
                                        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                                          {stepUrl && (
                                            <a href={stepUrl} target="_blank" rel="noopener noreferrer"
                                              style={{ ...btn(C.disc, "#fff", 12), padding: "6px 12px", textDecoration: "none", display: "inline-block" }}>
                                              Open page ↗
                                            </a>
                                          )}
                                          <button onClick={() => askHelp(stepText, task.name)}
                                            style={{ ...btnO(C.crea, 12), padding: "5px 12px" }}>
                                            Get help with this step
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Guided navigation buttons */}
                            {!allStepsDone ? (
                              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                                {guidedStep > 0 && (
                                  <button onClick={() => updateTask(businessId, task.id, { guidedStep: guidedStep - 1 })} style={{ ...btnO(C.muted, 12), padding: "7px 14px" }}>← Back</button>
                                )}
                                <button onClick={() => advanceGuided(task.id, task)} style={btn(C.disc)}>
                                  {guidedStep >= task.steps.length - 1 ? "All steps done →" : "Done, next step →"}
                                </button>
                              </div>
                            ) : null}

                            {/* Result input — appears after all steps are marked done */}
                            {allStepsDone && (
                              <ResultInput taskId={task.id} meta={resultMeta} value={resultVals[task.id] || ""} onChange={v => setResultVals(p => ({ ...p, [task.id]: v }))} onSubmit={() => submitResult(task.id, resultMeta.label, resultVals[task.id] || "")} />
                            )}
                          </div>
                        )}

                        {/* ── GUIDED — no steps fallback ────────────────────────────── */}
                        {task.mode === "guided" && task.status !== "done" && (!task.steps || task.steps.length === 0) && (
                          <ResultInput taskId={task.id} meta={resultMeta} value={resultVals[task.id] || ""} onChange={v => setResultVals(p => ({ ...p, [task.id]: v }))} onSubmit={() => submitResult(task.id, resultMeta.label, resultVals[task.id] || "")} />
                        )}

                        {/* ── MANUAL MODE ───────────────────────────────────────────── */}
                        {task.mode === "manual" && task.status !== "done" && (
                          <div>
                            {/* All steps shown with links */}
                            {task.steps?.length > 0 && (
                              <div style={{ ...card("14px 16px"), background: C.bg, border: `1px solid ${C.border}`, marginBottom: 16 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>Steps to complete</div>
                                {task.steps.map((s, si) => {
                                  const stepText = typeof s === "string" ? s : (s?.text || "");
                                  const stepUrl  = typeof s === "object" && s?.url ? s.url : null;
                                  return (
                                    <div key={si} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
                                      <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, border: `2px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, color: C.muted, fontWeight: 700, marginTop: 2 }}>
                                        {si + 1}
                                      </div>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55 }}>{stepText}</div>
                                        {stepUrl && (
                                          <a href={stepUrl} target="_blank" rel="noopener noreferrer"
                                            style={{ display: "inline-block", marginTop: 5, fontSize: 11, color: C.disc, fontWeight: 500, textDecoration: "none", background: C.discBg, border: `1px solid ${C.disc}20`, borderRadius: 5, padding: "3px 9px" }}>
                                            Open ↗
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                <div style={{ marginTop: 4, paddingTop: 10, borderTop: `1px solid ${C.border}` }}>
                                  <button onClick={() => { setChatOpen(true); }} style={{ ...btnO(C.crea, 12), padding: "5px 12px" }}>
                                    Ask the AI guide for help
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Result input always visible for manual */}
                            <ResultInput taskId={task.id} meta={resultMeta} value={resultVals[task.id] || ""} onChange={v => setResultVals(p => ({ ...p, [task.id]: v }))} onSubmit={() => submitResult(task.id, resultMeta.label, resultVals[task.id] || "")} />
                          </div>
                        )}

                        {/* ── DONE STATE (all modes) ────────────────────────────────── */}
                        {task.status === "done" && out && task.mode !== "auto" && (
                          <div style={{ ...card("14px 16px"), background: C.okBg, border: `1px solid ${C.ok}20`, marginTop: 4 }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: C.ok, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>Saved to Hub</div>
                            {(out.fields || []).map((field, fi) => (
                              <div key={fi} style={{ marginBottom: 8 }}>
                                <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 3 }}>{field.label}</div>
                                <div style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>
                                  {field.value && field.value.startsWith("http")
                                    ? <a href={field.value} target="_blank" rel="noopener noreferrer" style={{ color: C.disc }}>{field.value} ↗</a>
                                    : field.value}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {task.status === "done" && (
                          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
                            <span style={{ fontSize: 13, color: C.ok, fontWeight: 600 }}>✓ Complete</span>
                            <button onClick={() => undoTask(task.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 12, textDecoration: "underline" }}>Undo</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add custom task */}
            {addingTask ? (
              <div style={{ ...card(), border: `2px dashed ${C.border}`, marginTop: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 14, fontFamily: FH }}>Add custom task</div>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Task name</label>
                  <input value={newTaskForm.name} onChange={e => setNewTaskForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Set up appointment reminder system" style={inp()} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={lbl}>Category</label>
                  <select value={newTaskForm.category} onChange={e => setNewTaskForm(p => ({ ...p, category: e.target.value }))} style={{ ...inp(), appearance: "none" }}>
                    {["Legal", "Financial", "Digital", "Operations", "Marketing"].map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={lbl}>Description (optional)</label>
                  <textarea value={newTaskForm.description} onChange={e => setNewTaskForm(p => ({ ...p, description: e.target.value }))} placeholder="What does this task involve?" rows={2} style={{ ...inp(), resize: "vertical", lineHeight: 1.55 }} />
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={addCustomTask} disabled={!newTaskForm.name.trim()} style={btn(newTaskForm.name.trim() ? C.disc : "#CBD5E1")}>Add task</button>
                  <button onClick={() => setAddingTask(false)} style={btnO(C.muted)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setAddingTask(true)} style={{ ...btnO(C.muted, 13), marginTop: 8, width: "100%", textAlign: "center", borderStyle: "dashed" }}>+ Add custom task</button>
            )}
          </div>

          {/* Business sidebar */}
          <div style={{ width: 240, background: "#fff", borderLeft: `1px solid ${C.border}`, padding: "22px 18px", overflowY: "auto", flexShrink: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 18 }}>Your business</div>
            {business && (
              <>
                <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6, lineHeight: 1.3 }}>{business.name}</div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 20, lineHeight: 1.6 }}>{idea.tagline}</div>
                {[["Revenue target", idea.revenue], ["Startup cost", idea.startupCost], ["First revenue", idea.timeToFirstRevenue], ["Location", business.location]].map(([label, val]) => (
                  <div key={label} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 13, color: C.text }}>{val}</div>
                  </div>
                ))}
              </>
            )}
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 4, display: "flex", flexDirection: "column", gap: 8 }}>
              <button onClick={() => navigate("/results")} style={{ ...btnO(C.disc, 12), width: "100%", textAlign: "center" }}>Change idea</button>
              <button onClick={goLive} style={{ ...btn(pct === 100 ? C.ok : C.warn, "#fff", 12), width: "100%", textAlign: "center" }}>{pct === 100 ? "Go to dashboard" : "Go live now"}</button>
            </div>
          </div>
        </div>
      </div>

      {chatOpen && <GuidePanel messages={chatMsgs} onClose={() => setChatOpen(false)} onSend={sendChat} businessId={businessId} />}
      <button onClick={() => setChatOpen(o => !o)}
        style={{ ...btn(C.crea), position: "fixed", bottom: 24, right: chatOpen ? 336 : 24, fontSize: 13, borderRadius: 24, boxShadow: "0 4px 20px #00000018", zIndex: 100, transition: "right 0.25s" }}>
        Ask guide
      </button>
    </div>
  );
}

// ── Result input component ─────────────────────────────────────────────────────
function ResultInput({ taskId, meta, value, onChange, onSubmit }) {
  return (
    <div style={{ ...card("16px 18px"), background: "#FFFBEB", border: `1.5px solid ${C.warn}30` }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: C.warn, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Add to Hub to complete this task</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, lineHeight: 1.55 }}>{meta.hint}</div>
      <label style={{ fontSize: 12, fontWeight: 600, color: C.text, display: "block", marginBottom: 6 }}>{meta.label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={meta.placeholder}
        type={meta.type === "textarea" ? "text" : meta.type}
        style={{ ...inp(), fontSize: 13, marginBottom: 12 }}
        onKeyDown={e => e.key === "Enter" && onSubmit()}
      />
      <button onClick={onSubmit} disabled={!value.trim()} style={{ ...btn(value.trim() ? C.ok : "#CBD5E1"), fontSize: 13 }}>
        Save to Hub & mark complete
      </button>
    </div>
  );
}
