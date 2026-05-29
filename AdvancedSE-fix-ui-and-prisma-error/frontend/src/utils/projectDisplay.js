export const PROJECT_STATUSES = [
  { value: 'IN_PLANUNG', label: 'In Planung', color: 'default' },
  { value: 'BEAUFTRAGT', label: 'Beauftragt', color: 'blue' },
  { value: 'IN_UMSETZUNG', label: 'In Umsetzung', color: 'gold' },
  { value: 'ABGESCHLOSSEN', label: 'Abgeschlossen', color: 'green' },
  { value: 'STORNIERT', label: 'Storniert', color: 'red' }
];

export const statusMeta = PROJECT_STATUSES.reduce((acc, status) => {
  acc[status.value] = status;
  return acc;
}, {});

export const formatCurrency = (value) => {
  return new Intl.NumberFormat('de-AT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
};

export const formatDate = (value) => {
  if (!value) return 'Nicht gesetzt';
  return new Intl.DateTimeFormat('de-AT').format(new Date(value));
};
