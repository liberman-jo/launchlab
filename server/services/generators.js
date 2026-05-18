const { generateWebsite, generateBusinessPlan, generateSocialContent, generateEmailTemplates, generatePitchDeck } = require("./ai");

/**
 * Generates real output for an auto task based on its name and type.
 * Returns a { fields: [{label, value}] } object saved to task.outputData,
 * plus optionally websiteHtml for website tasks.
 */
async function generateTaskOutput(task, business, idea, intake) {
  const name = (task.name || "").toLowerCase();
  const biz  = business.name;
  const slug = biz.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const loc  = business.location;

  // ── WEBSITE ──────────────────────────────────────────────────────────────────
  if (/website|web page|landing page|online presence|digital presence|web site|online platform|online store|ecommerce site|build a site|create a site/i.test(name)) {
    const html = await generateWebsite(business, idea, intake);
    return {
      fields: [
        { label: "Status",         value: "Website generated and ready to deploy" },
        { label: "Recommended host",value: "Netlify (drag-and-drop the HTML file at netlify.com/drop)" },
        { label: "File",           value: slug + ".html" },
        { label: "Sections included", value: "Hero, Services, Pricing, Contact Form, Footer" },
        { label: "Mobile responsive", value: "Yes" },
      ],
      websiteHtml: html,
      downloadAvailable: true,
    };
  }

  // ── BUSINESS PLAN ─────────────────────────────────────────────────────────────
  if (/business plan|financial plan|strategic plan/i.test(name)) {
    const html = await generateBusinessPlan(business, idea, intake);
    return {
      fields: [
        { label: "Status",    value: "Full business plan generated" },
        { label: "Sections",  value: "Executive Summary, Market Analysis, Financials, 90-Day Plan" },
        { label: "Pages",     value: "~8-10 pages" },
        { label: "Format",    value: "HTML (printable)" },
      ],
      content: html,
      type: "business_plan",
      downloadAvailable: true,
    };
  }

  // ── SOCIAL CONTENT ────────────────────────────────────────────────────────────
  if (/social media|instagram|facebook|content calendar/i.test(name)) {
    const data = await generateSocialContent(business, idea, intake);
    return {
      fields: [
        { label: "Status",         value: "30-day content calendar generated" },
        { label: "Posts created",  value: String(data.posts?.length || 30) },
        { label: "Platforms",      value: "Instagram, Facebook" },
        { label: "Instagram bio",  value: data.bio?.instagram || "" },
        { label: "Google Business description", value: (data.bio?.google || "").slice(0, 80) + "..." },
      ],
      content: JSON.stringify(data, null, 2),
      type: "social_content",
      downloadAvailable: true,
    };
  }

  // ── EMAIL TEMPLATES ───────────────────────────────────────────────────────────
  if (/email|gmail|newsletter|customer communication/i.test(name)) {
    const data = await generateEmailTemplates(business, idea);
    return {
      fields: [
        { label: "Status",            value: "Email templates generated" },
        { label: "Templates created", value: String(data.templates?.length || 8) },
        { label: "Includes",          value: "Welcome, Booking Confirmation, Reminder, Follow-up, Referral, Newsletter, Reactivation, Promotion" },
      ],
      content: JSON.stringify(data, null, 2),
      type: "email_templates",
      downloadAvailable: true,
    };
  }

  // ── PITCH DECK ────────────────────────────────────────────────────────────────
  if (/pitch|deck|investor|presentation/i.test(name)) {
    const html = await generatePitchDeck(business, idea, intake);
    return {
      fields: [
        { label: "Status",  value: "10-slide pitch deck generated" },
        { label: "Slides",  value: "Cover, Problem, Solution, Market, Model, Pricing, GTM, Financials, Advantage, Ask" },
        { label: "Format",  value: "HTML (printable / shareable)" },
      ],
      content: html,
      type: "pitch_deck",
      downloadAvailable: true,
    };
  }

  // ── STRIPE / PAYMENTS ─────────────────────────────────────────────────────────
  if (/stripe|payment|invoic/i.test(name)) {
    return { fields: [
      { label: "Next step",      value: "Visit stripe.com/register to create your account" },
      { label: "Account type",   value: "Individual / Sole Proprietor" },
      { label: "Recommended",    value: "Enable payment links — no website integration needed to start" },
      { label: "Payout schedule",value: "Daily (after 7-day rolling period)" },
      { label: "Card fee",       value: "2.9% + 30¢ per transaction" },
      { label: "Setup URL",      value: "https://stripe.com/register" },
    ]};
  }

  // ── BOOKING / CALENDLY ────────────────────────────────────────────────────────
  if (/calendly|booking|schedul|appointment/i.test(name)) {
    return { fields: [
      { label: "Recommended tool",  value: "Calendly (free plan works to start)" },
      { label: "Setup URL",         value: "https://calendly.com/signup" },
      { label: "Suggested URL slug",value: "calendly.com/" + slug },
      { label: "Event type",        value: "One-on-one appointment, 60 minutes" },
      { label: "Buffer time",       value: "15 minutes between appointments" },
      { label: "Payment",           value: "Enable Stripe payment collection in Calendly settings" },
    ]};
  }

  // ── GOOGLE BUSINESS ───────────────────────────────────────────────────────────
  if (/google|gmb|local listing|maps/i.test(name)) {
    return { fields: [
      { label: "Setup URL",       value: "https://business.google.com/create" },
      { label: "Business name",   value: biz },
      { label: "Category",        value: "Professional Services" },
      { label: "Service area",    value: loc },
      { label: "Verification",    value: "Google will mail a postcard to verify (5-7 days)" },
      { label: "Tip",             value: "Add at least 5 photos on day one to rank higher in local search" },
    ]};
  }

  // ── LLC / LEGAL ───────────────────────────────────────────────────────────────
  if (/llc|incorporat|register|legal entity|business entity/i.test(name)) {
    const state = loc.split(",").pop()?.trim() || "your state";
    return { fields: [
      { label: "Entity name",      value: biz + " LLC" },
      { label: "State",            value: state },
      { label: "Setup URL",        value: "https://www.zenbusiness.com/llc" },
      { label: "Estimated cost",   value: "$0-$50 state fee (ZenBusiness free plan covers the rest)" },
      { label: "Timeline",         value: "3-7 business days" },
      { label: "You will need",    value: "A registered agent address (ZenBusiness provides this)" },
      { label: "After filing",     value: "Apply for EIN at irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online" },
    ]};
  }

  // ── BANK ACCOUNT ─────────────────────────────────────────────────────────────
  if (/bank|checking|business account|financial account/i.test(name)) {
    return { fields: [
      { label: "Recommended",     value: "Mercury Bank (free, online, startup-friendly)" },
      { label: "Setup URL",       value: "https://mercury.com" },
      { label: "Required",        value: "EIN (from LLC filing) + SSN + ID" },
      { label: "Debit card",      value: "Issued immediately (virtual) + physical in 5-7 days" },
      { label: "Fees",            value: "None — no monthly fees, no minimums" },
      { label: "Alternative",     value: "Chase Business Complete Banking if you prefer in-person banking" },
    ]};
  }

  // ── INSURANCE ─────────────────────────────────────────────────────────────────
  if (/insurance|liability/i.test(name)) {
    return { fields: [
      { label: "Recommended provider", value: "Next Insurance (next.co) — instant online quotes" },
      { label: "Setup URL",            value: "https://www.next.co" },
      { label: "Coverage needed",      value: "General Liability + Professional Liability" },
      { label: "Typical cost",         value: "$25-$75/month depending on coverage level" },
      { label: "Certificate",          value: "Issued instantly as PDF — share with clients on request" },
    ]};
  }

  // ── DOMAIN / WEBSITE HOSTING ──────────────────────────────────────────────────
  if (/domain|hosting|url|dns/i.test(name)) {
    return { fields: [
      { label: "Suggested domain", value: slug + ".com" },
      { label: "Register at",      value: "https://namecheap.com (typically $8-12/year)" },
      { label: "Hosting",          value: "Deploy on Netlify for free — drag and drop your HTML file" },
      { label: "DNS setup",        value: "Point domain to Netlify after deploying — takes 24-48 hours to propagate" },
      { label: "SSL",              value: "Netlify provides free SSL automatically" },
    ]};
  }

  // ── DEFAULT ───────────────────────────────────────────────────────────────────
  return { fields: [
    { label: "Task",   value: task.name },
    { label: "Status", value: "Completed — review steps and mark done" },
    { label: "Notes",  value: "Use the guided steps above for instructions on completing this task" },
  ]};
}

module.exports = { generateTaskOutput };
