export const GLOBAL_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Bebas+Neue&display=swap');
  * { box-sizing: border-box; }
  @keyframes slideInRight  { from { transform:translateX(100%); opacity:0; } to { transform:translateX(0); opacity:1; } }
  @keyframes slideInLeft   { from { transform:translateX(-40%); opacity:0; } to { transform:translateX(0); opacity:1; } }
  @keyframes fadeUp        { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes popIn         { 0% { transform:scale(.88); opacity:0; } 60% { transform:scale(1.04); } 100% { transform:scale(1); opacity:1; } }
  @keyframes potPulse      {
    0%   { box-shadow: 0 0 0px 0px rgba(123,47,255,0); }
    40%  { box-shadow: 0 0 40px 10px rgba(123,47,255,.5), 0 0 70px 24px rgba(255,45,120,.2); }
    100% { box-shadow: 0 0 12px 3px rgba(123,47,255,.18), 0 0 24px 8px rgba(255,45,120,.08); }
  }
  @keyframes glowGreen {
    0%   { box-shadow: 0 0 0px 0px rgba(74,222,128,0); }
    50%  { box-shadow: 0 0 40px 10px rgba(74,222,128,.3); }
    100% { box-shadow: 0 0 14px 3px rgba(74,222,128,.12); }
  }
  .slide-in-right { animation: slideInRight .28s cubic-bezier(.25,.46,.45,.94) both; }
  .slide-in-left  { animation: slideInLeft  .28s cubic-bezier(.25,.46,.45,.94) both; }
  .fade-up        { animation: fadeUp .4s ease-out both; }
  .pop-in         { animation: popIn .45s cubic-bezier(.34,1.56,.64,1) both; }
  .pot-pulse      { animation: potPulse 1.6s ease-out forwards; }
  .glow-green     { animation: glowGreen 1.2s ease-out both; }
  .event-card     { transition: transform .12s ease; }
  .event-card:hover  { transform: scale(1.005); }
  .event-card:active { transform: scale(0.99); }
  .cta-btn {
    width:100%; padding:18px; border:none; border-radius:16px;
    font-family:'Bebas Neue',sans-serif; font-size:22px; letter-spacing:2px;
    cursor:pointer; transition:transform .12s, opacity .12s;
    background:linear-gradient(135deg,#7B2FFF,#FF2D78); color:#fff;
  }
  .cta-btn:hover  { transform:scale(1.02); opacity:.92; }
  .cta-btn:active { transform:scale(0.97); }
  .cta-btn.disabled { background:#1a1a1a; color:#333; cursor:not-allowed; transform:none !important; opacity:1; }
  .field-input {
    width:100%; background:#111; border:1.5px solid #1e1e1e; border-radius:13px;
    padding:14px 16px; font-size:14px; font-weight:600;
    color:#F2F0FF; outline:none; font-family:'Inter',sans-serif;
    transition:border-color .15s; margin-bottom:0;
  }
  .field-input::placeholder { color:#2e2e2e; }
  .field-input:focus { border-color:#7B2FFF; }
  .field-input[type="date"]::-webkit-calendar-picker-indicator,
  .field-input[type="time"]::-webkit-calendar-picker-indicator { filter:invert(0.3); }
  ::-webkit-scrollbar { display:none; }
`;
