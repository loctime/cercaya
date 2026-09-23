-- Borra TODOS los datos de demostracion (usuarios @cercaya.test y, por
-- cascada, sus perfiles, servicios, pedidos, resenas, chats y eventos).
delete from auth.users where email like '%@cercaya.test';
