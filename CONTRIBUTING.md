# Contribuindo

Obrigado pelo interesse no MEGAzFM Core. Contribuições devem ser compatíveis
com o objetivo deste repositório: uma versão pública, Open Source, do bot de
rádio para Discord.

## Preparar uma contribuição

1. Faça um Fork deste repositório pelo GitHub.
2. No seu Fork, clique em **Code** e copie a URL HTTPS. No terminal, execute
  `git clone` seguido dessa URL. Depois, entre na pasta do repositório:

   ```bash
   cd MEGAzFM-DCBot
   ```

3. Crie uma branch para sua alteração, por exemplo:

   ```bash
   git switch -c docs/descricao-curta
   ```

4. Para executar o bot, instale as dependências com `npm install` e configure
   um `.env` local a partir de `.env.example`. Nunca inclua esse arquivo no
   commit.

## Commits e Pull Requests

Prefira commits curtos com uma mensagem clara. Um padrão como Conventional
Commits é recomendado, mas não obrigatório: `docs: clarify setup` ou
`fix: handle empty station`.

Abra o Pull Request do seu Fork para a branch `main` deste repositório. Na
descrição, explique o problema ou objetivo, resuma a alteração e informe como
validou o resultado. Não há uma suíte automatizada de testes configurada nos
scripts atuais do projeto; quando fizer sentido, descreva também os testes
manuais realizados. Não inclua tokens em logs, capturas de tela ou exemplos.

## Bugs e sugestões

Abra uma [Issue](https://github.com/oNickyz/MEGAzFM-DCBot/issues) com passos
para reproduzir o bug, o comportamento esperado e o que aconteceu. Para sugerir
uma funcionalidade, explique o caso de uso e como ela se encaixa no Core.

## Segurança e escopo

- Nunca envie tokens do Discord, credenciais, cookies, arquivos `.env` ou
  URLs privadas de streams. Remova também esses dados de logs e capturas.
- Não adicione arquivos de áudio sem autorização para distribuí-los. Os MP3
  locais não devem ser commitados.
- O **MEGAzFM Core** é a versão pública Open Source, distribuída sob a MIT
  License. A instância **MEGAzFM Private/Official** pode ter recursos
  adicionais, experimentais ou integrações que não fazem parte deste
  repositório. Não inclua código, credenciais ou funcionalidades privadas
  apenas para aproximar as duas versões.
- As contribuições devem permanecer compatíveis com o propósito do Core e
  com os termos da MIT License.