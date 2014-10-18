'use strict';

//Arguments format is: message, ...translation params..., statusCode, dontTranslate
module.exports = function() {

  var message = arguments[0],
      params = [],
      totalParams = message.match(/\%s/g);

  if (totalParams) {
    totalParams = totalParams.length;
  }

  for (var i = 1; i <= totalParams; i++) {
    params.push(arguments[i]);
  }

  var statusCode = arguments[i];
  i++;
  var dontTranslate = arguments[i];

  Error.call(this);
  this.message = message;
  this.statusCode = statusCode || 400;
  this.dontTranslate = !!dontTranslate;
  this.translationParams = params;
  this.stack = (new Error()).stack;
  this.displayToUser = true;
};