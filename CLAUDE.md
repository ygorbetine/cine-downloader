# Cine Downloader (by Becine Tools)

Painel **CEP** para **Adobe Premiere Pro** (Windows) que baixa vídeos de redes sociais (yt-dlp + ffmpeg) e importa no projeto.
Dono: Ygor Betine (GitHub `ygorbetine`), diretor da Becine Studio. Repositório público: https://github.com/ygorbetine/cine-downloader

## Como trabalhar com o Ygor
- Converse e escreva a interface em **português (PT-BR)**; código e comentários em inglês.
- Respostas curtas e objetivas. **Não altere nada que ele não pediu**; se perguntar "dá para fazer X?", só responda.
- Nunca peça nem registre senhas/tokens. Use o `git`/`gh` já logado na máquina dele.
- Não apague Releases, tags ou arquivos dele sem pedir.

## Estrutura
- `index.html`, `css/app.css`: interface (Opção C, glass leve; paleta RASTRO: `#0F0515`, `#9247F2`→`#5865F2`, `#B21EC7`)
- `js/ui.js`: eventos, fila, seletor de bin/pasta, atualização
- `js/core/`: `downloader.js` (yt-dlp, conversão ffmpeg, seletor de pasta), `updater.js` (GitHub Releases + yt-dlp -U), `logger.js`, `config.js`
- `jsx/premiere.jsx`: ponte ExtendScript (bins, importar, timeline). `ps/pick-folder.ps1`: seletor de pasta moderno
- `version.json` é a fonte da versão; `install.bat/ps1` instala em `%APPDATA%\Adobe\CEP\extensions\cine-downloader`
- Log: `%APPDATA%\CineDownloader\logs\cine-downloader.log` (peça ao Ygor para enviar quando algo falhar)

## Estado atual
- v0.2.0 publicada. Nada foi testado por Claude dentro do Premiere (só validação de sintaxe).
- O workflow `.github/workflows/release.yml` do repositório está **quebrado** (faltava `export VERSION` antes do Python, o job falha em 4 s). A versão corrigida está em `.github/workflows/release.yml` deste pacote.
- O Release `v0.2.0` existe **sem o zip** (só código-fonte). Não apague; publique a correção como **v0.2.1**.
- No repositório faltava `.github/` e `.gitignore` no upload inicial; `.gitignore` e o workflow (quebrado) foram criados pelo navegador.

## Notas para a próxima versão
- Thumbnail não aparece na fila: nunca foi implementada (`js/ui.js` desenha `<div class="mini"></div>` vazio). Pedir a URL da thumbnail ao yt-dlp, guardar no item/histórico e mostrar na caixa.
- O título na fila mostra o ID do vídeo (ex.: `[0jmo…`), aparentemente vindo do nome do arquivo e não do título original.

## Próximos passos (nesta ordem)
1. Clonar o repositório, aplicar os arquivos deste pacote (`.github/workflows/release.yml`, `CLAUDE.md`), conferir `.gitignore`, commit e push.
2. Criar a tag `v0.2.1` e confirmar que o Actions gera `cine-downloader-v0.2.1.zip` no Release. Depois testar a atualização automática a partir da v0.2.0 instalada.
3. Rodar com o Ygor os testes no Premiere: bin ativo (`getInsertionBin`), árvore de bins, seletor de pasta, conversão VP9→H.264, "Jogar na timeline", histórico, log.
4. Plano comercial (open-core): núcleo grátis e público; módulo pago privado com chave de licença. Funções candidatas, por prioridade:
   1. Fontes licenciadas no painel (Pexels, Pixabay, Unsplash, Freesound, Internet Archive, Wikimedia; Storyblocks/Envato com conta do cliente)
   2. Controle de licenças/créditos por clipe + planilha de créditos do projeto
   3. Fluxo automático: corte antes de baixar, playlists, proxy, normalizar frame rate/codec, dividir por cena
   4. Presets por cliente/projeto compartilháveis
   5. Transcrição local (Whisper) com legendas e marcadores
   6. Pasta monitorada, agendamento e lotes
   7. Sincronização com Drive/Dropbox/Frame.io
   8. macOS
   Decisões em aberto: licença do núcleo (hoje MIT), provedor de licenças (Lemon Squeezy/Gumroad/Paddle), assinatura ZXP, site de venda.
   Aviso: downloader de redes sociais tem risco de termos de uso/direitos autorais; posicionar o produto para conteúdo próprio/licenciado.
5. Atualizar o doc do plano (link abaixo) com o plano comercial.

## Referências
- Doc do plano: https://claude.ai/artifact/Tt3hjsPCBqC2z6Rrii2HC1
- Interface de referência (Opção C): https://claude.ai/artifact/CvRByqXLxr8dbqc43xfSF4

## Primeiro prompt sugerido
"Leia o CLAUDE.md, clone o repositório, aplique os arquivos do pacote, faça o commit e publique a v0.2.1. Depois me guie nos testes no Premiere."
