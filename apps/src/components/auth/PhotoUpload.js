// PhotoUpload — circular avatar uploader for the signup wizards.
// Mirrors the web's PhotoUpload behaviour: tap to open the photo
// library, image is uploaded to /api/files/upload immediately, the
// returned URL replaces the placeholder. Re-tap replaces the photo.

import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { uploadFile } from '../../services/uploadService';
import { API_BASE_URL } from '../../config/api';
import { colors, fontSize, fontWeight, spacing } from '../../theme';

function fullUrl(rawUrl) {
  if (!rawUrl) return null;
  if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
    return rawUrl;
  }
  // The backend returns relative paths like "/uploads/abc.jpg" — prefix
  // with the API base so Image can fetch them.
  return `${API_BASE_URL}${rawUrl}`;
}

export default function PhotoUpload({
  value,
  onChange,
  category = 'profile_photo',
  size = 96,
  label,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handlePick() {
    setError('');
    // Ask for media-library permission — required on iOS 14+ and
    // Android 13+. expo-image-picker handles caching the grant.
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
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

  const resolvedUrl = fullUrl(value);

  return (
    <View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.row}>
        <Pressable
          onPress={busy ? undefined : handlePick}
          style={({ pressed }) => [
            styles.circle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {resolvedUrl ? (
            <Image
              source={{ uri: resolvedUrl }}
              style={[
                styles.image,
                { width: size, height: size, borderRadius: size / 2 },
              ]}
            />
          ) : (
            <Feather name="user" size={size * 0.4} color={colors.textMuted} />
          )}
          {busy ? (
            <View style={[styles.overlay, { borderRadius: size / 2 }]}>
              <ActivityIndicator color={colors.textInverse} />
            </View>
          ) : null}
        </Pressable>
        <View style={{ flex: 1 }}>
          <Pressable
            onPress={busy ? undefined : handlePick}
            style={({ pressed }) => [
              styles.pickButton,
              { opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Feather name={resolvedUrl ? 'refresh-cw' : 'upload'} size={14} color={colors.primary} />
            <Text style={styles.pickText}>
              {resolvedUrl ? 'Replace photo' : 'Upload photo'}
            </Text>
          </Pressable>
          <Text style={styles.hint}>JPG / PNG · square crop recommended.</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  circle: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { resizeMode: 'cover' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  pickText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  hint: {
    marginTop: 6,
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  error: {
    marginTop: 4,
    fontSize: fontSize.xs,
    color: colors.danger,
  },
});
