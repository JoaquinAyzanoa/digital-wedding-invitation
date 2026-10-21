-- Demo data for local development (`supabase db reset`). Fictional couple and guests:
-- no real personal data lives in this repo. Not applied to the remote project.

update public.site_content
set public_data = $json$
{
  "couple": { "bride": "Valeria", "groom": "Mateo", "monogram": "V&M" },
  "date": "2027-05-15T15:00:00-05:00",
  "timezone": "America/Lima",
  "welcome": {
    "text": "Bienvenidos a un día que marcará nuestra historia. Nos llena de alegría compartir este momento con quienes han sido parte esencial de nuestra vida.",
    "quote": "Gracias por estar aquí, por celebrar nuestro amor y por seguir siendo parte de nuestro camino."
  },
  "dateIntro": "Tenemos el honor de invitarte a la ceremonia religiosa que se celebrará el día:",
  "music": null,
  "photos": { "hero": null, "divider1": null, "divider2": null, "divider3": null, "closing": null },
  "decorations": {},
  "family": {
    "parents": {
      "bride": ["Rosa Díaz Campos", "Jorge Vega Ruiz"],
      "groom": ["Elena Soto Prado", "Raúl Castro Mena"]
    },
    "godparents": ["Lucía Herrera Paz", "Andrés Molina Ríos"],
    "intro": "Con nuestro amor, la bendición de Dios y la de nuestros padres:",
    "godparentsIntro": "Y en compañía de nuestros padrinos:"
  },
  "events": [
    {
      "kind": "ceremony",
      "title": "Ceremonia",
      "time": "15:00",
      "venue": "Parroquia Demo",
      "address": "Av. Ejemplo 123, Lima",
      "mapsUrl": "https://maps.google.com/?q=-12.0464,-77.0428"
    },
    {
      "kind": "reception",
      "title": "Recepción",
      "time": "16:30",
      "venue": "Casa de Campo Demo",
      "address": "Calle Ficticia 456, Lima",
      "mapsUrl": "https://maps.google.com/?q=-12.1000,-77.0300",
      "intro": "Después de la ceremonia, te invitamos a compartir con nosotros en:"
    }
  ],
  "itinerary": [
    { "time": "15:00", "label": "Ceremonia religiosa", "icon": "church" },
    { "time": "16:30", "label": "Recepción", "icon": "arch" },
    { "time": "17:00", "label": "Ingreso de los novios", "icon": "couple" },
    { "time": "17:30", "label": "Brindis", "icon": "glasses" },
    { "time": "18:00", "label": "Banquete", "icon": "plate" },
    { "time": "19:00", "label": "Fiesta", "icon": "confetti" }
  ],
  "closingPhrase": "Y vivirán felices por siempre",
  "dressCode": {
    "title": "Elegante",
    "notes": ["Color blanco reservado para la novia"],
    "avoidColors": ["#FFFFFF", "#7A1020"]
  },
  "gifts": {
    "text": "Tu presencia hace que este día sea inolvidable. Si te nace tener un gesto especial con nosotros, estos son los medios disponibles:"
  },
  "rsvp": {
    "deadline": "2027-04-15",
    "closed": false,
    "intro": "Tu compañía es muy importante para nosotros. Por favor confírmanos tu presencia con anticipación.",
    "menuOptions": [],
    "questions": { "transport": false, "lodging": false, "song": true, "parts": false, "dni": true, "children": false }
  },
  "album": {
    "enabled": true,
    "opensAt": "2026-01-01",
    "closesAt": "2027-06-15",
    "text": "Los mejores recuerdos son los que se comparten. Sube aquí las fotos que hayas tomado."
  },
  "farewell": "Esperamos contar con su presencia",
  "sections": [
    { "id": "envelope", "visible": true },
    { "id": "welcome", "visible": true, "decor": "left" },
    { "id": "photo", "visible": true, "photo": "hero" },
    { "id": "family", "visible": true },
    { "id": "date", "visible": true },
    { "id": "photo", "visible": true, "photo": "divider1" },
    { "id": "events", "visible": true, "decor": "right" },
    { "id": "photo", "visible": true, "photo": "divider2" },
    { "id": "itinerary", "visible": true, "decor": "left" },
    { "id": "closing", "visible": true },
    { "id": "gifts", "visible": true },
    { "id": "dressCode", "visible": true },
    { "id": "photo", "visible": true, "photo": "divider3" },
    { "id": "album", "visible": true, "decor": "left" },
    { "id": "rsvp", "visible": true },
    { "id": "farewell", "visible": true }
  ],
  "titles": {
    "itinerary": "Itinerario de actividades",
    "gifts": "Gracias",
    "dressCode": "Dress code",
    "album": "Álbum de recuerdos",
    "rsvp": "Confirmar asistencia"
  },
  "theme": {
    "colors": {
      "bg": "#FBFAF7",
      "surface": "#FFF8EE",
      "ink": "#2E2A3A",
      "muted": "#6B6878",
      "primary": "#4F6496",
      "accent": "#C9A46C",
      "line": "#E6E1D8"
    },
    "fonts": {
      "script": { "source": "google", "family": "Mea Culpa" },
      "serif": { "source": "google", "family": "Cormorant Garamond" },
      "sans": { "source": "google", "family": "Jost" }
    }
  },
  "customFonts": []
}
$json$::jsonb,
private_data = $json$
{
  "gifts": [
    {
      "label": "Banco Demo",
      "lines": ["Cuenta: 000 000 000 000 00", "CCI: 000 000 000 000 000 000 00", "(Valeria Vega Díaz)"],
      "copy": "00000000000000"
    },
    {
      "label": "Yape / Plin",
      "lines": ["900 000 000", "(Valeria Vega Díaz)"],
      "copy": "900000000"
    }
  ]
}
$json$::jsonb
where id = 1;

