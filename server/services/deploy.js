"use strict";

// ── NETLIFY DEPLOY ────────────────────────────────────────────────────────────
// Deploys a single HTML file to an existing Netlify site via the Deploy API.
async function deployToNetlify(siteId, personalToken, htmlContent, filename = "index.html") {
  // Use the "files" deploy endpoint — send a zip with our file
  // Simpler: use the raw file upload via the files API
  const crypto  = require("crypto");
  const sha1    = crypto.createHash("sha1").update(htmlContent).digest("hex");

  // Step 1: Create a deploy with the file digest
  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/deploys`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization:  `Bearer ${personalToken}`,
    },
    body: JSON.stringify({ files: { [`/${filename}`]: sha1 } }),
  });
  const deploy = await deployRes.json();
  if (!deployRes.ok) throw new Error(deploy.message || `Netlify deploy create error: ${deployRes.status}`);

  // Step 2: Upload the file (only if it appears in required array)
  if (deploy.required?.length > 0) {
    const uploadRes = await fetch(`https://api.netlify.com/api/v1/deploys/${deploy.id}/files/${filename}`, {
      method:  "PUT",
      headers: {
        "Content-Type": "application/octet-stream",
        Authorization:  `Bearer ${personalToken}`,
      },
      body: htmlContent,
    });
    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Netlify upload error: ${err}`);
    }
  }

  return {
    id:  deploy.id,
    url: deploy.deploy_ssl_url || deploy.ssl_url || deploy.url || `https://${siteId}.netlify.app`,
  };
}

// ── TEST NETLIFY CREDENTIALS ──────────────────────────────────────────────────
async function testNetlifyCredentials(siteId, personalToken) {
  const res = await fetch(`https://api.netlify.com/api/v1/sites/${siteId}`, {
    headers: { Authorization: `Bearer ${personalToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Invalid Netlify credentials");
  return { name: data.name, url: data.ssl_url || data.url };
}

module.exports = { deployToNetlify, testNetlifyCredentials };
