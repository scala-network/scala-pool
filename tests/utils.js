require('../test.js');

const utils = required('/lib/utils.js');

const mainAddress = "Se4FFaA4n89epNPA7bXgzaFBup9a4wDABbYsEQXDWGiFNdbnwgmBoLgjXSX7ZHSnpCcie1uMmEZ7K2xaVbdsyxkc32AEBDr1p";
const paymentID = "4d9cb6c83330d8b1";
const integratedAddress = "SEiStP7SMy1bvjkWc9dd1t2v1Et5q2DrmaqLqFTQQ9H7JKdZuATcPHUbUL3bRjxzxTDYitHsAPqF8EeCLw3bW8ARe8rYZPbDy3W2FaVNHsjLK";


test('Test is valid main address', () => {
  expect(utils.validateMinerAddress(mainAddress)).toBe(true);
});

test('Test is valid with payment id', () => {
  expect(utils.validateMinerAddress(mainAddress+'.'+paymentID)).toBe(true);
});

test('Test is valid integrated address', () => {
  expect(utils.validateMinerAddress(integratedAddress)).toBe(true);
});


test('Test has valid payment id', () => {
  expect(utils.hasValidPaymentId(paymentID)).toBe(true);
});

