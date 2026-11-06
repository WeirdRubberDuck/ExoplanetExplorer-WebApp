import { useMemo } from 'react';
import { useMantineColorScheme } from '@mantine/core';

export function useInactiveColor() {
  const { colorScheme } = useMantineColorScheme();

  return useMemo(() => {
    const colorVariable =
      colorScheme === 'dark' ? '--mantine-color-dark-5' : '--mantine-color-dark-0';

    const resolvedColor = getComputedStyle(document.documentElement)
      .getPropertyValue(colorVariable)
      .trim();

    return resolvedColor;
  }, [colorScheme]);
}
