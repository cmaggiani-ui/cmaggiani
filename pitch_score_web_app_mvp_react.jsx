import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";

/**
 * PitchScore — Single-file React MVP
 * - Textarea for pitch
 * - Optional controls (genre, tone, rating, budget)
 * - On submit → mock scoring function (replace with your API/model)
 * - Visualizations: Gauge, Radar, Bars, Similar Movies table
 *
 * How to replace the mock model:
 * 1) Swap `mockScoreRequest` with a real API call to your backend.
 * 2) Keep the response shape consistent with `ScoreResponse` below.
 */

// ---------- Types ----------
/** @typedef {{
 *  p_success: number; // 0..1
 *  radar: {
 *    originality: number;
 *    clarity: number;
 *    audience_appeal: number;
 *    budget_feasibility: number;
 *    production_risk: number; // lower is better
 *  };
 *  drivers: { feature: string; impact: number }[]; // +/- contributions
 *  nearest_movies: { title: string; year: number; similarity: number; roi?: number }[];
 *  meta?: { genreGuess?: string[] };
 * }} ScoreResponse */

// ---------- Mock model & utilities ----------
const GENRES = ["Acción", "Aventura", "Comedia", "Drama", "Romance", "Terror", "Sci‑Fi", "Thriller", "Fantasia", "Animación"];
const TONES = ["luminoso", "oscuro", "feel‑good", "satírico", "épico", "íntimo"]; 
const RATINGS = ["G", "PG", "PG-13", "R", "NC-17"];

const KEYMAP = [
  { k: /space|nave|planeta|robot|ia|inteligencia artificial|futuro|alien/gi, g: "Sci‑Fi" },
  { k: /crimen|asesin|investigaci|misterio|conspiraci|persecuci/gi, g: "Thriller" },
  { k: /risa|chiste|comedia|humor|torpe|situaci/gi, g: "Comedia" },
  { k: /amor|relaci|pareja|romance|coraz/gi, g: "Romance" },
  { k: /magia|reino|hechic|drag|fantas/gi, g: "Fantasia" },
  { k: /miedo|fantasma|demon|pose|slasher|terror/gi, g: "Terror" },
  { k: /batalla|guerra|rebel|conflicto|misión|acción/gi, g: "Acción" },
  { k: /viaje|búsqueda|tesoro|aventur/gi, g: "Aventura" },
  { k: /animaci|dibujo|stop motion/gi, g: "Animación" },
  { k: /drama|familia|superar|enfermedad|duelo/gi, g: "Drama" },
];

function hashScore(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}

function pickGenresFromText(text) {
  const matches = new Map();
  for (const { k, g } of KEYMAP) {
    const m = text.match(k);
    if (m && m.length) matches.set(g, (matches.get(g) || 0) + m.length);
  }
  return [...matches.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g);
}

/**
 * Create a pseudo-deterministic mock score to demo the UI.
 * Replace with a call to your backend model.
 * @returns {Promise<ScoreResponse>}
 */
