const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = "claude-sonnet-4-6";

// Robust JSON parse with multi-pass repair
function parseJSON(text) {
  // Strip markdown fences
  text = text.replace(/^```(?:json)?\s*/im, "").replace(/\s*```\s*$/m, "").trim();

  // Find first JSON opener
  const fi = Math.min(
    text.indexOf("{") === -1 ? Infinity : text.indexOf("{"),
    text.indexOf("[") === -1 ? Infinity : text.indexOf("[")
  );
  if (fi === Infinity) throw new Error("No JSON found in AI response");

  let s = text.slice(fi);
  const isArray = s[0] === "[";

  const clean = (str) => str.replace(/,\s*([}\]])/g, "$1");

  // Pass 1: direct
  try { return JSON.parse(s); } catch {}

  // Pass 2: remove trailing commas
  try { return JSON.parse(clean(s)); } catch {}

  // Pass 3: walk to find balanced end, ignoring escape sequences
  let depth = 0, inStr = false, esc = false, endIdx = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (esc)        { esc = false; continue; }
    if (c === "\\") { esc = true;  continue; }
    if (c === '"')  { inStr = !inStr; continue; }
    if (inStr)      continue;
    if (c === "{" || c === "[") depth++;
    if (c === "}" || c === "]") { if (--depth === 0) { endIdx = i; break; } }
  }
  if (endIdx > 0) {
    try { return JSON.parse(clean(s.slice(0, endIdx + 1))); } catch {}
  }

  // Pass 4: truncate at last complete object boundary
  for (const tail of ["}\n  }", "},\n  {", "},\n{", "    }\n  ]", "}\n]"]) {
    const idx = s.lastIndexOf(tail);
    if (idx > 0) {
      const cut = s.slice(0, idx + 1) + (isArray ? "\n]" : "\n}");
      try { return JSON.parse(clean(cut)); } catch {}
    }
  }

  // Pass 5: last-resort — find last `}` and close the structure
  const lastBrace = s.lastIndexOf("}");
  if (lastBrace > 0) {
    const cut = s.slice(0, lastBrace + 1) + (isArray ? "]" : "");
    try { return JSON.parse(clean(cut)); } catch {}
  }

  throw new Error("Could not parse AI response — try again");
}

async function chat(prompt, maxTokens = 3000) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });
  return msg.content.find(b => b.type === "text")?.text || "";
}

// ── IDEA GENERATION ────────────────────────────────────────────────────────────
async function generateIdeas(intake) {
  const text = await chat(`
Generate exactly 5 tailored business ideas as a JSON array for someone with this profile:

Location: ${intake.location}
Hours per week: ${intake.hours}
Budget: $${Number(intake.budget).toLocaleString()}
Skills: ${intake.skills?.join(", ") || "none listed"}
Assets: ${intake.assets?.join(", ") || "none listed"}
Risk tolerance: ${intake.risk || "medium"}
Income goal: ${intake.incomeGoal || "not specified"}
${intake.ownIdea ? "Own idea to analyze as #1: " + intake.ownIdea : ""}

RULES:
- Reference the person's actual location, skills, and assets in each idea
- Budget and hours must be feasible
- Do NOT use double-quote characters inside string values
- Return ONLY a JSON array, no other text

Each object must have exactly these fields:
[{"name":"Business Name","tagline":"Tagline under 12 words","why":"2 sentences referencing their specific skills and location","revenue":"$X,XXX-$X,XXX/mo","timeToFirstRevenue":"X-Y weeks","startupCost":"$X-$X,XXX","biggestRisk":"One concrete sentence","scores":{"Fit":8.5,"Market":7.0,"Capital":9.0,"Time":8.0,"Risk":7.5,"Upside":8.0}}]
`, 3000);
  return parseJSON(text);
}

// ── TASK GENERATION ────────────────────────────────────────────────────────────
async function generateTasks(idea, intake) {
  const text = await chat(`
Generate a setup checklist for launching "${idea.name}" in ${intake.location} with a $${Number(intake.budget).toLocaleString()} budget.

Return ONLY a JSON array. No markdown. No explanation.
Do NOT use double-quote characters inside string values.

Each task:
{"name":"Task name","category":"Legal|Financial|Digital|Operations|Marketing","description":"What this involves for this specific business","estimatedTime":"X hours","estimatedCost":"$X or Free","canAutomate":true,"steps":[{"text":"Step description","url":"https://exact-url.com or null"}]}

Generate 8-12 tasks in logical order. canAutomate is true for digital setup tasks (website, email, social profiles, payment setup, scheduling).
For each guided step include the most direct URL — government portals, official signup pages, etc.
Be specific to ${idea.name} in ${intake.location}.
`, 2500);
  return parseJSON(text);
}

