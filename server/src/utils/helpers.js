import crypto from 'crypto';

export function successRes(data, message = 'ok') {
  return { code: 0, data, message };
}

export function errorRes(code, message) {
  return { code, message };
}

export function paginatedRes(items, total, page, limit) {
  return {
    code: 0,
    data: { items, total, page: Number(page), limit: Number(limit) },
    message: 'ok'
  };
}

export function nowStr() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).replace(' ', 'T');
}

export function todayStr() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });
}

export function uuid() {
  return crypto.randomUUID();
}

export function csvEscape(val) {
  if (val == null) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map(h => csvEscape(row[h])).join(','));
  }
  return lines.join('\n');
}

export function validateRequired(fields, body) {
  const missing = [];
  for (const f of fields) {
    if (body[f] == null || body[f] === '') missing.push(f);
  }
  return missing;
}
