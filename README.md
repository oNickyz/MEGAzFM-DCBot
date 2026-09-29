# MEGAzFM Core

Bot Discord leve e estavel para rodar uma radio 24/7 em um canal de voz, tocando
arquivos MP3 locais e/ou estacoes de stream online (Icecast/Shoutcast).

Este e o pacote **Open Source** do projeto MEGAzFM. Ele contem apenas os
recursos publicos: reproducao de MP3, sistema de estacoes, fila/historico,
volume, shuffle, reconexao de voz e os comandos principais.

> Uma instancia privada ("MEGAzFM Private/Official") pode existir separadamente,
> reutilizando este pacote como dependencia e adicionando recursos extras
> (por exemplo, suporte a lives do YouTube) que **nao fazem parte** deste
> repositorio publico. Ver a secao "Open Source" abaixo.

## Licenca

Este projeto e distribuido sob a **licenca MIT** (ver arquivo `LICENSE` na
raiz do repositorio). Em resumo: qualquer pessoa pode usar, copiar,
modificar, fazer fork e redistribuir este codigo, inclusive para fins
comerciais, desde que mantenha o aviso de copyright original. O software e
fornecido "como esta", sem garantias.

## Instalacao

```bash
git clone <url-do-repositorio>
cd megazfm-core
npm install
cp .env.example .env
# edite o .env com os dados do seu bot
npm start
```

Requisitos: Node.js 18+. FFmpeg e incluso automaticamente via `ffmpeg-static`
(nao precisa instalar FFmpeg manualmente na maioria dos casos).

## Configuracao (`.env`)

Veja `.env.example` para a lista completa e comentada de variaveis. As
principais:

- `BOT_NAME`: nome exibido pelo bot. Unico lugar que precisa ser mudado.
- `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `VOICE_CHANNEL_ID`: obrigatorios.
- `TEXT_CHANNEL_ID`: opcional, canal de texto tradicional para avisos (NAO e
  o "chat" associado automaticamente a um canal de voz - a API do Discord
  nao garante isso de forma simples, por isso usamos um canal de texto
  configurado explicitamente).
- `DEFAULT_STATION`, `STATIONS_PATH`, `SHUFFLE_ENABLED`, `AVOID_IMMEDIATE_REPEAT`,
  `VOLUME`, `AUTO_RECONNECT`, `FFMPEG_PATH`: comportamento da radio.
- `PUBLIC_STATION_SWITCH_ENABLED` e as variaveis de cooldown: controlam se
  usuarios comuns podem usar `/estacao` para trocar de estacao.

## Estrutura de estacoes

Cada subpasta dentro de `stations/` e uma estacao:

- **Estacao local**: contem arquivos `.mp3` (qualquer nome). Musicas nao-mp3
  sao ignoradas. Uma pasta vazia fica marcada como "indisponivel", mas nao
  derruba o bot.
- **Estacao de stream**: contem um arquivo chamado `stream.url` com a URL
  HTTP(S) do stream (ex: Icecast/Shoutcast) na primeira linha.

Nenhum arquivo MP3 real deve ser commitado no repositorio (ver `.gitignore`).

## Comandos

**Publicos**
- `/nowplaying` — mostra estacao e musica atual.
- `/estacoes` — lista estacoes e quantidade de musicas (ou indica "ao vivo").
- `/fila` — previsao das proximas musicas (nao e uma fila garantida).
- `/historico` — ultimas musicas tocadas.
- `/estacao <nome>` — troca de estacao (so funciona se `PUBLIC_STATION_SWITCH_ENABLED=true`, com cooldown).

**Administradores** (`PermissionFlagsBits.Administrator`)
- `/station <nome>` — troca de estacao sem cooldown.
- `/skip` — pula a musica atual.
- `/reload` — recarrega estacoes/musicas sem reiniciar o bot.
- `/radio` — status geral.
- `/volume <valor>` — ajusta volume (0 a 2).
- `/shuffle <true|false>` — ativa/desativa modo aleatorio.
- `/reconnect` — forca reconexao de voz.
- `/addstream <nome> <url>` — adiciona uma estacao de stream generico (URLs do
  YouTube sao rejeitadas nesta versao - ver secao "Open Source" abaixo).

## Comportamento sem musicas

Se nenhuma estacao tiver musicas/stream valido, o bot **continua online e
conectado** ao canal de voz, entra em estado de espera e loga:

```
[radio] nenhuma musica disponivel no momento
[radio] aguardando /reload ou novas musicas
```

Assim que arquivos forem adicionados, rode `/reload` para retomar a
reproducao automaticamente. O bot nunca encerra o processo por falta de
conteudo.

## Diagnostico: "logs normais, mas sem som"

Se o bot parece conectado mas nenhum audio sai no canal, o problema
geralmente esta na etapa UDP da conexao de voz do Discord (separada do
"gateway" que aparece como conectado). O bot tenta detectar isso e loga
avisos claros. Causas comuns: firewall/antivirus bloqueando UDP, VPN, NAT
restritivo, ou instabilidade regional nos servidores de voz do Discord
(tente mudar a "Regiao" do canal de voz manualmente como teste).

## Deploy na Discloud

Este projeto inclui um `discloud.config` pronto. FFmpeg e incluso via
`ffmpeg-static`, entao normalmente nao e necessario instalar nada extra no
host.

## Open Source

O codigo-fonte deste pacote (**MEGAzFM Core**) e publico e esta hospedado
neste repositorio GitHub. Qualquer pessoa pode:

- estudar o codigo;
- fazer fork do projeto;
- modificar e adaptar o codigo, respeitando os termos da licenca que vier
  a ser definida para o projeto (ver secao "Licenca" acima);
- hospedar sua propria instancia da radio.

Esta versao publica representa o **Core** do MEGAzFM. A instancia oficial
usada pelo autor do projeto ("MEGAzFM Private") pode conter recursos
adicionais/experimentais que **nao fazem parte** deste repositorio - por
exemplo, suporte a transmissao de lives do YouTube. Esses recursos privados
nao sao distribuidos publicamente e nao sao necessarios para o
funcionamento completo do Core.

Fork, modificacao e redistribuicao sao permitidos pelos termos da licenca
MIT (ver secao "Licenca" acima).

## Fork e auto-hospedagem

Sinta-se livre para fazer fork e hospedar sua propria radio. Pontos de
atencao:
- Nao commite arquivos `.mp3` reais nem tokens/segredos.
- Reveja `.env.example` e preencha um `.env` proprio (nunca versionado).
- O hook `_resolveStreamSource()` em `src/radio/player.js` pode ser
  estendido (por composicao/subclasse) caso queira adicionar suporte a
  outras fontes de audio, sem precisar modificar o restante do codigo.
