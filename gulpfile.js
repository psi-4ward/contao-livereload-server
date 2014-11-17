var bodyParser = require('body-parser');
var express = require('express');
var gulp = require('gulp');
var gutil = require('./node_modules/gulp/node_modules/gulp-util/index.js');
var concat = require('gulp-concat');
var less = require('gulp-less');
var livereload = require('gulp-livereload');
var replace = require('gulp-replace-task');
var merge = require('merge-stream');
var path = require('path');

var version = require('./package.json').version;

var yargs = require('yargs')
  .usage(
    'Contao livereload server v.'+version+"\n" +
    'https://github.com/psi-4ward/contao-livereload'+"\n\n" +
    'Usage: contao-livereload -d path -w "files/layout/**/*.less"'
  )
  .example('contao-livereload -d ContaoProject -w files/layout/**/*.less -w files/layout/**/*.css', '')
  .describe('d', 'Contao directory path, default is the current working directory')
  .describe('w', 'Add file watchers, you can use globbing')
  .describe('lr-port', 'Port of the livereload server')
  .describe('req-port', 'Port listen on for Contao requests')
  .default('lr-port', 35729)
  .default('req-port', 35720)
  .describe('h', 'Help')
var argv = yargs.argv;

if(argv.h) {
  yargs.showHelp();
  process.exit(1);
} else {
  console.log('Contao livereload server v.' + version);
  console.log('Use -h for help');
}

if(argv.d) process.chdir(argv.d);
var cwd = process.cwd();

function error(msg) {
  console.error('['+gutil.colors.red('error')+'] ' + msg);
  process.exit(1);
}

// Combine the files
function combine(dest, files) {
    var sources = files.map(function(f) {
      var ext = f.match(/\.([a-z0-9]+)$/i);
      var s;
      switch(ext[1]) {
        case 'css':
          s = gulp.src(f);
          break;

        case 'less':
          s = gulp.src(f).pipe(less());
          s.on('error', function(e) {
            gutil.log(gutil.colors.red('LessCSS Error: ') + e.message.replace(cwd, ''));
          });
          break;

        case 'sass':
          error('Im sorry, havent implemented SASScss support yet');
          break;

        default:
          error('File '+f+' has an unknowen extension!');
          break;
      }

      // Fix relative path url()
      s = s.pipe(replace({
        patterns: [
          {
            match: /url\([^\)]+\)/ig,
            replacement: function(match) {
              var parts = match.match(/^(url\(["']?)([^"'\)]+)(.*)$/);

              // do nothing for urls beginning with / or http:// or data:
              if(parts[2].match( /^(\/|data:|https?:\/\/)/i )) return match;

              return parts[1] + '../../' + path.dirname(f) + '/' + parts[2] + parts[3];
            }
          }
        ]
      }));
      return s;
    });

  merge.apply(this, sources)
    .pipe(concat(dest))
    .pipe(gulp.dest('.'))
}


gulp.task('default', function() {
  gutil.log('Assume Contao root directory in ' + gutil.colors.bold(cwd));

  // Start LiveReload Server
  livereload.listen(argv['lr-port']);

  // Start Contao-Request Server
  var app = express();
  app.use(bodyParser.json());
  app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, Content-Type");
    next();
  });

  var s1, s2;

  app.post('/', function(req, res) {
    gutil.log(gutil.colors.cyan('Received') + ' contao live-reload request ');
    res.send('ok');

    // End old streams
    if(s1) s1.end();
    if(s2) s2.end();

    // Watch CSS-Files for livereload
    var watchFiles = [];
    if(Array.isArray(req.body.nfiles)) watchFiles = watchFiles.concat(req.body.nfiles);
    if(req.body.cdest) watchFiles.push(req.body.cdest);
    s1 = gulp.watch(watchFiles).on('change', livereload.changed);
    watchFiles.forEach(function(f) {
      gutil.log(gutil.colors.cyan('Watching for livereload') + ' ' + f);
    });

    // Watch files to combine
    if(req.body.cfiles) {
      var cWatchers = [];
      if(argv.w) {
        cWatchers = cWatchers.concat((!Array.isArray(argv.w)) ? [argv.w] : argv.w);
      }
      cWatchers = cWatchers.concat(req.body.cfiles);
      cWatchers.forEach(function(f) {
        gutil.log(gutil.colors.cyan('Watching for combining') + ' ' + f);
      });

      s2 = gulp.watch(cWatchers)
        .on('change', function(event) {
          combine(req.body.cdest, req.body.cfiles);
          gutil.log(gutil.colors.magenta(event.path.substr(cwd.length + 1)) + ' was ' + event.type);
        });
    }

  });

  var server = app.listen(argv['req-port'], function() {
    gutil.log('Contao Handler listening on: '+gutil.colors.magenta(server.address().port));
    gutil.log('Waiting for Contao requests ...');
  });

});