-- Five invitations, one per state: pending, accepted, declined, accepted with a child, opened.
insert into public.invitations
  (id, code, display_name, seats, side, group_name, phone, sent_at, first_opened_at,
   last_opened_at, open_count, attending, attends_ceremony, attends_reception,
   contact_phone, song_request, message, responded_at)
values
  ('00000000-0000-4000-8000-000000000001', 'abc234', 'Familia López', 4, 'bride', 'Familia',
   '900000001', null, null, null, 0, null, null, null, null, null, null, null),
  ('00000000-0000-4000-8000-000000000002', 'def567', 'Ana y Luis', 2, 'groom', 'Amigos',
   '900000002', now() - interval '10 days', now() - interval '9 days', now() - interval '2 days',
   3, true, true, true, '900000002', 'Vivir mi vida', '¡Felicidades a los dos!',
   now() - interval '9 days'),
  ('00000000-0000-4000-8000-000000000003', 'ghj892', 'Carla Méndez', 1, 'both', 'Trabajo',
   '900000003', now() - interval '10 days', now() - interval '8 days', now() - interval '8 days',
   1, false, null, null, null, null, 'Lamento no poder acompañarlos, les deseo lo mejor.',
   now() - interval '8 days'),
  ('00000000-0000-4000-8000-000000000004', 'kmn345', 'Familia Rojas', 4, 'bride', 'Familia',
   '900000004', now() - interval '7 days', now() - interval '6 days', now() - interval '6 days',
   2, true, true, true, '900000004', null, null, now() - interval '6 days'),
  ('00000000-0000-4000-8000-000000000005', 'pqr678', 'Diego Salas', 1, 'groom', 'Universidad',
   '900000005', now() - interval '3 days', now() - interval '1 day', now() - interval '1 day',
   1, null, null, null, null, null, null, null);

insert into public.attendees (invitation_id, position, full_name, kind, age, menu, dietary)
values
  ('00000000-0000-4000-8000-000000000002', 1, 'Ana Torres', 'adult', null, 'Pescado', null),
  ('00000000-0000-4000-8000-000000000002', 2, 'Luis Torres', 'adult', null, 'Carne', null),
  ('00000000-0000-4000-8000-000000000004', 1, 'Marta Rojas', 'adult', null, 'Vegetariano',
   'Intolerancia a la lactosa'),
  ('00000000-0000-4000-8000-000000000004', 2, 'Pedro Rojas', 'adult', null, 'Carne', null),
  ('00000000-0000-4000-8000-000000000004', 3, 'Sofía Rojas', 'child', 6, 'Infantil',
   'Alergia al maní');

-- Local admin user: admin@example.com / admin123456 (local stack only).
insert into auth.users
  (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
   raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
   confirmation_token, email_change, email_change_token_new, recovery_token)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-4000-a000-000000000001',
   'authenticated', 'authenticated', 'admin@example.com',
   extensions.crypt('admin123456', extensions.gen_salt('bf')), now(),
   '{"provider": "email", "providers": ["email"], "role": "admin"}', '{}', now(), now(),
   '', '', '', '');

insert into auth.identities
  (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values
  (gen_random_uuid(), '00000000-0000-4000-a000-000000000001',
   '00000000-0000-4000-a000-000000000001',
   '{"sub": "00000000-0000-4000-a000-000000000001", "email": "admin@example.com", "email_verified": true}',
   'email', now(), now(), now());
