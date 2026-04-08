import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// ─── Paleta (mesmo padrão do relatório de design) ───
const CORAL = [225, 112, 85];
const DARK = [8, 8, 8];
const WHITE = [245, 245, 250];
const MUTED = [160, 160, 175];
const DIM = [120, 120, 135];
const ROW_BG = [18, 18, 28];
const ROW_ALT = [14, 14, 22];
const BAR_BG = [25, 25, 38];
const GREEN = [0, 184, 148];
const CYAN = [0, 206, 201];
const PURPLE = [108, 92, 231];
const YELLOW = [253, 203, 110];
const SELLER_COLORS = [[108,92,231],[0,184,148],[253,203,110],[225,112,85],[0,206,201],[162,155,254],[250,177,160],[116,185,255],[85,239,196],[255,118,117]];

const MONTHS = ['Janeiro','Fevereiro','Marco','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

const fmt = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtShort = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '--';

// ═══════════════════════════════════════════════════
// PDF — Relatório Geral de Vendas (mensal)
// ═══════════════════════════════════════════════════
export function generateSalesPDF({ sellers, totals, month, year, daily, alerts }) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210, H = 297, MARGIN = 15;
  const contentW = W - MARGIN * 2;
  let y = 0;

  function paintBg() {
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...CORAL);
    doc.rect(0, 0, W, 2, 'F');
  }

  function newPage() { doc.addPage(); paintBg(); y = 20; }
  function checkPage(need = 30) { if (y + need > 275) newPage(); }

  function sectionTitle(text) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...CORAL);
    doc.text(text, MARGIN, y);
    y += 10;
  }

  // ─── CAPA ───
  paintBg();
  doc.setFillColor(...CORAL);
  doc.rect(0, 0, W, 4, 'F');

  doc.setTextColor(...CORAL);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('PAINEL SARA', W / 2, 50, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('Relatorio de Vendas', W / 2, 63, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.text(`${MONTHS[month - 1]} ${year}`, W / 2, 76, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(...DIM);
  const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  doc.text(`Gerado em ${dateStr} as ${timeStr}`, W / 2, 86, { align: 'center' });

  doc.setDrawColor(...CORAL);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 40, 94, W - MARGIN - 40, 94);

  // Summary cards
  const sy = 105;
  const boxW = contentW / 5;
  const convRate = (totals.total_leads > 0) ? ((totals.total_sales / totals.total_leads) * 100).toFixed(1) : '0.0';
  const ticket = (totals.total_sales > 0) ? (parseFloat(totals.total_revenue) / totals.total_sales) : 0;

  const summaryItems = [
    { label: 'LEADS', value: String(totals.total_leads || 0), color: PURPLE },
    { label: 'RESPONDIDOS', value: String(totals.total_responded || 0), color: CYAN },
    { label: 'VENDAS', value: String(totals.total_sales || 0), color: GREEN },
    { label: 'FATURAMENTO', value: fmt(totals.total_revenue), color: GREEN, small: true },
    { label: 'CONVERSAO', value: `${convRate}%`, color: CORAL },
  ];

  summaryItems.forEach((item, i) => {
    const x = MARGIN + i * boxW;
    doc.setFillColor(...ROW_BG);
    doc.roundedRect(x + 2, sy, boxW - 4, 30, 3, 3, 'F');
    doc.setFontSize(item.small ? 14 : 22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...item.color);
    doc.text(item.value, x + boxW / 2, sy + 15, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DIM);
    doc.text(item.label, x + boxW / 2, sy + 24, { align: 'center' });
  });

  // Resumo por vendedora na capa
  const dy = 148;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...CORAL);
  doc.text('RANKING DO MES', MARGIN, dy);

  const sorted = [...(sellers || [])].sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue));
  sorted.forEach((s, i) => {
    const ry = dy + 8 + i * 14;
    if (ry > 260) return;

    doc.setFillColor(i % 2 === 0 ? ROW_BG[0] : ROW_ALT[0], i % 2 === 0 ? ROW_BG[1] : ROW_ALT[1], i % 2 === 0 ? ROW_BG[2] : ROW_ALT[2]);
    doc.roundedRect(MARGIN, ry, contentW, 11, 2, 2, 'F');

    const color = SELLER_COLORS[i % SELLER_COLORS.length];
    doc.setFillColor(...color);
    doc.roundedRect(MARGIN, ry, 3, 11, 1, 1, 'F');

    // Posicao
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...color);
    doc.text(`${i + 1}o`, MARGIN + 6, ry + 7);

    // Nome
    doc.setTextColor(...WHITE);
    doc.text(s.name, MARGIN + 16, ry + 7);

    // Metricas
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(`${s.sales_closed} vendas`, MARGIN + 60, ry + 7);
    doc.text(`${s.leads_received} leads`, MARGIN + 88, ry + 7);
    doc.text(`${s.conversion_rate}%`, MARGIN + 115, ry + 7);

    // Faturamento
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREEN);
    doc.text(fmt(s.revenue), MARGIN + contentW - 3, ry + 7, { align: 'right' });
  });

  // ─── PAGINA 2: Tabela detalhada ───
  newPage();
  sectionTitle('DESEMPENHO MENSAL POR VENDEDORA');

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Vendedora', 'Leads', 'Respond.', 'Conv.', 'Vendas', 'Faturamento', 'Conversao', 'Dias']],
    body: sorted.map(s => [
      s.name,
      s.leads_received,
      s.leads_responded,
      s.conversions,
      s.sales_closed,
      fmt(s.revenue),
      `${s.conversion_rate}%`,
      s.days_reported || '—',
    ]),
    theme: 'plain',
    styles: { fontSize: 9, textColor: WHITE, cellPadding: 4, fillColor: false },
    headStyles: { fillColor: [30, 30, 45], textColor: CORAL, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: ROW_ALT },
    bodyStyles: { fillColor: ROW_BG },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: WHITE },
      4: { halign: 'center', textColor: GREEN, fontStyle: 'bold' },
      5: { textColor: GREEN, fontStyle: 'bold' },
      6: { halign: 'center', textColor: CORAL },
      7: { halign: 'center' },
    },
  });

  y = doc.lastAutoTable.finalY + 15;

  // Grafico de barras — Faturamento
  sectionTitle('FATURAMENTO POR VENDEDORA');

  const maxRev = Math.max(...sorted.map(s => parseFloat(s.revenue)), 1);
  sorted.forEach((s, i) => {
    checkPage(14);
    const barMaxW = contentW - 60;
    const barW = (parseFloat(s.revenue) / maxRev) * barMaxW;
    const color = SELLER_COLORS[i % SELLER_COLORS.length];

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(s.name, MARGIN, y + 6);

    doc.setFillColor(...BAR_BG);
    doc.roundedRect(MARGIN + 35, y, barMaxW, 9, 2, 2, 'F');
    if (barW > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(MARGIN + 35, y, Math.max(barW, 3), 9, 2, 2, 'F');
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GREEN);
    doc.text(fmt(s.revenue), MARGIN + 38 + barMaxW, y + 6);
    y += 14;
  });

  // Grafico de barras — Vendas
  y += 5;
  sectionTitle('VENDAS POR VENDEDORA');

  const maxSales = Math.max(...sorted.map(s => s.sales_closed), 1);
  sorted.forEach((s, i) => {
    checkPage(14);
    const barMaxW = contentW - 60;
    const barW = (s.sales_closed / maxSales) * barMaxW;
    const color = SELLER_COLORS[i % SELLER_COLORS.length];

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(s.name, MARGIN, y + 6);

    doc.setFillColor(...BAR_BG);
    doc.roundedRect(MARGIN + 35, y, barMaxW, 9, 2, 2, 'F');
    if (barW > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(MARGIN + 35, y, Math.max(barW, 3), 9, 2, 2, 'F');
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(String(s.sales_closed), MARGIN + 38 + barMaxW, y + 6);
    y += 14;
  });

  // ─── PAGINA 3: Metas ───
  newPage();
  sectionTitle('PROGRESSO DE METAS');

  sorted.forEach((s, i) => {
    checkPage(30);
    const goalRev = parseFloat(s.monthly_goal_revenue) || 0;
    const goalSales = s.monthly_goal_sales || 0;
    const actualRev = parseFloat(s.revenue) || 0;
    const actualSales = s.sales_closed || 0;
    const revPct = goalRev > 0 ? Math.min((actualRev / goalRev) * 100, 100) : 0;
    const salesPct = goalSales > 0 ? Math.min((actualSales / goalSales) * 100, 100) : 0;
    const color = SELLER_COLORS[i % SELLER_COLORS.length];

    doc.setFillColor(...ROW_BG);
    doc.roundedRect(MARGIN, y, contentW, 24, 3, 3, 'F');
    doc.setFillColor(...color);
    doc.roundedRect(MARGIN, y, 3, 24, 1, 1, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(s.name, MARGIN + 7, y + 7);

    // Barra faturamento
    doc.setFontSize(7);
    doc.setTextColor(...DIM);
    doc.text(`Faturamento: ${fmt(actualRev)} / ${fmt(goalRev)}`, MARGIN + 7, y + 14);
    doc.setFillColor(...BAR_BG);
    doc.roundedRect(MARGIN + 70, y + 10, 80, 5, 2, 2, 'F');
    if (revPct > 0) {
      doc.setFillColor(...GREEN);
      doc.roundedRect(MARGIN + 70, y + 10, Math.max((revPct / 100) * 80, 2), 5, 2, 2, 'F');
    }
    doc.setTextColor(...WHITE);
    doc.text(`${revPct.toFixed(1)}%`, MARGIN + 153, y + 14);

    // Barra vendas
    doc.setTextColor(...DIM);
    doc.text(`Vendas: ${actualSales} / ${goalSales}`, MARGIN + 7, y + 21);
    doc.setFillColor(...BAR_BG);
    doc.roundedRect(MARGIN + 70, y + 17, 80, 5, 2, 2, 'F');
    if (salesPct > 0) {
      doc.setFillColor(...CORAL);
      doc.roundedRect(MARGIN + 70, y + 17, Math.max((salesPct / 100) * 80, 2), 5, 2, 2, 'F');
    }
    doc.setTextColor(...WHITE);
    doc.text(`${salesPct.toFixed(1)}%`, MARGIN + 153, y + 21);

    y += 28;
  });

  // ─── DADOS DIARIOS (se fornecido) ───
  if (daily && daily.length > 0) {
    newPage();
    sectionTitle('DESEMPENHO DO DIA');

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Vendedora', 'Leads', 'Respond.', 'Conv.', 'Vendas', 'Faturamento', 'Conversao']],
      body: daily.map(s => [
        s.name,
        s.leads_received,
        s.leads_responded,
        s.conversions,
        s.sales_closed,
        fmt(s.revenue),
        `${s.conversion_rate}%`,
      ]),
      theme: 'plain',
      styles: { fontSize: 9, textColor: WHITE, cellPadding: 4, fillColor: false },
      headStyles: { fillColor: [30, 30, 45], textColor: CORAL, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: ROW_ALT },
      bodyStyles: { fillColor: ROW_BG },
      columnStyles: {
        0: { fontStyle: 'bold' },
        4: { halign: 'center', textColor: GREEN, fontStyle: 'bold' },
        5: { textColor: GREEN, fontStyle: 'bold' },
        6: { halign: 'center', textColor: CORAL },
      },
    });
  }

  // ─── FOOTER ───
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (i === 1) continue;
    doc.setFillColor(...CORAL);
    doc.rect(0, H - 3, W, 3, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DIM);
    doc.text(`Painel Sara — Relatorio de Vendas — Pagina ${i}/${pageCount}`, W / 2, H - 5, { align: 'center' });
  }

  doc.save(`Vendas_${MONTHS[month - 1]}_${year}.pdf`);
}

