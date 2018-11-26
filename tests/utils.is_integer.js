require('../test.js');

const utils = required('/lib/utils.js');

test('Test is integer positive', () => {
  expect(utils.isInteger("123123123")).toBe(true);
});

test('Test is integer negative', () => {
  expect(utils.isInteger("-123123123")).toBe(true);
});

test('Test is integer zero', () => {
  expect(utils.isInteger("0")).toBe(true);
});

test('Test is not integer', () => {
  expect(utils.isInteger("123jhk12302")).toBe(false);
});

test('Test is not integer with decimal points', () => {
  expect(utils.isInteger("123.456")).toBe(false);
});

