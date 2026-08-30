-- ============================================
-- Campos opcionales para explicar mejor un ejercicio de entrenamiento:
-- objetivo, puntos clave, variantes, intensidad, organizacion y material.
-- Ninguno es obligatorio -- cada entrenador rellena lo que le sirva.
--
-- Se anaden a las tres tablas que comparten la misma forma de ejercicio
-- (una sesion concreta, la biblioteca reutilizable, y las plantillas),
-- para que copiar un ejercicio entre ellas no pierda estos datos.
--
-- Ejecutar una vez en el SQL Editor de Supabase.
-- ============================================

alter table training_exercises
  add column if not exists objective text,
  add column if not exists key_points text,
  add column if not exists variants text,
  add column if not exists intensity text,
  add column if not exists organization text,
  add column if not exists materials text;

alter table exercise_library
  add column if not exists objective text,
  add column if not exists key_points text,
  add column if not exists variants text,
  add column if not exists intensity text,
  add column if not exists organization text,
  add column if not exists materials text;

alter table session_template_exercises
  add column if not exists objective text,
  add column if not exists key_points text,
  add column if not exists variants text,
  add column if not exists intensity text,
  add column if not exists organization text,
  add column if not exists materials text;
