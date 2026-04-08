// ─── Mock de Dados - Painel de Vendas (Demo) ───
// Ativar: localStorage.setItem('demo_mode', 'true') ou ?demo=true na URL

const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0];
const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
const fourDaysAgo = new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0];
const fiveDaysAgo = new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0];
const sixDaysAgo = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];

// ─── Vendedoras ───
const SELLERS = [
  { id: 1, user_id: 101, name: 'Ana Beatriz', email: 'ana@empresa.com', shift: 'completo', monthly_goal_leads: 800, monthly_goal_sales: 120, monthly_goal_revenue: 96000, active: true, created_at: '2025-01-15T10:00:00Z' },
  { id: 2, user_id: 102, name: 'Carla Mendes', email: 'carla@empresa.com', shift: 'completo', monthly_goal_leads: 700, monthly_goal_sales: 100, monthly_goal_revenue: 80000, active: true, created_at: '2025-02-01T10:00:00Z' },
  { id: 3, user_id: 103, name: 'Juliana Rocha', email: 'juliana@empresa.com', shift: 'manha', monthly_goal_leads: 500, monthly_goal_sales: 80, monthly_goal_revenue: 64000, active: true, created_at: '2025-03-10T10:00:00Z' },
  { id: 4, user_id: 104, name: 'Fernanda Lima', email: 'fernanda@empresa.com', shift: 'completo', monthly_goal_leads: 600, monthly_goal_sales: 90, monthly_goal_revenue: 72000, active: true, created_at: '2025-04-01T10:00:00Z' },
  { id: 5, user_id: 105, name: 'Patricia Santos', email: 'patricia@empresa.com', shift: 'manha', monthly_goal_leads: 450, monthly_goal_sales: 70, monthly_goal_revenue: 56000, active: true, created_at: '2025-05-15T10:00:00Z' },
  { id: 6, user_id: 106, name: 'Mariana Costa', email: 'mariana@empresa.com', shift: 'completo', monthly_goal_leads: 650, monthly_goal_sales: 95, monthly_goal_revenue: 76000, active: false, created_at: '2025-01-20T10:00:00Z' },
];

