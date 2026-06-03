// StarRow — five-star row used in two modes:
//   * display  (interactive=false) → static, supports half-star via
//     a partial fill (rounded to nearest 0.5 — close enough for cards)
//   * picker   (interactive=true, onChange) → tappable stars for the
//     review composer

import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors } from '../../theme';

export default function StarRow({
  value = 0,
  max = 5,
  size = 14,
  interactive = false,
  onChange,
  activeColor = colors.primary,
  inactiveColor = colors.borderStrong,
}) {
  const v = Number(value) || 0;
  return (
    <View style={styles.row}>
      {Array.from({ length: max }, (_, i) => {
        const star = i + 1;
        const filled = v >= star;
        const half = !filled && v >= star - 0.5;
        const color = filled || half ? activeColor : inactiveColor;
        // Half-star: overlay a filled star clipped to 50 % width on
        // top of the outline. Cheap and crisp at any size.
        const Body = (
          <View style={{ position: 'relative' }}>
            <Feather
              name="star"
              size={size}
              color={color}
              style={half ? { opacity: 0.4 } : null}
            />
            {filled || half ? (
              <Feather
                name="star"
                size={size}
                color={activeColor}
                style={[
                  styles.fill,
                  half ? { width: size / 2 } : null,
                ]}
              />
            ) : null}
          </View>
        );
        if (!interactive) {
          return <View key={star}>{Body}</View>;
        }
        return (
          <Pressable
            key={star}
            onPress={() => onChange && onChange(star)}
            hitSlop={4}
          >
            {Body}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = {
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  fill: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'hidden',
  },
};
