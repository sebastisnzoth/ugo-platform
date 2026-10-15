/**
 * Smoke test del panel admin (UGO TEST) sin red real.
 *
 * - Monta AdminExperience dentro de jsdom con React 19 real.
 * - Intercepta fetch con respuestas PostgREST/postgrest-like para cada tabla.
 * - Recorre las 8 secciones y verifica que rendericen sin excepciones.
 *
 * Uso: npm run smoke:admin
 */
import { JSDOM } from 'jsdom'
import { createServer } from 'vite'
import React from 'react'
import { createRoot } from 'react-dom/client'

const SUPABASE_HOST = 'tmossnqfwfwjrtzwcbmm.supabase.co'

const now = Date.now()
const iso = (minutesAgo) => new Date(now - minutesAgo * 60000).toISOString()

const serviceRow = (id, estado, overrides = {}) => ({
  id,
  numero: Number(id.replace(/\D/g, '')) || 1,
  estado,
  ambiente: 'real',
  cliente_id: '22222222-2222-4222-8222-222222222222',
  proveedor_id: '33333333-3333-4333-8333-333333333333',
  categoria_id: '44444444-4444-4444-8444-444444444444',
  descripcion: 'Cambio de grifería en cocina',
  zona: 'Centro',
  tarifa: 180,
  moneda: 'BRL',
  comision_ugo: 18,
  ganancia_proveedor: 162,
  created_at: iso(90),
  aceptado_at: iso(80),
  iniciado_at: iso(60),
  completado_at: estado === 'completado' ? iso(20) : null,
  cancelado_at: null,
  categoria: { nombre: 'Plomería', emoji: '🔧' },
  cliente: { nombre: 'Ana', apellido: 'Souza' },
  proveedor: { nombre: 'Bruno', apellido: 'Lima' },
  ...overrides,
})

