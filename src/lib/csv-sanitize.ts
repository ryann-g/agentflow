/**
 * CSV injection (formula injection) defense, shared by the client import
 * page and the server /api/leads/import route.
 *
 * Spreadsheet applications (Excel, Sheets, Numbers) interpret cells whose
 * value begins with = + - @ TAB or CR as formulas. Lead data imported from
 * arbitrary CSVs is attacker-controlled input; if a crafted payload like
 * `=HYPERLINK(...)` or `=cmd|'/c calc'!A1` is stored and later exported,
 * opening the export in a spreadsheet executes it in the victim's context.
 *
 * Defense: prefix any risky leading character with a single quote — the
 * standard neutralization recognized by all major spreadsheet apps.
 */

const FORMULA_PREFIX_PATTERN = /^[=+\-@\t\r]/;

export function sanitizeCsvValue(value: string): string {
  if (!value) return value;
  if (FORMULA_PREFIX_PATTERN.test(value)) {
    return "'" + value;
  }
  return value;
}

/**
 * Detects binary content masquerading as CSV (e.g., .xlsx renamed to .csv).
 * Null bytes never occur in legitimate text CSVs.
 */
export function isBinaryContent(text: string): boolean {
  const nullCount = (text.match(/\0/g) || []).length;
  return nullCount > 0 || (text.length > 0 && nullCount / text.length > 0.01);
}
