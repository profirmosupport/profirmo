// AvatarWithInitials — bulletproof avatar primitive.
//
// Renders initials inside an amber gradient at the BASE layer. If a
// photo URL is supplied AND it loads successfully, the photo overlays
// the initials. If the URL is null, missing, slow, or errors out, the
// initials remain visible — no empty box, no broken-image fallback.
//
// Props:
//   uri         — resolved image URL (string) or null. Already passed
//                 through `imageUrl()` by the caller.
//   name        — display name used to compute initials (e.g. "Vishal
//                 Singh" → "VS"). Falls back to "?" when empty.
//   size        — diameter in pixels. Default 48.
//   square      — when true, uses a small border-radius instead of a
//                 circle (used by firm logos and pro photos in cards
//                 where the original design has rounded squares).
//   initialsSize — override the auto-derived font size for initials.
//   style       — passed through to the outer wrapper.

import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { computeInitials } from '../guest/ProfessionalHorizontalCard';
import { colors, fontWeight } from '../../theme';

export default function AvatarWithInitials({
  uri,
  name,
  size = 48,
  square = false,
  initialsSize,
  initialsColor = colors.textInverse,
  style,
}) {
  // Track image-load failures so a stale/404 URL falls through to the
  // initials without leaving a transparent gap.
  const [failed, setFailed] = useState(false);
  // Reset whenever the URL changes — otherwise switching to a new
  // photo after a previous failure would keep showing initials.
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  const initials = computeInitials(name);
  const radius = square ? Math.round(size / 6) : size / 2;
  const fontSize = initialsSize ?? Math.round(size * 0.38);
  const showPhoto = Boolean(uri) && !failed;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.primarySoft,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={['#fde68a', '#f59e0b']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      <Text
        style={{
          fontSize,
          fontWeight: fontWeight.bold,
          color: initialsColor,
          letterSpacing: 0.5,
        }}
      >
        {initials}
      </Text>
      {showPhoto ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFillObject}
          onError={() => setFailed(true)}
        />
      ) : null}
    </View>
  );
}
