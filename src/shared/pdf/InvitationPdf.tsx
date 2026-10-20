import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { PublicContent } from '@/shared/schemas/content';
import { datePartsInLima } from '@/shared/utils/date';
import { formatTime12 } from '@/shared/utils/time';

export interface PdfFonts {
  script: string;
  serif: string;
  sans: string;
}

export interface InvitationPdfProps {
  content: PublicContent;
  guest: { displayName: string; seats: number } | null;
  link: string;
  qr: string;
  fonts: PdfFonts;
  /** Flowers already converted to PNG (the PDF engine reads PNG and JPG only). */
  decorations: { top?: string; bottom?: string };
}

/** One phone-shaped page (540 × 960 pt), the same on every device. */
export function InvitationPdf({
  content,
  guest,
  link,
  qr,
  fonts,
  decorations,
}: InvitationPdfProps) {
  const { colors } = content.theme;
  const { day, month, year } = datePartsInLima(content.date);
  const { bride, groom } = content.couple;
  const styles = StyleSheet.create({
    page: {
      position: 'relative',
      paddingTop: 96,
      paddingHorizontal: 48,
      backgroundColor: colors.bg,
      color: colors.ink,
      fontFamily: fonts.serif,
      textAlign: 'center',
    },
    flowersTop: { position: 'absolute', top: 0, right: 0, width: 250 },
    flowersBottom: { position: 'absolute', bottom: 0, left: 0, width: 250 },
    kicker: { fontSize: 17, letterSpacing: 1.5, textTransform: 'uppercase' },
    names: {
      marginTop: 8,
      fontFamily: fonts.script,
      fontSize: bride.length + groom.length > 18 ? 46 : 58,
      color: colors.primary,
      lineHeight: 1.25,
    },
    date: { marginTop: 6, fontSize: 17, letterSpacing: 3, textTransform: 'uppercase' },
    rule: {
      width: 80,
      height: 1,
      marginTop: 22,
      marginBottom: 22,
      marginHorizontal: 'auto',
      backgroundColor: colors.accent,
    },
    guest: { fontSize: 19, fontStyle: 'italic' },
    reserved: { marginTop: 6, fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase' },
    seatsBox: {
      width: 52,
      height: 52,
      marginTop: 8,
      marginBottom: 8,
      marginHorizontal: 'auto',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 10,
    },
    seats: { fontSize: 30, color: colors.primary },
    events: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
    event: { width: 210, paddingHorizontal: 8 },
    eventTitle: { fontFamily: fonts.script, fontSize: 30, color: colors.ink, lineHeight: 1.3 },
    eventText: { fontSize: 12.5, lineHeight: 1.45 },
    venue: { fontSize: 11.5, letterSpacing: 0.6, textTransform: 'uppercase', lineHeight: 1.45 },
    qrBlock: { marginTop: 26, alignItems: 'center' },
    qr: { width: 112, height: 112, padding: 6, backgroundColor: '#FFFFFF', borderRadius: 6 },
    qrText: { marginTop: 8, fontSize: 12 },
    link: { marginTop: 2, fontFamily: fonts.sans, fontSize: 9, color: colors.muted },
  });

  return (
    <Document
      title={`Invitación · ${bride} & ${groom}`}
      author={`${bride} & ${groom}`}
      language="es"
    >
      <Page size={[540, 960]} style={styles.page}>
        {decorations.top && <Image src={decorations.top} style={styles.flowersTop} fixed />}
        {decorations.bottom && (
          <Image src={decorations.bottom} style={styles.flowersBottom} fixed />
        )}

        <Text style={styles.kicker}>¡Nos casamos!</Text>
        <Text style={styles.names}>
          {bride} & {groom}
        </Text>
        <Text style={styles.date}>
          {day} · {month} · {year}
        </Text>

        <View style={styles.rule} />

        {guest && (
          <View>
            <Text style={styles.guest}>{guest.displayName}</Text>
            <Text style={styles.reserved}>Hemos reservado</Text>
            <View style={styles.seatsBox}>
              <Text style={styles.seats}>{guest.seats}</Text>
            </View>
            <Text style={styles.reserved}>
              {guest.seats === 1 ? 'lugar en su honor' : 'lugares en su honor'}
            </Text>
            <View style={styles.rule} />
          </View>
        )}

        <View style={styles.events}>
          {content.events.map((event, i) => (
            <View key={i} style={styles.event}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text style={styles.eventText}>{formatTime12(event.time)}</Text>
              <Text style={styles.venue}>{event.venue}</Text>
              {event.address && <Text style={styles.eventText}>{event.address}</Text>}
            </View>
          ))}
        </View>

        <View style={styles.qrBlock}>
          <Image src={qr} style={styles.qr} />
          <Text style={styles.qrText}>Escanea o abre tu link para confirmar</Text>
          <Text style={styles.link}>{link.replace(/^https?:\/\//, '')}</Text>
        </View>
      </Page>
    </Document>
  );
}
