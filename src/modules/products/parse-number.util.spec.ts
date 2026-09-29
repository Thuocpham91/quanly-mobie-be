import { parseNumber } from './parse-number.util';

describe('parseNumber', () => {
  it.each([
    [null, 0],
    ['', 0],
    [25000, 25000],
    ['25.000', 25000],
    ['25,000', 25000],
    ['25.000,50', 25000.5],
    ['25,000.50', 25000.5],
    ['1.25', 1.25],
    ['invalid', 0],
  ])('parses %p as %p', (value, expected) => {
    expect(parseNumber(value)).toBe(expected);
  });
});