'use strict';

angular
  .module('nasty.user.states')
  .config(function($stateProvider, configProvider) {

    $stateProvider
      .state('user', {
        url: '/user',
        abstract: true,
        template: '<ui-view/>'
      })
      .state('user.register', {
        url: '/register',
        templateUrl: 'app/user/states/register/user.register.html',
        controller: 'UserRegisterCtrl as registerCtrl',
        redirectOnAuthentication: true
      })
      .state('user.login', {
        url: '/login',
        templateUrl: 'app/user/states/login/user.login.html',
        controller: 'UserLoginCtrl as loginCtrl',
        redirectOnAuthentication: true
      })
      .state('user.resetPasswordRequest', {
        url: '/forgot',
        templateUrl: 'app/user/states/resetPasswordRequest/user.resetPasswordRequest.html',
        controller: 'UserResetPasswordRequestCtrl as resetPasswordRequestCtrl',
        redirectOnAuthentication: true
      })
      .state('user.resetPassword', {
        url: '/forgot/:userId/:resetToken',
        templateUrl: 'app/user/states/resetPassword/user.resetPassword.html',
        controller: 'UserResetPasswordCtrl as resetPasswordCtrl',
        redirectOnAuthentication: true
      })
      .state('user.home', {
        url: '/home',
        templateUrl: 'app/user/states/home/user.home.html',
        controller: 'UserHomeCtrl as homeCtrl',
        resolve: {
          user: function(userModel) {
            return userModel.getAuthUser();
          }
        }
      });
  });
