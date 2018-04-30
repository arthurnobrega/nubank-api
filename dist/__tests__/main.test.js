'use strict';

var _index = require('../index');

var _index2 = _interopRequireDefault(_index);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

test('should return a object on createNuBank', function () {
  var NuBank = (0, _index2.default)();
  expect(NuBank).toBeDefined();
});