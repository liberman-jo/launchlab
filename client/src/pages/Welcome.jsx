import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import useStore from "../lib/store";
import { C, FH, FB, btn, inp, card } from "../components";

export default function Welcome() {
  const [mode,  setMode]  = useState("login");  // login | register
  const [form,  setForm]  = useState({ name:"", email:"", password:"", goal:"" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { setAuth } = useStore();
  const navigate = useNavigate();

  const upForm = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const fn = mode === "login" ? api.auth.login : api.auth.register;
      const { token, user } = await fn(form);
      setAuth(token, user);
      navigate("/dashboard");
    } catch (e) {
      setError(e.message);
    } finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", fontFamily:FB, background:"#F4F3EF" }}>
      {/* Left panel */}
      <div style={{ width:"44%", background:C.dark, display:"flex", flexDirection:"column", justifyContent:"center", padding:"72px 56px", position:"relative", overflow:"hidden", flexShrink:0 }}>
        <div style={{ position:"absolute", inset:0, background:"radial-gradient(ellipse at 20% 80%, #4338CA1a, transparent 60%), radial-gradient(ellipse at 90% 10%, #0369A118, transparent 50%)" }} />
        <div style={{ position:"relative", zIndex:1 }}>
          <div style={{ fontFamily:FH, fontWeight:700, fontSize:20, color:"#fff", marginBottom:60, letterSpacing:"-0.4px" }}>LaunchLab</div>
          <div style={{ fontFamily:FH, fontWeight:700, fontSize:48, color:"#fff", lineHeight:1.0, letterSpacing:"-1.8px", marginBottom:24 }}>From idea<br/>to income.</div>
          <p style={{ fontSize:16, color:"#ffffff70", lineHeight:1.8, marginBottom:52, maxWidth:340 }}>LaunchLab finds the right business for your life, builds the foundation, generates your website and marketing content, and guides every step with AI.</p>
          <div style={{ display:"flex", flexDirection:"column", gap:22 }}>
            {[["01","Discovery","AI matches business ideas to your skills and goals"],["02","Creation","Generates your website, business plan, and content"],["03","Growth","Provides social media, email, and marketing assets"],["04","Launch","Guides integrations with Stripe, Calendly, Google, and more"]].map(([num,title,desc]) => (
              <div key={num} style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
                <div style={{ fontFamily:FH, fontWeight:700, fontSize:11, color:"#ffffff30", letterSpacing:"1px", marginTop:3, minWidth:20 }}>{num}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#ffffffcc", marginBottom:3 }}>{title}</div>
                  <div style={{ fontSize:12, color:"#ffffff45", lineHeight:1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:56 }}>
        <div style={{ width:"100%", maxWidth:380 }}>
          <div style={{ fontFamily:FH, fontWeight:700, fontSize:30, color:C.text, marginBottom:8, letterSpacing:"-0.6px" }}>
            {mode === "login" ? "Sign in" : "Create your account"}
          </div>
          <p style={{ fontSize:14, color:C.muted, marginBottom:32, lineHeight:1.65 }}>
            {mode === "login" ? "Welcome back." : "Start building your business today."}
          </p>

          {error && (
            <div style={{ ...card("12px 16px"), background:C.errBg, border:`1px solid ${C.err}25`, marginBottom:20, fontSize:13, color:C.err }}>
              {error}
            </div>
          )}

          <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
            {mode === "register" && (
              <div>
                <label style={{ fontSize:13, fontWeight:500, display:"block", marginBottom:7, fontFamily:FB }}>First name</label>
                <input value={form.name} onChange={e=>upForm("name",e.target.value)} placeholder="Your name" style={inp()} />
              </div>
            )}
            <div>
              <label style={{ fontSize:13, fontWeight:500, display:"block", marginBottom:7, fontFamily:FB }}>Email</label>
              <input type="email" value={form.email} onChange={e=>upForm("email",e.target.value)} placeholder="you@email.com" style={inp()} onKeyDown={e=>e.key==="Enter"&&submit()} />
            </div>
            <div>
              <label style={{ fontSize:13, fontWeight:500, display:"block", marginBottom:7, fontFamily:FB }}>Password</label>
              <input type="password" value={form.password} onChange={e=>upForm("password",e.target.value)} placeholder={mode==="register"?"8+ characters":""} style={inp()} onKeyDown={e=>e.key==="Enter"&&submit()} />
            </div>
            {mode === "register" && (
              <div>
                <label style={{ fontSize:13, fontWeight:500, display:"block", marginBottom:10, fontFamily:FB }}>What are you hoping to accomplish?</label>
                {[["extra_income","Earn extra income on the side"],["replace_job","Replace my full-time income"],["build_company","Build something to grow or sell"]].map(([val,label]) => (
                  <div key={val} onClick={()=>upForm("goal",val)} style={{ marginBottom:9, padding:"12px 16px", borderRadius:10, border:`1.5px solid ${form.goal===val?C.disc:C.border}`, background:form.goal===val?"#EEEEFF":C.surface, cursor:"pointer", display:"flex", alignItems:"center", gap:12, transition:"all 0.12s" }}>
                    <div style={{ width:16, height:16, borderRadius:"50%", border:`2px solid ${form.goal===val?C.disc:C.border}`, background:form.goal===val?C.disc:"transparent", flexShrink:0 }} />
                    <span style={{ fontSize:14, color:form.goal===val?C.disc:C.text, fontWeight:form.goal===val?500:400, fontFamily:FB }}>{label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button onClick={submit} disabled={loading} style={{ ...btn(C.disc), width:"100%", padding:"13px", fontSize:15, borderRadius:10, marginTop:28, opacity:loading?0.7:1 }}>
            {loading ? "Please wait..." : mode==="login" ? "Sign in" : "Create account"}
          </button>

          <p style={{ textAlign:"center", fontSize:13, color:C.muted, marginTop:20, fontFamily:FB }}>
            {mode==="login" ? "Don't have an account? " : "Already have an account? "}
            <span onClick={()=>{ setMode(mode==="login"?"register":"login"); setError(""); }} style={{ color:C.disc, cursor:"pointer", fontWeight:500 }}>
              {mode==="login" ? "Sign up" : "Sign in"}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
