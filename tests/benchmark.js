const test = require('ava')
const utils = require('../lib/utils.js');



/*
* After 5 tests we found that using bitwise as of normal == by average is faster
⠹ Using compare 483.20 µsecs
⠸ Using bitwise 492.27 µsecs

⠹ Using compare 386.91 µsecs
⠸ Using bitwise 380.50 µsecs

⠹ Using compare 385.61 µsecs
⠸ Using bitwise 381.86 µsecs

⠹ Using compare 418.61 µsecs
⠸ Using bitwise 384.35 µsecs

⠹ Using compare 393.86 µsecs
⠸ Using bitwise 387.05 µsecs

⠹ Using compare 404.95 µsecs
⠸ Using bitwise 381.42 µsecs

*/

test("Array indexof speed test", t=>{
	const aa = ['a','b','c']
	let start = process.hrtime.bigint();
	for(let i =0;i<10000;i++) {
		if(aa.indexOf('a') !== -1) {
			continue
		}
	}
	let end = process.hrtime.bigint();
    console.log('Using compare ' + utils.readableSI(Number(end - start)," ", "nsecs", true));
	start = process.hrtime.bigint();
	for(let i =0;i<10000;i++) {
		if(!!~aa.indexOf('a')) {
			continue
		}
	}
	end = process.hrtime.bigint();
    console.log('Using bitwise ' + utils.readableSI(Number(end - start)," ", "nsecs", true));
	

    t.pass()

})