// ── WEBSITE GENERATION ─────────────────────────────────────────────────────────
async function generateWebsite(business, idea, intake) {
  const text = await chat(`Create a complete single-page business website. Output ONLY raw HTML — no explanation, no markdown fences, no commentary. Start with <!DOCTYPE html> and end with </html>.

Business: ${business.name}
Tagline: ${business.tagline || idea.tagline || ""}
Type: ${idea.name || "business"}
Location: ${business.location}
Revenue range: ${idea.revenue || "custom pricing"}

Structure (in this order):
1. <head> with title, meta description (SEO), viewport, Google Fonts (Inter), and <style> block
2. Nav: logo (business name) + "Book Now" CTA link
3. Hero: large headline, subheadline (tagline), two CTA buttons
4. Services: 3-card grid with service names and one-line descriptions
5. How it Works: 3-step numbered process
6. Pricing: 2-3 tiers with price ranges based on ${idea.revenue || "custom"}
7. Testimonials: 3 placeholder quote cards
8. Contact: simple form (name, email, message, submit) + show success message on submit via inline JS
9. Footer: business name, location, copyright

Design rules:
- Color scheme: professional, modern (pick one accent color)
- CSS: all inline in <style>, mobile-responsive with media queries
- No external dependencies except Google Fonts
- Fast, clean, semantic HTML5
`, 8192);

  // Strip markdown fences wherever they appear (not just at start/end)
  return text
    .replace(/^```html?\s*/im, "")
    .replace(/```\s*$/m, "")
    .replace(/^```\s*/im, "")
    .trim();
}

// ── SEO OPTIMIZE WEBSITE ───────────────────────────────────────────────────────
async function seoOptimizeWebsite(html, business, idea) {
  const text = await chat(`You are an SEO expert. Improve this website's HTML for search engine optimization.

Business: ${business.name} — ${idea.name || "small business"} in ${business.location}

Instructions:
- Improve the <title> tag (include business name + location + main service)
- Improve the <meta description> (150-160 chars, include location and service)
- Add/improve meta keywords
- Add Open Graph tags (og:title, og:description, og:type)
- Add schema.org LocalBusiness JSON-LD in a <script type="application/ld+json"> block
- Improve heading hierarchy (h1, h2, h3) with relevant keywords
- Add alt text suggestions as HTML comments where images would go
- Improve link text from generic ("click here") to descriptive
- Do NOT change visual design, layout, colors, or remove any content sections
- Return the complete improved HTML file, starting with <!DOCTYPE html>
- No markdown fences, no explanation — only the HTML

Current HTML:
${html.slice(0, 12000)}
`, 8192);

  return text
    .replace(/^```html?\s*/im, "")
    .replace(/```\s*$/m, "")
    .trim();
}

// ── SOCIAL POST GENERATION ────────────────────────────────────────────────────
async function generateSocialPost(business, idea, platform, postType) {
  const text = await chat(`Write a single social media post for ${platform} for this business.

Business: ${business.name}
Type: ${idea.name || "small business"}
Location: ${business.location}
Post type: ${postType || "promotional"}

Return ONLY a JSON object. No markdown, no explanation. Keep all strings under 200 chars.
{
  "platform": "${platform}",
  "type": "${postType || "promotional"}",
  "caption": "Full post caption ready to copy-paste. Engaging, on-brand, under 180 chars.",
  "hashtags": ["tag1","tag2","tag3","tag4","tag5"],
  "callToAction": "Short CTA under 50 chars",
  "bestTime": "Best time to post (e.g. Tuesday 7pm)"
}
`, 800);

  return parseJSON(text);
}

// ── BUSINESS PLAN GENERATION ───────────────────────────────────────────────────
async function generateBusinessPlan(business, idea, intake) {
  const text = await chat(`
Write a comprehensive business plan for the following business. Format as clean HTML with inline styles.

Business: ${business.name}
Type: ${idea.name}
Location: ${business.location}
Budget: $${business.budget.toLocaleString()}
Hours/week: ${business.hoursPerWeek}
Revenue target: ${idea.revenue}
Startup cost: ${idea.startupCost}
Time to first revenue: ${idea.timeToFirstRevenue}
Skills: ${intake.skills?.join(", ") || "general"}
Assets: ${intake.assets?.join(", ") || "none"}
Income goal: ${intake.incomeGoal || "supplemental income"}

Sections to include:
1. Executive Summary
2. Business Description & Mission
3. Market Analysis (local demand in ${business.location})
4. Products & Services
5. Pricing Strategy
6. Marketing & Customer Acquisition Plan
7. Operations Plan
8. Financial Projections (Month 1-12 revenue ramp)
9. Startup Costs Breakdown
10. Risk Assessment & Mitigation
11. 90-Day Action Plan

Make it specific, data-informed, and actionable. Use the provided numbers throughout.
Format as professional HTML document with clean typography.
`, 6000);
  return text.replace(/^```html?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

// ── SOCIAL CONTENT GENERATION ─────────────────────────────────────────────────
async function generateSocialContent(business, idea, intake) {
  const text = await chat(`
Create a 30-day social media content calendar for "${business.name}" (${idea.name} in ${business.location}).

Return as JSON with this structure:
{"posts":[{"day":1,"platform":"Instagram","type":"Launch announcement","caption":"Full caption text here","hashtags":["tag1","tag2"]},...],"bio":{"instagram":"Instagram bio under 150 chars","facebook":"Facebook page description","google":"Google Business description under 750 chars"}}

Generate 30 posts alternating Instagram and Facebook. Types should include: launch announcement, behind the scenes, service showcase, customer tip, promotional offer, testimonial request, local connection, FAQ answer.
Keep captions engaging and professional. Hashtags relevant to ${business.location} and the business type.
No double-quote characters inside string values.
`, 4000);
  return parseJSON(text);
}

// ── EMAIL TEMPLATES ────────────────────────────────────────────────────────────
async function generateEmailTemplates(business, idea) {
  const text = await chat(`
Create professional email templates for "${business.name}" (${idea.name}).

Return as JSON:
{"templates":[{"name":"Template name","subject":"Email subject","body":"Full email body in plain text with [PLACEHOLDER] variables"},...]}

Include these 8 templates:
1. New customer welcome email
2. Booking confirmation
3. Appointment reminder (24 hours before)
4. Post-service follow-up and review request
5. Referral program invitation
6. Monthly newsletter (first edition)
7. Reactivation email (customer hasn't booked in 60 days)
8. Special promotion/discount offer

Make them warm, professional, and specific to this business type. No double-quote characters inside string values.
`, 3000);
  return parseJSON(text);
}

// ── PITCH DECK OUTLINE ────────────────────────────────────────────────────────
async function generatePitchDeck(business, idea, intake) {
  const text = await chat(`
Create a pitch deck outline for "${business.name}" formatted as clean HTML with inline styles.

Business: ${business.name} — ${idea.name} in ${business.location}
Revenue target: ${idea.revenue}
Startup cost: ${idea.startupCost}

Create 10 slides:
1. Cover — business name, tagline, location
2. The Problem — what pain point this solves
3. The Solution — how this business solves it
4. Market Opportunity — size of the ${business.location} market
5. Business Model — how money is made
6. Pricing & Revenue — specific numbers
7. Go-to-Market Strategy — first 90 days
8. Financial Projections — 12-month chart (ASCII or CSS bar chart)
9. Competitive Advantage — why this business wins
10. Ask / Next Steps — what is needed to launch

Format each slide as a distinct styled section. Professional, investor-ready presentation style.
`, 4000);
  return text.replace(/^```html?\s*/i, "").replace(/\s*```\s*$/, "").trim();
}

// ── MANAGEMENT REPORT ─────────────────────────────────────────────────────────
async function generateManagementReport(business, idea, intake, financials, integrations) {
  const totalRevenue  = financials.filter(f => f.type === "income").reduce((s, f) => s + f.amount, 0);
  const totalExpenses = financials.filter(f => f.type === "expense").reduce((s, f) => s + f.amount, 0);
  const netProfit     = totalRevenue - totalExpenses;
  const margin        = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;
  const connected     = integrations.filter(i => i.status === "connected").map(i => i.provider);

  const text = await chat(`You are the Management Agent for LaunchLab — an AI CFO for a small business.

Business: ${business.name} | Type: ${idea.name || "small business"} | Location: ${business.location}
Revenue Target: ${idea.revenue || "not set"} | Budget: $${Number(business.budget).toLocaleString()} | Hours/wk: ${business.hoursPerWeek}
Financials: Revenue $${totalRevenue.toFixed(2)}, Expenses $${totalExpenses.toFixed(2)}, Net $${netProfit.toFixed(2)}, Margin ${margin}%
Recent transactions: ${financials.slice(0, 8).map(f => `${f.date} ${f.type} ${f.category} $${f.amount}`).join(" | ") || "none yet"}
Connected: ${connected.join(", ") || "none"}

Return ONLY valid JSON, no markdown, no explanation. Keep all string values short (under 120 chars). Never use double-quote characters inside string values — use single quotes if quoting is needed.

{
  "healthScore": 7.5,
  "headline": "One sentence, under 100 chars",
  "metrics": [
    {"label":"Total Revenue","value":"$${totalRevenue.toFixed(2)}","trend":"up","note":"under 60 chars"},
    {"label":"Total Expenses","value":"$${totalExpenses.toFixed(2)}","trend":"flat","note":"under 60 chars"},
    {"label":"Net Profit","value":"$${netProfit.toFixed(2)}","trend":"up","note":"under 60 chars"},
    {"label":"Profit Margin","value":"${margin}%","trend":"up","note":"under 60 chars"},
    {"label":"Business Health","value":"X/10","trend":"up","note":"under 60 chars"}
  ],
  "insights": [
    {"priority":"high","title":"Short title","body":"2 sentences max, under 150 chars total"},
    {"priority":"medium","title":"Short title","body":"2 sentences max"},
    {"priority":"low","title":"Short title","body":"2 sentences max"}
  ],
  "actions": [
    {"priority":"urgent","title":"Short title","description":"One sentence action","impact":"One sentence outcome"},
    {"priority":"normal","title":"Short title","description":"One sentence action","impact":"One sentence outcome"},
    {"priority":"optional","title":"Short title","description":"One sentence action","impact":"One sentence outcome"}
  ],
  "financialSummary": "2 sentences max, under 200 chars, analyzing the financial position."
}
`, 2000);
  return parseJSON(text);
}

// ── MARKETING REPORT ──────────────────────────────────────────────────────────
async function generateMarketingReport(business, idea, intake, integrations, tasks) {
  const completedTasks = tasks.filter(t => t.status === "done").map(t => t.name);
  const connected      = integrations.filter(i => i.status === "connected").map(i => i.provider);

  const text = await chat(`You are the Marketing Agent for LaunchLab — an AI CMO for a small business.

Business: ${business.name} | Type: ${idea.name || "small business"} | Location: ${business.location}
Revenue target: ${idea.revenue || "not set"} | Budget: $${Number(business.budget).toLocaleString()}
Skills: ${intake.skills?.join(", ") || "general"} | Completed tasks: ${completedTasks.slice(0,5).join(", ") || "none"}
Connected: ${connected.join(", ") || "none"}

Return ONLY valid JSON, no markdown, no explanation. Keep all string values short (under 120 chars). Never use double-quote characters inside string values.

{
  "growthScore": 6.5,
  "headline": "One sentence, under 100 chars",
  "channels": [
    {"name":"Google Business Profile","priority":"high","effort":"low","expectedROI":"under 80 chars","status":"recommended","actions":["action 1 under 80 chars","action 2 under 80 chars"]},
    {"name":"Instagram","priority":"high","effort":"medium","expectedROI":"under 80 chars","status":"recommended","actions":["action 1","action 2"]},
    {"name":"Facebook","priority":"medium","effort":"low","expectedROI":"under 80 chars","status":"recommended","actions":["action 1","action 2"]},
    {"name":"Email Marketing","priority":"medium","effort":"low","expectedROI":"under 80 chars","status":"recommended","actions":["action 1","action 2"]}
  ],
  "contentIdeas": [
    {"platform":"Instagram","type":"Post type","concept":"Specific idea for this business under 100 chars","callToAction":"CTA under 50 chars"},
    {"platform":"Facebook","type":"Post type","concept":"Specific idea under 100 chars","callToAction":"CTA under 50 chars"},
    {"platform":"Email","type":"Email type","concept":"Specific idea under 100 chars","callToAction":"CTA under 50 chars"},
    {"platform":"Google","type":"Post type","concept":"Specific idea under 100 chars","callToAction":"CTA under 50 chars"},
    {"platform":"Instagram","type":"Post type","concept":"Specific idea under 100 chars","callToAction":"CTA under 50 chars"}
  ],
  "weeklyPlan": [
    {"day":"Monday","task":"Specific task under 80 chars","timeRequired":"20 minutes","platform":"Instagram"},
    {"day":"Tuesday","task":"Specific task under 80 chars","timeRequired":"15 minutes","platform":"Google"},
    {"day":"Wednesday","task":"Specific task under 80 chars","timeRequired":"30 minutes","platform":"Email"},
    {"day":"Thursday","task":"Specific task under 80 chars","timeRequired":"20 minutes","platform":"Facebook"},
    {"day":"Friday","task":"Specific task under 80 chars","timeRequired":"15 minutes","platform":"Instagram"},
    {"day":"Saturday","task":"Specific task under 80 chars","timeRequired":"10 minutes","platform":"Google"},
    {"day":"Sunday","task":"Specific task under 80 chars","timeRequired":"20 minutes","platform":"Email"}
  ],
  "strategy": "2-3 sentences max on overall approach for ${business.name} in ${business.location}."
}
`, 2000);
  return parseJSON(text);
}

// ── LEAD GENERATION ──────────────────────────────────────────────────────────
async function generateLeads(business, idea, intake, existingNames = []) {
  const exclude = existingNames.length ? `Do NOT include these already-found businesses: ${existingNames.slice(0,10).join(", ")}.` : "";
  const text = await chat(`You are a business development AI finding potential clients for a small business.

Seller: "${business.name}" — offers ${idea.name || "services"} in ${business.location}
Target: local businesses in ${business.location} that would benefit from ${idea.name || "these services"} but likely do not have them yet.
${exclude}

Generate 8 realistic potential client leads. Use real business types common to ${business.location}.

Return ONLY a JSON array, no markdown:
[{
  "name": "Local Business Name",
  "businessType": "e.g. restaurant, law firm, gym",
  "contactEmail": "typical@domain.com or null",
  "contactPhone": null,
  "location": "${business.location}",
  "estimatedSize": "small",
  "notes": "One sentence: why they need ${idea.name || "these services"}",
  "pitch": "One opening sentence for a cold email to this business"
}]

Be realistic — use plausible local business names and emails (firstname@businessname.com pattern).
`, 2000);
  return parseJSON(text);
}

// ── EMAIL COMPOSITION ────────────────────────────────────────────────────────
async function composeOutreachEmail(lead, business, idea) {
  const text = await chat(`Write a brief cold email from a small business to a potential client.

From: ${business.name} (${idea.name || "services"} — ${business.location})
To: ${lead.name} (${lead.businessType} in ${lead.location})
Why they need us: ${lead.notes}
Opening hook: ${lead.pitch}

Requirements:
- Under 100 words total
- Warm, genuine tone — NOT salesy or templated-sounding
- Mention ONE specific pain point for their business type
- One clear, low-pressure CTA (15-minute call or reply to email)
- Short subject line (under 8 words)
- Sign as the business owner (use "The ${business.name} team" if no name known)
- No double-quote characters inside string values

Return ONLY JSON: {"subject":"Subject line here","body":"Full email text here"}
`, 800);
  return parseJSON(text);
}

// ── CLIENT DELIVERABLE GENERATION ─────────────────────────────────────────────
async function generateClientDeliverables(lead, business, idea, intake) {
  const [website, social, emails] = await Promise.all([
    generateWebsite({ name: lead.name, tagline: "", location: lead.location || business.location, budget: 0, hoursPerWeek: 0 }, { name: lead.businessType, revenue: "custom", tagline: `${lead.businessType} services` }, {}),
    generateSocialContent({ name: lead.name, location: lead.location || business.location, budget: 0, hoursPerWeek: 0 }, { name: lead.businessType }, {}),
    generateEmailTemplates({ name: lead.name }, { name: lead.businessType }),
  ]);
  return { website, social: JSON.stringify(social, null, 2), emails: JSON.stringify(emails, null, 2) };
}

// ── CHAT RESPONSE ─────────────────────────────────────────────────────────────
async function chatResponse(message, businessContext) {
  const text = await chat(`
You are a helpful business advisor for LaunchLab. The user is setting up this business:
${JSON.stringify(businessContext, null, 2)}

User question: ${message}

Give a concise, practical answer (2-4 sentences max). Focus on actionable advice specific to their business.
`, 500);
  return text.trim();
}

module.exports = { generateIdeas, generateTasks, generateWebsite, generateBusinessPlan, generateSocialContent, generateEmailTemplates, generatePitchDeck, chatResponse, generateManagementReport, generateMarketingReport, seoOptimizeWebsite, generateSocialPost, generateLeads, composeOutreachEmail, generateClientDeliverables };
