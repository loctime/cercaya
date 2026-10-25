-- =====================================================================
-- Catalogo de oficios ampliado. Incluye los 6 que propuso Marcelo
-- (herreria, zingueria, cerrajeria, carpinteria, gasista, refrigeracion) y
-- los oficios mas comunes de una ciudad chica.
--
-- Los sinonimos son lo que la gente escribe de verdad ("me quede afuera" para
-- cerrajero). La busqueda ignora tildes y mayusculas. Para agregar uno mas:
-- una fila en este insert (o en una migracion nueva). Los oficios que la gente
-- escribe a mano se ven con:
--   select label, count(*) from oficios where catalog_id is null group by 1 order by 2 desc;
-- =====================================================================
insert into public.habilidades_catalogo (id, label, tipo, category_id, aliases) values
  -- Propuestos por Marcelo
  ('herrero', 'Herrero', 'oficio', null, array['herreria','soldadura','rejas','portones','porton','porton de hierro','reja','estructura metalica','escalera metalica']),
  ('zinguero', 'Zinguero', 'oficio', null, array['zingueria','canaleta','canaletas','canalon','techos de chapa','chapa','babeta','tapajuntas','desague de techo']),
  ('cerrajero', 'Cerrajero', 'oficio', null, array['cerrajeria','llave','llaves','copia de llave','abrir puerta','me quede afuera','cerradura','cambiar cerradura','cambiar bombin','puerta trabada']),
  ('carpintero', 'Carpintero', 'oficio', null, array['carpinteria','muebles','mueble a medida','madera','placard','puertas','ventanas de madera','cocina a medida','estantes']),
  ('gasista', 'Gasista', 'oficio', null, array['gas','instalacion de gas','calefon','estufa','perdida de gas','olor a gas','termotanque a gas','matriculado gas','cocina a gas']),
  ('refrigeracion', 'Refrigeración y aire', 'oficio', null, array['refrigeracion','aire acondicionado','split','instalar aire','recargar gas del aire','heladera','freezer','camara frigorifica','aire no enfria']),
  -- Construccion y mantenimiento
  ('maestro-mayor-de-obra', 'Maestro mayor de obra', 'oficio', null, array['obra','construccion','presupuesto de obra','casa nueva','ampliacion','direccion de obra','planos']),
  ('techista', 'Techista', 'oficio', null, array['techos','techo','tejas','goteras','gotera','impermeabilizacion','membrana','arreglar techo','techo de chapa','losa']),
  ('durlock', 'Durlock y yesería', 'oficio', null, array['yeso','yeseria','cielorraso','placas de yeso','tabiques','pared de durlock','cielo raso','moldura']),
  ('colocador-pisos', 'Colocación de pisos y revestimientos', 'oficio', null, array['pisos','piso','ceramicos','ceramica','porcelanato','azulejos','revestimiento','piso flotante','colocar ceramicos','zocalos']),
  ('vidriero', 'Vidriero', 'oficio', null, array['vidrieria','vidrios','vidrio roto','espejos','ventanas','aberturas','cortinas de enrollar','mamparas','aluminio']),
  ('soldador', 'Soldador', 'oficio', null, array['soldadura','soldar','soldadura electrica','soldadura de aluminio','caños','estructuras']),
  ('piletero', 'Mantenimiento de piletas', 'oficio', null, array['pileta','piletas','pileta de natacion','limpieza de pileta','agua verde','bomba de pileta','piletero','cloro']),
  ('fumigador', 'Fumigación y control de plagas', 'oficio', null, array['fumigacion','plagas','cucarachas','hormigas','ratas','ratones','desinfeccion','termitas','mosquitos','pulgas']),
  -- Vehiculos y traslados
  ('mecanico', 'Mecánico', 'oficio', null, array['mecanica','auto','autos','taller','auto no arranca','mecanico de autos','frenos','cambio de aceite','service del auto','bateria']),
  ('mecanico-motos', 'Mecánico de motos', 'oficio', null, array['moto','motos','mecanica de motos','taller de motos','service de moto','moto no arranca']),
  ('gomero', 'Gomero', 'oficio', null, array['gomeria','cubiertas','neumaticos','pinchadura','pinchazo','cambiar rueda','auxilio mecanico','auxilio']),
  ('fletes', 'Fletes y mudanzas', 'oficio', null, array['flete','mudanza','mudanzas','camioneta','transporte','llevar muebles','acarreo','camion']),
  -- Hogar y cuidado de personas
  ('ninera', 'Niñera', 'oficio', null, array['ninera','ninero','cuidado de niños','cuidar chicos','babysitter','canguro','cuidar ninos','cuidado de ninos']),
  ('cuidador-mayores', 'Cuidado de adultos mayores', 'oficio', null, array['cuidador','cuidadora','acompañante','acompanante','abuelos','cuidar abuelo','geriatrico','adulto mayor','enfermera']),
  ('enfermero', 'Enfermería', 'oficio', null, array['enfermero','enfermera','inyecciones','curaciones','presion','tomar la presion','suero','cuidados de enfermeria']),
  ('masajista', 'Masajista', 'oficio', null, array['masajes','masaje','kinesiologia','kinesiologo','descontracturante','contractura','reflexologia']),
  ('peluquero', 'Peluquero/a', 'oficio', null, array['peluqueria','corte de pelo','cortar el pelo','tintura','color','alisado','peinado','barbero','barberia']),
  ('manicura', 'Manicura y uñas', 'oficio', null, array['unas','uñas','esmaltado','semipermanente','manicuria','pedicura','unas esculpidas']),
  ('costurera', 'Costura y arreglos de ropa', 'oficio', null, array['costura','arreglos de ropa','dobladillo','modista','coser','arreglar ropa','bastas','cierre roto','sastre']),
  ('tapicero', 'Tapicería', 'oficio', null, array['tapiceria','tapizado','tapizar','sillones','retapizar','sillas','tapizado de autos']),
  -- Tecnologia
  ('tecnico-pc', 'Técnico en computadoras y celulares', 'oficio', null, array['informatica','arreglo de pc','arreglar computadora','reparar celular','formatear','virus','notebook','pantalla de celular','recuperar datos']),
  ('tecnico-electrodomesticos', 'Técnico en electrodomésticos', 'oficio', null, array['electrodomesticos','lavarropas','heladera','microondas','reparar lavarropas','secarropas','horno','termotanque','cocina electrica']),
  ('antenista', 'Antenista y TV', 'oficio', null, array['antena','antenas','television','tv','cable','instalar tv','soporte de tv','decodificador','señal de tv']),
  ('camaras-alarmas', 'Cámaras y alarmas', 'oficio', null, array['camaras','camaras de seguridad','alarma','alarmas','cctv','videoportero','portero electrico','cerco electrico']),
  -- Educacion y servicios
  ('profesor-particular', 'Profesor particular', 'oficio', null, array['clases','clases particulares','apoyo escolar','maestra particular','profesora','idiomas','ingles','matematica','tareas']),
  ('contador', 'Contador/a', 'oficio', null, array['contadora','impuestos','monotributo','afip','balance','liquidacion de sueldos','declaracion jurada','factura']),
  ('fotografo', 'Fotógrafo/a', 'oficio', null, array['fotografia','fotos','video','eventos','casamiento','cumpleaños','book','fotos de producto']),
  ('cocinero', 'Cocinero/a y catering', 'oficio', null, array['comida','viandas','catering','tortas','pasteleria','cocinar','servicio de comida','empanadas','eventos','mesa dulce']),
  ('animador', 'Animador de fiestas', 'oficio', null, array['animacion','cumpleaños infantiles','payaso','fiesta','sonido','dj','inflables','show infantil']),
  ('diseno-grafico', 'Diseño gráfico', 'oficio', null, array['diseño','diseno','logo','logos','flyer','flyers','redes sociales','imprenta','tarjetas','carteles'])
on conflict (id) do nothing;
