/** Tiny server-rendered SVG charts — no chart library shipped to the browser. */

export function BarChart({ data, label, height = 160 }: { data: { date: string; value: number }[]; label: string; height?: number }) {
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted">No verified outcomes yet.</p>;
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  const ticks = [0, Math.ceil(max / 2), max];
  return (
    <figure>
      <div className="flex gap-2">
        <div className="tnum flex flex-col-reverse justify-between py-0.5 text-right text-[10px] text-muted" style={{ height }}>
          {ticks.map((t) => <span key={t}>{t}</span>)}
        </div>
        <svg role="img" aria-label={label} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
          {ticks.map((t) => (
            <line key={t} x1="0" x2="100" y1={height - (t / max) * (height - 4)} y2={height - (t / max) * (height - 4)} stroke="#eef0f3" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) => {
            const h = (d.value / max) * (height - 4);
            return (
              <rect key={d.date} x={i * w + w * 0.18} width={w * 0.64} y={height - h} height={h} rx="1" fill="var(--color-accent)">
                <title>{`${d.date}: ${d.value}`}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-1 flex justify-between pl-6 text-[10px] text-muted">
        <span>{data[0]!.date.slice(5)}</span>
        <span>{data[data.length - 1]!.date.slice(5)}</span>
      </figcaption>
    </figure>
  );
}
