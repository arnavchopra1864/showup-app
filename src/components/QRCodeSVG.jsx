import { QRCodeSVG as QR } from "qrcode.react";

export function QRCodeSVG({ value, size = 192 }) {
  return (
    <QR
      value={value || " "}
      size={size}
      bgColor="#F2F0FF"
      fgColor="#0D0D0D"
      level="M"
      style={{ borderRadius: 8, display: "block" }}
    />
  );
}
