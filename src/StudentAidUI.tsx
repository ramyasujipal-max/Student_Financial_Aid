import React from "react";
import { Search, GraduationCap, DollarSign } from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
} from "recharts";

// --- Donut placeholder data (initial; replaced after /api/estimate) ---
const START_PIE = [
  { name: "Grants", value: 6000 },
  { name: "Work-Study", value: 2500 },
  { name: "Loans", value: 7000 },
  { name: "Out-of-Pocket", value: 1800 },
];

const COLORS = ["#10B981", "#34D399", "#F59E0B", "#6366F1"]; // emerald/amber/indigo

type SchoolItem = {
  id: number;
  name: string;
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

  // Live donut state
  const [pie, setPie] = React.useState(START_PIE);
  const [estimating, setEstimating] = React.useState(false);

  // NEW: acceptance + tuition
  const [acceptance, setAcceptance] = React.useState<number | null>(null);
  const [tuition, setTuition] = React.useState<{ inState: number | null; outState: number | null } | null>(null);

  // Fetch acceptance whenever a school is chosen
  React.useEffect(() => {
    if (!selectedSchool) { setAcceptance(null); return; }
    setAcceptance(null);
    fetch(`/api/acceptance?id=${selectedSchool.id}`)
      .then((r) => r.json())
      .then((d) => setAcceptance(d.acceptanceRatePct ?? null))
      .catch(() => setAcceptance(null));
  }, [selectedSchool]);

  // Fetch tuition (in/out of state)
  React.useEffect(() => {
    if (!selectedSchool) { setTuition(null); return; }
    fetch(`/api/tuition?id=${selectedSchool.id}`)
      .then((r) => r.json())
      .then((d) => setTuition({ inState: d.inState ?? null, outState: d.outState ?? null }))
      .catch(() => setTuition({ inState: null, outState: null }));
  }, [selectedSchool]);

  // Generate plan -> update donut
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
      const next = [
        { name: "Grants", value: Math.round(Number(grants || 0)) },
        { name: "Work-Study", value: Math.round(Number(workStudy || 0)) },
        { name: "Loans", value: Math.round(Number(loans || 0)) },
        { name: "Out-of-Pocket", value: Math.round(Number(outOfPocket || 0)) },
      ];
      setPie(next);
    } catch (e) {
      console.error(e);
      alert("Network error.");
    } finally {
      setEstimating(false);
    }
  }

  // Debounced search -> backend proxy (College Scorecard)
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
        const list: SchoolItem[] = (json.results || [])
          .map((d: any) => ({
            id: d.id,
            name: d["school.name"],
            subtitle: [d["school.city"], d["school.state"]].filter(Boolean).join(", "),
          }))
          .filter((x: SchoolItem) => x.name);
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
      clearTimeout(t);
      controller.abort();
    };
  }, [term]);

  const total = pie.reduce((s, x) => s + (Number(x.value) || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-emerald-50">
      {/* NAV */}
      <header className="sticky top-0 z-20 border-b bg-white/70 backdrop-blur">
      	<div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-1">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-400 text-white shadow">
              <DollarSign className="h-5 w-5" />
            </div>
            <div className="leading-tight">
			<h1 className="mt-0 md:mt-1 font-bold leading-tight tracking-normal" style={{ color: "#123456", fontSize: 44 }} // px
                 >StudentAid
  
			</h1>

              <p className="text-2xl font-medium" style={{ color: "#0f766e", fontFamily: "Poppins, sans-serif" }}>
                
              </p>
              <p className="text-sm" style={{ color: "#566D7E", fontFamily: "Poppins, sans-serif" }}>
                Financial Aid, Simplified
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* HERO + QUICK ESTIMATOR */}
     <main className="mx-auto grid max-w-6xl grid-cols-1 gap-6 px-4 pt-0 pb-6 md:grid-cols-2">
        {/* Left: copy + search */}
        <section className="-mt-6">
		<h1 className="mt-0 md:mt-1 font-bold leading-tight tracking-normal" style={{ color: "#123456", fontSize: 33 }} // px
         >
		Understand college costs in seconds
		</h1>

          <p className="mt-4" style={{ color: "#123456", fontFamily: "serif", fontSize: "15px" }}>
            Search a school to estimate grants, loans, out-of-pocket costs, acceptance rate, and tuition fees at a glance.
          </p>

          {/* Target School search */}
          <div className="mt-6 w-full max-w-xl">
            <label className="mb-1 block text-sm font-semibold" style={{ color: "#4B0150" }}>
              Target School
            </label>
		
		
		
            <div className="relative">
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

              {/* Results dropdown (one column, scrollable) */}
              {openList && (results.length > 0 || loading) && (
                <div
                  className="absolute left-0 right-0 z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border bg-white shadow-lg"
                  role="listbox"
                >
                  {loading && <div className="px-4 py-3 text-sm text-gray-500">Searching…</div>}
                  {!loading &&
                    results.map((s, idx) => (
                      <button
                        key={s.id ?? idx}
                        role="option"
                        className="block w-full text-left px-4 py-3 hover:bg-emerald-50 focus:bg-emerald-50 focus:outline-none"
                        onClick={() => {
                          setSelectedSchool(s);
                          setTerm(s.name);
                          setOpenList(false);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <GraduationCap className="mt-0.5 h-4 w-4 text-emerald-600 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-medium truncate">{s.name}</div>
                            <div className="text-xs text-gray-500 truncate">{s.subtitle}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  {!loading && results.length === 0 && (
                    <div className="px-4 py-3 text-sm text-gray-500">No results. Try another term.</div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Inputs for estimate */}
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

          {/* Selected school summary (single centered card) */}
 {/* Selected school summary (single centered card) */}
{selectedSchool && (
  <div className="mt-4 w-full flex justify-center">
    <div
      className="w-full max-w-md rounded-xl border bg-white p-4 text-sm text-slate-800 shadow-sm text-left"
      style={{ backgroundColor: "#fff" }}
    >
      {/* center the headings */}
      <div className="font-medium text-center">{selectedSchool.name}</div>
      {selectedSchool.subtitle && (
        <div className="text-slate-500 text-center">{selectedSchool.subtitle}</div>
      )}

      {/* rows: each line is its own grid */}
<div className="mt-3 mx-auto w-fit text-sm text-center">
  {/* Pair 1 */}
  <span className="inline-flex items-baseline whitespace-nowrap">
    
	<span className="text-slate-700">Acceptance rate</span>

    <span className="mx-1">-</span>
    <strong className="font-bold text-indigo-700 tabular-nums">
      {acceptance == null ? "—" : `${acceptance}%`}
    </strong>
  </span>

  {/* hard space between pairs */}
  <span className="inline-block mx-6">{'\u2003'}</span>

  {/* Pair 2 */}
  <span className="inline-flex items-baseline whitespace-nowrap">
    <span className="text-slate-700">In-state tuition fees</span>
    <span className="mx-1">-</span>
    <strong className="font-bold text-emerald-700 tabular-nums">
      {tuition?.inState != null ? `$${tuition.inState.toLocaleString()}` : "—"}
    </strong>
  </span>

  {/* hard space between pairs */}
  <span className="inline-block mx-6">{'\u2003'}</span>

  {/* Pair 3 */}
  <span className="inline-flex items-baseline whitespace-nowrap">
    <span className="text-slate-700">Out-of-state tuition fees</span>
    <span className="mx-1">-</span>
    <strong className="font-bold text-emerald-700 tabular-nums">
      {tuition?.outState != null ? `$${tuition.outState.toLocaleString()}` : "—"}
    </strong>
  </span>
</div>



      {/* end rows */}
    </div>
  </div>
)}


        </section>

   

    {/* Right: donut chart */}
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
         <div className="mb-2" style={{ fontSize: 30, color: '#B93B8F', fontWeight: 600 }}>
			Estimated breakdown
		</div>

		 
			<div
			  className="relative w-full shrink-0"
			  style={{ height: 300 }}
			>
			  {total > 0 ? (
				<ResponsiveContainer width="100%" height="100%">
				  <PieChart key={pie.map((p) => p.value).join("-")}>
					<Pie
					  data={pie}
					  dataKey="value"
					  nameKey="name"
					  innerRadius="55%"
					  outerRadius="85%"
					  strokeWidth={1}
					>
					  {pie.map((_, idx) => (
						<Cell key={idx} fill={COLORS[idx % COLORS.length]} />
					  ))}
					</Pie>
					<ReTooltip
					  formatter={(v: any, n: any) => [`$${Number(v).toLocaleString()}`, n]}
					/>
				  </PieChart>
				</ResponsiveContainer>
			  ) : (
				<div className="flex h-full items-center justify-center text-sm text-gray-500">
				  No data yet — click “Generate Plan”
				</div>
			  )}
			</div>

          {/* Name–value list under the chart */}
          <div className="mt-4 rounded-xl border bg-white shadow-sm divide-y">
            {pie.map((s) => (
              <div key={s.name} className="flex items-center justify-between px-4 py-2">
                <span className="text-gray-600">{s.name}</span>
                <span className="text-base font-semibold text-emerald-700 tabular-nums">
                  ${s.value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

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
