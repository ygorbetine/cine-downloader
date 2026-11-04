// UI do painel: eventos, fila, seleção de pasta/bin e ponte com o Premiere. Lógica pesada fica em js/core/.
(function () {
  var os = require('os'), path = require('path'), fs = require('fs'), cp = require('child_process');
  var log = window.CineLog;
  var $ = function (id) { return document.getElementById(id); };
  var state = { quality: 'best', format: 'mp4', mode: 'both' };
  var queue = [], seq = 0;
  var bins = [];            // [{id, depth, name, path, parent}]
  var expanded = {};        // id -> true
  var sel = { id: 'active', path: '' };   // bin escolhido: "active" = bin ativo no painel Project, "root" = raiz
  var activePath = '';      // caminho do bin ativo (atualizado em segundo plano)
  var recents = [];         // [{path, pinned}]

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function jsx(fn, args, cb) {
    var call = fn + '(' + (args || []).map(function (a) { return JSON.stringify(a); }).join(',') + ')';
    window.__adobe_cep__.evalScript(call, function (res) { log.info('jsx ' + fn, String(res).slice(0, 500)); cb(String(res)); });
  }
  var isErr = function (r) { return /^ERR:/.test(r) || r === 'EvalScript error.'; };
  var errText = function (r) { return r === 'EvalScript error.' ? 'Erro de script no Premiere (veja o log)' : r.replace(/^ERR:/, ''); };

  // ---- plataforma ----
  var PLATFORMS = [[/youtu\.?be/i, 'YouTube'], [/instagram\.com/i, 'Instagram'], [/tiktok\.com/i, 'TikTok'], [/(twitter|x)\.com/i, 'X'],
    [/facebook\.com|fb\.watch/i, 'Facebook'], [/vimeo\.com/i, 'Vimeo'], [/reddit\.com/i, 'Reddit']];
  function detect(url) { for (var i = 0; i < PLATFORMS.length; i++) if (PLATFORMS[i][0].test(url)) return PLATFORMS[i][1]; return /^https?:\/\//i.test(url) ? 'Link genérico' : ''; }
  function onUrl() { var p = detect($('url').value.trim()); $('detected').textContent = p ? '✓ ' + p + ' detectado' : ''; }
  $('url').addEventListener('input', onUrl);
  $('btn-paste').addEventListener('click', function () { navigator.clipboard.readText().then(function (t) { $('url').value = t.trim(); onUrl(); }); });

  // ---- controles segmentados ----
  Array.prototype.forEach.call(document.querySelectorAll('.seg'), function (seg) {
    seg.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      Array.prototype.forEach.call(seg.children, function (c) { c.classList.remove('on'); });
      b.classList.add('on'); state[seg.getAttribute('data-group')] = b.getAttribute('data-v'); applyMode(); persist();
    });
  });
  function setSeg(g, v) { var seg = document.querySelector('.seg[data-group="' + g + '"]'); if (!seg) return;
    Array.prototype.forEach.call(seg.children, function (c) { c.classList.toggle('on', c.getAttribute('data-v') === v); }); state[g] = v; }
  function applyMode() { $('box-folder').style.display = state.mode === 'bin' ? 'none' : ''; $('box-bin').style.display = state.mode === 'explorer' ? 'none' : ''; }

  // ---- pasta do Windows ----
  function setFolder(p) { $('folder').value = p; addRecent(p); persist(); }
  $('folder').addEventListener('change', function () { var p = $('folder').value.trim().replace(/^"|"$/g, ''); $('folder').value = p; if (p) addRecent(p); persist(); });
  $('btn-folder').addEventListener('click', function () {
    var cur = $('folder').value.trim();
    CineDownloader.pickFolder(cur, function (err, p) {
      if (!err) { if (p) setFolder(p); return; }
      // Plano B: seletor antigo do CEP (se o PowerShell não estiver disponível)
      var r = window.cep.fs.showOpenDialog(false, true, 'Escolher pasta de destino', cur);
      if (r && r.data && r.data[0]) setFolder(r.data[0].replace(/\//g, path.sep));
    });
  });
  $('btn-projdir').addEventListener('click', function () {
    jsx('cd_projectDir', [], function (r) { if (isErr(r)) return flash(errText(r)); setFolder(path.join(r, 'Downloads')); });
  });
  $('btn-openfolder').addEventListener('click', function () { var p = $('folder').value.trim(); if (p) { try { fs.mkdirSync(p, { recursive: true }); } catch (e) {} cp.exec('explorer "' + p + '"'); } });
  function flash(msg) { $('detected').textContent = msg; }

  // arrastar e soltar pasta do Explorer
  var drop = $('box-folder');
  ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
  drop.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    log.info('drop', { path: f && f.path, name: f && f.name });
    if (!f || !f.path) return flash('Não consegui ler a pasta arrastada. Use "Escolher…" ou cole o caminho.');
    var p = f.path; try { if (!fs.statSync(p).isDirectory()) p = path.dirname(p); } catch (er) {}
    setFolder(p);
  });
  // pastas recentes e fixadas
  function addRecent(p) {
    var pinned = false; recents = recents.filter(function (r) { if (r.path === p) { pinned = r.pinned; return false; } return true; });
    recents.unshift({ path: p, pinned: pinned });
    var pins = recents.filter(function (r) { return r.pinned; }), rest = recents.filter(function (r) { return !r.pinned; }).slice(0, 5);
    recents = pins.concat(rest); renderRecents();
  }
  function renderRecents() {
    var box = $('recents'); box.innerHTML = '';
    recents.slice().sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0); }).forEach(function (r) {
      var row = document.createElement('div'); row.className = 'r';
      row.innerHTML = '<button class="pin' + (r.pinned ? ' on' : '') + '" aria-label="Fixar pasta" title="Fixar">' + (r.pinned ? '★' : '☆') + '</button><button class="path" title="' + esc(r.path) + '">' + esc(r.path) + '</button>';
      row.children[0].onclick = function () { r.pinned = !r.pinned; renderRecents(); persist(); };
      row.children[1].onclick = function () { $('folder').value = r.path; persist(); };
      box.appendChild(row);
    });
  }

  // ---- bins do Premiere (qualquer nível) ----
  function parseTree(txt) {
    var out = [], stack = [];
    txt.split('\n').forEach(function (line) {
      var p = line.split('\t'); if (p.length < 4) return;
      var depth = parseInt(p[1], 10); stack.length = depth;
      var node = { id: p[0], depth: depth, name: p[2], path: p[3], parent: depth ? stack[depth - 1] : null };
      stack[depth] = node.id; out.push(node);
    });
    return out;
  }
  function loadBins(cb) {
    $('bin-msg').textContent = 'Lendo bins do projeto…';
    jsx('cd_listBinsTree', [], function (r) {
      if (isErr(r)) { bins = []; $('bin-msg').textContent = errText(r); renderTree(); return cb && cb(false); }
      bins = parseTree(r); $('bin-msg').textContent = bins.length + ' bins no projeto';
      if (sel.id !== 'active') {
        var m = bins.filter(function (b) { return b.path === sel.path; })[0];
        if (m) sel.id = m.id; else if (sel.path) { sel = { id: 'root', path: '' }; }
      }
      updateBinLabel(); renderTree(); cb && cb(true);
    });
  }
  function updateBinLabel() {
    $('bin-label').textContent = sel.id === 'active' ? 'Bin ativo' + (activePath ? ': ' + activePath : ' do Premiere') : (sel.path || (sel.id === 'root' ? 'Raiz do projeto' : 'Nenhum bin escolhido'));
  }
  // lê o bin ativo do painel Project sem poluir o log
  function refreshActive(cb) {
    window.__adobe_cep__.evalScript('cd_activeBin()', function (r) {
      r = String(r); var np = /^ERR:/.test(r) || r === 'EvalScript error.' ? '' : r.split('\t')[1] || '';
      if (np !== activePath) { activePath = np; updateBinLabel(); }
      cb && cb(r);
    });
  }
  setInterval(function () { if (sel.id === 'active' && state.mode !== 'explorer') refreshActive(); }, 2500);
  function renderTree() {
    var q = $('bin-filter').value.trim().toLowerCase(), box = $('bin-tree'); box.innerHTML = '';
    var hasKids = {}; bins.forEach(function (b) { if (b.parent) hasKids[b.parent] = true; });
    var byId = {}; bins.forEach(function (b) { byId[b.id] = b; });
    function visible(b) { var p = b.parent; while (p) { if (!expanded[p]) return false; p = byId[p].parent; } return true; }
    var list = q ? bins.filter(function (b) { return b.path.toLowerCase().indexOf(q) >= 0; }) : bins.filter(visible);
    var actRow = document.createElement('div'); actRow.className = 'node' + (sel.id === 'active' ? ' sel' : '');
    actRow.innerHTML = '<span class="caret"></span><span class="nm">Bin ativo do Premiere (automático)</span>';
    actRow.onclick = function () { sel = { id: 'active', path: '' }; refreshActive(); updateBinLabel(); renderTree(); persist(); }; box.appendChild(actRow);
    var rootRow = document.createElement('div'); rootRow.className = 'node' + (sel.id === 'root' ? ' sel' : ''); rootRow.innerHTML = '<span class="caret"></span><span class="nm">Raiz do projeto</span>';
    rootRow.onclick = function () { sel = { id: 'root', path: '' }; updateBinLabel(); renderTree(); persist(); }; box.appendChild(rootRow);
    if (!list.length) { var e = document.createElement('div'); e.className = 'empty'; e.textContent = bins.length ? 'Nenhum bin encontrado.' : 'Abra um projeto e clique em Atualizar.'; box.appendChild(e); return; }
    list.forEach(function (b) {
      var row = document.createElement('div'); row.className = 'node' + (b.id === sel.id ? ' sel' : ''); row.setAttribute('role', 'treeitem');
      row.style.paddingLeft = (8 + (q ? 0 : b.depth * 16)) + 'px';
      var caret = document.createElement('button'); caret.className = 'caret'; caret.setAttribute('aria-label', 'Expandir');
      caret.textContent = q || !hasKids[b.id] ? '' : (expanded[b.id] ? '▾' : '▸');
      caret.onclick = function (ev) { ev.stopPropagation(); expanded[b.id] = !expanded[b.id]; renderTree(); };
      var nm = document.createElement('span'); nm.className = 'nm'; nm.textContent = b.name;
      row.appendChild(caret); row.appendChild(nm);
      if (q) { var pth = document.createElement('span'); pth.className = 'pth'; pth.textContent = b.path; row.appendChild(pth); }
      row.onclick = function () { sel = { id: b.id, path: b.path }; updateBinLabel(); renderTree(); persist(); };
      box.appendChild(row);
    });
  }
  $('btn-binpick').addEventListener('click', function () { var p = $('bin-panel'); p.hidden = !p.hidden; if (!p.hidden) loadBins(); });
  $('bin-refresh').addEventListener('click', function () { loadBins(); });
  $('bin-filter').addEventListener('input', renderTree);
  $('bin-create').addEventListener('click', function () {
    var name = $('bin-new').value.trim(); if (!name) return;
    jsx('cd_createBin', [sel.id, name], function (r) {
      if (isErr(r)) { $('bin-msg').textContent = errText(r); return; }
      $('bin-new').value = ''; expanded[sel.id] = true; if (sel.id !== 'active') sel.path = sel.path ? sel.path + ' / ' + name : name;
      loadBins();
    });
  });

  // ---- persistência ----
  function persist() {
    CineConfig.save({ quality: state.quality, format: state.format, mode: state.mode, folder: $('folder').value, binPath: sel.path, binActive: sel.id === 'active', codec: $('codec').value,
      recents: recents, timeline: $('chk-timeline').checked, proxy: $('chk-proxy').checked });
  }
  ['codec', 'chk-timeline', 'chk-proxy'].forEach(function (id) { $(id).addEventListener('change', persist); });
  (function restore() {
    var c = CineConfig.load();
    ['quality', 'format', 'mode'].forEach(function (g) { if (c[g]) setSeg(g, c[g]); });
    if (c.folder) $('folder').value = c.folder;
    if (c.codec) $('codec').value = c.codec;
    if (c.binActive === false) sel = { id: 'root', path: c.binPath || '' };
    if (typeof c.timeline === 'boolean') $('chk-timeline').checked = c.timeline;
    if (typeof c.proxy === 'boolean') $('chk-proxy').checked = c.proxy;
    recents = c.recents || []; renderRecents(); applyMode(); updateBinLabel();
    queue = (c.history || []).map(function (h) { return { id: ++seq, title: h.title, platform: h.platform, status: h.status, detail: h.detail, job: h.job, percent: 100 }; });
  })();

  // ---- fila ----
  function render() {
    var q = $('queue'); q.innerHTML = '';
    if (!queue.length) { q.innerHTML = '<span style="color:rgba(255,255,255,.72);font-size:12px">Nenhum download ainda.</span>'; return; }
    queue.slice().reverse().forEach(function (it) {
      var d = document.createElement('div'); d.className = 'item ' + (it.status === 'working' ? 'active' : it.status);
      var bar = it.status === 'working' ? '<div class="bar"><i style="width:' + it.percent + '%"></i></div>' : '';
      var rec = it.status === 'working' ? '<span class="rec"></span>' : '';
      d.innerHTML = '<div class="mini"></div><div class="body"><div class="name">' + rec + esc(it.title) + '</div>' + bar + '<div class="st">' + esc(it.platform) + ' · ' + esc(it.detail) + '</div></div>';
      var act = document.createElement('button');
      if (it.status === 'working') { act.className = 'btn ghost'; act.textContent = '✕'; act.setAttribute('aria-label', 'Cancelar download'); act.onclick = function () { it.handle && it.handle.cancel(); }; d.appendChild(act); }
      if (it.status === 'error') { act.className = 'btn'; act.textContent = 'Tentar de novo'; act.onclick = function () { run(it.job, it); }; d.appendChild(act); }
      q.appendChild(d);
    });
  }

  // ---- histórico (concluídos/erros ficam salvos; "Limpar histórico" apaga) ----
  function saveHistory() {
    var h = queue.filter(function (i) { return i.status !== 'working'; }).slice(-30).map(function (i) { return { title: i.title, platform: i.platform, status: i.status, detail: i.detail, job: i.job }; });
    CineConfig.save({ history: h });
  }
  $('btn-clear').addEventListener('click', function () {
    queue = queue.filter(function (i) { return i.status === 'working'; }); CineConfig.save({ history: [] }); log.info('histórico limpo'); render();
  });

  // ---- download -> (conversão) -> importação ----
  function outDirFor() { var f = $('folder').value.trim(); return f || path.join(os.homedir(), 'Videos', 'CineDownloader'); }

  function run(job, existing) {
    var it = existing || { id: ++seq, title: job.url, platform: detect(job.url) || 'Link', job: job };
    if (!existing) queue.push(it);
    it.status = 'working'; it.percent = 0; it.detail = 'Iniciando…';
    log.info('job iniciado', job);
    it.handle = CineDownloader.download(job, {
      onProgress: function (p) { it.percent = p.percent; it.detail = 'Baixando ' + Math.round(p.percent) + '%' + (p.speed ? ' · ' + p.speed : ''); render(); },
      onStage: function (txt, pct) { it.percent = pct; it.detail = txt + ' ' + Math.round(pct) + '%'; render(); },
      onError: function (msg) { it.status = 'error'; it.detail = 'Falhou: ' + msg; log.error('job falhou', msg); render(); saveHistory(); },
      onDone: function (file) {
        it.title = path.basename(file); it.percent = 100;
        var ok = function (txt) { it.status = 'done'; it.detail = txt; render(); saveHistory(); log.info('job concluído', { file: file, detail: txt }); };
        var fail = function (txt) { it.status = 'error'; it.detail = txt; render(); saveHistory(); log.error('importação falhou', txt); };
        if (job.mode === 'explorer') return ok('Salvo em ' + path.dirname(file));
        it.detail = 'Importando no Premiere…'; render();
        // só importa quando o arquivo existe e parou de crescer (evita pegar arquivo ainda sendo finalizado)
        waitStable(file, function (good) {
          if (!good) return fail('Arquivo indisponível: ' + file);
          jsx('cd_importToBin', [file, job.binId], function (r) {
            if (isErr(r)) return fail('Importação: ' + errText(r));
            if (!job.timeline) return ok('Importado em ' + (job.binPath || 'raiz do projeto'));
            jsx('cd_insertToTimeline', [file], function (r2) { if (isErr(r2)) ok('Importado (timeline: ' + errText(r2) + ')'); else ok('Importado e na timeline'); });
          });
        });
      }
    });
    render();
  }
  function waitStable(file, done) {
    var last = -1, tries = 0;
    (function tick() {
      var size = -2; try { size = fs.statSync(file).size; } catch (e) {}
      if (size > 0 && size === last) return done(true);
      if (++tries > 30) return done(size > 0);
      last = size; setTimeout(tick, 500);
    })();
  }

  $('btn-go').addEventListener('click', function () {
    var url = $('url').value.trim();
    if (!/^https?:\/\//i.test(url)) return flash('Cole um link válido (http/https).');
    persist();
    var start = function (binId, binPath) {
      run({ url: url, quality: state.quality, format: state.format, codec: $('codec').value, mode: state.mode, outDir: outDirFor(),
        binId: binId, binPath: binPath, timeline: $('chk-timeline').checked });
      $('url').value = ''; onUrl();
    };
    if (state.mode === 'explorer') return start('root', '');
    if (sel.id !== 'active') return start(sel.id, sel.path);
    // bin ativo: fixa o bin que está ativo no momento do clique
    refreshActive(function (r) {
      var p = /^ERR:|^EvalScript error/.test(r) ? null : r.split('\t');
      if (!p) { log.warn('sem bin ativo, usando raiz', r); return start('root', ''); }
      log.info('bin ativo fixado para o job', { id: p[0], path: p[1] }); start(p[0], p[1]);
    });
  });

  $('btn-log').addEventListener('click', function () { CineLog.open(); });
  // ---- versão, assinatura e atualizações ----
  var APP = CineUpdater.info;
  $('sig-ver').textContent = 'v' + APP.version;
  document.title = APP.name + ' v' + APP.version;
  var pendingRelease = null;
  function setUpd(txt) { $('upd-status').textContent = txt || ''; }
  function openUrl(u) { cp.exec('start "" "' + u + '"'); }
  function checkUpdates(manual) {
    if (manual) setUpd('Verificando…');
    CineUpdater.check(function (err, r) {
      CineConfig.save({ lastCheck: Date.now() });
      if (err) return setUpd(manual ? 'Não foi possível verificar agora.' : '');
      if (!r.configured) return setUpd(manual ? 'Repositório de atualização ainda não configurado.' : '');
      if (!r.newer) return setUpd(manual ? 'Você está na versão mais recente (v' + r.current + ').' : '');
      pendingRelease = r; setUpd('');
      $('update-txt').textContent = 'Nova versão v' + r.latest + ' disponível';
      $('btn-update').disabled = false; $('btn-update').textContent = 'Atualizar'; $('update').hidden = false;
    });
  }
  $('btn-upd').addEventListener('click', function () { checkUpdates(true); });
  $('btn-update').addEventListener('click', function () {
    if (!pendingRelease) return;
    $('btn-update').disabled = true;
    CineUpdater.install(pendingRelease, function (txt, pct) { $('update-txt').textContent = txt + ' ' + Math.round(pct) + '%'; }, function (err) {
      if (err) { $('update-txt').textContent = 'Falha na atualização (veja o log)'; $('btn-update').disabled = false; $('btn-update').textContent = 'Tentar de novo'; return; }
      $('update-txt').textContent = 'Atualizado para v' + pendingRelease.latest + '. Reinicie o Premiere.'; $('btn-update').hidden = true;
    });
  });
  (function autoChecks() {
    var c = CineConfig.load(), now = Date.now();
    if (!c.lastCheck || now - c.lastCheck > 6 * 3600 * 1000) checkUpdates(false);
    if (!c.lastYtdlp || now - c.lastYtdlp > 24 * 3600 * 1000) {
      CineConfig.save({ lastYtdlp: now });
      CineUpdater.ytdlpUpdate(function () { CineDownloader.version(function (v) { if (v) $('ver').textContent = 'yt-dlp ' + v; }); });
    }
  })();

  CineDownloader.version(function (v) { $('ver').textContent = v ? 'yt-dlp ' + v : 'yt-dlp não encontrado em bin/'; log.info('yt-dlp versão', v); });
  jsx('cd_projectDir', [], function () {}); // registra no log o estado do projeto na abertura
  window.__adobe_cep__.evalScript('app.version', function (v) { log.info('Premiere versão', v); });
  loadBins();
  render();
})();
