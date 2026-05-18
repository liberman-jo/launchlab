import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../lib/store";
import { api } from "../lib/api";
import { C, FH, FB, btn, btnO, inp, lbl, hint, TagInput, WorkflowRail, ErrorBox } from "../components";

export default function Discovery() {
  const { intake, setIntake, user, setIdeas } = useStore();
  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const navigate = useNavigate();

  const up = (k, v) => setIntake({ [k]: v });

  const canContinue = [
    () => intake.location.trim().length > 2,
    () => true,
    () => !!intake.risk && intake.incomeGoal.trim().length > 0,
    () => true,
  ];

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const { ideas } = await api.generate.ideas(intake);
      setIdeas(ideas);
      navigate("/results");
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  const stepLabels = ["Your situation","Skills & assets","Preferences","Your idea"];

  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:FB }}>
      <WorkflowRail currentStage="discovery" completedStages={[]} userName={user?.name}
        onNavigate={k => k==="hub" ? null : navigate("/dashboard")} />

      <div style={{ flex:1, background:"#F4F3EF", display:"flex", flexDirection:"column" }}>
        {/* Progress bar */}
        <div style={{ height:52, background:"#fff", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", padding:"0 28px", gap:20, flexShrink:0 }}>
          <div style={{ flex:1, display:"flex", gap:5 }}>
            {[0,1,2,3].map(i=><div key={i} style={{ flex:1, height:4, borderRadius:2, background:i<step?C.ok:i===step?C.disc:C.border, transition:"background 0.3s" }} />)}
          </div>
          <span style={{ fontSize:12, color:C.muted, flexShrink:0 }}>Step {step+1} of 4 — {stepLabels[step]}</span>
        </div>

        <div style={{ flex:1, display:"flex", alignItems:"flex-start", justifyContent:"center", padding:"52px 24px 80px" }}>
          <div style={{ width:"100%", maxWidth:560 }}>

            {/* ── STEP 0: SITUATION */}
            {step===0 && (
              <>
                <div style={{ fontFamily:FH, fontWeight:700, fontSize:26, marginBottom:10, letterSpacing:"-0.4px" }}>Tell us about your situation</div>
                <p style={{ color:C.muted, fontSize:15, marginBottom:38, lineHeight:1.7 }}>This determines which businesses actually fit your life — not just ones that sound good.</p>
                <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
                  <div>
                    <label style={lbl}>Where are you located?</label>
                    <input value={intake.location} onChange={e=>up("location",e.target.value)} placeholder="City, State — e.g. Austin, TX" style={inp()} />
                    <p style={hint}>We research local demand, competition, and regulations specific to your area.</p>
                  </div>
                  <div>
                    <label style={lbl}>Hours available per week: <strong style={{ color:C.disc }}>{intake.hours} hrs</strong></label>
                    <input type="range" min={3} max={60} value={intake.hours} onChange={e=>up("hours",+e.target.value)} style={{ width:"100%", accentColor:C.disc }} />
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginTop:4 }}><span>3 hrs (side project)</span><span>60 hrs (full-time)</span></div>
                  </div>
                  <div>
                    <label style={lbl}>Startup budget: <strong style={{ color:C.disc }}>${Number(intake.budget).toLocaleString()}</strong></label>
                    <input type="range" min={0} max={25000} step={100} value={intake.budget} onChange={e=>up("budget",+e.target.value)} style={{ width:"100%", accentColor:C.disc }} />
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:C.muted, marginTop:4 }}><span>$0</span><span>$25,000</span></div>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 1: SKILLS & ASSETS */}
            {step===1 && (
              <>
                <div style={{ fontFamily:FH, fontWeight:700, fontSize:26, marginBottom:10, letterSpacing:"-0.4px" }}>Your skills and assets</div>
                <p style={{ color:C.muted, fontSize:15, marginBottom:38, lineHeight:1.7 }}>Specific beats generic. The AI uses these to find ideas where you have a real competitive advantage.</p>
                <div style={{ display:"flex", flexDirection:"column", gap:26 }}>
                  <div>
                    <label style={lbl}>Skills, experience, and credentials</label>
                    <p style={hint}>Trade licenses, professional experience, languages, certifications. Press Enter after each one.</p>
                    <div style={{ marginTop:8 }}><TagInput tags={intake.skills} onChange={v=>up("skills",v)} placeholder="e.g. Licensed electrician, Fluent Spanish, 8 yrs in sales..." color={C.disc} /></div>
                  </div>
                  <div>
                    <label style={lbl}>Physical assets you already own</label>
                    <p style={hint}>Vehicles, equipment, tools, space. Anything that lowers your startup costs. Press Enter after each.</p>
                    <div style={{ marginTop:8 }}><TagInput tags={intake.assets} onChange={v=>up("assets",v)} placeholder="e.g. Cargo van, Spare bedroom, Power tools..." color={C.disc} /></div>
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 2: PREFERENCES */}
            {step===2 && (
              <>
                <div style={{ fontFamily:FH, fontWeight:700, fontSize:26, marginBottom:10, letterSpacing:"-0.4px" }}>Your preferences</div>
                <p style={{ color:C.muted, fontSize:15, marginBottom:38, lineHeight:1.7 }}>How you want to work matters as much as what you do.</p>
                <div style={{ display:"flex", flexDirection:"column", gap:26 }}>
                  <div>
                    <label style={lbl}>Risk tolerance</label>
                    {[["low","Low — I need predictable income. Prefer proven models with low variance."],["medium","Medium — open to uncertainty if the upside justifies it."],["high","High — I accept significant risk for higher potential returns."]].map(([val,label]) => (
                      <div key={val} onClick={()=>up("risk",val)} style={{ marginBottom:9, padding:"13px 16px", borderRadius:10, border:`1.5px solid ${intake.risk===val?C.disc:C.border}`, background:intake.risk===val?"#EEEEFF":"#fff", cursor:"pointer", display:"flex", gap:12, alignItems:"flex-start", transition:"all 0.12s" }}>
                        <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${intake.risk===val?C.disc:C.border}`, background:intake.risk===val?C.disc:"transparent", flexShrink:0, marginTop:2 }} />
                        <span style={{ fontSize:14, color:intake.risk===val?C.disc:C.text, fontWeight:intake.risk===val?500:400, fontFamily:FB, lineHeight:1.5 }}>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label style={lbl}>Income goal — be as specific as you want</label>
                    <input value={intake.incomeGoal} onChange={e=>up("incomeGoal",e.target.value)} placeholder="e.g. $3,000/month within 6 months, or replace my $72k salary in 18 months" style={inp()} />
                  </div>
                </div>
              </>
            )}

            {/* ── STEP 3: OWN IDEA */}
            {step===3 && (
              <>
                <div style={{ fontFamily:FH, fontWeight:700, fontSize:26, marginBottom:10, letterSpacing:"-0.4px" }}>Do you already have an idea?</div>
                <p style={{ color:C.muted, fontSize:15, marginBottom:38, lineHeight:1.7 }}>Optional — if you have something specific in mind, we'll analyze it alongside AI-generated options. Leave blank if you want us to generate everything.</p>
                <div>
                  <label style={lbl}>Your idea (optional)</label>
                  <textarea value={intake.ownIdea} onChange={e=>up("ownIdea",e.target.value)} placeholder="Describe the business you're thinking about. Be as specific or as vague as you like." rows={6} style={{ ...inp(), resize:"vertical", lineHeight:1.65, padding:"12px 14px" }} />
                </div>
              </>
            )}

            <ErrorBox msg={error} />

            <div style={{ display:"flex", justifyContent:"space-between", marginTop:42 }}>
              <button onClick={()=>step>0?setStep(s=>s-1):navigate("/dashboard")} style={btnO(C.muted)}>Back</button>
              {step<3
                ? <button onClick={()=>canContinue[step]()&&setStep(s=>s+1)} style={btn(canContinue[step]()?C.disc:"#CBD5E1")}>Continue</button>
                : <button onClick={submit} disabled={loading} style={btn(loading?"#CBD5E1":C.disc)}>{loading?"Generating ideas...":"Generate my ideas"}</button>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
