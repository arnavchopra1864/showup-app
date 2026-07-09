import { useEffect, useRef, useState } from "react";

// In-browser QR scanner. Prefers the native BarcodeDetector API (Android
// Chrome); falls back to the lazily-imported `jsqr` package elsewhere (iOS
// Safari has no BarcodeDetector). Loaded via dynamic import() from
// CheckinScreen so neither this code nor jsqr ships until the guest taps
// "open camera". Camera tracks are always stopped on unmount — never left on.
//
// `onDecode(rawValue)` runs on every decode: return a short string to show as
// a transient hint and keep scanning (e.g. "that's not a showup code"), or
// return nothing/undefined when the value was consumed (the parent should then
// unmount this component, which stops the camera).
export default function QrScanner({ onDecode, onClose }) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | scanning | denied | nocam | error
  const [hint,   setHint]   = useState("");

  useEffect(() => {
    let cancelled = false;
    let stream    = null;
    let detector  = null;
    let scanning  = false; // guards overlapping async detect() calls
    let hintTimer = null;
    const interval = { id: null };

    const stopAll = () => {
      clearInterval(interval.id);
      clearTimeout(hintTimer);
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = null;
    };

    const flashHint = (msg) => {
      setHint(msg);
      clearTimeout(hintTimer);
      hintTimer = setTimeout(() => setHint(""), 1800);
    };

    const consume = (raw) => {
      if (!raw || cancelled) return;
      const msg = onDecode(raw);
      if (msg) flashHint(msg); // invalid — keep scanning
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus("nocam"); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (cancelled) { stopAll(); return; }
        const video = videoRef.current;
        if (!video) { stopAll(); return; }
        video.srcObject = stream;
        video.setAttribute("playsinline", "true");
        await video.play().catch(() => {});
        setStatus("scanning");

        if ("BarcodeDetector" in window) {
          try { detector = new window.BarcodeDetector({ formats: ["qr_code"] }); }
          catch { detector = null; }
        }

        let jsQR = null;
        if (!detector) jsQR = (await import("jsqr")).default;
        if (cancelled) { stopAll(); return; }

        const ctx = canvasRef.current?.getContext("2d", { willReadFrequently: true });

        interval.id = setInterval(async () => {
          if (cancelled || scanning) return;
          const v = videoRef.current;
          if (!v || v.readyState < 2 || !v.videoWidth) return;
          if (detector) {
            scanning = true;
            try { const codes = await detector.detect(v); if (codes?.length) consume(codes[0].rawValue); }
            catch {}
            scanning = false;
          } else if (jsQR && ctx) {
            const w = v.videoWidth, h = v.videoHeight;
            const cv = canvasRef.current;
            cv.width = w; cv.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
            if (code?.data) consume(code.data);
          }
        }, 200);
      } catch (e) {
        if (e?.name === "NotAllowedError" || e?.name === "SecurityError") setStatus("denied");
        else if (e?.name === "NotFoundError" || e?.name === "OverconstrainedError") setStatus("nocam");
        else setStatus("error");
      }
    })();

    return () => { cancelled = true; stopAll(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const errorCopy = status === "denied"
    ? "camera access was blocked — allow it in your browser settings, or scan the host's qr with your phone's camera app instead"
    : status === "nocam"
      ? "no camera found here — open this link on your phone and scan the host's qr with its camera app"
      : status === "error"
        ? "couldn't start the camera — try your phone's camera app on the host's qr instead"
        : "";

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ position: "relative", borderRadius: 20, overflow: "hidden", aspectRatio: "1", background: "#0a0a0f", border: "1.5px solid #7B2FFF", boxShadow: "0 0 40px rgba(123,47,255,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <video ref={videoRef} muted playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: errorCopy ? "none" : "block" }} />
        <canvas ref={canvasRef} style={{ display: "none" }} />

        {errorCopy ? (
          <div style={{ padding: "28px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🚫</div>
            <div style={{ fontSize: 13, color: "#F2F0FF", lineHeight: 1.5 }}>{errorCopy}</div>
          </div>
        ) : (
          <>
            {/* corner brackets */}
            {[
              { top: "16%", left: "16%", borderTop: "3px solid #FF2D78", borderLeft: "3px solid #FF2D78" },
              { top: "16%", right: "16%", borderTop: "3px solid #FF2D78", borderRight: "3px solid #FF2D78" },
              { bottom: "16%", left: "16%", borderBottom: "3px solid #FF2D78", borderLeft: "3px solid #FF2D78" },
              { bottom: "16%", right: "16%", borderBottom: "3px solid #FF2D78", borderRight: "3px solid #FF2D78" },
            ].map((s, i) => <div key={i} style={{ position: "absolute", width: 30, height: 30, borderRadius: 3, ...s }} />)}
            <div style={{ position: "absolute", top: 12, left: 0, right: 0, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#F2F0FF", textShadow: "0 1px 6px rgba(0,0,0,.8)" }}>
              {status === "starting" ? "starting camera…" : "point at the host's qr"}
            </div>
            {hint && (
              <div className="fade-up" style={{ position: "absolute", bottom: 14, left: 14, right: 14, textAlign: "center", background: "rgba(255,45,120,.9)", borderRadius: 12, padding: "8px 12px", fontSize: 12, fontWeight: 700, color: "#fff" }}>{hint}</div>
            )}
          </>
        )}
      </div>
      <button
        onClick={onClose}
        style={{ width: "100%", marginTop: 12, padding: "12px 0", borderRadius: 14, background: "rgba(255,45,120,.08)", border: "1.5px solid rgba(255,45,120,.3)", color: "#ff6b9d", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
      >
        cancel
      </button>
    </div>
  );
}