async function mockScoreRequest(pitch, options) {
  await new Promise(r => setTimeout(r, 600)); // simulate latency
  const base = Math.min(0.4 + (Math.tanh((pitch.length - 400) / 600) + 1) * 0.25, 0.95);
  const h = hashScore(pitch + JSON.stringify(options));

  const guessed = pickGenresFromText(pitch);
  const genres = options.genres?.length ? options.genres : (guessed.length ? guessed.slice(0, 2) : ["Drama"]);

  // Adjust by genre priors (completamente inventado para demo)
  const genreAdj = genres.reduce((acc, g) => acc + ({"Comedia": 0.03, "Sci‑Fi": 0.02, "Terror": 0.00, "Drama": -0.01, "Romance": -0.02, "Thriller": 0.01, "Acción": 0.01}[g] || 0), 0);

  // Budget feasibility heuristic
  const budget = options.budget_hint_usd ?? (/(space|batalla|drag|epic|guerra)/i.test(pitch) ? 40000000 : 8000000);
  const budgetPeer = (genres.includes("Sci‑Fi") || genres.includes("Acción") || genres.includes("Fantasia")) ? 30000000 : 8000000;
  const budgetFeasibility = Math.max(0, Math.min(1, 1 - Math.abs(budget - budgetPeer) / Math.max(1, budgetPeer * 2)));

  const originality = Math.max(0, Math.min(1, ((h % 100) / 100) * 0.6 + (new Set(genres).size >= 2 ? 0.2 : 0.05)));
  const clarity = Math.max(0, Math.min(1, 0.5 + ((h >> 5) % 50) / 150));
  const audience = Math.max(0, Math.min(1, 0.4 + (genres.includes("Comedia") || genres.includes("Terror") ? 0.1 : 0) + ((h >> 7) % 30) / 200));
  const productionRisk = Math.max(0, 1 - budgetFeasibility * 0.7 - ((h >> 9) % 20) / 100);

  const p_success = Math.max(0.05, Math.min(0.95, base + genreAdj + (originality - 0.5) * 0.15 + (audience - 0.5) * 0.12 + (budgetFeasibility - 0.5) * 0.18 - (productionRisk - 0.5) * 0.15));

  const drivers = [
    { feature: `${genres.join("+")}`, impact: +(genreAdj).toFixed(3) },
    { feature: "originality_index", impact: +((originality - 0.5) * 0.15).toFixed(3) },
    { feature: "audience_appeal", impact: +((audience - 0.5) * 0.12).toFixed(3) },
    { feature: "budget_vs_peers", impact: +((budgetFeasibility - 0.5) * 0.18).toFixed(3) },
    { feature: "production_risk", impact: -+((productionRisk - 0.5) * 0.15).toFixed(3) },
  ].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

  // Nearest movies (mocked)
  const pool = [
    { title: "Ex Machina", year: 2014, roi: 3.7 },
    { title: "Annihilation", year: 2018, roi: 1.4 },
    { title: "Get Out", year: 2017, roi: 7.1 },
    { title: "A Quiet Place", year: 2018, roi: 5.4 },
    { title: "Her", year: 2013, roi: 2.9 },
    { title: "Crazy Rich Asians", year: 2018, roi: 7.3 },
    { title: "Parasite", year: 2019, roi: 20.0 },
    { title: "Knives Out", year: 2019, roi: 4.2 },
    { title: "Mad Max: Fury Road", year: 2015, roi: 2.7 },
    { title: "The Conjuring", year: 2013, roi: 13.3 },
  ];
  const sims = pool.map((m, i) => ({ ...m, similarity: +(0.6 + ((h >> (i + 1)) % 35) / 100).toFixed(2) }))
                   .sort((a, b) => b.similarity - a.similarity)
                   .slice(0, 5);

  return {
    p_success,
    radar: {
      originality, clarity, audience_appeal: audience,
      budget_feasibility: budgetFeasibility, production_risk: productionRisk,
    },
    drivers,
    nearest_movies: sims,
    meta: { genreGuess: genres }
  };
}

// ---------- Small UI helpers ----------
function classNames(...cx) { return cx.filter(Boolean).join(" "); }
function pct(n) { return Math.round(n * 100); }

// ---------- Gauge (needle) ----------
function Gauge({ value }) {
  const angle = useMemo(() => 180 * value, [value]);
  return (
    <div className="w-full aspect-[2/1] flex items-center justify-center">
      <svg viewBox="0 0 200 100" className="w-full">
        <defs>
          <linearGradient id="g" x1="0%" x2="100%">
            <stop offset="0%" stopOpacity="1" />
            <stop offset="100%" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path d="M10,100 A90,90 0 0,1 190,100" fill="none" stroke="url(#g)" strokeWidth="14" />
        <circle cx="100" cy="100" r="6" />
        <motion.line x1="100" y1="100" x2="100" y2="20" strokeWidth="3" strokeLinecap="round"
          animate={{ rotate: -180 + angle }}
          style={{ originX: 100, originY: 100 }} />
        <text x="100" y="92" textAnchor="middle" fontSize="12">Probabilidad de éxito</text>
        <text x="100" y="75" textAnchor="middle" fontSize="24" fontWeight="bold">{pct(value)}%</text>
      </svg>
    </div>
  );
}

