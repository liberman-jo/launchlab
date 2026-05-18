import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import useStore from "../lib/store";
import { C, FH, FB, btn, btnO, card } from "../components";

export default function Dashboard() {
  const { user, clearAuth, businesses, setBusinesses, setCurrentBusiness } = useStore();
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.businesses.list()
      .then(d => setBusinesses(d.businesses))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const logout = () => { clearAuth(); navigate("/"); };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:FB }}>
      {/* Top bar */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, height:54, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 32px" }}>
        <span style={{ fontFamily:FH, fontWeight:700, fontSize:17, letterSpacing:"-0.3px" }}>LaunchLab</span>
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <span style={{ fontSize:13, color:C.muted }}>{user?.name}</span>
          <button onClick={logout} style={{ ...btnO(C.muted,12), padding:"5px 12px" }}>Sign out</button>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"48px 24px" }}>
        <div style={{ fontFamily:FH, fontWeight:700, fontSize:28, marginBottom:4, letterSpacing:"-0.5px" }}>
          Welcome back{user?.name ? `, ${user.name}` : ""}.
        </div>
        <p style={{ color:C.muted, fontSize:15, marginBottom:36 }}>What would you like to work on?</p>

        {/* Launch new */}
        <div onClick={() => navigate("/discovery")} style={{ ...card("28px"), background:`linear-gradient(135deg, ${C.disc}, #6366F1)`, border:"none", cursor:"pointer", marginBottom:28, boxShadow:`0 6px 24px ${C.disc}30` }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              <div style={{ fontFamily:FH, fontWeight:700, fontSize:20, color:"#fff", marginBottom:6 }}>Start a new business</div>
              <div style={{ fontSize:14, color:"#ffffff90" }}>From idea to launch — guided by AI every step of the way.</div>
            </div>
            <div style={{ fontSize:32, color:"#ffffff60" }}>+</div>
          </div>
          <div style={{ display:"flex", gap:8, marginTop:20 }}>
            {["AI idea matching","Website generation","Business plan","Launch guidance"].map(t => (
              <span key={t} style={{ background:"#ffffff22", color:"#ffffffcc", fontSize:11, fontWeight:500, padding:"4px 10px", borderRadius:20, fontFamily:FB }}>{t}</span>
            ))}
          </div>
        </div>

        {/* Existing businesses */}
        {loading ? (
          <div style={{ textAlign:"center", padding:"40px 0", color:C.muted }}>Loading...</div>
        ) : businesses.length > 0 && (
          <>
            <div style={{ fontSize:12, fontWeight:600, color:C.muted, textTransform:"uppercase", letterSpacing:"0.8px", marginBottom:12 }}>Your businesses</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {businesses.map(b => {
                const idea   = (() => { try { return JSON.parse(b.ideaData); } catch { return {}; } })();
                const tasks  = b.tasks || [];
                const done   = tasks.filter(t => t.status==="done").length;
                const pct    = tasks.length ? Math.round(done/tasks.length*100) : 0;
                return (
                  <div key={b.id} onClick={() => { setCurrentBusiness(b.id); navigate(b.status==="live" ? `/hub/${b.id}` : `/creation/${b.id}`); }}
                    style={{ ...card(), cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontFamily:FH, fontWeight:600, fontSize:16 }}>{b.name}</span>
                        <span style={{ background:b.status==="live"?C.okBg:C.warnBg, color:b.status==="live"?C.ok:C.warn, fontSize:10, fontWeight:600, padding:"2px 8px", borderRadius:20, textTransform:"uppercase", letterSpacing:"0.3px" }}>
                          {b.status==="live" ? "Live" : "Setup"}
                        </span>
                      </div>
                      <div style={{ fontSize:13, color:C.muted }}>{idea.name || b.name} &middot; {b.location}</div>
                      {pct < 100 && (
                        <div style={{ marginTop:10 }}>
                          <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                            <div style={{ width:120, height:4, borderRadius:2, background:C.border }}>
                              <div style={{ height:"100%", width:`${pct}%`, background:C.crea, borderRadius:2 }} />
                            </div>
                            <span style={{ fontSize:11, color:C.muted }}>{done}/{tasks.length} tasks done</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <span style={{ color:C.muted, fontSize:18 }}>&#8250;</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