// ─── Relatorios de vendas (historico) ───
const REPORTS = [
  // Hoje - manha
  { id: 1, seller_id: 1, report_date: today, report_type: 'manha', leads_received: 32, leads_responded: 28, conversions: 9, sales_closed: 6, revenue: 4920, notes: 'Dia bom, muitos leads qualificados do Instagram.', created_at: today + 'T14:05:00Z' },
  { id: 2, seller_id: 2, report_date: today, report_type: 'manha', leads_received: 28, leads_responded: 25, conversions: 7, sales_closed: 5, revenue: 3750, notes: 'Leads do Google Ads converteram bem.', created_at: today + 'T14:10:00Z' },
  { id: 3, seller_id: 3, report_date: today, report_type: 'manha', leads_received: 22, leads_responded: 20, conversions: 6, sales_closed: 4, revenue: 3280, notes: '', created_at: today + 'T14:02:00Z' },
  { id: 4, seller_id: 4, report_date: today, report_type: 'manha', leads_received: 26, leads_responded: 22, conversions: 8, sales_closed: 5, revenue: 4100, notes: 'Algumas objecoes sobre preco, mas fechei bem.', created_at: today + 'T14:15:00Z' },
  { id: 5, seller_id: 5, report_date: today, report_type: 'manha', leads_received: 18, leads_responded: 16, conversions: 5, sales_closed: 3, revenue: 2460, notes: 'Turno mais fraco, trafego baixo pela manha.', created_at: today + 'T14:00:00Z' },

  // Hoje - completo (somente quem ja enviou)
  { id: 6, seller_id: 1, report_date: today, report_type: 'completo', leads_received: 58, leads_responded: 52, conversions: 18, sales_closed: 12, revenue: 9840, notes: 'Melhor dia do mes! Promos de abril pegaram.', created_at: today + 'T18:10:00Z' },
  { id: 7, seller_id: 2, report_date: today, report_type: 'completo', leads_received: 51, leads_responded: 46, conversions: 14, sales_closed: 10, revenue: 7500, notes: 'Boa performance, leads da tarde estavam quentes.', created_at: today + 'T18:15:00Z' },

  // Ontem
  { id: 8, seller_id: 1, report_date: yesterday, report_type: 'manha', leads_received: 30, leads_responded: 27, conversions: 8, sales_closed: 5, revenue: 4100, notes: '', created_at: yesterday + 'T14:00:00Z' },
  { id: 9, seller_id: 1, report_date: yesterday, report_type: 'completo', leads_received: 55, leads_responded: 48, conversions: 16, sales_closed: 11, revenue: 9020, notes: '', created_at: yesterday + 'T18:00:00Z' },
  { id: 10, seller_id: 2, report_date: yesterday, report_type: 'completo', leads_received: 48, leads_responded: 42, conversions: 12, sales_closed: 8, revenue: 6400, notes: 'Dia razoavel.', created_at: yesterday + 'T18:00:00Z' },
  { id: 11, seller_id: 3, report_date: yesterday, report_type: 'manha', leads_received: 20, leads_responded: 18, conversions: 5, sales_closed: 3, revenue: 2460, notes: '', created_at: yesterday + 'T14:00:00Z' },
  { id: 12, seller_id: 4, report_date: yesterday, report_type: 'completo', leads_received: 50, leads_responded: 44, conversions: 15, sales_closed: 10, revenue: 8200, notes: 'Dia excelente.', created_at: yesterday + 'T18:00:00Z' },
  { id: 13, seller_id: 5, report_date: yesterday, report_type: 'manha', leads_received: 16, leads_responded: 14, conversions: 4, sales_closed: 2, revenue: 1640, notes: '', created_at: yesterday + 'T14:00:00Z' },

  // 2 dias atras
  { id: 14, seller_id: 1, report_date: twoDaysAgo, report_type: 'completo', leads_received: 52, leads_responded: 46, conversions: 15, sales_closed: 10, revenue: 8200, notes: '', created_at: twoDaysAgo + 'T18:00:00Z' },
  { id: 15, seller_id: 2, report_date: twoDaysAgo, report_type: 'completo', leads_received: 45, leads_responded: 40, conversions: 11, sales_closed: 7, revenue: 5740, notes: '', created_at: twoDaysAgo + 'T18:00:00Z' },
  { id: 16, seller_id: 3, report_date: twoDaysAgo, report_type: 'manha', leads_received: 21, leads_responded: 19, conversions: 6, sales_closed: 4, revenue: 3280, notes: '', created_at: twoDaysAgo + 'T14:00:00Z' },
  { id: 17, seller_id: 4, report_date: twoDaysAgo, report_type: 'completo', leads_received: 47, leads_responded: 41, conversions: 13, sales_closed: 9, revenue: 7380, notes: '', created_at: twoDaysAgo + 'T18:00:00Z' },
  { id: 18, seller_id: 5, report_date: twoDaysAgo, report_type: 'manha', leads_received: 17, leads_responded: 15, conversions: 4, sales_closed: 3, revenue: 2460, notes: '', created_at: twoDaysAgo + 'T14:00:00Z' },

  // 3-6 dias atras (resumo)
  { id: 19, seller_id: 1, report_date: threeDaysAgo, report_type: 'completo', leads_received: 54, leads_responded: 49, conversions: 17, sales_closed: 11, revenue: 9020, notes: '', created_at: threeDaysAgo + 'T18:00:00Z' },
  { id: 20, seller_id: 2, report_date: threeDaysAgo, report_type: 'completo', leads_received: 46, leads_responded: 41, conversions: 13, sales_closed: 9, revenue: 7380, notes: '', created_at: threeDaysAgo + 'T18:00:00Z' },
  { id: 21, seller_id: 3, report_date: threeDaysAgo, report_type: 'manha', leads_received: 19, leads_responded: 17, conversions: 5, sales_closed: 3, revenue: 2460, notes: '', created_at: threeDaysAgo + 'T14:00:00Z' },
  { id: 22, seller_id: 4, report_date: threeDaysAgo, report_type: 'completo', leads_received: 49, leads_responded: 43, conversions: 14, sales_closed: 9, revenue: 7380, notes: '', created_at: threeDaysAgo + 'T18:00:00Z' },
  { id: 23, seller_id: 5, report_date: threeDaysAgo, report_type: 'manha', leads_received: 15, leads_responded: 13, conversions: 4, sales_closed: 2, revenue: 1640, notes: '', created_at: threeDaysAgo + 'T14:00:00Z' },

  { id: 24, seller_id: 1, report_date: fourDaysAgo, report_type: 'completo', leads_received: 50, leads_responded: 45, conversions: 14, sales_closed: 9, revenue: 7380, notes: '', created_at: fourDaysAgo + 'T18:00:00Z' },
  { id: 25, seller_id: 2, report_date: fourDaysAgo, report_type: 'completo', leads_received: 44, leads_responded: 38, conversions: 10, sales_closed: 7, revenue: 5740, notes: '', created_at: fourDaysAgo + 'T18:00:00Z' },
  { id: 26, seller_id: 4, report_date: fourDaysAgo, report_type: 'completo', leads_received: 48, leads_responded: 42, conversions: 13, sales_closed: 8, revenue: 6560, notes: '', created_at: fourDaysAgo + 'T18:00:00Z' },

  { id: 27, seller_id: 1, report_date: fiveDaysAgo, report_type: 'completo', leads_received: 48, leads_responded: 43, conversions: 13, sales_closed: 8, revenue: 6560, notes: '', created_at: fiveDaysAgo + 'T18:00:00Z' },
  { id: 28, seller_id: 2, report_date: fiveDaysAgo, report_type: 'completo', leads_received: 42, leads_responded: 37, conversions: 10, sales_closed: 6, revenue: 4920, notes: '', created_at: fiveDaysAgo + 'T18:00:00Z' },
  { id: 29, seller_id: 4, report_date: fiveDaysAgo, report_type: 'completo', leads_received: 45, leads_responded: 39, conversions: 12, sales_closed: 8, revenue: 6560, notes: '', created_at: fiveDaysAgo + 'T18:00:00Z' },

  { id: 30, seller_id: 1, report_date: sixDaysAgo, report_type: 'completo', leads_received: 51, leads_responded: 46, conversions: 15, sales_closed: 10, revenue: 8200, notes: '', created_at: sixDaysAgo + 'T18:00:00Z' },
  { id: 31, seller_id: 2, report_date: sixDaysAgo, report_type: 'completo', leads_received: 47, leads_responded: 42, conversions: 12, sales_closed: 8, revenue: 6560, notes: '', created_at: sixDaysAgo + 'T18:00:00Z' },
  { id: 32, seller_id: 4, report_date: sixDaysAgo, report_type: 'completo', leads_received: 46, leads_responded: 40, conversions: 13, sales_closed: 9, revenue: 7380, notes: '', created_at: sixDaysAgo + 'T18:00:00Z' },
];

