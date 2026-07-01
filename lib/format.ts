export function formatDate(value: string | null | undefined) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

export function formatCurrency(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(value);
}

export function enumLabel(value: string | null | undefined) {
  if (!value) return '';
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function splitTags(value: FormDataEntryValue | null) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}
