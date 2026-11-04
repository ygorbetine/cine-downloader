# Cine Downloader

**by Becine Tools**: painel para o **Adobe Premiere Pro** que baixa vídeos de redes sociais (YouTube, Instagram, TikTok, X, Facebook, Vimeo, Reddit e outras) e importa direto no seu projeto, no bin que você escolher.

> Use apenas com conteúdo próprio, licenciado ou com autorização. Respeite os termos de cada plataforma.

## Recursos
- Cole o link, detecta a rede, escolhe a qualidade (Melhor, 4K, 1080p, 720p, só áudio)
- **Conversão automática** para um codec que o Premiere aceita (VP9/AV1 viram H.264+AAC ou ProRes/DNxHR)
- Destino duplo: **bin do Premiere** (usa o bin ativo do painel Project, ou qualquer bin da árvore) e **pasta do Windows** (seletor moderno, arrastar e soltar, recentes e fixadas)
- Fila com progresso, cancelar, tentar de novo e histórico que pode ser limpo
- **Log** completo em `%APPDATA%\CineDownloader\logs`
- **Atualização automática** do painel (GitHub Releases) e do yt-dlp

## Instalação (Windows)
1. Baixe o `cine-downloader-vX.Y.Z.zip` na página de [Releases](../../releases/latest) e extraia.
2. Dê dois cliques em `install.bat`. Ele baixa yt-dlp, ffmpeg e deno, ativa o modo de depuração do CEP e instala o painel.
3. Abra o Premiere: **Janela > Extensões > Cine Downloader**.

Para remover, use `uninstall.bat`. Para atualizar o yt-dlp manualmente, `update-ytdlp.bat`.

## Atualizações
O painel verifica novas versões ao abrir (a cada 6 horas) e mostra um aviso com o botão **Atualizar**. A atualização preserva a pasta `bin/` e pede para reiniciar o Premiere.

## Desenvolvimento
- Painel CEP (HTML/JS + ExtendScript) em `index.html`, `js/`, `jsx/` e `css/`; lógica de download em `js/core/`.
- Versão única em `version.json` (o workflow de release grava a versão da tag no `version.json` e no `manifest.xml`).
- Para publicar uma versão: `git tag vX.Y.Z && git push origin vX.Y.Z`. O GitHub Actions gera o `cine-downloader-vX.Y.Z.zip` e cria o Release.
- Primeira publicação do repositório: `scripts\publish-github.bat`.

## Licença
MIT © Becine Tools. Veja `LICENSE`.