// ─── Chat Messages ───
const CHAT_MESSAGES = [
  { id: 1, user_id: 101, user_name: 'Ana Beatriz', user_role: 'vendedora', content: 'Bom dia equipe! Alguem mais notou que os leads do Instagram estao vindo mais qualificados essa semana?', pinned: false, reply_to: null, reply_content: null, reply_user_name: null, created_at: today + 'T09:15:00Z', updated_at: null },
  { id: 2, user_id: 102, user_name: 'Carla Mendes', user_role: 'vendedora', content: 'Sim! Acho que a Sara ajustou a segmentacao da campanha. Os leads estao perguntando direto sobre o plano premium.', pinned: false, reply_to: 1, reply_content: 'Bom dia equipe! Alguem mais notou que os leads do Instagram estao vindo mais qualificados essa semana?', reply_user_name: 'Ana Beatriz', created_at: today + 'T09:22:00Z', updated_at: null },
  { id: 3, user_id: 200, user_name: 'Sara', user_role: 'sales_admin', content: 'Correto meninas! Mudei o publico-alvo para mulheres 25-45 que ja seguem perfis de concorrentes. O CPA caiu 30% e a qualidade subiu muito.', pinned: true, reply_to: null, reply_content: null, reply_user_name: null, created_at: today + 'T09:30:00Z', updated_at: null },
  { id: 4, user_id: 104, user_name: 'Fernanda Lima', user_role: 'vendedora', content: '@Todas dica: quando o lead pergunta sobre desconto, mostra o comparativo de valor com a concorrencia. Fechei 3 vendas assim hoje de manha!', pinned: true, reply_to: null, reply_content: null, reply_user_name: null, created_at: today + 'T10:45:00Z', updated_at: null },
  { id: 5, user_id: 103, user_name: 'Juliana Rocha', user_role: 'vendedora', content: '@Fernanda Vou testar! Tenho 2 leads que pediram desconto e eu nao soube o que responder.', pinned: false, reply_to: 4, reply_content: '@Todas dica: quando o lead pergunta sobre desconto...', reply_user_name: 'Fernanda Lima', created_at: today + 'T10:52:00Z', updated_at: null },
  { id: 6, user_id: 105, user_name: 'Patricia Santos', user_role: 'vendedora', content: '@Sara alguem sabe se o link de pagamento do plano anual esta funcionando? Uma cliente reclamou que deu erro.', pinned: false, reply_to: null, reply_content: null, reply_user_name: null, created_at: today + 'T11:30:00Z', updated_at: null },
  { id: 7, user_id: 200, user_name: 'Sara', user_role: 'sales_admin', content: '@Patricia acabei de verificar - o link estava com problema no gateway. Ja corrigi. Pode mandar de novo pra ela.', pinned: false, reply_to: 6, reply_content: '@Sara alguem sabe se o link de pagamento...', reply_user_name: 'Patricia Santos', created_at: today + 'T11:38:00Z', updated_at: null },
  { id: 8, user_id: 101, user_name: 'Ana Beatriz', user_role: 'vendedora', content: 'AEEE! Acabei de bater minha meta do dia! 12 vendas e quase R$ 10k de faturamento! O melhor dia do mes ate agora!', pinned: false, reply_to: null, reply_content: null, reply_user_name: null, created_at: today + 'T17:50:00Z', updated_at: null },
  { id: 9, user_id: 200, user_name: 'Sara', user_role: 'sales_admin', content: 'Parabens @Ana Beatriz!! Voce ta voando esse mes! Ranking atualizado, voce ta em primeiro lugar disparada. @Todas vejam o exemplo!', pinned: false, reply_to: 8, reply_content: 'AEEE! Acabei de bater minha meta do dia!...', reply_user_name: 'Ana Beatriz', created_at: today + 'T17:55:00Z', updated_at: null },
  { id: 10, user_id: 102, user_name: 'Carla Mendes', user_role: 'vendedora', content: 'Parabens Ana! Vou tentar te alcancer amanha hahaha', pinned: false, reply_to: null, reply_content: null, reply_user_name: null, created_at: today + 'T18:02:00Z', updated_at: null },
];

