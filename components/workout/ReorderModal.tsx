/**
 * ReorderModal
 * Drag-to-reorder exercises within an active session.
 *
 * Uses react-native-gesture-handler + react-native-reanimated so gestures work
 * correctly in an Expo Router app (which wraps the tree in GestureHandlerRootView).
 *
 * Per-item:
 *   - Gesture.Pan() handles the drag natively on the UI thread.
 *   - translateY SharedValue drives smooth visual movement.
 *   - runOnJS(handleSwap) updates React state when the threshold is crossed.
 *   - indexSV (SharedValue per item) stays in sync with the JS-side index so
 *     subsequent worklet onUpdate calls always compute against the current slot.
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  StatusBar,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import type { SessionExercisePlan } from '@/services/storage/session-storage';
import { useThemeCustomization } from '@/contexts/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const ITEM_HEIGHT = 72;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PaletteType {
  bg: string; cardBg: string; cardBorder: string;
  text: string; textMuted: string; handleColor: string;
  accent: string; accentGlow: string;
}

// ─── DragItem ─────────────────────────────────────────────────────────────────

interface DragItemProps {
  item: SessionExercisePlan;
  index: number;
  total: number;
  isDragged: boolean;
  onDragStart: () => void;
  onSwap: (from: number, to: number) => void;
  onDragEnd: () => void;
  palette: PaletteType;
}

const DragItem = React.memo(function DragItem({
  item,
  index,
  total,
  isDragged,
  onDragStart,
  onSwap,
  onDragEnd,
  palette,
}: DragItemProps) {
  const translateY = useSharedValue(0);
  // Anchor for translationY at the last swap. Local to this row: only one row
  // is dragged at a time, and onBegin resets it on the UI thread.
  const lastSwapTY = useSharedValue(0);

  // SharedValue mirrors so worklets see the latest slot without waiting on React.
  // Updated during render: writing them inside an effect freezes the value for
  // the React compiler and then flags the gesture mutations.
  const indexSV = useSharedValue(index);
  const totalSV = useSharedValue(total);
  const [wasDragged, setWasDragged] = useState(isDragged);

  if (indexSV.value !== index) {
    indexSV.value = index;
  }
  if (totalSV.value !== total) {
    totalSV.value = total;
  }
  if (isDragged !== wasDragged) {
    setWasDragged(isDragged);
    if (!isDragged) {
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
    }
  }

  const pan = useMemo(() => Gesture.Pan()
    .onBegin(() => {
      translateY.value = 0;
      lastSwapTY.value = 0;
      runOnJS(onDragStart)();
    })
    .onUpdate((e) => {
      const relY = e.translationY - lastSwapTY.value;
      translateY.value = relY;

      const steps = Math.round(relY / ITEM_HEIGHT);
      const toIdx = Math.max(0, Math.min(totalSV.value - 1, indexSV.value + steps));

      if (toIdx !== indexSV.value) {
        const from = indexSV.value;
        // Update immediately so the next onUpdate uses the new slot
        indexSV.value = toIdx;
        lastSwapTY.value = e.translationY;
        translateY.value = 0;
        runOnJS(onSwap)(from, toIdx);
      }
    })
    .onEnd(() => {
      translateY.value = withSpring(0, { damping: 20, stiffness: 300 });
      runOnJS(onDragEnd)();
    })
    .onFinalize(() => {
      translateY.value = 0;
      runOnJS(onDragEnd)();
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  []);
  // ^ Stable gesture object. Reanimated 4 updates worklet closures for
  //   SharedValues (lastSwapTY, indexSV, totalSV, translateY) automatically.
  //   JS callbacks (onDragStart, onSwap, onDragEnd) go through runOnJS which
  //   always uses the latest function reference at call time.

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: isDragged ? 10 : 1,
    shadowOpacity: isDragged ? 0.2 : 0,
    elevation: isDragged ? 8 : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[
          styles.item,
          {
            backgroundColor: isDragged ? palette.accentGlow : palette.cardBg,
            borderColor: isDragged ? palette.accent : palette.cardBorder,
            shadowColor: '#000',
            shadowRadius: isDragged ? 10 : 0,
            shadowOffset: { width: 0, height: 5 },
          },
          animatedStyle,
        ]}
      >
        {/* Drag handle affordance — no extra gesture needed; the whole item drags */}
        <View style={[styles.handle, { pointerEvents: 'none' }]}>
          <Ionicons
            name="reorder-three-outline"
            size={28}
            color={isDragged ? palette.accent : palette.handleColor}
          />
        </View>
        <View style={styles.itemContent}>
          <Text style={[styles.itemNumber, { color: palette.textMuted }]}>
            {index + 1}
          </Text>
          <Text style={[styles.itemName, { color: palette.text }]} numberOfLines={1}>
            {item.exerciseName}
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
});

