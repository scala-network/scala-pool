const test = require('ava')

const args = require("args-parser")(process.argv);

test.before(t => {
	global.config = require('../lib/bootstrap')(args.config || process.cwd() + '/defaults/config.test.json');

 })


test('Test is integer positive', t => {
  	const utils = require('../lib/utils.js');
  	t.true(utils.isInteger("123123123"));
});

test('Test is integer negative',t => {
	const utils = require('../lib/utils.js');
  t.true(utils.isInteger("-123123123"));
});

test('Test is integer zero', t => {
  const utils = require('../lib/utils.js');
  t.true(utils.isInteger("0"));
});

test('Test is not integer', t => {
	const utils = require('../lib/utils.js');
	t.false(utils.isInteger("123jhk12302"));
});

test('Test is not integer with decimal points',t => {
	const utils = require('../lib/utils.js');
	t.false(utils.isInteger("123.456"));
});

