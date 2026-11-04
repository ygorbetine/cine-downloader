// Núcleo: yt-dlp (download) + ffmpeg (conversão para um codec que o Premiere aceita). Sem dependência de UI.
(function (root) {
  var cp = require('child_process'), path = require('path'), fs = require('fs');
  var log = root.CineLog;

  function extensionDir() {
    var p = decodeURI(window.__adobe_cep__.getSystemPath('extension')).replace(/^file:\/\/\//, '');
    return process.platform === 'win32' ? p.replace(/\//g, '\\') : '/' + p.replace(/^\//, '');
  }
  function binPath(name) { return path.join(extensionDir(), 'bin', name + (process.platform === 'win32' ? '.exe' : '')); }

  // Seletores de formato. Em 1080p/720p preferimos H.264 (avc1) para evitar conversão; 4K/Melhor vêm em VP9/AV1 e serão convertidos.
  function formatSelector(q) {
    if (q === 'best') return 'bv*+ba/b';
    if (q === '2160') return 'bv*[height<=2160]+ba/b[height<=2160]';
    var h = q;
    return 'bv*[vcodec^=avc1][height<=' + h + ']+ba[acodec^=mp4a]/bv*[height<=' + h + ']+ba/b[height<=' + h + ']';
  }

  function runLines(child, onLine) {
    var buf = '';
    child.stdout.on('data', function (d) { buf += d; var parts = buf.split(/\r?\n/); buf = parts.pop(); parts.forEach(onLine); });
  }

  function download(o, cb) { // cb: { onProgress, onStage, onDone(file), onError(msg) }
    if (!fs.existsSync(o.outDir)) fs.mkdirSync(o.outDir, { recursive: true });
    var ytdlp = binPath('yt-dlp');
    if (!fs.existsSync(ytdlp)) { log.error('yt-dlp ausente', ytdlp); cb.onError('yt-dlp não encontrado em bin/. Rode o install.bat.'); return { cancel: function () {} }; }

    var args = ['--encoding', 'utf-8', '--newline', '--no-playlist', '--ffmpeg-location', path.dirname(binPath('ffmpeg')),
      '--progress-template', 'download:PROG|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s',
      '--print', 'after_move:filepath', '-o', path.join(o.outDir, '%(title).120B [%(id)s].%(ext)s')];
    if (o.quality === 'audio') args.push('-x', '--audio-format', 'wav');
    else args.push('-f', formatSelector(o.quality), '--merge-output-format', 'mp4');
    var deno = binPath('deno');
    if (fs.existsSync(deno)) args.push('--js-runtimes', 'deno:' + deno);
    args.push(o.url);
    log.info('yt-dlp: iniciando', { url: o.url, quality: o.quality, format: o.format, codec: o.codec, outDir: o.outDir, args: args });

    var env = Object.assign({}, process.env, { PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' });
    var child = cp.spawn(ytdlp, args, { windowsHide: true, env: env });
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    var finalPath = null, errBuf = '', cancelled = false, current = child;
    runLines(child, function (line) {
      if (!line) return;
      if (line.indexOf('PROG|') === 0) { var p = line.split('|'); cb.onProgress({ percent: parseFloat(p[1]) || 0, speed: (p[2] || '').trim(), eta: (p[3] || '').trim() }); }
      else { finalPath = line.trim(); log.info('yt-dlp saída', line); }
    });
    child.stderr.on('data', function (d) { errBuf += d; });
    child.on('error', function (e) { log.error('yt-dlp spawn falhou', e.message); cb.onError(e.message); });
    child.on('close', function (code) {
      log.info('yt-dlp terminou', { code: code, finalPath: finalPath });
      if (errBuf) log.warn('yt-dlp stderr', errBuf.slice(-2000));
      if (cancelled) return cb.onError('Cancelado');
      if (code !== 0 || !finalPath) return cb.onError(errBuf.split(/\r?\n/).filter(Boolean).pop() || 'Falha no download');
      finalPath = resolveFile(finalPath, o.outDir);
      if (!finalPath) return cb.onError('Download concluído, mas o arquivo não foi encontrado (veja o log)');
      if (o.quality === 'audio') return cb.onDone(finalPath);
      current = null;
      convertIfNeeded(finalPath, o, cb, function (h) { current = h; }, function () { return cancelled; });
    });
    return { cancel: function () { cancelled = true; try { child.kill(); } catch (e) {} if (current && current.kill) try { current.kill(); } catch (e) {} } };
  }

  // Se o caminho impresso não existe (acentos/codificação), acha o arquivo pelo ID do vídeo, que é ASCII: "[ID].ext".
  function resolveFile(p, dir) {
    if (fs.existsSync(p)) return p;
    var m = /\[([A-Za-z0-9_-]{5,})\]\.[A-Za-z0-9]+$/.exec(p);
    log.warn('caminho impresso não existe, procurando pelo ID', { p: p, id: m && m[1] });
    if (!m) return null;
    try {
      var hit = fs.readdirSync(dir).filter(function (f) { return f.indexOf('[' + m[1] + ']') >= 0 && !/\.(part|ytdl|cine\.[a-z0-9]+)$/i.test(f); })
        .map(function (f) { return { f: f, t: fs.statSync(path.join(dir, f)).mtimeMs }; }).sort(function (a, b) { return b.t - a.t; })[0];
      if (hit) { log.info('arquivo encontrado pelo ID', hit.f); return path.join(dir, hit.f); }
    } catch (e) { log.error('busca pelo ID falhou', e.message); }
    return null;
  }

  function probe(file, done) {
    cp.execFile(binPath('ffmpeg'), ['-hide_banner', '-i', file], { windowsHide: true }, function (e, out, err) {
      var s = String(err || '');
      var v = /Video:\s*([a-z0-9_]+)/i.exec(s), a = /Audio:\s*([a-z0-9_]+)/i.exec(s), d = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(s);
      var info = { v: v && v[1].toLowerCase(), a: a && a[1].toLowerCase(), duration: d ? (+d[1]) * 3600 + (+d[2]) * 60 + parseFloat(d[3]) : 0 };
      log.info('ffmpeg probe', info); done(info);
    });
  }

  // Decide o que fazer conforme formato/codec escolhidos e o que veio do site.
  function plan(format, codec, info) {
    var okH264 = info.v === 'h264', okAac = info.a === 'aac';
    if (format === 'mp4') {
      if (okH264 && okAac) return { ext: 'mp4', args: ['-c', 'copy'], label: 'copy' };
      return { ext: 'mp4', args: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '320k', '-movflags', '+faststart'], label: 'H.264+AAC' };
    }
    // MOV
    if (codec === 'proreslt') return { ext: 'mov', args: ['-c:v', 'prores_ks', '-profile:v', '1', '-pix_fmt', 'yuv422p10le', '-c:a', 'pcm_s16le'], label: 'ProRes LT' };
    if (codec === 'dnxhr') return { ext: 'mov', args: ['-c:v', 'dnxhd', '-profile:v', 'dnxhr_hq', '-pix_fmt', 'yuv422p', '-c:a', 'pcm_s16le'], label: 'DNxHR HQ' };
    if (codec === 'h264') {
      if (okH264 && okAac) return { ext: 'mov', args: ['-c', 'copy'], label: 'copy' };
      return { ext: 'mov', args: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '320k'], label: 'H.264+AAC' };
    }
    return { ext: 'mov', args: ['-c:v', 'prores_ks', '-profile:v', '2', '-pix_fmt', 'yuv422p10le', '-c:a', 'pcm_s16le'], label: 'ProRes 422' };
  }

  function convertIfNeeded(file, o, cb, setProc, isCancelled) {
    probe(file, function (info) {
      var pl = plan(o.format, o.codec, info);
      var needs = !(pl.label === 'copy' && path.extname(file).slice(1).toLowerCase() === pl.ext);
      log.info('plano de conversão', { entrada: info, saida: pl.label, ext: pl.ext, converte: needs });
      if (!needs) return cb.onDone(file);
      var base = file.slice(0, file.length - path.extname(file).length);
      var out = base + '.cine.' + pl.ext;
      var args = ['-hide_banner', '-y', '-i', file, '-map', '0:v:0', '-map', '0:a?'].concat(pl.args, ['-progress', 'pipe:1', '-nostats', out]);
      log.info('ffmpeg: convertendo', args);
      cb.onStage('Convertendo para ' + pl.label + '…', 0);
      var ff = cp.spawn(binPath('ffmpeg'), args, { windowsHide: true }); setProc(ff);
      var err = '';
      runLines(ff, function (line) {
        var m = /^out_time_ms=(\d+)/.exec(line);
        if (m && info.duration) cb.onStage('Convertendo para ' + pl.label + '…', Math.min(99, (+m[1]) / 1000000 / info.duration * 100));
      });
      ff.stderr.on('data', function (d) { err += d; });
      ff.on('error', function (e) { log.error('ffmpeg spawn falhou', e.message); cb.onError(e.message); });
      ff.on('close', function (code) {
        log.info('ffmpeg terminou', { code: code });
        if (isCancelled()) { try { fs.unlinkSync(out); } catch (e) {} return cb.onError('Cancelado'); }
        if (code !== 0) { log.error('ffmpeg stderr', err.slice(-3000)); try { fs.unlinkSync(out); } catch (e) {} return cb.onError('Falha na conversão (veja o log)'); }
        var final = base + '.' + pl.ext;
        try { fs.unlinkSync(file); if (fs.existsSync(final)) fs.unlinkSync(final); fs.renameSync(out, final); }
        catch (e) { log.error('troca do arquivo falhou', e.message); return cb.onError('Não foi possível finalizar o arquivo: ' + e.message); }
        cb.onDone(final);
      });
    });
  }

  function version(done) { cp.execFile(binPath('yt-dlp'), ['--version'], { windowsHide: true }, function (e, out) { done(e ? null : String(out).trim()); }); }

  // Seletor de pasta moderno (IFileOpenDialog via PowerShell). cb(err, caminho|'' se cancelado)
  function pickFolder(initial, cb) {
    var script = path.join(extensionDir(), 'ps', 'pick-folder.ps1');
    log.info('seletor de pasta: abrindo', { initial: initial });
    cp.execFile('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', script, '-Initial', initial || ''],
      { windowsHide: true, encoding: 'utf8' }, function (err, stdout, stderr) {
        if (err) { log.error('seletor de pasta falhou', String(stderr || err.message).slice(-1500)); return cb(err); }
        var p = String(stdout).trim(); log.info('seletor de pasta: resultado', p || '(cancelado)'); cb(null, p);
      });
  }

  root.CineDownloader = { download: download, version: version, pickFolder: pickFolder, extensionDir: extensionDir, binPath: binPath };
})(window);
