const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fetch =
  global.fetch || ((...args) => import("node-fetch").then(({ default: f }) => f(...args)));

dotenv.config({ path: path.join(__dirname, ".env") });

//Acceptance Rate 
const app = express();
app.use(cors());
app.use(express.json());

if (!process.env.DATAGOV_API_KEY) {
  console.warn("⚠️  DATAGOV_API_KEY is missing. Add it to server/.env");
}

const BASE = "https://api.data.gov/ed/collegescorecard/v1/schools";


// simple in-memory cache to avoid rate limits during dev
const cache = new Map(); // key -> { ts, data }
const TTL_MS = 60 * 1000; // 1 minute

//tution fees 
app.get("/api/tuition", async (req, res) => {
  try {
    const { id, name } = req.query;

    const params = new URLSearchParams({
      api_key: process.env.DATAGOV_API_KEY,          // same env var you already use
      per_page: "1",
      fields: "id,school.name,latest.cost.tuition.in_state,latest.cost.tuition.out_of_state",
    });

    if (id) params.set("id", String(id));
    else if (name) params.set("school.name", String(name));
    else return res.status(400).json({ error: "Provide id or name" });

    const r = await fetch(`${BASE}?${params}`);
    const data = await r.json();
    const s = data.results?.[0] ?? {};

    // NOTE: fields are flattened in the response
    const inState  = s["latest.cost.tuition.in_state"];
    const outState = s["latest.cost.tuition.out_of_state"];

    res.json({
      id: s.id,
      name: s["school.name"],
      inState: inState == null ? null : Number(inState),
      outState: outState == null ? null : Number(outState),
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "tuition lookup failed" });
  }
});



// /api/acceptance?id=110635  OR  /api/acceptance?name=Georgia Institute of Technology
app.get("/api/acceptance", async (req, res) => {
  try {
    const { id, name } = req.query;

    const params = new URLSearchParams({
      api_key: process.env.DATAGOV_API_KEY,   // <-- use the same key you already have
      per_page: "1",
      fields: "id,school.name,latest.admissions.admission_rate.overall",
    });

    if (id) params.set("id", String(id));
    else if (name) params.set("school.name", String(name));
    else return res.status(400).json({ error: "Provide id or name" });

    const r = await fetch(`${BASE}?${params}`);
    if (!r.ok) return res.status(r.status).json({ error: "Upstream error", detail: await r.text() });
    const data = await r.json();
    const s = data.results?.[0];

    // fields are flattened when you use ?fields=...
    const frac = s?.["latest.admissions.admission_rate.overall"]; // 0–1 or null
    const pct  = frac == null ? null : Math.round(frac * 1000) / 10;

    res.json({
      id: s?.id,
      name: s?.["school.name"],
      acceptanceRatePct: pct,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "acceptance lookup failed" });
  }
});







