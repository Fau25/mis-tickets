/* Mis Tickets · resguardo en imagen, texto de reclamación y copia ZIP */
(function (g) {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const fLarga = s => { if (!s) return ''; const [a, m, d] = s.split('-').map(Number); return d + ' de ' + MESES[m - 1] + ' de ' + a; };
  const eur = n => n == null || isNaN(n) ? '' : new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);

  /* ---------- Resguardo: imagen para enseñar en caja ---------- */
  function lineas(x, texto, ancho, max) {
    const pal = String(texto || '').split(/\s+/), out = []; let l = '';
    for (const p of pal) {
      const prueba = l ? l + ' ' + p : p;
      if (x.measureText(prueba).width > ancho && l) { out.push(l); l = p; } else l = prueba;
      if (out.length === max) break;
    }
    if (out.length < max && l) out.push(l);
    if (out.length === max && pal.join(' ').length > out.join(' ').length) out[max - 1] = out[max - 1].replace(/\s*\S*$/, '') + '…';
    return out;
  }
  function redondo(x, X, Y, W, H, r, color) {
    x.fillStyle = color; x.beginPath();
    if (x.roundRect) x.roundRect(X, Y, W, H, r);
    else { x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r); x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath(); }   // iOS 15
    x.fill();
  }

  async function resguardo(t, titulo) {
    try { await Promise.all(['800 64px Manrope, system-ui, -apple-system, sans-serif', '600 30px Manrope, system-ui, -apple-system, sans-serif', '500 30px "JetBrains Mono"'].map(f => document.fonts.load(f))); } catch (e) {}
    const W = 1080, P = 64, c = document.createElement('canvas'), x = c.getContext('2d');
    const filas = [['Identificador', t.ident], ['Nº ticket', t.num], [t.ident ? '' : 'NIF tienda', t.ident ? '' : t.nif]].filter(f => f[1]);
    const plazos = [t.devHasta && ['Devolver hasta', fLarga(t.devHasta)], t.garHasta && ['Garantía hasta', fLarga(t.garHasta)]].filter(Boolean);
    const mods = t.barras && g.codigoBarras ? g.codigoBarras.modulos(t.barras) : null;
    x.font = '800 66px Manrope, system-ui, -apple-system, sans-serif';
    const tl = lineas(x, titulo, W - 2 * P - 2 * 56, 3);
    const altoBlanco = 56 + 40 + 24 + tl.length * 78 + 16 + 44 + 40 + plazos.length * 92 + 40;
    const altoNegro = 56 + 90 + 36 + filas.length * 88 + (mods ? 300 : 0) + 56;
    const H = P + 60 + altoBlanco + 28 + altoNegro + 90 + P;
    c.width = W; c.height = H;
    x.fillStyle = '#ECECE9'; x.fillRect(0, 0, W, H);
    let y = P;
    x.fillStyle = '#6A6A65'; x.font = '500 26px "JetBrains Mono", monospace'; x.fillText('MIS TICKETS · RESGUARDO DE COMPRA', P + 8, y + 30);
    y += 60;
    // Billete blanco
    redondo(x, P, y, W - 2 * P, altoBlanco, 48, '#FFFFFF');
    let yy = y + 56 + 30;
    x.fillStyle = '#6A6A65'; x.font = '600 30px Manrope, system-ui, -apple-system, sans-serif'; x.fillText(fLarga(t.fecha), P + 56, yy);
    yy += 24;
    x.fillStyle = '#1E1E1C'; x.font = '800 66px Manrope, system-ui, -apple-system, sans-serif';
    for (const l of tl) { yy += 78; x.fillText(l, P + 56, yy); }
    yy += 16 + 34;
    x.fillStyle = '#6A6A65'; x.font = '700 32px Manrope, system-ui, -apple-system, sans-serif'; x.fillText(t.tienda || '', P + 56, yy);
    yy += 40;
    for (const [k, v] of plazos) {
      x.strokeStyle = '#E2E2DE'; x.lineWidth = 2; x.beginPath(); x.moveTo(P + 56, yy + 20); x.lineTo(W - P - 56, yy + 20); x.stroke();
      x.fillStyle = '#6A6A65'; x.font = '600 28px Manrope, system-ui, -apple-system, sans-serif'; x.fillText(k, P + 56, yy + 66);
      x.fillStyle = '#1E1E1C'; x.font = '800 34px Manrope, system-ui, -apple-system, sans-serif'; x.textAlign = 'right'; x.fillText(v, W - P - 56, yy + 68); x.textAlign = 'left';
      yy += 92;
    }
    y += altoBlanco + 28;
    // Tarjeta oscura
    redondo(x, P, y, W - 2 * P, altoNegro, 48, '#1E1E1C');
    yy = y + 56;
    x.fillStyle = '#A9A9A3'; x.font = '600 30px Manrope, system-ui, -apple-system, sans-serif'; x.fillText('Total pagado', P + 56, yy + 58);
    x.fillStyle = '#F4F4F1'; x.font = '800 76px Manrope, system-ui, -apple-system, sans-serif'; x.textAlign = 'right'; x.fillText(eur(t.total) || '—', W - P - 56, yy + 66); x.textAlign = 'left';
    yy += 90 + 36;
    for (const [k, v] of filas) {
      x.strokeStyle = '#363633'; x.lineWidth = 2; x.beginPath(); x.moveTo(P + 56, yy); x.lineTo(W - P - 56, yy); x.stroke();
      x.fillStyle = '#A9A9A3'; x.font = '600 28px Manrope, system-ui, -apple-system, sans-serif'; x.fillText(k, P + 56, yy + 54);
      x.fillStyle = '#F4F4F1'; x.font = '500 30px "JetBrains Mono", monospace'; x.textAlign = 'right'; x.fillText(String(v), W - P - 56, yy + 54); x.textAlign = 'left';
      yy += 88;
    }
    if (mods) {
      const bx = P + 56, bw = W - 2 * P - 112, by = yy + 8;
      redondo(x, bx, by, bw, 260, 32, '#FFFFFF');
      const mod = Math.max(2, Math.floor((bw - 80) / mods.length)), ancho = mod * mods.length, x0 = bx + (bw - ancho) / 2;
      x.fillStyle = '#111111';
      for (let i = 0; i < mods.length; i++) if (mods[i] === '1') x.fillRect(x0 + i * mod, by + 32, mod, 150);
      x.font = '500 28px "JetBrains Mono", monospace'; x.textAlign = 'center'; x.fillText(t.barras.split('').join(''), bx + bw / 2, by + 226); x.textAlign = 'left';
    }
    x.fillStyle = '#6A6A65'; x.font = '500 24px Manrope, system-ui, -apple-system, sans-serif'; x.textAlign = 'center';
    x.fillText('Guarda también la foto del ticket original', W / 2, H - P - 10); x.textAlign = 'left';
    return await new Promise(ok => c.toBlob(ok, 'image/jpeg', .92));
  }

  /* ---------- Texto de reclamación ---------- */
  function reclamacion(t, titulo, tipo, problema) {
    const compra = `El ${fLarga(t.fecha)} compré ${titulo}${t.tienda ? ' en ' + t.tienda : ''}${t.total != null ? ' por ' + eur(t.total) : ''}` +
      `${t.num ? ' (ticket o factura nº ' + t.num + ')' : ''}.`;
    const motivo = (problema || '').trim() ? '\n\n' + problema.trim() : '';
    const pide = tipo === 'dev'
      ? `Me gustaría devolver el producto dentro del plazo de devolución${t.devHasta ? ', que termina el ' + fLarga(t.devHasta) : ''}, y que me reembolséis el importe.`
      : `El producto está dentro del periodo de garantía${t.garHasta ? ' (hasta el ' + fLarga(t.garHasta) + ')' : ''}, así que solicito su reparación o sustitución sin coste, conforme a la garantía legal de la Ley General para la Defensa de los Consumidores y Usuarios.`;
    return `Hola:\n\n${compra}${motivo}\n\n${pide}\n\nAdjunto el ticket de compra${t.ident ? ' (identificador ' + t.ident + ')' : ''}.\n\nQuedo a la espera de vuestra respuesta. Gracias.\n\nUn saludo.`;
  }

  /* ---------- ZIP sin compresión (fotos ya comprimidas) ---------- */
  const TABLA = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(d) { let c = 0xFFFFFFFF; for (let i = 0; i < d.length; i++) c = TABLA[(c ^ d[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(archivos) {   // [{nombre, datos: Uint8Array}] → Blob
    const enc = new TextEncoder(), partes = [], central = []; let pos = 0;
    const ahora = new Date(), hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
    const dia = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
    for (const a of archivos) {
      const nom = enc.encode(a.nombre), crc = crc32(a.datos), n = a.datos.length;
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, hora, true); h.setUint16(12, dia, true); h.setUint32(14, crc, true); h.setUint32(18, n, true); h.setUint32(22, n, true);
      h.setUint16(26, nom.length, true); h.setUint16(28, 0, true);
      partes.push(h.buffer, nom, a.datos);
      const cd = new DataView(new ArrayBuffer(46));
      cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true); cd.setUint16(10, 0, true);
      cd.setUint16(12, hora, true); cd.setUint16(14, dia, true); cd.setUint32(16, crc, true); cd.setUint32(20, n, true); cd.setUint32(24, n, true);
      cd.setUint16(28, nom.length, true); cd.setUint32(42, pos, true);
      central.push(cd.buffer, nom);
      pos += 30 + nom.length + n;
    }
    const tamCentral = central.reduce((s, b) => s + (b.byteLength || b.length), 0);
    const fin = new DataView(new ArrayBuffer(22));
    fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, archivos.length, true); fin.setUint16(10, archivos.length, true);
    fin.setUint32(12, tamCentral, true); fin.setUint32(16, pos, true);
    return new Blob([...partes, ...central, fin.buffer], { type: 'application/zip' });
  }

  g.extras = { resguardo, reclamacion, zip, fLarga };
  if (typeof module !== 'undefined') module.exports = { reclamacion, zip, crc32 };
})(typeof window !== 'undefined' ? window : globalThis);
