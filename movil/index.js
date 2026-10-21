// Punto de entrada. TaskManager.defineTask (servicio de ubicacion del encuentro)
// tiene que ejecutarse en el alcance global del bundle, tambien cuando Android
// relanza el proceso en segundo plano y todavia no se dibujo ninguna pantalla.
// expo-router/entry va siempre al final.
import './src/lib/tareaEncuentro'
import 'expo-router/entry'
