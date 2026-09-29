export const normalizeHeader = (value: unknown): string =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/%/g, 'percent')
    .replace(/[^a-z0-9]/g, '');

export const findValue = (
  row: Record<string, unknown>,
  keys: string[],
): string => {
  const headers = Object.keys(row);
  const normalizedKeys = keys.map(normalizeHeader);
  const exactKey = headers.find((header) =>
    normalizedKeys.includes(normalizeHeader(header)),
  );
  const foundKey = exactKey || headers.find((header) => {
    const normalizedHeader = normalizeHeader(header);
    return normalizedKeys.some(
      (searchKey) => searchKey.length >= 4 && normalizedHeader.includes(searchKey),
    );
  });
  return foundKey ? String(row[foundKey] ?? '').trim() : '';
};