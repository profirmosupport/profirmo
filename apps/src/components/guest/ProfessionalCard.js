// ProfessionalCard — rich row used on the guest landing's featured
// list. Left: round avatar (photo or initials). Right: name +
// designation + city + rating, with the consultation fee as a
// secondary accent block at the far right.

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Card from '../common/Card';
import { imageUrl } from '../../utils/imageUrl';
import { formatRupees } from '../../utils/formatters';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

export default function ProfessionalCard({ pro, onPress }) {
  const photoUrl = imageUrl(pro.profilePhoto);
  const initials = (pro.name || '?').trim().slice(0, 1).toUpperCase();
  const subtitle = pro.designation || pro.professionalType || 'Professional';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
    >
      <Card>
        <View style={styles.row}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.avatar} />
          ) : (
            <LinearGradient
              colors={['#fde68a', '#f59e0b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.initials}>{initials}</Text>
            </LinearGradient>
          )}

          <View style={styles.body}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {pro.name}
              </Text>
              {pro.verified ? (
                <View style={styles.verifiedDot}>
                  <Feather name="check" size={9} color={colors.textInverse} />
                </View>
              ) : null}
            </View>
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
            <View style={styles.metaRow}>
              {pro.city ? (
                <MetaPill icon="map-pin" label={pro.city} />
              ) : null}
              {pro.rating ? (
                <MetaPill icon="star" label={String(pro.rating)} />
              ) : null}
              {pro.yearsOfExperience ? (
                <MetaPill
                  icon="clock"
                  label={`${pro.yearsOfExperience} yr${pro.yearsOfExperience === 1 ? '' : 's'}`}
                />
              ) : null}
            </View>
          </View>

          {pro.consultationFee ? (
            <View style={styles.feeBlock}>
              <Text style={styles.feeAmount}>
                {formatRupees(pro.consultationFee)}
              </Text>
              <Text style={styles.feeUnit}>/ consult</Text>
            </View>
          ) : (
            <Feather
              name="chevron-right"
              size={18}
              color={colors.textMuted}
            />
          )}
        </View>
      </Card>
    </Pressable>
  );
}

function MetaPill({ icon, label }) {
  return (
    <View style={styles.metaPill}>
      <Feather name={icon} size={10} color={colors.textSecondary} />
      <Text style={styles.metaText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  initials: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.primarySoftText,
  },
  body: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: {
    flexShrink: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  verifiedDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  metaRow: { marginTop: 6, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  metaText: { fontSize: 10, color: colors.textSecondary, fontWeight: fontWeight.semibold },
  feeBlock: { alignItems: 'flex-end', marginLeft: spacing.sm },
  feeAmount: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.primary },
  feeUnit: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
});