const FIXTURES = {
  usuarios: [
    { id: '11111111-1111-4111-8111-111111111111', nombre: 'Seba', apellido: 'Admin', tipo: 'superadmin', activo: true, foto_url: null, pais: 'BR', zona: 'Florianópolis', karma: 100, servicios_completados: 0, created_at: iso(5000), updated_at: iso(30) },
    { id: '22222222-2222-4222-8222-222222222222', nombre: 'Ana', apellido: 'Souza', tipo: 'cliente', activo: true, foto_url: null, pais: 'BR', zona: 'Centro', karma: 12, servicios_completados: 3, created_at: iso(4000), updated_at: iso(120) },
    { id: '33333333-3333-4333-8333-333333333333', nombre: 'Bruno', apellido: 'Lima', tipo: 'proveedor', activo: false, foto_url: null, pais: 'BR', zona: 'Trindade', karma: 40, servicios_completados: 18, created_at: iso(3000), updated_at: iso(60) },
  ],
  servicios: [serviceRow('svc-1001', 'en_progreso'), serviceRow('svc-1002', 'completado'), serviceRow('svc-1003', 'disputado')],
  perfiles_proveedor: [
    { usuario_id: '33333333-3333-4333-8333-333333333333', estado_verificacion: 'pendiente', motivo_rechazo: null, online: true, disponible: true, ciudad_base: 'Florianópolis', telefono_profesional: '+55 48 99999-0000', tarifa_base: 120, experiencia_anos: 6, updated_at: iso(15), categoria_principal_id: '44444444-4444-4444-8444-444444444444', categoria: { nombre: 'Plomería', emoji: '🔧' }, usuario: { nombre: 'Bruno', apellido: 'Lima', activo: false, zona: 'Trindade' } },
  ],
  perfiles_cliente: [{ usuario_id: '22222222-2222-4222-8222-222222222222', telefono: '+55 48 98888-1111', direccion: 'Rua das Flores 100', barrio: 'Centro', ciudad: 'Florianópolis' }],
  eventos_servicio: [
    { id: 1, actor_id: '33333333-3333-4333-8333-333333333333', evento: 'estado_actualizado', estado_anterior: 'asignado', estado_nuevo: 'en_camino', detalles: { origen: 'proveedor' }, created_at: iso(45) },
    { id: 2, actor_id: '22222222-2222-4222-8222-222222222222', evento: 'estado_actualizado', estado_anterior: 'en_camino', estado_nuevo: 'en_progreso', detalles: {}, created_at: iso(35) },
  ],
  evidencias_servicio: [{ id: '55555555-5555-4555-8555-555555555555', tipo: 'inicial', storage_path: 'servicios/svc-1001/inicial.jpg', descripcion: 'Foto de llegada', usuario_id: '33333333-3333-4333-8333-333333333333', created_at: iso(40) }],
  pagos: [
    { id: '66666666-6666-4666-8666-666666666666', servicio_id: 'svc-1001', ambiente: 'real', metodo: 'pix_direto', procesador: 'pix', modelo_pago: 'presencial', estado: 'pendiente', monto_bruto: 180, comision_ugo: 18, ganancia_proveedor: 162, moneda: 'BRL', pix_e2e_id: null, pix_informado_at: iso(12), pix_conciliado_at: null, pix_conciliacion_nota: null, created_at: iso(70), autorizado_at: null, liberado_at: null, servicio: { numero: 1001, descripcion: 'Cambio de grifería' } },
    { id: '77777777-7777-4777-8777-777777777777', servicio_id: 'svc-1002', ambiente: 'real', metodo: 'efectivo', procesador: 'efectivo', modelo_pago: 'presencial', estado: 'liberado', monto_bruto: 150, comision_ugo: 15, ganancia_proveedor: 135, moneda: 'BRL', pix_e2e_id: null, pix_informado_at: null, pix_conciliado_at: null, pix_conciliacion_nota: null, created_at: iso(400), autorizado_at: iso(390), liberado_at: iso(200), servicio: { numero: 1002, descripcion: 'Reparación de tomacorriente' } },
  ],
  deudas_ugo_proveedor: [
    { id: '88888888-8888-4888-8888-888888888888', pago_id: '77777777-7777-4777-8777-777777777777', servicio_id: 'svc-1002', proveedor_id: '33333333-3333-4333-8333-333333333333', monto_servicio: 150, comision_ugo: 15, monto_pagado_ugo: 0, saldo_pendiente: 15, moneda: 'BRL', estado: 'informado', referencia_pago: 'PIX-0099', pago_informado_at: iso(120), pagado_at: null, ambiente: 'real', created_at: iso(200), proveedor: { nombre: 'Bruno', apellido: 'Lima' }, servicio: { numero: 1002 } },
  ],
  retiros: [
    { id: '99999999-9999-4999-8999-999999999999', proveedor_id: '33333333-3333-4333-8333-333333333333', ambiente: 'real', monto: 135, moneda: 'BRL', estado: 'solicitado', created_at: iso(300), procesado_at: null, transferencia_externa_id: null, notas: null, proveedor: { nombre: 'Bruno', apellido: 'Lima' } },
  ],
  disputas: [
    { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', numero: 7001, servicio_id: 'svc-1003', cliente_id: '22222222-2222-4222-8222-222222222222', proveedor_id: '33333333-3333-4333-8333-333333333333', estado: 'abierta', motivo: 'El trabajo quedó incompleto', monto_disputado: 180, resolucion: null, resolucion_favor: null, created_at: iso(150), updated_at: iso(140), resuelta_at: null, servicio: { numero: 1003, estado: 'disputado' }, cliente: { nombre: 'Ana', apellido: 'Souza' }, proveedor: { nombre: 'Bruno', apellido: 'Lima' } },
  ],
  disputa_mensajes: [{ id: 11, disputa_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', autor_rol: 'cliente', mensaje: 'El trabajo quedó incompleto y necesito revisión.', created_at: iso(140) }],
  documentos: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', usuario_id: '33333333-3333-4333-8333-333333333333', tipo: 'identidad', estado: 'pendiente', url_storage: 'documentos/bruno-dni.jpg', descripcion: 'Documento de identidad', notas: null, notas_rechazo: null, created_at: iso(90), updated_at: iso(90), revisado_at: null }],
  categorias: [
    { id: '44444444-4444-4444-8444-444444444444', nombre: 'Plomería', emoji: '🔧' },
    { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', nombre: 'Limpieza', emoji: '🧹' },
  ],
  config_sistema: [
    { clave: 'comision_ugo_pct', valor: '10', grupo: 'tarifas' },
    { clave: 'mp_access_token', valor: 'APP_USR-super-secreto', grupo: 'pagos' },
  ],
  audit_log: [
    { id: 501, evento: 'admin.withdrawal.update', actor_id: '11111111-1111-4111-8111-111111111111', actor_tipo: 'admin', entidad_tipo: 'retiro', entidad_id: '99999999-9999-4999-8999-999999999999', detalles: { estado: 'procesando' }, created_at: iso(10) },
    { id: 502, evento: 'disputa_resuelta', actor_id: '11111111-1111-4111-8111-111111111111', actor_tipo: 'admin', entidad_tipo: 'disputa', entidad_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', detalles: { favor_de: 'cliente' }, created_at: iso(48) },
  ],
  retiros_count: null,
}

const CATALOG_PATHS = {
  ...Object.fromEntries(Object.keys(FIXTURES).map((table) => [`/${table}`, {}])),
  '/rpc/admin_set_usuario_activo': {},
  '/rpc/conciliar_pix_direto': {},
  '/rpc/admin_confirmar_deuda_ugo_pagada': {},
  '/rpc/admin_actualizar_retiro': {},
  '/rpc/admin_resolver_disputa': {},
  '/rpc/admin_get_auth_users': {},
}

function rowsFor(table) {
  const rows = FIXTURES[table]
  return Array.isArray(rows) ? rows : []
}

function installFetchStub() {
  const original = globalThis.fetch
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url
    const parsed = new URL(url)
    const headers = new Headers({ 'content-type': 'application/json' })
    const method = String(init.method || 'GET').toUpperCase()

    if (!parsed.hostname.includes(SUPABASE_HOST)) return original(input, init)

    if (parsed.pathname === '/rest/v1/') {
      return new Response(JSON.stringify({ swagger: '2.0', paths: CATALOG_PATHS }), { status: 200, headers })
    }

    if (parsed.pathname.startsWith('/rest/v1/rpc/')) {
      const rpc = parsed.pathname.replace('/rest/v1/rpc/', '')
      if (rpc === 'admin_get_auth_users') {
        return new Response(JSON.stringify([{ id: '11111111-1111-4111-8111-111111111111', email: 'admin@ugo.test', email_confirmed: true, last_sign_in_at: iso(5) }]), { status: 200, headers })
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
    }

    if (parsed.pathname.startsWith('/rest/v1/')) {
      const table = parsed.pathname.replace('/rest/v1/', '').split('/')[0]
      const rows = rowsFor(table)
      const wantsObject = String(init.headers && (init.headers.accept || init.headers.Accept) || '').includes('pgrst.object')
      if (String(parsed.searchParams.get('select') || '').includes('head')) {
        headers.set('content-range', `0-0/${rows.length}`)
        return new Response(null, { status: 200, headers })
      }
      headers.set('content-range', `0-${Math.max(rows.length - 1, 0)}/${rows.length}`)
      const body = method === 'GET' ? (wantsObject ? rows[0] || null : rows) : rows[0] || null
      return new Response(JSON.stringify(body), { status: 200, headers })
    }

    if (parsed.pathname.startsWith('/auth/v1/')) {
      return new Response(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111', email: 'admin@ugo.test' }), { status: 200, headers })
    }

    return new Response(JSON.stringify({}), { status: 200, headers })
  }
}

// Realtime no debe abrir sockets reales: el smoke test tiene que ser hermético
// (mismo resultado en local, en CI y sin red).
class SilentWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  readyState = 0
  onopen = null
  onclose = null
  onerror = null
  onmessage = null
  close() {
    this.readyState = 3
  }
  send() {}
  addEventListener() {}
  removeEventListener() {}
}

function installDom() {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'https://example.test/ugo-platform/?app=admin',
    pretendToBeVisual: true,
  })
  const { window } = dom
  const exposed = [
    'window',
    'document',
    'HTMLElement',
    'HTMLInputElement',
    'HTMLTextAreaElement',
    'Element',
    'Node',
    'Event',
    'CustomEvent',
    'MouseEvent',
    'KeyboardEvent',
    'MutationObserver',
    'localStorage',
    'sessionStorage',
    'getComputedStyle',
    'requestAnimationFrame',
    'cancelAnimationFrame',
    'DOMParser',
    'XMLHttpRequest',
    'WebSocket',
    'location',
    'history',
    'navigator',
  ]
  for (const key of exposed) {
    if (key === 'window' || key === 'document') continue
    if (window[key] === undefined) continue
    Object.defineProperty(globalThis, key, { value: window[key], configurable: true, writable: true })
  }
  globalThis.window = window
  globalThis.document = window.document
  Object.defineProperty(globalThis, 'WebSocket', { value: SilentWebSocket, configurable: true, writable: true })
  Object.defineProperty(window, 'WebSocket', { value: SilentWebSocket, configurable: true, writable: true })
  window.scrollTo = () => {}
  window.HTMLElement.prototype.scrollIntoView = () => {}
  return window
}

const errors = []

function recordError(message) {
  errors.push(message)
}

async function main() {
  const window = installDom()
  installFetchStub()

  const session = {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 60 * 60 * 24 * 30,
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      aud: 'authenticated',
      role: 'authenticated',
      email: 'admin@ugo.test',
      app_metadata: {},
      user_metadata: {},
      created_at: iso(6000),
    },
  }
  window.localStorage.setItem('ugo-platform-admin-auth', JSON.stringify(session))

  window.addEventListener('error', (event) => recordError(`window.error: ${event.message}`))
  window.addEventListener('unhandledrejection', (event) => recordError(`unhandledrejection: ${event.reason}`))

  const server = await createServer({
    configFile: false,
    root: process.cwd(),
    logLevel: 'silent',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
  })

  try {
    const mod = await server.ssrLoadModule('/src/admin/AdminExperience.tsx')
    const AdminExperience = mod.default
    const container = window.document.getElementById('root')
    const root = createRoot(container)
    const realtimeErrors = []

    root.render(
      React.createElement(AdminExperience, {
        session: { session, role: 'superadmin', displayName: 'QA Admin' },
      }),
    )

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    await wait(500)

    const sections = [
      ['overview', 'Visión general'],
      ['services', 'Servicios'],
      ['people', 'Personas'],
      ['providers', 'Profesionales'],
      ['finance', 'Finanzas'],
      ['disputes', 'Disputas'],
      ['audit', 'Auditoría'],
      ['system', 'Sistema'],
    ]

    for (const [id, label] of sections) {
      const target = [...window.document.querySelectorAll('.ad-rail-group button')].find((button) => button.textContent?.includes(label))
      if (!target) throw new Error(`No se encontró el acceso a la sección ${label}`)
      target.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      await wait(420)
      const heading = window.document.querySelector('.ad-page-head h2')?.textContent || ''
      if (!heading.includes(label)) throw new Error(`La sección ${label} no renderizó su encabezado (encontrado: "${heading}")`)
      const table = window.document.querySelectorAll('.ad-table tbody tr').length
      const empty = window.document.querySelectorAll('.ad-empty').length
      const notes = window.document.querySelectorAll('.ad-note').length
      console.log(`  ✓ ${id.padEnd(9)} encabezado "${heading}" · filas=${table} vacíos=${empty} avisos=${notes}`)

      const row = window.document.querySelector('.ad-table tbody tr')
      if (row && ['services', 'people', 'providers', 'disputes', 'audit'].includes(id)) {
        row.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
        await wait(320)
        const drawer = Boolean(window.document.querySelector('.ad-drawer'))
        if (!drawer) throw new Error(`La sección ${label} no abrió el panel de detalle`)
        const close = window.document.querySelector('.ad-drawer header .ad-icon-button')
        close?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
        await wait(200)
      }
    }

    // Acciones administrativas: abrir modales y validar que no revienten.
    const financeButton = [...window.document.querySelectorAll('.ad-rail-group button')].find((button) => button.textContent?.includes('Finanzas'))
    financeButton?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await wait(400)
    const conciliar = [...window.document.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Conciliar')
    if (conciliar) {
      conciliar.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      await wait(260)
      if (!window.document.querySelector('.ad-modal')) throw new Error('El modal de conciliación Pix no se abrió')
      const cancel = [...window.document.querySelectorAll('.ad-modal button')].find((button) => button.textContent?.includes('Cancelar'))
      cancel?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
      await wait(200)
      console.log('  ✓ finance  modal de conciliación Pix operativo')
    } else {
      realtimeErrors.push('Sin filas de Pix para probar el modal')
    }

    const palette = window.document.querySelector('.ad-rail-search')
    palette?.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    await wait(220)
    if (!window.document.querySelector('.ad-palette')) throw new Error('El buscador de acciones no se abrió')
    console.log('  ✓ palette  buscador de acciones operativo')

    root.unmount()
    await wait(120)

    // jsdom no implementa la ruta IE de React para eventos de input (attachEvent) ni WebSocket real.
    const known = /WebSocket|realtime|ECONNREFUSED|attachEvent/i
    const unexpected = errors.filter((message) => !known.test(String(message)))
    if (unexpected.length > 0) {
      throw new Error(`Errores de runtime: ${unexpected.join(' | ')}`)
    }
    if (realtimeErrors.length > 0) console.log(`  ! ${realtimeErrors.join(' | ')}`)
    console.log('\nSmoke test del panel admin: OK')
    await server.close()
    // El cliente de realtime deja timers vivos: se cierra el proceso explícitamente.
    process.exit(0)
  } finally {
    await server.close()
  }
}

main().catch((error) => {
  console.error('\nSmoke test del panel admin: FALLÓ')
  console.error(error)
  process.exit(1)
})
