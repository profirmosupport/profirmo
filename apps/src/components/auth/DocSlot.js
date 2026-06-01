// DocSlot — single document upload row used on the professional
// signup wizard's Documents step. Reuses expo-image-picker (covers
// "scan/photo of certificate"); we keep image-only uploads so the
// component stays inside Expo Go's stock SDK — pure PDF uploads can
// be added later by also installing expo-document-picker.

import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { uploadFile } from '../../services/uploadService';
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme';

export default function DocSlot({
  label,
  hint,
  value,
  onChange,
  category = 'certification',
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick() {
    setError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.85,
    });
    if (result.canceled) return;
    const asset = result.assets && result.assets[0];
    if (!asset || !asset.uri) return;
    setBusy(true);
    try {
      const uploaded = await uploadFile({
        uri: asset.uri,
        category,
        name: asset.fileName,
        type: asset.mimeType,
      });
      if (uploaded && uploaded.url) onChange(uploaded.url);
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  const uploaded = Boolean(value);

  return (
    <Pressable
      onPress={busy ? undefined : pick}
      style={({ pressed }) => [
        styles.row,
        uploaded && styles.rowDone,
        { opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View
        style={[
          styles.icon,
          { backgroundColor: uploaded ? colors.successSoft : colors.surfaceMuted },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.textSecondary} />
        ) : uploaded ? (
          <Feather name="check" size={18} color={colors.success} />
        ) : (
          <Feather name="upload" size={18} color={colors.textSecondary} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>
          {uploaded ? 'Uploaded — tap to replace' : hint || 'Optional · tap to upload'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <Feather
        name={uploaded ? 'refresh-cw' : 'chevron-right'}
        size={16}
        color={colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  rowDone: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.textPrimary },
  hint: { marginTop: 2, fontSize: fontSize.xs, color: colors.textSecondary },
  error: { marginTop: 4, fontSize: fontSize.xs, color: colors.danger },
});