// ═══════════════════════════════════════════════════
// PDF — Relatório Individual de Vendedora
// ═══════════════════════════════════════════════════
export function generateSellerPDF({ seller, reports, totals, month, year }) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210, H = 297, MARGIN = 15;
  const contentW = W - MARGIN * 2;
  let y = 0;

  function paintBg() {
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...PURPLE);
    doc.rect(0, 0, W, 2, 'F');
  }

  function newPage() { doc.addPage(); paintBg(); y = 20; }
  function checkPage(need = 30) { if (y + need > 275) newPage(); }

  function sectionTitle(text) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PURPLE);
    doc.text(text, MARGIN, y);
    y += 10;
  }

  // ─── CAPA ───
  paintBg();
  doc.setFillColor(...PURPLE);
  doc.rect(0, 0, W, 4, 'F');

  doc.setTextColor(...PURPLE);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATORIO INDIVIDUAL', W / 2, 48, { align: 'center' });

  doc.setFontSize(22);
  doc.setTextColor(...WHITE);
  doc.text(seller.name || 'Vendedora', W / 2, 64, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text(`${seller.email || ''} — Turno: ${seller.shift === 'manha' ? 'Manha (09h-14h)' : 'Completo (09h-18h)'}`, W / 2, 76, { align: 'center' });

  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.text(`${MONTHS[month - 1]} ${year}`, W / 2, 90, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(...DIM);
  const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  doc.text(`Gerado em ${dateStr}`, W / 2, 100, { align: 'center' });

  doc.setDrawColor(...PURPLE);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 40, 106, W - MARGIN - 40, 106);

  // Summary
  const sy = 116;
  const boxW = contentW / 3;
  const convRate = (totals.total_leads > 0) ? ((totals.total_sales / totals.total_leads) * 100).toFixed(1) : '0.0';
  const ticket = (totals.total_sales > 0) ? (parseFloat(totals.total_revenue) / totals.total_sales) : 0;

  const items1 = [
    { label: 'LEADS', value: String(totals.total_leads || 0), color: PURPLE },
    { label: 'VENDAS', value: String(totals.total_sales || 0), color: GREEN },
    { label: 'FATURAMENTO', value: fmt(totals.total_revenue), color: GREEN, small: true },
  ];

  items1.forEach((item, i) => {
    const x = MARGIN + i * boxW;
    doc.setFillColor(...ROW_BG);
    doc.roundedRect(x + 2, sy, boxW - 4, 28, 3, 3, 'F');
    doc.setFontSize(item.small ? 14 : 20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...item.color);
    doc.text(item.value, x + boxW / 2, sy + 14, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DIM);
    doc.text(item.label, x + boxW / 2, sy + 22, { align: 'center' });
  });

  const sy2 = sy + 32;
  const items2 = [
    { label: 'CONVERSAO', value: `${convRate}%`, color: CORAL },
    { label: 'TICKET MEDIO', value: fmt(ticket), color: YELLOW, small: true },
    { label: 'DIAS REPORTADOS', value: String(totals.days_reported || 0), color: CYAN },
  ];

  items2.forEach((item, i) => {
    const x = MARGIN + i * boxW;
    doc.setFillColor(...ROW_BG);
    doc.roundedRect(x + 2, sy2, boxW - 4, 28, 3, 3, 'F');
    doc.setFontSize(item.small ? 14 : 20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...item.color);
    doc.text(item.value, x + boxW / 2, sy2 + 14, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DIM);
    doc.text(item.label, x + boxW / 2, sy2 + 22, { align: 'center' });
  });

  // Metas
  y = sy2 + 36;
  const goalRev = parseFloat(seller.monthly_goal_revenue) || 0;
  const goalSales = seller.monthly_goal_sales || 0;
  const revPct = goalRev > 0 ? Math.min((parseFloat(totals.total_revenue) / goalRev) * 100, 100) : 0;
  const salesPct = goalSales > 0 ? Math.min((totals.total_sales / goalSales) * 100, 100) : 0;

  doc.setFillColor(...ROW_BG);
  doc.roundedRect(MARGIN, y, contentW, 20, 3, 3, 'F');

  doc.setFontSize(8);
  doc.setTextColor(...DIM);
  doc.text(`Meta Faturamento: ${fmt(totals.total_revenue)} / ${fmt(goalRev)}`, MARGIN + 5, y + 8);
  doc.setFillColor(...BAR_BG);
  doc.roundedRect(MARGIN + 80, y + 3, 70, 6, 2, 2, 'F');
  if (revPct > 0) { doc.setFillColor(...GREEN); doc.roundedRect(MARGIN + 80, y + 3, Math.max((revPct / 100) * 70, 2), 6, 2, 2, 'F'); }
  doc.setTextColor(...WHITE);
  doc.text(`${revPct.toFixed(1)}%`, MARGIN + 153, y + 8);

  doc.setTextColor(...DIM);
  doc.text(`Meta Vendas: ${totals.total_sales} / ${goalSales}`, MARGIN + 5, y + 16);
  doc.setFillColor(...BAR_BG);
  doc.roundedRect(MARGIN + 80, y + 11, 70, 6, 2, 2, 'F');
  if (salesPct > 0) { doc.setFillColor(...CORAL); doc.roundedRect(MARGIN + 80, y + 11, Math.max((salesPct / 100) * 70, 2), 6, 2, 2, 'F'); }
  doc.setTextColor(...WHITE);
  doc.text(`${salesPct.toFixed(1)}%`, MARGIN + 153, y + 16);

  // ─── PAGINA 2: Tabela de relatorios ───
  newPage();
  sectionTitle(`RELATORIOS — ${MONTHS[month - 1].toUpperCase()} ${year}`);

  const rptData = (reports || []).map(r => {
    const tk = r.sales_closed > 0 ? (parseFloat(r.revenue) / r.sales_closed) : 0;
    return [
      fmtShort(r.report_date),
      r.report_type === 'manha' ? 'Manha' : 'Completo',
      r.leads_received,
      r.leads_responded,
      r.conversions,
      r.sales_closed,
      fmt(r.revenue),
      fmt(tk),
      (r.notes || '').substring(0, 40) + (r.notes?.length > 40 ? '...' : ''),
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Data', 'Turno', 'Leads', 'Resp.', 'Conv.', 'Vendas', 'Fatur.', 'Ticket', 'Obs.']],
    body: rptData,
    theme: 'plain',
    styles: { fontSize: 8, textColor: WHITE, cellPadding: 3.5, fillColor: false },
    headStyles: { fillColor: [30, 30, 45], textColor: PURPLE, fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: ROW_ALT },
    bodyStyles: { fillColor: ROW_BG },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { textColor: CYAN, fontSize: 7.5 },
      5: { halign: 'center', textColor: GREEN, fontStyle: 'bold' },
      6: { textColor: GREEN, fontStyle: 'bold' },
      7: { textColor: YELLOW },
      8: { textColor: DIM, fontSize: 7 },
    },
  });

  // ─── FOOTER ───
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    if (i === 1) continue;
    doc.setFillColor(...PURPLE);
    doc.rect(0, H - 3, W, 3, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DIM);
    doc.text(`Relatorio ${seller.name} — ${MONTHS[month - 1]} ${year} — Pagina ${i}/${pageCount}`, W / 2, H - 5, { align: 'center' });
  }

  doc.save(`Vendas_${seller.name?.replace(/\s/g, '_')}_${MONTHS[month - 1]}_${year}.pdf`);
}

