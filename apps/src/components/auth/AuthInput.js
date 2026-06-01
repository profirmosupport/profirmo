// AuthInput — labeled input with a Feather icon prefix inside the
// border. Mirrors the web pattern (left-aligned icon, focus ring,
// inline error text below).

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function AuthInput({
  label,
  icon,
  rightAdornment,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoCorrect = false,
  error,
  hint,
  editable = true,
}) {
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.danger
    : focused
      ? colors.primary
      : '#cbd5e1';
  return (
    <View style={styles.wrap}>
      {label || rightAdornment ? (
        <View style={styles.labelRow}>
          {label ? <Text style={styles.label}>{label}</Text> : <View />}
          {rightAdornment}
        </View>
      ) : null}
      <View
        style={[
          styles.field,
          {
            borderColor,
            backgroundColor: editable ? '#ffffff' : colors.surfaceMuted,
          },
        ]}
      >
        {icon ? (
          <Feather
            name={icon}
            size={16}
            color={colors.textMuted}
            style={styles.iconPrefix}
          />
        ) : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          editable={editable}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

// Helper for in-row "Forgot password?" style links.
export function InlineLink({ text, onPress }) {
  return (
    <Pressable onPress={onPress}>
      <Text style={styles.inlineLink}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  iconPrefix: { marginRight: 8 },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: fontSize.base,
    color: colors.textPrimary,
  },
  error: { marginTop: 4, fontSize: fontSize.xs, color: colors.danger },
  hint: { marginTop: 4, fontSize: fontSize.xs, color: colors.textMuted },
  inlineLink: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: colors.primary },
});
