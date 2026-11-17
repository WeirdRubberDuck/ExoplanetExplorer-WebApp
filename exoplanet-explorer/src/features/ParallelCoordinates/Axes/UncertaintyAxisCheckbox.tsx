import * as d3 from 'd3';
import { useState } from 'react';

interface Props {
  checked: boolean;
  y: number;
  size: number;
  strokeWidth?: number;
  onChange?: (value: boolean) => void;
}

export function UncertaintyAxisCheckbox({
  checked,
  y,
  size: size,
  strokeWidth,
  onChange
}: Props) {
  const halfSize = size / 2;
  const [focused, setFocused] = useState(false);
  const checkmark = d3.line()([
    [0.2 * size, 0.5 * size],
    [0.4 * size, 0.69 * size],
    [0.8 * size, 0.2 * size]
  ]);

  function handleClick() {
    if (onChange) {
      onChange(!checked);
    }
  }

  return (
    <g
      transform={`translate(${-halfSize}, ${y - halfSize})`}
      role={'checkbox'}
      aria-label={'Show uncertainty axis'}
      aria-checked={checked}
      tabIndex={0}
      style={{ outline: 'none' }}
      onFocus={(event) => setFocused(event.currentTarget.matches(':focus-visible'))}
      onBlur={() => setFocused(false)}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          handleClick();
        }
      }}
    >
      {' '}
      <rect
        ry={2}
        rx={2}
        width={size}
        height={size}
        stroke={focused ? 'var(--mantine-primary-color-filled)' : 'darkgray'}
        strokeWidth={1}
        fill={'white'}
      />
      <path
        d={checkmark || undefined}
        stroke={checked ? 'var(--mantine-primary-color-filled)' : 'none'}
        strokeWidth={strokeWidth}
        fill={'none'}
      />
    </g>
  );
}
