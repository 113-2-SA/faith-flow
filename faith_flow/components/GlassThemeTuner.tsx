import React, { useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DEFAULT_GLASS, useGlassTheme } from '../context/GlassThemeContext';

// ── Slider ────────────────────────────────────────────────────────────────────

type SliderProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  trackColor: string;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
};

function GlassSlider({ label, value, min, max, step, trackColor, onChange, fmt }: SliderProps) {
  const trackRef = useRef<View>(null);
  const layout = useRef({ x: 0, width: 1 });

  const fromPageX = (pageX: number) => {
    const ratio = Math.max(0, Math.min(1, (pageX - layout.current.x) / layout.current.width));
    const raw = min + ratio * (max - min);
    const snapped = Math.round(raw / step) * step;
    onChange(parseFloat(Math.max(min, Math.min(max, snapped)).toFixed(4)));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: evt => fromPageX(evt.nativeEvent.pageX),
      onPanResponderMove: evt => fromPageX(evt.nativeEvent.pageX),
    })
  ).current;

  const pct = ((value - min) / (max - min)) * 100;

  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <View
        ref={trackRef}
        style={s.track}
        onLayout={() =>
          trackRef.current?.measure((_x, _y, w, _h, pageX) => {
            layout.current = { x: pageX, width: w };
          })
        }
        {...pan.panHandlers}
      >
        <View style={[s.fill, { width: `${pct}%` as `${number}%`, backgroundColor: trackColor }]} />
        <View style={[s.thumb, { left: `${pct}%` as `${number}%`, transform: [{ translateX: -10 }] }]} />
      </View>
      <Text style={s.val}>{fmt ? fmt(value) : Math.round(value)}</Text>
    </View>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function Section({ label }: { label: string }) {
  return <Text style={s.section}>{label}</Text>;
}

// ── Main tuner ────────────────────────────────────────────────────────────────

export function GlassThemeTuner() {
  const { theme, update } = useGlassTheme();
  const [open, setOpen] = useState(false);

  const color1 = `rgba(${theme.r ?? 255},${theme.g ?? 255},${theme.b ?? 255},${(theme.opacity ?? 0.01).toFixed(2)})`;
  const color2 = `rgba(${theme.r2 ?? 200},${theme.g2 ?? 200},${theme.b2 ?? 255},${(theme.opacity2 ?? 0.08).toFixed(2)})`;

  return (
    <View style={s.root} pointerEvents="box-none">
      <Pressable style={s.toggleBtn} onPress={() => setOpen(v => !v)}>
        <Text style={s.toggleIcon}>{open ? '✕' : '🎨'}</Text>
      </Pressable>

      {open && (
        <View style={s.panel}>
          {/* Gradient preview */}
          <View style={s.previewRow}>
            <LinearGradient
              colors={[color1, color2]}
              start={[0, 0]} end={[1, 1]}
              style={s.previewBox}
            />
            <View style={{ flex: 1 }}>
              <Text style={s.previewCode}>{color1}</Text>
              <Text style={s.previewCode}>{color2}</Text>
            </View>
            <Pressable style={s.resetBtn} onPress={() => update(DEFAULT_GLASS)}>
              <Text style={s.resetText}>Reset</Text>
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
            <Section label="── 模糊 / 邊框" />
            <GlassSlider label="Blur"   value={theme.blur}          min={0} max={100} step={1}    trackColor="#aaa"                   onChange={v => update({ blur: v })} />
            <GlassSlider label="Border" value={theme.borderOpacity}  min={0} max={1}   step={0.01} trackColor="rgba(200,200,200,0.6)"   onChange={v => update({ borderOpacity: v })} fmt={v => v.toFixed(2)} />

            <Section label="── 色 1（起始）" />
            <GlassSlider label="R"     value={theme.r}       min={0} max={255} step={1}    trackColor="#f44" onChange={v => update({ r: v })} />
            <GlassSlider label="G"     value={theme.g}       min={0} max={255} step={1}    trackColor="#4c4" onChange={v => update({ g: v })} />
            <GlassSlider label="B"     value={theme.b}       min={0} max={255} step={1}    trackColor="#55f" onChange={v => update({ b: v })} />
            <GlassSlider label="Alpha" value={theme.opacity}  min={0} max={1}   step={0.01} trackColor="rgba(255,255,255,0.55)" onChange={v => update({ opacity: v })} fmt={v => v.toFixed(2)} />

            <Section label="── 色 2（終止）" />
            <GlassSlider label="R"     value={theme.r2}       min={0} max={255} step={1}    trackColor="#f44" onChange={v => update({ r2: v })} />
            <GlassSlider label="G"     value={theme.g2}       min={0} max={255} step={1}    trackColor="#4c4" onChange={v => update({ g2: v })} />
            <GlassSlider label="B"     value={theme.b2}       min={0} max={255} step={1}    trackColor="#55f" onChange={v => update({ b2: v })} />
            <GlassSlider label="Alpha" value={theme.opacity2}  min={0} max={1}   step={0.01} trackColor="rgba(255,255,255,0.55)" onChange={v => update({ opacity2: v })} fmt={v => v.toFixed(2)} />

            <Section label="── 角度" />
            <GlassSlider label="Angle" value={theme.angle} min={0} max={360} step={1} trackColor="rgba(180,180,255,0.6)" onChange={v => update({ angle: v })} fmt={v => `${Math.round(v)}°`} />
          </ScrollView>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 52,
    right: 14,
    zIndex: 9999,
    alignItems: 'flex-end',
  },
  toggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  toggleIcon: { fontSize: 18 },

  panel: {
    marginTop: 8,
    width: 272,
    backgroundColor: 'rgba(18,18,28,0.94)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },

  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  previewBox: {
    width: 38,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    flexShrink: 0,
  },
  previewCode: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 9,
    fontFamily: 'monospace',
    lineHeight: 13,
  },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  resetText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
  },

  section: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    marginBottom: 6,
    marginTop: 4,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 9,
    gap: 6,
  },
  label: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    width: 38,
  },
  track: {
    flex: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    overflow: 'visible',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 10,
    opacity: 0.75,
  },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 4,
  },
  val: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    width: 34,
    textAlign: 'right',
  },
});
