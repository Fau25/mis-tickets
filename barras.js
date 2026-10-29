/* Mis Tickets · código de barras Code 128 (B para texto, C para números) para enseñarlo en la tienda */
(function (g) {
  const P = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232'];
  const FIN = '2331112';
  // Devuelve los códigos de símbolo (con inicio y control) o null si el texto no se puede codificar
  function codigos(txt) {
    txt = String(txt || '').trim(); if (!txt || txt.length > 60) return null;
    let c;
    if (/^\d+$/.test(txt) && txt.length % 2 === 0 && txt.length >= 4) {
      c = [105]; for (let i = 0; i < txt.length; i += 2) c.push(+txt.slice(i, i + 2));
    } else {
      if (!/^[\x20-\x7E]+$/.test(txt)) return null;
      c = [104]; for (const ch of txt) c.push(ch.charCodeAt(0) - 32);
    }
    let s = c[0]; for (let i = 1; i < c.length; i++) s += c[i] * i;
    c.push(s % 103);
    return c;
  }
  // Módulos 1/0 (1 = barra)
  function modulos(txt) {
    const c = codigos(txt); if (!c) return null;
    let out = '';
    for (const pat of c.map(i => P[i]).concat(FIN)) for (let i = 0; i < pat.length; i++) out += (i % 2 ? '0' : '1').repeat(+pat[i]);
    return out;
  }
  // SVG listo para pintar (color = color de las barras)
  function svg(txt, color, alto) {
    const m = modulos(txt); if (!m) return '';
    let rects = '', x = 0;
    while (x < m.length) { if (m[x] === '1') { let w = 1; while (m[x + w] === '1') w++; rects += `<rect x="${x + 10}" width="${w}" height="${alto || 60}"/>`; x += w; } else x++; }
    return `<svg viewBox="0 0 ${m.length + 20} ${alto || 60}" preserveAspectRatio="none" role="img" aria-label="Código de barras ${String(txt).replace(/[^\w\- \/.]/g, '')}" style="width:100%;height:${alto || 60}px;display:block" fill="${color || '#000'}">${rects}</svg>`;
  }
  g.codigoBarras = { modulos, svg };
  if (typeof module !== 'undefined') module.exports = { modulos, svg };
})(typeof window !== 'undefined' ? window : globalThis);
