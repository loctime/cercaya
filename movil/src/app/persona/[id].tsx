import { useLocalSearchParams } from 'expo-router'
import { useEffect,useState } from 'react'
import { Alert,ScrollView,View } from 'react-native'
import { UserRound } from 'lucide-react-native'
import { Avatar } from '../../components/Avatar'
import { Boton,Texto,Titulo } from '../../components/ui'
import { RequiereLogin } from '../../components/RequiereLogin'
import { supabase } from '../../lib/supabase'
import { solicitar,quitar } from '../../lib/contactos'
type Perfil={user_id:string;full_name:string;avatar_url:string|null;zone_label:string|null;estado:string|null}
// @ts-expect-error Supabase infers RPC output as unknown without generated database types.
export default function Persona(){const {id}=useLocalSearchParams<{id:string}>();const [p,setP]=useState<Perfil|null>(null);const [cv,setCv]=useState<any[]>([]);const cargar=async()=>{const {data}=await supabase.rpc('perfil_social',{p_user:id}).single();setP(data);const {data:items}=await supabase.from('cv_entries').select('*').eq('user_id',id).order('desde_anio',{ascending:false});setCv(items??[])};useEffect(()=>{cargar()},[id]);return <RequiereLogin icono={UserRound} titulo="Perfil" texto="Entrá para ver perfiles de contactos."><ScrollView contentContainerStyle={{padding:20,gap:16}}>{p&&<><View style={{flexDirection:'row',gap:14,alignItems:'center'}}><Avatar nombre={p.full_name} url={p.avatar_url} tam={64}/><View><Titulo>{p.full_name}</Titulo>{p.zone_label&&<Texto suave>{p.zone_label}</Texto>}</View></View>{p.estado==='aceptado'?<Boton variante="secundario" onPress={async()=>{await quitar(id);cargar()}}>Quitar contacto</Boton>:<Boton onPress={async()=>{try{await solicitar(id);cargar()}catch(e:any){Alert.alert('No se pudo agregar',e.message)}}}>{p.estado?'Solicitud pendiente':'Agregar contacto'}</Boton>}<Titulo nivel={2}>Currículum</Titulo>{cv.length?cv.map(x=><View key={x.id}><Texto fuerte>{x.titulo}</Texto><Texto suave>{x.desde_anio} {x.hasta_anio?`– ${x.hasta_anio}`:''}</Texto>{x.descripcion&&<Texto>{x.descripcion}</Texto>}</View>):<Texto suave>El currículum se ve cuando ambos son contactos.</Texto>}</>}</ScrollView></RequiereLogin>}
