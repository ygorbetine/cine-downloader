// Persistência simples (Fase 1: localStorage). Fase 3: JSON por projeto em AppData.
(function (root) {
  var KEY = 'cine-downloader.settings';
  root.CineConfig = {
    load: function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } },
    save: function (patch) {
      var cur = root.CineConfig.load();
      Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
      localStorage.setItem(KEY, JSON.stringify(cur));
    }
  };
})(window);