// ─── Knowledge Base ───
const KB_CATEGORIES = [
  { id: 1, name: 'Scripts de Vendas', description: 'Scripts e roteiros para abordagem', article_count: 4, created_at: '2025-12-01T10:00:00Z' },
  { id: 2, name: 'Objecoes e Respostas', description: 'Como lidar com objecoes comuns', article_count: 3, created_at: '2025-12-01T10:00:00Z' },
  { id: 3, name: 'Produtos e Planos', description: 'Informacoes sobre produtos e precos', article_count: 2, created_at: '2025-12-05T10:00:00Z' },
  { id: 4, name: 'Regras e Processos', description: 'Processos internos da equipe', article_count: 2, created_at: '2025-12-10T10:00:00Z' },
];

const KB_ARTICLES = [
  { id: 1, category_id: 1, title: 'Script de Primeiro Contato - WhatsApp', content: '## Primeiro Contato\n\nOi [NOME]! Tudo bem? Vi que voce se cadastrou no nosso site.\n\nSou a [SEU NOME] e vou te ajudar a encontrar o melhor plano pra voce!\n\nMe conta, o que te chamou mais atencao nos nossos produtos?\n\n---\n\n**Dicas:**\n- Sempre personalize com o nome\n- Responda em ate 5 minutos\n- Use emojis com moderacao\n- Nao envie audio no primeiro contato', author_name: 'Sara', pinned: true, created_at: '2025-12-01T10:00:00Z', updated_at: '2026-03-15T14:00:00Z' },
  { id: 2, category_id: 1, title: 'Script de Follow-up (24h)', content: '## Follow-up 24h\n\nOi [NOME], tudo bem?\n\nOntem voce demonstrou interesse no [PRODUTO]. Queria saber se ficou alguma duvida?\n\nTemos uma condicao especial que vale ate hoje! Posso te mostrar?\n\n---\n\n**Regra:** Maximo 2 follow-ups. Se nao responder em 48h, classificar como lead frio.', author_name: 'Sara', pinned: false, created_at: '2025-12-02T10:00:00Z', updated_at: null },
  { id: 3, category_id: 1, title: 'Script de Fechamento', content: '## Fechamento\n\nEntao [NOME], vamos garantir sua vaga?\n\nO plano [PLANO] esta por [VALOR] e voce ja pode comecar a usar hoje mesmo!\n\nVou te enviar o link de pagamento agora, tudo bem?\n\n---\n\n**Dicas:**\n- Sempre confirme o plano escolhido\n- Envie o link logo apos a confirmacao\n- Acompanhe se o pagamento foi concluido em 30min', author_name: 'Sara', pinned: false, created_at: '2025-12-03T10:00:00Z', updated_at: null },
  { id: 4, category_id: 1, title: 'Script de Reativacao de Lead Frio', content: '## Reativacao\n\n[NOME], oi! Quanto tempo!\n\nVi que voce se interessou pelo nosso produto ha um tempo. Temos novidades incriveis que acho que voce vai adorar!\n\nPosso te contar rapidinho?', author_name: 'Ana Beatriz', pinned: false, created_at: '2026-01-10T10:00:00Z', updated_at: null },
  { id: 5, category_id: 2, title: 'Objecao: "Esta caro"', content: '## Quando o lead diz que esta caro\n\n**Resposta:**\nEntendo sua preocupacao com o investimento, [NOME]. Mas vamos fazer as contas juntas?\n\nO plano [PLANO] custa [VALOR/mes], que da menos de [VALOR/dia] por dia.\n\nE comparando com [CONCORRENTE], nosso produto entrega [DIFERENCIAL] a mais pelo mesmo valor.\n\nAlem disso, estamos com uma condicao especial: [DESCONTO/BONUS].\n\n---\n\n**Nunca:** de desconto sem autorizacao da Sara', author_name: 'Sara', pinned: true, created_at: '2025-12-05T10:00:00Z', updated_at: '2026-02-20T10:00:00Z' },
  { id: 6, category_id: 2, title: 'Objecao: "Preciso pensar"', content: '## Quando o lead pede pra pensar\n\n**Resposta:**\nClaro, [NOME]! Mas me conta: o que exatamente voce precisa avaliar? Assim eu posso te ajudar com as informacoes que faltam.\n\n**Se insistir:** Sem problemas! Vou te enviar um resumo por mensagem pra voce avaliar com calma. Posso te chamar amanha?\n\n---\n\n**Dica:** O "preciso pensar" geralmente esconde uma objecao nao verbalizada. Tente identificar a objecao real.', author_name: 'Sara', pinned: false, created_at: '2025-12-06T10:00:00Z', updated_at: null },
  { id: 7, category_id: 2, title: 'Objecao: "Ja tenho outro servico"', content: '## Lead ja usa concorrente\n\n**Resposta:**\nQue bom que voce ja conhece esse tipo de servico! Fica mais facil de comparar.\n\nO que voce mais gosta no servico atual? E o que voce mudaria?\n\n*(Ouva a resposta e mostre como nosso produto resolve os pontos fracos do concorrente)*', author_name: 'Fernanda Lima', pinned: false, created_at: '2026-01-15T10:00:00Z', updated_at: null },
  { id: 8, category_id: 3, title: 'Tabela de Precos - Atualizada Abril/2026', content: '## Planos e Precos\n\n| Plano | Mensal | Trimestral | Anual |\n|-------|--------|------------|-------|\n| Basic | R$ 197 | R$ 527 (10% off) | R$ 1.890 (20% off) |\n| Pro | R$ 397 | R$ 1.070 (10% off) | R$ 3.812 (20% off) |\n| Premium | R$ 797 | R$ 2.152 (10% off) | R$ 7.652 (20% off) |\n\n**Cupom ativo:** ABRIL10 = 10% adicional no primeiro pagamento\n\n**Comissao vendedora:** 8% sobre o valor da venda', author_name: 'Sara', pinned: true, created_at: '2026-04-01T10:00:00Z', updated_at: '2026-04-05T10:00:00Z' },
  { id: 9, category_id: 3, title: 'Diferenciais do Produto', content: '## Nossos Diferenciais\n\n1. **Suporte 24/7** - Chat e WhatsApp\n2. **Garantia 30 dias** - Devolucao sem perguntas\n3. **Comunidade exclusiva** - Grupo VIP com +2000 membros\n4. **Atualizacoes semanais** - Conteudo novo toda semana\n5. **App mobile** - Acesso de qualquer lugar\n\n---\n\n**Concorrentes nao oferecem:** Itens 3, 4 e 5', author_name: 'Sara', pinned: false, created_at: '2026-02-01T10:00:00Z', updated_at: null },
  { id: 10, category_id: 4, title: 'Horarios e Regras de Atendimento', content: '## Regras Gerais\n\n- **Turno manha:** 09h-14h\n- **Turno completo:** 09h-18h\n- **Tempo maximo de resposta:** 5 minutos\n- **Relatorio manha:** enviar ate 14h30\n- **Relatorio completo:** enviar ate 18h30\n- **Folga:** 1 dia por semana (combinar com Sara)\n\n## Metricas esperadas\n- Taxa de resposta: > 85%\n- Taxa de conversao: > 15%\n- Ticket medio: > R$ 600', author_name: 'Sara', pinned: false, created_at: '2025-12-10T10:00:00Z', updated_at: '2026-03-01T10:00:00Z' },
  { id: 11, category_id: 4, title: 'Processo de Desconto e Aprovacao', content: '## Descontos\n\n**Ate 5%:** Vendedora pode aplicar sozinha\n**5% a 15%:** Precisa aprovacao da Sara via chat\n**Acima de 15%:** Nao permitido\n\n## Como solicitar\n1. Envie no chat: "DESCONTO - [NOME DO LEAD] - [% SOLICITADO] - [MOTIVO]"\n2. Aguarde aprovacao antes de oferecer ao lead\n3. Maximo 3 descontos por vendedora por semana', author_name: 'Sara', pinned: false, created_at: '2026-01-05T10:00:00Z', updated_at: null },
];

