'use strict';

angular
  .module('nasty.app.ctrls')
  .classy
  .controller({

    name: 'AppNavbarCtrl',

    inject: ['$scope', 'authentication', 'user'],

    data: {
      authentication: 'authentication'
    },

    watch: {
      'authentication.isAuthenticated()': function(isAuthenticated) {
        this.isLoggedIn = isAuthenticated;
      }
    }

  });
