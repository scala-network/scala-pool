const test = require('ava')
const args = require("args-parser")(process.argv);

test.before(t => {
	global.config = require('../../lib/bootstrap')(args.config || process.cwd() + '/defaults/config.test.json');
 })


const utils = require('../../lib/utils.js');

test('Test is not valid main address', t => {
	let mainAddress = "Se4FFaA4n89epNPA7bXgzaFBup9a4wDABbYsEQXDWGiFNdbnwgmBoLgjXSX7ZHSnpCcie1uMmEZ7K2xaVbdsyxkc32AEBDr1p";

	t.false(utils.validateMinerAddress(mainAddress))
});

test('Test is not valid with payment id', t => {
	let address = "Se4FFaA4n89epNPA7bXgzaFBup9a4wDABbYsEQXDWGiFNdbnwgmBoLgjXSX7ZHSnpCcie1uMmEZ7K2xaVbdsyxkc32AEBDr1p";
	address += ".4d9cb6c83330d8b1";

	t.false(utils.validateMinerAddress(address, '.'))
});

test('Test is not valid integrated address', t => {
	const integratedAddress = "SEiStP7SMy1bvjkWc9dd1t2v1Et5q2DrmaqLqFTQQ9H7JKdZuATcPHUbUL3bRjxzxTDYitHsAPqF8EeCLw3bW8ARe8rYZPbDy3W2FaVNHsjLK";

	t.false(utils.validateMinerAddress(integratedAddress))
});


test('Test has valid payment id', t => {
	let paymentID = "4d9cb6c83330d8b1";

	t.true(utils.hasValidPaymentId(paymentID))
});


test('Test is valid main address', t => {
	let mainAddress = "Svk1ZQ6mPfjhYR3Nnp3kifZLimjuDcmyMHecLmY6Ek2QbGQi93XzkJFbdFDaQZVdBF2V43q79z2UTirvJcHT3TnC2h988J2hF";

	t.is(utils.validateMinerAddress(mainAddress),1)
});

test('Test is valid with payment id', t => {
	let address = "Svk1ZQ6mPfjhYR3Nnp3kifZLimjuDcmyMHecLmY6Ek2QbGQi93XzkJFbdFDaQZVdBF2V43q79z2UTirvJcHT3TnC2h988J2hF";
	address += ".4d9cb6c83330d8b1";
	t.is(utils.validateMinerAddress(address, '.'),2)
});

test('Test is valid integrated address', t => {
	const integratedAddress = "Siz7JJJvBuDKZKjb3yn2ks5oxoXURrtHU8RdNKhaDVJoS4FVsJNuqrTMsoQKfUtepLHQ4R9cGjUCfPF3sDDSbpbK4eCJ4p3vXE22rMyRTk3wR";

	t.is(utils.validateMinerAddress(integratedAddress),3)
});

test('Test is valid sub address', t => {
	const subaddress = "Ssy2HXpWZ9RhXbb9uNFTeHjaYfexa3suDbGJDSfUWSEpSajSmjQXwLh2xqCAAUQfZrdiRkvpUZvBceT8d6zKc6aV9NaZVYXFsY";
	t.is(utils.validateMinerAddress(subaddress), 4)
});

/**
 * Using regex is much faster but the best validation is via address_prefix
 * At least we reject non acceptable address first faster and let in acceptable ones to be check via address_prefix
 *
 **/
test("Benchmark Address Validations", t => {
	const address = "Svk1ZQ6mPfjhYR3Nnp3kifZLimjuDcmyMHecLmY6Ek2QbGQi93XzkJFbdFDaQZVdBF2V43q79z2UTirvJcHT3TnC2h988J2hF";
	
	const r = new RegExp('^S+([1-9A-HJ-NP-Za-km-z]{96})$')
	let start = process.hrtime.bigint();
	for(let i =0;i<10000;i++) r.test(address)
	let end = process.hrtime.bigint();

    // console.log('Regex time taken ' + utils.readableSI(Number(end - start)," ", "nsecs", true));
	

	start = process.hrtime.bigint();
	for(let i =0;i<10000;i++) utils.getAddressPrefix(address) === 155
	end = process.hrtime.bigint();
    // console.log('Utils time taken ' + utils.readableSI(Number(end - start)," ", "nsecs", true));

	t.pass()
})

//not valid Siz7KzWmiNWSRTjZBAt5qqWC5PPYLVGvQdxfDPsyMXpUMkRuzwKNLEbfevN4Eoh76gTvxPeszEj5R7GmJMnkHDD8Ms7Peb4xquq1GrcSbe7rL
