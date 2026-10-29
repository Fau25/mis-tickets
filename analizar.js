/* Mis Tickets · saca los datos importantes del texto leído de un ticket */
(function (g) {
  const TIENDAS = ['Mercadona', 'Carrefour', 'Lidl', 'Aldi', 'Dia', 'Alcampo', 'Eroski', 'Hipercor', 'Consum', 'Ahorramas',
    'El Corte Inglés', 'MediaMarkt', 'Media Markt', 'Worten', 'Fnac', 'PcComponentes', 'Apple', 'Amazon', 'IKEA', 'Leroy Merlin',
    'Bricomart', 'Bricodepot', 'Brico Depot', 'Decathlon', 'Sprinter', 'JD Sports', 'Foot Locker', 'Zara', 'Pull&Bear', 'Bershka',
    'Stradivarius', 'Massimo Dutti', 'Oysho', 'Mango', 'Primark', 'H&M', 'Kiabi', 'Lefties', 'Druni', 'Primor', 'Sephora',
    'Douglas', 'Normal', 'Action', 'Tiger', 'Juguettos', 'Toys R Us', 'Game', 'Xiaomi', 'Samsung', 'Conforama', 'Maisons du Monde',
    'Kave Home', 'Tiendanimal', 'Kiwoko', 'Zooplus', 'Norauto', 'Feu Vert', 'Euronics', 'Milar', 'Expert', 'Tien21', 'Phone House',
    'Vodafone', 'Movistar', 'Orange', 'Cortefiel', 'Springfield', 'Women\'secret', 'Tezenis', 'Calzedonia', 'Intimissimi', 'Nike',
    'Adidas', 'Uniqlo', 'Lush', 'Rituals', 'Costco', 'Makro', 'BM', 'Masymas', 'Gadis', 'Froiz', 'Covirán', 'Spar', 'Supercor'];
  const SUPER = ['mercadona', 'carrefour', 'lidl', 'aldi', 'dia', 'alcampo', 'eroski', 'hipercor', 'consum', 'ahorramas', 'costco',
    'makro', 'bm', 'masymas', 'gadis', 'froiz', 'coviran', 'spar', 'supercor'];
  const MESES = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };

  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const RE_MONTO = /(?:^|[^\d,.])(-?\d{1,3}(?:\.\d{3})+,\d{2}|-?\d+[.,]\d{2})(?![\d%]|[.\/]\d)/g;

  function montos(linea) {
    const out = []; let m; RE_MONTO.lastIndex = 0;
    while ((m = RE_MONTO.exec(linea))) {
      let s = m[1].replace(/\s/g, '');
      s = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
      const n = parseFloat(s); if (!isNaN(n)) out.push(n);
    }
    return out;
  }
  const iso = (a, m, d) => a + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  function fechaValida(a, m, d, hoy) {
    if (a < 100) a += 2000;
    if (m < 1 || m > 12 || d < 1 || d > 31 || a < 2000) return null;
    const dt = new Date(a, m - 1, d); if (dt.getMonth() !== m - 1) return null;
    const f = iso(a, m, d); return f <= hoy ? f : null;
  }

  function analizar(texto, hoy) {
    hoy = hoy || new Date().toISOString().slice(0, 10);
    const r = { tienda: '', fecha: '', total: null, num: '', nif: '', productos: [], esSuper: false };
    if (!texto) return r;
    const lineas = texto.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
    const plano = norm(texto);

    // Tienda: una conocida o la primera línea con pinta de nombre
    let mejor = null;
    for (const t of TIENDAS) {
      const n = norm(t).replace(/[&'.]/g, m => '\\' + m);
      const re = new RegExp('(^|[^a-z])' + n.replace(/ /g, '\\s?') + '([^a-z]|$)');
      const i = plano.search(re);
      if (i >= 0 && (mejor === null || i < mejor.i || (i === mejor.i && t.length > mejor.t.length))) mejor = { t, i };
    }
    if (mejor) r.tienda = mejor.t === 'Media Markt' ? 'MediaMarkt' : mejor.t === 'Brico Depot' ? 'Bricodepot' : mejor.t;
    else {
      const NO = /(factura|ticket|simplificad|c\.?i\.?f|n\.?i\.?f|tel[eé.f]|www|http|@|calle|c\/|avda|avenida|plaza|s\.?l\.?u?$|bienvenid|gracias|fecha|hora)/i;
      for (const l of lineas.slice(0, 6)) {
        const letras = (l.match(/[a-záéíóúñü]/gi) || []).length;
        if (letras >= 3 && letras / l.length > 0.5 && !NO.test(l) && l.length <= 40) {
          r.tienda = l === l.toUpperCase() ? l.toLowerCase().replace(/(^|[\s\-&])\S/g, c => c.toUpperCase()) : l;
          break;
        }
      }
    }
    r.esSuper = SUPER.includes(norm(r.tienda));

    // Fecha
    for (const l of lineas) {
      let m = l.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4}|\d{2})\b/);
      let f = m && fechaValida(+m[3], +m[2], +m[1], hoy);
      if (!f) { m = l.match(/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/); f = m && fechaValida(+m[1], +m[2], +m[3], hoy); }
      if (!f) {
        m = norm(l).match(/\b(\d{1,2})[\s\-\/.]*(?:de\s+)?(ene|feb|mar|abr|may|jun|jul|ago|sep|set|oct|nov|dic)[a-z]*\.?[\s\-\/.]*(?:de\s+)?(\d{4}|\d{2})\b/);
        f = m && fechaValida(+m[3], MESES[m[2]], +m[1], hoy);
      }
      if (f) { r.fecha = f; break; }
    }

    // Total
    const EXCL_T = /(sub\s?total|base|iva|impuesto|descuento|ahorr|art[ií]culos|unidades|uds|entregado|cambio|puntos)/i;
    const cand = [];
    lineas.forEach((l, i) => {
      if (!/(total|importe|a pagar|pagar)/i.test(l) || EXCL_T.test(l)) return;
      let ms = montos(l);
      if (!ms.length && lineas[i + 1]) ms = montos(lineas[i + 1]);
      if (ms.length) cand.push(ms[ms.length - 1]);
    });
    if (cand.length) r.total = Math.max(...cand);
    else {
      const todos = lineas.filter(l => !/(%|iva|cambio|entregado|base|cuota)/i.test(l)).flatMap(montos).filter(n => n > 0 && n < 100000);
      const veces = {}; todos.forEach(n => veces[n] = (veces[n] || 0) + 1);
      const rep = Object.keys(veces).map(Number).filter(n => veces[n] >= 2).sort((a, b) => veces[b] - veces[a] || b - a);
      if (rep.length) r.total = rep[0];
      else if (todos.length) r.total = Math.max(...todos);
    }

    // Nº de ticket o factura
    const RES_N = [/(?:^|[^a-z])(?:factura(?:\s+simplificada)?|ticket|fra\.?)\s*(?:n[ºo°.]*)?\s*[:#]?\s*([A-Z0-9](?:[A-Z0-9\-\/]| (?=\d)){3,})/i,
      /(?:^|[^a-z])(?:n[ºo°]\.?\s*(?:de\s+)?(?:operaci[oó]n|documento|doc\.?)?|doc\.?)\s*[:#]?\s*([A-Z0-9](?:[A-Z0-9\-\/]| (?=\d)){3,})/i];
    const RE_COD = /^(?:(FS|FT|FRA|FAC|FV|TK|T)\.?\s*)?[:#nº°]*\s*([A-Z0-9][A-Z0-9\-\/]{5,})$/i;
    for (let i = 0; i < lineas.length && !r.num; i++) {
      const l = lineas[i];
      const m1 = l.match(/^(FS|FT|FRA|FAC)\.?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/]{5,})$/i);
      if (m1 && /\d/.test(m1[2])) r.num = (m1[1] + ' ' + m1[2]).toUpperCase();
      else if (/factura(\s+simplificada)?\s*:?\s*$/i.test(l) && lineas[i + 1]) {
        const m2 = lineas[i + 1].match(RE_COD);
        if (m2 && /\d/.test(m2[2]) && !montos(lineas[i + 1]).length) r.num = ((m2[1] ? m2[1] + ' ' : '') + m2[2]).toUpperCase();
      }
    }
    for (const re of r.num ? [] : RES_N) {
      for (const l of lineas) { const mn = l.match(re); if (mn && /\d/.test(mn[1])) { r.num = mn[1].trim().toUpperCase(); break; } }
      if (r.num) break;
    }

    // NIF/CIF de la tienda
    const mf = texto.toUpperCase().match(/\b([ABCDEFGHJNPQRSUVW])[\s\-.]?(\d{7})([0-9A-J])\b/);
    if (mf) r.nif = mf[1] + mf[2] + mf[3];

    // Productos: líneas con importe que no son totales, pagos ni impuestos
    const EXCL_P = /(total|iva|base|cambio|entregado|efectivo|tarj|visa|master\s?card|debit|cr[eé]dit|importe|pago|pagar|abonar|descuento|ahorr|redondeo|cuota|%|fecha|hora|tel[eé.f]|n\.?i\.?f|c\.?i\.?f|factura|ticket|bizum|devoluci|neto|mercanc|cheque|regalo|acumul|puntos|saldo|balance|vale|cup[oó]n|bancaria|autori|operaci)/i;
    const soloTexto = l => !montos(l).length && (l.match(/[a-záéíóúñü]/gi) || []).length >= 3 && !EXCL_P.test(l) && !/^\W*$/.test(l);
    for (const [i, l] of lineas.entries()) {
      if (!montos(l).length || EXCL_P.test(l)) continue;
      const restoL = l.replace(RE_MONTO, ' ').replace(/€|eur\b|\b[a-d]\b/gi, ' ').replace(/\d+/g, ' ').trim();
      if (/^\d{4,}\b/.test(l) && !/[a-záéíóúñü]{3}/i.test(restoL)) {           // «1488467  9,99 b» → nombre debajo (marca + descripción)
        const sig = lineas.slice(i + 1, i + 3).filter(soloTexto);
        if (sig.length && soloTexto(lineas[i + 1] || '')) {
          let n = sig.join(' ').replace(/\s*\+\s*$/, '').replace(/\s+/g, ' ').trim();
          if (n === n.toUpperCase()) n = n.charAt(0) + n.slice(1).toLowerCase();
          r.productos.push(n); continue;
        }
      }
      let nombre = l.replace(/\d+([.,]\d+)?\s*kg\b/gi, ' ').replace(RE_MONTO, ' ').replace(/€?\s*\/\s*kg/gi, ' ').replace(/€|eur\b/gi, ' ')
        .replace(/^\s*\d+([.,]\d+)?\s*(x|uds?|kg)?\s+/i, '').replace(/\s+\d+([.,]\d+)?\s*(x|kg|uds?)?\s*$/i, '')
        .replace(/\s+/g, ' ').trim();
      const letras = (nombre.match(/[a-záéíóúñü]/gi) || []).length;
      if (letras >= 3) {
        if (nombre === nombre.toUpperCase()) nombre = nombre.charAt(0) + nombre.slice(1).toLowerCase();
        r.productos.push(nombre);
      }
      if (r.productos.length >= 12) break;
    }
    // Identificador de cliente/compra (miMediaMarkt, socio, tarjeta de cliente…)
    for (let i = 0; i < lineas.length && !r.ident; i++) {
      if (!/(identificador|n[ºo°.]?\s*socio|socio|cliente|fidelizaci)/i.test(lineas[i])) continue;
      const m = (lineas[i] + ' ' + (lineas[i + 1] || '')).match(/(\d[\d ]{7,22}\d)/);
      if (m) r.ident = m[1].replace(/\s/g, '');
    }
    // Número del código de barras: la línea más larga solo de cifras (12+), sin tarjetas ni teléfonos
    let mejorB = '';
    for (const l of lineas) {
      if (!/^[\d\s]+$/.test(l)) continue;
      const d = l.replace(/\s/g, '');
      if (d.length >= 12 && d.length <= 40 && d !== r.ident && d.length > mejorB.length) mejorB = d;
    }
    if (mejorB) r.barras = mejorB;

    // Plazos impresos en el ticket: «CAMBIOS Y DEVOLUCIONES: 60 DÍAS», «garantía 2 años»
    const plano1 = norm(lineas.join(' '));
    const md = plano1.match(/(?:devoluci[oó]n|devoluciones|cambios)[^\d]{0,40}?(\d{1,3})\s*d[ií]as/);
    if (md && +md[1] >= 1 && +md[1] <= 365) r.devDias = +md[1];
    const mg = plano1.match(/garant[ií]a[^\d]{0,30}?(\d{1,2})\s*a[nñ]os?/);
    if (mg && +mg[1] >= 1 && +mg[1] <= 10) r.garAnios = +mg[1];
    return r;
  }

  g.analizarTicket = analizar;
  if (typeof module !== 'undefined') module.exports = analizar;
})(typeof window !== 'undefined' ? window : globalThis);
