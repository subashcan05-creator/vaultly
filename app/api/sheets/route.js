// app/api/sheets/route.js
// Reads all 4 tabs simultaneously: Transactions, Balances, Investment, Credit Card

const SHEET_ID = "11ZvQbpQTtbayEuhaRXMOGc8QzpiKq69ODVjlxg6zReA";

function csvUrl(sheet) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}`;
}

export async function GET() {
  try {
    // Fetch all 4 tabs in parallel
    const [txnRes, balRes, invRes, ccRes] = await Promise.all([
      fetch(csvUrl("Transactions")),
      fetch(csvUrl("Balances")),
      fetch(csvUrl("Investment")),
      fetch(csvUrl("Credit Card")),
    ]);

    const [txnCsv, balCsv, invCsv, ccCsv] = await Promise.all([
      txnRes.ok ? txnRes.text() : Promise.resolve(""),
      balRes.ok ? balRes.text() : Promise.resolve(""),
      invRes.ok ? invRes.text() : Promise.resolve(""),
      ccRes.ok  ? ccRes.text()  : Promise.resolve(""),
    ]);

    const transactions  = parseTransactions(txnCsv);
    const ccTransactions = parseTransactions(ccCsv);
    const balances      = parseBalances(balCsv);
    const investments   = parseInvestments(invCsv);

    // Merge credit card transactions in with a flag
    const allTransactions = [
      ...transactions,
      ...ccTransactions.map(t => ({ ...t, source: "credit_card" })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    return Response.json({
      transactions: allTransactions,
      balances,
      investments,
      synced_at: new Date().toISOString(),
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// ─── CSV parser ───────────────────────────────────────────────────────────────
function parseCSVLine(line) {
  const vals = []; let cur = "", inQ = false;
  for (const ch of line) {
    if (ch === '"') inQ = !inQ;
    else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ""; }
    else cur += ch;
  }
  vals.push(cur.trim());
  return vals.map(v => v.replace(/"/g, "").trim());
}

function findHeaders(csv) {
  const lines = csv.trim().split("\n").map(l => l.replace(/\r/g, ""));
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const vals = parseCSVLine(lines[i]).map(v => v.toLowerCase());
    if (vals.includes("date") && vals.includes("amount")) {
      return { headers: vals, startRow: i + 1, lines };
    }
  }
  return { headers: [], startRow: 1, lines };
}

function parseTransactions(csv) {
  if (!csv.trim()) return [];
  const { headers, startRow, lines } = findHeaders(csv);
  if (!headers.length) return [];

  const col = h => headers.indexOf(h);
  const results = [];

  for (let i = startRow; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const vals = parseCSVLine(line);

    const dateStr = vals[col("date")] || "";
    const cat     = vals[col("category")] || "";
    const payee   = vals[col("payee")] || "";
    const amtStr  = vals[col("amount")] || "0";
    const notes   = vals[col("notes")] || "";
    const acct    = vals[col("account_name")] || "";

    if (!dateStr || !amtStr) continue;
    const amount = parseFloat(amtStr.replace(/[$,\s]/g, ""));
    if (isNaN(amount) || amount === 0) continue;

    const c = cat.toLowerCase(), p = payee.toLowerCase();

    // Skip transfers between own accounts
    const isTransfer =
      c.includes("transfer") ||
      c.includes("payment, transfer") ||
      p.includes("subash - rbc") ||
      p.includes("subash chandran durairaj") ||
      (p.includes("e-transfer") && amount > 0 && p.includes("subash")) ||
      p.includes("item returned nsf");
    if (isTransfer) continue;

    // Skip CC payments (moving money, not spending)
    const isCCPay = c.includes("credit card payment") || p.includes("amex bill");
    if (isCCPay) continue;

    const category = mapCategory(cat, payee);
    const institution = acct.toLowerCase().includes("rbc") ? "RBC" : "CIBC";

    results.push({
      id:          `gs_${dateStr}_${i}`,
      date:        dateStr,
      type:        amount > 0 ? "income" : "expense",
      category,
      amount:      Math.abs(amount),
      payee,
      note:        notes || payee,
      currency:    "CAD",
      institution,
      source:      "bank",
    });
  }

  return results.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function parseBalances(csv) {
  if (!csv.trim()) return [];
  const lines = csv.trim().split("\n").map(l => l.replace(/\r/g, ""));
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(v => v.toLowerCase());
  const accCol  = headers.indexOf("account");
  const balCol  = headers.indexOf("balance");
  if (accCol === -1 || balCol === -1) return [];

  return lines.slice(1)
    .map(line => {
      const vals = parseCSVLine(line);
      return {
        account: vals[accCol] || "",
        balance: parseFloat((vals[balCol] || "0").replace(/[$,\s]/g, "")) || 0,
      };
    })
    .filter(b => b.account);
}

function parseInvestments(csv) {
  if (!csv.trim()) return [];
  const { headers, startRow, lines } = findHeaders(csv);
  if (!headers.length) return [];

  const col = h => headers.indexOf(h);
  const results = [];

  for (let i = startRow; i < lines.length; i++) {
    const vals = parseCSVLine(lines[i]);
    const dateStr = vals[col("date")] || "";
    const payee   = vals[col("payee")] || vals[col("description")] || "";
    const amtStr  = vals[col("amount")] || "0";
    if (!dateStr) continue;
    const amount = parseFloat(amtStr.replace(/[$,\s]/g, ""));
    if (isNaN(amount) || amount === 0) continue;

    results.push({
      id:       `inv_${dateStr}_${i}`,
      date:     dateStr,
      payee,
      amount:   Math.abs(amount),
      type:     amount < 0 ? "contribution" : "withdrawal",
      currency: "CAD",
    });
  }
  return results.sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ─── Category mapper ──────────────────────────────────────────────────────────
function mapCategory(cat, payee) {
  const c = cat.toLowerCase(), p = payee.toLowerCase();
  if (c.includes("groceries") || p.includes("walmart") || p.includes("loblaws") || p.includes("metro") || p.includes("sobeys")) return "Groceries";
  if (c.includes("coffee") || p.includes("tim horton") || p.includes("starbucks") || p.includes("second cup") || p.includes("divine food") || p.includes("devine food") || p.includes("thekkini")) return "Coffee";
  if (c.includes("restaurant") || c.includes("food delivery") || p.includes("uber") || p.includes("skip") || p.includes("doordash") || p.includes("vedic") || p.includes("beaux daddy") || p.includes("land of spices")) return "Food & Dining";
  if (c.includes("gas") || p.includes("shell") || p.includes("petro") || p.includes("esso")) return "Gas";
  if (c.includes("car payment") || p.includes("rbc") && c.includes("car")) return "Car Payment";
  if (c.includes("car maintenance") || p.includes("canadian tire") || p.includes("fat guys") || p.includes("great canadian")) return "Car Maintenance";
  if (c.includes("car accessories") || p.includes("best buy") && c.includes("car")) return "Car Accessories";
  if (c.includes("auto insurance") || c.includes("insurance") || p.includes("insurance")) return "Insurance";
  if (c.includes("phone") || p.includes("koodo") || p.includes("telus") || p.includes("rogers") || p.includes("bell")) return "Phone";
  if (c.includes("subscription") || p.includes("google") || p.includes("netflix") || p.includes("spotify") || p.includes("stock e")) return "Subscriptions";
  if (c.includes("investment") || p.includes("questrade") || p.includes("cibc securities") || p.includes("interactive bro")) return "Investment";
  if (c.includes("income") || p.includes("alstom") || p.includes("skipthedishes")) return "Income";
  if (c.includes("family") || p.includes("remitly")) return "Family / Remittance";
  if (c.includes("shopping") || c.includes("home goods") || p.includes("dollarama")) return "Shopping";
  if (c.includes("day trip") || p.includes("eagle") || p.includes("chippewa")) return "Entertainment";
  if (c.includes("withdrawal") || p.includes("atm")) return "Cash Withdrawal";
  if (c.includes("snack") || p.includes("subway") || p.includes("darcy")) return "Food & Dining";
  if (c.includes("fees") || c.includes("nsf") || c.includes("interest")) return "Bank Fees";
  return "Other";
}
