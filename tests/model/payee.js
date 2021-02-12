const test = require('ava');
const Payee = require('../../lib/model/Payee');

const maxTransactionAmount = 3000

Payee.Config = {
    paymentIdAddressSeparator: ".",
    transferFee: 0.1,
    minerPayFee : true,
    dynamicTransferFee: true,
    maxTransactionAmount :maxTransactionAmount,
    maxAddresses: 3
}


test("Payee amount locked", t => {
    let payee = new Payee()
     payee.addDestination('wallet3000', 3000)
     t.true(payee.isLocked)
})

test('Payment Process', t => {
    let queue = []
    const payments = {
        wallet1 : 1000,
        wallet2 : 2000,
        wallet3 : 500,
        wallet4 : 6000
    }

    const wallets = Object.keys(payments)

	let payee = new Payee()
    for (let i=0;i<wallets.length;i++){
        const wallet = wallets[i]
        const payment = parseInt(payments[wallet])
        
        if(payee.isLocked) {
            queue.push(payee)
            payee = new Payee()
        }

        let forecast = payment + payee.amount
        const single = (forecast <= maxTransactionAmount)
        if(single) {
            payee.addDestination(wallet, payment)
        } else {
            let paymentBalance = payment
            while(forecast > maxTransactionAmount) {
                const stuff = maxTransactionAmount - payee.amount
                payee.addDestination(wallet, stuff)
                paymentBalance -= stuff
                forecast=paymentBalance
                if(payee.isLocked) {
                    queue.push(payee)
                    payee = new Payee()
                }
            }
            if(paymentBalance > 0) {
                payee.addDestination(wallet, paymentBalance)
            }
        }
    }

    if(payee.amount > 0 && !payee.isLocked) {
        queue.push(payee)
    }

    t.is(queue.length,4)


})


test('Payment Process With Payment ID', t => {
    let queue = []
    const payments = {
        wallet1 : 1000,
        wallet2 : 500,
        wallet3 : 6000,
        wallet4 : 2000,
        wallet5 : 1000,
        wallet6 : 500,
        wallet7 : 6000,
        wallet8 : 2000,
    }

    const wallets = Object.keys(payments)

    let payee = new Payee()
    for (let i=0;i<wallets.length;i++){
        const wallet = wallets[i]
        const payment = parseInt(payments[wallet])
        if('wallet2' === wallet || 'wallet7' === wallet) {
            const single = (payment <= maxTransactionAmount)

            if(single) {
                let pia = new Payee()
                pia.addDestination(wallet, payment)
                queue.push(pia)
            } else {
                let paymentBalance = payment

                while(paymentBalance > maxTransactionAmount) {
                    //1. We see how much we can stuff in
                    let pia = new Payee()
                    pia.addDestination(wallet, maxTransactionAmount)
                    queue.push(pia)
                    paymentBalance-=maxTransactionAmount
                }

                if(paymentBalance > 0) {
                    let pia = new Payee()
                    pia.addDestination(wallet, paymentBalance)
                    queue.push(pia)
                }
            }
            continue
        }
        if(payee.isLocked) {
            queue.push(payee)
            payee = new Payee()
        }

        let forecast = payment + payee.amount
        const single = (forecast <= maxTransactionAmount)
        if(single) {
            payee.addDestination(wallet, payment)
        } else {
            let paymentBalance = payment
            while(forecast > maxTransactionAmount) {
                const stuff = maxTransactionAmount - payee.amount
                payee.addDestination(wallet, stuff)
                paymentBalance -= stuff
                forecast=paymentBalance
                if(payee.isLocked) {
                    queue.push(payee)
                    payee = new Payee()
                }
            }
            if(paymentBalance > 0) {
                payee.addDestination(wallet, paymentBalance)
            }
        }
    }

    if(payee.amount > 0 && !payee.isLocked) {
        queue.push(payee)
    }
    // for(let x in queue) {
    //     console.log(queue[x].destinations, "XXXXX")
    // }
    // console.log(queue)
    let tt = 0
    for(let x in queue) {
        tt+=queue[x].amount
    }
    // console.log(queue)
    t.is(tt,19000)
    t.is(queue.length,8)


})


test('Payment Process With max address', t => {
    let queue = []
    const payments = {
        wallet1 : 100,
        wallet2 : 500,
        wallet3 : 200,
        wallet4 : 1202,
        wallet5 : 333,
        wallet6 : 500,
        wallet7 : 500,
        wallet8 : 556,
    }

    const wallets = Object.keys(payments)

    let payee = new Payee()
    for (let i=0;i<wallets.length;i++){
        const wallet = wallets[i]
        const payment = parseInt(payments[wallet])
        if('wallet2' === wallet || 'wallet7' === wallet) {
            const single = (payment <= maxTransactionAmount)

            if(single) {
                let pia = new Payee()
                pia.addDestination(wallet, payment)
                queue.push(pia)
            } else {
                let paymentBalance = payment

                while(paymentBalance > maxTransactionAmount) {
                    //1. We see how much we can stuff in
                    let pia = new Payee()
                    pia.addDestination(wallet, maxTransactionAmount)
                    queue.push(pia)
                    paymentBalance-=maxTransactionAmount
                }

                if(paymentBalance > 0) {
                    let pia = new Payee()
                    pia.addDestination(wallet, paymentBalance)
                    queue.push(pia)
                }
            }
            continue
        }
        if(payee.isLocked) {
            queue.push(payee)
            payee = new Payee()
        }

        let forecast = payment + payee.amount
        const single = (forecast <= maxTransactionAmount)
        if(single) {
            payee.addDestination(wallet, payment)
        } else {
            let paymentBalance = payment
            while(forecast > maxTransactionAmount) {
                const stuff = maxTransactionAmount - payee.amount
                payee.addDestination(wallet, stuff)
                paymentBalance -= stuff
                forecast=paymentBalance
                if(payee.isLocked) {
                    queue.push(payee)
                    payee = new Payee()
                }
            }
            if(paymentBalance > 0) {
                payee.addDestination(wallet, paymentBalance)
            }
        }
    }

    if(payee.amount > 0) {
        queue.push(payee)
    }

    let tt = 0
    for(let x in queue) {
        tt+=queue[x].amount
    }
    t.is(queue.length,4)
    t.is(tt,3891)


})