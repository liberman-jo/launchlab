"use strict";

// ── FACEBOOK PAGES ────────────────────────────────────────────────────────────
async function postToFacebook(pageId, pageToken, message) {
  const res = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, access_token: pageToken }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || `Facebook error: ${res.status}`);
  return data.id; // post id
}

// ── INSTAGRAM BUSINESS ────────────────────────────────────────────────────────
// Requires an image URL (Instagram doesn't support text-only via API).
// If no image is provided, we skip Instagram silently.
async function postToInstagram(igUserId, userToken, caption, imageUrl) {
  if (!imageUrl) throw new Error("Instagram requires an image URL — set a default image in Settings");

  // Step 1: Create media container
  const containerRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: userToken }),
  });
  const container = await containerRes.json();
  if (!containerRes.ok || container.error) throw new Error(container.error?.message || "Instagram container error");

  // Step 2: Publish
  const publishRes = await fetch(`https://graph.facebook.com/v19.0/${igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: container.id, access_token: userToken }),
  });
  const published = await publishRes.json();
  if (!publishRes.ok || published.error) throw new Error(published.error?.message || "Instagram publish error");
  return published.id;
}

// ── LINKEDIN ──────────────────────────────────────────────────────────────────
async function postToLinkedIn(personUrn, accessToken, text) {
  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: `urn:li:person:${personUrn}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `LinkedIn error: ${res.status}`);
  return data.id;
}

// ── TWITTER / X ───────────────────────────────────────────────────────────────
async function postToTwitter(bearerToken, apiKey, apiSecret, accessToken, accessSecret, text) {
  // Twitter v2 API using OAuth 1.0a
  // We use the simpler fetch approach with the Twitter v2 /tweets endpoint
  const oauth = buildOAuth1Header("POST", "https://api.twitter.com/2/tweets", {}, apiKey, apiSecret, accessToken, accessSecret);
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: oauth },
    body: JSON.stringify({ text: text.slice(0, 280) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || `Twitter error: ${res.status}`);
  return data.data?.id;
}

function buildOAuth1Header(method, url, params, consumerKey, consumerSecret, token, tokenSecret) {
  const nonce     = Math.random().toString(36).slice(2);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const base = {
    oauth_consumer_key:     consumerKey,
    oauth_nonce:            nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp:        timestamp,
    oauth_token:            token,
    oauth_version:          "1.0",
  };
  const sorted = Object.entries({ ...params, ...base }).sort(([a], [b]) => a.localeCompare(b));
  const paramStr = sorted.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const sigBase  = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(paramStr)}`;
  const sigKey   = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  let signature;
  try {
    const crypto = require("crypto");
    signature = crypto.createHmac("sha1", sigKey).update(sigBase).digest("base64");
  } catch { signature = ""; }

  const headerParts = { ...base, oauth_signature: signature };
  return "OAuth " + Object.entries(headerParts).map(([k, v]) => `${encodeURIComponent(k)}="${encodeURIComponent(v)}"`).join(", ");
}

// ── DISPATCH — post to all configured platforms ───────────────────────────────
async function dispatchPost(caption, hashtags, creds) {
  const fullText = hashtags?.length ? `${caption}\n\n${hashtags.map(h => `#${h}`).join(" ")}` : caption;
  const results  = [];

  if (creds.fbPageId && creds.fbPageToken) {
    try {
      const id = await postToFacebook(creds.fbPageId, creds.fbPageToken, fullText);
      results.push({ platform: "Facebook", id, ok: true });
    } catch (e) { results.push({ platform: "Facebook", ok: false, error: e.message }); }
  }

  if (creds.igUserId && creds.igToken) {
    try {
      const id = await postToInstagram(creds.igUserId, creds.igToken, fullText, creds.igDefaultImage || null);
      results.push({ platform: "Instagram", id, ok: true });
    } catch (e) { results.push({ platform: "Instagram", ok: false, error: e.message }); }
  }

  if (creds.linkedInUrn && creds.linkedInToken) {
    try {
      const id = await postToLinkedIn(creds.linkedInUrn, creds.linkedInToken, fullText);
      results.push({ platform: "LinkedIn", id, ok: true });
    } catch (e) { results.push({ platform: "LinkedIn", ok: false, error: e.message }); }
  }

  if (creds.twitterApiKey && creds.twitterApiSecret && creds.twitterToken && creds.twitterSecret) {
    try {
      const id = await postToTwitter(null, creds.twitterApiKey, creds.twitterApiSecret, creds.twitterToken, creds.twitterSecret, fullText);
      results.push({ platform: "Twitter", id, ok: true });
    } catch (e) { results.push({ platform: "Twitter", ok: false, error: e.message }); }
  }

  return results;
}

module.exports = { postToFacebook, postToInstagram, postToLinkedIn, postToTwitter, dispatchPost };
