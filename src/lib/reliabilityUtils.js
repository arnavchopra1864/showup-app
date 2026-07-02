export function safeRate(showed, total) {
  if (!total) return null;
  return Math.round((showed / total) * 100);
}

export function rateProps(rate) {
  if (rate === null) return { label: null, color: "#555" };
  if (rate >= 90)   return { label: "rarely misses",      color: "#4ade80" };
  if (rate >= 75)   return { label: "usually shows",      color: "#a3e635" };
  if (rate >= 60)   return { label: "hit or miss",        color: "#facc15" };
  return                   { label: "known to disappear", color: "#FF2D78" };
}
