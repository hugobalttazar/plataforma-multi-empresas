import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUTPUT_PATH = path.join(ROOT_DIR, 'relatorio-comercial-sistema.pdf');

// Fontes UTF-8 com acentuação perfeita (fallback para Helvetica se necessário)
const FONT_PATHS = {
	regular: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
	bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
};

const COLORS = {
	navy: '#0F172A',
	slateDark: '#1E293B',
	slateText: '#334155',
	muted: '#64748B',
	border: '#CBD5E1',
	bgLight: '#F8FAFC',
	bgBlue: '#EFF6FF',
	blue: '#0284C7',
	blueDark: '#0369A1',
	green: '#15803D',
	bgGreen: '#F0FDF4',
	amber: '#B45309',
	bgAmber: '#FFFBEB',
	purple: '#6D28D9',
	bgPurple: '#F5F3FF',
	white: '#FFFFFF'
};

const PAGE = {
	width: 595.28,  // A4
	height: 841.89, // A4
	marginX: 44,
	marginTop: 50,
	marginBottom: 42
};

const CONTENT_W = PAGE.width - PAGE.marginX * 2;
const BOTTOM_LIMIT = PAGE.height - PAGE.marginBottom;

function createPdfBuilder() {
	const doc = new PDFDocument({
		size: 'A4',
		margins: { top: PAGE.marginTop, bottom: PAGE.marginBottom, left: PAGE.marginX, right: PAGE.marginX },
		bufferPages: true,
		info: {
			Title: 'Relatório de Funcionalidades, Oferta Comercial e Guia de Vendas',
			Author: 'Plataforma de Gestão Multi-Empresas SaaS',
			Subject: 'Inventário do Sistema, Planos Vendáveis e Scripts de Apresentação por Segmento',
			Keywords: 'SaaS, Multi-Empresas, Gestão, Vendas, Lava-Jato, Barbearia, Oficina, Assistência, Pet Shop'
		}
	});

	let F_REG = 'Helvetica';
	let F_BOLD = 'Helvetica-Bold';
	if (fs.existsSync(FONT_PATHS.regular) && fs.existsSync(FONT_PATHS.bold)) {
		doc.registerFont('Sans', FONT_PATHS.regular);
		doc.registerFont('Sans-Bold', FONT_PATHS.bold);
		F_REG = 'Sans';
		F_BOLD = 'Sans-Bold';
	}

	let y = PAGE.marginTop;

	function newPage() {
		doc.addPage();
		y = PAGE.marginTop;
	}

	function ensureSpace(neededHeight) {
		if (y + neededHeight > BOTTOM_LIMIT) {
			newPage();
			return true;
		}
		return false;
	}

	function drawSectionHeader(kicker, title, subtitle) {
		ensureSpace(66);
		doc.save();
		doc.fillColor(COLORS.blue)
			.font(F_BOLD)
			.fontSize(8.2)
			.text(kicker.toUpperCase(), PAGE.marginX, y, { width: CONTENT_W, characterSpacing: 0.6 });
		y += 12;

		doc.fillColor(COLORS.navy)
			.font(F_BOLD)
			.fontSize(15.5)
			.text(title, PAGE.marginX, y, { width: CONTENT_W });
		y = doc.y + 3;

		if (subtitle) {
			doc.fillColor(COLORS.muted)
				.font(F_REG)
				.fontSize(9.0)
				.text(subtitle, PAGE.marginX, y, { width: CONTENT_W, lineGap: 1.5 });
			y = doc.y + 7;
		}

		doc.moveTo(PAGE.marginX, y)
			.lineTo(PAGE.marginX + 66, y)
			.lineWidth(2.4)
			.strokeColor(COLORS.blue)
			.stroke();

		doc.moveTo(PAGE.marginX + 66, y)
			.lineTo(PAGE.marginX + CONTENT_W, y)
			.lineWidth(0.6)
			.strokeColor(COLORS.border)
			.stroke();

		doc.restore();
		y += 12;
	}

	function drawParagraph(text, options = {}) {
		const font = options.bold ? F_BOLD : F_REG;
		const size = options.size || 9.2;
		const color = options.color || COLORS.slateText;
		const gap = options.gap !== undefined ? options.gap : 7;

		doc.font(font).fontSize(size);
		const h = doc.heightOfString(text, { width: CONTENT_W, lineGap: 2 });
		ensureSpace(h + gap);

		doc.fillColor(color)
			.font(font)
			.fontSize(size)
			.text(text, PAGE.marginX, y, { width: CONTENT_W, lineGap: 2 });
		y = doc.y + gap;
	}

	function drawBulletList(items, options = {}) {
		const color = options.color || COLORS.slateText;
		const dotColor = options.dotColor || COLORS.blue;
		const size = options.size || 8.9;

		for (const item of items) {
			const hasTitle = typeof item === 'object' && item !== null;
			const titleText = hasTitle ? `${item.title}: ` : '';
			const bodyText = hasTitle ? item.text : String(item);

			doc.font(F_REG).fontSize(size);
			const h = doc.heightOfString(titleText + bodyText, { width: CONTENT_W - 18, lineGap: 1.8 });
			ensureSpace(h + 5);

			doc.save();
			doc.circle(PAGE.marginX + 5, y + 5, 2.2).fill(dotColor);
			doc.restore();

			if (hasTitle) {
				doc.fillColor(COLORS.navy).font(F_BOLD).fontSize(size)
					.text(titleText, PAGE.marginX + 14, y, { width: CONTENT_W - 14, continued: true, lineGap: 1.8 });
				doc.fillColor(color).font(F_REG).fontSize(size)
					.text(bodyText, { width: CONTENT_W - 14, lineGap: 1.8 });
			} else {
				doc.fillColor(color).font(F_REG).fontSize(size)
					.text(bodyText, PAGE.marginX + 14, y, { width: CONTENT_W - 14, lineGap: 1.8 });
			}
			y = doc.y + 4;
		}
		y += 4;
	}

	function drawFeatureCard(numberStr, title, tag, whatItDoes, valueProp, accentColor = COLORS.blue) {
		const padX = 11;
		const padY = 8;
		const innerW = CONTENT_W - padX * 2;

		doc.font(F_REG).fontSize(8.4);
		const hWhat = doc.heightOfString(`O que faz: ${whatItDoes}`, { width: innerW, lineGap: 1.5 });
		const hVal = doc.heightOfString(`Por que vende: ${valueProp}`, { width: innerW, lineGap: 1.5 });
		const totalH = padY * 2 + 20 + hWhat + hVal + 6;

		ensureSpace(totalH + 7);

		doc.save();
		doc.roundedRect(PAGE.marginX, y, CONTENT_W, totalH, 5)
			.fillAndStroke(COLORS.bgLight, COLORS.border);

		doc.roundedRect(PAGE.marginX, y, 4, totalH, 2).fill(accentColor);

		// Badge numerado
		doc.roundedRect(PAGE.marginX + padX, y + padY, 21, 15, 3).fill(accentColor);
		doc.fillColor(COLORS.white).font(F_BOLD).fontSize(8.0)
			.text(numberStr, PAGE.marginX + padX, y + padY + 3, { width: 21, align: 'center', lineBreak: false });

		// Título
		doc.fillColor(COLORS.navy).font(F_BOLD).fontSize(9.9)
			.text(title, PAGE.marginX + padX + 27, y + padY + 1.5, { width: innerW - 132 });

		// Tag direita
		if (tag) {
			const tagW = Math.min(110, doc.font(F_BOLD).fontSize(7.2).widthOfString(tag) + 14);
			const tagX = PAGE.marginX + CONTENT_W - padX - tagW;
			doc.roundedRect(tagX, y + padY + 0.5, tagW, 14, 3).fill(COLORS.bgBlue);
			doc.fillColor(COLORS.blueDark).font(F_BOLD).fontSize(7.0)
				.text(tag, tagX, y + padY + 3.5, { width: tagW, align: 'center', lineBreak: false });
		}

		let cy = y + padY + 19;
		doc.fillColor(COLORS.navy).font(F_BOLD).fontSize(8.4)
			.text('O que faz: ', PAGE.marginX + padX, cy, { width: innerW, continued: true, lineGap: 1.5 });
		doc.fillColor(COLORS.slateText).font(F_REG).fontSize(8.4)
			.text(whatItDoes, { width: innerW, lineGap: 1.5 });

		cy = doc.y + 3;
		doc.fillColor(COLORS.blueDark).font(F_BOLD).fontSize(8.4)
			.text('Por que vende: ', PAGE.marginX + padX, cy, { width: innerW, continued: true, lineGap: 1.5 });
		doc.fillColor(COLORS.slateDark).font(F_REG).fontSize(8.4)
			.text(valueProp, { width: innerW, lineGap: 1.5 });

		doc.restore();
		y += totalH + 7;
	}

	function drawCalloutBox(title, body, bgColor, borderColor, titleColor) {
		const pad = 10;
		const innerW = CONTENT_W - pad * 2;
		doc.font(F_REG).fontSize(8.6);
		const bodyH = doc.heightOfString(body, { width: innerW, lineGap: 1.8 });
		const totalH = pad * 2 + 15 + bodyH + 3;

		ensureSpace(totalH + 8);

		doc.save();
		doc.roundedRect(PAGE.marginX, y, CONTENT_W, totalH, 6)
			.fillAndStroke(bgColor, borderColor);

		doc.fillColor(titleColor).font(F_BOLD).fontSize(9.4)
			.text(title, PAGE.marginX + pad, y + pad, { width: innerW });
		doc.fillColor(COLORS.slateDark).font(F_REG).fontSize(8.6)
			.text(body, PAGE.marginX + pad, doc.y + 3, { width: innerW, lineGap: 1.8 });
		doc.restore();

		y += totalH + 8;
	}

	function drawSegmentPlaybook({ badge, segment, idealFor, pains, showOnDemo, pitchScript, closingHook, accentColor }) {
		const pad = 11;
		const innerW = CONTENT_W - pad * 2;

		doc.font(F_REG).fontSize(8.4);
		const hIdeal = doc.heightOfString(`Perfil alvo: ${idealFor}`, { width: innerW, lineGap: 1.6 });
		const hPains = doc.heightOfString(`Dores que o dono enfrenta: ${pains}`, { width: innerW, lineGap: 1.6 });
		const hDemo = doc.heightOfString(`O que mostrar na tela: ${showOnDemo}`, { width: innerW, lineGap: 1.6 });
		const hScript = doc.heightOfString(`"${pitchScript}"`, { width: innerW - 16, lineGap: 1.8 });
		const hHook = doc.heightOfString(`Pergunta de fechamento: ${closingHook}`, { width: innerW, lineGap: 1.6 });

		const scriptBoxH = hScript + 22;
		const totalH = pad * 2 + 25 + hIdeal + hPains + hDemo + scriptBoxH + hHook + 22;

		ensureSpace(totalH + 10);

		doc.save();
		doc.roundedRect(PAGE.marginX, y, CONTENT_W, totalH, 6)
			.fillAndStroke(COLORS.white, COLORS.border);

		// Barra superior colorida
		doc.roundedRect(PAGE.marginX, y, CONTENT_W, 25, 6).fill(COLORS.navy);
		doc.rect(PAGE.marginX, y + 13, CONTENT_W, 12).fill(COLORS.navy);
		doc.roundedRect(PAGE.marginX + pad, y + 5, 78, 15, 3).fill(accentColor);
		doc.fillColor(COLORS.white).font(F_BOLD).fontSize(7.2)
			.text(badge, PAGE.marginX + pad, y + 8.5, { width: 78, align: 'center', lineBreak: false });

		doc.fillColor(COLORS.white).font(F_BOLD).fontSize(10.2)
			.text(segment, PAGE.marginX + pad + 86, y + 7, { width: innerW - 86, lineBreak: false });

		let cy = y + 32;
		const writeLabeled = (label, text, labelColor = COLORS.navy) => {
			doc.fillColor(labelColor).font(F_BOLD).fontSize(8.4)
				.text(`${label}: `, PAGE.marginX + pad, cy, { width: innerW, continued: true, lineGap: 1.6 });
			doc.fillColor(COLORS.slateText).font(F_REG).fontSize(8.4)
				.text(text, { width: innerW, lineGap: 1.6 });
			cy = doc.y + 3.5;
		};

		writeLabeled('Perfil alvo', idealFor);
		writeLabeled('Dores que o dono enfrenta', pains, COLORS.amber);
		writeLabeled('O que mostrar na tela', showOnDemo, COLORS.blueDark);

		// Caixa de script de fala
		cy += 2;
		doc.roundedRect(PAGE.marginX + pad, cy, innerW, scriptBoxH, 5)
			.fillAndStroke(COLORS.bgBlue, '#BFDBFE');
		doc.fillColor(COLORS.blueDark).font(F_BOLD).fontSize(7.6)
			.text('O QUE FALAR NA APRESENTAÇÃO (SCRIPT PRONTO):', PAGE.marginX + pad + 8, cy + 6, { width: innerW - 16 });
		doc.fillColor(COLORS.navy).font(F_REG).fontSize(8.4)
			.text(`"${pitchScript}"`, PAGE.marginX + pad + 8, doc.y + 2, { width: innerW - 16, lineGap: 1.8 });

		cy = cy + scriptBoxH + 6;
		writeLabeled('Pergunta de fechamento', closingHook, COLORS.green);

		doc.restore();
		y += totalH + 10;
	}

	function drawTwoColTable(headers, rows, colWidths) {
		const rowPadY = 4;
		const rowPadX = 7;

		ensureSpace(36);
		doc.save();
		doc.roundedRect(PAGE.marginX, y, CONTENT_W, 20, 4).fill(COLORS.navy);
		let cx = PAGE.marginX;
		headers.forEach((h, idx) => {
			doc.fillColor(COLORS.white).font(F_BOLD).fontSize(8.0)
				.text(h, cx + rowPadX, y + 5.5, { width: colWidths[idx] - rowPadX * 2 });
			cx += colWidths[idx];
		});
		doc.restore();
		y += 20;

		rows.forEach((row, rIdx) => {
			let maxH = 0;
			row.forEach((cell, cIdx) => {
				const f = cIdx === 0 ? F_BOLD : F_REG;
				doc.font(f).fontSize(7.9);
				const ch = doc.heightOfString(cell, { width: colWidths[cIdx] - rowPadX * 2, lineGap: 1.3 });
				if (ch > maxH) maxH = ch;
			});
			const rowH = maxH + rowPadY * 2;

			if (ensureSpace(rowH + 4)) {
				doc.save();
				doc.roundedRect(PAGE.marginX, y, CONTENT_W, 20, 4).fill(COLORS.navy);
				let hx = PAGE.marginX;
				headers.forEach((h, idx) => {
					doc.fillColor(COLORS.white).font(F_BOLD).fontSize(8.0)
						.text(h, hx + rowPadX, y + 5.5, { width: colWidths[idx] - rowPadX * 2 });
					hx += colWidths[idx];
				});
				doc.restore();
				y += 20;
			}

			doc.save();
			doc.rect(PAGE.marginX, y, CONTENT_W, rowH)
				.fillAndStroke(rIdx % 2 === 0 ? COLORS.white : COLORS.bgLight, COLORS.border);

			let rx = PAGE.marginX;
			row.forEach((cell, cIdx) => {
				const isFirst = cIdx === 0;
				doc.fillColor(isFirst ? COLORS.navy : COLORS.slateText)
					.font(isFirst ? F_BOLD : F_REG)
					.fontSize(7.9)
					.text(cell, rx + rowPadX, y + rowPadY, { width: colWidths[cIdx] - rowPadX * 2, lineGap: 1.3 });
				rx += colWidths[cIdx];
			});
			doc.restore();
			y += rowH;
		});
		y += 6;
	}

	function drawCoverPage() {
		doc.save();
		doc.rect(0, 0, PAGE.width, 300).fill(COLORS.navy);
		doc.rect(0, 300, PAGE.width, 6).fill(COLORS.blue);

		const kickerCover = 'DOSSIÊ TÉCNICO-COMERCIAL E PLAYBOOK DE VENDAS';
		const kickerW = doc.font(F_BOLD).fontSize(8.0).widthOfString(kickerCover) + 22;
		doc.roundedRect(PAGE.marginX, 54, kickerW, 22, 4).fill('#1E293B');
		doc.fillColor('#38BDF8').font(F_BOLD).fontSize(8.0)
			.text(kickerCover, PAGE.marginX + 11, 61, { lineBreak: false });

		doc.fillColor(COLORS.white).font(F_BOLD).fontSize(24)
			.text('Plataforma de Gestão\nMulti-Empresas (SaaS)', PAGE.marginX, 96, { width: CONTENT_W, lineGap: 4 });

		doc.fillColor('#CBD5E1').font(F_REG).fontSize(11.2)
			.text(
				'Inventário completo de funcionalidades implementadas, estrutura de planos vendáveis e roteiros práticos de apresentação para cada perfil de cliente.',
				PAGE.marginX,
				174,
				{ width: CONTENT_W, lineGap: 3.2 }
			);

		const cardGap = 10;
		const cardW = (CONTENT_W - cardGap * 3) / 4;
		const cards = [
			{ num: '12', label: 'Módulos Integrados\nno Sistema' },
			{ num: '6+', label: 'Segmentos Prontos\n(Whitelabel)' },
			{ num: '3', label: 'Planos SaaS\nConfigurados' },
			{ num: '15', label: 'Permissões\npor Colaborador' }
		];

		cards.forEach((c, idx) => {
			const cx = PAGE.marginX + idx * (cardW + cardGap);
			doc.roundedRect(cx, 240, cardW, 46, 5).fill('#1E293B');
			doc.fillColor('#38BDF8').font(F_BOLD).fontSize(14.5)
				.text(c.num, cx + 8, 246, { width: cardW - 16, lineBreak: false });
			doc.fillColor('#E2E8F0').font(F_REG).fontSize(7.2)
				.text(c.label, cx + 8, 265, { width: cardW - 16, lineGap: 1.2 });
		});

		doc.restore();

		y = 332;
		doc.fillColor(COLORS.navy).font(F_BOLD).fontSize(12.5)
			.text('O que você encontra neste guia', PAGE.marginX, y);
		y += 22;

		const tocItems = [
			{
				cap: 'CAPÍTULO 1',
				title: 'Arquitetura, Tecnologia e Diferenciais Competitivos',
				desc: 'Por que a combinação Local-First + Nuvem Firestore, PWA instalável, Modo Claro/Escuro e segurança PBKDF2 coloca o sistema acima das planilhas e softwares engessados.'
			},
			{
				cap: 'CAPÍTULO 2',
				title: 'Inventário Completo do Sistema (12 Módulos Reais)',
				desc: 'Mapeamento fiel de todas as telas e recursos existentes hoje: O.S., Orçamento Digital, Painel TV, Agenda Online, Caixa em 4 pilares, Estoque, Pós-Venda e Master.'
			},
			{
				cap: 'CAPÍTULO 3',
				title: 'O Que é Vendável, Planos SaaS e Aceleradores de Fechamento',
				desc: 'Como posicionar os planos Básico (R$ 79,90), Profissional (R$ 149,90) e Multi-Loja (R$ 299,90) e quais recursos convencem o cliente a assinar na hora.'
			},
			{
				cap: 'CAPÍTULO 4',
				title: 'Roteiros de Fala por Tipo de Cliente (6 Nichos + Redes)',
				desc: 'Dores exatas, telas para demonstrar e discurso pronto para falar com donos de Lava-Jato, Barbearia, Oficina Mecânica, Assistência Técnica, Pet Shop e Multi-Lojas.'
			},
			{
				cap: 'CAPÍTULO 5',
				title: 'Demonstração em 10 Minutos e Quebra de Objeções',
				desc: 'Passo a passo cronometrado da reunião ao vivo e respostas objetivas para as dúvidas mais comuns antes do fechamento.'
			}
		];

		tocItems.forEach((item) => {
			doc.save();
			doc.roundedRect(PAGE.marginX, y, CONTENT_W, 66, 6)
				.fillAndStroke(COLORS.bgLight, COLORS.border);
			doc.roundedRect(PAGE.marginX + 10, y + 11, 74, 15, 3).fill(COLORS.blue);
			doc.fillColor(COLORS.white).font(F_BOLD).fontSize(7.2)
				.text(item.cap, PAGE.marginX + 10, y + 14.5, { width: 74, align: 'center', lineBreak: false });

			doc.fillColor(COLORS.navy).font(F_BOLD).fontSize(10.0)
				.text(item.title, PAGE.marginX + 94, y + 10, { width: CONTENT_W - 106 });
			doc.fillColor(COLORS.slateText).font(F_REG).fontSize(8.4)
				.text(item.desc, PAGE.marginX + 94, y + 26, { width: CONTENT_W - 106, lineGap: 1.6 });
			doc.restore();
			y += 74;
		});

		doc.save();
		doc.fillColor(COLORS.muted).font(F_REG).fontSize(8.0)
			.text(
				'Documento gerado a partir dos módulos ativos no código-fonte da plataforma. Use este material como apoio comercial em reuniões presenciais, chamadas de vídeo ou WhatsApp.',
				PAGE.marginX,
				746,
				{ width: CONTENT_W, align: 'center', lineGap: 1.5 }
			);
		doc.restore();
	}

	function applyHeadersAndFooters() {
		const range = doc.bufferedPageRange();
		const total = range.count;
		for (let i = 1; i < total; i++) {
			doc.switchToPage(i);
			const prevBottom = doc.page.margins.bottom;
			const prevTop = doc.page.margins.top;
			doc.page.margins.bottom = 0;
			doc.page.margins.top = 0;
			doc.save();

			doc.fillColor(COLORS.muted).font(F_BOLD).fontSize(7.3)
				.text('PLATAFORMA DE GESTÃO MULTI-EMPRESAS (SAAS)', PAGE.marginX, 22, { lineBreak: false });
			doc.fillColor(COLORS.blueDark).font(F_REG).fontSize(7.3)
				.text('Relatório de Funcionalidades & Guia Comercial', PAGE.marginX, 22, { width: CONTENT_W, align: 'right', lineBreak: false });
			doc.moveTo(PAGE.marginX, 34).lineTo(PAGE.marginX + CONTENT_W, 34)
				.lineWidth(0.5).strokeColor(COLORS.border).stroke();

			doc.moveTo(PAGE.marginX, PAGE.height - 34).lineTo(PAGE.marginX + CONTENT_W, PAGE.height - 34)
				.lineWidth(0.5).strokeColor(COLORS.border).stroke();
			doc.fillColor(COLORS.muted).font(F_REG).fontSize(7.5)
				.text('Material de Apresentação Comercial • Uso do Administrador da Plataforma', PAGE.marginX, PAGE.height - 25, { lineBreak: false });
			doc.fillColor(COLORS.slateDark).font(F_BOLD).fontSize(7.5)
				.text(`Página ${i + 1} de ${total}`, PAGE.marginX, PAGE.height - 25, { width: CONTENT_W, align: 'right', lineBreak: false });

			doc.restore();
			doc.page.margins.bottom = prevBottom;
			doc.page.margins.top = prevTop;
		}
		return total;
	}

	return {
		doc,
		newPage,
		drawCoverPage,
		drawSectionHeader,
		drawParagraph,
		drawBulletList,
		drawFeatureCard,
		drawCalloutBox,
		drawSegmentPlaybook,
		drawTwoColTable,
		applyHeadersAndFooters
	};
}