// ─── ReorderModal ─────────────────────────────────────────────────────────────

interface Props {
  visible: boolean;
  exercises: SessionExercisePlan[];
  onClose: () => void;
  onSave: (newOrder: SessionExercisePlan[]) => void;
}

export default function ReorderModal({ visible, exercises, onClose, onSave }: Props) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { customColors } = useThemeCustomization();

  const accent = customColors.primaryButton;
  const rgb = {
    r: parseInt(accent.slice(1, 3), 16),
    g: parseInt(accent.slice(3, 5), 16),
    b: parseInt(accent.slice(5, 7), 16),
  };

  const palette: PaletteType = {
    bg: isDark ? '#0A0A0B' : '#FAFAF9',
    cardBg: isDark ? '#141416' : '#FFFFFF',
    cardBorder: isDark ? '#2A2A2E' : '#E8E8E6',
    text: isDark ? '#FAFAFA' : '#0A0A0B',
    textMuted: isDark ? '#71717A' : '#71717A',
    handleColor: isDark ? '#52525B' : '#A1A1AA',
    accent,
    accentGlow: `rgba(${rgb.r},${rgb.g},${rgb.b},0.12)`,
  };

  const [order, setOrder] = useState<SessionExercisePlan[]>(exercises);
  const orderRef = useRef(order);
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [seen, setSeen] = useState({ visible, exercises });

  if (visible !== seen.visible || (visible && exercises !== seen.exercises)) {
    setSeen({ visible, exercises });
    if (visible) {
      setOrder(exercises);
      setActiveKey(null);
    }
  }

  const handleDragStart = useCallback((key: string) => {
    setActiveKey(key);
  }, []);

  const handleSwap = useCallback((from: number, to: number) => {
    LayoutAnimation.configureNext({
      duration: 150,
      update: { type: LayoutAnimation.Types.easeInEaseOut },
    });
    const newOrder = [...orderRef.current];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    orderRef.current = newOrder;
    setOrder(newOrder);
  }, []);

  const handleDragEnd = useCallback(() => {
    setActiveKey(null);
  }, []);

  const handleSave = () => {
    setActiveKey(null);
    onSave(orderRef.current);
  };

  const handleClose = () => {
    setActiveKey(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
      <SafeAreaView style={[styles.container, { backgroundColor: palette.bg }]} edges={['top', 'bottom']}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

        {/* Header */}
        <View style={[styles.header, { borderBottomColor: palette.cardBorder }]}>
          <TouchableOpacity
            onPress={handleClose}
            style={[styles.headerButton, { backgroundColor: isDark ? '#1F1F23' : '#F4F4F5' }]}
          >
            <Text style={[styles.headerButtonText, { color: palette.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerLabel, { color: palette.textMuted }]}>REORDER</Text>
            <Text style={[styles.headerTitle, { color: palette.text }]}>Exercises</Text>
          </View>
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.headerButton, { backgroundColor: `rgba(${rgb.r},${rgb.g},${rgb.b},0.1)` }]}
          >
            <Text style={[styles.headerButtonText, { color: accent }]}>Done</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.hint}>
          <Ionicons name="information-circle-outline" size={15} color={palette.textMuted} />
          <Text style={[styles.hintText, { color: palette.textMuted }]}>
            Drag any exercise to reorder
          </Text>
        </View>

        {/* List */}
        <View style={styles.list}>
          {order.map((item, index) => (
            <DragItem
              key={item.exerciseId}
              item={item}
              index={index}
              total={order.length}
              isDragged={activeKey === item.exerciseId}
              onDragStart={() => handleDragStart(item.exerciseId)}
              onSwap={handleSwap}
              onDragEnd={handleDragEnd}
              palette={palette}
            />
          ))}
        </View>
      </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gestureRoot: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerCenter: { alignItems: 'center' },
  headerLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 1 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 70,
    alignItems: 'center',
  },
  headerButtonText: { fontSize: 15, fontWeight: '600' },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  hintText: { fontSize: 13 },
  list: {
    paddingHorizontal: 16,
    paddingTop: 4,
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    paddingRight: 16,
    overflow: 'visible',
  },
  handle: {
    width: 56,
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemNumber: {
    fontSize: 13,
    fontWeight: '700',
    width: 22,
    textAlign: 'center',
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
});
