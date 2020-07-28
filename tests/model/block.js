const test = require('ava');
const Blocks = require('../../lib/model/Blocks')

test('Test create block', t => {
	const val = {
	    hash: "SOMEHASH",
	    timestamp: Date.now() / 1000 | 0,
	    difficulty: 10,
	    shares: 9000,
	    donations: 1000,
	    miner: "SCALAV7WALLET",
	    poolType: "ppbrs",
	    height: 1
	}

	const block = new Blocks(val)
	t.plan(7)
	t.is(block.hash, val.hash)
	t.is(block.timestamp, val.timestamp)
	t.is(block.difficulty, val.difficulty)
	t.is(block.shares, val.shares)
	t.is(block.donations, val.donations)
	t.is(block.miner, val.miner)
	t.is(block.height, val.height)
})


test('Test from block toRedis', t => {
	const val = {
	    hash: "SOMEHASH",
	    timestamp: 1595688479,
	    difficulty: 10,
	    shares: 9000,
	    donations: 1000,
	    miner: "SCALAV7WALLET",
	    poolType: "ppbrs",
	    height: 1
	}

	const block = new Blocks(val)

	t.is(block.toRedis(), '1:SOMEHASH:1595688479:10:9000:1000:0:SCALAV7WALLET:ppbrs:0:0')
})

test('Test from string toRedis', t => {

	const block = new Blocks('1:SOMEHASH:1595688479:10:9000:1000:0:SCALAV7WALLET:ppbrs:0:0')

	t.is(block.toRedis(), '1:SOMEHASH:1595688479:10:9000:1000:0:SCALAV7WALLET:ppbrs:0:0')
})

test('Test from array toRedis', t => {

	const block = new Blocks('1:SOMEHASH:1595688479:10:9000:1000:0:SCALAV7WALLET:ppbrs:0:0'.split(':'))

	t.is(block.toRedis(), '1:SOMEHASH:1595688479:10:9000:1000:0:SCALAV7WALLET:ppbrs:0:0')
})


test('Actual tests', t => {
	const txt = '265:ed7b293be78e06d96561bd33308a1a23f3fc00ba263fb5361e4a28fef2b3c82d:1595706114:1000000:0:0:0:Svm53weUtA3djXbYuivzoWMjaen1RVgnacL8qRQTXnEt3ehjxomifH35sKjNAnvoJoby4epKw77FHX4Q4vkPFpkW1tKDLBvZZ:pps:0:0';
	const block = new Blocks(txt)
	t.is(block.height, '265');
	t.is(block.hash, 'ed7b293be78e06d96561bd33308a1a23f3fc00ba263fb5361e4a28fef2b3c82d');
	t.is(block.timestamp, '1595706114');
	t.is(block.difficulty, '1000000');
	t.is(block.shares, '0');
	t.is(block.donations, '0')
	t.is(block.reward, '0')
	t.is(block.miner, 'Svm53weUtA3djXbYuivzoWMjaen1RVgnacL8qRQTXnEt3ehjxomifH35sKjNAnvoJoby4epKw77FHX4Q4vkPFpkW1tKDLBvZZ')
	t.is(block.poolType, 'pps')
	t.is(block.orphaned, '0')
	t.is(block.unlocked, '0')
})
