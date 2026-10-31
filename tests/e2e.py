"""Pruebas de extremo a extremo de Mis Tickets (iPhone e iPad simulados, servidor de Google simulado).

Uso: desde la carpeta de la app
    python3 -m http.server 8765 &
    python3 tests/e2e.py
Requiere: pip install playwright pillow && playwright install chromium
"""
import base64, io, json, sys, time, zipfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
from playwright.sync_api import sync_playwright

H = 'http://localhost:8765/'
URL = 'https://script.google.com/macros/s/PRUEBA/exec'
FX = Path(__file__).parent / 'fixtures'
TMP = Path(__file__).parent / '.tmp'; TMP.mkdir(exist_ok=True)
fallos, errores = [], []

def ok(cond, nombre, detalle=''):
    print(('  OK   ' if cond else '  FALLO') + ' ' + nombre + ('' if cond else f'  → {detalle}'))
    if not cond: fallos.append(nombre)

# --- Imágenes de prueba: un ticket sobre una mesa oscura y la foto de un producto
def imagenes():
    bg = Image.new('RGB', (1500, 2000), (52, 46, 44)); d = ImageDraw.Draw(bg)
    papel = Image.new('RGB', (760, 1500), (226, 222, 212)); dp = ImageDraw.Draw(papel)
    for i, l in enumerate(['MEDIA MARKT', 'FACTURA SIMPLIFICADA', 'Fecha: 28/10/2026', 'BATERIA 9,99', 'TOTAL 9,99']):
        dp.rectangle((50, 60 + i * 70, 50 + 22 * len(l), 90 + i * 70), fill=(120, 116, 112))
    bg.paste(papel, (370, 250)); bg.filter(ImageFilter.GaussianBlur(.6)).save(TMP / 'ticket.jpg', quality=88)
    prod = Image.new('RGB', (1200, 900), (120, 160, 200)); ImageDraw.Draw(prod).ellipse((300, 200, 900, 700), fill=(30, 30, 30)); prod.save(TMP / 'producto.jpg')

# --- Servidor de Apps Script simulado (mismo contrato que Code.gs)
srv = {'tickets': {}, 'fotos': {}, 'papelera': [], 'caido': False, 'ocr': (FX / 'mediamarkt.txt').read_text(), 'llamadas': []}
def ids(t): return [f['fotoId'] for f in t.get('fotos', []) if f.get('fotoId')]
def mock(route):
    if srv['caido']: return route.abort()
    p = json.loads(route.request.post_data); a = p['accion']; srv['llamadas'].append(a); o = {'ok': True}
    if p.get('clave') != 'c': o = {'ok': False, 'error': 'clave'}
    elif a == 'leer': o['texto'] = srv['ocr']
    elif a == 'subir': fid = 'F' + p['id']; srv['fotos'][fid] = (p['b64'], p.get('mime')); o['fotoId'] = fid
    elif a == 'foto': b, m = srv['fotos'][p['fotoId']]; o.update(b64=b, mime=m)
    elif a == 'gmail':
        now = int(time.time() * 1000)
        srv['tickets']['gm1'] = dict(id='gm1', t=now, s=now, creado=now, tienda='PcComponentes', concepto='', fecha='2026-10-27', total=None, num='', productos=[],
                                     texto=(FX / 'gmail-pccomponentes.txt').read_text(), devOpc=14, garOpc=3, devHasta='2026-11-10', garHasta='2029-10-27',
                                     fotos=[dict(k='0', fotoId='FG', mime='image/jpeg', mini='')], analizar=True, fechaLeida=True)
        srv['fotos']['FG'] = srv['fotos'].get('FG') or (base64.b64encode((TMP / 'producto.jpg').read_bytes()).decode(), 'image/jpeg'); o['nuevos'] = 1
    elif a == 'sync':
        now = int(time.time() * 1000)
        for t in p['tickets']:
            v = srv['tickets'].get(t['id'])
            if not v or t.get('t', 0) > v.get('t', 0):
                if v: srv['papelera'] += [i for i in ids(v) if i not in ids(t)]
                t['s'] = now; srv['tickets'][t['id']] = t
        d = p.get('desde', 0)
        o.update(tickets=[t for t in srv['tickets'].values() if t.get('s', 0) > d] if d else list(srv['tickets'].values()), ahora=now, parcial=d > 0)
    route.fulfill(status=200, content_type='application/json', body=json.dumps(o))

