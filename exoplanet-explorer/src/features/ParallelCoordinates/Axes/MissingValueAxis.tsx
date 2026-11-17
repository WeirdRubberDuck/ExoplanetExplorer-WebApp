import { useState } from 'react';

import { type Dimension, NanBrushMode } from '../types';

interface Props {
  dimension: Dimension;
  y: number;
  onBrush?: (dimension: Dimension, mode: NanBrushMode | undefined) => void;
}

export function MissingValueAxis({ dimension, y, onBrush }: Props) {
  const [brushMode, setBrushMode] = useState<NanBrushMode | undefined>(undefined);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  function colorForMode(mode: NanBrushMode | undefined) {
    if (mode === NanBrushMode.Block) return 'rgba(220, 0, 0)';
    if (mode === NanBrushMode.Filter) return 'rgba(0, 220, 0)';
    return 'darkgray';
  }

  function onClick() {
    let newMode: NanBrushMode | undefined;
    if (brushMode === NanBrushMode.Block) {
      newMode = NanBrushMode.Filter;
    } else if (brushMode === NanBrushMode.Filter) {
      newMode = undefined;
    } else {
      newMode = NanBrushMode.Block;
    }
    setBrushMode(newMode);
    onBrush?.(dimension, newMode);
  }

  function onRightClick(event: React.MouseEvent) {
    event.preventDefault();
    setBrushMode(undefined);
    onBrush?.(dimension, undefined);
  }

  return (
    <circle
      onMouseOver={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onContextMenu={onRightClick}
      cx={0}
      cy={y}
      r={hovered ? 7 : 5}
      fill={colorForMode(brushMode)}
      stroke={focused ? 'currentColor' : 'none'}
      strokeWidth={1}
      style={{ outline: 'none' }}
      onFocus={(event) => setFocused(event.currentTarget.matches(':focus-visible'))}
      onBlur={() => setFocused(false)}
      onClick={onClick}
      role={'button'}
      tabIndex={0}
      aria-label={`Missing-value filter for ${dimension.key}: ${
        brushMode === undefined
          ? 'off'
          : brushMode === NanBrushMode.Block
            ? 'exclude missing values'
            : 'only missing values'
      }`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    />
  );
}
