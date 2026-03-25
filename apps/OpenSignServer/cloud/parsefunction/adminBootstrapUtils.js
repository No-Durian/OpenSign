const PLACEHOLDER_EMAIL_PATTERNS = [/@example\.com$/i, /@test\.com$/i, /^admin@localhost$/i];

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

export function isPlaceholderAdminEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return true;
  return PLACEHOLDER_EMAIL_PATTERNS.some(pattern => pattern.test(normalized));
}

export function isRealActiveAdmin(extUser) {
  if (!extUser || extUser.get('IsDisabled') === true) return false;
  if (extUser.get('UserRole') !== 'contracts_Admin') return false;

  const email = extUser.get('Email');
  if (isPlaceholderAdminEmail(email)) return false;

  return Boolean(extUser.get('OrganizationId'));
}
