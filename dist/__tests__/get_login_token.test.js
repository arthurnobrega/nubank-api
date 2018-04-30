'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _index = require('../index');

var _index2 = _interopRequireDefault(_index);

var _api_uris = require('../api_uris');

var _api_uris2 = _interopRequireDefault(_api_uris);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

jest.mock('node-fetch', function () {
  return jest.fn(function () {
    return Promise.resolve({
      json: function json() {
        return Promise.resolve({ value: 1 });
      }
    });
  });
});

describe('NuBank.getLoginToken', function () {
  var NuBank = (0, _index2.default)();
  var credentials = { login: 'CPF', password: 'password' };
  var fetch = require('node-fetch');

  it('should not throw on call', function () {
    return NuBank.getLoginToken(credentials).then(function (d) {
      return expect(d).toEqual({ value: 1 });
    });
  });

  it('should have called fetch', function () {
    expect(fetch).toBeCalled();
  });

  it('should call the token endpoint', function () {
    expect(fetch.mock.calls[0][0]).toEqual(_api_uris2.default.token);
  });

  it('should do a POST request', function () {
    expect(fetch.mock.calls[0][1].method).toEqual('POST');
  });

  it('should set the right request body', function () {
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(_extends({}, credentials, {
      grant_type: 'password',
      client_id: 'other.conta',
      client_secret: 'yQPeLzoHuJzlMMSAjC-LgNUJdUecx8XO'
    }));
  });

  it('should use the right request headers', function () {
    expect(fetch.mock.calls[0][1].headers).toEqual(_index.REQUEST_HEADERS_SAUCE);
  });

  it('should set closure variable signInData at the end', function () {
    Promise.all();
    expect(NuBank.signInData).toEqual({ value: 1 });
  });
});