def nuevo(b, nombre, datos=None, conectado=True, sw=False, **kw):
    kw.setdefault('viewport', {'width': 390, 'height': 844}); kw.setdefault('is_mobile', True); kw.setdefault('has_touch', True)
    ctx = b.new_context(service_workers='allow' if sw else 'block', accept_downloads=True, **kw)
    ctx.route('https://script.google.com/**', mock)
    pre = (f"localStorage.setItem('mt-url','{URL}');localStorage.setItem('mt-clave','c');" if conectado else '')
    if datos is not None: pre += "if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1);localStorage.setItem('mt-tickets',%s);}" % json.dumps(json.dumps(datos))
    ctx.add_init_script(pre)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errores.append(f'{nombre}: {e}')); pg.on('dialog', lambda d: d.accept())
    pg.goto(H); pg.wait_for_timeout(1200); return ctx, pg

def manual(pg, producto, tienda, fecha, dev=None, gar=None, imp=False):
    pg.click('#b-mas'); pg.click('[data-x=manual]'); pg.wait_for_timeout(200)
    pg.fill('#e-concepto', producto); pg.fill('#e-tienda', tienda); pg.dispatch_event('#e-tienda', 'change')
    pg.fill('#e-fecha', fecha); pg.dispatch_event('#e-fecha', 'change')
    if dev is not None: pg.click(f'#o-dev [data-v="{dev}"]')
    if gar is not None: pg.click(f'#o-gar [data-v="{gar}"]')
    if imp: pg.click('.interruptor input')
    pista, hd = pg.inner_text('#e-pista'), pg.inner_text('#h-dev')
    pg.click('.capa:last-child .top [data-x=guardar]'); pg.wait_for_timeout(300); return pista, hd

def ticket(id, **k):
    t = dict(id=id, t=1, creado=1, tienda='Decathlon', concepto='Zapatillas', fecha='2026-10-20', total=20, devOpc=30, garOpc=0,
             devHasta='2026-11-19', garHasta=None, fotos=[]); t.update(k); return t

