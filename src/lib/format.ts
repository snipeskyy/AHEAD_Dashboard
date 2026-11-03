const compactCurrency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});
const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("en-US");
const pct = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 0 });

export const formatCurrencyCompact = (n: number) => compactCurrency.format(n);
export const formatCurrency = (n: number) => currency.format(n);
export const formatNumber = (n: number) => number.format(n);
export const formatPercent = (ratio: number) => pct.format(ratio);
