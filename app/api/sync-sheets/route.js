// app/api/sync-sheets/route.js
// Pulls data from your Google Sheet and upserts into Supabase.
// Called automatically every 30 min via Vercel Cron, and manually via the dashboard.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ─── Google Sheets fetch helper ──────────────────────────────────────────────
// Uses the Sheets API v4 with a service account key (stored as env var).
// Falls back to public CSV export if no API key (for sheets shared publicly).

async function fetchSheet(spreadsheetId, range) {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;

  // Option A: API key (recommended — works for sheets shared "Anyone with link can view")
  if (apiKey) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
    const data = await res.json();
    return data.values || [];
  }

  // Option B: Public CSV export (no API key needed, sheet must be published)
  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(range)}`;
  const res = await fetch(csvUrl);
  if (!res.ok) throw new Error(`CSV export error: ${res.status}`);
  const text = await res.text();
  return parseCSVToRows(text);
}

function parseCSVToRows(text) {
  return text.trim().split("\n").map(line => {
    const vals = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') inQ = !inQ;
      else if (ch === "," && !inQ) { vals.push(cur.trim().replace(/^"|"$/g, "")); cur = ""; }
      else cur += ch;
    }
    vals.push(cur.trim().replace(/^"|"$/g, ""));
    return vals;
  });
}

// ─── Row parsers — adapt column order to match YOUR Google Sheet ─────────────
// Default sheet structure (you can customise in the env vars):
//
// TRANSACTIONS sheet:   Date | Description | Category | Type | Amount | Account
// ACCOUNTS sheet:       Nickname | Institution | Type | Balance | Currency
// INVESTMENTS sheet:    Symbol | Name | Quantity | Price | Value | Account | Currency

function parseTransactions(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h?.toLowerCase().trim());
  const idx = (name) => headers.findIndex(h => h?.includes(name));

  const dateI   = idx("date");
  const descI   = idx("desc") > -1 ? idx("desc") : idx("note") > -1 ? idx("note") : idx("merchant");
  const catI    = idx("cat");
  const typeI   = idx("type");
  const amtI    = idx("amount") > -1 ? idx("amount") : idx("amt");
  const acctI   = idx("account");

  return rows.slice(1).map((row, i) => {
    const amount = parseFloat(String(row[amtI] || "0").replace(/[$,\s]/g, "")) || 0;
    const type   = String(row[typeI] || "").toLowerCase().includes("income") ? "income" : "expense";
    return {
      sheet_row_id: `row_${i}`,
      date:         row[dateI] || "",
      note:         row[descI] || "",
      category:     row[catI]  || "Other",
      type,
      amount:       Math.abs(amount),
      currency:     "CAD",
    };
  }).filter(r => r.date && r.amount > 0);
}

function parseAccounts(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => h?.toLowerCase().trim());
  const idx = (name) => headers.findIndex(h => h?.includes(name));

  const nickI   = idx("nick") > -1 ? idx("nick") : idx("name") > -1 ? idx("name") : 0;
  const instI   = idx("inst") > -1 ? idx("inst") : idx("bank");
  const typeI   = idx("type");
  const balI    = idx("bal") > -1 ? idx("bal") : idx("amount");
  const curI    = idx("cur");

  return rows.slice(1).map((row, i) => {
    const balance = parseFloat(String(row[balI] || "0").replace(/[$,\s]/g, "")) || 0;
    return {
      sheet_row_id:  `acct_${i}`,
      nickname:      row[nickI] || `Account ${i+1}`,
      institution:   row[instI] || "",
      account_type:  String(row[typeI] || "cash").toLowerCase().replace(/[\s-]/g, "_"),
      balance,
      currency:      row[curI]  || "CAD",
      is_liability:  balance < 0,
    };
  }).filter(r => r.nickname);
}

// ─── Main sync handler ───────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const spreadsheetId = body.spreadsheetId || process.env.GOOGLE_SHEET_ID;

    if (!spreadsheetId) {
      return Response.json({ error: "No spreadsheet ID provided. Add GOOGLE_SHEET_ID to your env vars." }, { status: 400 });
    }

    // Sheet tab names — user can customise these in env vars
    const txSheet   = process.env.SHEET_TAB_TRANSACTIONS  || "Transactions";
    const acctSheet = process.env.SHEET_TAB_ACCOUNTS       || "Accounts";

    const results = { transactions: 0, accounts: 0, errors: [] };

    // Fetch and parse transactions
    try {
      const txRows    = await fetchSheet(spreadsheetId, txSheet);
      const txParsed  = parseTransactions(txRows);
      results.transactions = txParsed.length;

      // Return parsed data directly to client (client saves to localStorage + state)
      // In production with Supabase, you'd upsert here instead.
      results.transactionData = txParsed;
    } catch (e) {
      results.errors.push(`Transactions: ${e.message}`);
    }

    // Fetch and parse accounts
    try {
      const acctRows   = await fetchSheet(spreadsheetId, acctSheet);
      const acctParsed = parseAccounts(acctRows);
      results.accounts = acctParsed.length;
      results.accountData = acctParsed;
    } catch (e) {
      results.errors.push(`Accounts: ${e.message}`);
    }

    results.syncedAt = new Date().toISOString();
    results.ok = results.errors.length === 0;

    return Response.json(results);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// GET endpoint for Vercel Cron (cron calls GET, not POST)
export async function GET(request) {
  // Verify this is a legitimate Vercel cron call
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return POST(new Request(request.url, {
    method: "POST",
    body: JSON.stringify({ spreadsheetId: process.env.GOOGLE_SHEET_ID }),
  }));
}
