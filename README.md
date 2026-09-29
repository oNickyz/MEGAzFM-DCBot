# MEGAzFM Core - (Open Source Version)

Bot Discord leve e estável para rodar uma rádio 24/7 em um canal de voz, tocando
arquivos MP3 locais e/ou estações de stream online (Icecast/Shoutcast).

Este é o pacote **Open Source** do projeto MEGAzFM. Ele contém apenas os
recursos públicos: reprodução de MP3, sistema de estações, fila/histórico,
volume, shuffle, reconexão de voz e os comandos principais.

> Uma instância privada ("MEGAzFM Private/Official") pode existir separadamente,
> reutilizando este pacote como dependência e adicionando recursos extras
> (por exemplo, suporte a lives do YouTube) que **não fazem parte** deste
> repositório público. Ver a seção "Open Source" abaixo.

## Licença

Este projeto é distribuído sob a **licença MIT** (ver arquivo `LICENSE` na
raiz do repositório). Em resumo: qualquer pessoa pode usar, copiar,
modificar, fazer fork e redistribuir este código, inclusive para fins
comerciais, desde que mantenha o aviso de copyright original. O software é
fornecido "como está", sem garantias.

## Instalação

```bash
git clone <url-do-repositorio>
cd megazfm-core
npm install
cp .env.example .env
# edite o .env com os dados do seu bot
npm start
```

Requisitos: Node.js 18+. FFmpeg é incluso automaticamente via `ffmpeg-static`
(não precisa instalar FFmpeg manualmente na maioria dos casos).

## Configuração (`.env`)

Veja `.env.example` para a lista completa e comentada de variáveis. As
principais:

- `BOT_NAME`: nome exibido pelo bot. Único lugar que precisa ser mudado.
- `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `VOICE_CHANNEL_ID`: obrigatórios.
- `TEXT_CHANNEL_ID`: opcional, canal de texto tradicional para avisos (NÃO é
  o "chat" associado automaticamente a um canal de voz - a API do Discord
  não garante isso de forma simples, por isso usamos um canal de texto
  configurado explicitamente).
- `DEFAULT_STATION`, `STATIONS_PATH`, `SHUFFLE_ENABLED`, `AVOID_IMMEDIATE_REPEAT`,
  `VOLUME`, `AUTO_RECONNECT`, `FFMPEG_PATH`: comportamento da rádio.
- `PUBLIC_STATION_SWITCH_ENABLED` e as variáveis de cooldown: controlam se
  usuários comuns podem usar `/estacao` para trocar de estação.

## Estrutura de estações

Cada subpasta dentro de `stations/` é uma estação:

- **Estação local**: contém arquivos `.mp3` (qualquer nome). Músicas não-mp3
  são ignoradas. Uma pasta vazia fica marcada como "indisponível", mas não
  derruba o bot.
- **Estação de stream**: contém um arquivo chamado `stream.url` com a URL
  HTTP(S) do stream (ex: Icecast/Shoutcast) na primeira linha.

Nenhum arquivo MP3 real deve ser commitado no repositório (ver `.gitignore`).

## Comandos

**Públicos**
- `/nowplaying` — mostra estação e música atual.
- `/estacoes` — lista estações e quantidade de músicas (ou indica "ao vivo").
- `/fila` — previsão das próximas músicas (não é uma fila garantida).
- `/historico` — últimas músicas tocadas.
- `/estacao <nome>` — troca de estação (só funciona se `PUBLIC_STATION_SWITCH_ENABLED=true`, com cooldown).

**Administradores** (`PermissionFlagsBits.Administrator`)
- `/station <nome>` — troca de estação sem cooldown.
- `/skip` — pula a música atual.
- `/reload` — recarrega estações/músicas sem reiniciar o bot.
- `/radio` — status geral.
- `/volume <valor>` — ajusta volume (0 a 2).
- `/shuffle <true|false>` — ativa/desativa modo aleatório.
- `/reconnect` — força reconexão de voz.
- `/addstream <nome> <url>` — adiciona uma estação de stream genérico (URLs do
  YouTube são rejeitadas nesta versão - ver seção "Open Source" abaixo).

## Comportamento sem músicas

Se nenhuma estação tiver músicas/stream válido, o bot **continua online e
conectado** ao canal de voz, entra em estado de espera e loga:

```
[radio] nenhuma música disponível no momento
[radio] aguardando /reload ou novas músicas
```

Assim que arquivos forem adicionados, rode `/reload` para retomar a
reprodução automaticamente. O bot nunca encerra o processo por falta de
conteúdo.

## Diagnóstico: "logs normais, mas sem som"

Se o bot parece conectado mas nenhum áudio sai no canal, o problema
geralmente está na etapa UDP da conexão de voz do Discord (separada do
"gateway" que aparece como conectado). O bot tenta detectar isso e loga
avisos claros. Causas comuns: firewall/antivirus bloqueando UDP, VPN, NAT
restritivo, ou instabilidade regional nos servidores de voz do Discord
(tente mudar a "Região" do canal de voz manualmente como teste).

## Deploy na Discloud

Este projeto inclui um `discloud.config` pronto. FFmpeg é incluso via
`ffmpeg-static`, então normalmente não é necessário instalar nada extra no
host.

## Open Source

O código-fonte deste pacote (**MEGAzFM Core**) é público e está hospedado
neste repositório GitHub. Qualquer pessoa pode:

- estudar o código;
- fazer fork do projeto;
- modificar e adaptar o código, respeitando os termos da licença que vier
a ser definida para o projeto (ver seção "Licença" acima);
- hospedar sua própria instância da rádio.

Esta versão pública representa o **Core** do MEGAzFM. A instância oficial
usada pelo autor do projeto ("MEGAzFM Private") pode conter recursos
adicionais/experimentais que **não fazem parte** deste repositório - por
exemplo, suporte à transmissão de lives do YouTube. Esses recursos privados
não são distribuídos publicamente e não são necessários para o
funcionamento completo do Core.

Fork, modificação e redistribuição são permitidos pelos termos da licença
MIT (ver seção "Licença" acima).

## Fork e auto-hospedagem

Sinta-se livre para fazer fork e hospedar sua própria rádio. Pontos de
atenção:
- Não commite arquivos `.mp3` reais nem tokens/segredos.
- Reveja `.env.example` e preencha um `.env` próprio (nunca versionado).
- O hook `_resolveStreamSource()` em `src/radio/player.js` pode ser
  estendido (por composição/subclasse) caso queira adicionar suporte a
  outras fontes de áudio, sem precisar modificar o restante do código.
