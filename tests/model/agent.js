
const test = require('ava');
const Agent = require('../../lib/model/Agent');


test('Test agent 1', t => {
	const sample_agent_string = "XLArig/5.2.2 (Macintosh; macOS; arm64) libuv/1.41.0 clang/12.0.5";
	const agent = new Agent(sample_agent_string);

	t.is(agent.name, "XLArig");
	t.is(agent.versionInt, 50202);
});

test('Test agent 2', t => {
	const sample_agent_string = "XLArig/5.2 (Macintosh; macOS; arm64) libuv/1.41.0 clang/12.0.5";
	const agent = new Agent(sample_agent_string);

	t.is(agent.name, "XLArig");
	t.is(agent.versionInt, 50200);
});

test('Test agent 3', t => {
	
	const sample_agent_string = "XLArig/5.2.3 (Linux x86_64) libuv/1.38.0 gcc/10.2.0";
	const agent = new Agent(sample_agent_string);

	t.is(agent.name, "XLArig");
	t.is(agent.versionInt, 50203);
})