// --------------------------
// /api/schools
// --------------------------
app.get("/api/schools", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const per = req.query.per_page || "12";

    // cache key
    const key = `schools:${q}:${per}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL_MS) return res.json(hit.data);

    const params = new URLSearchParams({
      api_key: process.env.DATAGOV_API_KEY || "",
      per_page: per,
      fields: ["id", "school.name", "school.city", "school.state"].join(","),
      sort: "school.name:asc",
    });

    if (q) {
      if (/^[A-Z]{2}$/.test(q.toUpperCase())) {
        // state code like MD, CA
        params.set("school.state", q.toUpperCase());
      } else {
        // substring (regex-ish) match on name — works on this dataset
        params.set("school.name", `~${q}`);
      }
    }

    if (!process.env.DATAGOV_API_KEY) {
      return res
        .status(400)
        .json({ error: "Missing API key. Set DATAGOV_API_KEY in server/.env" });
    }

    const url = `${BASE}?${params.toString()}`;
    console.log("🔎 Fetching Scorecard URL:", url);

    const r = await fetch(url);
    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: "Upstream error", detail: text });
    }
    const data = await r.json();

    cache.set(key, { ts: Date.now(), data });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Server error", detail: String(e) });
  }
});

// --------------------------
// /api/estimate
// --------------------------
app.post("/api/estimate", async (req, res) => {
  try {
    const { schoolId, income } = req.body || {};
    if (!process.env.DATAGOV_API_KEY) {
      return res.status(400).json({ error: "Missing API key" });
    }
    if (!schoolId || income == null) {
      return res.status(400).json({ error: "schoolId and income are required" });
    }

    const params = new URLSearchParams({
      api_key: process.env.DATAGOV_API_KEY,
      id: String(schoolId),
      per_page: "1",
      fields: [
        "id",
        "school.name",
        "school.city",
        "school.state",
        "school.ownership",
        "latest.cost.tuition.in_state",
        "latest.cost.tuition.out_of_state",
        "latest.cost.net_price.public.by_income_level.0-30000",
        "latest.cost.net_price.public.by_income_level.30001-48000",
        "latest.cost.net_price.public.by_income_level.48001-75000",
        "latest.cost.net_price.public.by_income_level.75001-110000",
        "latest.cost.net_price.public.by_income_level.110001-plus",
        "latest.cost.net_price.private.by_income_level.0-30000",
        "latest.cost.net_price.private.by_income_level.30001-48000",
        "latest.cost.net_price.private.by_income_level.48001-75000",
        "latest.cost.net_price.private.by_income_level.75001-110000",
        "latest.cost.net_price.private.by_income_level.110001-plus",
      ].join(","),
    });

    const r = await fetch(`${BASE}?${params.toString()}`);
    if (!r.ok) return res.status(r.status).json({ error: "Upstream error", detail: await r.text() });
    const data = await r.json();
    const rec = (data.results && data.results[0]) || null;
    if (!rec) return res.status(404).json({ error: "School not found" });

    const inc = Number(income);
    const bracket =
      inc <= 30000
        ? "0-30000"
        : inc <= 48000
        ? "30001-48000"
        : inc <= 75000
        ? "48001-75000"
        : inc <= 110000
        ? "75001-110000"
        : "110001-plus";

    const isPublic = Number(rec["school.ownership"]) === 1;
    const pub = (k) => Number(rec[`latest.cost.net_price.public.by_income_level.${k}`]);
    const pri = (k) => Number(rec[`latest.cost.net_price.private.by_income_level.${k}`]);

    let netPrice = isPublic ? (pub(bracket) || pri(bracket)) : (pri(bracket) || pub(bracket));
    if (!(netPrice > 0)) {
      const tuition =
        Number(rec["latest.cost.tuition.in_state"]) ||
        Number(rec["latest.cost.tuition.out_of_state"]) ||
        15000;
      netPrice = tuition;
    }
    netPrice = Number(netPrice ?? 0);

    let grants =
      inc <= 30000 ? 9000 : inc <= 48000 ? 7000 : inc <= 75000 ? 5000 : inc <= 110000 ? 2500 : 1000;
    grants = Number(Math.max(0, Math.min(grants, netPrice)));

    const workStudy = Number(inc <= 110000 ? 2000 : 1500);
    const desiredOutOfPocket = 1800;

    const loans = Number(Math.max(0, netPrice - grants - workStudy - desiredOutOfPocket));
    const outOfPocket = Number(Math.max(0, netPrice - grants - workStudy - loans));

    res.json({
      school: {
        id: rec.id,
        name: rec["school.name"],
        city: rec["school.city"],
        state: rec["school.state"],
      },
      income: inc,
      bracket,
      netPrice: Number(netPrice),
      breakdown: {
        grants: Number(grants),
        workStudy: Number(workStudy),
        loans: Number(loans),
        outOfPocket: Number(outOfPocket),
      },
      note: "Heuristic estimate for demo only; net price from College Scorecard when available.",
    });
  } catch (e) {
    res.status(500).json({ error: "Server error", detail: String(e) });
  }
});

const PORT = process.env.PORT || 5174;
app.listen(PORT, () => console.log(`Server running: http://localhost:${PORT}`));
