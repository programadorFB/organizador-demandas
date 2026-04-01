import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const GOLD = [201, 151, 26];
const DARK = [8, 8, 8];
const WHITE = [245, 245, 250];
const MUTED = [160, 160, 175];
const DIM = [120, 120, 135];
const ROW_BG = [18, 18, 28];
const ROW_ALT = [14, 14, 22];
const BAR_BG = [25, 25, 38];
const STATUS_COLORS = {
  links: [108, 92, 231], demanda: [201, 151, 26], em_andamento: [9, 132, 227], analise: [253, 203, 110],
  alteracoes: [255, 107, 53], concluidas: [0, 184, 148], pos_gestores: [162, 155, 254], reunioes: [253, 121, 168],
};
const PRI_COLORS = { normal: [201, 151, 26], alta: [255, 107, 53], urgente: [255, 71, 87] };
const DESIGNER_COLORS = [[201, 151, 26], [9, 132, 227], [0, 184, 148], [162, 155, 254], [253, 121, 168], [253, 203, 110]];

export default function generateReport(data) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210, H = 297, MARGIN = 15;
  const contentW = W - MARGIN * 2;
  let y = 0;

  // Pinta fundo escuro na pagina atual
  function paintBg() {
    doc.setFillColor(...DARK);
    doc.rect(0, 0, W, H, 'F');
    doc.setFillColor(...GOLD);
    doc.rect(0, 0, W, 2, 'F');
  }

  function newPage() {
    doc.addPage();
    paintBg();
    y = 20;
  }

  function checkPage(need = 30) {
    if (y + need > 275) { newPage(); }
  }

  function sectionTitle(text) {
    checkPage(20);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text(text, MARGIN, y);
    y += 10;
  }

  // ─── CAPA ───
  paintBg();
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 4, 'F');

  doc.setTextColor(...GOLD);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('FUZABALTA', W / 2, 55, { align: 'center' });

  doc.setFontSize(13);
  doc.setTextColor(...MUTED);
  doc.setFont('helvetica', 'normal');
  doc.text('Design Board — Relatório de Produtividade', W / 2, 68, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(...DIM);
  const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const timeStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  doc.text(`Gerado em ${dateStr} às ${timeStr}`, W / 2, 80, { align: 'center' });

  // Linha decorativa
  doc.setDrawColor(...GOLD);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 40, 90, W - MARGIN - 40, 90);

  // Summary cards
  const totalCompleted = data.perDesigner.reduce((s, d) => s + d.completed, 0);
  const totalActive = data.perDesigner.reduce((s, d) => s + d.active, 0);
  const totalOverdue = data.perDesigner.reduce((s, d) => s + d.overdue, 0);

  const sy = 105;
  const boxW = contentW / 4;
  const summaryItems = [
    { label: 'DESIGNERS', value: data.perDesigner.length, color: GOLD },
    { label: 'CONCLUÍDOS', value: totalCompleted, color: [0, 184, 148] },
    { label: 'ATIVOS', value: totalActive, color: [9, 132, 227] },
    { label: 'ATRASADOS', value: totalOverdue, color: [255, 71, 87] },
  ];
  summaryItems.forEach((item, i) => {
    const x = MARGIN + i * boxW;
    doc.setFillColor(...ROW_BG);
    doc.roundedRect(x + 2, sy, boxW - 4, 30, 3, 3, 'F');
    doc.setFontSize(26);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...item.color);
    doc.text(String(item.value), x + boxW / 2, sy + 15, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DIM);
    doc.text(item.label, x + boxW / 2, sy + 24, { align: 'center' });
  });

  // Detalhamento rapido por designer na capa
  const dy = 150;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('RESUMO POR DESIGNER', MARGIN, dy);

  data.perDesigner.forEach((d, i) => {
    const ry = dy + 8 + i * 14;
    doc.setFillColor(i % 2 === 0 ? ROW_BG[0] : ROW_ALT[0], i % 2 === 0 ? ROW_BG[1] : ROW_ALT[1], i % 2 === 0 ? ROW_BG[2] : ROW_ALT[2]);
    doc.roundedRect(MARGIN, ry, contentW, 11, 2, 2, 'F');

    const color = DESIGNER_COLORS[i % DESIGNER_COLORS.length];
    doc.setFillColor(...color);
    doc.roundedRect(MARGIN, ry, 3, 11, 1, 1, 'F');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(d.name, MARGIN + 7, ry + 7);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...MUTED);
    doc.text(`${d.completed} concluídos`, MARGIN + 50, ry + 7);
    doc.text(`${d.active} ativos`, MARGIN + 85, ry + 7);

    if (d.overdue > 0) {
      doc.setTextColor(255, 71, 87);
      doc.text(`${d.overdue} atrasados`, MARGIN + 110, ry + 7);
    }

    doc.setTextColor(...GOLD);
    doc.setFont('helvetica', 'bold');
    const avgText = d.avg_hours_to_complete > 0 ? `média: ${d.avg_hours_to_complete}h` : '';
    if (avgText) doc.text(avgText, MARGIN + contentW - 5, ry + 7, { align: 'right' });
  });

  // ─── PAGINA 2: Tabela + gráfico de barras ───
  newPage();

  sectionTitle('PRODUTIVIDADE POR DESIGNER');

  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    head: [['Designer', 'Concluídos', 'Ativos', 'Atrasados', 'Tempo Médio', 'Horas Entregues']],
    body: data.perDesigner.map(d => [
      d.name,
      d.completed,
      d.active,
      d.overdue,
      d.avg_hours_to_complete > 0 ? `${d.avg_hours_to_complete}h` : '—',
      d.total_estimated_hours > 0 ? `${d.total_estimated_hours}h` : '—',
    ]),
    theme: 'plain',
    styles: { fontSize: 9, textColor: WHITE, cellPadding: 4, fillColor: false },
    headStyles: { fillColor: [30, 30, 45], textColor: GOLD, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: ROW_ALT },
    bodyStyles: { fillColor: ROW_BG },
    columnStyles: {
      0: { fontStyle: 'bold', textColor: WHITE },
      1: { halign: 'center', textColor: [0, 184, 148] },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center', textColor: GOLD },
      5: { halign: 'center', textColor: GOLD },
    },
    didParseCell: (hookData) => {
      if (hookData.column.index === 3 && hookData.section === 'body' && hookData.cell.raw > 0) {
        hookData.cell.styles.textColor = [255, 71, 87];
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = doc.lastAutoTable.finalY + 15;

  sectionTitle('CARDS CONCLUÍDOS POR DESIGNER');

  const maxCompleted = Math.max(...data.perDesigner.map(d => d.completed), 1);
  data.perDesigner.forEach((d, i) => {
    checkPage(14);
    const barMaxW = contentW - 55;
    const barW = (d.completed / maxCompleted) * barMaxW;
    const color = DESIGNER_COLORS[i % DESIGNER_COLORS.length];

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(d.name, MARGIN, y + 6);

    doc.setFillColor(...BAR_BG);
    doc.roundedRect(MARGIN + 32, y, barMaxW, 9, 2, 2, 'F');
    if (barW > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(MARGIN + 32, y, Math.max(barW, 3), 9, 2, 2, 'F');
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(String(d.completed), MARGIN + 35 + barMaxW, y + 6);
    y += 14;
  });

  // ─── DISTRIBUIÇÕES ───
  newPage();

  sectionTitle('DISTRIBUIÇÃO POR STATUS');

  const totalByStatus = data.byStatus.reduce((s, d) => s + d.count, 0) || 1;
  data.byStatus.forEach(d => {
    checkPage(12);
    const pct = Math.round((d.count / totalByStatus) * 100);
    const color = STATUS_COLORS[d.status] || DIM;
    const barW = (d.count / totalByStatus) * (contentW - 65);

    doc.setFillColor(...color);
    doc.roundedRect(MARGIN, y + 1, 5, 5, 1, 1, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(d.status, MARGIN + 8, y + 5);

    doc.setFillColor(...BAR_BG);
    doc.roundedRect(MARGIN + 42, y, contentW - 65, 7, 2, 2, 'F');
    if (barW > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(MARGIN + 42, y, Math.max(barW, 3), 7, 2, 2, 'F');
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(`${d.count} (${pct}%)`, MARGIN + contentW - 2, y + 5, { align: 'right' });
    y += 12;
  });

  y += 8;
  sectionTitle('DISTRIBUIÇÃO POR PRIORIDADE');

  const totalByPri = data.byPriority.reduce((s, d) => s + d.count, 0) || 1;
  data.byPriority.forEach(d => {
    checkPage(12);
    const pct = Math.round((d.count / totalByPri) * 100);
    const color = PRI_COLORS[d.priority] || DIM;
    const barW = (d.count / totalByPri) * (contentW - 65);

    doc.setFillColor(...color);
    doc.roundedRect(MARGIN, y + 1, 5, 5, 1, 1, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(d.priority.toUpperCase(), MARGIN + 8, y + 5);

    doc.setFillColor(...BAR_BG);
    doc.roundedRect(MARGIN + 42, y, contentW - 65, 7, 2, 2, 'F');
    if (barW > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(MARGIN + 42, y, Math.max(barW, 3), 7, 2, 2, 'F');
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(`${d.count} (${pct}%)`, MARGIN + contentW - 2, y + 5, { align: 'right' });
    y += 12;
  });

  y += 8;
  sectionTitle('POR TIPO DE ENTREGA');

  const maxType = Math.max(...data.byType.map(d => d.count), 1);
  data.byType.forEach(d => {
    checkPage(12);
    const barW = (d.count / maxType) * (contentW - 65);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(d.delivery_type || 'Sem tipo', MARGIN, y + 5);

    doc.setFillColor(...BAR_BG);
    doc.roundedRect(MARGIN + 42, y, contentW - 65, 7, 2, 2, 'F');
    doc.setFillColor(...GOLD);
    doc.roundedRect(MARGIN + 42, y, Math.max(barW, 3), 7, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...WHITE);
    doc.text(String(d.count), MARGIN + contentW - 2, y + 5, { align: 'right' });
    y += 12;
  });

  // ─── RETRABALHO ───
  y += 8;
  sectionTitle('ALTERAÇÕES (RETRABALHO)');

  if (data.rework.length > 0) {
    const maxRework = Math.max(...data.rework.map(d => d.alteracoes), 1);
    data.rework.forEach(d => {
      checkPage(12);
      const barW = (d.alteracoes / maxRework) * (contentW - 65);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...WHITE);
      doc.text(d.name, MARGIN, y + 5);

      doc.setFillColor(...BAR_BG);
      doc.roundedRect(MARGIN + 42, y, contentW - 65, 7, 2, 2, 'F');
      doc.setFillColor(255, 107, 53);
      doc.roundedRect(MARGIN + 42, y, Math.max(barW, 3), 7, 2, 2, 'F');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...WHITE);
      doc.text(String(d.alteracoes), MARGIN + contentW - 2, y + 5, { align: 'right' });
      y += 12;
    });
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...DIM);
    doc.text('Nenhuma alteração registrada', MARGIN, y);
    y += 10;
  }

  // ─── CARDS MAIS DEMORADOS ───
  y += 8;
  sectionTitle('CARDS MAIS DEMORADOS');

  if (data.slowest.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['#', 'Card', 'Designer', 'Estimado', 'Real']],
      body: data.slowest.map((s, i) => [
        `#${i + 1}`,
        s.title,
        s.designer_name || '—',
        s.estimated_hours ? `${s.estimated_hours}h` : '—',
        `${s.hours_taken}h`,
      ]),
      theme: 'plain',
      styles: { fontSize: 9, textColor: WHITE, cellPadding: 3.5, fillColor: ROW_BG },
      headStyles: { fillColor: [30, 30, 45], textColor: GOLD, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center', textColor: GOLD, fontStyle: 'bold' },
        1: { textColor: WHITE, fontStyle: 'bold' },
        3: { halign: 'center', textColor: MUTED },
        4: { halign: 'center', textColor: [255, 107, 53], fontStyle: 'bold' },
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...DIM);
    doc.text('Nenhum card concluído ainda', MARGIN, y);
    y += 10;
  }

  // ─── ENTREGAS SEMANAIS ───
  if (data.weeklyOutput.length > 0) {
    checkPage(50);
    sectionTitle('ENTREGAS POR SEMANA');

    const weeks = [...new Set(data.weeklyOutput.map(d => d.week))].sort();
    const designerNames = [...new Set(data.weeklyOutput.map(d => d.designer_name))];

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [['Semana', ...designerNames, 'Total']],
      body: weeks.map(w => {
        const row = [new Date(w).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })];
        let total = 0;
        designerNames.forEach(dn => {
          const val = data.weeklyOutput.find(d => d.week === w && d.designer_name === dn)?.count || 0;
          row.push(val || '—');
          total += val;
        });
        row.push(total);
        return row;
      }),
      theme: 'plain',
      styles: { fontSize: 9, textColor: WHITE, cellPadding: 3.5, fillColor: ROW_BG, halign: 'center' },
      headStyles: { fillColor: [30, 30, 45], textColor: GOLD, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: ROW_ALT },
      columnStyles: { 0: { halign: 'left', fontStyle: 'bold' } },
    });
  }

  // ─── FOOTER em todas as páginas ───
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Garantir fundo escuro (capa já tem, mas por segurança)
    if (i === 1) continue; // capa já pintada
    doc.setFillColor(...GOLD);
    doc.rect(0, H - 3, W, 3, 'F');
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...DIM);
    doc.text(`FUZABALTA Design Board — Página ${i}/${pageCount}`, W / 2, H - 5, { align: 'center' });
  }

  doc.save(`FUZABALTA_Relatorio_${new Date().toISOString().slice(0, 10)}.pdf`);
}