// ─── Helpers ───
function calcStats(reports, filterDate, filterShift) {
  const dayReports = reports.filter(r => {
    let match = r.report_date === filterDate;
    if (filterShift) match = match && r.report_type === filterShift;
    return match;
  });

  const activeSellers = SELLERS.filter(s => s.active);
  const daily = activeSellers.map(seller => {
    const sellerReports = dayReports.filter(r => r.seller_id === seller.id);
    const leads_received = sellerReports.reduce((s, r) => s + r.leads_received, 0);
    const leads_responded = sellerReports.reduce((s, r) => s + r.leads_responded, 0);
    const conversions = sellerReports.reduce((s, r) => s + r.conversions, 0);
    const sales_closed = sellerReports.reduce((s, r) => s + r.sales_closed, 0);
    const revenue = sellerReports.reduce((s, r) => s + r.revenue, 0);
    const conversion_rate = leads_received > 0 ? parseFloat(((sales_closed / leads_received) * 100).toFixed(1)) : 0;
    return { seller_id: seller.id, name: seller.name, avatar: null, leads_received, leads_responded, conversions, sales_closed, revenue: revenue.toFixed(2), conversion_rate };
  }).sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue));

  const totals = {
    total_leads: daily.reduce((s, d) => s + d.leads_received, 0),
    total_sales: daily.reduce((s, d) => s + d.sales_closed, 0),
    total_revenue: daily.reduce((s, d) => s + parseFloat(d.revenue), 0).toFixed(2),
  };

  // Monthly stats
  const now = new Date(filterDate + 'T12:00:00');
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const monthReports = reports.filter(r => {
    const d = new Date(r.report_date + 'T12:00:00');
    return d >= monthStart && d <= monthEnd;
  });

  const monthly = activeSellers.map(seller => {
    const sr = monthReports.filter(r => r.seller_id === seller.id);
    return {
      seller_id: seller.id,
      leads_received: sr.reduce((s, r) => s + r.leads_received, 0),
      sales_closed: sr.reduce((s, r) => s + r.sales_closed, 0),
      revenue: sr.reduce((s, r) => s + r.revenue, 0).toFixed(2),
      monthly_goal_revenue: seller.monthly_goal_revenue,
    };
  });

  // Performance Alerts (inteligentes)
  let alerts = [];
  const currentHour = new Date().getHours();

  // 1. Relatórios pendentes
  if (filterDate === today) {
    const todayR = reports.filter(r => r.report_date === today);
    if (currentHour >= 14) {
      activeSellers.forEach(s => {
        if (!todayR.some(r => r.seller_id === s.id && r.report_type === 'manha')) {
          alerts.push({ type: 'warning', msg: `${s.name} ainda nao enviou relatorio da manha` });
        }
      });
    }
    if (currentHour >= 18) {
      activeSellers.filter(s => s.shift === 'completo').forEach(s => {
        if (!todayR.some(r => r.seller_id === s.id && r.report_type === 'completo')) {
          alerts.push({ type: 'warning', msg: `${s.name} ainda nao enviou relatorio completo` });
        }
      });
    }
  }

  // 2. Conversão baixa (abaixo de 12%)
  daily.forEach(s => {
    if (s.leads_received >= 10 && parseFloat(s.conversion_rate) < 12) {
      alerts.push({ type: 'danger', msg: `${s.name} com conversao baixa hoje: ${s.conversion_rate}% (meta: 15%)` });
    }
  });

  // 3. Taxa de resposta baixa (< 80%)
  daily.forEach(s => {
    if (s.leads_received >= 10) {
      const respRate = ((s.leads_responded / s.leads_received) * 100).toFixed(1);
      if (parseFloat(respRate) < 80) {
        alerts.push({ type: 'danger', msg: `${s.name} respondeu apenas ${respRate}% dos leads hoje (minimo: 85%)` });
      }
    }
  });

  // 4. Ritmo mensal abaixo da meta (projeção)
  const daysInMonth = new Date(new Date(filterDate).getFullYear(), new Date(filterDate).getMonth() + 1, 0).getDate();
  const currentDay = new Date(filterDate).getDate();
  const expectedPct = (currentDay / daysInMonth) * 100;

  monthly.forEach(ms => {
    const seller = activeSellers.find(s => s.id === ms.seller_id);
    if (!seller || !seller.monthly_goal_revenue || parseFloat(seller.monthly_goal_revenue) === 0) return;
    const pct = (parseFloat(ms.revenue) / parseFloat(seller.monthly_goal_revenue)) * 100;
    if (pct < expectedPct * 0.6 && currentDay >= 10) {
      alerts.push({ type: 'danger', msg: `${seller.name} atingiu ${pct.toFixed(0)}% da meta mensal (esperado ~${expectedPct.toFixed(0)}% ate o dia ${currentDay})` });
    }
  });

  // 5. Destaques positivos
  daily.forEach(s => {
    if (s.leads_received >= 10 && parseFloat(s.conversion_rate) >= 25) {
      alerts.push({ type: 'success', msg: `${s.name} com excelente conversao hoje: ${s.conversion_rate}%!` });
    }
  });
  monthly.forEach(ms => {
    const seller = activeSellers.find(s => s.id === ms.seller_id);
    if (!seller || !seller.monthly_goal_revenue || parseFloat(seller.monthly_goal_revenue) === 0) return;
    const pct = (parseFloat(ms.revenue) / parseFloat(seller.monthly_goal_revenue)) * 100;
    if (pct >= 90) {
      alerts.push({ type: 'success', msg: `${seller.name} ja atingiu ${pct.toFixed(0)}% da meta mensal de faturamento!` });
    }
  });

  return { daily, monthly, totals, alerts };
}

