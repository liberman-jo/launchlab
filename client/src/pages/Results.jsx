import { useState } from "react";
import { useNavigate } from "react-router-dom";
import useStore from "../lib/store";
import { api } from "../lib/api";
import { C, FH, FB, btn, btnO, card, badge, ScoreBar, WorkflowRail, ErrorBox } from "../components";

export default function Results() {
  const { ideas, intake, user, setSelectedIdea, addBusiness, setCurrentBusiness, setTasks } = useStore();
  const [expanded,   setExpanded]   = useState(ideas.length>0?0:null);
  const [compareSet, setCompareSet] = useState([]);
  const [comparing,  setComparing]  = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const navigate = useNavigate();

  const toggleCmp = idx => setCompareSet(p => p.includes(idx)?p.filter(i=>i!==idx):[...p,idx]);

  const choose = async (idea) => {
    setLoading(true); setError("");
    try {
      // 1. Create business in DB
      const { business } = await api.businesses.create({
        name: idea.name, tagline: idea.tagline, location: intake.location,
        budget: intake.budget, hoursPerWeek: intake.hours,
        ideaData: idea, intakeData: intake,
      });

      // 2. Generate tasks and save to DB
      await api.generate.tasks(idea, intake, business.id);

      // 3. Fetch saved tasks
      const { tasks } = await api.tasks.list(business.id);

      // 4. Update local state
      addBusiness(business);
      setCurrentBusiness(business.id);
      setSelectedIdea(idea);
      setTasks(business.id, tasks);

      navigate(`/creation/${business.id}`);
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  if (!ideas.length) {
    return (
      <div style={{ display:"flex", minHeight:"100vh", alignItems:"center", justifyContent:"center", fontFamily:FB }}>
        <div style={{ textAlign:"center" }}>
          <p style={{ color:C.muted, marginBottom:16 }}>No ideas found. Go back and run discovery.</p>
          <button onClick={()=>navigate("/discovery")} style={btn(C.disc)}>Back to discovery</button>
        </div>
      </div>
    );
  }

  // ── COMPARE VIEW ─────────────────────────────────────────────────────────────
  if (comparing && compareSet.length>=2) {
    const cmp = compareSet.map(i=>ideas[i]).filter(Boolean);
    return (
      <div style={{ display:"flex", minHeight:"100vh", fontFamily:FB }}>
        <WorkflowRail currentStage="discovery" completedStages={[]} userName={user?.name} onNavigate={()=>navigate("/dashboard")} />
        <div style={{ flex:1, background:"#F4F3EF", display:"flex", flexDirection:"column" }}>
          <div style={{ height:52, background:"#fff", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", padding:"0 28px", gap:16, flexShrink:0 }}>
            <button onClick={()=>setComparing(false)} style={btnO(C.muted,13)}>&#8592; Back to ideas</button>
            <span style={{ fontFamily:FH, fontWeight:600, fontSize:15 }}>Comparing {cmp.length} ideas</span>
          </div>
          <div style={{ flex:1, overflowX:"auto", padding:"28px" }}>
            <table style={{ borderCollapse:"separate", borderSpacing:"0 0", width:"100%", minWidth:600 }}>
              <thead>
                <tr>
                  <td style={{ padding:"0 0 14px 0", width:160 }}></td>
                  {cmp.map((idea,i)=>(
                    <td key={i} style={{ padding:"16px 18px 14px", background:"#fff", borderRadius:"12px 12px 0 0", fontSize:15, fontWeight:700, color:C.text, fontFamily:FH, border:`1px solid ${C.border}`, borderBottom:"none", minWidth:220 }}>
                      {idea.name}<div style={{ fontSize:12, color:C.muted, fontFamily:FB, fontWeight:400, marginTop:3 }}>{idea.tagline}</div>
                    </td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[["Why it fits you","why"],["Revenue potential","revenue"],["Time to first revenue","timeToFirstRevenue"],["Startup cost","startupCost"],["Biggest risk","biggestRisk"]].map(([label,key])=>(
                  <tr key={key}>
                    <td style={{ padding:"14px 0", fontSize:12, color:C.muted, fontWeight:500, fontFamily:FB, verticalAlign:"top" }}>{label}</td>
                    {cmp.map((idea,i)=>(
                      <td key={i} style={{ padding:"14px 18px", fontSize:13, color:C.text, fontFamily:FB, background:"#fff", border:`1px solid ${C.border}`, borderTop:"none", borderBottom:"none", verticalAlign:"top", lineHeight:1.65 }}>{idea[key]}</td>
                    ))}
                  </tr>
                ))}
                {["Fit","Market","Capital","Time","Risk","Upside"].map(dim=>(
                  <tr key={dim}>
                    <td style={{ padding:"12px 0", fontSize:12, color:C.muted, fontFamily:FB }}>{dim}</td>
                    {cmp.map((idea,i)=>{
                      const val=idea.scores?.[dim]??0;
                      return (
                        <td key={i} style={{ padding:"12px 18px", background:"#fff", border:`1px solid ${C.border}`, borderTop:"none", borderBottom:"none" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <div style={{ flex:1, height:5, borderRadius:3, background:C.border }}><div style={{ height:"100%", width:`${Number(val)*10}%`, background:C.disc, borderRadius:3 }} /></div>
                            <span style={{ fontSize:12, fontWeight:600, color:C.text, fontFamily:FB, minWidth:24 }}>{Number(val).toFixed(1)}</span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr>
                  <td style={{ padding:"14px 0" }} />
                  {cmp.map((idea,i)=>(
                    <td key={i} style={{ padding:"16px 18px", background:"#fff", border:`1px solid ${C.border}`, borderTop:"none", borderRadius:"0 0 12px 12px" }}>
                      <button onClick={()=>choose(idea)} disabled={loading} style={btn(C.disc)}>Choose this idea</button>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ── IDEAS LIST ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", minHeight:"100vh", fontFamily:FB }}>
      <WorkflowRail currentStage="discovery" completedStages={[]} userName={user?.name} onNavigate={()=>navigate("/dashboard")} />
      <div style={{ flex:1, background:"#F4F3EF", display:"flex", flexDirection:"column" }}>
        <div style={{ height:52, background:"#fff", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 28px", flexShrink:0 }}>
          <span style={{ fontFamily:FH, fontWeight:600, fontSize:15 }}>{ideas.length} ideas — ranked by fit with your profile</span>
          <div style={{ display:"flex", gap:10 }}>
            {compareSet.length>=2 && <button onClick={()=>setComparing(true)} style={btn(C.disc,"#fff",13)}>Compare {compareSet.length} ideas</button>}
            <button onClick={()=>navigate("/discovery")} style={btnO(C.muted,13)}>Edit profile</button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:"auto", padding:"24px 28px 80px" }}>
          <ErrorBox msg={error} />
          {loading && <div style={{ textAlign:"center", padding:"20px 0", color:C.muted, fontSize:14 }}>Creating your business and generating setup plan...</div>}

          {compareSet.length>0 && !comparing && (
            <div style={{ ...card("10px 16px"), marginBottom:14, display:"flex", alignItems:"center", justifyContent:"space-between", background:"#EEEEFF", border:`1px solid ${C.disc}18` }}>
              <span style={{ fontSize:13, color:C.disc, fontFamily:FB }}>{compareSet.length} idea{compareSet.length!==1?"s":""} selected</span>
              {compareSet.length>=2
                ? <button onClick={()=>setComparing(true)} style={{ ...btn(C.disc,"#fff",12), padding:"6px 14px" }}>Compare now</button>
                : <span style={{ fontSize:12, color:C.muted }}>Select one more to compare</span>}
            </div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {ideas.map((idea, idx) => {
              const isExp  = expanded===idx;
              const inCmp  = compareSet.includes(idx);
              const scores = idea.scores||{};
              const avg    = Object.keys(scores).length ? (Object.values(scores).reduce((a,b)=>a+Number(b),0)/Object.keys(scores).length).toFixed(1) : "—";
              return (
                <div key={idx} style={{ ...card(), border:`1px solid ${isExp?C.disc:C.border}`, transition:"border-color 0.15s" }}>
                  <div style={{ display:"flex", alignItems:"flex-start", gap:14 }}>
                    <div style={{ width:34, height:34, borderRadius:9, background:isExp?"#EEEEFF":"#F4F3EF", color:C.disc, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:FH, fontWeight:700, fontSize:14, flexShrink:0, marginTop:2 }}>{idx+1}</div>
                    <div style={{ flex:1, cursor:"pointer" }} onClick={()=>setExpanded(isExp?null:idx)}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:5, flexWrap:"wrap" }}>
                        <span style={{ fontFamily:FH, fontWeight:600, fontSize:16 }}>{idea.name}</span>
                        {idx===0 && !intake.ownIdea && <span style={badge(C.disc,"#EEEEFF")}>Top match</span>}
                        {intake.ownIdea && idx===0 && <span style={badge(C.disc,"#EEEEFF")}>Your idea</span>}
                      </div>
                      <div style={{ fontSize:13, color:C.muted, lineHeight:1.5, marginBottom:8 }}>{idea.tagline}</div>
                      <div style={{ display:"flex", gap:20, flexWrap:"wrap" }}>
                        {[["Revenue",idea.revenue],["Startup cost",idea.startupCost],["First revenue in",idea.timeToFirstRevenue]].map(([l,v])=>(
                          <span key={l} style={{ fontSize:12, color:C.muted }}>{l}: <strong style={{ color:C.text }}>{v}</strong></span>
                        ))}
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:8, flexShrink:0 }}>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontFamily:FH, fontWeight:700, fontSize:26, color:isExp?C.disc:C.text }}>{avg}</div>
                        <div style={{ fontSize:10, color:C.muted }}>/10 match</div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();toggleCmp(idx);}} style={{ ...btnO(inCmp?C.disc:C.muted,11), padding:"4px 10px", background:inCmp?"#EEEEFF":"transparent" }}>{inCmp?"Selected":"Compare"}</button>
                    </div>
                    <button onClick={()=>setExpanded(isExp?null:idx)} style={{ background:"none", border:"none", cursor:"pointer", color:C.muted, fontSize:12, fontFamily:FB, flexShrink:0, marginTop:4, padding:"4px 0" }}>{isExp?"Close":"Details"}</button>
                  </div>

                  {isExp && (
                    <div style={{ marginTop:22, paddingTop:22, borderTop:`1px solid ${C.border}` }}>
                      <div style={{ ...card("14px 16px"), background:"#EEEEFF", border:`1px solid ${C.disc}15`, marginBottom:22 }}>
                        <div style={{ fontSize:11, fontWeight:600, color:C.disc, textTransform:"uppercase", letterSpacing:"0.5px", marginBottom:6 }}>Why this fits your profile</div>
                        <div style={{ fontSize:14, color:C.text, lineHeight:1.75 }}>{idea.why}</div>
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0 28px", marginBottom:22 }}>
                        {Object.entries(scores).map(([k,v])=><ScoreBar key={k} label={k} value={v} color={C.disc} />)}
                      </div>
                      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:22 }}>
                        {[["Revenue potential",idea.revenue],["Time to first revenue",idea.timeToFirstRevenue],["Biggest risk",idea.biggestRisk]].map(([label,val])=>(
                          <div key={label} style={{ ...card("12px 14px"), background:"#F4F3EF" }}>
                            <div style={{ fontSize:10, color:C.muted, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.4px", marginBottom:5 }}>{label}</div>
                            <div style={{ fontSize:13, color:C.text, lineHeight:1.5 }}>{val}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display:"flex", gap:10 }}>
                        <button onClick={()=>choose(idea)} disabled={loading} style={btn(loading?"#CBD5E1":C.disc)}>
                          {loading?"Setting up...":"Choose this idea"}
                        </button>
                        <button onClick={()=>toggleCmp(idx)} style={btnO(inCmp?C.disc:C.muted)}>{inCmp?"Remove from compare":"Add to compare"}</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
