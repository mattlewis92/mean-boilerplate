var express = require('express')
  , nconf = require('nconf')
  , dependable = require('dependable')
  , http = require('http')
  , requireIndex = require('requireindex')
  , path = require('path')
  , fs = require('fs');

require('express-di');

var application = function() {

  var app = express();

  var di = dependable.container();

  var originalRegisterFunction = di.register;
  di.register = function(key, value) {

    app.factory(key, function(req, res, next) {
      next(null, value);
    });

    originalRegisterFunction(key, value);

  }

  app.set('services', di);

  app.loadConfig = function(configPath) {

    nconf
      .overrides({
        'NODE_ENV': process.env.NODE_ENV || 'development',
        'rootPath': configPath + '/../../'
      })
      .env()
      .file('all', configPath + '/all.json')
      .file('other', configPath + '/' + nconf.get('NODE_ENV') + '.json');

    this.get('services').register('config', nconf);

    initMiddleware(this);

  }

  app.loadServices = function(servicesPath) {

    var services = requireIndex(servicesPath);

    for (var name in services) {

      if ('object' == typeof services[name] && services[name].index) {
        services[name] = services[name].index;
      }

      this.get('services').register(name, new services[name](this));
    }

  }

  app.loadModules = function(modulePath) {

    var finder = require('findit')(modulePath);
    var self = this;

    function camelCase(input) {
      return input.toLowerCase().replace(/_(.)/g, function(match, group1) {
        return group1.toUpperCase();
      });
    }

    finder.on('file', function (file, stat) {
      var filename = file.split('/').pop();
      var directory = file.replace('/' + filename, '');

      if ('app.js' == filename) {

        var subApp = express();
        initMiddleware(subApp);

        var mountPrefix = directory.replace(modulePath, '');
        var actions = requireIndex(directory + '/actions');

        if (fs.existsSync(directory + '/middleware')) {

          var middleware = requireIndex(directory + '/middleware');

          for (var name in middleware) {
            //Make this middleware available locally
            subApp.factory(name, middleware[name]);

            //Also make the middleware available globally
            var globalName = mountPrefix.replace(/\//g, '_') + '_' + name;
            if (globalName.charAt(0) == '_') globalName = globalName.substr(1);
            globalName = camelCase(globalName);

            self.factory(globalName, middleware[name]);
          }

        }

        var subAppLoaded = require(file)(subApp, actions);

        addFinalMiddleware(subApp);

        self.use(mountPrefix, subAppLoaded);

      }

    });

    //Now let's add some default routes (as it's own sub app otherwise they'll override every other route)
    finder.on('end', function () {

      var config = self.get('services').get('config');
      var indexFile = path.resolve(config.get('rootPath') + config.get('frontendPath') + '/index.html');

      var subApp = express();
      initMiddleware(subApp);

      subApp.get('*', function(req, res, next) {
        res.sendfile(indexFile);
      });

      subApp.all('*', function(req, res, next) {
        res.json(404, {error: 'This API method does not exist.'});
      });

      addFinalMiddleware(subApp);

      self.use('/', subApp);

      addFinalMiddleware(self);

    });

  }

  app.startServer = function(done) {

    var config = this.get('services').get('config');

    http.createServer(this).listen(config.get('server:port'), config.get('server:address'), function() {
      var addr = this.address();
      console.info('HTTP server listening on %s:%d', addr.address, addr.port);
      return done();
    });

  }

  var initMiddleware = function(app) {

    var config = di.get('config');

    app.set('env', config.get('NODE_ENV'));

    if ('development' == config.get('NODE_ENV')) {
      app.use(require('morgan')());
    }

    app.use(require('static-favicon')());
    app.use(express.static(config.get('rootPath') + config.get('frontendPath')));
    app.use(require('body-parser')());
    app.use(require('method-override')());
    app.use(require('mean-seo')({
      cacheClient: 'disk', // Can be 'disk' or 'redis'
      cacheDuration: 2 * 60 * 60 * 24 * 1000 // In milliseconds for disk cache
    }));

  }

  var addFinalMiddleware = function(app) {

    var config = di.get('config');
    if ('development' == config.get('NODE_ENV')) {

      app.use(require('errorhandler')());

    } else {

      app.use(function(err, req, res, next) {

        if (err instanceof di.get('errors').user) {
          res.json(err.statusCode, {error: err.message});
        } else {
          next(err);
        }

      });

      app.use(function(err, req, res, next) {

        res.json(500, {error: 'An error occurred! Please try again or contact us if you believe this should have worked.'});

      });

    }

  }

  return app;

}



module.exports = application;