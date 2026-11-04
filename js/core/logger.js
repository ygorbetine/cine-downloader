// Log em arquivo: %APPDATA%\CineDownloader\logs\cine-downloader.log (rotaciona em 2 MB).
(function (root) {
  var fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
  var dir = path.join(process.env.APPDATA || os.homedir(), 'CineDownloader', 'logs');
  var file = path.join(dir, 'cine-downloader.log');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) {}
  try { if (fs.statSync(file).size > 2 * 1024 * 1024) fs.renameSync(file, file + '.old'); } catch (e) {}

  function ts() { var d = new Date(); var p = function (n, l) { return ('000' + n).slice(-(l || 2)); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()) + '.' + p(d.getMilliseconds(), 3); }
  function write(level, msg, data) {
    var line = ts() + ' [' + level + '] ' + msg;
    if (data !== undefined) { try { line += ' | ' + (typeof data === 'string' ? data : JSON.stringify(data)); } catch (e) { line += ' | (dado não serializável)'; } }
    try { fs.appendFileSync(file, line + '\n'); } catch (e) {}
  }
  root.CineLog = {
    info: function (m, d) { write('INFO', m, d); }, warn: function (m, d) { write('WARN', m, d); }, error: function (m, d) { write('ERRO', m, d); },
    path: file, dir: dir,
    open: function () { cp.exec('explorer "' + dir + '"'); }
  };
  root.addEventListener('error', function (e) { write('ERRO', 'window.onerror', e.message + ' @' + e.filename + ':' + e.lineno); });
  root.addEventListener('unhandledrejection', function (e) { write('ERRO', 'unhandledrejection', String(e.reason)); });
  write('INFO', '===== sessão iniciada =====', { node: process.version, os: os.release(), platform: process.platform });
})(window);