function buildReportPdf() {
	const pdf = createPdfBuilder();

	// ======================================================================
	// CAPA
	// ======================================================================
	pdf.drawCoverPage();

	// ======================================================================
	// CAPÍTULO 1 - VISÃO GERAL E DIFERENCIAIS
	// ======================================================================
	pdf.newPage();
	pdf.drawSectionHeader(
		'Capítulo 1 • Tecnologia e Posicionamento',
		'Visão Geral e Diferenciais Competitivos',
		'O que sustenta a proposta de valor da plataforma frente a caderninhos, planilhas e sistemas engessados.'
	);

	pdf.drawParagraph(
		'Esta plataforma é um sistema completo de gestão operacional, relacionamento com clientes (CRM), faturamento e retenção pós-venda, desenvolvido com arquitetura Multi-Empresas (Multi-Tenant). Cada cliente contratante recebe um ambiente isolado, personalizável com a marca e a linguagem do seu próprio segmento.'
	);

	pdf.drawBulletList([
		{
			title: 'Operação Híbrida Local-First + Nuvem (Firebase Firestore)',
			text: 'O sistema responde com velocidade instantânea no navegador mesmo em conexões instáveis e sincroniza os dados da empresa na nuvem com isolamento por estabelecimento.'
		},
		{
			title: 'Aplicativo Instalável (PWA) e Responsivo',
			text: 'Funciona em computadores de balcão, tablets, celulares Android/iOS e Smart TVs. O cliente instala direto do navegador, sem burocracia de lojas de aplicativos, com alternância entre Modo Claro e Modo Escuro.'
		},
		{
			title: 'Whitelabel Adaptável a 6+ Segmentos',
			text: 'Ao cadastrar a empresa, o sistema adapta títulos, ícones e campos da Ordem de Serviço: Placa/Modelo/Cor no setor automotivo ou Foto/Descrição do Item/Pet/Aparelho nos demais negócios.'
		},
		{
			title: 'Segurança Criptográfica e Controle de Acesso (RBAC)',
			text: 'Senhas protegidas com PBKDF2 + Salt (100.000 iterações), bloqueio automático contra força bruta (5 tentativas incorretas bloqueiam por 15 minutos), sessões assinadas com HMAC-SHA256 e 15 permissões granulares por colaborador.'
		},
		{
			title: 'Portabilidade Total de Dados (Backup JSON)',
			text: 'Tanto o dono da empresa quanto o Administrador Master conseguem baixar e restaurar cópias completas em arquivo JSON a qualquer momento.'
		}
	]);

	pdf.drawCalloutBox(
		'Resumo pronto para abrir qualquer conversa comercial',
		'"Nosso sistema substitui o caderninho, a planilha e o controle manual de cobrança em um único aplicativo web instalável. Ele organiza desde a entrada do atendimento ou agendamento online até o pagamento no PIX, o painel da TV na recepção, a comissão da equipe e a mensagem automática de retorno no WhatsApp."',
		COLORS.bgBlue,
		'#93C5FD',
		COLORS.blueDark
	);

	// ======================================================================
	// CAPÍTULO 2 - INVENTÁRIO COMPLETO DE FUNCIONALIDADES
	// ======================================================================
	pdf.newPage();
	pdf.drawSectionHeader(
		'Capítulo 2 • Inventário Completo do Sistema',
		'Todas as Funcionalidades Implementadas (12 Módulos)',
		'Levantamento fiel das telas, serviços e automações ativas no sistema atual.'
	);

	pdf.drawFeatureCard(
		'01',
		'Painel de Controle (Dashboard em Tempo Real)',
		'index.html',
		'Exibe cards operacionais (atendimentos em aberto no pátio, faturamento do dia, base de clientes e ticket médio), Velocímetro de Meta Diária calculado automaticamente pelos dias de expediente do mês, alertas de contas a pagar/receber e checklist de Onboarding em 4 etapas.',
		'O dono bate o olho pela manhã e já sabe quanto precisa faturar no dia, quantos atendimentos estão em curso e se existe conta vencendo.'
	);

	pdf.drawFeatureCard(
		'02',
		'Ordens de Serviço (O.S.), Pátio e Vistoria Expressa',
		'pedidos.html',
		'Abre O.S. com busca inteligente de cliente, seleção de múltiplos veículos por cliente (ou foto + descrição do item/pet/aparelho fora do automotivo), checklist de vistoria/avarias de entrada, vínculo com profissional executor, venda de produtos do estoque na O.S. e baixa de créditos de pacotes.',
		'Elimina perda de comandas de papel, evita reclamações por avarias não registradas e aumenta o ticket médio com venda de produtos adicionais.'
	);

	pdf.drawFeatureCard(
		'03',
		'Orçamento Digital com Link Público e Auditoria',
		'orcamento.html',
		'Gera uma página online exclusiva do orçamento para enviar ao cliente no WhatsApp com serviços, produtos, vistoria e valores. O cliente aprova ou recusa pelo celular, com registro de data/hora/IP e histórico completo de edições antes da conversão em O.S.',
		'Passa imagem de empresa profissional e acelera a aprovação de serviços mais caros sem discussão sobre o que foi combinado.'
	);

	pdf.drawFeatureCard(
		'04',
		'Painel TV para Sala de Espera',
		'painel-tv.html',
		'Tela dedicada para Smart TV ou monitor na recepção mostrando em tempo real o status "Em Serviço" e "Prontos para Retirada", com relógio ao vivo, rolagem vertical para listas extensas, link compartilhável e sincronização automática entre Modo Claro e Escuro.',
		'Encanta o cliente na sala de espera e acaba com interrupções do tipo "meu atendimento já terminou?".'
	);

	pdf.drawFeatureCard(
		'05',
		'Agendamentos, Google Calendar e Autoagendamento Online',
		'agendamentos.html',
		'Controla a grade de horários com filtro por data e reagendamento rápido, sincroniza eventos no Google Calendar, envia lembretes com link para o cliente salvar na agenda e disponibiliza o Link Público de Autoagendamento (agenda-publica.html) para reserva direta pelo cliente.',
		'Organiza o fluxo da semana, reduz faltas e permite receber agendamentos mesmo fora do horário comercial.'
	);

	pdf.drawFeatureCard(
		'06',
		'Livro Caixa e Gestão Financeira em 4 Pilares',
		'caixa.html',
		'Reúne 4 módulos integrados: (1) Caixa do Dia com fundo de troco, entradas automáticas das O.S., sangrias/saídas, fechamento/reabertura e virada automática; (2) Contas a Pagar/Receber com alertas de vencimento e baixa no caixa; (3) Faturamento Agrupado para Frotas/Empresas; (4) Pacotes e Planos de Serviços.',
		'Resolve desde o troco do dia até contratos mensais com frotas de empresas e receita recorrente por pacotes.'
	);

	pdf.drawFeatureCard(
		'07',
		'Estoque de Insumos e Produtos Comerciais',
		'estoque.html',
		'Separa insumos de uso interno dos produtos de venda no balcão, oferece calculadora bidirecional de custo, margem (%) e preço de venda, emite alerta visual quando atinge estoque mínimo e realiza baixa automática ao vender na O.S.',
		'Impede o prejuízo de ficar sem produto no meio do dia e garante margem de lucro correta nas vendas de balcão.'
	);

	pdf.drawFeatureCard(
		'08',
		'Pós-Venda, Fidelidade e Radar de Retorno',
		'fidelidade.html',
		'Gerencia cartão fidelidade por selos com meta e prêmio configuráveis, monitora clientes ausentes pelo prazo padrão ou pelo prazo específico configurado em cada serviço, aplica trava anti-spam de 15 dias para lembretes enviados e dispara convite pelo WhatsApp.',
		'Faz dinheiro voltar para o caixa trazendo clientes antigos de volta sem gastar nada com anúncios pagos.'
	);

	pdf.drawFeatureCard(
		'09',
		'Recibo Digital em Imagem (PNG) e PIX Padrão BACEN',
		'pix-service.js',
		'Gera recibo visual em alta resolução (Canvas PNG) com os dados do estabelecimento, serviços realizados, forma de pagamento e QR Code PIX padrão Banco Central (EMV + CRC16) com código Copia e Cola contendo o valor exato da O.S.',
		'Substitui impressora térmica e bobina de papel, facilita o recebimento na hora e elimina erros de digitação na chave PIX.'
	);

	pdf.drawFeatureCard(
		'10',
		'WhatsApp Inteligente (App-First) e Modelos Editáveis',
		'whatsapp-service.js',
		'Prioriza abrir diretamente no aplicativo WhatsApp instalado (celular ou PC) com fallback para WhatsApp Web. Traz 4 modelos editáveis (Agendamento, Pronto, Recibo, Fidelidade) com 16 etiquetas automáticas, prévia ao vivo e opção de omitir valores removendo {valor_total}.',
		'Padroniza o atendimento da equipe com mensagens elegantes em 1 clique, sem precisar copiar e colar textos manualmente.'
	);

	pdf.drawFeatureCard(
		'11',
		'Base de Clientes, Histórico Completo e Catálogo de Serviços',
		'clientes / servicos',
		'Armazena cadastro de clientes com múltiplos veículos, histórico completo de O.S. e recibos anteriores para consulta rápida, além de catálogo padronizado de serviços com tabela de preços e definição de dias sugeridos de retorno para o Pós-Venda.',
		'Mantém a memória do negócio dentro da empresa mesmo se um funcionário sair.'
	);

	pdf.drawFeatureCard(
		'12',
		'Equipe, Comissões, Usuários e Controle Master SaaS',
		'config / admin',
		'Calcula comissões por porcentagem (%) ou valor fixo (R$) por período com quitação lançada no Caixa; permite ao dono criar colaboradores escolhendo quais das 15 permissões liberar; e entrega ao Admin Master o painel admin.html com criação de empresas, planos, vencimento e suspensão.',
		'Dá segurança para o dono delegar o operacional sem expor o financeiro e permite a você gerenciar dezenas de clientes pagantes em um só lugar.'
	);

	// ======================================================================
	// CAPÍTULO 3 - O QUE É VENDÁVEL & ESTRATÉGIA DE PLANOS
	// ======================================================================
	pdf.newPage();
	pdf.drawSectionHeader(
		'Capítulo 3 • Empacotamento Comercial',
		'O Que é Vendável e Como Posicionar os Planos',
		'Estrutura comercial alinhada aos planos já cadastrados no módulo SaasGuard do sistema.'
	);

	pdf.drawParagraph(
		'O sistema possui três faixas comerciais prontas no código (PLANOS_SAAS em js/saas-guard.js), com controle automático de limite de usuários, data de vencimento, dias de tolerância e bloqueio seguro de novos cadastros em caso de inadimplência (mantendo consultas e encerramento de O.S. abertas).',
		{ gap: 8 }
	);

	pdf.drawTwoColTable(
		['Plano no Sistema', 'Preço Sugerido / Limite', 'Público Ideal', 'Principais Argumentos de Venda'],
		[
			[
				'Básico',
				'R$ 79,90 / mês\nAté 2 usuários',
				'Profissional autônomo ou operação pequena (1 a 2 pessoas).',
				'Substitui o caderno: Cadastro de Clientes, Serviços, Agenda, O.S. e Caixa Diário no celular ou PC.'
			],
			[
				'Profissional\n(Carro-Chefe)',
				'R$ 149,90 / mês\nAté 5 usuários',
				'Empresas estruturadas com equipe e recepção/sala de espera.',
				'Pacote completo para crescer: Orçamento Digital, Painel TV, Pós-Venda/Fidelidade, Pacotes Mensais, Estoque, Contas, Comissões e WhatsApp personalizado.'
			],
			[
				'Multi-Loja',
				'R$ 299,90 / mês\nAté 20 usuários',
				'Redes, franquias, grandes centros ou operações com frotas.',
				'Até 20 logins com 15 permissões granulares, Faturamento Agrupado de Frotas, controle de comissões em escala e governança centralizada.'
			]
		],
		[90, 106, 128, CONTENT_W - 324]
	);

	pdf.drawCalloutBox(
		'Transparência técnica importante para a sua operação comercial',
		'Hoje no código, quando você cria uma empresa no Painel Master, todas as funcionalidades ficam liberadas para o administrador daquela empresa, que escolhe livremente quais dos 15 módulos liberar para seus colaboradores. Já o seu controle SaaS no Painel Master valida automaticamente o limite de usuários do plano, a data de vencimento, os dias de tolerância e a suspensão de novos cadastros.',
		COLORS.bgAmber,
		'#FDE68A',
		COLORS.amber
	);

	pdf.drawParagraph('Os 6 "Gatilhos de Venda" (Funcionalidades que justificam o investimento sozinhas):', { bold: true, color: COLORS.navy, size: 10.0, gap: 6 });

	pdf.drawBulletList([
		{
			title: '1. Pós-Venda que se paga sozinho',
			text: 'Se o sistema recuperar apenas 2 clientes ausentes por mês pelo radar automático do WhatsApp, a assinatura mensal já foi paga com sobra.'
		},
		{
			title: '2. Pacotes e Planos Recorrentes',
			text: 'O cliente vende 4 lavagens ou 4 banhos antecipados no dia 5 do mês, garante caixa previsível e o sistema abate os créditos automaticamente a cada visita.'
		},
		{
			title: '3. Orçamento Digital com Aceite Online',
			text: 'Envia proposta profissional pelo WhatsApp em segundos, com auditoria de aceite e edição rastreável.'
		},
		{
			title: '4. Painel TV + Autoagendamento Online',
			text: 'Eleva imediatamente a percepção de marca do estabelecimento diante do consumidor final.'
		},
		{
			title: '5. Faturamento de Frotas B2B',
			text: 'Permite fechar contratos mensais com empresas da região consolidando placas e emitindo extrato para quitação única.'
		},
		{
			title: '6. Tranquilidade para Delegar (15 Permissões)',
			text: 'O dono libera Agenda e O.S. para o funcionário sem liberar acesso ao Caixa, Metas ou Configurações.'
		}
	]);

	// ======================================================================
	// CAPÍTULO 4 - O QUE FALAR PARA CADA CLIENTE (SCRIPTS POR SEGMENTO)
	// ======================================================================
	pdf.newPage();
	pdf.drawSectionHeader(
		'Capítulo 4 • Playbook de Abordagem por Nicho',
		'O Que Falar Para Cada Tipo de Cliente',
		'Scripts prontos baseados nos segmentos configuráveis em BrandService (config_negocio).'
	);

	pdf.drawSegmentPlaybook({
		badge: 'LAVA-JATO',
		segment: 'Lava-Jato e Estética Automotiva / Detailing',
		idealFor: 'Lava-jatos rápidos, estéticas automotivas, polimento, vitrificação e higienização.',
		pains: 'Perda de controle de quem está no pátio, cliente perguntando no WhatsApp se o carro ficou pronto, reclamação de risco/avaria na entrega, dificuldade de fechar comissão de lavadores e clientes que não voltam.',
		showOnDemo: 'Abertura de O.S. com placa/cor/modelo, Vistoria Expressa de entrada, Painel TV de sala de espera, aviso "Carro Pronto" com PIX Copia e Cola, Faturamento de Frotas e Radar de Pós-Venda (25 dias).',
		pitchScript: 'Fulano, hoje quando um carro entra no seu pátio você anota onde? Nosso sistema controla a placa, a cor e a vistoria de entrada no celular. Quando o carro fica pronto, aparece na TV da sua sala de espera e com 1 clique você manda no WhatsApp do cliente com o QR Code PIX já no valor certo. Além disso, depois de 25 dias sem o carro voltar, o sistema te avisa quem sumiu para você chamar de novo no WhatsApp e calcula a comissão dos seus lavadores automaticamente.',
		closingHook: 'Se você recuperar 2 polimentos ou 3 lavagens completas por mês com esse aviso automático de retorno, o sistema já se paga inteiro. Quer testar abrindo uma O.S. com uma placa sua agora?',
		accentColor: COLORS.blue
	});

	pdf.drawSegmentPlaybook({
		badge: 'BARBEARIA',
		segment: 'Barbearia, Salão de Beleza e Studio',
		idealFor: 'Barbearias modernas, salões de cabeleireiro, manicure e estética pessoal.',
		pains: 'Horários furados ou sobrepostos na agenda, perda de tempo respondendo WhatsApp para marcar horário, cálculo confuso de comissão (%) por barbeiro e dificuldade de fidelizar planos mensais de corte/barba.',
		showOnDemo: 'Link de Autoagendamento Online para bio do Instagram/WhatsApp, Google Calendar, venda de Pacotes Mensais (ex: 4 cortes/mês com controle de créditos), Comissões por profissional e modo sem campos de carro (foto/descrição do atendimento).',
		pitchScript: 'Aqui o sistema se transforma inteiro para Barbearia, sem nada de carro na tela. Você coloca o link de autoagendamento na bio do Instagram e o cliente escolhe o serviço e o horário sozinho. Você também cria seu clube de assinatura/pacote mensal de cortes direto no caixa, controla quantos créditos o cliente ainda tem e fecha a comissão de cada barbeiro por porcentagem ou valor fixo sem erro de conta.',
		closingHook: 'Quantas horas por semana você perde hoje respondendo "tem horário?" no WhatsApp e fechando comissão na calculadora?',
		accentColor: COLORS.purple
	});

	pdf.drawSegmentPlaybook({
		badge: 'OFICINA',
		segment: 'Oficina Mecânica, Auto Elétrica e Auto Peças',
		idealFor: 'Mecânicas gerais, centros automotivos, troca de óleo, suspensão e auto elétrica.',
		pains: 'Cliente desconfia de orçamento passado só de boca ou áudio no WhatsApp, alterações de serviço durante o reparo geram atrito na entrega, peças compradas e usadas sem controle de margem e falta de controle de frotas corporativas.',
		showOnDemo: 'Orçamento Digital com link público (mostrando aceite online + IP e histórico de alterações), adição de produtos do estoque com margem calculada no orçamento/O.S., Vistoria de entrada, Contas a Pagar/Receber e Faturamento de Frotas.',
		pitchScript: 'Na oficina, o maior problema é aprovar orçamento caro sem ter prova do que o cliente autorizou. Com nosso sistema você monta o orçamento com serviços e peças do estoque já com margem de lucro, envia o link no WhatsApp e o cliente aprova direto no celular com registro de horário e IP. Se precisar alterar uma peça depois, fica tudo no histórico. Quando termina, você gera o recibo com PIX e ainda controla frotas de empresas para receber por quinzena ou mês.',
		closingHook: 'Só de evitar uma discussão de peça trocada ou agilizar a aprovação de um orçamento no mesmo dia, quanto dinheiro você deixa de perder no pátio?',
		accentColor: COLORS.amber
	});

	pdf.drawSegmentPlaybook({
		badge: 'ASSISTÊNCIA',
		segment: 'Assistência Técnica (Celulares, Notebooks e TI)',
		idealFor: 'Lojas de conserto de smartphones, informática, manutenção de computadores e games.',
		pains: 'Aparelhos parecidos misturados na bancada sem foto de entrada, cliente cobrando posição do conserto o dia todo, orçamento aprovado verbalmente que depois o cliente nega e vendas de acessórios no balcão sem controle de estoque.',
		showOnDemo: 'O.S. adaptada com foto do aparelho e descrição (IMEI/serial/defeito), Painel TV de balcão ("Em Bancada" / "Pronto para Retirada"), Orçamento Digital com histórico de revisões, controle de estoque de peças/acessórios e recibo digital.',
		pitchScript: 'Para assistência técnica o sistema troca a placa por foto e identificação do aparelho na entrada, registrando estado visual e observações. Você manda o orçamento por link para o cliente aprovar no WhatsApp, coloca o status na TV do balcão para o cliente acompanhar se já está pronto e controla tanto peças de reposição quanto capinhas e carregadores de venda no balcão com aviso de estoque mínimo.',
		closingHook: 'Você prefere continuar procurando ordem de serviço em papel quando o cliente volta daqui a 30 dias ou achar todo o histórico pelo nome em 2 segundos?',
		accentColor: COLORS.blueDark
	});

	pdf.drawSegmentPlaybook({
		badge: 'PET SHOP',
		segment: 'Pet Shop, Banho e Tosa e Estética Animal',
		idealFor: 'Pet shops de bairro, clínicas com banho e tosa e centros de estética pet.',
		pains: 'Dificuldade de controlar pacotes de 4 banhos semanais no papel, tutores esquecendo de trazer o pet no prazo de 15 ou 30 dias, confusão de horário de entrega e venda de rações/acessórios junto com o banho.',
		showOnDemo: 'Identificação com foto do pet, Pacotes e Planos de 4 banhos com baixa de crédito na abertura da O.S., Pós-Venda com prazo de retorno configurado por serviço (ex: 7 ou 15 dias para banho), Autoagendamento e aviso no WhatsApp "Pronto para buscar".',
		pitchScript: 'No Pet Shop o que dá lucro recorrente é pacote mensal de banho e retorno frequente. No nosso sistema você cadastra o pacote de 4 banhos e a cada entrada ele desconta 1 crédito sozinho, sem precisar riscar cartão de papel. Você configura retorno de 15 dias para banho e tosa, o sistema lista quem passou do prazo para você mandar 1 clique no WhatsApp e ainda avisa o tutor quando o pet está cheiroso pronto para buscar.',
		closingHook: 'Se 5 tutores fecharem pacote mensal organizado aqui dentro e não esquecerem a renovação, quanto sobe o seu faturamento fixo todo mês?',
		accentColor: COLORS.green
	});

	pdf.drawSegmentPlaybook({
		badge: 'GERAL / REDES',
		segment: 'Outros Segmentos Locais e Redes Multi-Lojas',
		idealFor: 'Serviços em geral (climatização, estofados, bikes, vidraçaria) e donos com mais de 1 loja.',
		pains: 'Cada filial trabalha de um jeito diferente, sem padronização de caixa, sem controle de quem acessa metas/faturamento e sem visibilidade centralizada.',
		showOnDemo: 'Modo "Outro Segmento" com título e ícone customizados, alternância multi-empresa, matriz de 15 permissões por funcionário, Velocímetro de Metas com dias de expediente configurados e Backup completo em JSON.',
		pitchScript: 'Se você tem mais de uma unidade ou um serviço especializado, o sistema permite personalizar o nome, o ícone e o termo de atendimento para a realidade da sua loja. Cada unidade tem caixa, clientes e estoque totalmente separados, mas com o mesmo padrão de qualidade, metas diárias calculadas pelos seus dias de funcionamento e permissões individuais para cada colaborador acessar somente o necessário.',
		closingHook: 'Qual unidade ou setor hoje te dá mais dor de cabeça para controlar sem estar presencialmente lá dentro?',
		accentColor: COLORS.slateDark
	});

	// ======================================================================
	// CAPÍTULO 5 - ROTEIRO DE DEMO (10 MIN) E QUEBRA DE OBJEÇÕES
	// ======================================================================
	pdf.newPage();
	pdf.drawSectionHeader(
		'Capítulo 5 • Fechamento Comercial',
		'Roteiro de Demonstração (10 Minutos) e Quebra de Objeções',
		'Sequência recomendada para conduzir qualquer apresentação presencial ou por chamada de vídeo.'
	);

	pdf.drawParagraph('Passo a passo da demonstração ao vivo (não mostre telas aleatórias; conte uma história do início ao fim do atendimento):', { bold: true, color: COLORS.navy, size: 9.2, gap: 5 });

	pdf.drawTwoColTable(
		['Etapa / Tempo', 'Tela para Abrir', 'O Que Fazer na Frente do Cliente'],
		[
			['1. Diagnóstico\n(2 min)', 'Nenhuma ainda\n(Conversa)', 'Pergunte: "Como você controla hoje quem entra, quanto vendeu no PIX/cartão, comissões e clientes que somem?" Deixe ele falar a dor antes de mostrar a tela.'],
			['2. Entrada e Venda\n(2 min)', 'pedidos.html\n(O.S. + Vistoria)', 'Abra uma O.S. na frente dele usando dados fictícios, marque vistoria, inclua 1 produto do estoque e gere o link de Orçamento Digital.'],
			['3. Experiência\n(2 min)', 'painel-tv.html +\nWhatsApp', 'Mostre o Painel TV alternando entre Modo Claro e Escuro e clique no aviso de WhatsApp com QR Code PIX já montado.'],
			['4. Controle\n(2 min)', 'caixa.html +\nindex.html', 'Mostre o Velocímetro de Meta do Dia, o Livro Caixa por forma de pagamento, Contas a Pagar/Receber e a aba de Pacotes Mensais.'],
			['5. Retenção e Trava\n(2 min)', 'fidelidade.html +\nconfiguracoes.html', 'Mostre a lista de clientes ausentes prontos para chamar no WhatsApp e as 15 caixinhas de permissão para controlar o que cada funcionário vê.']
		],
		[88, 110, CONTENT_W - 198]
	);

	pdf.drawParagraph('Respostas prontas para as 5 objeções mais comuns de compra:', { bold: true, color: COLORS.navy, size: 9.2, gap: 5 });

	pdf.drawTwoColTable(
		['Objeção do Cliente', 'Resposta Comercial Recomendada (Baseada em Fatos do Sistema)'],
		[
			[
				'"Já uso caderno / planilha e funciona bem"',
				'"O caderno anota o passado, mas não te avisa quem faz 25 dias que não volta, não manda link de orçamento profissional e não gera PIX Copia e Cola em 1 clique. O sistema não é só para anotar; ele traz clientes de volta para aumentar seu caixa."'
			],
			[
				'"E se a internet cair no meio do movimento?"',
				'"O sistema foi construído em tecnologia Local-First com PWA. A tela não trava se a conexão oscilar, você continua operando e sincroniza com a nuvem Firestore normalmente."'
			],
			[
				'"Não quero funcionário vendo meu caixa ou faturamento"',
				'"Você escolhe exatamente o que cada login pode abrir dentre 15 permissões. Pode liberar só Agenda e Pedidos para o operador e bloquear Caixa, Metas, Estoque e Ajustes."'
			],
			[
				'"Minha equipe não sabe mexer em sistema complicado"',
				'"Por isso o fluxo tem botões diretos, autopreenchimento de cliente e veículo, mensagens prontas de WhatsApp e visual claro ou escuro que funciona direto no celular ou computador."'
			],
			[
				'"Vou pensar / está caro agora"',
				'"Se você fechar no plano Profissional (R$ 149,90/mês), estamos falando de menos de R$ 5 por dia. Recuperando 2 clientes sumidos no Pós-Venda ou vendendo 1 pacote mensal a mais, o sistema já se pagou no mesmo mês."'
			]
		],
		[155, CONTENT_W - 155]
	);

	pdf.drawCalloutBox(
		'Checklist final antes de sair da reunião com o cliente',
		'1. Confirme o segmento exato do cliente para já configurar o Whitelabel com nome, ícone e segmento corretos no Painel Master.\n2. Defina o plano (Básico, Profissional ou Multi-Loja), limite de usuários e data de vencimento.\n3. Cadastre o login administrador do dono e oriente ele a configurar a Chave PIX, os dias de expediente para a Meta Diária e o catálogo inicial de serviços.\n4. Se for computador de balcão ou celular, clique no botão de instalação do PWA para deixar o ícone do sistema na tela inicial.',
		COLORS.bgGreen,
		'#86EFAC',
		COLORS.green
	);

	const totalPages = pdf.applyHeadersAndFooters();

	return new Promise((resolve, reject) => {
		const stream = fs.createWriteStream(OUTPUT_PATH);
		pdf.doc.pipe(stream);
		pdf.doc.end();
		stream.on('finish', () => {
			const stats = fs.statSync(OUTPUT_PATH);
			resolve({
				outputPath: OUTPUT_PATH,
				bytes: stats.size,
				pages: totalPages
			});
		});
		stream.on('error', reject);
	});
}

buildReportPdf()
	.then((res) => {
		console.log(`PDF gerado com sucesso: ${res.outputPath} (${res.pages} páginas, ${res.bytes} bytes)`);
	})
	.catch((err) => {
		console.error('Erro ao gerar PDF comercial:', err);
		process.exit(1);
	});
