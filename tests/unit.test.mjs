// Pruebas del lector, del código de barras y de las utilidades (node --test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const analizar = require('../analizar.js');
const barras = require('../barras.js');
const extras = require('../extras.js');
const fx = n => readFileSync(new URL('./fixtures/' + n, import.meta.url), 'utf8');
const HOY = '2026-10-31';

test('ticket real de MediaMarkt', () => {
  const r = analizar(fx('mediamarkt.txt'), HOY);
  assert.equal(r.tienda, 'MediaMarkt');
  assert.equal(r.fecha, '2026-10-28');
  assert.equal(r.total, 9.99);
  assert.equal(r.num, 'FS E294-107/00000001');
  assert.equal(r.nif, 'A82037292');
  assert.deepEqual(r.productos, ['Ardistel bf controller battery pack']);
  assert.equal(r.devDias, 60);
  assert.equal(r.ident, '9800000000000001');
  assert.equal(r.barras, '10000019171072026102800000');
});
test('ticket real de Consum (súper)', () => {
  const r = analizar(fx('consum.txt'), HOY);
  assert.equal(r.tienda, 'Consum');
  assert.equal(r.fecha, '2026-10-29');
  assert.equal(r.total, 9.3);
  assert.equal(r.esSuper, true);
  assert.deepEqual(r.productos, ['Mini croiss r.choco', 'Cappuccino kaiku', 'Bolsa compra recicl']);
});
test('Consum con importes separados en columnas', () => {
  const r = analizar(fx('consum-columnas.txt'), HOY);
  assert.equal(r.total, 9.3);
  assert.equal(r.fecha, '2026-10-29');
});
test('factura de Gmail (PcComponentes)', () => {
  const r = analizar(fx('gmail-pccomponentes.txt'), HOY);
  assert.deepEqual(r.productos, ['Ratón Logitech MX Master 3S']);
  assert.equal(r.total, 89.99);
  assert.equal(r.num, 'FS 2026/123456');
  assert.equal(r.devDias, 30);
});
test('casos sintéticos', () => {
  const m = analizar('MERCADONA, S.A. A-46103834\n25/10/2026 19:04\nFACTURA SIMPLIFICADA: 2345-021-123456\n1 LECHE ENTERA 6,30\nPLATANO 1,234 kg 2,10 €/kg 2,59\nTOTAL (€) 11,29', HOY);
  assert.equal(m.tienda, 'Mercadona'); assert.equal(m.total, 11.29); assert.equal(m.num, '2345-021-123456'); assert.ok(m.esSuper);
  const z = analizar('ZARA ESPAÑA, S.A.\nTicket: 0045 0012 3456\n28 oct 2026\nCAMISA LINO 39,95\nTOTAL EUR 39,95', HOY);
  assert.equal(z.fecha, '2026-10-28'); assert.equal(z.total, 39.95);
  const f = analizar('Ferretería López\nCalle Mayor 3\n05.09.26\nTaladro percutor 59,90\nBrocas 7,50\nTotal a pagar\n67,40', HOY);
  assert.equal(f.tienda, 'Ferretería López'); assert.equal(f.total, 67.4); assert.deepEqual(f.productos, ['Taladro percutor', 'Brocas']);
  assert.equal(analizar('Compra 31/12/2026 total 5,00', HOY).fecha, '', 'una fecha futura no vale');
});

// Decodificador Code 128 mínimo para comprobar que lo que pinta la app se lee bien
const P = ['212222','222122','222221','121223','121322','131222','122213','122312','132212','221213','221312','231212','112232','122132','122231','113222','123122','123221','223211','221132','221231','213212','223112','312131','311222','321122','321221','312212','322112','322211','212123','212321','232121','111323','131123','131321','112313','132113','132311','211313','231113','231311','112133','112331','132131','113123','113321','133121','313121','211331','231131','213113','213311','213131','311123','311321','331121','312113','312311','332111','314111','221411','431111','111224','111422','121124','121421','141122','141221','112214','112412','122114','122411','142112','142211','241211','221114','413111','241112','134111','111242','121142','121241','114212','124112','124211','411212','421112','421211','212141','214121','412121','111143','111341','131141','114113','114311','411113','411311','113141','114131','311141','411131','211412','211214','211232'];
function decodificar(m) {
  const anchos = m.match(/1+|0+/g).map(s => s.length).join('');
  const sim = []; for (let i = 0; i + 6 <= anchos.length - 7; i += 6) sim.push(P.indexOf(anchos.slice(i, i + 6)));
  assert.equal(anchos.slice(-7), '2331112', 'patrón de parada');
  assert.ok(!sim.includes(-1), 'símbolos válidos');
  const control = sim.pop(); let s = sim[0]; for (let i = 1; i < sim.length; i++) s += sim[i] * i;
  assert.equal(s % 103, control, 'dígito de control');
  let set = sim[0] === 105 ? 'C' : 'B', out = '';
  for (const c of sim.slice(1)) { if (c === 99) set = 'C'; else if (c === 100) set = 'B'; else out += set === 'C' ? String(c).padStart(2, '0') : String.fromCharCode(c + 32); }
  return out;
}
test('código de barras Code 128', () => {
  // mismo resultado que la librería python-barcode para números
  assert.equal(barras.modulos('9800000000000001'), '110100111001111010001011011001100110110011001101100110011011001100110110011001101100110011001101100100010011001100011101011');
  for (const c of ['10000019171072026102800000', 'FS E294-107/00000001', '9800000000000001', 'Hola-123']) assert.equal(decodificar(barras.modulos(c)), c);
  assert.equal(barras.modulos('ñandú'), null, 'texto que no se puede codificar');
  assert.ok(!barras.svg('<script>').includes('<script>'), 'svg sin HTML inyectado');
});
test('texto de reclamación', () => {
  const t = { fecha: '2026-10-28', tienda: 'MediaMarkt', total: 9.99, num: 'FS 1', garHasta: '2029-10-28', devHasta: '2026-12-27' };
  const g = extras.reclamacion(t, 'Batería', 'gar', 'No carga.');
  assert.match(g, /garantía/); assert.match(g, /No carga\./); assert.match(g, /28 de octubre de 2029/);
  assert.match(extras.reclamacion(t, 'Batería', 'dev', ''), /27 de diciembre de 2026/);
});
test('ZIP válido', () => {
  assert.equal(extras.crc32(new TextEncoder().encode('123456789')), 0xCBF43926);
});
