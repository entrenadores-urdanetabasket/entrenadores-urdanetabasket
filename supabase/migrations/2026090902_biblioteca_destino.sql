-- Permite elegir, al guardar un ejercicio en la biblioteca, si se guarda
-- solo en la del equipo, solo en la del club, o en ambas (comportamiento
-- anterior, que sigue siendo el valor por defecto para no romper nada).
alter table exercise_library add column if not exists shared_club boolean not null default true;
