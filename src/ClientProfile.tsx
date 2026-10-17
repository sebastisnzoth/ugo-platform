import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import ClientSavedPlaces from './ClientSavedPlaces'
import { changePassword, clientPhotoUrl, uploadClientPhoto } from './clientData'

type Profile = {
  telefono: string
  direccion: string
  barrio: string
  ciudad: string
  idioma_preferido: string
  contacto_preferido: string
  foto_perfil_path: string
}
const empty: Profile = { telefono: '', direccion: '', barrio: '', ciudad: '', idioma_preferido: 'pt-BR', contacto_preferido: 'WhatsApp', foto_perfil_path: '' }
const fields = [
  ['telefono', 'Teléfono'],
  ['direccion', 'Dirección'],
  ['barrio', 'Barrio'],
  ['ciudad', 'Ciudad'],
] as const

export default function ClientProfile({ session }: { session: Session | null }) {
  const [profile, setProfile] = useState<Profile>(empty)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [photoBusy, setPhotoBusy] = useState(false)
  const [avatarVersion, setAvatarVersion] = useState(0)
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true); setNotice('')
    const { data, error } = await supabase.from('perfiles_cliente')
      .select('telefono,direccion,barrio,ciudad,idioma_preferido,contacto_preferido,foto_perfil_path')
      .eq('usuario_id', session.user.id).maybeSingle()
    setLoading(false)
    if (error) { setNotice('No se pudo cargar el perfil: ' + error.message); return }
    const record = data as Partial<Profile> | null
    setProfile(Object.fromEntries(Object.entries(empty).map(([key, fallback]) => [key, record?.[key as keyof Profile] ?? fallback])) as Profile)
    setAvatarVersion(version => version + 1)
  }, [session])
  useEffect(() => { void load() }, [load])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!session || saving) return
    setSaving(true); setNotice('')
    const payload = Object.fromEntries(Object.entries(profile)
      .filter(([key]) => key !== 'foto_perfil_path')
      .map(([key, value]) => [key, value.trim() || null]))
    const { error } = await supabase.from('perfiles_cliente').upsert({ usuario_id: session.user.id, ...payload }, { onConflict: 'usuario_id' })
    setSaving(false)
    if (error) { setNotice('No se pudo guardar el perfil: ' + error.message); return }
    setNotice('Perfil guardado en UGO TEST.')
    void load()
  }

  async function uploadPhoto(file: File | undefined) {
    if (!session || !file || photoBusy) return
    setPhotoBusy(true); setNotice('')
    try {
      await uploadClientPhoto(session.user.id, file)
      setNotice('Foto de perfil actualizada.')
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No pudimos subir la foto.')
    } finally {
      setPhotoBusy(false)
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (passwordBusy) return
    if (newPassword !== repeatPassword) { setNotice('Las contraseñas no coinciden.'); return }
    setPasswordBusy(true); setNotice('')
    try {
      await changePassword(newPassword)
      setNotice('Contraseña actualizada correctamente.')
      setNewPassword(''); setRepeatPassword('')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No pudimos actualizar la contraseña.')
    } finally {
      setPasswordBusy(false)
    }
  }

  const avatarUrl = clientPhotoUrl(profile.foto_perfil_path || null) + (profile.foto_perfil_path ? `?v=${avatarVersion}` : '')

  if (!session) return <section className="client-panel"><h1>Mi perfil</h1><p>Ingresá desde la pantalla principal para completar tu perfil.</p><a href="./" className="client-primary client-inline-link">Ingresar</a></section>
  return <section className="client-panel">
    <span className="client-kicker">MI PERFIL</span><h1>Tus datos</h1>
    <div className="uxp-photo-card">
      {profile.foto_perfil_path
        ? <img className="uxp-avatar-lg" src={avatarUrl} alt="Foto de perfil" />
        : <span className="uxp-avatar-lg uxp-avatar-placeholder">◉</span>}
      <div>
        <strong>{session.user.email}</strong>
        <p>Tu foto la ven los profesionales de tus servicios.</p>
        <label className="uxp-upload">{photoBusy ? 'Subiendo…' : '📷 Cambiar foto'}
          <input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={e => { void uploadPhoto(e.target.files?.[0]); e.target.value = '' }} />
        </label>
      </div>
    </div>
    {loading ? <p role="status">Cargando datos reales...</p> :
      <form onSubmit={save} className="client-profile-form">
        {fields.map(([key, label]) => <label key={key}>{label}
          <input value={profile[key]} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} maxLength={180} />
        </label>)}
        <label>Idioma
          <select value={profile.idioma_preferido} onChange={e => setProfile(p => ({ ...p, idioma_preferido: e.target.value }))}>
            <option value="pt-BR">Português (Brasil)</option><option value="es">Español</option><option value="en">English</option>
          </select>
        </label>
        <label>Contacto preferido
          <select value={profile.contacto_preferido} onChange={e => setProfile(p => ({ ...p, contacto_preferido: e.target.value }))}>
            <option value="WhatsApp">WhatsApp</option><option value="email">Email</option>
          </select>
        </label>
        <button className="client-primary" disabled={saving}>{saving ? 'Guardando...' : 'Guardar perfil'}</button>
      </form>}
    {notice && <p role="status">{notice}</p>}
    <ClientSavedPlaces session={session} />
    <div className="uxp-categories">
      <h2>Seguridad</h2>
      <p>Cambiá tu contraseña de acceso.</p>
      <form className="client-profile-form" onSubmit={submitPassword}>
        <label>Nueva contraseña
          <input type="password" minLength={8} autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 8 caracteres" />
        </label>
        <label>Repetir contraseña
          <input type="password" minLength={8} autoComplete="new-password" value={repeatPassword} onChange={e => setRepeatPassword(e.target.value)} />
        </label>
        <button className="client-secondary" disabled={passwordBusy || newPassword.length < 8}>{passwordBusy ? 'Guardando...' : 'Actualizar contraseña'}</button>
      </form>
    </div>
    <button className="client-secondary" onClick={async () => {
      const { error } = await supabase.auth.signOut()
      if (error) { setNotice(error.message); return }
      window.location.assign('./')
    }}>Cerrar sesión</button>
  </section>
}