// ═══════════════════════════════════════════════════
// EXCEL — Relatório Geral
// ═══════════════════════════════════════════════════
export function generateSalesExcel({ sellers, totals, month, year, daily }) {
  const wb = XLSX.utils.book_new();

  // ── Aba: Resumo Mensal ──
  const resumoData = [
    ['RELATORIO DE VENDAS', '', '', '', '', '', '', ''],
    [`${MONTHS[month - 1]} ${year}`, '', '', '', '', '', '', ''],
    [],
    ['Vendedora', 'Leads', 'Respondidos', 'Conversoes', 'Vendas', 'Faturamento (R$)', 'Conversao (%)', 'Dias Reportados'],
    ...(sellers || []).map(s => [
      s.name,
      s.leads_received,
      s.leads_responded,
      s.conversions,
      s.sales_closed,
      parseFloat(s.revenue) || 0,
      parseFloat(s.conversion_rate) || 0,
      s.days_reported || 0,
    ]),
    [],
    ['TOTAL', totals.total_leads || 0, totals.total_responded || 0, totals.total_conversions || 0, totals.total_sales || 0, parseFloat(totals.total_revenue) || 0, '', ''],
  ];

  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo['!cols'] = [
    { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 }, { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo Mensal');

  // ── Aba: Metas ──
  const metasData = [
    ['METAS DO MES', '', '', '', '', '', '', '', ''],
    [],
    ['Vendedora', 'Meta Leads', 'Leads Atual', '% Leads', 'Meta Vendas', 'Vendas Atual', '% Vendas', 'Meta Fatur. (R$)', 'Fatur. Atual (R$)', '% Fatur.'],
    ...(sellers || []).map(s => {
      const gl = s.monthly_goal_leads || 0;
      const gs = s.monthly_goal_sales || 0;
      const gr = parseFloat(s.monthly_goal_revenue) || 0;
      const al = s.leads_received || 0;
      const as2 = s.sales_closed || 0;
      const ar = parseFloat(s.revenue) || 0;
      return [
        s.name,
        gl, al, gl > 0 ? parseFloat(((al / gl) * 100).toFixed(1)) : 0,
        gs, as2, gs > 0 ? parseFloat(((as2 / gs) * 100).toFixed(1)) : 0,
        gr, ar, gr > 0 ? parseFloat(((ar / gr) * 100).toFixed(1)) : 0,
      ];
    }),
  ];

  const wsMetas = XLSX.utils.aoa_to_sheet(metasData);
  wsMetas['!cols'] = [
    { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsMetas, 'Metas');

  // ── Aba: Dia Atual (se tiver) ──
  if (daily && daily.length > 0) {
    const diaData = [
      ['DESEMPENHO DO DIA'],
      [],
      ['Vendedora', 'Leads', 'Respondidos', 'Conversoes', 'Vendas', 'Faturamento (R$)', 'Conversao (%)'],
      ...daily.map(s => [
        s.name,
        s.leads_received,
        s.leads_responded,
        s.conversions,
        s.sales_closed,
        parseFloat(s.revenue) || 0,
        parseFloat(s.conversion_rate) || 0,
      ]),
    ];

    const wsDia = XLSX.utils.aoa_to_sheet(diaData);
    wsDia['!cols'] = [
      { wch: 20 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsDia, 'Dia Atual');
  }

  XLSX.writeFile(wb, `Vendas_${MONTHS[month - 1]}_${year}.xlsx`);
}

// ═══════════════════════════════════════════════════
// EXCEL — Relatório Individual de Vendedora
// ═══════════════════════════════════════════════════
export function generateSellerExcel({ seller, reports, totals, month, year }) {
  const wb = XLSX.utils.book_new();

  // ── Aba: Resumo ──
  const convRate = (totals.total_leads > 0) ? ((totals.total_sales / totals.total_leads) * 100).toFixed(1) : '0.0';
  const ticket = (totals.total_sales > 0) ? (parseFloat(totals.total_revenue) / totals.total_sales).toFixed(2) : '0.00';

  const resumoData = [
    [`RELATORIO — ${seller.name}`],
    [`${MONTHS[month - 1]} ${year}`],
    [`Turno: ${seller.shift === 'manha' ? 'Manha (09h-14h)' : 'Completo (09h-18h)'}`],
    [],
    ['Metrica', 'Valor', 'Meta', '% Atingido'],
    ['Total de Leads', totals.total_leads || 0, seller.monthly_goal_leads || 0, seller.monthly_goal_leads > 0 ? parseFloat(((totals.total_leads / seller.monthly_goal_leads) * 100).toFixed(1)) : 0],
    ['Leads Respondidos', totals.total_responded || 0, '', ''],
    ['Conversoes', totals.total_conversions || 0, '', ''],
    ['Vendas Fechadas', totals.total_sales || 0, seller.monthly_goal_sales || 0, seller.monthly_goal_sales > 0 ? parseFloat(((totals.total_sales / seller.monthly_goal_sales) * 100).toFixed(1)) : 0],
    ['Faturamento (R$)', parseFloat(totals.total_revenue) || 0, parseFloat(seller.monthly_goal_revenue) || 0, parseFloat(seller.monthly_goal_revenue) > 0 ? parseFloat(((parseFloat(totals.total_revenue) / parseFloat(seller.monthly_goal_revenue)) * 100).toFixed(1)) : 0],
    ['Taxa de Conversao (%)', parseFloat(convRate), 25, ''],
    ['Ticket Medio (R$)', parseFloat(ticket), '', ''],
    ['Dias Reportados', totals.days_reported || 0, '', ''],
  ];

  const wsResumo = XLSX.utils.aoa_to_sheet(resumoData);
  wsResumo['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // ── Aba: Relatorios ──
  const rptData = [
    ['RELATORIOS DETALHADOS'],
    [],
    ['Data', 'Turno', 'Leads Receb.', 'Leads Resp.', 'Conversoes', 'Vendas', 'Faturamento (R$)', 'Ticket Medio (R$)', 'Observacoes'],
    ...(reports || []).map(r => {
      const tk = r.sales_closed > 0 ? parseFloat((r.revenue / r.sales_closed).toFixed(2)) : 0;
      return [
        fmtShort(r.report_date),
        r.report_type === 'manha' ? 'Manha' : 'Completo',
        r.leads_received,
        r.leads_responded,
        r.conversions,
        r.sales_closed,
        parseFloat(r.revenue) || 0,
        tk,
        r.notes || '',
      ];
    }),
  ];

  const wsRpt = XLSX.utils.aoa_to_sheet(rptData);
  wsRpt['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 18 }, { wch: 16 }, { wch: 40 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRpt, 'Relatorios');

  XLSX.writeFile(wb, `Vendas_${seller.name?.replace(/\s/g, '_')}_${MONTHS[month - 1]}_${year}.xlsx`);
}
