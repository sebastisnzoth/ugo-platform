import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import ClientSavedPlaces from './ClientSavedPlaces'

type Profile = {
  telefono: string
  direccion: string
  barrio: string
  ciudad: string
  idioma_preferido: string
  contacto_preferido: string
}
const empty: Profile = { telefono:'',direccion:'',barrio:'',ciudad:'',idioma_preferido:'pt-BR',contacto_preferido:'WhatsApp' }
const fields = [
  ['telefono','Teléfono'],
  ['direccion','Dirección'],
  ['barrio','Barrio'],
  ['ciudad','Ciudad'],
] as const

export default function ClientProfile({ session }: { session: Session | null }) {
  const [profile, setProfile] = useState<Profile>(empty)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const load = useCallback(async () => {
    if (!session) return
    setLoading(true); setNotice('')
    const {data,error} = await supabase.from('perfiles_cliente').select('telefono,direccion,barrio,ciudad,idioma_preferido,contacto_preferido').eq('usuario_id',session.user.id).maybeSingle()
    setLoading(false)
    if(error) { setNotice('No se pudo cargar el perfil: '+error.message);return }
    const record = data as Partial<Profile> | null
    setProfile(Object.fromEntries(Object.entries(empty).map(([key, fallback]) => [key, record?.[key as keyof Profile] ?? fallback])) as Profile)
  },[session])
  useEffect(()=>{void load()},[load])
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(!session||saving)return
    setSaving(true);setNotice('')
    const payload = Object.fromEntries(Object.entries(profile).map(([key,value]) => [key,value.trim()||null]))
    const {error} = await supabase.from('perfiles_cliente').upsert({usuario_id:session.user.id,...payload},{onConflict:'usuario_id'})
    setSaving(false)
    if(error){setNotice('No se pudo guardar el perfil: '+error.message);return}
    setNotice('Perfil guardado en UGO TEST.')
    void load()
  }
  if(!session)return <section className="client-panel"><h1>Mi perfil</h1><p>Ingresá desde la pantalla principal para completar tu perfil.</p><a href="./" className="client-primary client-inline-link">Ingresar</a></section>
  return <section className="client-panel">
    <span className="client-kicker">MI PERFIL</span><h1>Tus datos</h1>
    <p>{session.user.email}</p>
    {loading ? <p role="status">Cargando datos reales...</p> :
      <form onSubmit={save} className="client-profile-form">
        {fields.map(([key,label])=><label key={key}>{label}
          <input value={profile[key]} onChange={e=>setProfile(p=>({...p,[key]:e.target.value}))} maxLength={180}/>
        </label>)}
        <label>Idioma
          <select value={profile.idioma_preferido} onChange={e=>setProfile(p=>({...p,idioma_preferido:e.target.value}))}>
            <option value="pt-BR">Português (Brasil)</option><option value="es">Español</option><option value="en">English</option>
          </select>
        </label>
        <label>Contacto preferido
          <select value={profile.contacto_preferido} onChange={e=>setProfile(p=>({...p,contacto_preferido:e.target.value}))}>
            <option value="WhatsApp">WhatsApp</option><option value="email">Email</option>
          </select>
        </label>
        <button className="client-primary" disabled={saving}>{saving?'Guardando...':'Guardar perfil'}</button>
      </form>}
    {notice && <p role="status">{notice}</p>}
    <ClientSavedPlaces session={session} />
    <button className="client-secondary" onClick={async()=>{const {error}=await supabase.auth.signOut();if(error)setNotice(error.message)}}>Cerrar sesión</button>
  </section>
}
