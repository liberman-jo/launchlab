import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import useStore from "../lib/store";
import { api } from "../lib/api";
import { C, FH, FB, btn, btnSm, btnO, card, cardMd, badge, inp, label, GuidePanel, DownloadBtn, Spinner, ErrorBox } from "../components";

const TODAY = new Date().toISOString().slice(0, 10);
const INCOME_CATS  = ["Sales","Services","Consulting","Referral","Commission","Grant","Other"];
const EXPENSE_CATS = ["Marketing","Software","Legal","Operations","Office","Travel","Inventory","Other"];
const LEAD_STATUSES = ["new","emailed","responded","client","declined"];

const sj = (s, fb = {}) => { try { return JSON.parse(s || "{}") || fb; } catch { return fb; } };

// ── Small helpers ─────────────────────────────────────────────────────────────
function Dot({ color, pulse }) {
  return <span className={pulse ? "pulsing" : ""} style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

function Stat({ label: lbl, value, sub, accent, onClick }) {
  return (
    <div onClick={onClick} style={{ ...card("16px 20px"), borderLeft: `3px solid ${accent}`, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>{lbl}</div>
      <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 26, color: C.text, marginBottom: sub ? 3 : 0, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.muted }}>{sub}</div>}
    </div>
  );
}

function Ring({ score, color }) {
  return (
    <div style={{ width: 60, height: 60, borderRadius: "50%", border: `3px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 20, color }}>{score}</span>
    </div>
  );
}

function LogEntry({ log }) {
  const icon = {
    management_report: { ch: "📊", color: C.mgmt },
    marketing_report:  { ch: "📣", color: C.mktg },
    lead_generation:   { ch: "🎯", color: C.disc },
    outreach_email:    { ch: "✉️",  color: C.crea },
    client_deliverable:{ ch: "🏗",  color: C.auto },
    client_delivery:   { ch: "📦", color: C.ok },
    seo_optimize:      { ch: "🔍", color: C.mktg },
    social_post:       { ch: "📱", color: C.mktg },
    website_deploy:    { ch: "🌐", color: C.crea },
    calendly_booking:  { ch: "📅", color: C.disc },
  }[log.type] || { ch: "⚡", color: C.muted };
  const when = new Date(log.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div style={{ display: "flex", gap: 12, padding: "11px 0", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: icon.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{icon.ch}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5 }}>{log.description}</div>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{when}</div>
      </div>
      {log.status === "error" && <span style={badge(C.err, C.errBg, 9)}>failed</span>}
    </div>
  );
}

function LeadCard({ lead, onUpdate, onDelete }) {
  const [loading, setLoading] = useState(false);
  const statusColor = { new: C.muted, emailed: C.disc, responded: C.warn, client: C.ok, declined: C.err }[lead.status] || C.muted;
  const statusBg    = { new: C.bg, emailed: C.discBg, responded: C.warnBg, client: C.okBg, declined: C.errBg }[lead.status] || C.bg;
  const deliverables = sj(typeof lead.deliverableData === "string" ? lead.deliverableData : JSON.stringify(lead.deliverableData || {}));

  const next = (current) => {
    const idx = LEAD_STATUSES.indexOf(current);
    return LEAD_STATUSES[Math.min(idx + 1, LEAD_STATUSES.length - 1)];
  };

  const advance = async () => {
    setLoading(true);
    const newStatus = next(lead.status);
    await onUpdate(lead.id, { status: newStatus }).finally(() => setLoading(false));
  };

  return (
    <div style={{ ...card("16px 18px"), borderLeft: `3px solid ${statusColor}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{lead.name}</span>
            <span style={badge(statusColor, statusBg, 9)}>{lead.status}</span>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>{lead.businessType}{lead.location ? ` · ${lead.location}` : ""}</div>
          {lead.contactEmail && <div style={{ fontSize: 11, color: C.disc, marginTop: 3 }}>{lead.contactEmail}</div>}
          {lead.notes && <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>{lead.notes}</div>}
          {lead.emailSentAt && <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>Emailed {new Date(lead.emailSentAt).toLocaleDateString()}</div>}
          {deliverables.generated && (
            <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {deliverables.website && <button onClick={() => { const b = new Blob([deliverables.website], { type: "text/html" }); const u = URL.createObjectURL(b); window.open(u, "_blank"); setTimeout(() => URL.revokeObjectURL(u), 3000); }} style={{ ...btnSm(C.crea), fontSize: 10 }}>Preview website</button>}
              {deliverables.social  && <a href={`data:application/json;charset=utf-8,${encodeURIComponent(deliverables.social)}`} download={`${lead.name}-social.json`} style={{ ...btnSm(C.disc), fontSize: 10, display: "inline-block" }}>Social calendar</a>}
              {deliverables.emails  && <a href={`data:application/json;charset=utf-8,${encodeURIComponent(deliverables.emails)}`} download={`${lead.name}-emails.json`} style={{ ...btnSm(C.mgmt), fontSize: 10, display: "inline-block" }}>Email templates</a>}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
          {lead.status !== "client" && lead.status !== "declined" && (
            <button onClick={advance} disabled={loading} style={{ ...btnSm(C.disc), fontSize: 11 }}>
              {loading ? <Spinner size={10} color="#fff" /> : lead.status === "new" ? "Mark emailed" : lead.status === "emailed" ? "Responded" : "Convert to client"}
            </button>
          )}
          {lead.status === "client" && !deliverables.generated && (
            <span style={{ fontSize: 11, color: C.auto }}>Generating deliverables...</span>
          )}
          <button onClick={() => onDelete(lead.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.subtle, fontSize: 15, padding: "2px 4px" }}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ── Setup Guide Card ──────────────────────────────────────────────────────────
function SetupGuide({ title, steps, docsUrl, docsLabel, color = "#5B47F5" }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 12, borderRadius: 8, overflow: "hidden", border: `1px solid ${color}20` }}>
      <button onClick={() => setOpen(p => !p)} style={{ width: "100%", background: color + "0C", border: "none", padding: "10px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: FB }}>
        <span style={{ fontSize: 12, fontWeight: 600, color, textTransform: "uppercase", letterSpacing: "0.4px" }}>How to get these credentials</span>
        <span style={{ color, fontSize: 14 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ padding: "14px 16px", background: color + "06" }}>
          <ol style={{ paddingLeft: 20, margin: 0 }}>
            {steps.map((s, i) => (
              <li key={i} style={{ fontSize: 13, color: "#0F0F0F", lineHeight: 1.7, marginBottom: 4 }}
                dangerouslySetInnerHTML={{ __html: s }} />
            ))}
          </ol>
          {docsUrl && <a href={docsUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", marginTop: 10, fontSize: 12, color, fontWeight: 600 }}>{docsLabel || "Open documentation →"}</a>}
        </div>
      )}
    </div>
  );
}

// ── Settings Tab ─────────────────────────────────────────────────────────────
function SettingsTab({ business, businessId, autoMode, cycleMode, creds, setCreds, saveCreds, savingCreds, outputs, genLoading, generateAsset, getOutput, integs, isConnected, modeColor, modeBg, setError, setLogs }) {
  const [testPosting,  setTestPosting]  = useState(false);
  const [testCaption,  setTestCaption]  = useState("");
  const [deployLoading,setDeployLoading]= useState(false);
  const [netlifyResult,setNetlifyResult]= useState(null);
  const [testNetlify,  setTestNetlify]  = useState(false);

  const saveAll = () => saveCreds();

  const runTestPost = async () => {
    if (!testCaption.trim()) return;
    setTestPosting(true);
    try {
      const { results } = await api.automation.testPost(businessId, testCaption, []);
      const ok  = results.filter(r => r.ok).map(r => r.platform).join(", ") || "none";
      const err = results.filter(r => !r.ok).map(r => `${r.platform}: ${r.error}`).join("; ");
      alert(`Posted to: ${ok}${err ? `\n\nFailed: ${err}` : ""}`);
    } catch (e) { setError(e.message); }
    finally { setTestPosting(false); }
  };

  const runDeploy = async () => {
    setDeployLoading(true);
    try {
      const { url } = await api.automation.deploy(businessId);
      setNetlifyResult(url);
      api.automation.logs(businessId).then(r => setLogs(r.logs)).catch(() => {});
    } catch (e) { setError(e.message); }
    finally { setDeployLoading(false); }
  };

  const verifyNetlify = async () => {
    setTestNetlify(true);
    try {
      const { siteName, siteUrl } = await api.automation.testNetlify(businessId, { netlifyToken: creds.netlifyToken, netlifySiteId: creds.netlifySiteId });
      alert(`✓ Connected to Netlify site "${siteName}" — ${siteUrl}`);
    } catch (e) { setError(e.message); }
    finally { setTestNetlify(false); }
  };

  const c = creds;
  const hasMeta = c.fbPageId && c.fbPageToken;
  const hasIG   = c.igUserId && c.igToken;
  const hasLI   = c.linkedInUrn && c.linkedInToken;
  const hasTW   = c.twitterApiKey && c.twitterToken;
  const hasNF   = c.netlifyToken && c.netlifySiteId;
  const hasEmail= c.emailUser && c.emailPass;

  const websiteOut = getOutput("website");

  return (
    <div className="fade-in">
      <h1 style={{ fontFamily: FH, fontWeight: 700, fontSize: 34, letterSpacing: "-0.5px", marginBottom: 6 }}>Settings</h1>
      <p style={{ fontSize: 13, color: C.muted, marginBottom: 32 }}>Connect your platforms and enable Full Auto mode — the agents will handle everything automatically once credentials are saved.</p>

      {/* Automation Modes */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: FH, fontSize: 20, marginBottom: 16 }}>Automation Modes</div>
        <div style={card()}>
          <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7, marginBottom: 16, padding: "12px 16px", background: C.bg, borderRadius: 8 }}>
            <strong style={{ color: C.text }}>Manual</strong> — you generate reports and trigger all actions yourself.<br />
            <strong style={{ color: C.text }}>Guided</strong> — AI writes step-by-step instructions for each task you need to do.<br />
            <strong style={{ color: C.auto }}>Full auto</strong> — every 15 min: generate leads → send cold emails → post to social media → deploy website → generate client deliverables → file daily reports. Zero clicks required.
          </div>
          {[["management","Management Agent",C.mgmt],["marketing","Marketing Agent",C.mktg]].map(([key, lbl, color]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderTop: `1px solid ${C.border}` }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{lbl}</div>
                {autoMode[key] === "Full auto" && <div style={{ fontSize: 11, color: C.auto, marginTop: 2 }}>Active — next cycle in ≤15 minutes</div>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={badge(modeColor(autoMode[key]), modeBg(autoMode[key]), 10)}>{autoMode[key] || "Manual"}</span>
                <button onClick={() => cycleMode(key)} style={{ ...btnO(color, 12), padding: "6px 14px" }}>Change</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── COLD EMAIL ─────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ fontFamily: FH, fontSize: 20 }}>Cold Email Outreach</div>
          {hasEmail && <span style={badge(C.ok, C.okBg, 9)}>connected</span>}
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Enables Full Auto mode to send personalized cold emails to generated leads.</p>
        <div style={card()}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div><div style={label}>Gmail address</div><input value={c.emailUser || ""} onChange={e => setCreds(p => ({ ...p, emailUser: e.target.value }))} placeholder="you@gmail.com" style={inp()} /></div>
            <div><div style={label}>Gmail App Password</div><input type="password" value={c.emailPass || ""} onChange={e => setCreds(p => ({ ...p, emailPass: e.target.value }))} placeholder="xxxx xxxx xxxx xxxx" style={inp()} /></div>
          </div>
          <button onClick={saveAll} disabled={savingCreds} style={btn(C.disc, "#fff", 13)}>{savingCreds ? "Saving..." : "Save"}</button>
          <SetupGuide color={C.disc} title="How to get a Gmail App Password" steps={[
            'Go to <a href="https://myaccount.google.com/security" target="_blank" style="color:#5B47F5">myaccount.google.com/security</a>',
            "Enable <strong>2-Step Verification</strong> if not already on",
            'Go to <a href="https://myaccount.google.com/apppasswords" target="_blank" style="color:#5B47F5">myaccount.google.com/apppasswords</a>',
            'Select app: <strong>Mail</strong> → Select device: <strong>Other</strong> → name it "LaunchLab"',
            "Copy the 16-character password — paste it above",
          ]} docsUrl="https://myaccount.google.com/apppasswords" docsLabel="Open App Passwords page →" />
        </div>
      </section>

      {/* ── FACEBOOK ───────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ fontFamily: FH, fontSize: 20 }}>Facebook Pages</div>
          {hasMeta && <span style={badge(C.ok, C.okBg, 9)}>connected</span>}
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Auto-posts your daily social content to your Facebook Business Page.</p>
        <div style={card()}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div><div style={label}>Facebook Page ID</div><input value={c.fbPageId || ""} onChange={e => setCreds(p => ({ ...p, fbPageId: e.target.value }))} placeholder="123456789012345" style={inp()} /></div>
            <div><div style={label}>Page Access Token</div><input type="password" value={c.fbPageToken || ""} onChange={e => setCreds(p => ({ ...p, fbPageToken: e.target.value }))} placeholder="EAAxxxxxxxx..." style={inp()} /></div>
          </div>
          <button onClick={saveAll} disabled={savingCreds} style={btn(C.disc, "#fff", 13)}>{savingCreds ? "Saving..." : "Save"}</button>
          <SetupGuide color="#1877F2" steps={[
            'Go to <a href="https://developers.facebook.com/apps" target="_blank" style="color:#1877F2">developers.facebook.com</a> → Create App → Business type',
            "Add the <strong>Pages API</strong> product to your app",
            'Open <strong>Graph API Explorer</strong> → select your app → select your Page in the dropdown',
            "Set permissions: <strong>pages_manage_posts</strong>, <strong>pages_read_engagement</strong>",
            "Click <strong>Generate Access Token</strong> — copy the Page Access Token",
            "Your <strong>Page ID</strong> is in your Facebook Page URL or in Page Settings → About",
          ]} docsUrl="https://developers.facebook.com/docs/pages-api" docsLabel="Facebook Pages API docs →" />
        </div>
      </section>

      {/* ── INSTAGRAM ──────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ fontFamily: FH, fontSize: 20 }}>Instagram Business</div>
          {hasIG && <span style={badge(C.ok, C.okBg, 9)}>connected</span>}
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Auto-posts to your Instagram Business account. Requires a public image URL per post — set a default below (your logo or a branded template image URL).</p>
        <div style={card()}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div><div style={label}>Instagram User ID</div><input value={c.igUserId || ""} onChange={e => setCreds(p => ({ ...p, igUserId: e.target.value }))} placeholder="17841400000000000" style={inp()} /></div>
            <div><div style={label}>User Access Token</div><input type="password" value={c.igToken || ""} onChange={e => setCreds(p => ({ ...p, igToken: e.target.value }))} placeholder="EAAxxxxxxxx..." style={inp()} /></div>
            <div style={{ gridColumn: "1/-1" }}><div style={label}>Default image URL (public, required for all IG posts)</div><input value={c.igDefaultImage || ""} onChange={e => setCreds(p => ({ ...p, igDefaultImage: e.target.value }))} placeholder="https://yourdomain.com/logo.jpg" style={inp()} /></div>
          </div>
          <button onClick={saveAll} disabled={savingCreds} style={btn(C.disc, "#fff", 13)}>{savingCreds ? "Saving..." : "Save"}</button>
          <SetupGuide color="#E1306C" steps={[
            "Convert your Instagram profile to a <strong>Business account</strong> (Instagram Settings → Account type)",
            "Link it to a <strong>Facebook Page</strong> (required by Meta for API access)",
            'Go to <a href="https://developers.facebook.com/apps" target="_blank" style="color:#E1306C">developers.facebook.com</a> → your app → Add <strong>Instagram Graph API</strong> product',
            "In Graph API Explorer: add permissions <strong>instagram_basic</strong>, <strong>instagram_content_publish</strong>, <strong>pages_read_engagement</strong>",
            "Generate a <strong>User Access Token</strong> (long-lived: exchange short-lived token at <code>/oauth/access_token</code>)",
            "Get your Instagram User ID: call <code>GET /me/accounts</code> then look for the instagram_business_account ID",
          ]} docsUrl="https://developers.facebook.com/docs/instagram-api/guides/content-publishing" docsLabel="Instagram Content Publishing docs →" />
        </div>
      </section>

      {/* ── LINKEDIN ───────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ fontFamily: FH, fontSize: 20 }}>LinkedIn</div>
          {hasLI && <span style={badge(C.ok, C.okBg, 9)}>connected</span>}
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Auto-posts professional updates to your LinkedIn profile.</p>
        <div style={card()}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div><div style={label}>LinkedIn Person URN</div><input value={c.linkedInUrn || ""} onChange={e => setCreds(p => ({ ...p, linkedInUrn: e.target.value }))} placeholder="abc123xyz" style={inp()} /></div>
            <div><div style={label}>Access Token</div><input type="password" value={c.linkedInToken || ""} onChange={e => setCreds(p => ({ ...p, linkedInToken: e.target.value }))} placeholder="AQV..." style={inp()} /></div>
          </div>
          <button onClick={saveAll} disabled={savingCreds} style={btn(C.disc, "#fff", 13)}>{savingCreds ? "Saving..." : "Save"}</button>
          <SetupGuide color="#0A66C2" steps={[
            'Go to <a href="https://www.linkedin.com/developers/apps/new" target="_blank" style="color:#0A66C2">linkedin.com/developers</a> → Create App',
            "Add product: <strong>Share on LinkedIn</strong> and <strong>Sign In with LinkedIn</strong>",
            "Set OAuth redirect URL to <code>https://www.linkedin.com/developers/tools/oauth</code>",
            "Use the OAuth Token Generator tool in the app → request <strong>w_member_social</strong> permission",
            "Your Person URN: in the token inspector, look for <code>sub</code> — that is your Person ID (URN = <code>urn:li:person:{sub}</code>, paste just the ID part)",
          ]} docsUrl="https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/ugc-post-api" docsLabel="LinkedIn UGC Posts docs →" />
        </div>
      </section>

      {/* ── TWITTER / X ────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ fontFamily: FH, fontSize: 20 }}>X (Twitter)</div>
          {hasTW && <span style={badge(C.ok, C.okBg, 9)}>connected</span>}
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Auto-posts to your X account (captions trimmed to 280 characters).</p>
        <div style={card()}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div><div style={label}>API Key</div><input type="password" value={c.twitterApiKey || ""} onChange={e => setCreds(p => ({ ...p, twitterApiKey: e.target.value }))} placeholder="API Key" style={inp()} /></div>
            <div><div style={label}>API Secret</div><input type="password" value={c.twitterApiSecret || ""} onChange={e => setCreds(p => ({ ...p, twitterApiSecret: e.target.value }))} placeholder="API Key Secret" style={inp()} /></div>
            <div><div style={label}>Access Token</div><input type="password" value={c.twitterToken || ""} onChange={e => setCreds(p => ({ ...p, twitterToken: e.target.value }))} placeholder="Access Token" style={inp()} /></div>
            <div><div style={label}>Access Token Secret</div><input type="password" value={c.twitterSecret || ""} onChange={e => setCreds(p => ({ ...p, twitterSecret: e.target.value }))} placeholder="Access Token Secret" style={inp()} /></div>
          </div>
          <button onClick={saveAll} disabled={savingCreds} style={btn(C.disc, "#fff", 13)}>{savingCreds ? "Saving..." : "Save"}</button>
          <SetupGuide color="#000000" steps={[
            'Go to <a href="https://developer.twitter.com/en/portal/apps/new" target="_blank" style="color:#333">developer.twitter.com</a> → Create Project → Create App',
            "Under <strong>User authentication settings</strong>: enable OAuth 1.0a, set App permissions to <strong>Read and Write</strong>",
            "Go to <strong>Keys and Tokens</strong> tab → copy API Key and Secret",
            "Generate <strong>Access Token and Secret</strong> (under the same tab) — make sure these are for your own account",
          ]} docsUrl="https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets" docsLabel="X API Manage Tweets docs →" />
        </div>
      </section>

      {/* ── NETLIFY ────────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ fontFamily: FH, fontSize: 20 }}>Netlify Auto-Deploy</div>
          {hasNF && <span style={badge(C.ok, C.okBg, 9)}>connected</span>}
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>Every time your website is generated or SEO-optimized, it deploys to Netlify automatically — your site stays current without you touching anything.</p>
        <div style={card()}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div><div style={label}>Personal Access Token</div><input type="password" value={c.netlifyToken || ""} onChange={e => setCreds(p => ({ ...p, netlifyToken: e.target.value }))} placeholder="nfp_xxxxxxxxxxxx" style={inp()} /></div>
            <div><div style={label}>Site ID</div><input value={c.netlifySiteId || ""} onChange={e => setCreds(p => ({ ...p, netlifySiteId: e.target.value }))} placeholder="abc12345-xxxx-xxxx-xxxx-xxxxxxxxxxxx" style={inp()} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={saveAll} disabled={savingCreds} style={btn(C.disc, "#fff", 13)}>{savingCreds ? "Saving..." : "Save"}</button>
            {hasNF && <button onClick={verifyNetlify} disabled={testNetlify} style={{ ...btnO(C.disc, 13) }}>{testNetlify ? "Checking..." : "Verify connection"}</button>}
            {hasNF && websiteOut && (
              <button onClick={runDeploy} disabled={deployLoading} style={{ ...btn(C.ok, "#fff", 13), display: "flex", alignItems: "center", gap: 6 }}>
                {deployLoading ? <><Spinner size={12} color="#fff" /> Deploying...</> : "Deploy now"}
              </button>
            )}
          </div>
          {netlifyResult && <div style={{ marginTop: 12, fontSize: 13, color: C.ok }}>Live at: <a href={netlifyResult} target="_blank" rel="noreferrer" style={{ color: C.disc }}>{netlifyResult}</a></div>}
          <SetupGuide color="#00AD9F" steps={[
            'Go to <a href="https://app.netlify.com/user/applications" target="_blank" style="color:#00AD9F">app.netlify.com/user/applications</a>',
            "Under <strong>Personal access tokens</strong> → <strong>New access token</strong> → name it LaunchLab → copy the token",
            'Create a new site: drag any file to <a href="https://app.netlify.com/drop" target="_blank" style="color:#00AD9F">netlify.com/drop</a> or from the <strong>Sites</strong> page → <strong>Add new site</strong>',
            "Open the site → <strong>Site configuration</strong> → <strong>General</strong> — copy the <strong>Site ID</strong> (looks like: abc12345-xxxx-xxxx-xxxx-xxxxxxxxxxxx)",
          ]} docsUrl="https://docs.netlify.com/api/get-started/#deploy-with-the-api" docsLabel="Netlify Deploy API docs →" />
        </div>
      </section>

      {/* ── CALENDLY ───────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ fontFamily: FH, fontSize: 20 }}>Calendly (Booking Automation)</div>
          {c.calendlyWebhookSecret && <span style={badge(C.ok, C.okBg, 9)}>connected</span>}
        </div>
        <p style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>When someone books a meeting on your Calendly page, LaunchLab instantly creates a lead, moves them to "responded", and auto-sends a warm confirmation email — all without you lifting a finger.</p>
        <div style={card()}>
          <div style={{ marginBottom: 14 }}>
            <div style={label}>Your Webhook URL (paste this into Calendly)</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input readOnly value={`${window.location.origin.replace("5173","3001")}/api/webhooks/calendly/${businessId}`} style={{ ...inp(), color: C.disc, background: C.discBg }} />
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin.replace("5173","3001")}/api/webhooks/calendly/${businessId}`)} style={{ ...btnO(C.disc, 12), padding: "8px 14px", whiteSpace: "nowrap" }}>Copy URL</button>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <div style={label}>Webhook Signing Secret (optional — for signature verification)</div>
            <input type="password" value={c.calendlyWebhookSecret || ""} onChange={e => setCreds(p => ({ ...p, calendlyWebhookSecret: e.target.value }))} placeholder="Paste Calendly signing secret..." style={inp()} />
          </div>
          <button onClick={saveAll} disabled={savingCreds} style={btn(C.disc, "#fff", 13)}>{savingCreds ? "Saving..." : "Save"}</button>
          <SetupGuide color="#006BFF" steps={[
            'Go to <a href="https://calendly.com/integrations/webhooks" target="_blank" style="color:#006BFF">calendly.com/integrations/webhooks</a> (Integrations → Webhooks)',
            "Click <strong>+ Add new webhook subscription</strong>",
            "Paste your Webhook URL (shown above) into the URL field",
            "Under <strong>Events to subscribe</strong>, check: <strong>invitee.created</strong> and <strong>invitee.canceled</strong>",
            "Click <strong>Create webhook</strong> — Calendly will send a test ping to verify",
            "Optional: copy the <strong>Signing Key</strong> shown on the webhook page and paste it into the Signing Secret field above",
          ]} docsUrl="https://developer.calendly.com/api-docs/YXBpOjI3MDM4OA-webhooks" docsLabel="Calendly Webhooks docs →" />
        </div>
      </section>

      {/* ── TEST SOCIAL POST ───────────────────────────────────────────────── */}
      {(hasMeta || hasIG || hasLI || hasTW) && (
        <section style={{ marginBottom: 36 }}>
          <div style={{ fontFamily: FH, fontSize: 20, marginBottom: 16 }}>Test Social Post</div>
          <div style={card()}>
            <p style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>Send a test post to all connected platforms right now to confirm everything is working.</p>
            <div style={{ marginBottom: 12 }}>
              <div style={label}>Test caption</div>
              <textarea value={testCaption} onChange={e => setTestCaption(e.target.value)} placeholder="Write a test post..." rows={3} style={{ ...inp(), resize: "vertical" }} />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
              {[hasMeta && "Facebook", hasIG && "Instagram", hasLI && "LinkedIn", hasTW && "X"].filter(Boolean).map(p => (
                <span key={p} style={badge(C.ok, C.okBg, 10)}>{p}</span>
              ))}
            </div>
            <button onClick={runTestPost} disabled={testPosting || !testCaption.trim()} style={{ ...btn(C.dark, "#fff", 13), display: "flex", alignItems: "center", gap: 8 }}>
              {testPosting ? <><Spinner size={12} color="#fff" /> Posting...</> : "Send test post"}
            </button>
          </div>
        </section>
      )}

      {/* ── GENERATED ASSETS ───────────────────────────────────────────────── */}
      <section style={{ marginBottom: 36 }}>
        <div style={{ fontFamily: FH, fontSize: 20, marginBottom: 16 }}>Generated Assets</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { type: "website",         lbl: "Business Website",       ext: ".html", mime: "text/html",        apiCall: api.generate.website       },
            { type: "business_plan",   lbl: "Business Plan",          ext: ".html", mime: "text/html",        apiCall: api.generate.businessPlan  },
            { type: "social_content",  lbl: "30-Day Social Calendar", ext: ".json", mime: "application/json", apiCall: api.generate.socialContent  },
            { type: "email_templates", lbl: "Email Templates",        ext: ".json", mime: "application/json", apiCall: api.generate.emailTemplates },
          ].map(({ type, lbl, ext, mime, apiCall }) => {
            const out = getOutput(type);
            return (
              <div key={type} style={{ ...card("14px 20px"), display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{lbl}</span>
                    {out && <span style={badge(C.ok, C.okBg, 9)}>ready</span>}
                  </div>
                  <div style={{ fontSize: 12, color: C.muted }}>{out ? `Last generated ${new Date(out.updatedAt || out.createdAt).toLocaleDateString()}` : "Not yet generated"}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {out && <DownloadBtn content={out.content} filename={`${business?.name?.replace(/\s+/g, "-").toLowerCase()}-${type}${ext}`} label="Download" mimeType={mime} />}
                  <button onClick={() => generateAsset(type, apiCall)} disabled={!!genLoading[type]} style={{ ...btn(out ? C.dark : C.crea, "#fff", 12), display: "flex", alignItems: "center", gap: 6 }}>
                    {genLoading[type] ? <><Spinner size={11} color="#fff" /> Generating...</> : out ? "Regenerate" : "Generate"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ── Main Hub Component ────────────────────────────────────────────────────────
export default function Hub() {
  const { id: businessId } = useParams();
  const [searchParams]    = useSearchParams();
  const { user }           = useStore();
  const navigate           = useNavigate();

  // Data
  const [business,   setBusiness]   = useState(null);
  const [tasks,      setTasks]      = useState([]);
  const [outputs,    setOutputs]    = useState([]);
  const [integs,     setIntegs]     = useState([]);
  const [finances,   setFinances]   = useState([]);
  const [leads,      setLeads]      = useState([]);
  const [logs,       setLogs]       = useState([]);
  const [mgmtReport, setMgmtReport] = useState(null);
  const [mktgReport, setMktgReport] = useState(null);
  const [autoMode,   setAutoMode]   = useState({ management: "Manual", marketing: "Manual" });

  // UI state
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");
  const [hubTab,        setHubTab]        = useState(searchParams.get("tab") || "command");
  const [chatOpen,      setChatOpen]      = useState(false);
  const [chatMsgs,      setChatMsgs]      = useState([{ role: "ai", text: "Your business is live. Ask me anything." }]);

  // Loading states
  const [genLoading,    setGenLoading]    = useState({});
  const [reportLoading, setReportLoading] = useState({});
  const [leadsLoading,  setLeadsLoading]  = useState(false);
  const [autoRunning,   setAutoRunning]   = useState(false);
  const [seoLoading,    setSeoLoading]    = useState(false);
  const [postLoading,   setPostLoading]   = useState(false);
  const [addingEntry,   setAddingEntry]   = useState(false);
  const [showEntry,     setShowEntry]     = useState(false);
  const [savingCreds,   setSavingCreds]   = useState(false);

  // Forms
  const [newEntry,     setNewEntry]     = useState({ type: "income", category: "Sales", amount: "", description: "", date: TODAY });
  const [generatedPost,setGeneratedPost]= useState(null);
  const [postPlatform, setPostPlatform] = useState("Instagram");
  const [postType,     setPostType]     = useState("promotional");
  const [copied,       setCopied]       = useState(null);
  const [creds,        setCreds]        = useState({ emailUser: "", emailPass: "", smtpHost: "smtp.gmail.com", smtpPort: "587" });

  const getOutput = useCallback((type) => outputs.find(o => o.type === type), [outputs]);

  useEffect(() => {
    Promise.all([
      api.businesses.get(businessId),
      api.businesses.outputs(businessId),
      api.integrations.list(businessId),
      api.tasks.list(businessId),
      api.finances.list(businessId),
      api.leads.list(businessId),
      api.automation.logs(businessId),
    ]).then(([{ business: b }, { outputs: o }, { integrations: ig }, { tasks: t }, { entries: f }, { leads: ld }, { logs: lg }]) => {
      setBusiness(b);
      setOutputs(o);
      setIntegs(ig);
      setTasks(t);
      setFinances(f);
      setLeads(ld);
      setLogs(lg);
      const mgmt = o.find(x => x.type === "management_report");
      const mktg = o.find(x => x.type === "marketing_report");
      if (mgmt) { try { setMgmtReport(JSON.parse(mgmt.content)); } catch {} }
      if (mktg) { try { setMktgReport(JSON.parse(mktg.content)); } catch {} }
      const mode = sj(b.autoMode, { management: "Manual", marketing: "Manual" });
      setAutoMode(mode);
      const cr = sj(b.autoCredentials, {});
      setCreds({
        emailUser:            cr.emailUser            || "",
        emailPass:            cr.emailPass            || "",
        smtpHost:             cr.smtpHost             || "smtp.gmail.com",
        smtpPort:             String(cr.smtpPort      || 587),
        fbPageId:             cr.fbPageId             || "",
        fbPageToken:          cr.fbPageToken          || "",
        igUserId:             cr.igUserId             || "",
        igToken:              cr.igToken              || "",
        igDefaultImage:       cr.igDefaultImage       || "",
        linkedInUrn:          cr.linkedInUrn          || "",
        linkedInToken:        cr.linkedInToken        || "",
        twitterApiKey:        cr.twitterApiKey        || "",
        twitterApiSecret:     cr.twitterApiSecret     || "",
        twitterToken:         cr.twitterToken         || "",
        twitterSecret:        cr.twitterSecret        || "",
        netlifyToken:         cr.netlifyToken         || "",
        netlifySiteId:        cr.netlifySiteId        || "",
        calendlyWebhookSecret:cr.calendlyWebhookSecret|| "",
      });
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [businessId]);

  const idea   = sj(business?.ideaData, {});
  const intake = sj(business?.intakeData, {});

  const totalRevenue  = finances.filter(f => f.type === "income").reduce((s, f) => s + f.amount, 0);
  const totalExpenses = finances.filter(f => f.type === "expense").reduce((s, f) => s + f.amount, 0);
  const netProfit     = totalRevenue - totalExpenses;
  const isFullAuto    = Object.values(autoMode).some(v => v === "Full auto");
  const clientCount   = leads.filter(l => l.status === "client").length;
  const emailedCount  = leads.filter(l => l.status === "emailed").length;

  // ── Actions ──────────────────────────────────────────────────────────────────
  const saveMode = async (newMode) => {
    setAutoMode(newMode);
    await api.automation.setMode(businessId, newMode).catch(() => {});
  };

  const cycleMode = async (agent) => {
    const cycle = ["Manual", "Guided", "Full auto"];
    const cur   = autoMode[agent] || "Manual";
    const next  = cycle[(cycle.indexOf(cur) + 1) % cycle.length];
    const nm    = { ...autoMode, [agent]: next };
    await saveMode(nm);
    if (next === "Full auto") {
      setAutoRunning(true);
      api.automation.run(businessId).finally(() => {
        setTimeout(() => api.automation.logs(businessId).then(r => setLogs(r.logs)).catch(() => {}).finally(() => setAutoRunning(false)), 3000);
      });
    }
  };

  const triggerRun = async () => {
    setAutoRunning(true);
    await api.automation.run(businessId).catch(() => {});
    setTimeout(() => {
      api.automation.logs(businessId).then(r => setLogs(r.logs)).catch(() => {});
      setAutoRunning(false);
    }, 5000);
  };

  const generateReport = async (type) => {
    setReportLoading(p => ({ ...p, [type]: true }));
    setError("");
    try {
      const { report } = await (type === "management" ? api.reports.management(businessId) : api.reports.marketing(businessId));
      if (type === "management") setMgmtReport(report);
      else setMktgReport(report);
    } catch (e) { setError(e.message); }
    finally { setReportLoading(p => ({ ...p, [type]: false })); }
  };

  const generateAsset = async (type, apiCall) => {
    setGenLoading(p => ({ ...p, [type]: true }));
    try {
      const { output } = await apiCall(businessId);
      setOutputs(p => { const e = p.find(o => o.type === type); return e ? p.map(o => o.type === type ? output : o) : [...p, output]; });
    } catch (e) { setError(e.message); }
    finally { setGenLoading(p => ({ ...p, [type]: false })); }
  };

  const generateLeads = async () => {
    setLeadsLoading(true);
    setError("");
    try {
      const { leads: nl } = await api.leads.generate(businessId);
      setLeads(p => [...nl, ...p]);
    } catch (e) { setError(e.message); }
    finally { setLeadsLoading(false); }
  };

  const updateLead = async (leadId, body) => {
    const { lead } = await api.leads.update(businessId, leadId, body);
    setLeads(p => p.map(l => l.id === leadId ? lead : l));
    return lead;
  };

  const deleteLead = async (leadId) => {
    await api.leads.delete(businessId, leadId).catch(() => {});
    setLeads(p => p.filter(l => l.id !== leadId));
  };

  const optimizeSEO = async () => {
    setSeoLoading(true); setError("");
    try {
      const { output } = await api.reports.seoOptimize(businessId);
      setOutputs(p => p.map(o => o.type === "website" ? output : o));
    } catch (e) { setError(e.message); }
    finally { setSeoLoading(false); }
  };

  const generatePost = async () => {
    setPostLoading(true); setError("");
    try {
      const { post } = await api.reports.socialPost(businessId, postPlatform, postType);
      setGeneratedPost(post);
    } catch (e) { setError(e.message); }
    finally { setPostLoading(false); }
  };

  const copy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(id); setTimeout(() => setCopied(null), 2000); }).catch(() => {});
  };

  const saveCreds = async () => {
    setSavingCreds(true);
    try { await api.automation.setCreds(businessId, creds); }
    catch (e) { setError(e.message); }
    finally { setSavingCreds(false); }
  };

  const addEntry = async () => {
    if (!newEntry.amount || !newEntry.date) return;
    setAddingEntry(true);
    try {
      const { entry } = await api.finances.add(businessId, { ...newEntry, amount: Number(newEntry.amount) });
      setFinances(p => [entry, ...p]);
      setNewEntry({ type: "income", category: "Sales", amount: "", description: "", date: TODAY });
      setShowEntry(false);
    } catch (e) { setError(e.message); }
    finally { setAddingEntry(false); }
  };

  const removeEntry = async (id) => {
    await api.finances.remove(businessId, id).catch(() => {});
    setFinances(p => p.filter(e => e.id !== id));
  };

  const sendChat = async (msg) => {
    setChatMsgs(p => [...p, { role: "user", text: msg }]);
    try {
      const { reply } = await api.generate.chat(msg, businessId);
      setChatMsgs(p => [...p, { role: "ai", text: reply }]);
    } catch { setChatMsgs(p => [...p, { role: "ai", text: "Sorry, couldn't process that right now." }]); }
  };

  const isConnected = (p) => integs.find(i => i.provider === p)?.status === "connected";
  const modeColor   = (m) => m === "Full auto" ? C.auto : m === "Guided" ? C.disc : C.muted;
  const modeBg      = (m) => m === "Full auto" ? C.autoBg : m === "Guided" ? C.discBg : C.bg;

  if (loading) return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: C.bg }}>
      <div style={{ textAlign: "center" }}>
        <Spinner size={32} color={C.disc} />
        <div style={{ marginTop: 12, fontSize: 13, color: C.muted }}>Loading your business hub...</div>
      </div>
    </div>
  );

  const nav = [
    { id: "command",       label: "Command Center" },
    { id: "leads",         label: "Leads & Clients" },
    { id: "management",    label: "Management"      },
    { id: "marketing",     label: "Marketing"       },
    { id: "settings",      label: "Settings"        },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: FB, background: C.bg }}>

      {/* ── SIDEBAR ─────────────────────────────────────────────────────────── */}
      <div style={{ width: 218, background: C.dark, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ padding: "22px 20px 16px", borderBottom: "1px solid #ffffff08" }}>
          <div style={{ fontFamily: FH, fontWeight: 400, fontSize: 18, color: "#fff", letterSpacing: "-0.3px" }}>LaunchLab</div>
          {user?.name && <div style={{ fontSize: 11, color: "#ffffff30", marginTop: 3 }}>{user.name}</div>}
        </div>

        <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #ffffff08" }}>
          <div style={{ fontWeight: 600, fontSize: 13, color: "#fff", marginBottom: 4, lineHeight: 1.3 }}>{business?.name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
            <Dot color={isFullAuto ? C.auto : C.muted} pulse={isFullAuto} />
            <span style={{ fontSize: 11, color: isFullAuto ? C.auto : "#ffffff40" }}>
              {isFullAuto ? "Running autonomously" : idea.name || business?.location}
            </span>
          </div>
          {mgmtReport && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 10, color: "#ffffff30" }}>Health</span>
              <span style={{ fontSize: 14, fontFamily: FH, color: mgmtReport.healthScore >= 7 ? C.ok : mgmtReport.healthScore >= 5 ? C.warn : C.err }}>{mgmtReport.healthScore}/10</span>
            </div>
          )}
          {clientCount > 0 && (
            <div style={{ marginTop: 6, fontSize: 11, color: C.ok }}>{clientCount} active client{clientCount > 1 ? "s" : ""}</div>
          )}
        </div>

        <nav style={{ padding: "10px 8px", flex: 1 }}>
          {nav.map(({ id, label: lbl }) => (
            <div key={id} onClick={() => setHubTab(id)} style={{ padding: "9px 12px", borderRadius: 8, marginBottom: 2, background: hubTab === id ? "#ffffff12" : "transparent", color: hubTab === id ? "#fff" : "#ffffff50", cursor: "pointer", fontSize: 13, fontWeight: hubTab === id ? 500 : 400, transition: "background 0.15s" }}>
              {lbl}
            </div>
          ))}
        </nav>

        <div style={{ padding: "10px 8px", borderTop: "1px solid #ffffff08" }}>
          <div onClick={() => navigate(`/creation/${businessId}`)} style={{ padding: "8px 12px", borderRadius: 7, color: "#ffffff35", cursor: "pointer", fontSize: 11 }}>Edit setup tasks</div>
          <div onClick={() => navigate("/dashboard")} style={{ padding: "8px 12px", borderRadius: 7, color: "#ffffff25", cursor: "pointer", fontSize: 11 }}>All businesses</div>
        </div>
      </div>

      {/* ── MAIN ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div style={{ padding: "36px 40px 120px", maxWidth: 980, margin: "0 auto" }}>
          <ErrorBox msg={error} onRetry={() => setError("")} />

          {/* ════════════════════════════════════════════════════════════════
              COMMAND CENTER
          ════════════════════════════════════════════════════════════════ */}
          {hubTab === "command" && (
            <div className="fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                <div>
                  <h1 style={{ fontFamily: FH, fontWeight: 700, fontSize: 34, color: C.text, letterSpacing: "-0.5px", marginBottom: 6 }}>{business?.name}</h1>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Dot color={isFullAuto ? C.auto : C.muted} pulse={isFullAuto} />
                    <span style={{ fontSize: 13, color: C.muted }}>{isFullAuto ? "Autonomous mode active — agents are running your business" : `${idea.name} · ${business?.location}`}</span>
                  </div>
                </div>
                {isFullAuto && (
                  <button onClick={triggerRun} disabled={autoRunning} style={{ ...btn(C.auto, "#fff", 13), display: "flex", alignItems: "center", gap: 8 }}>
                    {autoRunning ? <><Spinner size={14} color="#fff" /> Running cycle...</> : "Run now"}
                  </button>
                )}
              </div>

              {/* Auto mode CTA if not running */}
              {!isFullAuto && (
                <div style={{ ...cardMd("24px 28px"), background: "linear-gradient(135deg, #1a1035 0%, #0d0e12 100%)", marginBottom: 28, position: "relative", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, right: 0, width: 300, height: 300, borderRadius: "50%", background: C.auto + "08", transform: "translate(100px, -150px)" }} />
                  <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 24, color: "#fff", marginBottom: 10, letterSpacing: "-0.3px" }}>Enable Full Auto Mode</div>
                  <p style={{ fontSize: 13, color: "#ffffff60", lineHeight: 1.7, marginBottom: 20, maxWidth: 500 }}>
                    Turn on Full Auto for Management or Marketing agents and they will run your business — generating leads, sending cold emails, producing client deliverables, and filing daily reports — all without you lifting a finger.
                  </p>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => cycleMode("management")} style={btn(C.mgmt, "#fff", 13)}>Auto: Management</button>
                    <button onClick={() => cycleMode("marketing")}  style={btn(C.mktg, "#fff", 13)}>Auto: Marketing</button>
                    <button onClick={() => setHubTab("settings")}   style={{ ...btnO("#ffffff60", 13) }}>Configure email first</button>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 }}>
                <Stat label="Revenue" value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub={`${finances.filter(f => f.type === "income").length} entries`} accent={C.ok} onClick={() => setHubTab("management")} />
                <Stat label="Expenses" value={`$${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub={`${finances.filter(f => f.type === "expense").length} entries`} accent={C.err} onClick={() => setHubTab("management")} />
                <Stat label="Net Profit" value={`$${Math.abs(netProfit).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} sub={netProfit >= 0 ? "profitable" : "net loss"} accent={netProfit >= 0 ? C.ok : C.err} />
                <Stat label="Lead Pipeline" value={leads.length} sub={`${clientCount} clients · ${emailedCount} contacted`} accent={C.disc} onClick={() => setHubTab("leads")} />
              </div>

              {/* Agent status cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
                {[
                  { key: "management", label: "Management Agent", color: C.mgmt, bg: C.mgmtBg, report: mgmtReport, score: mgmtReport?.healthScore, scoreLbl: "Health Score" },
                  { key: "marketing",  label: "Marketing Agent",  color: C.mktg, bg: C.mktgBg, report: mktgReport, score: mktgReport?.growthScore,  scoreLbl: "Growth Score"  },
                ].map(({ key, label: lbl, color, bg, report, score, scoreLbl }) => (
                  <div key={key} onClick={() => setHubTab(key)} style={{ ...card("20px 22px"), cursor: "pointer", borderLeft: `3px solid ${color}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div>
                        <div style={{ fontSize: 11, color, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>{lbl}</div>
                        <span style={badge(modeColor(autoMode[key]), modeBg(autoMode[key]), 9)}>{autoMode[key] || "Manual"}</span>
                      </div>
                      {score != null && <Ring score={score} color={score >= 7 ? C.ok : score >= 5 ? C.warn : C.err} />}
                    </div>
                    {report ? (
                      <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6, margin: 0 }}>{report.headline}</p>
                    ) : (
                      <p style={{ fontSize: 13, color: C.muted, margin: 0 }}>No report yet — click to generate</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Automation log */}
              {logs.length > 0 && (
                <div style={card()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 18, letterSpacing: "-0.3px" }}>Agent Activity</div>
                    <button onClick={() => api.automation.clearLogs(businessId).then(() => setLogs([]))} style={{ ...btnO(C.muted, 11), padding: "4px 10px" }}>Clear log</button>
                  </div>
                  <div>
                    {logs.slice(0, 12).map((lg, i) => <LogEntry key={i} log={lg} />)}
                  </div>
                  {logs.length > 12 && <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>+{logs.length - 12} older entries</div>}
                </div>
              )}

              {logs.length === 0 && isFullAuto && (
                <div style={{ ...card("24px"), textAlign: "center", color: C.muted }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Agents are warming up</div>
                  <div style={{ fontSize: 13 }}>First automation cycle will run in ~30 seconds after server start. Activity will appear here.</div>
                </div>
              )}

              {/* Platform connections */}
              <div style={{ ...card("16px 20px"), marginTop: 20 }}>
                <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Connected Platforms</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[
                    { key: "stripe",    label: "Stripe",     source: "integration" },
                    { key: "google",    label: "Google",     source: "integration" },
                    { key: "facebook",  label: "Facebook",   source: "creds", check: () => !!creds.fbPageId },
                    { key: "instagram", label: "Instagram",  source: "creds", check: () => !!creds.igUserId },
                    { key: "linkedin",  label: "LinkedIn",   source: "creds", check: () => !!creds.linkedInUrn },
                    { key: "twitter",   label: "X / Twitter",source: "creds", check: () => !!creds.twitterApiKey },
                    { key: "netlify",   label: "Netlify",    source: "creds", check: () => !!creds.netlifyToken },
                    { key: "calendly",  label: "Calendly",   source: "creds", check: () => !!creds.calendlyWebhookSecret },
                  ].map(({ key, label: lbl, source, check }) => {
                    const connected = source === "integration" ? isConnected(key) : (check ? check() : false);
                    return (
                      <div key={key} onClick={() => !connected && setHubTab("settings")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 20, background: connected ? C.okBg : C.bg, border: `1px solid ${connected ? C.ok + "30" : C.border}`, cursor: connected ? "default" : "pointer" }}>
                        <Dot color={connected ? C.ok : C.subtle} />
                        <span style={{ fontSize: 12, fontWeight: 500, color: connected ? C.ok : C.muted }}>{lbl}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              LEADS & CLIENTS
          ════════════════════════════════════════════════════════════════ */}
          {hubTab === "leads" && (
            <div className="fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                <div>
                  <h1 style={{ fontFamily: FH, fontWeight: 700, fontSize: 34, color: C.text, letterSpacing: "-0.5px", marginBottom: 6 }}>Leads & Clients</h1>
                  <p style={{ fontSize: 13, color: C.muted }}>AI-generated prospects and paying clients — auto-contacted in Full Auto mode</p>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={generateLeads} disabled={leadsLoading} style={{ ...btn(C.disc, "#fff", 13), display: "flex", alignItems: "center", gap: 8 }}>
                    {leadsLoading ? <><Spinner size={13} color="#fff" /> Generating...</> : "Generate leads"}
                  </button>
                </div>
              </div>

              {/* Pipeline stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 28 }}>
                {LEAD_STATUSES.map(s => {
                  const count = leads.filter(l => l.status === s).length;
                  const color = { new: C.muted, emailed: C.disc, responded: C.warn, client: C.ok, declined: C.err }[s];
                  return (
                    <div key={s} style={{ ...card("12px 16px"), textAlign: "center" }}>
                      <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 28, color, letterSpacing: "-0.5px" }}>{count}</div>
                      <div style={{ fontSize: 10, color: C.muted, textTransform: "capitalize", fontWeight: 600, marginTop: 2 }}>{s}</div>
                    </div>
                  );
                })}
              </div>

              {leads.length === 0 ? (
                <div style={{ ...card("40px"), textAlign: "center" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🎯</div>
                  <div style={{ fontFamily: FH, fontSize: 20, marginBottom: 8 }}>No leads yet</div>
                  <p style={{ fontSize: 13, color: C.muted, marginBottom: 20, maxWidth: 400, margin: "0 auto 20px" }}>
                    Click "Generate leads" to have the AI find local businesses in {business?.location} that need your services. In Full Auto mode, this happens automatically.
                  </p>
                  <button onClick={generateLeads} disabled={leadsLoading} style={btn(C.disc)}>
                    {leadsLoading ? "Generating..." : "Generate my first leads"}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {/* Group by status */}
                  {LEAD_STATUSES.filter(s => leads.some(l => l.status === s)).map(status => (
                    <div key={status}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, marginTop: 8 }}>
                        <Dot color={{ new: C.muted, emailed: C.disc, responded: C.warn, client: C.ok, declined: C.err }[status]} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.5px" }}>{status} ({leads.filter(l => l.status === status).length})</span>
                      </div>
                      {leads.filter(l => l.status === status).map(lead => (
                        <div key={lead.id} style={{ marginBottom: 8 }}>
                          <LeadCard lead={lead} onUpdate={updateLead} onDelete={deleteLead} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              MANAGEMENT AGENT
          ════════════════════════════════════════════════════════════════ */}
          {hubTab === "management" && (
            <div className="fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                <div>
                  <h1 style={{ fontFamily: FH, fontWeight: 700, fontSize: 34, color: C.text, letterSpacing: "-0.5px", marginBottom: 6 }}>Management Agent</h1>
                  <p style={{ fontSize: 13, color: C.muted }}>AI CFO — P&L tracking, health scores, operational insights</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={badge(modeColor(autoMode.management), modeBg(autoMode.management), 10)}>{autoMode.management || "Manual"}</span>
                  <button onClick={() => cycleMode("management")} style={{ ...btnO(C.muted, 11), padding: "5px 10px" }}>Change mode</button>
                  <button onClick={() => generateReport("management")} disabled={!!reportLoading.management} style={{ ...btn(C.mgmt, "#fff", 13), display: "flex", alignItems: "center", gap: 8 }}>
                    {reportLoading.management ? <><Spinner size={13} color="#fff" /> Generating...</> : "Generate report"}
                  </button>
                </div>
              </div>

              {mgmtReport ? (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                    <Ring score={mgmtReport.healthScore} color={mgmtReport.healthScore >= 7 ? C.ok : mgmtReport.healthScore >= 5 ? C.warn : C.err} />
                    <div style={{ flex: 1, ...card("16px 20px") }}>
                      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Business Health — Today's Headline</div>
                      <p style={{ fontSize: 15, fontWeight: 500, color: C.text, margin: 0, lineHeight: 1.55 }}>{mgmtReport.headline}</p>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                    {(mgmtReport.metrics || []).map((m, i) => (
                      <div key={i} style={card("14px 18px")}>
                        <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 6 }}>{m.label}</div>
                        <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 22, color: C.text, marginBottom: 4, letterSpacing: "-0.3px" }}>{m.value}</div>
                        <div style={{ fontSize: 11, color: m.trend === "up" ? C.ok : m.trend === "down" ? C.err : C.muted }}>{m.trend === "up" ? "▲" : m.trend === "down" ? "▼" : "→"} {m.note}</div>
                      </div>
                    ))}
                  </div>

                  {mgmtReport.financialSummary && (
                    <div style={{ ...card("16px 20px"), background: C.mgmtBg, boxShadow: `0 0 0 1px ${C.mgmt}15`, marginBottom: 20 }}>
                      <div style={{ fontSize: 10, color: C.mgmt, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Financial Analysis</div>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, margin: 0 }}>{mgmtReport.financialSummary}</p>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    {mgmtReport.insights?.length > 0 && (
                      <div style={card()}>
                        <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Insights</div>
                        {mgmtReport.insights.map((ins, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                            <Dot color={ins.priority === "high" ? C.err : ins.priority === "medium" ? C.warn : C.muted} />
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{ins.title}</div>
                              <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.55 }}>{ins.body}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {mgmtReport.actions?.length > 0 && (
                      <div style={card()}>
                        <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Action Items</div>
                        {mgmtReport.actions.map((act, i) => (
                          <div key={i} style={{ padding: "10px 13px", borderRadius: 8, background: act.priority === "urgent" ? C.errBg : C.bg, marginBottom: 8 }}>
                            <div style={{ fontSize: 11, fontWeight: 600, color: act.priority === "urgent" ? C.err : act.priority === "normal" ? C.disc : C.muted, textTransform: "uppercase", letterSpacing: "0.3px", marginBottom: 4 }}>{act.priority}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{act.title}</div>
                            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{act.description}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ ...card("32px"), textAlign: "center", marginBottom: 32 }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📊</div>
                  <div style={{ fontFamily: FH, fontSize: 20, marginBottom: 8 }}>No report generated yet</div>
                  <p style={{ fontSize: 13, color: C.muted }}>Click "Generate report" to get your health score, insights, and action items.</p>
                </div>
              )}

              {/* Business Assets */}
              {outputs.filter(o => ["website","business_plan","social_content","email_templates"].includes(o.type)).length > 0 && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28, marginBottom: 28 }}>
                  <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 20, marginBottom: 16, letterSpacing: "-0.3px" }}>Business Assets Under Management</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {[["website","Website","W",C.crea],["business_plan","Business Plan","B",C.disc],["social_content","Social Calendar","S",C.mktg],["email_templates","Email Templates","E",C.mgmt]].map(([type, lbl, icon, color]) => {
                      const out = getOutput(type);
                      if (!out) return null;
                      const kb = (new Blob([out.content]).size / 1024).toFixed(1);
                      return (
                        <div key={type} style={{ ...card("14px 18px"), display: "flex", gap: 14, alignItems: "center" }}>
                          <div style={{ width: 38, height: 38, borderRadius: 9, background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, color, flexShrink: 0 }}>{icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{lbl}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>Updated {new Date(out.updatedAt || out.createdAt).toLocaleDateString()} · {kb} KB</div>
                          </div>
                          <span style={badge(C.ok, C.okBg, 9)}>active</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Financial Tracker */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 20, letterSpacing: "-0.3px" }}>Financial Tracker</div>
                    <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>Log income and expenses to power your management reports</div>
                  </div>
                  <button onClick={() => setShowEntry(p => !p)} style={btn(C.mgmt, "#fff", 13)}>{showEntry ? "Cancel" : "+ Add entry"}</button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                  <Stat label="Revenue" value={`$${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub={`${finances.filter(f => f.type === "income").length} entries`} accent={C.ok} />
                  <Stat label="Expenses" value={`$${totalExpenses.toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub={`${finances.filter(f => f.type === "expense").length} entries`} accent={C.err} />
                  <Stat label="Net P&L" value={`${netProfit >= 0 ? "+" : "−"}$${Math.abs(netProfit).toLocaleString("en-US", { minimumFractionDigits: 2 })}`} sub={netProfit >= 0 ? "profitable" : "net loss"} accent={netProfit >= 0 ? C.ok : C.err} />
                </div>

                {showEntry && (
                  <div style={{ ...card("18px 22px"), marginBottom: 20, boxShadow: `0 0 0 2px ${C.mgmt}20` }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 2fr 1fr", gap: 10, alignItems: "end" }}>
                      {[["Type", <select value={newEntry.type} onChange={e => setNewEntry(p => ({ ...p, type: e.target.value, category: e.target.value === "income" ? "Sales" : "Marketing" }))} style={{ ...inp(), padding: "9px 12px" }}><option value="income">Income</option><option value="expense">Expense</option></select>],
                        ["Category", <select value={newEntry.category} onChange={e => setNewEntry(p => ({ ...p, category: e.target.value }))} style={{ ...inp(), padding: "9px 12px" }}>{(newEntry.type === "income" ? INCOME_CATS : EXPENSE_CATS).map(c => <option key={c}>{c}</option>)}</select>],
                        ["Amount ($)", <input type="number" min="0" step="0.01" value={newEntry.amount} onChange={e => setNewEntry(p => ({ ...p, amount: e.target.value }))} placeholder="0.00" style={{ ...inp(), padding: "9px 12px" }} />],
                        ["Description", <input value={newEntry.description} onChange={e => setNewEntry(p => ({ ...p, description: e.target.value }))} placeholder="Description..." style={{ ...inp(), padding: "9px 12px" }} />],
                        ["Date", <input type="date" value={newEntry.date} onChange={e => setNewEntry(p => ({ ...p, date: e.target.value }))} style={{ ...inp(), padding: "9px 12px" }} />],
                      ].map(([lbl, el]) => (
                        <div key={lbl}><div style={label}>{lbl}</div>{el}</div>
                      ))}
                    </div>
                    <button onClick={addEntry} disabled={addingEntry || !newEntry.amount} style={{ ...btn(C.mgmt, "#fff", 13), marginTop: 14 }}>{addingEntry ? "Saving..." : "Save entry"}</button>
                  </div>
                )}

                {finances.length === 0 ? (
                  <div style={{ ...card("24px"), textAlign: "center", color: C.muted }}>No transactions yet. Add your first entry above.</div>
                ) : (
                  <div style={{ ...card("0"), overflow: "hidden" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px 2fr 100px 32px", padding: "10px 20px", background: C.bg, gap: 0 }}>
                      {["Date", "Type", "Category", "Description", "Amount", ""].map(h => <div key={h} style={{ fontSize: 10, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</div>)}
                    </div>
                    {finances.map((f, i) => (
                      <div key={f.id} style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px 2fr 100px 32px", padding: "11px 20px", borderTop: `1px solid ${C.border}`, alignItems: "center" }}>
                        <span style={{ fontSize: 13, color: C.muted }}>{f.date}</span>
                        <span style={badge(f.type === "income" ? C.ok : C.err, f.type === "income" ? C.okBg : C.errBg, 9)}>{f.type}</span>
                        <span style={{ fontSize: 13, color: C.muted }}>{f.category}</span>
                        <span style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{f.description || "—"}</span>
                        <span style={{ fontFamily: FH, fontWeight: 400, fontSize: 15, color: f.type === "income" ? C.ok : C.err }}>{f.type === "income" ? "+" : "−"}${Number(f.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        <button onClick={() => removeEntry(f.id)} style={{ background: "none", border: "none", cursor: "pointer", color: C.subtle, fontSize: 14 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              MARKETING AGENT
          ════════════════════════════════════════════════════════════════ */}
          {hubTab === "marketing" && (
            <div className="fade-in">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
                <div>
                  <h1 style={{ fontFamily: FH, fontWeight: 700, fontSize: 34, color: C.text, letterSpacing: "-0.5px", marginBottom: 6 }}>Marketing Agent</h1>
                  <p style={{ fontSize: 13, color: C.muted }}>AI CMO — growth strategy, content calendar, SEO, social posting</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={badge(modeColor(autoMode.marketing), modeBg(autoMode.marketing), 10)}>{autoMode.marketing || "Manual"}</span>
                  <button onClick={() => cycleMode("marketing")} style={{ ...btnO(C.muted, 11), padding: "5px 10px" }}>Change mode</button>
                  <button onClick={() => generateReport("marketing")} disabled={!!reportLoading.marketing} style={{ ...btn(C.mktg, "#fff", 13), display: "flex", alignItems: "center", gap: 8 }}>
                    {reportLoading.marketing ? <><Spinner size={13} color="#fff" /> Generating...</> : "Generate report"}
                  </button>
                </div>
              </div>

              {mktgReport ? (
                <div style={{ marginBottom: 32 }}>
                  <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
                    <Ring score={mktgReport.growthScore} color={C.mktg} />
                    <div style={{ flex: 1, ...card("16px 20px") }}>
                      <div style={{ fontSize: 10, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Growth Score — Marketing Headline</div>
                      <p style={{ fontSize: 15, fontWeight: 500, color: C.text, margin: 0, lineHeight: 1.55 }}>{mktgReport.headline}</p>
                    </div>
                  </div>

                  {mktgReport.strategy && (
                    <div style={{ ...card("16px 20px"), background: C.mktgBg, boxShadow: `0 0 0 1px ${C.mktg}15`, marginBottom: 20 }}>
                      <div style={{ fontSize: 10, color: C.mktg, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8 }}>Overall Strategy</div>
                      <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7, margin: 0 }}>{mktgReport.strategy}</p>
                    </div>
                  )}

                  {mktgReport.channels?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Marketing Channels</div>
                      {mktgReport.channels.map((ch, i) => (
                        <div key={i} style={{ ...card("14px 18px"), borderLeft: `3px solid ${ch.priority === "high" ? C.err : ch.priority === "medium" ? C.warn : C.muted}`, marginBottom: 8 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{ch.name}</span>
                            <span style={badge(ch.priority === "high" ? C.err : ch.priority === "medium" ? C.warn : C.muted, C.bg, 9)}>{ch.priority}</span>
                            <span style={{ fontSize: 12, color: C.muted, marginLeft: "auto" }}>ROI: {ch.expectedROI}</span>
                          </div>
                          {ch.actions?.map((a, ai) => <div key={ai} style={{ fontSize: 12, color: C.text, marginLeft: 0, display: "flex", gap: 6, marginBottom: 3 }}><span style={{ color: C.mktg }}>→</span>{a}</div>)}
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                    {mktgReport.contentIdeas?.length > 0 && (
                      <div>
                        <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 18, marginBottom: 12 }}>Content Ideas</div>
                        {mktgReport.contentIdeas.map((ci, i) => (
                          <div key={i} style={{ ...card("13px 16px"), marginBottom: 8 }}>
                            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                              <span style={badge(C.disc, C.discBg, 9)}>{ci.platform}</span>
                              <span style={badge(C.muted, C.bg, 9)}>{ci.type}</span>
                            </div>
                            <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 4 }}>{ci.concept}</div>
                            <div style={{ fontSize: 11, color: C.mktg, fontWeight: 500 }}>CTA: {ci.callToAction}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {mktgReport.weeklyPlan?.length > 0 && (
                      <div>
                        <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 18, marginBottom: 12 }}>This Week</div>
                        <div style={{ ...card("0"), overflow: "hidden" }}>
                          {mktgReport.weeklyPlan.map((wp, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "80px 1fr 70px", gap: 10, padding: "11px 16px", borderBottom: i < mktgReport.weeklyPlan.length - 1 ? `1px solid ${C.border}` : "none" }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: C.mktg }}>{wp.day}</span>
                              <div>
                                <div style={{ fontSize: 13 }}>{wp.task}</div>
                                <div style={{ fontSize: 11, color: C.muted }}>{wp.platform}</div>
                              </div>
                              <span style={{ fontSize: 11, color: C.muted, textAlign: "right" }}>{wp.timeRequired}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ ...card("32px"), textAlign: "center", marginBottom: 32 }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>📣</div>
                  <div style={{ fontFamily: FH, fontSize: 20, marginBottom: 8 }}>No marketing report yet</div>
                  <p style={{ fontSize: 13, color: C.muted }}>Generate a report to get your growth score, channel playbook, content ideas, and weekly plan.</p>
                </div>
              )}

              {/* Website */}
              {(() => {
                const w = getOutput("website");
                if (!w) return (
                  <div style={{ ...card("16px 20px"), marginBottom: 20 }}>
                    <div style={{ fontFamily: FH, fontSize: 16, marginBottom: 6 }}>Business Website</div>
                    <p style={{ fontSize: 13, color: C.muted, margin: "0 0 12px" }}>No website generated yet. Go to Settings → Generated Assets to create one.</p>
                    <button onClick={() => setHubTab("settings")} style={btn(C.crea, "#fff", 12)}>Generate website</button>
                  </div>
                );
                return (
                  <div style={{ ...card("16px 20px"), marginBottom: 20, borderLeft: `3px solid ${C.crea}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontFamily: FH, fontSize: 16 }}>Business Website</div>
                        <div style={{ fontSize: 12, color: C.muted }}>Updated {new Date(w.updatedAt || w.createdAt).toLocaleDateString()}{w.title?.includes("SEO") ? " · SEO Optimized" : ""}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => { const b = new Blob([w.content], { type: "text/html" }); const u = URL.createObjectURL(b); window.open(u, "_blank"); setTimeout(() => URL.revokeObjectURL(u), 3000); }} style={{ ...btnO(C.crea, 12), padding: "6px 12px" }}>Preview</button>
                        <button onClick={optimizeSEO} disabled={seoLoading} style={{ ...btn(C.mktg, "#fff", 12), display: "flex", alignItems: "center", gap: 6 }}>{seoLoading ? <><Spinner size={11} color="#fff" /> Optimizing...</> : "Optimize SEO"}</button>
                        <DownloadBtn content={w.content} filename={`${business?.name?.replace(/\s+/g, "-").toLowerCase()}-website.html`} label="Download" mimeType="text/html" />
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.6 }}>The Marketing Agent optimizes meta tags, headings, schema.org markup, and keyword density — then saves the updated version for download and re-deploy.</div>
                  </div>
                );
              })()}

              {/* Social Post Generator */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 28 }}>
                <div style={{ fontFamily: FH, fontWeight: 700, fontSize: 20, marginBottom: 4 }}>Social Post Generator</div>
                <p style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Generate ready-to-post content for any platform, any post type — copy and paste directly</p>

                {(() => {
                  const sc = getOutput("social_content");
                  if (!sc) return <div style={{ ...card("16px 20px"), marginBottom: 20 }}><p style={{ fontSize: 13, color: C.muted, margin: 0 }}>Generate a social calendar in Settings to see your 30-day schedule here.</p></div>;
                  let cal; try { cal = JSON.parse(sc.content); } catch { return null; }
                  const posts = (cal.posts || []).slice(0, 6);
                  return (
                    <div style={{ marginBottom: 24 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.muted, textTransform: "uppercase", letterSpacing: "0.4px", marginBottom: 12 }}>30-Day Calendar Preview</div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        {posts.map((post, i) => (
                          <div key={i} style={card("13px 16px")}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 7 }}>
                              <span style={badge(C.disc, C.discBg, 9)}>{post.platform}</span>
                              <span style={badge(C.muted, C.bg, 9)}>Day {post.day}</span>
                              <button onClick={() => copy(`${post.caption}\n\n${(post.hashtags||[]).map(h => `#${h}`).join(" ")}`, `cal-${i}`)} style={{ marginLeft: "auto", ...btnSm(copied === `cal-${i}` ? C.ok : C.muted), fontSize: 10 }}>{copied === `cal-${i}` ? "Copied!" : "Copy"}</button>
                            </div>
                            <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 5 }}>{post.caption}</div>
                            <div style={{ fontSize: 10, color: C.disc }}>{(post.hashtags||[]).slice(0,4).map(h => `#${h}`).join(" ")}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div style={{ ...card("18px 22px"), boxShadow: `0 0 0 1px ${C.mktg}20` }}>
                  <div style={{ fontFamily: FH, fontSize: 16, marginBottom: 14 }}>Generate a Post Right Now</div>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                    <div><div style={label}>Platform</div><select value={postPlatform} onChange={e => setPostPlatform(e.target.value)} style={{ ...inp(), width: "auto", padding: "8px 12px" }}>{["Instagram","Facebook","LinkedIn","Google Business"].map(p => <option key={p}>{p}</option>)}</select></div>
                    <div><div style={label}>Post Type</div><select value={postType} onChange={e => setPostType(e.target.value)} style={{ ...inp(), width: "auto", padding: "8px 12px" }}>{["promotional","behind the scenes","service showcase","tip / advice","testimonial request","local connection","announcement"].map(t => <option key={t}>{t}</option>)}</select></div>
                    <button onClick={generatePost} disabled={postLoading} style={{ ...btn(C.mktg, "#fff", 13), display: "flex", alignItems: "center", gap: 8 }}>{postLoading ? <><Spinner size={12} color="#fff" /> Generating...</> : "Generate post"}</button>
                  </div>
                  {generatedPost && (
                    <div style={{ marginTop: 18, padding: "16px 18px", background: C.mktgBg, borderRadius: 10, boxShadow: `0 0 0 1px ${C.mktg}15` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", gap: 6 }}>
                          <span style={badge(C.disc, C.discBg, 9)}>{generatedPost.platform}</span>
                          <span style={badge(C.mktg, C.mktgBg, 9)}>{generatedPost.type}</span>
                        </div>
                        <button onClick={() => copy(`${generatedPost.caption}\n\n${(generatedPost.hashtags||[]).map(h => `#${h}`).join(" ")}`, "gen")} style={btn(copied === "gen" ? C.ok : C.disc, "#fff", 12)}>{copied === "gen" ? "Copied!" : "Copy post"}</button>
                      </div>
                      <div style={{ fontSize: 14, lineHeight: 1.65, marginBottom: 8, fontWeight: 500 }}>{generatedPost.caption}</div>
                      <div style={{ fontSize: 12, color: C.disc, marginBottom: 4 }}>{(generatedPost.hashtags||[]).map(h => `#${h}`).join(" ")}</div>
                      {generatedPost.bestTime && <div style={{ fontSize: 11, color: C.muted }}>Best time: {generatedPost.bestTime}</div>}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════
              SETTINGS
          ════════════════════════════════════════════════════════════════ */}
          {hubTab === "settings" && (
            <SettingsTab
              business={business} businessId={businessId}
              autoMode={autoMode} cycleMode={cycleMode}
              creds={creds} setCreds={setCreds} saveCreds={saveCreds} savingCreds={savingCreds}
              outputs={outputs} genLoading={genLoading} generateAsset={generateAsset} getOutput={getOutput}
              integs={integs} isConnected={isConnected}
              modeColor={modeColor} modeBg={modeBg}
              setError={setError} setLogs={setLogs} logs={logs}
            />
          )}
        </div>
      </div>

      {/* ── CHAT ────────────────────────────────────────────────────────────── */}
      {chatOpen && <GuidePanel messages={chatMsgs} onClose={() => setChatOpen(false)} onSend={sendChat} />}
      <button onClick={() => setChatOpen(o => !o)} style={{ ...btn(C.dark, "#fff", 13), position: "fixed", bottom: 24, right: chatOpen ? 356 : 24, borderRadius: 24, boxShadow: "0 4px 24px rgba(0,0,0,0.2)", zIndex: 100, transition: "right 0.25s ease" }}>
        {chatOpen ? "✕ Close" : "Ask AI guide"}
      </button>
    </div>
  );
}
