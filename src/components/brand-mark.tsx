/*
  Mark Azzam Mitra sebagai komponen. Huruf A dibentuk sebagai peti, telur Amber
  duduk di dalamnya. Dekoratif: selalu dipakai berdampingan dengan wordmark.
  Sumber geometri: brand/logo/azzam-mitra-mark.svg.
*/
export function BrandMark({ size = 28, tone = "dark" }: { size?: number; tone?: "dark" | "light" }) {
  const ink = tone === "light" ? "#F6F4EE" : "#24462C";
  // Di bawah 40 px garis dinaikkan agar mark tetap terbaca, mengikuti varian favicon.
  const base = size < 40 ? 16 : 13;
  const bar = size < 40 ? 14 : 11;
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" focusable="false">
      <g fill="none" stroke={ink} strokeWidth={base} strokeLinecap="butt" strokeLinejoin="round">
        <path d="M22 101 60 33 98 101" />
        <path d="M41 79H79" strokeWidth={bar} />
      </g>
      <path d="M60 46.5C66.82 48.66 71 64.05 71 62.16C71 69.72 66.6 73.5 60 73.5C53.4 73.5 49 69.72 49 62.16C49 64.05 53.18 48.66 60 46.5Z" fill="#D89B35" />
    </svg>
  );
}
