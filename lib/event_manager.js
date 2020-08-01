'use strict'

let instance = null;
const nsync = require('async');
class EventManager 
{
	#_events = {}
	/*
	Example
	EventManager.series("helloWorld", (fn, next) => {
		fn(xxx,next)
	}, e=>{

	});
	*/
	series(eventName, funct, done)
	{
		
		done = done || function(e){}
		if(!(eventName in this.#_events) || this.#_events[eventName].length <= 0) {
			done();
			return;
		}

		nsync.eachSeries(this.#_events[eventName],(pushed, next) => {
			const fn = pushed.fn
			const options = pushed.options

			if (!options) {
				funct(fn,next)
			} else {
				const isWorkerType = !('workerType' in options) || options.workerType === process.env.workerType;
				const isWorkerID = !('forkId' in options) || parseInt(options.forkId) === parseInt(process.env.forkId);
				if(isWorkerType && isWorkerID) {
					funct(fn,next)
				} else {
					next();
				}
			}
				
		}, done);
	}

	parallel(eventName, funct, done)
	{

		done = done || function(e){}
		if(!(eventName in this.#_events) || this.#_events[eventName].length <= 0) {
			done();
			return;
		}

		nsync.each(this.#_events[eventName],(pushed, next) => {
			const fn = pushed.fn
			const options = pushed.options
			if (!options) {
				funct(fn,next)
			} else {
				const isWorkerType = !('workerType' in options) || options.workerType === process.env.workerType;
				const isWorkerID = !('forkId' in options) || parseInt(options.forkId) === parseInt(process.env.forkId);
				if(isWorkerType && isWorkerID) {
					funct(fn,next)
				} else {
					next();
				}
			}
		}, done);
	}

	register(eventName, options, fn) 
	{
		if(!(eventName in this.#_events)) {
			this.#_events[eventName] = []
		}

		if(!fn) {
			fn = options
			options = {}
		}

		this.#_events[eventName].push({fn,options})
		return this;
	}
}

module.exports = EventManager
