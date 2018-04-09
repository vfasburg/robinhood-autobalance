var Promise = require('bluebird');
//var robinhood = Promise.promisifyAll(require('robinhood'));
var request = Promise.promisify(require('request'));
var _ = require('lodash');
var fs = require('fs');

var accounts = require(__dirname + '/accounts.json');
var plans = require(__dirname + '/portfolios.json');


function calculateOrders(Robinhood, portfolio) {
  return null;
}


function login() {
  var username = accounts[0].username;
  var passwordB64 = accounts[0].password;
  var passwordClear = Buffer.from(passwordB64, 'base64').toString();
  var retval = new Promise(function(resolve, reject) {
    var client = require('robinhood')({username: username, password: passwordClear}, function(){
      client.accounts(function(err, response, body){
        if(err){
          reject(err);
        }else{
          resolve(Promise.promisifyAll(client));
        }
      })
    });
  });
  return retval;
}

function getPortfolio(Robinhood) {
  return Robinhood.nonzero_positionsAsync()
  .then(function(res) {
    var securities = (res.body || {}).results || [];
    var myInstruments = {};
    return Promise.map(securities, function(sec) {
      return request(sec.instrument)
      .then(inst => {
        var inst = JSON.parse(inst.body);
        myInstruments[inst.symbol] = {
          shares: sec.quantity
        }
        return request(inst.quote)
        .then(qte => {
          qte = JSON.parse(qte.body);
          myInstruments[inst.symbol].price = qte.last_trade_price;
        })
      })
    })
    .then(function() {
      return myInstruments;
    })
  }, err => {
    console.log('Error: failed to get security info')
    console.log(err);
  })
}

login()
.then(getPortfolio)
.then(portfolio => {
  console.log(portfolio);
})
