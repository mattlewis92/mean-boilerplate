'use strict';

process.env.TZ = 'Etc/UTC';

var express = require('express'),
  dependable = require('dependable'),
  requireAll = require('require-all'),
  path = require('path'),
  expressWinston = require('express-winston'),
  fs = require('fs'),
  expressValidator = require('express-validator'),
  bluebird = require('bluebird');

require('express-di');

var application = function() {

  var app = express(),
      di = dependable.container(),
      originalRegisterFunction = di.register;

  di.register = function(key, value) {

    app.factory(key, function(req, res, next) {
      next(null, di.get(key));
    });

    originalRegisterFunction(key, value);

  };

  app.set('services', di);

  app.loadServices = function(servicesPath, rootPath) {

    var services = requireAll(servicesPath);

    this.get('services').register('rootPath', rootPath);

    for (var name in services) {

      if ('object' === typeof services[name] && services[name].index) {
        services[name] = services[name].index;
      }

      this.get('services').register(name, new services[name](this));
    }

    return this.get('services');

  };

  app.loadModules = function(modulePath) {

    initMiddleware(this, true);

    var loadedModules = requireAll(modulePath),
        finder = require('findit')(modulePath),
        self = this;

    function loadMiddleware(middleware) {
      for (var key in middleware) {
        if (middleware[key].length !== 3) { //Make sure the middleware is only loaded once by checking the arguments length
          middleware[key] = middleware[key](app.get('services'));
        }
      }
      return middleware;
    }

    function getParentModuleMiddleware(path) {
      var parts = path.split('/');
      parts.pop(); //remove child module
      parts.splice(0, 1); //remove first empty string

      var tmp = loadedModules;
      parts.forEach(function(part) {
        tmp = tmp[part];
      });

      var result = {};
      for (var key in tmp) {
        result[key] = loadMiddleware(tmp[key].middleware || {});
      }

      return result;
    }

    function capitaliseFirstLetter(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
    }

    finder.on('file', function(file) {
      var filename = file.split('/').pop(),
          directory = file.replace('/' + filename, '');

      if ('app.js' === filename && directory.indexOf('submodules') === -1) {

        var subApp = express();
        initMiddleware(subApp);

        var mountPrefix = directory.replace(modulePath, ''),
            parentModuleMiddleware = getParentModuleMiddleware(mountPrefix),
            actions = requireAll(directory + '/actions'),
            middlewareName, fullMiddlewareName;

        for (var module in parentModuleMiddleware) {
          for (middlewareName in parentModuleMiddleware[module]) {
            fullMiddlewareName = module + capitaliseFirstLetter(middlewareName);
            subApp.factory(fullMiddlewareName, parentModuleMiddleware[module][middlewareName]);
          }
        }

        if (fs.existsSync(directory + '/submodules')) {

          var submodules = requireAll(directory + '/submodules'),
              subModuleMiddleware = parentModuleMiddleware,
              parentModuleName = mountPrefix.split('/').pop();

          for (var key in submodules) {
            if (submodules[key].middleware) {
              subModuleMiddleware[parentModuleName][key] = loadMiddleware(submodules[key].middleware);

              for (middlewareName in subModuleMiddleware[parentModuleName][key]) {
                fullMiddlewareName = key + capitaliseFirstLetter(middlewareName);
                subApp.factory(fullMiddlewareName, subModuleMiddleware[parentModuleName][key][middlewareName]);
              }
            }
          }

          for (key in submodules) {
            submodules[key].app(subApp, submodules[key].actions, subModuleMiddleware);
          }

        }

        require(file)(subApp, actions, parentModuleMiddleware);

        subApp.all('*', function(req, res) {
          res.status(404).json({message: 'This API method does not exist.'});
        });

        addFinalMiddleware(subApp);

        self.use(mountPrefix, subApp);

      }

    });

    //Now let's add some default routes (as it's own sub app otherwise they'll override every other route)
    finder.on('end', function() {

      var config = self.get('services').get('config'),
          indexFile = path.resolve(config.get('rootPath') + config.get('frontendPath') + '/index.html'),
          subApp = express();

      initMiddleware(subApp);

      subApp.get('*', function(req, res) {
        res.sendFile(indexFile);
      });

      subApp.all('*', function(req, res) {
        res.status(404).json({message: 'This API method does not exist.'});
      });

      addFinalMiddleware(subApp);

      self.use('/', subApp);

      addFinalMiddleware(self);

    });

  };

  app.startServer = function(done) {

    var config = this.get('services').get('config');

    this.listen(config.get('server:port'), config.get('server:address'), function() {
      var addr = this.address();
      console.info('HTTP server listening on %s:%d', addr.address, addr.port);
      return done();
    });

  };

  var initMiddleware = function(app, isRoot) {

    var config = di.get('config');

    app.set('env', config.get('NODE_ENV'));
    app.set('services', di);
    app.enable('trust proxy');
    app.disable('x-powered-by');

    app.use(require('express-domain-middleware'));

    if (isRoot) {
      app.use(require('static-favicon')());

      if ('production' === config.get('NODE_ENV')) {
        app.use(require('compression')({
          filter: function(req, res) {
            return /json|text|javascript|css/.test(res.getHeader('Content-Type'));
          },
          level: 9
        }));
        app.use(express.static(config.get('rootPath') + config.get('frontendPath'), { maxAge: 86400000 * 365 }));
      } else {
        app.use(express.static(config.get('rootPath') + config.get('frontendPath')));
      }
    }

    app.use(require('body-parser').urlencoded({
      extended: true,
      limit: '10mb'
    }));
    app.use(require('body-parser').json({
      limit: '10mb'
    }));
    app.use(expressValidator());
    app.use(require('method-override')());
    app.use(require('connect-requestid'));
    app.use(require('helmet')());
    app.use(di.get('passport').initialize());

    if (true === config.get('app:logRequests')) {
      var transports = [];
      for (var key in di.get('logger').get('request').transports) {
        transports.push(di.get('logger').get('request').transports[key]);
      }

      app.use(expressWinston.logger({
        transports: transports
      }));
    }

    var i18n = di.get('i18n');
    app.use(function(req, res, next) {
      req.i18n = i18n(req.headers['accept-language'], req);
      next();
    });

  },

  addFinalMiddleware = function(app) {

    app.use(function(err, req, res, next) {

      if (true === err.displayToUser) {
        var message = err.message;
        if (!err.dontTranslate) {
          message = req.i18n.__.apply(req.i18n, [message].concat(err.translationParams));
        }

        var response = {message: message};
        if (err.details) {
          response.details = err.details;
          for (var key in response.details) {
            if (response.details[key].msg) {
              response.details[key].msg = req.i18n.__(response.details[key].msg);
            }
          }
        }

        res.status(err.statusCode || 500).json(response);
      } else {
        next(err);
      }

    });

    bluebird.onPossiblyUnhandledRejection(function(error) {
      di.get('logger').get('error').error(error);
    });

    var transports = [];
    for (var key in di.get('logger').get('error').transports) {
      transports.push(di.get('logger').get('error').transports[key]);
    }

    app.use(expressWinston.errorLogger({
      transports: transports
    }));

    /*jshint unused:false*/
    app.use(function(err, req, res, next) {

      res.status(500).json({error: 'An error occurred! Please try again or contact us if you believe this should have worked.'});

    });
    /*jshint unused:true*/

  };

  return app;

};

module.exports = application;
