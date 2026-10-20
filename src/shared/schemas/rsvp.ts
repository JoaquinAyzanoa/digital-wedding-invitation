import { z } from 'zod';
import type { PublicContent } from './content';
import type { InvitationView, RsvpInput } from './invitation';

// Same rules as submit_rsvp on the server (which validates again): the form shows the
// errors first. Also used by the admin to load an RSVP on a guest's behalf.

export interface RsvpRules {
  seats: number;
  menuOptions: string[];
  questions: PublicContent['rsvp']['questions'];
  /** The admin may leave a DNI empty (e.g. an answer taken by phone). */
  dniOptional?: boolean;
}

const PHONE = /^[0-9+() -]{6,30}$/;
const DNI = /^[0-9]{8}$/;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The DNI was given before for this same person: an empty field keeps it. */
export function keepsSavedDni(attendee: AttendeeValues): boolean {
  return Boolean(
    attendee.savedDniHint && attendee.savedName && sameName(attendee.fullName, attendee.savedName),
  );
}

function attendeeSchema(
  menuOptions: string[],
  askDni: boolean,
  dniOptional: boolean,
  children: boolean,
) {
  return z
    .object({
      fullName: z
        .string()
        .trim()
        .min(1, 'Escribe el nombre completo')
        .max(120, 'Máximo 120 caracteres'),
      kind: z.enum(['adult', 'child']),
      age: z.number().int().min(0).max(17).nullable(),
      menu: z.string(),
      dietary: z.string().trim().max(300, 'Máximo 300 caracteres'),
      dni: z.string(),
      savedDniHint: z.string().nullable(),
      savedName: z.string().nullable(),
    })
    .superRefine((attendee, ctx) => {
      if (askDni) {
        const dni = attendee.dni.trim();
        if (dni && !DNI.test(dni)) {
          ctx.addIssue({ code: 'custom', path: ['dni'], message: 'El DNI tiene 8 números' });
        } else if (!dni && !dniOptional && !keepsSavedDni(attendee)) {
          ctx.addIssue({ code: 'custom', path: ['dni'], message: 'Escribe el DNI' });
        }
      }
      if (children && attendee.kind === 'child' && attendee.age === null) {
        ctx.addIssue({ code: 'custom', path: ['age'], message: 'Indica la edad' });
      }
      if (menuOptions.length > 0 && !menuOptions.includes(attendee.menu)) {
        ctx.addIssue({ code: 'custom', path: ['menu'], message: 'Elige un menú' });
      }
    });
}

const contactPhone = z
  .string()
  .trim()
  .refine((v) => v === '' || PHONE.test(v), 'Escribe un teléfono válido, solo números');
const message = z.string().trim().max(1000, 'Máximo 1000 caracteres');

/** Validates the form values for one invitation. */
export function rsvpFormSchema({ seats, menuOptions, questions, dniOptional = false }: RsvpRules) {
  const attending = z
    .object({
      attending: z.literal(true),
      attendees: z
        .array(attendeeSchema(menuOptions, questions.dni, dniOptional, questions.children))
        .min(1, 'Agrega al menos una persona')
        .max(seats, `Solo hay ${seats} ${seats === 1 ? 'lugar' : 'lugares'} reservados`),
      parts: z.object({ ceremony: z.boolean(), reception: z.boolean() }),
      needsTransport: z.boolean().nullable(),
      needsLodging: z.boolean().nullable(),
      contactPhone,
      songRequest: z.string().trim().max(200, 'Máximo 200 caracteres'),
      message,
    })
    .superRefine((values, ctx) => {
      if (questions.dni) {
        const seen = new Set<string>();
        values.attendees.forEach((attendee, index) => {
          const dni = attendee.dni.trim();
          if (!dni) return;
          if (seen.has(dni)) {
            ctx.addIssue({
              code: 'custom',
              path: ['attendees', index, 'dni'],
              message: 'Este DNI ya está en otra persona',
            });
          }
          seen.add(dni);
        });
      }
      if (questions.parts && !values.parts.ceremony && !values.parts.reception) {
        ctx.addIssue({ code: 'custom', path: ['parts'], message: 'Elige al menos una' });
      }
      if (questions.transport && values.needsTransport === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['needsTransport'],
          message: 'Responde esta pregunta',
        });
      }
      if (questions.lodging && values.needsLodging === null) {
        ctx.addIssue({ code: 'custom', path: ['needsLodging'], message: 'Responde esta pregunta' });
      }
    });

  // Declining only shows the message: anything typed on the attendee step (cards, phone)
  // is ignored, or a guest who went back and chose "no" could be blocked by a field
  // they can no longer see.
  const declining = z.object({ attending: z.literal(false), message });

  return z.discriminatedUnion('attending', [attending, declining], {
    error: 'Elige una opción',
  });
}

