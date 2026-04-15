import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const contentType = "image/png";
export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: "linear-gradient(135deg, #0b0b0d 0%, #1c1c22 100%)",
          borderRadius: 96,
        }}
      >
        <div
          style={{
            fontSize: 300,
            fontWeight: 800,
            fontStyle: "italic",
            color: "#e5c27e",
            fontFamily: "Georgia, serif",
            letterSpacing: -10,
            lineHeight: 1,
            marginBottom: 8,
          }}
        >
          JN
        </div>
        <div
          style={{
            width: 336,
            height: 4,
            background: "#c9a35d",
            opacity: 0.5,
          }}
        />
        <div
          style={{
            marginTop: 18,
            fontSize: 32,
            color: "#c9a35d",
            fontFamily: "ui-monospace, monospace",
            letterSpacing: 12,
          }}
        >
          NEWS
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
