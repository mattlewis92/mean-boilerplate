'use strict';

module.exports = function(req, res, models, errors, next) {

  req.checkBody('email', 'Required').notEmpty();
  req.checkBody('email', 'Valid email required').isEmail();
  req.checkBody('name', 'Required').notEmpty();
  req.checkBody('password', 'Required').notEmpty();
  req.checkBody('password', '8 to 20 characters required').len(8, 20);

  if (req.validationErrors()) {
    return next(new errors.validation(req.validationErrors(true)));
  }

  var user = new models.user({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password
  });

  user.saveAsync().then(function(savedUser) {

    var plainUser = savedUser[0].toObject();
    delete plainUser.password;
    delete plainUser.__v;
    res.json(plainUser);

  })
  .catch(function(err) {

    if (err.cause && 11000 === err.cause.code) {
      next(new errors.user('A user with this email address already exists.'));
    } else {
      next(err);
    }

  });

};