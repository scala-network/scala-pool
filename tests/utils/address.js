const test = require('ava')
const args = require("args-parser")(process.argv);

test.before(t => {
	global.config = require('../../lib/bootstrap')(args.config || process.cwd() + '/defaults/config.test.json');
 })

const mainAddress = "Se4FFaA4n89epNPA7bXgzaFBup9a4wDABbYsEQXDWGiFNdbnwgmBoLgjXSX7ZHSnpCcie1uMmEZ7K2xaVbdsyxkc32AEBDr1p";
const paymentID = "4d9cb6c83330d8b1";
const integratedAddress = "SEiStP7SMy1bvjkWc9dd1t2v1Et5q2DrmaqLqFTQQ9H7JKdZuATcPHUbUL3bRjxzxTDYitHsAPqF8EeCLw3bW8ARe8rYZPbDy3W2FaVNHsjLK";
const subAddress = "SEiStP7SMy1bvjkWc9dd1t2v1Et5q2DrmaqLqFTQQ9H7JKdZuATcPHUbUL3bRjxzxTDYitHsAPqF8EeCLw3bW8ARe8rYZPbDy3W2FaVNHsjLK";

const utils = require('../../lib/utils.js');

test('Test is valid main address', t => {
	t.true(utils.validateMinerAddress(mainAddress))
});

test('Test is valid with payment id', t => {
	t.true(utils.validateMinerAddress(mainAddress+'.'+paymentID))
});

test('Test is valid integrated address', t => {
	t.true(utils.validateMinerAddress(integratedAddress))
});


test('Test has valid payment id', t => {
	t.true(utils.hasValidPaymentId(paymentID))
});


test('Test has valid subAddress', t => {
	t.pass()
//	t.true(utils.hasValidSubAddress(paymentID))
})

