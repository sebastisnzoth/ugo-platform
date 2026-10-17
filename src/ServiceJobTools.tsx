import { useCallback, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  evidencePublicUrl,
  loadChat,
  loadDisputeReasons,
  loadServiceDispute,
  loadServiceEvidence,
  openServiceDispute,
  sendChatMessage,
  uploadServiceEvidence,
} from './serviceContracts'
import type { ChatMessage, DisputeReason, EvidenceRow, ServiceDispute } from './serviceContracts'

type Props = {
  serviceId: string
  serviceEstado: string
  session: Session
  actor: 'cliente' | 'proveedor'
}

const EVIDENCE_STATES = ['llegado', 'en_progreso', 'esperando_aprobacion']
const DISPUTE_STATES = ['asignado', 'en_camino', 'llegado', 'en_progreso', 'esperando_aprobacion', 'completado', 'disputado']

export default function ServiceJobTools({ serviceId, serviceEstado, session, actor }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [msgText, setMsgText] = useState('')
  const [evidence, setEvidence] = useState<EvidenceRow[]>([])
  const [reasons, setReasons] = useState<DisputeReason[]>([])
  const [dispute, setDispute] = useState<ServiceDispute | null>(null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [disputeOpen, setDisputeOpen] = useState(false)
  const [motivoCodigo, setMotivoCodigo] = useState('')
  const [motivo, setMotivo] = useState('')
  const chatListRef = useRef<HTMLUListElement>(null)

  // Auto-scroll al mensaje más nuevo.
  useEffect(() => {
    const list = chatListRef.current
    if (list) list.scrollTop = list.scrollHeight
  }, [messages])

  const reload = useCallback(() => {
    loadChat(serviceId).then(setMessages).catch(error => setNotice(error instanceof Error ? error.message : 'Error de chat.'))
    loadServiceEvidence(serviceId).then(setEvidence).catch(() => {})
    loadServiceDispute(serviceId).then(setDispute).catch(() => {})
  }, [serviceId])

  useEffect(() => {
    reload()
    loadDisputeReasons(actor).then(setReasons).catch(() => {})
  }, [reload, actor])

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    if (!msgText.trim() || busy) return
    setBusy(true); setNotice('')
    try {
      await sendChatMessage(serviceId, session.user.id, actor, msgText)
      setMsgText('')
      setMessages(await loadChat(serviceId))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No pudimos enviar el mensaje.')
    } finally {
      setBusy(false)
    }
  }

  async function uploadFile(file: File | undefined) {
    if (!file || busy) return
    setBusy(true); setNotice('')
    try {
      await uploadServiceEvidence(serviceId, session.user.id, file)
      setEvidence(await loadServiceEvidence(serviceId))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No pudimos subir la evidencia.')
    } finally {
      setBusy(false)
    }
  }

  async function submitDispute(event: FormEvent) {
    event.preventDefault()
    if (!motivoCodigo || motivo.trim().length < 10 || busy) return
    setBusy(true); setNotice('')
    try {
      await openServiceDispute(serviceId, motivoCodigo, motivo.trim())
      setDispute(await loadServiceDispute(serviceId))
      setDisputeOpen(false); setMotivo(''); setMotivoCodigo('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No pudimos abrir la disputa.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="uxp-service-tools">
    <section className="ux-surface uxp-chat">
      <span className="ux-subtitle">CHAT DEL SERVICIO</span>
      <h2>Conversación</h2>
      <ul className="uxp-chat-list" ref={chatListRef}>{messages.map(message =>
        <li key={message.id} className={message.emisor_id === session.user.id ? 'mine' : ''}>
          <small>{message.emisor_rol === 'cliente' ? 'Cliente' : 'Proveedor'} · {new Date(message.created_at).toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</small>
          <p>{message.contenido}</p>
        </li>)}
        {messages.length === 0 && <li className="uxp-chat-empty">Todavía no hay mensajes. Coordiná los detalles del servicio por acá.</li>}
      </ul>
      <form className="uxp-chat-form" onSubmit={sendMessage}>
        <input value={msgText} maxLength={600} onChange={e => setMsgText(e.target.value)} placeholder="Escribí un mensaje…" aria-label="Mensaje" />
        <button className="ux-primary" disabled={busy || !msgText.trim()}>Enviar</button>
      </form>
    </section>

    {EVIDENCE_STATES.includes(serviceEstado) && <section className="ux-surface">
      <span className="ux-subtitle">EVIDENCIAS</span>
      <h2>Trabajo realizado</h2>
      <p>Fotos o archivos del servicio (se registran contra el servicio real, bucket service-evidence).</p>
      {evidence.length > 0 && <div className="uxp-evidence-grid">{evidence.map(item => {
        const evidenceUrl = evidencePublicUrl(item.storage_path)
        const isImage = /\.(jpe?g|png|webp|gif)$/i.test(item.storage_path)
        return <a key={item.storage_path} className="uxp-evidence-item" href={evidenceUrl} target="_blank" rel="noreferrer">
          {isImage ? <img src={evidenceUrl} alt="Evidencia del servicio" /> : <span>📎</span>}<small>{item.storage_path.split('/').pop()}</small>
        </a>
      })}</div>}
      <label className="uxp-upload">＋ Subir evidencia
        <input type="file" accept="image/*,application/pdf" disabled={busy} onChange={e => { void uploadFile(e.target.files?.[0]); e.target.value = '' }} />
      </label>
    </section>}

    {DISPUTE_STATES.includes(serviceEstado) && <section className="ux-surface">
      <span className="ux-subtitle">DISPUTAS</span>
      <h2>{dispute ? 'Disputa abierta' : '¿Algún problema?'}</h2>
      {dispute
        ? <div className="uxp-dispute-box">
          <strong>{dispute.motivo_codigo ? `${dispute.motivo_codigo} · ` : ''}{dispute.estado}</strong>
          <p>{dispute.motivo}</p>
          {dispute.resolucion && <p className="client-muted">Resolución: {dispute.resolucion} {dispute.resolucion_favor ? `(a favor de ${dispute.resolucion_favor})` : ''}</p>}
        </div>
        : disputeOpen
          ? <form className="uxp-dispute-form" onSubmit={submitDispute}>
            <label>Motivo
              <select value={motivoCodigo} onChange={e => setMotivoCodigo(e.target.value)} required>
                <option value="">Elegir…</option>
                {reasons.map(reason => <option key={reason.codigo} value={reason.codigo}>{reason.etiqueta} ({reason.severidad})</option>)}
              </select>
            </label>
            <label>Detalle
              <textarea value={motivo} rows={3} maxLength={600} onChange={e => setMotivo(e.target.value)} placeholder="Contá qué pasó (mínimo 10 caracteres)" />
            </label>
            <div className="ux-action-group">
              <button type="button" className="ux-secondary" onClick={() => setDisputeOpen(false)}>Cancelar</button>
              <button type="submit" className="ux-primary" disabled={busy || motivo.trim().length < 10}>Abrir disputa</button>
            </div>
          </form>
          : <div>
            <p>Si algo no salió como esperabas, podés abrir una disputa. El equipo de UGO revisa el caso con las reglas oficiales.</p>
            <button className="ux-secondary" onClick={() => setDisputeOpen(true)}>Abrir disputa</button>
          </div>}
    </section>}

    {notice && <div className="ux-alert" role="alert">{notice}<button onClick={() => setNotice('')} aria-label="Cerrar alerta">×</button></div>}
  </div>
}
