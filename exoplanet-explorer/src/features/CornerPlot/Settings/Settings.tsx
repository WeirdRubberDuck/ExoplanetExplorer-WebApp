import { IoMdSettings } from 'react-icons/io';
import {
  ActionIcon,
  Checkbox,
  Drawer,
  Group,
  InputLabel,
  Radio,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import { OpenChartWindow } from '@/components/OpenChartWindow';
import { useAppDispatch, useAppSelector } from '@/redux/hooks';
import {
  type CornerPlotRenderMode,
  setCornerPlotSettings
} from '@/redux/local/localSlice';

import { CornerPlotColumnSelection } from './ColumnSelection';

export function CornerPlotSettings() {
  const [settingsOpened, { open, close }] = useDisclosure(false);

  const { defaultColumns, settings } = useAppSelector((state) => state.local.cornerPlot);
  const dispatch = useAppDispatch();

  return (
    <>
      <ActionIcon
        variant={'default'}
        onClick={open}
        aria-label={'Open corner plot settings'}
      >
        <IoMdSettings />
      </ActionIcon>

      <Drawer
        opened={settingsOpened}
        onClose={close}
        title={'Corner Plot Settings'}
        padding={'md'}
        size={420}
      >
        <Stack gap={'xs'}>
          <Group>
            <InputLabel>Open in separate window</InputLabel>
            <OpenChartWindow chart={'scatterplotmatrix'} />
          </Group>

          <CornerPlotColumnSelection primaryColumns={defaultColumns} />

          <Title order={3} size={'md'}>
            Rendering
          </Title>

          <Radio.Group
            label={'Point rendering mode'}
            value={settings.renderMode}
            onChange={(value) =>
              dispatch(
                setCornerPlotSettings({
                  renderMode: value as CornerPlotRenderMode
                })
              )
            }
          >
            <Group mt={4}>
              <Radio value={'scatter'} label={'Scatter'} />
              <Radio value={'density'} label={'Density bins'} />
              <Radio value={'both'} label={'Scatter + density bins'} />
            </Group>
          </Radio.Group>

          <Checkbox
            label={'Swap upper/lower triangle layout'}
            checked={settings.invertLayout}
            onChange={(event) =>
              dispatch(
                setCornerPlotSettings({
                  invertLayout: event.currentTarget.checked
                })
              )
            }
          />
          <Checkbox
            label={'Clip extreme values (show 1st-99th percentile)'}
            checked={settings.clipExtremes}
            onChange={(event) =>
              dispatch(
                setCornerPlotSettings({
                  clipExtremes: event.currentTarget.checked
                })
              )
            }
          />

          <Text size={'xs'} c={'dimmed'}>
            The corner plot matrix grows quadratically with selected columns, so 4-8
            columns usually gives the clearest scientific view.
          </Text>
        </Stack>
      </Drawer>
    </>
  );
}
