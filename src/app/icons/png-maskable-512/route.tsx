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
          alignItems: "center",
          justifyContent: "center",
          backgroundImage: "linear-gradient(135deg, #0b0b0d 0%, #1c1c22 100%)",
        }}
      >
        <div
          style={{
            fontSize: 220,
            fontWeight: 800,
            fontStyle: "italic",
            color: "#e5c27e",
            fontFamily: "Georgia, serif",
            letterSpacing: -8,
            lineHeight: 1,
          }}
        >
          JN
        </div>
      </div>
    ),
    { width: 512, height: 512 },
  );
}
