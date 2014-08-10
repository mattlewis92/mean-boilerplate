'use strict';

angular
  .module('mean.app.services')
  .factory('Loading', function($rootScope, $timeout) {

    var service = {
      isLoading: false
    }, timer;

    $rootScope.$on('$stateChangeStart', function(event, toState) {
      if (toState.resolve) {
        timer = $timeout(function() {
          service.isLoading = true;
        }, 200); //If the request takes < 200ms then don't show the loading page
      }
    });

    var stateLoaded = function() {
      if (timer) {
        $timeout.cancel(timer);
        timer = null;
      }
      service.isLoading = false;
    };

    $rootScope.$on('$stateChangeSuccess', stateLoaded);

    $rootScope.$on('$stateChangeError', stateLoaded);

    return service;

  });
