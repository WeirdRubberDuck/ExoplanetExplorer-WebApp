import { useInactiveColor } from '@/hooks/colors.ts';

import { CanvasLines, type CanvasLinesProps } from './CanvasLines.tsx';

interface Props extends CanvasLinesProps {
  strokeColor?: never;
}

export function GhostLines(props: Props) {
  const inactiveColor = useInactiveColor();

  return <CanvasLines {...props} strokeColor={inactiveColor} />;
}
