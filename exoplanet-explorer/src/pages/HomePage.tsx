import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Group,
  Loader,
  LoadingOverlay,
  Splitter,
  Stack,
  Text
} from '@mantine/core';

import { CornerPlot } from '@/features/CornerPlot/CornerPlot';
import { ParallelCoordinates } from '@/features/ParallelCoordinates/ParallelCoordinates';
import { SelectionList } from '@/features/SelectionList/SelectionList';
import { usePlanetDataInitialization } from '@/hooks/usePlanetDataInitialization';
import { startupConfig } from '@/utils/urlConfig';

export function HomePage() {
  const [dismissedWarnings, setDismissedWarnings] = useState<string[]>();
  const { startupInfo, error, setError, isSyncing } = usePlanetDataInitialization();

  useEffect(() => {
    if (startupConfig.chart) {
      document.title =
        startupConfig.chart === 'parallelcoordinates'
          ? 'Parallel Coordinates | Exoplanet Explorer'
          : 'Scatterplot Matrix | Exoplanet Explorer';
    }
  }, []);

  if (error)
    return (
      <Alert
        color={'red'}
        title={'Data loading failed'}
        withCloseButton
        onClose={() => setError(undefined)}
      >
        {error}
      </Alert>
    );

  if (!startupInfo) {
    return <Loader aria-label={'Loading planet data'} />;
  }

  const { warnings, uncertaintyColumns } = startupInfo;

  const syncOverlay = (
    <LoadingOverlay
      visible={isSyncing}
      pos={'fixed'}
      role={'status'}
      aria-label={'Syncing data from OpenSpace'}
      transitionProps={{ duration: 0 }}
      loaderProps={{
        style: { width: 'auto', height: 'auto' },
        children: (
          <Stack align={'center'} gap={'xs'}>
            <Loader />
            <Text size={'sm'}>Syncing data from OpenSpace</Text>
          </Stack>
        )
      }}
    />
  );

  const warning =
    warnings.length > 0 && warnings !== dismissedWarnings ? (
      <Alert
        color={'yellow'}
        mb={'sm'}
        title={'Warnings'}
        withCloseButton
        onClose={() => setDismissedWarnings(warnings)}
        style={{ overflowWrap: 'anywhere' }}
      >
        {warnings.join(' ')}
      </Alert>
    ) : null;

  if (startupConfig.chart) {
    return (
      <>
        {syncOverlay}
        {warning}
        <Box style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto' }}>
          {startupConfig.chart === 'parallelcoordinates' ? (
            <ParallelCoordinates
              standalone
              initialUncertaintyColumns={uncertaintyColumns}
              hideTopBar={startupConfig.hideTopBar}
            />
          ) : (
            <CornerPlot standalone hideTopBar={startupConfig.hideTopBar} />
          )}
        </Box>
      </>
    );
  }

  return (
    <>
      {syncOverlay}
      {warning}
      <Group align={'flex-start'} wrap={'nowrap'}>
        <Splitter w={'100%'}>
          <Splitter.Pane defaultSize={'90%'}>
            <Group align={'flex-start'} w={'100%'} style={{ minWidth: 0 }}>
              <ParallelCoordinates />
              <CornerPlot />
            </Group>
          </Splitter.Pane>
          <Splitter.Pane defaultSize={'20%'} min={'5%'}>
            <SelectionList />
          </Splitter.Pane>
        </Splitter>
      </Group>
    </>
  );
}
