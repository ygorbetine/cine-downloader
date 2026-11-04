// Ponte com o Premiere (ExtendScript). Mínima: só o que toca no projeto.

function cd_collect(item, depth, parentPath, out) {
  for (var i = 0; i < item.children.numItems; i++) {
    var c = item.children[i];
    if (c.type === ProjectItemType.BIN) {
      var p = parentPath ? parentPath + " / " + c.name : c.name;
      out.push(c.nodeId + "\t" + depth + "\t" + c.name + "\t" + p);
      cd_collect(c, depth + 1, p, out);
    }
  }
}

// Árvore de bins em pré-ordem: "nodeId \t profundidade \t nome \t caminho". Linhas separadas por \n.
function cd_listBinsTree() {
  try {
    if (!app.project) return "ERR:Nenhum projeto aberto";
    var out = [];
    cd_collect(app.project.rootItem, 0, "", out);
    return out.join("\n");
  } catch (e) { return "ERR:" + e.toString(); }
}

// Caminho "A / B / C" de um bin, a partir do treePath ("\\Projeto.prproj\\A\\B").
function cd_pathOf(bin) {
  try {
    var parts = String(bin.treePath).split("\\"), out = [];
    for (var i = 0; i < parts.length; i++) { if (parts[i] !== "") out.push(parts[i]); }
    out.shift(); // remove o nome do projeto
    return out.join(" / ");
  } catch (e) { return bin.name; }
}

// Bin ativo no painel Project (o que o Premiere usa como destino de importação): "nodeId \t caminho".
function cd_activeBin() {
  try {
    if (!app.project) return "ERR:Nenhum projeto aberto";
    var b = app.project.getInsertionBin();
    if (!b) return "ERR:Sem bin ativo";
    return b.nodeId + "\t" + cd_pathOf(b);
  } catch (e) { return "ERR:" + e.toString(); }
}

function cd_findBinById(item, id) {
  if (id === "active") return app.project.getInsertionBin();
  if (!id || id === "root") return app.project.rootItem;
  for (var i = 0; i < item.children.numItems; i++) {
    var c = item.children[i];
    if (c.type === ProjectItemType.BIN) {
      if (c.nodeId === id) return c;
      var r = cd_findBinById(c, id);
      if (r) return r;
    }
  }
  return null;
}

function cd_projectDir() {
  try {
    if (!app.project || !app.project.path) return "ERR:Projeto sem caminho (salve o projeto)";
    return new File(app.project.path).parent.fsName;
  } catch (e) { return "ERR:" + e.toString(); }
}

function cd_createBin(parentId, name) {
  try {
    var parent = cd_findBinById(app.project.rootItem, parentId);
    if (!parent) return "ERR:Bin pai não encontrado";
    var bin = parent.createBin(name);
    return "OK\t" + bin.nodeId;
  } catch (e) { return "ERR:" + e.toString(); }
}

function cd_importToBin(filePath, binId) {
  try {
    if (!app.project) return "ERR:Nenhum projeto aberto";
    var f = new File(filePath);
    if (!f.exists) return "ERR:Arquivo não existe: " + filePath;
    var bin = cd_findBinById(app.project.rootItem, binId);
    if (!bin) return "ERR:Bin de destino não encontrado (atualize a lista de bins)";
    var ok = app.project.importFiles([f.fsName], true, bin, false);
    return ok ? "OK" : "ERR:O Premiere recusou o arquivo (importFiles retornou false)";
  } catch (e) { return "ERR:" + e.toString(); }
}

function cd_findByMediaPath(item, target) {
  for (var i = 0; i < item.children.numItems; i++) {
    var c = item.children[i];
    if (c.type === ProjectItemType.BIN) { var r = cd_findByMediaPath(c, target); if (r) return r; }
    else { try { if (c.getMediaPath().toLowerCase() === target) return c; } catch (e) {} }
  }
  return null;
}

function cd_insertToTimeline(filePath) {
  try {
    var seq = app.project.activeSequence;
    if (!seq) return "ERR:Nenhuma sequência ativa";
    var item = cd_findByMediaPath(app.project.rootItem, new File(filePath).fsName.toLowerCase());
    if (!item) return "ERR:Clipe importado não encontrado no projeto";
    seq.insertClip(item, seq.getPlayerPosition(), 0, 0);
    return "OK";
  } catch (e) { return "ERR:" + e.toString(); }
}