export type AttendeeValues = {
  fullName: string;
  kind: 'adult' | 'child';
  age: number | null;
  menu: string;
  dietary: string;
  /** What is typed (the admin sees the whole DNI here; guests start empty). */
  dni: string;
  /** Guests changing their answer: the last 3 digits of the DNI already given… */
  savedDniHint: string | null;
  /** …and the name it was given for. */
  savedName: string | null;
};

/** What the form edits (looser than the schema: `attending` starts unanswered). */
export interface RsvpFormValues {
  attending: boolean | null;
  attendees: AttendeeValues[];
  parts: { ceremony: boolean; reception: boolean };
  needsTransport: boolean | null;
  needsLodging: boolean | null;
  contactPhone: string;
  songRequest: string;
  message: string;
}

export function emptyAttendee(fullName = ''): AttendeeValues {
  return {
    fullName,
    kind: 'adult',
    age: null,
    menu: '',
    dietary: '',
    dni: '',
    savedDniHint: null,
    savedName: null,
  };
}

/** Initial values: the previous answer when changing it, otherwise a blank form. */
export function rsvpDefaults(
  invitation: Pick<InvitationView, 'displayName' | 'seats' | 'response'>,
): RsvpFormValues {
  const response = invitation.response;
  if (!response) {
    return {
      attending: null,
      // An individual invitation is usually one person: prefill their name.
      attendees: [emptyAttendee(invitation.seats === 1 ? invitation.displayName : '')],
      parts: { ceremony: true, reception: true },
      needsTransport: null,
      needsLodging: null,
      contactPhone: '',
      songRequest: '',
      message: '',
    };
  }
  return {
    attending: response.attending,
    attendees:
      response.attendees.length > 0
        ? response.attendees.map((a) => ({
            fullName: a.fullName,
            kind: a.kind,
            age: a.age,
            menu: a.menu ?? '',
            dietary: a.dietary ?? '',
            dni: a.dni ?? '',
            savedDniHint: a.dniHint ?? null,
            savedName: a.fullName,
          }))
        : [emptyAttendee(invitation.seats === 1 ? invitation.displayName : '')],
    parts: {
      ceremony: response.parts.ceremony ?? true,
      reception: response.parts.reception ?? true,
    },
    needsTransport: response.needsTransport,
    needsLodging: response.needsLodging,
    contactPhone: response.contactPhone ?? '',
    songRequest: response.songRequest ?? '',
    message: response.message ?? '',
  };
}

/** The payload for submit_rsvp, keeping only what the enabled questions ask for. */
export function toRsvpInput(values: RsvpFormValues, questions: RsvpRules['questions']): RsvpInput {
  const phone = values.contactPhone.trim();
  const common = {
    // Not validated when declining (that step does not show it): send it only if valid.
    contactPhone: PHONE.test(phone) ? phone : null,
    message: values.message.trim() || null,
  };
  if (!values.attending) return { attending: false, attendees: [], ...common };

  return {
    attending: true,
    attendees: values.attendees.map((a) => ({
      fullName: a.fullName.trim(),
      // Without children at the wedding everyone is an adult.
      kind: questions.children ? a.kind : 'adult',
      age: questions.children && a.kind === 'child' ? a.age : null,
      menu: a.menu || null,
      dietary: a.dietary.trim() || null,
      // Empty: keeps the DNI already given for the same name (or none, for the admin).
      dni: questions.dni ? a.dni.trim() || null : null,
    })),
    ...(questions.parts ? { parts: values.parts } : {}),
    needsTransport: questions.transport ? values.needsTransport : null,
    needsLodging: questions.lodging ? values.needsLodging : null,
    songRequest: questions.song ? values.songRequest.trim() || null : null,
    ...common,
  };
}
