// PhotoUpload — circular avatar uploader. Tap to open the photo
// library, image is uploaded to /api/files/upload immediately, the
// returned URL replaces the placeholder.
//
// Layout: centred avatar with a floating camera badge anchored at the
// bottom-right, so the user-affordance reads the same as Instagram /
// WhatsApp profile editors. A small caption sits below.

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
  return `${API_BASE_URL}${rawUrl}`;
}

export default function PhotoUpload({
  value,
  onChange,
  category = 'profile_photo',
  size = 120,
  label,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handlePick() {
    setError('');
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library permission is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      // expo-image-picker v15+ — MediaTypeOptions is deprecated, use
      // an array of string types. Keeping the old form alive as a
      // fallback so older SDKs still resolve.
      mediaTypes: ImagePicker.MediaType
        ? ['images']
        : ImagePicker.MediaTypeOptions
          ? ImagePicker.MediaTypeOptions.Images
          : ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      selectionLimit: 1,
      // Full-screen editor on iOS so the crop handles + Cancel /
      // Choose buttons aren't clipped by the modal sheet.
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle
        ? ImagePicker.UIImagePickerPresentationStyle.FullScreen
        : undefined,
      // On Android, opt out of the system photo-picker which on
      // Android 14 sometimes skips the in-line crop editor. The
      // legacy picker reliably surfaces crop + rotate.
      legacy: true,
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
  const badgeSize = Math.round(size * 0.32);

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View style={styles.center}>
        <Pressable
          onPress={busy ? undefined : handlePick}
          style={({ pressed }) => [
            styles.avatarBox,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              opacity: pressed ? 0.92 : 1,
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
            <Feather
              name="user"
              size={Math.round(size * 0.42)}
              color={colors.textMuted}
            />
          )}
          {busy ? (
            <View style={[styles.overlay, { borderRadius: size / 2 }]}>
              <ActivityIndicator color={colors.textInverse} />
            </View>
          ) : null}

          {/* Floating camera badge — anchored to the bottom-right so it
              reads as the edit affordance regardless of state. */}
          <View
            style={[
              styles.badge,
              {
                width: badgeSize,
                height: badgeSize,
                borderRadius: badgeSize / 2,
                right: 2,
                bottom: 2,
              },
            ]}
            pointerEvents="none"
          >
            <Feather
              name={resolvedUrl ? 'edit-2' : 'camera'}
              size={Math.round(badgeSize * 0.5)}
              color={colors.textInverse}
            />
          </View>
        </Pressable>

        <Pressable
          onPress={busy ? undefined : handlePick}
          style={({ pressed }) => [
            styles.pickButton,
            { opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Feather
            name={resolvedUrl ? 'refresh-cw' : 'upload'}
            size={13}
            color={colors.primary}
          />
          <Text style={styles.pickText}>
            {resolvedUrl ? 'Replace photo' : 'Upload photo'}
          </Text>
        </Pressable>

        <Text style={styles.hint}>JPG / PNG · square crop recommended.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  center: { alignItems: 'center', gap: 10 },

  avatarBox: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    // Important: the badge needs to escape the rounded clip path of
    // the image but stay inside this Pressable's bounds. Setting
    // overflow:'visible' on the box itself + applying the rounded
    // mask only on the Image element keeps the badge visible.
    overflow: 'visible',
    position: 'relative',
    shadowColor: '#0f172a',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
  image: { resizeMode: 'cover' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    // Subtle drop shadow so the badge clearly floats off the avatar.
    shadowColor: '#0f172a',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 4,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(217,119,6,0.35)',
  },
  pickText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: 0.2,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
  },
  error: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.danger,
  },
});
