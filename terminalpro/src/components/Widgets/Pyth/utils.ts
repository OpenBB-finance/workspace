export function formatNumber(
  value: number,
  options: Intl.NumberFormatOptions = {},
): string {
  const defaultOptions: Intl.NumberFormatOptions = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  return new Intl.NumberFormat("en-US", mergedOptions).format(value);
}

export function formatPrice(price: number): string {
  if (typeof price !== "number" || Number.isNaN(price)) {
    return "N/A";
  }

  if (price >= 1) {
    return formatNumber(price, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (price >= 0.01) {
    return formatNumber(price, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  }
  if (price >= 0.0001) {
    return formatNumber(price, { minimumFractionDigits: 6, maximumFractionDigits: 6 });
  }
  return formatNumber(price, { minimumFractionDigits: 8, maximumFractionDigits: 8 });
}
