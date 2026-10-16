import {useEffect,useState} from 'react'
import type {Session} from '@supabase/supabase-js'
import {supabase} from './supabase'
import ClientActivity from '../ClientActivity'
export default function ClientActivityReal(){
 const [session,setSession]=useState<Session|null>(null)
 useEffect(()=>{let active=true;void supabase.auth.getSession().then(({data})=>{if(active)setSession(data.session)})
  const {data}=supabase.auth.onAuthStateChange((_event,next)=>{if(active)setSession(next)})
  return()=>{active=false;data.subscription.unsubscribe()}
 },[])
 return <ClientActivity session={session}/>
}
