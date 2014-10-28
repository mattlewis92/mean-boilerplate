'use strict';

angular
  .module('nasty.user.services')
  .factory('SocialNetwork', function($http, $window, $location, $timeout, $state, Authentication) {

    var socialNetwork = {};

    socialNetwork.authorize = function(provider, redirect) {

      return $http.post('/auth/user/authorize', {}).then(function() {

        redirect = redirect || $location.path();
        $window.location.href = '/auth/' + provider + '/authorize?redirect=' + encodeURIComponent(redirect);

      });

    };

    socialNetwork.authenticate = function(provider, redirect) {

      redirect = redirect || $location.path();
      redirect += '?authCallback=1';

      $window.location.href = '/auth/' + provider + '/authenticate?fingerprint=' +
        Authentication.getBrowserFingerprint() + '&redirect=' + encodeURIComponent(redirect);

    };

    socialNetwork.authenticateCallback = function() {

      return $http.get('/auth/user/token').success(function(result) {

        Authentication.store(result.auth);
        $timeout(function() {
          $state.go('user.home');
        });

      });

    };

    return socialNetwork;

  });