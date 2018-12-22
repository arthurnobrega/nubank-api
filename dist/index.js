'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.REQUEST_HEADERS_SAUCE = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = function () {
  var _desc, _value, _obj, _init, _init2, _init3, _init4, _init5, _init6;

  var signInData = {};
  var validated = false;
  var validationData = false;

  function withSignedInUser(fn) {
    return function () {
      if ((0, _lodash.isEmpty)(signInData)) {
        throw new Error('[NuBank] You must sign in first');
      }

      return fn.apply(undefined, arguments);
    };
  }

  function handleErrors(response) {
    if (!response.ok) {
      throw Error(response.statusText);
    }
    return response;
  }

  var validateToken = async function validateToken() {
    return (0, _nodeFetch2.default)(_api_uris2.default.tokenValidation, {
      body: JSON.stringify(validationData),
      method: 'POST',
      headers: _extends({}, REQUEST_HEADERS_SAUCE, {
        Authorization: 'Bearer ' + signInData.access_token
      })
    }).then(handleErrors).then(function (res) {
      return res.json();
    }).catch(function () {
      return false;
    });
  };

  return _obj = {
    setLoginToken: function setLoginToken(token) {
      signInData = token;
      validated = true;
    },
    getLoginToken: async function getLoginToken(_ref) {
      var password = _ref.password,
          login = _ref.login;

      var response = await (0, _nodeFetch2.default)(_api_uris2.default.token, {
        body: JSON.stringify({
          password: password,
          login: login,
          grant_type: 'password',
          client_id: 'other.conta',
          client_secret: 'yQPeLzoHuJzlMMSAjC-LgNUJdUecx8XO'
        }),
        method: 'POST',
        headers: _extends({}, REQUEST_HEADERS_SAUCE)
      });

      signInData = await response.json();
      if ('_links' in signInData && 'events' in signInData._links) {
        validated = true;
        return signInData;
      }

      // QRCODE
      // start puppeteer
      var browser = await _puppeteer2.default.launch({ headless: false, slowMo: 1 });
      var page = await browser.newPage();

      // setup XHR snifer
      await page.setRequestInterception(true);
      page.on('request', function (request) {
        if (request.url() === _api_uris2.default.tokenValidation && request.method() === 'POST') {
          validationData = request.postData();
        }
        request.continue();
      });

      // page.setViewport({ width: 1440, height: 900 })
      // login
      await page.goto(_api_uris2.default.webLogin);
      await page.type('input#username', login);
      await page.type('input#input_001', password);
      await page.$eval('button[type=submit]', function (el) {
        el.click();
      });

      // await qrcode to appear and copy image
      await page.waitForSelector('div.qr-code img');
      var image = await page.$('div.qr-code');
      console.log('###################');
      console.log('IMAGE');
      console.log('###################');
      var imgBuffer = await image.screenshot();
      console.log((await _terminalImage2.default.buffer(imgBuffer)));

      // wait until discovers validationData
      var sleep = function sleep(ms) {
        return new Promise(function (resolve) {
          return setTimeout(resolve, ms);
        });
      };
      var limit = 120;
      while (limit > 0 && !validationData) {
        limit--;
        await sleep(500);
      }

      if (!validationData) {
        return { error: 'COULDNT GET VALIDATION DATA' };
      }

      await browser.close();

      // ensure tokens validation
      console.log('###################');
      console.log('token validation');
      console.log('###################');
      limit = 10;
      while (limit > 0 && !validated) {
        console.log('###################');
        var data = await validateToken;
        console.log(data);
        // if (data) {
        //   signInData = data
        //   validated = true
        // }
        limit--;
        await sleep(1000);
        console.log(limit);
        console.log('###################');
      }

      if (!validated) {
        return { error: 'QRCODE NOT VALIDATED' };
      }

      return signInData;
    },

    getCustomer: function getCustomer() {
      return (0, _nodeFetch2.default)(_api_uris2.default.customers, {
        headers: _extends({}, REQUEST_HEADERS_SAUCE, {
          Authorization: 'Bearer ' + signInData.access_token
        })
      }).then(function (res) {
        return res.json();
      });
    },

    getCustomerAccount: function getCustomerAccount() {
      return (0, _nodeFetch2.default)(signInData._links.account.href, {
        headers: _extends({}, REQUEST_HEADERS_SAUCE, {
          Authorization: 'Bearer ' + signInData.access_token
        })
      }).then(function (res) {
        return res.json();
      });
    },

    getWholeFeed: function getWholeFeed() {
      return (0, _nodeFetch2.default)(signInData._links.events.href, {
        headers: _extends({}, REQUEST_HEADERS_SAUCE, {
          Authorization: 'Bearer ' + signInData.access_token
        })
      }).then(function (res) {
        return res.json();
      });
    },

    getBillByMonth: function getBillByMonth(monthFilter) {
      return (0, _nodeFetch2.default)(signInData._links.bills_summary.href, {
        headers: _extends({}, REQUEST_HEADERS_SAUCE, {
          Authorization: 'Bearer ' + signInData.access_token
        })
      }).then(function (res) {
        return res.json();
      }).then(function (json) {
        var theBill = json.bills.find(function (bill) {
          return bill.summary.open_date.indexOf(monthFilter) !== -1;
        });

        return (0, _nodeFetch2.default)(theBill._links.self.href, {
          headers: _extends({}, REQUEST_HEADERS_SAUCE, {
            Authorization: 'Bearer ' + signInData.access_token
          })
        });
      }).then(function (res) {
        return res.json();
      });
    },

    getCheckingBalance: function getCheckingBalance() {
      var graphql = _fs2.default.readFileSync(_path2.default.join(__dirname, 'queries', 'account_balance.gql'), 'utf8');

      return (0, _nodeFetch2.default)(signInData._links.ghostflame.href, {
        method: 'POST',
        headers: _extends({}, REQUEST_HEADERS_SAUCE, {
          Authorization: 'Bearer ' + signInData.access_token
        }),
        body: JSON.stringify({ query: graphql })
      }).then(function (res) {
        return res.json();
      });
    },

    getCheckingTransactions: function getCheckingTransactions() {
      var graphql = _fs2.default.readFileSync(_path2.default.join(__dirname, 'queries', 'account_feed.gql'), 'utf8');

      return (0, _nodeFetch2.default)(signInData._links.ghostflame.href, {
        method: 'POST',
        headers: _extends({}, REQUEST_HEADERS_SAUCE, {
          Authorization: 'Bearer ' + signInData.access_token
        }),
        body: JSON.stringify({ query: graphql })
      }).then(function (res) {
        return res.json();
      });
    },

    get signInData() {
      return signInData;
    }
  }, (_applyDecoratedDescriptor(_obj, 'getCustomer', [withSignedInUser], (_init = Object.getOwnPropertyDescriptor(_obj, 'getCustomer'), _init = _init ? _init.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, 'getCustomerAccount', [withSignedInUser], (_init2 = Object.getOwnPropertyDescriptor(_obj, 'getCustomerAccount'), _init2 = _init2 ? _init2.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init2;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, 'getWholeFeed', [withSignedInUser], (_init3 = Object.getOwnPropertyDescriptor(_obj, 'getWholeFeed'), _init3 = _init3 ? _init3.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init3;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, 'getBillByMonth', [withSignedInUser], (_init4 = Object.getOwnPropertyDescriptor(_obj, 'getBillByMonth'), _init4 = _init4 ? _init4.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init4;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, 'getCheckingBalance', [withSignedInUser], (_init5 = Object.getOwnPropertyDescriptor(_obj, 'getCheckingBalance'), _init5 = _init5 ? _init5.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init5;
    }
  }), _obj), _applyDecoratedDescriptor(_obj, 'getCheckingTransactions', [withSignedInUser], (_init6 = Object.getOwnPropertyDescriptor(_obj, 'getCheckingTransactions'), _init6 = _init6 ? _init6.value : undefined, {
    enumerable: true,
    configurable: true,
    writable: true,
    initializer: function initializer() {
      return _init6;
    }
  }), _obj)), _obj;
};

var _nodeFetch = require('node-fetch');

var _nodeFetch2 = _interopRequireDefault(_nodeFetch);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _lodash = require('lodash');

var _puppeteer = require('puppeteer');

var _puppeteer2 = _interopRequireDefault(_puppeteer);

var _terminalImage = require('terminal-image');

var _terminalImage2 = _interopRequireDefault(_terminalImage);

var _api_uris = require('./api_uris');

var _api_uris2 = _interopRequireDefault(_api_uris);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
  var desc = {};
  Object['ke' + 'ys'](descriptor).forEach(function (key) {
    desc[key] = descriptor[key];
  });
  desc.enumerable = !!desc.enumerable;
  desc.configurable = !!desc.configurable;

  if ('value' in desc || desc.initializer) {
    desc.writable = true;
  }

  desc = decorators.slice().reverse().reduce(function (desc, decorator) {
    return decorator(target, property, desc) || desc;
  }, desc);

  if (context && desc.initializer !== void 0) {
    desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
    desc.initializer = undefined;
  }

  if (desc.initializer === void 0) {
    Object['define' + 'Property'](target, property, desc);
    desc = null;
  }

  return desc;
}

/* eslint-disable quote-props */
var REQUEST_HEADERS_SAUCE = exports.REQUEST_HEADERS_SAUCE = {
  'Content-Type': 'application/json',
  'X-Correlation-Id': 'WEB-APP.jO4x1',
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/53.0.2785.143 Safari/537.36',
  'Origin': 'https://conta.nubank.com.br',
  'Referer': 'https://conta.nubank.com.br/'
  /* eslint-enable quote-props */

};