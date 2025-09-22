"use client";

import { useState, useMemo } from "react";


 type Candidate = {
  text: string;
  tokens: number;
  avgLogProb: number; 
  relativeProb: number; 
  seed: number;
  variant: "primary" | "alt";
};

 type GenerateResponse = {
  candidates: Candidate[];
  meta: {
    model_id: string;
    usedK: number;
    dropped: number;
    params: {
      temperature: number;
      top_p: number;
      top_k: number;
      max_new_tokens: number;
      stop: string[];
    };
  };
};

function fmtLogProb(lp: number) {
  if (!Number.isFinite(lp)) return "n/a";
  return lp.toFixed(3);
}

export default function WatsonGraniteTestPage() {
  
  const [system, setSystem] = useState(
    "You are Talkable, a concise, supportive AAC assistant. Keep replies short, polite, and easy to speak aloud."
  );
  const [contextText, setContextText] = useState(
    "User prefers brief options.\n---\nThe app will speak the selected reply aloud."
  );
  const [prompt, setPrompt] = useState("Could you please repeat that more slowly?");
  const [k, setK] = useState(6);

  
  const [temperature, setTemperature] = useState(0.5);
  const [topP, setTopP] = useState(0.9);
  const [topK, setTopK] = useState(50);
  const [maxNewTokens, setMaxNewTokens] = useState(50);

  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<GenerateResponse | null>(null);

  const contextBlocks = useMemo(() =>
    splitContextBlocks(contextText)
  , [contextText]);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/granite/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system,
          context: contextBlocks,
          prompt,
          k,
          params: {
            temperature,
            top_p: topP,
            top_k: topK,
            max_new_tokens: maxNewTokens,
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const json = (await res.json()) as GenerateResponse;
      setData(json);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleCopy(t: string) {
    navigator.clipboard.writeText(t).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Watsonx Granite — Test Page</h1>
        <div className="text-sm text-gray-500">/api/granite/generate</div>
      </header>

      {}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="System Instructions">
          <textarea
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            className="w-full h-40 border rounded-md p-3 focus:outline-none focus:ring"
          />
          <p className="mt-2 text-xs text-gray-500">Used to steer tone, safety, and brevity.</p>
        </Card>

        <Card title="Context (blocks)">
          <textarea
            value={contextText}
            onChange={(e) => setContextText(e.target.value)}
            className="w-full h-40 border rounded-md p-3 focus:outline-none focus:ring"
          />
          <p className="mt-2 text-xs text-gray-500">Separate blocks with a blank line or a line containing just `---`.</p>
        </Card>

        <Card title="Prompt">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="w-full h-40 border rounded-md p-3 focus:outline-none focus:ring"
          />
          <div className="mt-3 flex items-center gap-3">
            <label className="text-sm">K (variants)</label>
            <input
              type="number"
              min={1}
              max={8}
              value={k}
              onChange={(e) => setK(clampInt(e.target.value, 1, 8))}
              className="w-20 border rounded-md p-2"
            />
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="ml-auto px-4 py-2 rounded-md bg-black text-white disabled:opacity-50"
            >
              {loading ? "Generating…" : "Generate"}
            </button>
          </div>
          {error && (
            <div className="mt-3 text-sm text-red-600">{error}</div>
          )}
        </Card>
      </section>

      {}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ParamCard label="Temperature" value={temperature} min={0} max={1} step={0.05}
          onChange={setTemperature} hint="0=deterministic, 0.5=variety" />
        <ParamCard label="top_p" value={topP} min={0.1} max={1} step={0.05}
          onChange={setTopP} hint="nucleus sampling" />
        <ParamCard label="top_k" value={topK} min={0} max={200} step={1}
          onNumberChange={setTopK} hint="0 means disabled" />
        <ParamCard label="max_new_tokens" value={maxNewTokens} min={10} max={200} step={5}
          onNumberChange={setMaxNewTokens} hint="cap reply length" />
      </section>

      {}
      {data && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Model: <span className="font-mono">{data.meta.model_id}</span> · Used K: {data.meta.usedK} · Dropped: {data.meta.dropped}
            </div>
            <div className="text-xs text-gray-500">Temp {data.meta.params.temperature} · top_p {data.meta.params.top_p} · top_k {data.meta.params.top_k} · max {data.meta.params.max_new_tokens}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.candidates.map((c, idx) => (
              <div key={idx} className="border rounded-xl p-4 shadow-sm bg-white">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs px-2 py-1 rounded-full border bg-gray-50">
                    {c.variant === "primary" ? "Primary" : "Alternative"}
                  </span>
                  <ConfidenceBar prob={c.relativeProb} />
                </div>

                <p className="mt-3 whitespace-pre-wrap leading-relaxed">{c.text}</p>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-600">
                  <Badge>tokens: {c.tokens}</Badge>
                  <Badge>avgLogProb: {fmtLogProb(c.avgLogProb)}</Badge>
                  <Badge>prob: {(c.relativeProb * 100).toFixed(1)}%</Badge>
                  <Badge>seed: {c.seed}</Badge>
                  <button
                    onClick={() => handleCopy(c.text)}
                    className="ml-auto px-2 py-1 border rounded-md hover:bg-gray-50"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!data && !loading && (
        <p className="text-sm text-gray-500">Fill in the prompt and click Generate to test.</p>
      )}
    </div>
  );
}


function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-4 shadow-sm bg-white">
      <h2 className="text-sm font-semibold text-gray-700">{title}</h2>
      <div className="mt-3 space-y-2">{children}</div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-1 rounded-full border bg-gray-50">{children}</span>
  );
}

function ConfidenceBar({ prob }: { prob: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(prob * 100)));
  return (
    <div className="w-40 h-2 rounded-full bg-gray-200 overflow-hidden" title={`~${pct}%`}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#22c55e,#16a34a)" }} />
    </div>
  );
}

function ParamCard({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onNumberChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange?: (v: number) => void;
  onNumberChange?: (v: number) => void;
  hint?: string;
}) {
  const isInteger = Number.isInteger(step) && Number.isInteger(min) && Number.isInteger(max);
  return (
    <div className="border rounded-xl p-4 shadow-sm bg-white">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{label}</h3>
        <span className="text-xs text-gray-600">{value}</span>
      </div>
      {onChange ? (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-full"
        />
      ) : (
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onNumberChange?.(parseFloat(e.target.value))}
          className="w-full border rounded-md p-2"
        />
      )}
      {hint && <p className="mt-2 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}


function splitContextBlocks(raw: string): string[] {
  
  const lines = raw.split(/\r?\n/);
  const blocks: string[] = [];
  let buf: string[] = [];
  const flush = () => {
    const t = buf.join(" ").trim();
    if (t) blocks.push(t);
    buf = [];
  };
  for (const line of lines) {
    if (!line.trim() || line.trim() === "---") {
      flush();
    } else {
      buf.push(line);
    }
  }
  flush();
  return blocks;
}

function clampInt(v: string | number, min: number, max: number) {
  const n = typeof v === "number" ? v : parseInt(v || "", 10);
  if (Number.isNaN(n)) return min;
  return Math.max(min, Math.min(max, n));
}