imagenes()
with sync_playwright() as p:
    b = p.chromium.launch()
    print('Alta con foto y lectura')
    ctx, A = nuevo(b, 'iPhone', device_scale_factor=2)
    A.click('#b-mas'); A.set_input_files('#f-archivo', [str(TMP / 'ticket.jpg'), str(TMP / 'producto.jpg')])
    A.wait_for_selector('.leido', timeout=15000); A.wait_for_timeout(1500)
    ok(A.locator('.ft .modo').all_inner_texts() == ['Escaneado · ver original'], 'modo escáner solo en el ticket')
    v = {k: A.input_value('#e-' + k) for k in ['concepto', 'tienda', 'fecha', 'total', 'num', 'ident', 'barras']}
    ok(v == {'concepto': 'Ardistel bf controller battery pack', 'tienda': 'MediaMarkt', 'fecha': '2026-10-28', 'total': '9,99', 'num': 'FS E294-107/00000001', 'ident': '9800000000000001', 'barras': '10000019171072026102800000'}, 'datos leídos del ticket', v)
    ok('60 días' in A.inner_text('#h-dev'), 'plazo de 60 días leído del ticket', A.inner_text('#h-dev'))
    A.click('.capa .top [data-x=guardar]'); A.wait_for_timeout(2500)
    ok(len(srv['fotos']) == 2, 'fotos subidas a Drive', srv['fotos'].keys())

    print('Plazos, papelera y «No borrar nunca»')
    manual(A, 'Camisa', 'Zara', '2026-10-20', dev='14', gar='0')
    pista, hd = manual(A, 'Pantalón', 'Zara', '2026-10-27')
    ok('Zara' in pista and '10 nov 2026' in hd, 'recuerda los plazos de la tienda', (pista, hd))
    manual(A, 'Lavadora', 'Bosch', '2023-01-10', dev='0', gar='1', imp=True); A.wait_for_timeout(2000)
    A.click('#b-mas'); A.click('[data-x=manual]'); A.fill('#e-concepto', 'Sofá'); A.fill('#e-total', '1.234'); A.click('.capa .top [data-x=guardar]'); A.wait_for_timeout(300)
    ok(A.evaluate("tickets.find(t=>t.concepto==='Sofá').total") == 1234, 'importe «1.234» = 1234 €', A.evaluate("tickets.find(t=>t.concepto==='Sofá').total"))
    ok(A.evaluate("vivos().filter(t=>estado(t).papelera).length") == 0, 'lo importante no va a la papelera')

    print('Sin cobertura')
    srv['caido'] = True
    A.click('#b-mas'); A.set_input_files('#f-archivo', str(TMP / 'ticket.jpg')); A.wait_for_selector('.leido', timeout=15000)
    ok('Sin conexión' in A.inner_text('#e-estado'), 'avisa sin conexión'); A.click('.capa .top [data-x=guardar]'); A.wait_for_timeout(300)
    ok(A.evaluate("tickets.filter(t=>t.leerPend).length") == 1, 'queda pendiente de leer')
    srv['caido'] = False; A.evaluate('sincronizar()'); A.wait_for_timeout(2500)
    ok(A.evaluate("tickets.filter(t=>t.leerPend).length") == 0, 'lee y sube al volver la conexión')

    print('Segundo dispositivo (iPad, modo oscuro)')
    ctxB, B = nuevo(b, 'iPad', viewport={'width': 820, 'height': 1180}, color_scheme='dark'); B.wait_for_timeout(800)
    ok(B.locator('.ticket').count() == A.locator('.ticket').count(), 'mismos tickets en el iPad')
    B.locator('.ticket:has-text("2 fotos")').first.click(); B.wait_for_timeout(500); B.click('[data-x=fotos]'); B.wait_for_timeout(1500)
    ok(B.locator('#f-tiras .ft').count() == 2 and B.locator('#f-foto img[data-x=ver]').count() == 1, 'fotos descargadas de Drive')
    B.click('.capa:last-child [data-x=cerrar]'); B.click('.capa .top [data-x=editar]'); B.wait_for_timeout(300)
    B.locator('#e-fotos [data-x=quitar]').nth(1).click(); B.click('.capa:last-child .top [data-x=guardar]'); B.wait_for_timeout(2500)
    ok(len(srv['papelera']) == 1, 'la foto quitada va a la papelera de Drive')
    ctxB.close()

    print('Guardar, resguardo, reclamar y copia')
    A.evaluate('while(capas.length) cerrarCapa()'); A.locator('.ticket:has-text("foto")').first.click(); A.wait_for_timeout(2000)
    with A.expect_download() as dl: A.click('.acciones [data-x=guardar]')
    ok(dl.value.suggested_filename.endswith('.jpg'), 'guarda la foto', dl.value.suggested_filename)
    with A.expect_download() as dl: A.click('[data-x=resguardo]')
    ok(dl.value.suggested_filename.startswith('Resguardo'), 'resguardo en imagen')
    A.click('[data-x=reclamar]'); A.fill('#r-problema', 'No carga.'); A.click('#r-tipo [data-v=gar]')
    ok('No carga.' in A.input_value('#r-texto') and 'garantía' in A.input_value('#r-texto'), 'texto de reclamación')
    A.evaluate('while(capas.length) cerrarCapa()'); A.click('#t-ajustes'); A.click('[data-x=gmail]'); A.wait_for_timeout(3500)
    g = A.evaluate("JSON.stringify(tickets.filter(t=>t.id==='gm1').map(t=>[titulo(t),t.total,t.num,t.devHasta,!!t.analizar]))")
    ok(g == json.dumps([['Ratón Logitech MX Master 3S', 89.99, 'FS 2026/123456', '2026-11-26', False]], separators=(',', ':'), ensure_ascii=False), 'factura de Gmail completada', g)
    A.click('[data-x=copia]'); A.wait_for_timeout(3000)
    with A.expect_download() as dl: A.click('[data-x=copia]')
    z = zipfile.ZipFile(io.BytesIO(Path(dl.value.path()).read_bytes()))
    ok(z.testzip() is None and 'resumen.csv' in z.namelist() and any(n.startswith('fotos/') for n in z.namelist()), 'copia ZIP válida', z.namelist())
    A.evaluate('while(capas.length) cerrarCapa()')
    n1 = A.evaluate('vivos().length'); A.reload(); A.wait_for_timeout(1500)
    ok(A.evaluate('vivos().length') == n1 and A.evaluate("localStorage.getItem('mt-tickets')") is None, 'datos en IndexedDB tras recargar')
    ctx.close()

    print('Usabilidad táctil y accesibilidad')
    ctx, U = nuevo(b, 'usabilidad', [ticket(f'x{i}', concepto=f'Producto {i}') for i in range(25)], conectado=False)
    U.click('#b-mas'); U.click('[data-x=manual]'); U.click('#o-dev [data-v=otra]')
    peq = U.evaluate("[...document.querySelectorAll('input:not([type=checkbox]):not([type=file]),textarea')].filter(e=>e.offsetParent&&parseFloat(getComputedStyle(e).fontSize)<16).map(e=>e.id)")
    ok(peq == [], 'todos los campos ≥16 px (sin zoom en iPhone)', peq)
    U.focus('#e-concepto'); U.keyboard.press('Enter'); ok(U.evaluate('document.activeElement.id') == 'e-tienda', 'Intro pasa al siguiente campo')
    ok(U.evaluate("document.querySelector('.capa').getAttribute('role')") == 'dialog' and U.evaluate("document.querySelector('#inicio').inert"), 'pantalla como diálogo con el fondo inerte')
    U.keyboard.press('Escape'); U.wait_for_timeout(200); ok(U.evaluate('capas.length') == 0, 'Escape cierra la pantalla')
    U.focus('#buscar'); ok(U.evaluate("getComputedStyle(document.querySelector('nav.barra')).display") == 'none', 'barra oculta con teclado')
    U.keyboard.type('Producto 1'); U.wait_for_timeout(300); ok(U.locator('.ticket').count() == 11, 'búsqueda', U.locator('.ticket').count())
    U.fill('#buscar', ''); U.evaluate('document.activeElement.blur()'); U.wait_for_timeout(200)
    U.mouse.wheel(0, 1500); U.wait_for_timeout(300); ok(0 <= U.evaluate("document.querySelector('#buscar').getBoundingClientRect().top") < 40, 'buscador fijo al bajar')
    ok(U.evaluate('document.documentElement.scrollWidth') == 390, 'sin desbordes horizontales')
    U.evaluate('scrollTo(0,0)'); U.locator('.ticket').first.click(); U.wait_for_timeout(300)
    U.evaluate("""() => { const el=document.querySelector('.capa'); const t=x=>new Touch({identifier:1,target:el,clientX:x,clientY:400});
      for (const [n,x] of [['touchstart',10],['touchmove',80],['touchmove',160]]) document.dispatchEvent(new TouchEvent(n,{touches:[t(x)],bubbles:true}));
      document.dispatchEvent(new TouchEvent('touchend',{touches:[],bubbles:true})); }""")
    U.wait_for_timeout(300); ok(U.evaluate('capas.length') == 0, 'deslizar desde el borde para volver')
    U.evaluate("aviso('x')"); ok(U.evaluate("document.querySelector('.toast').getAttribute('aria-live')") == 'polite', 'avisos anunciados al lector de pantalla')
    ctx.close()

    print('Errores corregidos en la auditoría')
    c = b.new_context(); pg = c.new_page(); pg.goto(H + 'manifest.json')
    pg.evaluate("caches.open('otra-app-v1').then(x=>x.put('/otra/',new Response('ok')))"); pg.goto(H); pg.wait_for_timeout(2500)
    ok('otra-app-v1' in pg.evaluate('caches.keys()'), 'no borra la caché de otras apps del mismo dominio', pg.evaluate('caches.keys()')); c.close()
    T = ticket('p1', fecha='2026-09-20', devHasta='2026-10-20'); srv['tickets'] = {'p1': dict(T, s=1)}
    ctx, pg = nuevo(b, 'conservar', [T]); pg.click('#filtros [data-f=papelera]'); pg.click('.ticket'); pg.wait_for_timeout(300)
    pg.evaluate("localStorage.removeItem('mt-desde')"); pg.evaluate('sincronizar()'); pg.wait_for_timeout(800)
    pg.click('[data-x=conservar]'); pg.wait_for_timeout(2500)
    ok(srv['tickets']['p1'].get('garHasta'), '«Conservar un año más» se guarda aunque haya sincronizado', srv['tickets']['p1'].get('garHasta')); ctx.close()
    T = ticket('p2', fotos=[dict(k='0', fotoId='NOEXISTE', mime='image/jpeg', mini='')]); srv['tickets'] = {'p2': dict(T, s=1)}
    ctx, pg = nuevo(b, 'offline', [T]); srv['caido'] = True; pg.click('.ticket'); pg.wait_for_timeout(1500)
    pg.click('.acciones [data-x=guardar]'); pg.wait_for_timeout(300)
    ok('sin conexión' in pg.inner_text('.toast'), 'sin conexión: lo dice en vez de «vuelve a pulsar»', pg.inner_text('.toast')); srv['caido'] = False; ctx.close()
    T = ticket('p3', garOpc='otra', garHasta='2029-01-01" autofocus onfocus="window.__x=1'); srv['tickets'] = {'p3': dict(T, s=1)}
    ctx, pg = nuevo(b, 'inyeccion', [T]); pg.click('.ticket'); pg.click('.capa .top [data-x=editar]'); pg.wait_for_timeout(500)
    ok(not pg.evaluate("[...document.querySelector('#h-gar input').attributes].some(a=>a.name==='onfocus')"), 'sin inyección de HTML en las fechas'); ctx.close()
    ctx, pg = nuevo(b, 'migracion', [dict(ticket('v1'), fotoId='FX', tipo='img', mini='data:image/gif;base64,R0lGODlhAQABAAAAACw=', fotos=None)], conectado=False)
    ok(pg.evaluate("JSON.stringify(tickets[0].fotos.map(f=>f.fotoId))") == '["FX"]', 'migra tickets de la v1'); ctx.close()
    b.close()

ok(not errores, 'sin errores de JavaScript', errores)
print(f"\n{'TODO BIEN' if not fallos else str(len(fallos)) + ' FALLOS: ' + ', '.join(fallos)}")
sys.exit(1 if fallos else 0)
