import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';

// Card — white surface with hairline border + subtle shadow. Used as
// the unit container for everything (stats, list rows, profile fields).

export default function Card({ children, style, padded = true }) {
  return (
    <View style={[styles.card, padded && styles.padded, style]}>{children}</View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  padded: { padding: spacing.lg },
});
