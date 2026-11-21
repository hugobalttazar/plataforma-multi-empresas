// ==========================================================================
// PixService: Gerador de BR Code PIX (Padrão BCB EMV) e QR Code Offline (SVG/Canvas)
// ==========================================================================

(function (global) {
	'use strict';

	// ----------------------------------------------------------------------
	// 1. Utilidades EMV / BR Code PIX
	// ----------------------------------------------------------------------
	function removerAcentos(str) {
		return String(str || '')
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '');
	}

	function limparTextoEMV(str, maxLen, fallback) {
		const limpo = removerAcentos(str)
			.replace(/[^A-Za-z0-9 .\-_/]/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.toUpperCase();
		const finalStr = limpo ? limpo.slice(0, maxLen) : (fallback || '');
		return finalStr;
	}

	function tlv(id, value) {
		const v = String(value || '');
		const len = String(v.length).padStart(2, '0');
		return `${id}${len}${v}`;
	}

	/**
	 * Normaliza a chave PIX conforme padrão DICT do Banco Central:
	 * - E-mail: mantém com trim e minúsculas
	 * - UUID (chave aleatória): mantém formato com hifens
	 * - Telefone com +55 ou celular/CPF/CNPJ: sanitiza adequadamente
	 */
	function normalizarChavePix(chaveBruta) {
		const raw = String(chaveBruta || '').trim();
		if (!raw) return '';

		// E-mail
		if (raw.includes('@')) {
			return raw.toLowerCase();
		}

		// Chave aleatória UUID (ex: 123e4567-e89b-12d3-a456-426614174000)
		if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(raw)) {
			return raw.toLowerCase();
		}

		// Já começa com '+' (ex: +5511999999999)
		if (raw.startsWith('+')) {
			return '+' + raw.slice(1).replace(/\D/g, '');
		}

		// Telefone formatado explicitamente com parênteses ou espaço (ex: (11) 99999-9999)
		const digits = raw.replace(/\D/g, '');
		if ((raw.includes('(') || raw.includes(')')) && (digits.length === 10 || digits.length === 11)) {
			return `+55${digits}`;
		}

		// CPF (11 dígitos) ou CNPJ (14 dígitos)
		if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(raw) || /^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(raw)) {
			return digits;
		}

		if (digits.length === 11 || digits.length === 14) {
			return digits;
		}

		return raw;
	}

	/**
	 * CRC-16/CCITT-FALSE (Polinômio 0x1021, Valor inicial 0xFFFF)
	 */
	function calcularCRC16(payload) {
		let crc = 0xFFFF;
		for (let i = 0; i < payload.length; i++) {
			crc ^= (payload.charCodeAt(i) & 0xFF) << 8;
			for (let bit = 0; bit < 8; bit++) {
				if ((crc & 0x8000) !== 0) {
					crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
				} else {
					crc = (crc << 1) & 0xFFFF;
				}
			}
		}
		return crc.toString(16).toUpperCase().padStart(4, '0');
	}

	function normalizarTxId(txid) {
		const clean = removerAcentos(txid || '')
			.replace(/[^A-Za-z0-9]/g, '')
			.slice(0, 25);
		return clean || '***';
	}

	function gerarPayloadPix(opcoes = {}) {
		const chave = normalizarChavePix(opcoes.chavePix || opcoes.chave || '');
		if (!chave) {
			return { valido: false, erro: 'Chave PIX não configurada.', payload: '' };
		}

		const nomeRecebedor = limparTextoEMV(opcoes.nomeRecebedor || opcoes.nome || 'ESTABELECIMENTO', 25, 'ESTABELECIMENTO');
		const cidade = limparTextoEMV(opcoes.cidade || 'BRASIL', 15, 'BRASIL');
		const txid = normalizarTxId(opcoes.txid || '***');
		const valorNum = parseFloat(opcoes.valor || 0);

		// 26: Merchant Account Information (GUI + Chave + Descrição opcional)
		let mai = tlv('00', 'br.gov.bcb.pix') + tlv('01', chave);
		if (opcoes.descricao) {
			const espacoDisponivel = 99 - mai.length - 4;
			if (espacoDisponivel >= 4) {
				const descLimpa = limparTextoEMV(opcoes.descricao, Math.min(espacoDisponivel, 40), '');
				if (descLimpa) {
					mai += tlv('02', descLimpa);
				}
			}
		}

		let payload = '';
		payload += tlv('00', '01'); // Payload Format Indicator
		payload += tlv('26', mai); // Merchant Account Information
		payload += tlv('52', '0000'); // Merchant Category Code
		payload += tlv('53', '986'); // Transaction Currency (BRL)

		if (Number.isFinite(valorNum) && valorNum > 0) {
			payload += tlv('54', valorNum.toFixed(2));
		}

		payload += tlv('58', 'BR'); // Country Code
		payload += tlv('59', nomeRecebedor);
		payload += tlv('60', cidade);
		payload += tlv('62', tlv('05', txid));
		payload += '6304';

		const crc = calcularCRC16(payload);
		return {
			valido: true,
			payload: payload + crc,
			chaveNormalizada: chave,
			nomeRecebedor,
			cidade,
			txid,
			valor: Number.isFinite(valorNum) && valorNum > 0 ? Number(valorNum.toFixed(2)) : 0
		};
	}

	// ----------------------------------------------------------------------
	// 2. Gerador QR Code ISO/IEC 18004 (Byte Mode, Versões 1..12, ECC Level M)
	// ----------------------------------------------------------------------
	const GF_EXP = new Array(512);
	const GF_LOG = new Array(256);
	(function initGF() {
		let x = 1;
		for (let i = 0; i < 255; i++) {
			GF_EXP[i] = x;
			GF_LOG[x] = i;
			x <<= 1;
			if (x & 0x100) x ^= 0x11d;
		}
		for (let i = 255; i < 512; i++) {
			GF_EXP[i] = GF_EXP[i - 255];
		}
	})();

	function gfMul(a, b) {
		if (a === 0 || b === 0) return 0;
		return GF_EXP[GF_LOG[a] + GF_LOG[b]];
	}

	function rsGeneratorPoly(ecCount) {
		let poly = [1];
		for (let i = 0; i < ecCount; i++) {
			const next = new Array(poly.length + 1).fill(0);
			const factor = GF_EXP[i];
			for (let j = 0; j < poly.length; j++) {
				next[j] ^= poly[j];
				next[j + 1] ^= gfMul(poly[j], factor);
			}
			poly = next;
		}
		return poly;
	}

	function rsComputeECC(data, ecCount) {
		const gen = rsGeneratorPoly(ecCount);
		const res = new Array(data.length + ecCount).fill(0);
		for (let i = 0; i < data.length; i++) res[i] = data[i];
		for (let i = 0; i < data.length; i++) {
			const coef = res[i];
			if (coef !== 0) {
				for (let j = 0; j < gen.length; j++) {
					res[i + j] ^= gfMul(gen[j], coef);
				}
			}
		}
		return res.slice(data.length);
	}

	// Tabela ISO 18004 Error Correction Level M (Versions 1..12)
	// [totalDataBytes, ecPerBlock, b1Count, b1Data, b2Count, b2Data, alignmentCenters]
	const QR_VERSIONS_M = {
		1:  [16,  10, 1, 16, 0, 0, []],
		2:  [28,  16, 1, 28, 0, 0, [6, 18]],
		3:  [44,  26, 1, 44, 0, 0, [6, 22]],
		4:  [64,  18, 2, 32, 0, 0, [6, 26]],
		5:  [86,  24, 2, 43, 0, 0, [6, 30]],
		6:  [108, 16, 4, 27, 0, 0, [6, 34]],
		7:  [124, 18, 4, 31, 0, 0, [6, 22, 38]],
		8:  [154, 22, 2, 38, 2, 39, [6, 24, 42]],
		9:  [182, 22, 3, 36, 2, 37, [6, 26, 46]],
		10: [216, 26, 4, 43, 1, 44, [6, 28, 50]],
		11: [254, 30, 1, 50, 4, 51, [6, 30, 54]],
		12: [290, 22, 6, 36, 2, 37, [6, 32, 58]]
	};

	function utf8Bytes(str) {
		if (typeof TextEncoder !== 'undefined') {
			return Array.from(new TextEncoder().encode(str));
		}
		const bytes = [];
		for (let i = 0; i < str.length; i++) {
			const c = str.charCodeAt(i);
			if (c < 0x80) bytes.push(c);
			else if (c < 0x800) {
				bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
			} else {
				bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
			}
		}
		return bytes;
	}

	function escolherVersao(byteLen) {
		for (let v = 1; v <= 12; v++) {
			const headerBits = v <= 9 ? 4 + 8 : 4 + 16;
			const capBits = QR_VERSIONS_M[v][0] * 8;
			if (headerBits + byteLen * 8 <= capBits) {
				return v;
			}
		}
		return 0;
	}

	function construirCodewords(bytes, version) {
		const spec = QR_VERSIONS_M[version];
		const totalDataBytes = spec[0];
		const bits = [];

		const pushBits = (val, len) => {
			for (let i = len - 1; i >= 0; i--) {
				bits.push((val >>> i) & 1);
			}
		};

		// Mode indicator: Byte = 0100
		pushBits(0b0100, 4);
		// Character count indicator
		pushBits(bytes.length, version <= 9 ? 8 : 16);
		// Data bytes
		for (let i = 0; i < bytes.length; i++) {
			pushBits(bytes[i], 8);
		}
		// Terminator (up to 4 zero bits)
		const maxBits = totalDataBytes * 8;
		const termLen = Math.min(4, maxBits - bits.length);
		pushBits(0, termLen);
		// Pad to byte boundary
		while (bits.length % 8 !== 0) bits.push(0);

		const dataCodewords = [];
		for (let i = 0; i < bits.length; i += 8) {
			let b = 0;
			for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
			dataCodewords.push(b);
		}
		const padBytes = [0xec, 0x11];
		let padIdx = 0;
		while (dataCodewords.length < totalDataBytes) {
			dataCodewords.push(padBytes[padIdx % 2]);
			padIdx++;
		}

		// Split into RS blocks & interleave
		const ecPerBlock = spec[1];
		const b1Count = spec[2];
		const b1Data = spec[3];
		const b2Count = spec[4];
		const b2Data = spec[5];

		const dataBlocks = [];
		const ecBlocks = [];
		let offset = 0;

		for (let i = 0; i < b1Count; i++) {
			const blk = dataCodewords.slice(offset, offset + b1Data);
			offset += b1Data;
			dataBlocks.push(blk);
			ecBlocks.push(rsComputeECC(blk, ecPerBlock));
		}
		for (let i = 0; i < b2Count; i++) {
			const blk = dataCodewords.slice(offset, offset + b2Data);
			offset += b2Data;
			dataBlocks.push(blk);
			ecBlocks.push(rsComputeECC(blk, ecPerBlock));
		}

		const finalCodewords = [];
		const maxDataLen = Math.max(b1Data, b2Data);
		for (let col = 0; col < maxDataLen; col++) {
			for (let row = 0; row < dataBlocks.length; row++) {
				if (col < dataBlocks[row].length) finalCodewords.push(dataBlocks[row][col]);
			}
		}
		for (let col = 0; col < ecPerBlock; col++) {
			for (let row = 0; row < ecBlocks.length; row++) {
				finalCodewords.push(ecBlocks[row][col]);
			}
		}

		return finalCodewords;
	}

	function calcFormatInfo(maskId) {
		// Error correction M = 00 -> 5-bit data = (0b00 << 3) | maskId
		const data = maskId & 0x07; // 00 + 3 bits de máscara
		let rem = data << 10;
		const gen = 0b10100110111;
		for (let i = 14; i >= 10; i--) {
			if ((rem >>> i) & 1) rem ^= gen << (i - 10);
		}
		const raw = ((data << 10) | rem) ^ 0b101010000010010;
		return raw;
	}

	function calcVersionInfo(version) {
		let rem = version << 12;
		const gen = 0b1111100100101;
		for (let i = 17; i >= 12; i--) {
			if ((rem >>> i) & 1) rem ^= gen << (i - 12);
		}
		return (version << 12) | rem;
	}

	function criarMatrizBase(version) {
		const size = version * 4 + 17;
		const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
		const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

		const setFixed = (r, c, val) => {
			if (r >= 0 && r < size && c >= 0 && c < size) {
				matrix[r][c] = val ? 1 : 0;
				reserved[r][c] = true;
			}
		};

		const drawFinder = (r0, c0) => {
			for (let dr = -1; dr <= 7; dr++) {
				for (let dc = -1; dc <= 7; dc++) {
					const r = r0 + dr;
					const c = c0 + dc;
					if (r < 0 || r >= size || c < 0 || c >= size) continue;
					const inSep = dr === -1 || dr === 7 || dc === -1 || dc === 7;
					const onOuter = dr === 0 || dr === 6 || dc === 0 || dc === 6;
					const onInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4;
					setFixed(r, c, !inSep && (onOuter || onInner));
				}
			}
		};

		drawFinder(0, 0);
		drawFinder(0, size - 7);
		drawFinder(size - 7, 0);

		// Alignment patterns
		const centers = QR_VERSIONS_M[version][6];
		for (let i = 0; i < centers.length; i++) {
			for (let j = 0; j < centers.length; j++) {
				const r0 = centers[i];
				const c0 = centers[j];
				if (reserved[r0][c0]) continue;
				for (let dr = -2; dr <= 2; dr++) {
					for (let dc = -2; dc <= 2; dc++) {
						const dark = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
						setFixed(r0 + dr, c0 + dc, dark);
					}
				}
			}
		}

		// Timing patterns
		for (let i = 8; i < size - 8; i++) {
			const dark = i % 2 === 0;
			if (!reserved[6][i]) setFixed(6, i, dark);
			if (!reserved[i][6]) setFixed(i, 6, dark);
		}

		// Dark module
		setFixed(4 * version + 9, 8, true);

		// Reserve format info areas
		for (let i = 0; i < 9; i++) {
			if (!reserved[8][i]) reserved[8][i] = true;
			if (!reserved[i][8]) reserved[i][8] = true;
		}
		for (let i = 0; i < 8; i++) {
			if (!reserved[8][size - 1 - i]) reserved[8][size - 1 - i] = true;
			if (i < 7 && !reserved[size - 1 - i][8]) reserved[size - 1 - i][8] = true;
		}

		// Version info (V >= 7)
		if (version >= 7) {
			const vInfo = calcVersionInfo(version);
			for (let i = 0; i < 18; i++) {
				const bit = ((vInfo >>> i) & 1) === 1;
				const a = Math.floor(i / 3);
				const b = size - 11 + (i % 3);
				setFixed(a, b, bit);
				setFixed(b, a, bit);
			}
		}

		return { matrix, reserved, size };
	}

	function preencherDados(matrix, reserved, size, codewords) {
		const bitStream = [];
		for (let i = 0; i < codewords.length; i++) {
			for (let b = 7; b >= 0; b--) {
				bitStream.push((codewords[i] >>> b) & 1);
			}
		}

		let bitIdx = 0;
		let upward = true;
		for (let col = size - 1; col >= 1; col -= 2) {
			if (col === 6) col = 5;
			for (let step = 0; step < size; step++) {
				const row = upward ? size - 1 - step : step;
				for (let cOff = 0; cOff < 2; cOff++) {
					const c = col - cOff;
					if (!reserved[row][c]) {
						matrix[row][c] = bitIdx < bitStream.length ? bitStream[bitIdx++] : 0;
					}
				}
			}
			upward = !upward;
		}
	}

	const MASK_FNS = [
		(r, c) => (r + c) % 2 === 0,
		(r) => r % 2 === 0,
		(_, c) => c % 3 === 0,
		(r, c) => (r + c) % 3 === 0,
		(r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
		(r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
		(r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
		(r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
	];

	function aplicarMascaraEFormato(baseMatrix, reserved, size, maskId) {
		const m = baseMatrix.map((row) => row.slice());
		const maskFn = MASK_FNS[maskId];

		for (let r = 0; r < size; r++) {
			for (let c = 0; c < size; c++) {
				if (!reserved[r][c] && maskFn(r, c)) {
					m[r][c] = m[r][c] ? 0 : 1;
				}
			}
		}

		const fmt = calcFormatInfo(maskId);
		for (let i = 0; i < 15; i++) {
			const bit = (fmt >>> i) & 1;

			// Cópia 1: ao redor do finder superior esquerdo (pula timing patterns na linha/col 6)
			if (i < 6) m[8][i] = bit;
			else if (i === 6) m[8][7] = bit;
			else if (i === 7) m[8][8] = bit;
			else if (i === 8) m[7][8] = bit;
			else m[14 - i][8] = bit;

			// Cópia 2: base esquerda (7 bits abaixo do Dark Module) e topo direito (8 bits)
			if (i < 7) m[size - 1 - i][8] = bit;
			else m[8][size - 15 + i] = bit;
		}

		return m;
	}

	function calcularPenalidade(m) {
		const size = m.length;
		let score = 0;

		// Rule 1: 5+ consecutive same color modules in row/col
		for (let r = 0; r < size; r++) {
			let runLen = 1;
			for (let c = 1; c < size; c++) {
				if (m[r][c] === m[r][c - 1]) {
					runLen++;
				} else {
					if (runLen >= 5) score += 3 + (runLen - 5);
					runLen = 1;
				}
			}
			if (runLen >= 5) score += 3 + (runLen - 5);
		}
		for (let c = 0; c < size; c++) {
			let runLen = 1;
			for (let r = 1; r < size; r++) {
				if (m[r][c] === m[r - 1][c]) {
					runLen++;
				} else {
					if (runLen >= 5) score += 3 + (runLen - 5);
					runLen = 1;
				}
			}
			if (runLen >= 5) score += 3 + (runLen - 5);
		}

		// Rule 2: 2x2 blocks
		for (let r = 0; r < size - 1; r++) {
			for (let c = 0; c < size - 1; c++) {
				const v = m[r][c];
				if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) {
					score += 3;
				}
			}
		}

		// Rule 3: finder-like patterns 10111010000 or 00001011101
		const matchPattern = (arr) => {
			let hits = 0;
			for (let i = 0; i <= arr.length - 11; i++) {
				const p1 = arr[i] === 1 && arr[i + 1] === 0 && arr[i + 2] === 1 && arr[i + 3] === 1 && arr[i + 4] === 1 && arr[i + 5] === 0 && arr[i + 6] === 1 && arr[i + 7] === 0 && arr[i + 8] === 0 && arr[i + 9] === 0 && arr[i + 10] === 0;
				const p2 = arr[i] === 0 && arr[i + 1] === 0 && arr[i + 2] === 0 && arr[i + 3] === 0 && arr[i + 4] === 1 && arr[i + 5] === 0 && arr[i + 6] === 1 && arr[i + 7] === 1 && arr[i + 8] === 1 && arr[i + 9] === 0 && arr[i + 10] === 1;
				if (p1 || p2) hits++;
			}
			return hits * 40;
		};
		for (let r = 0; r < size; r++) score += matchPattern(m[r]);
		for (let c = 0; c < size; c++) {
			const colArr = [];
			for (let r = 0; r < size; r++) colArr.push(m[r][c]);
			score += matchPattern(colArr);
		}

		// Rule 4: dark ratio
		let dark = 0;
		for (let r = 0; r < size; r++) {
			for (let c = 0; c < size; c++) {
				if (m[r][c] === 1) dark++;
			}
		}
		const pct = (dark * 100) / (size * size);
		const prev5 = Math.floor(pct / 5) * 5;
		const next5 = Math.ceil(pct / 5) * 5;
		score += Math.min(Math.abs(prev5 - 50) / 5, Math.abs(next5 - 50) / 5) * 10;

		return score;
	}

	function gerarMatrizQR(texto) {
		const bytes = utf8Bytes(texto);
		const version = escolherVersao(bytes.length);
		if (!version) {
			return null;
		}
		const codewords = construirCodewords(bytes, version);
		const { matrix, reserved, size } = criarMatrizBase(version);
		preencherDados(matrix, reserved, size, codewords);

		let melhorMatriz = null;
		let menorPenalidade = Infinity;
		for (let mask = 0; mask < 8; mask++) {
			const candidate = aplicarMascaraEFormato(matrix, reserved, size, mask);
			const pen = calcularPenalidade(candidate);
			if (pen < menorPenalidade) {
				menorPenalidade = pen;
				melhorMatriz = candidate;
			}
		}

		return {
			version,
			size,
			modules: melhorMatriz
		};
	}

	function gerarSVG(texto, opcoes = {}) {
		const qr = gerarMatrizQR(texto);
		if (!qr) return '';

		const margin = opcoes.margin !== undefined ? opcoes.margin : 2;
		const sizePx = opcoes.size || 168;
		const darkColor = opcoes.darkColor || '#0f172a';
		const lightColor = opcoes.lightColor || '#ffffff';
		const total = qr.size + margin * 2;

		let pathD = '';
		for (let r = 0; r < qr.size; r++) {
			for (let c = 0; c < qr.size; c++) {
				if (qr.modules[r][c] === 1) {
					pathD += `M${c + margin},${r + margin}h1v1h-1z`;
				}
			}
		}

		return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges" role="img" aria-label="QR Code PIX"><rect width="${total}" height="${total}" fill="${lightColor}"/><path d="${pathD}" fill="${darkColor}"/></svg>`;
	}

	function desenharNoCanvas(ctx, texto, x, y, tamanhoPx = 140) {
		const qr = gerarMatrizQR(texto);
		if (!qr || !ctx) return false;

		const margin = 2;
		const totalModules = qr.size + margin * 2;
		const cell = tamanhoPx / totalModules;

		ctx.save();
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(x, y, tamanhoPx, tamanhoPx);

		ctx.fillStyle = '#0f172a';
		for (let r = 0; r < qr.size; r++) {
			for (let c = 0; c < qr.size; c++) {
				if (qr.modules[r][c] === 1) {
					const rx = Math.floor(x + (c + margin) * cell);
					const ry = Math.floor(y + (r + margin) * cell);
					const rw = Math.ceil((c + margin + 1) * cell) - Math.floor((c + margin) * cell);
					const rh = Math.ceil((r + margin + 1) * cell) - Math.floor((r + margin) * cell);
					ctx.fillRect(rx, ry, Math.max(1, rw), Math.max(1, rh));
				}
			}
		}
		ctx.restore();
		return true;
	}

	// ----------------------------------------------------------------------
	// 3. Integração com Configuração Ativa da Empresa
	// ----------------------------------------------------------------------
	function getConfigPixEmpresa() {
		let cfg = {};
		try {
			if (global.BrandService && typeof global.BrandService.getConfig === 'function') {
				cfg = global.BrandService.getConfig() || {};
			} else {
				cfg = JSON.parse(localStorage.getItem('config_negocio')) || {};
			}
		} catch (e) {
			cfg = {};
		}

		let cidadeFallback = 'BRASIL';
		if (cfg.cidadePix && String(cfg.cidadePix).trim()) {
			cidadeFallback = String(cfg.cidadePix).trim();
		} else if (cfg.endereco && String(cfg.endereco).includes(',')) {
			const partes = String(cfg.endereco).split(',');
			const ultima = partes[partes.length - 1].replace(/\s*-\s*[A-Za-z]{2}\s*$/, '').trim();
			if (ultima) cidadeFallback = ultima;
		}

		return {
			chavePix: (cfg.chavePix || cfg.pix || '').trim(),
			nomeRecebedor: (cfg.nomeEstabelecimento || cfg.razaoSocial || 'ESTABELECIMENTO').trim(),
			cidade: cidadeFallback
		};
	}

	function gerarCobrancaPixOS(pedidoOuValor, valorOverride) {
		const emp = getConfigPixEmpresa();
		if (!emp.chavePix) {
			return { valido: false, erro: 'Chave PIX não configurada em Ajustes > Meu Negócio.', payload: '' };
		}

		let valor = 0;
		let osId = '';
		if (typeof pedidoOuValor === 'object' && pedidoOuValor !== null) {
			valor = valorOverride !== undefined ? parseFloat(valorOverride) : parseFloat(pedidoOuValor.valor || 0);
			osId = (pedidoOuValor.id || pedidoOuValor.numeroOS || '').toString().replace(/^os_/, '');
		} else {
			valor = parseFloat(valorOverride !== undefined ? valorOverride : pedidoOuValor) || 0;
		}

		return gerarPayloadPix({
			chavePix: emp.chavePix,
			nomeRecebedor: emp.nomeRecebedor,
			cidade: emp.cidade,
			valor: valor,
			txid: osId ? `OS${osId.slice(-10)}` : 'PAGAMENTO'
		});
	}

	function quebrarTextoCanvas(ctx, texto, maxWidth, maxLinhas) {
		const palavras = String(texto || '').split(/\s+/).filter(Boolean);
		if (palavras.length === 0) return [];
		const linhas = [];
		let atual = '';

		for (let i = 0; i < palavras.length; i++) {
			const teste = atual ? `${atual} ${palavras[i]}` : palavras[i];
			if (ctx.measureText(teste).width <= maxWidth) {
				atual = teste;
			} else {
				if (atual) linhas.push(atual);
				atual = palavras[i];
				if (maxLinhas && linhas.length >= maxLinhas - 1) {
					break;
				}
			}
		}
		if (atual && (!maxLinhas || linhas.length < maxLinhas)) {
			linhas.push(atual);
		}
		return linhas;
	}

	function roundRectPath(ctx, x, y, w, h, r) {
		ctx.beginPath();
		ctx.moveTo(x + r, y);
		ctx.lineTo(x + w - r, y);
		ctx.quadraticCurveTo(x + w, y, x + w, y + r);
		ctx.lineTo(x + w, y + h - r);
		ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
		ctx.lineTo(x + r, y + h);
		ctx.quadraticCurveTo(x, y + h, x, y + h - r);
		ctx.lineTo(x, y + r);
		ctx.quadraticCurveTo(x, y, x + r, y);
		ctx.closePath();
	}

	function getNomeArquivoCartaoPix(pedidoOuDados = {}) {
		const numOS = (pedidoOuDados.id || pedidoOuDados.numeroOS || '').toString().replace(/^os_/, '').slice(-6);
		const placa = (pedidoOuDados.placa || '').toString().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
		const sufixo = [numOS ? `OS_${numOS}` : '', placa].filter(Boolean).join('_') || 'Pagamento';
		return `QR_PIX_${sufixo}.png`;
	}

	function gerarImagemCartaoPixAsync(pedidoOuDados = {}, opcoes = {}) {
		return new Promise((resolve, reject) => {
			try {
				if (typeof document === 'undefined') {
					reject(new Error('Geração de imagem requer ambiente de navegador.'));
					return;
				}

				const valorOverride = opcoes.valor !== undefined ? opcoes.valor : undefined;
				const resPix = gerarCobrancaPixOS(pedidoOuDados, valorOverride);
				if (!resPix.valido) {
					reject(new Error(resPix.erro || 'Chave PIX não configurada.'));
					return;
				}

				const valorNum = resPix.valor || parseFloat(opcoes.valor || pedidoOuDados.valor || 0) || 0;
				const largura = 540;
				const altura = 700;
				const canvas = document.createElement('canvas');
				canvas.width = largura;
				canvas.height = altura;
				const ctx = canvas.getContext('2d');
				if (!ctx) {
					reject(new Error('Contexto Canvas 2D indisponível.'));
					return;
				}

				// Fundo geral limpo
				ctx.fillStyle = '#f8fafc';
				ctx.fillRect(0, 0, largura, altura);

				// Cartão principal branco com borda sutil
				ctx.fillStyle = '#ffffff';
				roundRectPath(ctx, 20, 20, largura - 40, altura - 40, 20);
				ctx.fill();
				ctx.lineWidth = 2;
				ctx.strokeStyle = '#e2e8f0';
				ctx.stroke();

				// Cabeçalho escuro estilo PIX
				ctx.save();
				roundRectPath(ctx, 20, 20, largura - 40, 108, 20);
				ctx.clip();
				ctx.fillStyle = '#0f172a';
				ctx.fillRect(20, 20, largura - 40, 108);
				ctx.fillStyle = '#14b8a6';
				ctx.fillRect(20, 122, largura - 40, 6);
				ctx.restore();

				ctx.textAlign = 'center';
				ctx.fillStyle = '#5eead4';
				ctx.font = 'bold 13px sans-serif';
				ctx.fillText('PAGAMENTO VIA PIX', largura / 2, 52);

				ctx.fillStyle = '#ffffff';
				ctx.font = 'bold 22px sans-serif';
				const nomeEmpresa = (resPix.nomeRecebedor || 'ESTABELECIMENTO').slice(0, 28);
				ctx.fillText(nomeEmpresa, largura / 2, 84);

				const numOS = (pedidoOuDados.id || pedidoOuDados.numeroOS || '').toString().replace(/^os_/, '').slice(-6);
				const subtitulo = numOS ? `Ordem de Serviço #${numOS}` : 'Cobrança Instantânea PIX';
				ctx.fillStyle = '#cbd5e1';
				ctx.font = '14px sans-serif';
				ctx.fillText(subtitulo, largura / 2, 108);

				// Dados do cliente / serviço
				let cursorY = 160;
				const clienteNome = pedidoOuDados.clienteNome || pedidoOuDados.cliente || '';
				const veiculo = [pedidoOuDados.modelo || pedidoOuDados.veiculo || '', pedidoOuDados.placa || ''].filter(Boolean).join(' • ');
				const servicosTxt = pedidoOuDados.servicos || pedidoOuDados.itemDescricao || '';

				if (clienteNome) {
					ctx.fillStyle = '#334155';
					ctx.font = 'bold 16px sans-serif';
					ctx.fillText(String(clienteNome).slice(0, 38), largura / 2, cursorY);
					cursorY += 22;
				}
				if (veiculo) {
					ctx.fillStyle = '#64748b';
					ctx.font = '14px sans-serif';
					ctx.fillText(veiculo.slice(0, 42), largura / 2, cursorY);
					cursorY += 20;
				}
				if (servicosTxt) {
					ctx.fillStyle = '#475569';
					ctx.font = '13px sans-serif';
					const linhasSvc = quebrarTextoCanvas(ctx, servicosTxt, 430, 2);
					linhasSvc.forEach((l) => {
						ctx.fillText(l, largura / 2, cursorY);
						cursorY += 18;
					});
				}

				// Caixa de valor em destaque
				const valorY = Math.max(230, cursorY + 6);
				ctx.fillStyle = '#ecfdf5';
				roundRectPath(ctx, 70, valorY, largura - 140, 62, 12);
				ctx.fill();
				ctx.lineWidth = 1.5;
				ctx.strokeStyle = '#6ee7b7';
				ctx.stroke();

				ctx.fillStyle = '#047857';
				ctx.font = 'bold 12px sans-serif';
				ctx.fillText(valorNum > 0 ? 'VALOR DO SERVIÇO' : 'VALOR EM ABERTO NO APP DO BANCO', largura / 2, valorY + 21);

				ctx.fillStyle = '#065f46';
				ctx.font = 'bold 26px sans-serif';
				const valorFormatado = valorNum > 0
					? `R$ ${valorNum.toFixed(2).replace('.', ',')}`
					: 'Informar no banco';
				ctx.fillText(valorFormatado, largura / 2, valorY + 49);

				// Moldura do QR Code PIX
				const qrSize = 248;
				const qrBoxPad = 14;
				const qrBoxSize = qrSize + qrBoxPad * 2;
				const qrBoxX = (largura - qrBoxSize) / 2;
				const qrBoxY = valorY + 78;

				ctx.fillStyle = '#ffffff';
				roundRectPath(ctx, qrBoxX, qrBoxY, qrBoxSize, qrBoxSize, 14);
				ctx.fill();
				ctx.lineWidth = 2;
				ctx.strokeStyle = '#cbd5e1';
				ctx.stroke();

				const ok = desenharNoCanvas(ctx, resPix.payload, qrBoxX + qrBoxPad, qrBoxY + qrBoxPad, qrSize);
				if (!ok) {
					reject(new Error('Não foi possível desenhar o QR Code PIX.'));
					return;
				}

				// Rodapé com instruções e chave
				const footerY = qrBoxY + qrBoxSize + 30;
				ctx.fillStyle = '#0f172a';
				ctx.font = 'bold 14px sans-serif';
				ctx.fillText('Aponte a câmera do app do seu banco para pagar', largura / 2, footerY);

				ctx.fillStyle = '#64748b';
				ctx.font = '13px monospace';
				ctx.fillText(`Chave PIX: ${resPix.chaveNormalizada}`, largura / 2, footerY + 24);

				canvas.toBlob((blob) => {
					if (blob) {
						resolve(blob);
					} else {
						reject(new Error('Falha ao gerar imagem PNG do QR Code PIX.'));
					}
				}, 'image/png');
			} catch (err) {
				reject(err);
			}
		});
	}

	async function baixarCartaoPix(pedidoOuDados = {}, opcoes = {}) {
		const blob = await gerarImagemCartaoPixAsync(pedidoOuDados, opcoes);
		const nomeArquivo = getNomeArquivoCartaoPix(pedidoOuDados);
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = nomeArquivo;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		setTimeout(() => URL.revokeObjectURL(url), 1000);
		return { sucesso: true, nomeArquivo };
	}

	async function copiarCartaoPixClipboard(pedidoOuDados = {}, opcoes = {}) {
		const blob = await gerarImagemCartaoPixAsync(pedidoOuDados, opcoes);
		if (
			typeof navigator !== 'undefined' &&
			navigator.clipboard &&
			typeof navigator.clipboard.write === 'function' &&
			typeof ClipboardItem !== 'undefined'
		) {
			await navigator.clipboard.write([
				new ClipboardItem({ 'image/png': blob })
			]);
			return { sucesso: true, blob };
		}
		return { sucesso: false, motivo: 'clipboard_image_unsupported', blob };
	}

	async function compartilharCartaoPix(pedidoOuDados = {}, opcoes = {}) {
		const blob = await gerarImagemCartaoPixAsync(pedidoOuDados, opcoes);
		const nomeArquivo = getNomeArquivoCartaoPix(pedidoOuDados);
		if (typeof File !== 'undefined' && typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
			const file = new File([blob], nomeArquivo, { type: 'image/png' });
			const canShareFiles = typeof navigator.canShare === 'function' ? navigator.canShare({ files: [file] }) : true;
			if (canShareFiles) {
				await navigator.share({
					files: [file],
					title: opcoes.title || 'QR Code PIX para Pagamento',
					text: opcoes.text || ''
				});
				return { sucesso: true, metodo: 'web_share' };
			}
		}
		return { sucesso: false, motivo: 'web_share_unsupported', blob, nomeArquivo };
	}

	const PixService = {
		normalizarChavePix,
		calcularCRC16,
		gerarPayloadPix,
		gerarCobrancaPixOS,
		getConfigPixEmpresa,
		gerarMatrizQR,
		gerarSVG,
		desenharNoCanvas,
		getNomeArquivoCartaoPix,
		gerarImagemCartaoPixAsync,
		baixarCartaoPix,
		copiarCartaoPixClipboard,
		compartilharCartaoPix
	};

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = PixService;
	}
	if (typeof global !== 'undefined') {
		global.PixService = PixService;
	}
})(typeof window !== 'undefined' ? window : globalThis);
