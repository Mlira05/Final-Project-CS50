# Roteiro do vídeo — My Personal Finances

Duração-alvo: 2min45s. Grave em 1080p e feche qualquer janela que contenha dados, tokens ou contas reais.

## 0:00–0:10 — Cartela obrigatória

Mostrar em tela:

- **My Personal Finances**
- **Matheus Lira**
- **GitHub:** Mlira05
- **edX:** Mlira05
- **Rio de Janeiro, Brasil**
- **Gravado em 2 de setembro de 2026**

Narração: “Este é o My Personal Finances, meu projeto final para o CS50.”

## 0:10–0:28 — O problema

Mostrar rapidamente a tela de login e entrar no perfil `Principal` com o PIN demonstrativo `2026`.

Narração: “Receitas, despesas e metas normalmente ficam espalhadas entre bancos e planilhas. Eu criei uma aplicação que reúne essas informações e transforma registros isolados em uma visão mensal compreensível.”

## 0:28–0:58 — Dashboard

Mostrar os cartões de renda, despesas e saldo; depois passar pelos gráficos e pelos insights.

Narração: “O dashboard consulta uma base D1 e calcula renda, gastos, saldo e distribuição por categoria. Os insights são determinísticos: cada sugestão pode ser explicada pelos números visíveis, sem enviar dados financeiros a um modelo generativo.”

## 0:58–1:25 — Despesas e recorrência

Abrir **Despesas**, criar uma despesa pequena e demonstrativa e marcar recorrência se houver tempo. Aplicar um filtro de categoria.

Narração: “Entradas manuais aceitam categoria, data, forma de pagamento e recorrência. O servidor valida os dados e usa consultas preparadas. Ao editar uma série recorrente, os registros passados são preservados.”

## 1:25–1:52 — Metas

Abrir **Metas**, selecionar “Reserva de emergência” e adicionar uma contribuição demonstrativa.

Narração: “Metas possuem valor-alvo, prazo, prioridade e contribuições. A aplicação recalcula o progresso e quanto ainda precisa ser reservado, conectando o orçamento do mês a um objetivo concreto.”

## 1:52–2:18 — Transações e Open Finance

Mostrar a lista de transações e o editor de categoria. Depois abrir rapidamente **Ajustes → Open Finance**, sem conectar uma conta real.

Narração: “A arquitetura também suporta importação por perfil. A sincronização usa uma janela incremental com sobreposição e deduplicação. A categoria original é preservada, e uma correção feita pelo usuário nunca é sobrescrita por importações futuras.”

## 2:18–2:40 — Arquitetura

Mostrar brevemente o GitHub ou um slide simples com: React → Pages Functions → D1.

Narração: “React e TypeScript formam a interface. Cloudflare Pages Functions concentram autenticação e regras de negócio, e D1 armazena os dados. Sessões usam cookies HTTP-only assinados, e credenciais opcionais permanecem somente no servidor.”

## 2:40–2:55 — Encerramento

Voltar ao dashboard.

Narração: “Para a demonstração do CS50, criei uma implantação isolada com dados inteiramente fictícios. O resultado é uma ferramenta que transforma movimentações financeiras em decisões mais claras. Este foi o My Personal Finances.”

## Checklist antes de publicar

- Manter o vídeo com no máximo 3 minutos.
- Confirmar que somente dados sintéticos aparecem.
- Publicar no YouTube como **público** ou **não listado**, nunca privado.
- Depois de publicar, executar `npm run finalize:cs50 -- "URL_DO_VIDEO"` para registrar a URL no README e validar o projeto.