function calcMonthlySummary(reports, month, year) {
  const activeSellers = SELLERS.filter(s => s.active);
  const monthReports = reports.filter(r => {
    const d = new Date(r.report_date + 'T12:00:00');
    return (d.getMonth() + 1) === month && d.getFullYear() === year;
  });

  const sellers = activeSellers.map(seller => {
    const sr = monthReports.filter(r => r.seller_id === seller.id);
    const leads_received = sr.reduce((s, r) => s + r.leads_received, 0);
    const leads_responded = sr.reduce((s, r) => s + r.leads_responded, 0);
    const conversions = sr.reduce((s, r) => s + r.conversions, 0);
    const sales_closed = sr.reduce((s, r) => s + r.sales_closed, 0);
    const revenue = sr.reduce((s, r) => s + r.revenue, 0);
    const conversion_rate = leads_received > 0 ? parseFloat(((sales_closed / leads_received) * 100).toFixed(1)) : 0;
    const days_reported = new Set(sr.map(r => r.report_date)).size;
    return {
      seller_id: seller.id, name: seller.name,
      leads_received, leads_responded, conversions, sales_closed,
      revenue: revenue.toFixed(2), conversion_rate, days_reported,
      monthly_goal_leads: seller.monthly_goal_leads,
      monthly_goal_sales: seller.monthly_goal_sales,
      monthly_goal_revenue: seller.monthly_goal_revenue,
    };
  }).sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue));

  const totals = {
    total_leads: sellers.reduce((s, d) => s + d.leads_received, 0),
    total_responded: sellers.reduce((s, d) => s + d.leads_responded, 0),
    total_conversions: sellers.reduce((s, d) => s + d.conversions, 0),
    total_sales: sellers.reduce((s, d) => s + d.sales_closed, 0),
    total_revenue: sellers.reduce((s, d) => s + parseFloat(d.revenue), 0).toFixed(2),
  };

  return { sellers, totals };
}

