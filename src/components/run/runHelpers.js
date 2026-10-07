export const num = (v, d = 0) => {
  const n = Number(v);
  return v == null || v === "" || Number.isNaN(n) ? d : n;
};