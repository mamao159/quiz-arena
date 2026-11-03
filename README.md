# Quiz Arena

Sistema de disputa de botão entre duas equipes, com painel para TV/administrador e celulares, usando GitHub Pages + Supabase.

## 1. Configurar o Supabase

1. Crie um projeto no Supabase.
2. Abra **SQL Editor > New query**.
3. Cole todo o conteúdo de `database.sql` e execute.
4. Abra **Database > Publications** e habilite a tabela `rooms` na publicação `supabase_realtime`.
5. Em **Project Settings > API**, copie a Project URL e a chave `anon`/`publishable`.

## 2. Configurar o projeto

Edite `config.js` e substitua:
- `COLE_AQUI_A_URL_DO_PROJETO`
- `COLE_AQUI_A_CHAVE_ANON_PUBLICA`

Use somente a chave pública anon/publishable no navegador. **Nunca coloque a `service_role` key no GitHub.**

## 3. Publicar no GitHub Pages

1. Crie um repositório chamado `quiz-arena`.
2. Envie todos os arquivos desta pasta para a raiz do repositório.
3. No GitHub, abra **Settings > Pages**.
4. Em **Build and deployment**, selecione **Deploy from a branch**.
5. Escolha `main` e `/ (root)`, depois salve.
6. Aguarde a publicação.

## 4. Usar

1. Abra `https://SEU_USUARIO.github.io/quiz-arena/tela.html`.
2. Clique em **Criar sala**.
3. Compartilhe os links dos celulares com as equipes.
4. Use o link administrativo na TV/computador para cadastrar a pergunta e liberar os botões.

## Segurança e limitações da primeira versão

- O link administrativo contém um token secreto aleatório. Não compartilhe esse link com as equipes.
- O banco guarda somente o hash do token administrativo.
- A tabela contém apenas o estado público da partida (pergunta, pontuação e vencedor); não cadastre dados pessoais.
- A disputa é decidida por uma atualização atômica no banco: apenas um clique pode definir o vencedor.
- A internet e a latência de cada aparelho influenciam a chegada dos cliques ao servidor. O sistema não mede o instante físico do toque no aparelho.
- Esta versão é uma base funcional para duas equipes e uma sala por link. Teste com celulares diferentes antes de usar em evento.