// ─── Estado mutavel (para simular submit/create) ───
let _reports = [...REPORTS];
let _sellers = [...SELLERS];
let _chatMessages = [...CHAT_MESSAGES];
let _nextReportId = 100;
let _nextChatId = 100;

// ─── Mock API Exports ───
export const mockSales = {
  sellers: async () => {
    await delay(300);
    return _sellers.filter(s => s.active !== false || true).map(s => ({ ...s }));
  },

  createSeller: async (body) => {
    await delay(400);
    const id = _sellers.length + 1;
    const newSeller = {
      id, user_id: 200 + id, name: body.name, email: body.email,
      shift: body.shift || 'completo',
      monthly_goal_leads: body.goal_leads || 0,
      monthly_goal_sales: body.goal_sales || 0,
      monthly_goal_revenue: body.goal_revenue || 0,
      active: true, created_at: new Date().toISOString(),
    };
    _sellers.push(newSeller);
    return newSeller;
  },

  toggleSeller: async (id) => {
    await delay(200);
    const s = _sellers.find(s => s.id === id);
    if (s) s.active = !s.active;
    return { ok: true };
  },

  removeSeller: async (id) => {
    await delay(200);
    const s = _sellers.find(s => s.id === id);
    if (s) s.active = false;
    return { ok: true };
  },

  updateGoals: async (id, body) => {
    await delay(300);
    const s = _sellers.find(s => s.id === id);
    if (s) {
      if (body.goal_leads !== undefined) s.monthly_goal_leads = body.goal_leads;
      if (body.goal_sales !== undefined) s.monthly_goal_sales = body.goal_sales;
      if (body.goal_revenue !== undefined) s.monthly_goal_revenue = body.goal_revenue;
    }
    return s;
  },

  stats: async (params = {}) => {
    await delay(400);
    const filterDate = params.date || today;
    const filterShift = params.shift || '';
    return calcStats(_reports, filterDate, filterShift);
  },

  monthlySummary: async (params = {}) => {
    await delay(400);
    const month = parseInt(params.month) || (new Date().getMonth() + 1);
    const year = parseInt(params.year) || new Date().getFullYear();
    return calcMonthlySummary(_reports, month, year);
  },

  submitReport: async (body) => {
    await delay(500);
    const id = _nextReportId++;
    const report = {
      id, seller_id: 1, // Demo user = Ana Beatriz
      report_date: body.report_date || today,
      report_type: body.report_type || 'manha',
      leads_received: body.leads_received || 0,
      leads_responded: body.leads_responded || 0,
      conversions: body.conversions || 0,
      sales_closed: body.sales_closed || 0,
      revenue: body.revenue || 0,
      notes: body.notes || '',
      created_at: new Date().toISOString(),
    };
    _reports.push(report);
    return report;
  },

  dashboard: async () => {
    await delay(400);
    const seller = _sellers[0]; // Ana Beatriz como demo

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const monthReports = _reports.filter(r => {
      const d = new Date(r.report_date + 'T12:00:00');
      return r.seller_id === seller.id && d >= monthStart && d <= monthEnd;
    });

    const monthly = {
      leads: monthReports.reduce((s, r) => s + r.leads_received, 0),
      responded: monthReports.reduce((s, r) => s + r.leads_responded, 0),
      conversions: monthReports.reduce((s, r) => s + r.conversions, 0),
      sales: monthReports.reduce((s, r) => s + r.sales_closed, 0),
      revenue: monthReports.reduce((s, r) => s + r.revenue, 0).toFixed(2),
    };

    return { seller, monthly };
  },

  myReports: async (limit) => {
    await delay(300);
    const sellerReports = _reports
      .filter(r => r.seller_id === 1) // Ana Beatriz
      .sort((a, b) => b.report_date.localeCompare(a.report_date) || b.report_type.localeCompare(a.report_type))
      .slice(0, limit || 30);
    return sellerReports;
  },

  sellerReports: async (sellerId, params = {}) => {
    await delay(400);
    const sid = parseInt(sellerId);
    const month = parseInt(params.month) || (new Date().getMonth() + 1);
    const year = parseInt(params.year) || new Date().getFullYear();

    const seller = _sellers.find(s => s.id === sid);
    if (!seller) throw new Error('Vendedora não encontrada');

    const reports = _reports
      .filter(r => {
        if (r.seller_id !== sid) return false;
        const d = new Date(r.report_date + 'T12:00:00');
        return (d.getMonth() + 1) === month && d.getFullYear() === year;
      })
      .sort((a, b) => b.report_date.localeCompare(a.report_date) || b.report_type.localeCompare(a.report_type));

    const totals = {
      total_leads: reports.reduce((s, r) => s + r.leads_received, 0),
      total_responded: reports.reduce((s, r) => s + r.leads_responded, 0),
      total_conversions: reports.reduce((s, r) => s + r.conversions, 0),
      total_sales: reports.reduce((s, r) => s + r.sales_closed, 0),
      total_revenue: reports.reduce((s, r) => s + r.revenue, 0).toFixed(2),
      days_reported: new Set(reports.map(r => r.report_date)).size,
    };

    return { seller: { ...seller, name: seller.name, email: seller.email }, reports, totals };
  },
};

