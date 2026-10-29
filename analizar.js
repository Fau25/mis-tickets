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
  const RE_MONTO = /(?:^|[^\d,.])(-?\d{1,3}(?:\.\d{3})+,\d{2}|-?\d+[.,]\d{2})(?![\d%])/g;

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
      const todos = lineas.filter(l => !/(%|iva|cambio|entregado)/i.test(l)).flatMap(montos).filter(n => n > 0 && n < 100000);
      if (todos.length) r.total = Math.max(...todos);
    }

    // Nº de ticket o factura
    const RES_N = [/(?:^|[^a-z])(?:factura(?:\s+simplificada)?|ticket|fra\.?)\s*(?:n[ºo°.]*)?\s*[:#]?\s*([A-Z0-9](?:[A-Z0-9\-\/]| (?=\d)){3,})/i,
      /(?:^|[^a-z])(?:n[ºo°]\.?\s*(?:de\s+)?(?:operaci[oó]n|documento|doc\.?)?|doc\.?)\s*[:#]?\s*([A-Z0-9](?:[A-Z0-9\-\/]| (?=\d)){3,})/i];
    for (const re of RES_N) {
      for (const l of lineas) { const mn = l.match(re); if (mn && /\d/.test(mn[1])) { r.num = mn[1].trim().toUpperCase(); break; } }
      if (r.num) break;
    }

    // NIF/CIF de la tienda
    const mf = texto.toUpperCase().match(/\b([ABCDEFGHJNPQRSUVW])[\s\-.]?(\d{7})([0-9A-J])\b/);
    if (mf) r.nif = mf[1] + mf[2] + mf[3];

    // Productos: líneas con importe que no son totales, pagos ni impuestos
    const EXCL_P = /(total|iva|base|cambio|entregado|efectivo|tarjeta|visa|master|importe|pago|pagar|descuento|ahorr|redondeo|cuota|%|fecha|hora|tel[eé.f]|n\.?i\.?f|c\.?i\.?f|factura|ticket|bizum|devoluci)/i;
    for (const l of lineas) {
      if (!montos(l).length || EXCL_P.test(l)) continue;
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
    return r;
  }

  g.analizarTicket = analizar;
  if (typeof module !== 'undefined') module.exports = analizar;
})(typeof window !== 'undefined' ? window : globalThis);
