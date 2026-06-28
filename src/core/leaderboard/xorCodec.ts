const PRIME = 1373;

const FIELD_ORDER = [
  'checksum',
  'board_id',
  'time_ms',
  'nick',
  'score',
  'date',
  'version',
] as const;

type FieldName = (typeof FIELD_ORDER)[number];

const FIXED_LENGTH: Partial<Record<FieldName, number>> = {
  time_ms: 4,
  score: 4,
  date: 4,
  version: 4,
};

export interface XorPayload {
  checksum: string;
  board_id: string;
  time_ms: number;
  nick: string;
  score: number;
  date: number;
  version: number;
}

export function encodeXorPayload(fields: XorPayload): string {
  const date = Math.floor(fields.date);
  const key = cryptKey(date);
  const encrypted: Record<FieldName, string> = {} as Record<FieldName, string>;

  for (const name of FIELD_ORDER) {
    if (name === 'date') {
      encrypted[name] = intToStr(date);
      continue;
    }
    const plain = fieldToStr(name, fields[name]);
    encrypted[name] = xorStr(plain, key);
  }
  return packHex(encrypted);
}

function fieldToStr(name: FieldName, value: string | number): string {
  if (name in FIXED_LENGTH) return intToStr(Number(value));
  return String(value);
}

function packHex(encrypted: Record<FieldName, string>): string {
  let out = '';
  for (const name of FIELD_ORDER) {
    const bin = encrypted[name];
    if (!(name in FIXED_LENGTH)) {
      out += bin.length.toString(16).padStart(2, '0').toUpperCase();
    }
    out += strToHex(bin);
  }
  return out;
}

function cryptKey(date: number): string {
  let key = '';
  for (let i = 3; i >= 0; i--) {
    let val = (date >> (8 * i)) & 0xff;
    if (val === 0) val = 1;
    key += String.fromCharCode((val * PRIME) % 256);
  }
  return key;
}

function xorStr(input: string, key: string): string {
  if (!key) return input;
  let out = '';
  for (let i = 0; i < input.length; i++) {
    out += String.fromCharCode(input.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return out;
}

function strToHex(str: string): string {
  let hex = '';
  for (let i = 0; i < str.length; i++) {
    hex += str.charCodeAt(i).toString(16).padStart(2, '0').toUpperCase();
  }
  return hex;
}

function intToStr(int: number): string {
  if (int <= 0) return '\0\0\0\0';
  const bytes: number[] = [];
  let n = Math.floor(int);
  while (n > 0) {
    bytes.unshift(n & 0xff);
    n >>= 8;
  }
  while (bytes.length < 4) bytes.unshift(0);
  return String.fromCharCode(...bytes);
}
