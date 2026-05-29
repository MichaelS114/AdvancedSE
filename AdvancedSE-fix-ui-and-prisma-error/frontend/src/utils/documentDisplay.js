export const formatFileSize = (size) => {
  if (!size) return '0 KB';
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatDocumentDate = (value) => {
  if (!value) return '-';
  return new Intl.DateTimeFormat('de-AT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
};

export const documentTypeLabel = (mimeType) => {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType?.startsWith('image/')) return 'Bild';
  if (mimeType?.includes('word')) return 'Word';
  if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet')) return 'Excel';
  return 'Datei';
};
