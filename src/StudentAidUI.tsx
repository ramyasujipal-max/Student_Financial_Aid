import React from "react";
import { Search, GraduationCap, DollarSign } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
} from "recharts";

/* =========================
   Constants
   ========================= */

const START_PIE = [
  { name: "Grants", value: 6000 },
  { name: "Work-Study", value: 2500 },
  { name: "Loans", value: 7000 },
  { name: "Out-of-Pocket", value: 1800 },
];

const TILE_GRADS: Array<[string, string]> = [
  ["#A7F3D0", "#34D399"],
  ["#C7D2FE", "#818CF8"],
  ["#FDE68A", "#F59E0B"],
  ["#FECACA", "#F43F5E"],
];

const ICON_HEX = ["#065F46", "#3730A3", "#92400E", "#9F1239"];
const COLORS = ["#10B981", "#34D399", "#F59E0B", "#6366F1"];

/* =========================
   Helpers / components
   ========================= */

// Minimal hover tooltip (Tailwind only)
function InfoTip({ text }: { text: string }) {
  return (
    <span
      className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs leading-none cursor-help select-none"
      title={text}   // <-- native tooltip on hover
    >
      i
    </span>
  );
}




const fmt = (n?: number) =>
  typeof n === "number"
    ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "—";

function bracketFromIncome(income: number) {
  if (income <= 30000) return "0-30000";
  if (income <= 48000) return "30001-48000";
  if (income <= 75000) return "48001-75000";
  if (income <= 110000) return "75001-110000";
  return "110001-plus";
}

function pieValue(pie: Array<{ name: string; value: number }>, name: string) {
  return Number(pie.find((s) => s.name === name)?.value ?? 0);
}

function makeExplanations(
  pie: Array<{ name: string; value: number }>,
  income: number,
  netPrice: number
) {
  const grants = pieValue(pie, "Grants");
  const workStudy = pieValue(pie, "Work-Study");
  const loans = pieValue(pie, "Loans");
  const outOfPocket = pieValue(pie, "Out-of-Pocket");

  const gTarget =
    income <= 30000 ? 9000 :
    income <= 48000 ? 7000 :
    income <= 75000 ? 5000 :
    income <= 110000 ? 2500 : 1000;

return {
  netPriceText:
    `Net price is retrieved directly from the U.S. Dept. of Education’s College Scorecard API for the student’s income bracket (${bracketFromIncome(income)}). ` +
    `If no value is available for that bracket, we fall back to tuition. For this run: netPrice = ${fmt(netPrice)}.`,

  grantsText:
    `Estimated grants based on income brackets (heuristic): ≤$30k → $9,000; ≤$48k → $7,000; ≤$75k → $5,000; ≤$110k → $2,500; >$110k → $1,000. ` +
    `We cap grants at net price so they never exceed total cost. For income ${fmt(income)} ⇒ estimated grants = ${fmt(grants)}.`,

  workStudyText:
    `Rule-of-thumb estimate for work-study: $2,000 if income ≤ $110k, otherwise $1,500. ` +
    `For income ${fmt(income)} ⇒ estimated work-study = ${fmt(workStudy)}.`,

  loansText:
    `Loans are calculated so the package balances to net price. Formula: loans = max(0, netPrice − grants − work-study − $1,800). ` +
    `For this case: ${fmt(netPrice)} − ${fmt(grants)} − ${fmt(workStudy)} − $1,800 = ${fmt(loans)}.`,

  oopText:
    `Out-of-pocket is the remaining cost after grants, work-study, and loans. Formula: outOfPocket = max(0, netPrice − grants − work-study − loans). ` +
    `For this case: ${fmt(netPrice)} − ${fmt(grants)} − ${fmt(workStudy)} − ${fmt(loans)} = ${fmt(outOfPocket)}.`,
};

}

/* =========================
   Main component
   ========================= */

type SchoolItem = {
  id: number;
  name: string;
  city?: string;
  state?: string;
  subtitle?: string;
};

