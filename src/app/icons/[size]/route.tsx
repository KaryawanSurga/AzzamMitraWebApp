import { ImageResponse } from "next/og";

const markSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
  <g fill="none" stroke="#F6F4EE" stroke-width="13" stroke-linecap="butt" stroke-linejoin="round">
    <path d="M22 101 60 33 98 101"/>
    <path d="M41 79H79" stroke-width="11"/>
  </g>
  <path d="M60 46.5C66.82 48.66 71 64.05 71 62.16C71 69.72 66.6 73.5 60 73.5C53.4 73.5 49 69.72 49 62.16C49 64.05 53.18 48.66 60 46.5Z" fill="#D89B35"/>
</svg>`;

const markSource = `data:image/svg+xml;base64,${Buffer.from(markSvg).toString("base64")}`;
const sizes = ["192", "512", "maskable-512"] as const;

export function generateStaticParams() {
  return sizes.map((size) => ({ size }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (!(sizes as readonly string[]).includes(size)) return new Response("Not found", { status: 404 });
  const maskable = size.startsWith("maskable");
  const pixels = maskable ? 512 : Number(size);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#24462C",
          borderRadius: maskable ? 0 : Math.round(pixels * 0.18),
          padding: Math.round(pixels * (maskable ? 0.19 : 0.14)),
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markSource} width={pixels} height={pixels} alt="" style={{ width: "100%", height: "100%" }}/>
      </div>
    ),
    { width: pixels, height: pixels, headers: { "Cache-Control": "public, max-age=31536000, immutable" } },
  );
}
