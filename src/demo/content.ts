import type { PublicContent } from '@/shared/schemas/content';
import type { InvitationView } from '@/shared/schemas/invitation';
import { DEFAULT_THEME } from '@/shared/theme/theme';

// Fictional couple and guests, kept in sync with supabase/seed.sql. Used by `?i=demo`,
// by the admin's live preview and whenever the app runs without a backend.

export const demoContent: PublicContent = {
  couple: { bride: 'Valeria', groom: 'Mateo', monogram: 'V&M' },
  date: '2027-05-15T15:00:00-05:00',
  timezone: 'America/Lima',
  welcome: {
    text: 'Bienvenidos a un día que marcará nuestra historia. Nos llena de alegría compartir este momento con quienes han sido parte esencial de nuestra vida.',
    quote:
      'Gracias por estar aquí, por celebrar nuestro amor y por seguir siendo parte de nuestro camino.',
  },
  dateIntro: 'Tenemos el honor de invitarte a la ceremonia religiosa que se celebrará el día:',
  music: null,
  photos: { hero: null, divider1: null, divider2: null, divider3: null, closing: null },
  decorations: {},
  family: {
    parents: {
      bride: ['Rosa Díaz Campos', 'Jorge Vega Ruiz'],
      groom: ['Elena Soto Prado', 'Raúl Castro Mena'],
    },
    godparents: ['Lucía Herrera Paz', 'Andrés Molina Ríos'],
    intro: 'Con nuestro amor, la bendición de Dios y la de nuestros padres:',
    godparentsIntro: 'Y en compañía de nuestros padrinos:',
  },
  events: [
    {
      kind: 'ceremony',
      title: 'Ceremonia',
      time: '15:00',
      venue: 'Parroquia Demo',
      address: 'Av. Ejemplo 123, Lima',
      mapsUrl: 'https://maps.google.com/?q=-12.0464,-77.0428',
    },
    {
      kind: 'reception',
      title: 'Recepción',
      time: '16:30',
      venue: 'Casa de Campo Demo',
      address: 'Calle Ficticia 456, Lima',
      mapsUrl: 'https://maps.google.com/?q=-12.1000,-77.0300',
      intro: 'Después de la ceremonia, te invitamos a compartir con nosotros en:',
    },
  ],
  itinerary: [
    { time: '15:00', label: 'Ceremonia religiosa', icon: 'church' },
    { time: '16:30', label: 'Recepción', icon: 'arch' },
    { time: '17:00', label: 'Ingreso de los novios', icon: 'couple' },
    { time: '17:30', label: 'Brindis', icon: 'glasses' },
    { time: '18:00', label: 'Banquete', icon: 'plate' },
    { time: '19:00', label: 'Fiesta', icon: 'confetti' },
  ],
  closingPhrase: 'Y vivirán felices por siempre',
  dressCode: { title: 'Elegante', notes: ['Color blanco reservado para la novia'] },
  gifts: {
    text: 'Tu presencia hace que este día sea inolvidable. Si te nace tener un gesto especial con nosotros, estos son los medios disponibles:',
  },
  rsvp: {
    deadline: '2027-04-15',
    closed: false,
    intro:
      'Tu compañía es muy importante para nosotros. Por favor confírmanos tu presencia con anticipación.',
    menuOptions: ['Carne', 'Pescado', 'Vegetariano', 'Infantil'],
    questions: { transport: false, lodging: false, song: true, parts: false, dni: true },
  },
  album: {
    enabled: true,
    opensAt: '2026-01-01',
    closesAt: '2027-06-15',
    text: 'Los mejores recuerdos son los que se comparten. Sube aquí las fotos que hayas tomado.',
    // The demo API never calls it: uploads only pretend.
    uploadUrl: 'https://script.google.com/macros/s/demo/exec',
  },
  farewell: 'Esperamos contar con su presencia',
  sections: [
    { id: 'envelope', visible: true },
    { id: 'welcome', visible: true, decor: 'left' },
    { id: 'photo', visible: true, photo: 'hero' },
    { id: 'family', visible: true },
    { id: 'date', visible: true },
    { id: 'photo', visible: true, photo: 'divider1' },
    { id: 'events', visible: true, decor: 'right' },
    { id: 'photo', visible: true, photo: 'divider2' },
    { id: 'itinerary', visible: true, decor: 'left' },
    { id: 'closing', visible: true },
    { id: 'gifts', visible: true },
    { id: 'dressCode', visible: true },
    { id: 'photo', visible: true, photo: 'divider3' },
    { id: 'album', visible: true, decor: 'left' },
    { id: 'rsvp', visible: true },
    { id: 'farewell', visible: true },
  ],
  titles: {
    itinerary: 'Itinerario de actividades',
    gifts: 'Gracias',
    dressCode: 'Dress code',
    album: 'Álbum de recuerdos',
    rsvp: 'Confirmar asistencia',
  },
  theme: DEFAULT_THEME,
  customFonts: [],
};

export const demoInvitation: InvitationView = {
  code: 'demo',
  displayName: 'Familia Demo',
  seats: 2,
  rsvpOpen: true,
  albumOpen: true,
  response: null,
  private: {
    gifts: [
      {
        label: 'Banco Demo',
        lines: [
          'Cuenta: 000 000 000 000 00',
          'CCI: 000 000 000 000 000 000 00',
          '(Valeria Vega Díaz)',
        ],
        copy: '00000000000000',
      },
      { label: 'Yape / Plin', lines: ['900 000 000', '(Valeria Vega Díaz)'], copy: '900000000' },
    ],
  },
};
