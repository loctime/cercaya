import MapView,{Marker} from 'react-native-maps'
import { useCallback,useState } from 'react'
import { useFocusEffect,router } from 'expo-router'
import { Pressable,StyleSheet,View } from 'react-native'
import { MapPinned } from 'lucide-react-native'
import { RequiereLogin } from '../../components/RequiereLogin'
import { Texto,Titulo,Vacio } from '../../components/ui'
import { cargarMapa,type ContactoMapa } from '../../lib/contactos'
import { textoHace } from '../../lib/tiempo'
import { useUbicacion } from '../../lib/ubicacion'
import { colores,espacio } from '../../theme'
export default function Mapa(){const {origen}=useUbicacion();const [items,setItems]=useState<ContactoMapa[]>([]);const cargar=()=>cargarMapa().then(setItems).catch(()=>{});useFocusEffect(useCallback(()=>{cargar()},[]));return <RequiereLogin icono={MapPinned} titulo="Tu mapa de contactos" texto="Entrá para ver ubicaciones aproximadas de tus contactos."><View style={{flex:1}}><MapView style={{flex:1}} initialRegion={{latitude:origen.lat,longitude:origen.lng,latitudeDelta:.04,longitudeDelta:.04}}>{items.map(x=><Marker key={x.user_id} coordinate={{latitude:x.lat,longitude:x.lng}} opacity={x.desactualizada?.55:1} title={x.full_name} description={`Actualizado ${textoHace(x.actualizada_at)}`} onCalloutPress={()=>router.push({pathname:'/persona/[id]',params:{id:x.user_id}})}/>)}</MapView>{!items.length&&<View style={s.vacio}><Vacio icono={MapPinned} titulo="Todavía no hay ubicaciones" texto="Agregá contactos y pediles que activen compartir ubicación."/></View>}<View style={s.nota}><Texto suave>Las ubicaciones son aproximadas.</Texto></View></View></RequiereLogin>}
const s=StyleSheet.create({vacio:{position:'absolute',top:80,left:espacio.l,right:espacio.l,backgroundColor:colores.fondo,borderRadius:16},nota:{position:'absolute',bottom:espacio.l,left:espacio.l,backgroundColor:colores.fondo,padding:10,borderRadius:10}})
