// Atualização automática via GitHub Releases + atualização diária do yt-dlp.
(function (root) {
  var https = require('https'), fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
  var log = root.CineLog;
  var extDir = root.CineDownloader.extensionDir();
  var info = { name: 'Cine Downloader', version: '0.0.0', vendor: 'Becine Tools', repo: '' };
  try { info = JSON.parse(fs.readFileSync(path.join(extDir, 'version.json'), 'utf8')); } catch (e) { log.error('version.json ilegível', e.message); }

  // compara versões "1.2.3": >0 se a > b
  function cmp(a, b) {
    var x = String(a).replace(/^v/, '').split('.'), y = String(b).replace(/^v/, '').split('.');
    for (var i = 0; i < 3; i++) { var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0); if (d) return d; }
    return 0;
  }
  function get(url, cb, depth) {
    https.get(url, { headers: { 'User-Agent': 'cine-downloader', 'Accept': 'application/vnd.github+json' } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (depth || 0) < 5) { res.resume(); return get(res.headers.location, cb, (depth || 0) + 1); }
      var b = ''; res.setEncoding('utf8'); res.on('data', function (d) { b += d; });
      res.on('end', function () { cb(res.statusCode === 200 ? null : new Error('HTTP ' + res.statusCode), b); });
    }).on('error', cb);
  }
  function download(url, dest, onProgress, cb, depth) {
    https.get(url, { headers: { 'User-Agent': 'cine-downloader' } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && (depth || 0) < 5) { res.resume(); return download(res.headers.location, dest, onProgress, cb, (depth || 0) + 1); }
      if (res.statusCode !== 200) { res.resume(); return cb(new Error('HTTP ' + res.statusCode)); }
      var total = parseInt(res.headers['content-length'], 10) || 0, got = 0, out = fs.createWriteStream(dest);
      res.on('data', function (d) { got += d.length; if (total) onProgress(got / total * 100); });
      res.pipe(out); out.on('finish', function () { out.close(function () { cb(null); }); });
      out.on('error', cb);
    }).on('error', cb);
  }

  // check(cb) -> cb(err, { configured, current, latest, newer, notes, pageUrl, assetUrl })
  function check(cb) {
    if (!info.repo || /OWNER/.test(info.repo)) return cb(null, { configured: false, current: info.version });
    get('https://api.github.com/repos/' + info.repo + '/releases/latest', function (err, body) {
      if (err) { log.warn('verificação de atualização falhou', err.message); return cb(err); }
      try {
        var r = JSON.parse(body), latest = String(r.tag_name || '').replace(/^v/, '');
        var asset = (r.assets || []).filter(function (a) { return /^cine-downloader-v.*\.zip$/i.test(a.name); })[0];
        var res = { configured: true, current: info.version, latest: latest, newer: cmp(latest, info.version) > 0, notes: r.body || '', pageUrl: r.html_url,
          assetUrl: asset ? asset.browser_download_url : r.zipball_url };
        log.info('verificação de atualização', { current: res.current, latest: res.latest, newer: res.newer }); cb(null, res);
      } catch (e) { cb(e); }
    });
  }

  function findRoot(dir, depth) { // pasta que contém CSXS/manifest.xml
    if (fs.existsSync(path.join(dir, 'CSXS', 'manifest.xml'))) return dir;
    if (depth > 3) return null;
    var kids = fs.readdirSync(dir).filter(function (n) { try { return fs.statSync(path.join(dir, n)).isDirectory(); } catch (e) { return false; } });
    for (var i = 0; i < kids.length; i++) { var r = findRoot(path.join(dir, kids[i]), depth + 1); if (r) return r; }
    return null;
  }

  // install(release, onProgress(txt, pct), cb(err)) — baixa o zip, extrai e copia por cima, preservando bin/
  function install(rel, onProgress, cb) {
    var tmp = path.join(os.tmpdir(), 'cine-update-' + Date.now()), zip = path.join(tmp, 'update.zip'), out = path.join(tmp, 'x');
    fs.mkdirSync(tmp, { recursive: true });
    log.info('atualização: baixando', rel.assetUrl);
    download(rel.assetUrl, zip, function (p) { onProgress('Baixando atualização', p); }, function (err) {
      if (err) { log.error('download da atualização falhou', err.message); return cb(err); }
      onProgress('Extraindo', 100);
      cp.execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'Expand-Archive -LiteralPath "' + zip + '" -DestinationPath "' + out + '" -Force'],
        { windowsHide: true }, function (e, so, se) {
          if (e) { log.error('Expand-Archive falhou', String(se || e.message)); return cb(e); }
          var src = findRoot(out, 0);
          if (!src) return cb(new Error('Pacote de atualização inválido'));
          onProgress('Instalando', 100);
          cp.execFile('robocopy', [src, extDir, '/E', '/XD', 'bin', '.github', 'scripts', '/XF', 'install.ps1', 'install.bat', 'uninstall.bat', '/NFL', '/NDL', '/NJH', '/NJS', '/NP'],
            { windowsHide: true }, function (e2, so2) {
              // robocopy: códigos 0-7 = sucesso
              if (e2 && e2.code >= 8) { log.error('robocopy falhou', { code: e2.code, out: String(so2).slice(-800) }); return cb(new Error('Falha ao copiar arquivos (código ' + e2.code + ')')); }
              log.info('atualização instalada', { para: rel.latest });
              try { cp.exec('rmdir /s /q "' + tmp + '"'); } catch (e3) {}
              cb(null);
            });
        });
    });
  }

  function ytdlpUpdate(cb) {
    cp.execFile(root.CineDownloader.binPath('yt-dlp'), ['-U'], { windowsHide: true, timeout: 120000 }, function (e, out) {
      log.info('yt-dlp -U', e ? 'erro: ' + e.message : String(out).trim().split(/\r?\n/).pop()); cb && cb(!e);
    });
  }

  root.CineUpdater = { info: info, cmp: cmp, check: check, install: install, ytdlpUpdate: ytdlpUpdate };
})(window);
