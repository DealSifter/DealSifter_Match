# QA Tema

Objetivo: garantir que o tema inicial, o toggle e a logo respeitam uma única fonte de verdade (`themeService`) sem flash escuro/claro indevido.

## Refresh em light

Pre-condição:
- No console do navegador: `localStorage.setItem('ds_theme', 'light')`.

Passos:
1. Recarregar a página com refresh normal.
2. Recarregar com hard refresh.
3. Repetir em desktop e mobile.

Resultado esperado:
- O primeiro frame já aparece claro.
- Não aparece fundo escuro por nenhuma fração de segundo.
- O splash usa fundo claro, gradiente claro e texto visível.

## Refresh em dark

Pre-condição:
- No console do navegador: `localStorage.setItem('ds_theme', 'dark')`.

Passos:
1. Recarregar a página com refresh normal.
2. Recarregar com hard refresh.
3. Repetir em desktop e mobile.

Resultado esperado:
- O primeiro frame já aparece escuro.
- Não aparece fundo claro antes do tema escuro.
- O splash usa fundo escuro, gradiente escuro e texto visível.

## Toggle desktop

Passos:
1. Abrir o app em desktop.
2. Clicar no botão de tema do header.
3. Clicar novamente.

Resultado esperado:
- O tema muda imediatamente.
- O ícone mostra a próxima ação correta: lua quando o tema atual é claro, sol quando o tema atual é escuro.
- Após refresh, o tema escolhido permanece.

## Toggle hamburger mobile

Passos:
1. Abrir o app em viewport mobile.
2. Abrir o menu hamburger.
3. Clicar no botão de tema.
4. Fechar e abrir o menu novamente.

Resultado esperado:
- O tema muda imediatamente.
- O texto do botão mostra a próxima ação correta.
- Após refresh, o tema escolhido permanece.

## Logo mobile claro/escuro

Passos:
1. Em tema claro, abrir o app no mobile.
2. Verificar a logo no header.
3. Alternar para tema escuro.
4. Verificar novamente a logo.

Resultado esperado:
- Tema claro usa `/logo tema branco.png`.
- Tema escuro usa `/logo tema preto.png`.
- A homepage pública continua usando a versão clara quando for forçada para landing/pricing público.
