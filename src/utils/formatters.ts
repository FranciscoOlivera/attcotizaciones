/**
 * Safe currency and number formatting to prevent any runtime TypeError: Cannot read properties of undefined (reading 'toLocaleString')
 */
export const formatCurrency = (val: unknown, decimals = 2): string => {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '0.00';
  }
  return Number(val).toLocaleString('es-MX', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatInt = (val: unknown): string => {
  if (val === null || val === undefined || isNaN(Number(val))) {
    return '0';
  }
  return Number(val).toLocaleString('es-MX', {
    maximumFractionDigits: 0,
  });
};