export default function StudentAidUI() {
  const [term, setTerm] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<SchoolItem[]>([]);
  const [openList, setOpenList] = React.useState(false);
  const [selectedSchool, setSelectedSchool] = React.useState<SchoolItem | null>(null);

  const [income, setIncome] = React.useState<number>(65000);
  const [gpa, setGpa] = React.useState<number>(3.6);

  const [pie, setPie] = React.useState(START_PIE);
  const [estimating, setEstimating] = React.useState(false);

  const [acceptance, setAcceptance] = React.useState<number | null>(null);
  const [tuition, setTuition] = React.useState<{ inState: number | null; outState: number | null } | null>(null);

  /* ---- Effects ---- */

  React.useEffect(() => {
    if (!selectedSchool) {
      setAcceptance(null);
      return;
    }
    setAcceptance(null);
    fetch(`/api/acceptance?id=${selectedSchool.id}`)
      .then((r) => r.json())
      .then((d) => setAcceptance(d.acceptanceRatePct ?? null))
      .catch(() => setAcceptance(null));
  }, [selectedSchool]);

  React.useEffect(() => {
    if (!selectedSchool) {
      setTuition(null);
      return;
    }
    fetch(`/api/tuition?id=${selectedSchool.id}`)
      .then((r) => r.json())
      .then((d) => setTuition({ inState: d.inState ?? null, outState: d.outState ?? null }))
      .catch(() => setTuition({ inState: null, outState: null }));
  }, [selectedSchool]);

  React.useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const t = setTimeout(async () => {
      if (term.trim().length < 2) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const r = await fetch(`/api/schools?q=${encodeURIComponent(term)}&per_page=10`, {
          signal: controller.signal,
        });
        const json = await r.json();
        const list: SchoolItem[] =
          (json.results || [])
            .map((d: any) => {
              const city = d["school.city"];
              const state = d["school.state"];
              return {
                id: d.id,
                name: d["school.name"],
                city,
                state,
                subtitle: [city, state].filter(Boolean).join(", "),
              } as SchoolItem;
            })
            .filter((x: SchoolItem) => x.name) ?? [];
        if (!cancelled) {
          setResults(list);
          setOpenList(true);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setOpenList(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(t);
    };
  }, [term]);

  /* ---- Handlers ---- */

  function handleSelect(s: SchoolItem) {
    setSelectedSchool(s);
    setTerm(s.name);
    setOpenList(false);
  }

  async function generatePlan() {
    if (!selectedSchool) {
      alert("Pick a school first");
      return;
    }
    try {
      setEstimating(true);
      const r = await fetch("/api/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schoolId: selectedSchool.id, income }),
      });
      const json = await r.json();
      if (!r.ok || !json.breakdown) {
        console.error(json);
        alert("Estimate failed. Check server console.");
        return;
      }
      const { grants, workStudy, loans, outOfPocket } = json.breakdown;
      setPie([
        { name: "Grants", value: Math.round(Number(grants || 0)) },
        { name: "Work-Study", value: Math.round(Number(workStudy || 0)) },
        { name: "Loans", value: Math.round(Number(loans || 0)) },
        { name: "Out-of-Pocket", value: Math.round(Number(outOfPocket || 0)) },
      ]);
    } catch (e) {
      console.error(e);
      alert("Network error.");
    } finally {
      setEstimating(false);
    }
  }

  const total = pie.reduce((s, x) => s + (Number(x.value) || 0), 0); // net price (sum of slices)
  const explain = makeExplanations(pie, income, total);

  /* ---- Render ---- */

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50">
      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-400 text-white shadow">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <h1 className="mt-0 md:mt-1 font-bold tracking-normal" style={{ color: "#123456", fontSize: 44 }}>
                StudentAid
              </h1>
              <p className="text-sm" style={{ color: "#566D7E", fontFamily: "Poppins, sans-serif" }}>
                Financial Aid, Simplified
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pt-0 pb-6 md:grid-cols-2">
        {/* LEFT: Search + inputs */}
        <section className="-mt-6">
          <h2 className="mt-0 md:mt-1 font-bold tracking-normal" style={{ color: "#123456", fontSize: 33 }}>
            Understand college costs in seconds
          </h2>

          <p className="mt-4" style={{ color: "#123456", fontFamily: "serif", fontSize: "15px" }}>
            Search a school to estimate grants, loans, out-of-pocket costs, acceptance rate, and tuition fees at a glance.
          </p>

          {/* Search */}
          <div className="mt-6 w-full max-w-xl">
            <label className="mb-1 block text-sm font-semibold" style={{ color: "#4B0150" }}>
              Target School
            </label>

            <div className="relative w-full">
              <div className="flex items-center gap-3 rounded-2xl border bg-white px-5 py-4 shadow-md ring-1 ring-black/5">
                <Search className="ml-1 h-6 w-6 text-gray-500" />
                <input
                  className="w-full border-0 bg-transparent outline-none focus:ring-0 text-lg py-1"
                  placeholder="e.g., Georgia Institute of Technology"
                  value={term}
                  onChange={(e) => {
                    setTerm(e.target.value);
                    setOpenList(true);
                  }}
                  onFocus={() => setOpenList(true)}
                />
              </div>

              {openList && (results.length > 0 || loading) && (
                <div
                  className="absolute left-0 right-0 z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border bg-white/70 backdrop-blur shadow-lg"
                  role="listbox"
                >
                  {loading && <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>}

                  {!loading &&
                    results.map((s, idx) => {
                      const [from, to] = TILE_GRADS[idx % TILE_GRADS.length];
                      const iconColor = ICON_HEX[idx % ICON_HEX.length];
                      const tileStyle: React.CSSProperties = { backgroundImage: `linear-gradient(90deg, ${from}, ${to})` };
                      return (
                        <button key={s.id ?? idx} className="w-full text-left" type="button" onClick={() => handleSelect(s)}>
                          <div className="flex items-start gap-3 rounded-xl p-3 shadow-md hover:shadow-lg transition" style={tileStyle}>
                            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" style={{ color: iconColor }} />
                            <div className="min-w-0">
                              <div className="font-medium truncate">{s.name}</div>
                              {s.subtitle && <div className="text-xs text-gray-800/90 truncate">{s.subtitle}</div>}
                            </div>
                          </div>
                        </button>
                      );
                    })}

                  {!loading && results.length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500">No results. Try another term.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Inputs */}
          <div className="mt-6 grid max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-bold" style={{ color: "#000000" }}>
                Household Income
              </label>
              <input
                type="number"
                value={income}
                onChange={(e) => setIncome(Number(e.target.value || 0))}
                className="w-full rounded-xl border bg-white p-2 shadow-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-bold" style={{ color: "#000000" }}>
                Unweighted GPA
              </label>
              <input
                type="number"
                step="0.1"
                min={0}
                max={4}
                value={gpa}
                onChange={(e) => setGpa(Number(e.target.value || 0))}
                className="w-full rounded-xl border bg-white p-2 shadow-sm"
              />
            </div>
          </div>

          {/* Selected school summary */}
          {selectedSchool && (
            <div className="mt-4 w-full flex justify-center">
              <div className="w-full max-w-md rounded-xl border bg-white p-4 text-sm text-slate-800 shadow-sm text-left">
                <div className="font-medium text-center">{selectedSchool.name}</div>
                {selectedSchool.subtitle && <div className="text-slate-500 text-center">{selectedSchool.subtitle}</div>}

                <div className="mt-3 mx-auto w-fit text-sm text-center">
                  <span className="inline-flex items-baseline whitespace-nowrap">
                    <span className="text-slate-700">Acceptance rate</span>
                    <span className="mx-1">-</span>
                    <strong className="font-bold text-indigo-700 tabular-nums">
                      {acceptance == null ? "—" : `${acceptance}%`}
                    </strong>
                  </span>

                  <span className="inline-block mx-6">{'\u2003'}</span>

                  <span className="inline-flex items-baseline whitespace-nowrap">
                    <span className="text-slate-700">In-state tuition fees</span>
                    <span className="mx-1">-</span>
                    <strong className="font-bold text-emerald-700 tabular-nums">
                      {tuition?.inState != null ? `$${tuition.inState.toLocaleString()}` : "—"}
                    </strong>
                  </span>

                  <span className="inline-block mx-6">{'\u2003'}</span>

                  <span className="inline-flex items-baseline whitespace-nowrap">
                    <span className="text-slate-700">Out-of-state tuition fees</span>
                    <span className="mx-1">-</span>
                    <strong className="font-bold text-emerald-700 tabular-nums">
                      {tuition?.outState != null ? `$${tuition.outState.toLocaleString()}` : "—"}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* RIGHT: Donut + breakdown */}
        <section className="rounded-2xl border bg-white p-4 shadow-sm relative z-10">
          <div className="mb-2" style={{ fontSize: 30, color: "#B93B8F", fontWeight: 600 }}>
            Estimated breakdown
          </div>

          <div className="relative w-full shrink-0" style={{ height: 300 }}>
            {total > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart key={pie.map((p) => p.value).join("-")}>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" strokeWidth={1}>
                    {pie.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <ReTooltip formatter={(v: any, n: any) => [`$${Number(v).toLocaleString()}`, n]} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500">
                No data yet — click “Generate Plan”
              </div>
            )}
          </div>

          {/* Breakdown rows (with hover tooltips) */}
          <div className="mt-4 rounded-xl border bg-white shadow-sm divide-y relative z-10">
            {pie.map((s) => {
              const tip =
                s.name === "Grants" ? explain.grantsText :
                s.name === "Work-Study" ? explain.workStudyText :
                s.name === "Loans" ? explain.loansText :
                s.name === "Out-of-Pocket" ? explain.oopText :
                "";

              return (
                <div key={s.name} className="flex items-center justify-between px-4 py-2">
                  <span className="text-gray-600 flex items-center">
                    {s.name} <InfoTip text={tip} />
                  </span>
                  <span className="text-base font-semibold text-emerald-700 tabular-nums">
                    ${s.value.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Net price line with tooltip */}
          <p className="mt-2 text-xs text-gray-600">
            <span className="font-medium">Net price:</span> {fmt(total)} <InfoTip text={explain.netPriceText} /> •
            <span className="ml-1">Source: U.S. Dept. of Education College Scorecard.</span>
          </p>

          <button
            className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            onClick={generatePlan}
            disabled={estimating || !selectedSchool}
          >
            {estimating ? "Calculating…" : "Generate Plan"}
          </button>
        </section>
      </main>
    </div>
  );
}