// ---------- Main App ----------
export default function App() {
  const [pitch, setPitch] = useState("");
  const [genres, setGenres] = useState([]);
  const [tone, setTone] = useState("");
  const [rating, setRating] = useState("PG-13");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState(null /** @type {ScoreResponse|null} */);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const options = {
      genres,
      tone: tone || undefined,
      rating,
      budget_hint_usd: budget ? Number(budget) : undefined,
    };
    const out = await mockScoreRequest(pitch.trim(), options);
    setRes(out);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-800">
      <header className="max-w-6xl mx-auto px-4 py-6">
        <h1 className="text-3xl md:text-4xl font-bold">🎬 PitchScore — Evaluador de ideas de película</h1>
        <p className="text-slate-600 mt-2">Escribe tu idea, obtén una probabilidad de éxito, fortalezas/debilidades y películas similares.</p>
      </header>

      <main className="max-w-6xl mx-auto px-4 pb-24 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Form */}
        <section className="lg:col-span-1 bg-white rounded-2xl shadow p-4 md:p-6 border border-slate-100">
          <h2 className="text-xl font-semibold mb-3">1) Describe tu idea</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="text-sm text-slate-600">Pitch / logline (2–5 párrafos)
              </span>
              <textarea
                className="mt-1 w-full h-40 rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Una científica crea una IA sensible que invita a un extraño experimento..."
                value={pitch}
                onChange={(e) => setPitch(e.target.value)}
                required
              />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-sm text-slate-600">Rating</span>
                <select className="mt-1 w-full rounded-xl border border-slate-200 p-2" value={rating} onChange={(e)=>setRating(e.target.value)}>
                  {RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <span className="text-sm text-slate-600">Tono (opcional)</span>
                <select className="mt-1 w-full rounded-xl border border-slate-200 p-2" value={tone} onChange={(e)=>setTone(e.target.value)}>
                  <option value="">—</option>
                  {TONES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <span className="text-sm text-slate-600">Género(s)</span>
              <div className="mt-2 flex flex-wrap gap-2">
                {GENRES.map(g => (
                  <button
                    type="button"
                    key={g}
                    onClick={() => setGenres(prev => prev.includes(g) ? prev.filter(x=>x!==g) : [...prev, g])}
                    className={classNames(
                      "px-3 py-1 rounded-full border text-sm",
                      genres.includes(g) ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-200 hover:border-slate-300"
                    )}
                  >{g}</button>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-1">Si no seleccionas, se intentará inferir a partir del texto.</p>
            </div>

            <label className="block">
              <span className="text-sm text-slate-600">Presupuesto objetivo (USD, opcional)</span>
              <input type="number" min={0} step={100000} className="mt-1 w-full rounded-xl border border-slate-200 p-2" placeholder="12000000" value={budget} onChange={(e)=>setBudget(e.target.value)} />
            </label>

            <button
              type="submit"
              disabled={!pitch.trim() || loading}
              className={classNames(
                "w-full py-3 rounded-xl font-semibold shadow transition",
                loading ? "bg-slate-300 text-slate-600" : "bg-slate-900 text-white hover:bg-slate-800"
              )}
            >{loading ? "Evaluando…" : "Evaluar"}</button>

            {res?.meta?.genreGuess && (
              <p className="text-xs text-slate-500">Género inferido: <strong>{res.meta.genreGuess.join(", ")}</strong></p>
            )}
          </form>
        </section>

        {/* Right column: Results */}
        <section className="lg:col-span-2 space-y-6">
          {/* Score Gauge */}
          <div className="bg-white rounded-2xl shadow p-4 md:p-6 border border-slate-100 min-h-[220px] flex items-center">
            {res ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full items-center">
                <div className="col-span-1">
                  <Gauge value={res.p_success} />
                </div>
                <div className="col-span-2">
                  <h3 className="text-xl font-semibold">Resultado</h3>
                  <p className="text-slate-600 mt-1">Tu idea se ubica en el <strong>percentil {pct(res.p_success)}</strong> de probabilidad estimada de éxito (demo). Toma esta cifra como orientación, no como garantía.</p>
                  <ul className="mt-3 text-sm list-disc pl-5 space-y-1 text-slate-700">
                    <li><strong>Fortalezas</strong>: {res.drivers.filter(d=>d.impact>0).slice(0,2).map(d=>d.feature).join(", ") || "—"}</li>
                    <li><strong>A mejorar</strong>: {res.drivers.filter(d=>d.impact<0).slice(0,2).map(d=>d.feature).join(", ") || "—"}</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="text-slate-500">Rellena el formulario y pulsa "Evaluar" para ver resultados.</div>
            )}
          </div>

          {/* Radar */}
          <div className="bg-white rounded-2xl shadow p-4 md:p-6 border border-slate-100">
            <h3 className="text-xl font-semibold mb-3">Perfil creativo</h3>
            <div className="w-full h-72">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={res ? [
                  { k: "Originalidad", v: res.radar.originality },
                  { k: "Claridad", v: res.radar.clarity },
                  { k: "Atractivo audiencia", v: res.radar.audience_appeal },
                  { k: "Viabilidad presupuesto", v: res.radar.budget_feasibility },
                  { k: "Riesgo producción (↓)", v: 1 - res.radar.production_risk },
                ] : []} outerRadius={110}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="k" tick={{ fontSize: 12 }} />
                  <PolarRadiusAxis angle={30} domain={[0,1]} tick={false} />
                  <Radar name="Score" dataKey="v" fillOpacity={0.3} />
                  <Tooltip formatter={(v)=>`${Math.round(v*100)}%`} labelFormatter={(l)=>l} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Drivers */}
          <div className="bg-white rounded-2xl shadow p-4 md:p-6 border border-slate-100">
            <h3 className="text-xl font-semibold mb-3">¿Qué impulsa tu score?</h3>
            <div className="w-full h-72">
              <ResponsiveContainer>
                <BarChart data={(res?.drivers || []).map(d=>({ name: d.feature, impact: d.impact }))}>
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis domain={[Math.min(-0.2, ...(res?.drivers||[]).map(d=>d.impact)), Math.max(0.2, ...(res?.drivers||[]).map(d=>d.impact))]} tickFormatter={(v)=>`${(v*100).toFixed(0)}%`} />
                  <Tooltip formatter={(v)=>`${(v*100).toFixed(1)}%`} />
                  <Bar dataKey="impact" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Nearest movies */}
          <div className="bg-white rounded-2xl shadow p-4 md:p-6 border border-slate-100">
            <h3 className="text-xl font-semibold mb-3">Películas similares</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-2 pr-4">Título</th>
                    <th className="py-2 pr-4">Año</th>
                    <th className="py-2 pr-4">Similitud</th>
                    <th className="py-2 pr-4">ROI</th>
                  </tr>
                </thead>
                <tbody>
                  {(res?.nearest_movies || []).map((m, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-2 pr-4 font-medium">{m.title}</td>
                      <td className="py-2 pr-4">{m.year}</td>
                      <td className="py-2 pr-4">{Math.round(m.similarity*100)}%</td>
                      <td className="py-2 pr-4">{m.roi ? `${m.roi.toFixed(1)}×` : "—"}</td>
                    </tr>
                  ))}
                  {!res && (
                    <tr><td colSpan={4} className="py-4 text-slate-500">Aún no hay resultados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <footer className="max-w-6xl mx-auto px-4 py-6 text-xs text-slate-500">
        Demo educativa: los valores son simulados. Sustituye el mock por tu modelo/endpoint real.
      </footer>
    </div>
  );
}
