import { IoMdSettings } from 'react-icons/io';
import {
  ActionIcon,
  Alert,
  Checkbox,
  Drawer,
  Group,
  InputLabel,
  Slider,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import { OpenChartWindow } from '@/components/OpenChartWindow';
import { useAppDispatch, useAppSelector } from '@/redux/hooks.ts';
import { setParallelCoordinatesSettings } from '@/redux/local/localSlice.ts';

import { ColumnSelection } from './ColumnSelection';

export function SettingsParallelCoordinates() {
  // Parallel coordinates settings from the Redux store
  const { defaultColumns, settings, liveBrushingDisabledForLargeDataset } =
    useAppSelector((state) => state.local.parallelCoordinates);

  const [settingsOpened, { open, close }] = useDisclosure(false);

  const dispatch = useAppDispatch();

  return (
    <>
      <ActionIcon
        variant={'default'}
        onClick={open}
        aria-label={'Open parallel coordinates settings'}
      >
        <IoMdSettings />
      </ActionIcon>

      <Drawer
        opened={settingsOpened}
        onClose={close}
        title={'Parallel Coordinates Settings'}
        padding={'md'}
        size={400}
      >
        <Stack gap={'xs'}>
          <Group>
            <InputLabel>Open in separate window</InputLabel>
            <OpenChartWindow chart={'parallelcoordinates'} />
          </Group>

          <ColumnSelection primaryColumns={defaultColumns} />

          <Title order={3} size={'md'}>
            Lines
          </Title>
          <Group w={'100%'}>
            <Text size={'sm'}>Line opacity</Text>
            <Slider
              value={settings.lineOpacity}
              onChange={(value) =>
                dispatch(setParallelCoordinatesSettings({ lineOpacity: value }))
              }
              min={0}
              max={1}
              step={0.01}
              flex={1}
            />
          </Group>
          <Checkbox
            label={'Show ghost lines for filtered out paths'}
            checked={settings.showGhostLines}
            onChange={(e) =>
              dispatch(
                setParallelCoordinatesSettings({
                  showGhostLines: e.target.checked
                })
              )
            }
          />
          <Checkbox
            label={'Show text on highlighted line'}
            checked={settings.showTextOnHighlightedLine}
            onChange={(e) =>
              dispatch(
                setParallelCoordinatesSettings({
                  showTextOnHighlightedLine: e.target.checked
                })
              )
            }
          />
          <Checkbox
            label={'Update filters while brushing'}
            checked={!settings.updateOnBrushEnd}
            onChange={(event) =>
              dispatch(
                setParallelCoordinatesSettings({
                  updateOnBrushEnd: !event.currentTarget.checked
                })
              )
            }
          />
          {liveBrushingDisabledForLargeDataset && (
            <Alert color={'yellow'} role={'status'}>
              Live updates were turned off because this dataset has more than 10,000 rows.
            </Alert>
          )}

          <Title order={3} size={'md'}>
            Axes
          </Title>
          <Checkbox
            label={'Clip extreme values (show 1st-99th percentile)'}
            checked={settings.clipExtremes}
            onChange={(event) =>
              dispatch(
                setParallelCoordinatesSettings({
                  clipExtremes: event.currentTarget.checked
                })
              )
            }
          />
          <Checkbox
            label={'Show violin plots'}
            checked={settings.axisViolinPlots.show}
            onChange={(e) =>
              dispatch(
                setParallelCoordinatesSettings({
                  axisViolinPlots: {
                    ...settings.axisViolinPlots,
                    show: e.target.checked
                  }
                })
              )
            }
          />
          <Checkbox
            label={'Include missing values in violin plots'}
            checked={settings.axisViolinPlots.showMissingValueLobe}
            onChange={(e) =>
              dispatch(
                setParallelCoordinatesSettings({
                  axisViolinPlots: {
                    ...settings.axisViolinPlots,
                    showMissingValueLobe: e.target.checked
                  }
                })
              )
            }
            disabled={!settings.axisViolinPlots.show}
          />
        </Stack>
      </Drawer>
    </>
  );
}
