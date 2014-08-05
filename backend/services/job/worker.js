module.exports = function() {

  var self = this;

  this.options = {};
  this.job = null;
  this.frequency = null;

  this.options = function(opts) {
    self.options = opts;
    return self;
  };

  this.concurrency = function(value) {
    self.options.concurrency = value;
    return self;
  };

  this.lockLifetime = function(value) {
    self.options.lockLifetime = value;
    return self;
  };

  this.priority = function(value) {
    self.options.priority = value;
    return self;
  };

  this.frequency = function(value) {
    self.frequency = value;
    return self;
  };

  this.action = function(value) {
    self.job = value;
    return self;
  };

};