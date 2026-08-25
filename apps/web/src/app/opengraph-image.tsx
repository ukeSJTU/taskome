import { ImageResponse } from "next/og";

export const alt = "XDenovo — Protein design, made reproducible";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const gridLines = [96, 192, 288, 384, 480, 576] as const;

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#f7f9f1",
        color: "#0c2419",
        fontFamily: "Georgia, serif",
      }}
    >
      {gridLines.map((offset) => (
        <div
          key={offset}
          style={{
            position: "absolute",
            top: offset,
            right: 0,
            left: 0,
            display: "flex",
            height: 1,
            background: "#d8e1d7",
          }}
        />
      ))}

      <div
        style={{
          position: "absolute",
          top: 48,
          right: 56,
          left: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontFamily: "Arial, sans-serif",
          fontSize: 24,
          fontWeight: 700,
        }}
      >
        <span>XDenovo</span>
        <span style={{ fontSize: 15, letterSpacing: "0.18em", textTransform: "uppercase" }}>
          Taskome / Flagship 01
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          top: 158,
          left: 56,
          display: "flex",
          width: 720,
          flexDirection: "column",
        }}
      >
        <span
          style={{
            marginBottom: 24,
            fontFamily: "Arial, sans-serif",
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
          }}
        >
          AI-native biotech
        </span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 68,
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          <span>Protein design,</span>
          <span>made reproducible.</span>
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          right: 56,
          bottom: 42,
          display: "flex",
          width: 330,
          height: 400,
          overflow: "hidden",
          border: "1px solid #b8cbbd",
          background: "#ffffff",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 38,
            right: -42,
            display: "flex",
            width: 220,
            height: 220,
            border: "1px solid #b8cbbd",
            borderRadius: 9999,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 92,
            right: 80,
            display: "flex",
            width: 24,
            height: 205,
            transform: "rotate(34deg)",
            borderRadius: 9999,
            background: "#4da85e",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 62,
            bottom: 72,
            display: "flex",
            width: 225,
            height: 24,
            transform: "rotate(-18deg)",
            borderRadius: 9999,
            background: "#4da85e",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 105,
            right: 97,
            display: "flex",
            width: 20,
            height: 20,
            border: "4px solid #ffffff",
            borderRadius: 9999,
            background: "#d93c00",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: 252,
            bottom: 99,
            display: "flex",
            width: 20,
            height: 20,
            border: "4px solid #ffffff",
            borderRadius: 9999,
            background: "#d93c00",
          }}
        />
        <span
          style={{
            position: "absolute",
            right: 22,
            bottom: 18,
            display: "flex",
            fontFamily: "Arial, sans-serif",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Tool → Job → Attempt
        </span>
      </div>
    </div>,
    size,
  );
}
