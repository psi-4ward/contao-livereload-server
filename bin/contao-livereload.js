#!/usr/bin/env node

var path = require('path');
var child_process = require('child_process');

var cwd = process.cwd();
var appDir = path.resolve(__dirname, '..');

process.argv.shift();
process.argv.shift();

if(process.argv.indexOf('-d') === -1) {
  process.argv.push('-d');
  process.argv.push(cwd);
}

child_process.fork(
  appDir + '/node_modules/gulp/bin/gulp.js',
  process.argv,
  {
    cwd: appDir
  }
);
