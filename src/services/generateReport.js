import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const GOLD = [201, 151, 26];
const DARK = [8, 8, 8];
const WHITE = [232, 232, 240];
const GRAY = [100, 100, 110];
const LIGHT_BG = [13, 13, 13];
const STATUS_COLORS = {
  links: [108, 92, 231], demanda: [201, 151, 26], em_andamento: [9, 132, 227], analise: [253, 203, 110],
  alteracoes: [255, 107, 53], concluidas: [0, 184, 148], pos_gestores: [162, 155, 254], reunioes: [253, 121, 168],
};
const PRI_COLORS = { normal: [201, 151, 26], alta: [255, 107, 53], urgente: [255, 71, 87] };
const DESIGNER_COLORS = [[201, 151, 26], [9, 132, 227], [0, 184, 148], [162, 155, 254], [253, 121, 168], [253, 203, 110]];

function hexToRgb(r, g, b) { return [r, g, b]; }

export default function generateReport(data) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const W = 210, MARGIN = 15;
  const contentW = W - MARGIN * 2;
  let y = 0;

  function checkPage(need = 30) {
    if (y + need > 280) { doc.addPage(); y = 20; }
  }

  // ─── Cover ───
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 297, 'F');

  // Gold accent line
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 3, 'F');

  // Logo
  doc.setTextColor(...GOLD);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('FUZABALTA', W / 2, 60, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  doc.text('Design Board — Relatório de Produtividade', W / 2, 72, { align: 'center' });

  // Date
  doc.setFontSize(10);
  doc.setTextColor(150, 150, 150);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, W / 2, 85, { align: 'center' });

  // Summary box
  const totalCompleted = data.perDesigner.reduce((s, d) => s + d.completed, 0);
  const totalActive = data.perDesigner.reduce((s, d) => s + d.active, 0);
  const totalOverdue = data.perDesigner.reduce((s, d) => s + d.overdue, 0);

  const summaryY = 110;
  const boxW = contentW / 4;
  const summaryItems = [
    { label: 'Designers', value: data.perDesigner.length, color: GOLD },
    { label: 'Concluídos', value: totalCompleted, color: [0, 184, 148] },
    { label: 'Ativos', value: totalActive, color: [9, 132, 227] },
    { label: 'Atrasados', value: totalOverdue, color: [255, 71, 87] },
  ];

  summaryItems.forEach((item, i) => {
    const x = MARGIN + i * boxW;
    doc.setFillColor(18, 18, 28);
    doc.roundedRect(x + 2, summaryY, boxW - 4, 28, 3, 3, 'F');
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...item.color);
    doc.text(String(item.value), x + boxW / 2, summaryY + 14, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text(item.label.toUpperCase(), x + boxW / 2, summaryY + 22, { align: 'center' });
  });

  // ─── Page 2: Produtividade por Designer ───
  doc.addPage();
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 297, 'F');
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, W, 2, 'F');

  y = 20;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('PRODUTIVIDADE POR DESIGNER', MARGIN, y);
  y += 10;

  // Table
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
    styles: { fontSize: 9, textColor: WHITE, cellPadding: 3, fillColor: false },
    headStyles: { fillColor: [25, 25, 35], textColor: GOLD, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [15, 15, 22] },
    columnStyles: {
      0: { fontStyle: 'bold' },
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center', textColor: (cell) => cell?.raw > 0 ? [255, 71, 87] : WHITE },
      4: { halign: 'center' },
      5: { halign: 'center' },
    },
  });

  y = doc.lastAutoTable.finalY + 15;

  // Bar chart: Concluidos por designer
  checkPage(60);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('CARDS CONCLUÍDOS POR DESIGNER', MARGIN, y);
  y += 8;

  const maxCompleted = Math.max(...data.perDesigner.map(d => d.completed), 1);
  data.perDesigner.forEach((d, i) => {
    checkPage(12);
    const barMaxW = contentW - 55;
    const barW = (d.completed / maxCompleted) * barMaxW;
    const color = DESIGNER_COLORS[i % DESIGNER_COLORS.length];

    doc.setFontSize(9);
    doc.setTextColor(...WHITE);
    doc.text(d.name, MARGIN, y + 5);

    doc.setFillColor(20, 20, 30);
    doc.roundedRect(MARGIN + 30, y, barMaxW, 7, 1, 1, 'F');
    if (barW > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(MARGIN + 30, y, Math.max(barW, 2), 7, 1, 1, 'F');
    }

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...color);
    doc.text(String(d.completed), MARGIN + 32 + barMaxW, y + 5);
    doc.setFont('helvetica', 'normal');
    y += 12;
  });

  // ─── Page 3: Distribuições ───
  y += 10;
  checkPage(80);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('DISTRIBUIÇÃO POR STATUS', MARGIN, y);
  y += 8;

  // Draw pie chart as colored rectangles (legend style)
  const totalByStatus = data.byStatus.reduce((s, d) => s + d.count, 0) || 1;
  data.byStatus.forEach(d => {
    checkPage(10);
    const pct = Math.round((d.count / totalByStatus) * 100);
    const color = STATUS_COLORS[d.status] || GRAY;
    const barW = (d.count / totalByStatus) * (contentW - 60);

    doc.setFillColor(...color);
    doc.roundedRect(MARGIN, y, 4, 4, 1, 1, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...WHITE);
    doc.text(d.status, MARGIN + 7, y + 3.5);

    doc.setFillColor(20, 20, 30);
    doc.roundedRect(MARGIN + 40, y, contentW - 60, 5, 1, 1, 'F');
    if (barW > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(MARGIN + 40, y, Math.max(barW, 2), 5, 1, 1, 'F');
    }

    doc.setTextColor(...GRAY);
    doc.text(`${d.count} (${pct}%)`, MARGIN + contentW - 16, y + 3.5, { align: 'right' });
    y += 9;
  });

  y += 10;
  checkPage(60);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('DISTRIBUIÇÃO POR PRIORIDADE', MARGIN, y);
  y += 8;

  const totalByPri = data.byPriority.reduce((s, d) => s + d.count, 0) || 1;
  data.byPriority.forEach(d => {
    checkPage(10);
    const pct = Math.round((d.count / totalByPri) * 100);
    const color = PRI_COLORS[d.priority] || GRAY;
    const barW = (d.count / totalByPri) * (contentW - 60);

    doc.setFillColor(...color);
    doc.roundedRect(MARGIN, y, 4, 4, 1, 1, 'F');
    doc.setFontSize(8);
    doc.setTextColor(...WHITE);
    doc.text(d.priority, MARGIN + 7, y + 3.5);

    doc.setFillColor(20, 20, 30);
    doc.roundedRect(MARGIN + 40, y, contentW - 60, 5, 1, 1, 'F');
    if (barW > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(MARGIN + 40, y, Math.max(barW, 2), 5, 1, 1, 'F');
    }

    doc.setTextColor(...GRAY);
    doc.text(`${d.count} (${pct}%)`, MARGIN + contentW - 16, y + 3.5, { align: 'right' });
    y += 9;
  });

  // ─── Tipo de Entrega ───
  y += 10;
  checkPage(60);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('POR TIPO DE ENTREGA', MARGIN, y);
  y += 8;

  const maxType = Math.max(...data.byType.map(d => d.count), 1);
  data.byType.forEach(d => {
    checkPage(10);
    const barW = (d.count / maxType) * (contentW - 60);

    doc.setFontSize(8);
    doc.setTextColor(...WHITE);
    doc.text(d.delivery_type || 'Sem tipo', MARGIN, y + 3.5);

    doc.setFillColor(20, 20, 30);
    doc.roundedRect(MARGIN + 40, y, contentW - 60, 5, 1, 1, 'F');
    doc.setFillColor(...GOLD);
    doc.roundedRect(MARGIN + 40, y, Math.max(barW, 2), 5, 1, 1, 'F');

    doc.setTextColor(...GRAY);
    doc.text(String(d.count), MARGIN + contentW - 16, y + 3.5, { align: 'right' });
    y += 9;
  });

  // ─── Retrabalho ───
  y += 10;
  checkPage(60);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('ALTERAÇÕES (RETRABALHO)', MARGIN, y);
  y += 8;

  if (data.rework.length > 0) {
    const maxRework = Math.max(...data.rework.map(d => d.alteracoes), 1);
    data.rework.forEach(d => {
      checkPage(10);
      const barW = (d.alteracoes / maxRework) * (contentW - 60);

      doc.setFontSize(8);
      doc.setTextColor(...WHITE);
      doc.text(d.name, MARGIN, y + 3.5);

      doc.setFillColor(20, 20, 30);
      doc.roundedRect(MARGIN + 40, y, contentW - 60, 5, 1, 1, 'F');
      doc.setFillColor(255, 107, 53);
      doc.roundedRect(MARGIN + 40, y, Math.max(barW, 2), 5, 1, 1, 'F');

      doc.setTextColor(...GRAY);
      doc.text(String(d.alteracoes), MARGIN + contentW - 16, y + 3.5, { align: 'right' });
      y += 9;
    });
  } else {
    doc.setFontSize(8);
    doc.setTextColor(...GRAY);
    doc.text('Nenhuma alteração registrada', MARGIN, y + 3);
    y += 9;
  }

  // ─── Cards mais demorados ───
  y += 10;
  checkPage(50);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...GOLD);
  doc.text('CARDS MAIS DEMORADOS', MARGIN, y);
  y += 5;

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
      styles: { fontSize: 8, textColor: WHITE, cellPadding: 2.5, fillColor: false },
      headStyles: { fillColor: [25, 25, 35], textColor: GOLD, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [15, 15, 22] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center', textColor: GOLD, fontStyle: 'bold' },
        3: { halign: 'center' },
        4: { halign: 'center', textColor: [255, 107, 53], fontStyle: 'bold' },
      },
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // ─── Entregas semanais ───
  if (data.weeklyOutput.length > 0) {
    checkPage(70);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...GOLD);
    doc.text('ENTREGAS POR SEMANA', MARGIN, y);
    y += 5;

    const weeks = [...new Set(data.weeklyOutput.map(d => d.week))].sort();
    const designerNames = [...new Set(data.weeklyOutput.map(d => d.designer_name))];

    const headRow = ['Semana', ...designerNames, 'Total'];
    const bodyRows = weeks.map(w => {
      const row = [new Date(w).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })];
      let total = 0;
      designerNames.forEach(dn => {
        const val = data.weeklyOutput.find(d => d.week === w && d.designer_name === dn)?.count || 0;
        row.push(val || '—');
        total += val;
      });
      row.push(total);
      return row;
    });

    autoTable(doc, {
      startY: y,
      margin: { left: MARGIN, right: MARGIN },
      head: [headRow],
      body: bodyRows,
      theme: 'plain',
      styles: { fontSize: 8, textColor: WHITE, cellPadding: 2.5, fillColor: false, halign: 'center' },
      headStyles: { fillColor: [25, 25, 35], textColor: GOLD, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [15, 15, 22] },
      columnStyles: { 0: { halign: 'left' } },
    });
  }

  // ─── Footer em todas as paginas ───
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...GOLD);
    doc.rect(0, 295, W, 2, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.text(`FUZABALTA Design Board — Página ${i}/${pageCount}`, W / 2, 292, { align: 'center' });
  }

  doc.save(`FUZABALTA_Relatorio_${new Date().toISOString().slice(0, 10)}.pdf`);
}
