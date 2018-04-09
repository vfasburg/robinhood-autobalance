var Promise = require('bluebird');
//var robinhood = Promise.promisifyAll(require('robinhood'));
var request = Promise.promisify(require('request'));
var _ = require('lodash');
var fs = require('fs');

var accounts = require(__dirname + '/accounts.json');
var portfolioPlans = require(__dirname + '/portfolios.json');


function calculateOrders(currentStocks, portfolioPlan, cash) {
  var portfolioStocks = _.pick(currentStocks, _.keys(portfolioPlan));
  var portfolioValue = 0;
  _.each(portfolioStocks, function(stock) {
    stock.value = stock.price * stock.shares;
    portfolioValue += stock.value;
  })
  var newPortfolioValue = portfolioValue + cash;
  _.each(portfolioStocks, function(stock, symbol) {
    stock.ideal_value = newPortfolioValue * portfolioPlan[symbol];
    stock.ideal_shares = stock.ideal_value / stock.price;
    stock.balanced_shares = Math.floor(stock.ideal_shares);
    stock.shares_to_buy = stock.balanced_shares - stock.shares;
  })
  console.log(portfolioStocks);
}


function login(username, password) {
  var retval = new Promise(function(resolve, reject) {
    var client = require('robinhood')({username: username, password: password}, function(){
      client.accounts(function(err, response, body){
        if(err) {
          reject(err);
        } else {
          resolve(Promise.promisifyAll(client));
        }
      })
    });
  });
  return retval;
}

function getAvailableCash(Robinhood) {
  return Robinhood.accountsAsync()
  .then(resp => {
    return resp.body.results[0].cash * 1;
  }, err => {
    console.log('Error getting account info');
    console.log(err);
  })
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

function start() {
  _.each(accounts, act => {
    var passwordClear = Buffer.from(act.password, 'base64').toString();
    login(act.username, passwordClear).then(Robinhood => {
      return Promise.all([getPortfolio(Robinhood), getAvailableCash(Robinhood)])
      .spread((portfolio, cash) => {
        var portfolioPlan = portfolioPlans[act.username];
        var orders = calculateOrders(portfolio, portfolioPlan, cash);
      })
    })
  })
}
start();
