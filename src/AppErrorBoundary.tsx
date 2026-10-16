import { Component, type ErrorInfo, type ReactNode } from 'react'
import { UGO_TEST_REF, UGO_TEST_URL } from './lib/supabaseAdmin'

type Props = { surface: string; children: ReactNode }
type State = { error: Error | null; info: string }

function diagnostico(surface: string, error: Error | null, info: string): string {
  const lines = [
    `UGO · diagnóstico de arranque`,
    `Superficie: ${surface}`,
    `URL: ${window.location.href}`,
    `Ruta: ${window.location.pathname}`,
    `Búsqueda: ${window.location.search}`,
    `UGO TEST: ${UGO_TEST_REF} (${UGO_TEST_URL})`,
    `Idioma/navegador: ${navigator.userAgent}`,
    `Sesión admin en este navegador: ${(() => {
      try {
        return window.localStorage.getItem('ugo-platform-admin-auth') ? 'sí' : 'no'
      } catch {
        return 'almacenamiento bloqueado'
      }
    })()}`,
    ``,
    `Error: ${error ? `${error.name}: ${error.message}` : 'sin error de render'}`,
    error?.stack || '',
    info || '',
  ]
  return lines.join('\n')
}

/**
 * Cualquier excepción de render/conexión se muestra como pantalla de diagnóstico.
 * Sin esto, un error en tiempo de ejecución deja el <div id="root"> vacío (pantalla blanca).
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info: info.componentStack || '' })
    console.error('[UGO] error de arranque', error, info.componentStack)
  }

  private retry = () => {
    this.setState({ error: null, info: '' })
  }

  private hardReload = () => {
    window.location.reload()
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    const text = diagnostico(this.props.surface, error, info)
    const home = window.location.pathname.replace(/\/admin\/?$/i, '/') || '/'

    return (
      <div className="ugo-boot-diagnostic" role="alert">
        <div className="ugo-boot-card">
          <span className="ugo-boot-kicker">UGO · arranque</span>
          <h1>No pudimos dibujar esta pantalla</h1>
          <p>
            El panel siguió funcionando pero la interfaz encontró un error al renderizar. Copiá el diagnóstico si necesitás ayuda y reintentá: no se cambió ningún
            dato de UGO TEST.
          </p>
          <pre className="ugo-boot-error">{`${error.name}: ${error.message}`}</pre>
          <div className="ugo-boot-actions">
            <button type="button" className="ugo-boot-button ugo-boot-primary" onClick={this.retry}>
              Reintentar sin recargar
            </button>
            <button type="button" className="ugo-boot-button" onClick={this.hardReload}>
              Recargar la página
            </button>
            <a className="ugo-boot-button" href={home}>
              Ir a la web UGO
            </a>
            <button
              type="button"
              className="ugo-boot-button"
              onClick={() => {
                void navigator.clipboard?.writeText(text)
              }}
            >
              Copiar diagnóstico
            </button>
          </div>
          <details className="ugo-boot-details">
            <summary>Ver diagnóstico técnico</summary>
            <pre>{text}</pre>
          </details>
        </div>
      </div>
    )
  }
}
