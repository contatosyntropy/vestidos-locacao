# Gestão de locação de vestidos — estrutura inicial

Aplicação web responsiva em React + TypeScript + Vite, preparada para Supabase/PostgreSQL.

## O que existe nesta primeira versão

- Painel inicial com pedidos e contagem de provas pendentes.
- Formulário de pedido com nome, CPF, descrição e código da peça, datas, atendente e valor total.
- Cálculo da prova (25 dias antes do evento).
- Cálculo do bloqueio da peça (10 dias antes até 10 dias depois, inclusive).
- Geração local de contrato PDF de demonstração.
- Atualização do estado da prova para “agendada” ou “realizada”.
- Esquema SQL inicial para pedidos, pagamentos, contratos e log de notificações.
- Modo demonstração sem Supabase: os pedidos são temporários e se perdem ao recarregar.

## O que ainda NÃO está pronto

- Autenticação e políticas de acesso seguras.
- Tela/fluxo completo de pagamentos e cálculo do saldo a partir do histórico.
- Calendário de disponibilidade.
- Rotina diária confiável de lembretes.
- Web Push real, incluindo cadastro de dispositivos e permissões.
- Armazenamento privado de contratos, assinatura e revisão jurídica do texto.
- Testes automatizados e validação de produção.

**Não cadastre dados reais de clientes até configurar autenticação e segurança do banco.** O CPF é dado pessoal e o sistema não deve ficar aberto publicamente.

## Requisitos

- Node.js LTS (para rodar localmente) e npm.
- Conta Supabase.
- Conta de hospedagem compatível com Vite (por exemplo, Vercel ou Cloudflare Pages).

## Rodar localmente

1. Instale Node.js LTS: https://nodejs.org/
2. Extraia o ZIP e abra a pasta no terminal.
3. Execute `npm install`.
4. Copie `.env.example` para `.env.local`.
5. Preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os dados do projeto Supabase.
6. Execute `npm run dev` e abra o endereço mostrado pelo terminal.

Sem variáveis do Supabase, a interface abre em modo demonstração.

## Preparar o Supabase

1. Crie um projeto em https://supabase.com/.
2. Abra **SQL Editor** e execute `supabase/migrations/001_initial_schema.sql`.
3. Antes de usar dados reais, implemente autenticação e políticas RLS. A migration ativa RLS e deliberadamente não cria políticas públicas.
4. Copie a URL e a chave pública (anon/publishable) para `.env.local`.
5. **Nunca** coloque a `service_role`/secret key em código frontend, variáveis `VITE_*`, repositório ou mensagens.

A constraint de sobreposição usa `dress_code` como identidade da peça. Cada vestido físico precisa ter um código único e consistente. Pedidos em rascunho/cancelados não bloqueiam a peça.

## Publicar gratuitamente (quando pronto)

- Crie um repositório GitHub privado.
- Importe o repositório em um provedor de hospedagem estática compatível com Vite.
- Build command: `npm run build`
- Output directory: `dist`
- Configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas variáveis de ambiente do provedor.
- Faça o deploy e teste a URL em computador e celular.

Planos gratuitos e limites mudam; confirme os limites atuais de hospedagem e banco antes de decidir. Hospedagem gratuita não significa disponibilidade garantida nem backups automáticos.

## Regras de negócio planejadas

- Evento em 17/12: peça bloqueada de 07/12 a 27/12, inclusive.
- Prova final prevista 25 dias antes do evento.
- Lembretes diários devem parar quando a prova for agendada e encerrar ao marcar como realizada.
- Para lembretes fora do app, implementar Web Push com consentimento e permissão do navegador. A entrega depende do dispositivo/navegador e não deve ser tratada como garantida.
- A aplicação deve validar disponibilidade também no banco, não apenas na interface.

## Próximas entregas recomendadas

1. Segurança de acesso e RLS.
2. Fluxo completo de pagamentos e saldo.
3. Calendário/consulta de disponibilidade por código da peça.
4. Geração e armazenamento privado do contrato final.
5. Edge Function + agendamento diário para lembretes; Web Push.
6. Testes de conflito de datas, cancelamento, fuso horário e backup/exportação.