export const mockSalesChat = {
  messages: async (before) => {
    await delay(300);
    let msgs = [..._chatMessages].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (before) msgs = msgs.filter(m => new Date(m.created_at) < new Date(before));
    return msgs.slice(0, 50);
  },

  send: async (content, reply_to) => {
    await delay(300);
    const id = _nextChatId++;
    let replyData = {};
    if (reply_to) {
      const orig = _chatMessages.find(m => m.id === reply_to);
      if (orig) {
        replyData = { reply_to, reply_content: orig.content.substring(0, 60) + '...', reply_user_name: orig.user_name };
      }
    }
    const msg = {
      id, user_id: 101, user_name: 'Ana Beatriz', user_role: 'vendedora',
      content, pinned: false, ...replyData,
      created_at: new Date().toISOString(), updated_at: null,
    };
    _chatMessages.push(msg);
    return msg;
  },

  newMessages: async (after) => {
    await delay(200);
    if (!after) return [];
    return _chatMessages.filter(m => new Date(m.created_at) > new Date(after));
  },

  edit: async (id, content) => {
    await delay(200);
    const m = _chatMessages.find(m => m.id === id);
    if (m) { m.content = content; m.updated_at = new Date().toISOString(); }
    return m;
  },

  remove: async (id) => {
    await delay(200);
    _chatMessages = _chatMessages.filter(m => m.id !== id);
    return { ok: true };
  },

  pin: async (id) => {
    await delay(200);
    const m = _chatMessages.find(m => m.id === id);
    if (m) m.pinned = !m.pinned;
    return m;
  },

  pinned: async () => {
    await delay(200);
    return _chatMessages.filter(m => m.pinned);
  },

  unread: async () => {
    await delay(100);
    return { count: 3 };
  },

  markRead: async () => {
    await delay(100);
    return { ok: true };
  },
};

export const mockKnowledge = {
  categories: async () => {
    await delay(300);
    return KB_CATEGORIES;
  },

  createCategory: async (body) => {
    await delay(300);
    const cat = { id: KB_CATEGORIES.length + 1, ...body, article_count: 0, created_at: new Date().toISOString() };
    KB_CATEGORIES.push(cat);
    return cat;
  },

  deleteCategory: async (id) => {
    await delay(200);
    return { ok: true };
  },

  articles: async (params = {}) => {
    await delay(300);
    let arts = [...KB_ARTICLES];
    if (params.category_id) arts = arts.filter(a => a.category_id === parseInt(params.category_id));
    if (params.search) {
      const q = params.search.toLowerCase();
      arts = arts.filter(a => a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q));
    }
    return arts;
  },

  article: async (id) => {
    await delay(200);
    return KB_ARTICLES.find(a => a.id === parseInt(id));
  },

  createArticle: async (body) => {
    await delay(400);
    const art = { id: KB_ARTICLES.length + 1, ...body, author_name: 'Sara', created_at: new Date().toISOString(), updated_at: null };
    KB_ARTICLES.push(art);
    return art;
  },

  updateArticle: async (id, body) => {
    await delay(300);
    const art = KB_ARTICLES.find(a => a.id === parseInt(id));
    if (art) Object.assign(art, body, { updated_at: new Date().toISOString() });
    return art;
  },

  deleteArticle: async (id) => {
    await delay(200);
    return { ok: true };
  },
};

export const mockKommo = {
  getConfig: async () => {
    await delay(200);
    return null; // Kommo nao configurado no demo
  },
  saveConfig: async () => ({ ok: true }),
  disconnect: async () => ({ ok: true }),
  getPipelines: async () => [],
  savePipelineConfig: async () => ({ ok: true }),
  getKommoUsers: async () => [],
  getUserMap: async () => [],
  mapUser: async () => ({ ok: true }),
  autoMap: async () => ({ mapped: 0, total: 0 }),
  sync: async () => ({ leads_processed: 0, reports_created: 0 }),
  getSyncLogs: async () => [],
  getCustomFields: async () => [],
  getWebhookStats: async () => ({
    total_events: 0, processed: 0, pending: 0,
    last_hour: 0, last_24h: 0, last_event_at: null,
    by_type: [], recent_errors: [],
  }),
  getWebhookEvents: async () => [],
};

// Auth mock para demo
export const mockAuth = {
  // sales_admin
  salesAdmin: {
    id: 200, name: 'Sara', email: 'sara@empresa.com', role: 'sales_admin', active: true,
  },
  // vendedora
  vendedora: {
    id: 101, name: 'Ana Beatriz', email: 'ana@empresa.com', role: 'vendedora', active: true,
  },
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Deteccao de Modo Demo ───
export function isDemoMode() {
  if (typeof window === 'undefined') return false;
  if (new URLSearchParams(window.location.search).get('demo') === 'true') {
    localStorage.setItem('demo_mode', 'true');
    return true;
  }
  return localStorage.getItem('demo_mode') === 'true';
}

export function exitDemoMode() {
  localStorage.removeItem('demo_mode');
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}
