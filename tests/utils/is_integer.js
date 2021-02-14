const test = require('ava')

const args = require("args-parser")(process.argv);
const utils = require('../../lib/utils.js');

test.before(t => {
	// global.config = require('../../lib/bootstrap')(args.config || process.cwd() + '/defaults/config.test.json');

 })

test('Test is integer positive', t => {
  	t.true(utils.isInteger("123123123"));
});

test('Test is integer negative',t => {
  t.true(utils.isInteger("-123123123"));
});

test('Test is integer zero', t => {
  t.true(utils.isInteger("0"));
});

test('Test is not integer', t => {
	t.false(utils.isInteger("123jhk12302"));
});

test('Test is not integer with decimal points',t => {
	t.false(utils.isInteger("123.456"));
});

