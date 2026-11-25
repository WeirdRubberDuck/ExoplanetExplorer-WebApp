import { useMemo } from 'react';
import { IoMdSettings } from 'react-icons/io';
import {
  ActionIcon,
  Button,
  Checkbox,
  Code,
  Drawer,
  MultiSelect,
  Select,
  Stack,
  Text,
  Title
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

import { useAppDispatch, useAppSelector } from '@/redux/hooks.ts';
import {
  setCrossFilteringSettings,
  setLogScaleColumns,
  setObjectNameColumn
} from '@/redux/local/localSlice.ts';
import type { Column } from '@/types/types';

const astronomyLogDefaultColumns: Column[] = [
  'pl_bmasse',
  'pl_rade',
  'pl_orbper',
  'pl_orbsmax'
];

export function Settings() {
  const { columns, columnData, dataFileName } = useAppSelector((state) => state.data);
  const objectNameColumn = useAppSelector((state) => state.local.objectNameColumn);
  const crossFiltering = useAppSelector((state) => state.local.crossFiltering);

  const {
    settings: { selectedColumns }
  } = useAppSelector((state) => state.local.cornerPlot);

  const numericColumns = useMemo(() => {
    return columns.filter(
      (col) => columnData[col].type === 'number' && !columnData[col].isUncertainty
    );
  }, [columns, columnData]);

  const { logScaleColumns } = useAppSelector((state) => state.local);

  const [settingsOpened, { open, close }] = useDisclosure(false);

  const dispatch = useAppDispatch();

  return (
    <>
      <ActionIcon variant={'default'} onClick={open} aria-label={'Open page settings'}>
        <IoMdSettings />
      </ActionIcon>

      <Drawer
        opened={settingsOpened}
        onClose={close}
        title={'Settings'}
        padding={'md'}
        position={'right'}
        size={400}
      >
        <Stack>
          {dataFileName && (
            <Stack gap={4}>
              <Text size={'sm'} fw={500}>
                Loaded data file
              </Text>
              <Code style={{ overflowWrap: 'anywhere' }}>{dataFileName}</Code>
            </Stack>
          )}
          <Select
            label={'Object name column'}
            value={objectNameColumn}
            onChange={(value) => dispatch(setObjectNameColumn(value))}
            data={columns.map((col) => ({ value: col, label: col }))}
            searchable
          />

          <Title order={2} size={'md'}>
            Cross-filtering
          </Title>
          <Stack gap={'xs'}>
            <Checkbox
              label={'Apply corner plot filtering in parallel coordinates'}
              checked={crossFiltering.cornerAffectsParallel}
              onChange={(event) =>
                dispatch(
                  setCrossFilteringSettings({
                    cornerAffectsParallel: event.currentTarget.checked
                  })
                )
              }
            />
            <Checkbox
              label={'Apply parallel coordinates filtering in corner plot'}
              checked={crossFiltering.parallelAffectsCorner}
              onChange={(event) =>
                dispatch(
                  setCrossFilteringSettings({
                    parallelAffectsCorner: event.currentTarget.checked
                  })
                )
              }
            />
          </Stack>
          <Title order={2} size={'md'}>
            Log scale columns
          </Title>
          <Stack gap={'xs'}>
            <Text size={'xs'} c={'dimmed'}>
              Which columns should be displayed on a logarithmic scale.
            </Text>
            <MultiSelect
              label={'Log scale columns'}
              data={numericColumns}
              searchable
              value={logScaleColumns}
              onChange={(value) => dispatch(setLogScaleColumns(value))}
              hidePickedOptions
            />
            <Button
              variant={'light'}
              onClick={() =>
                dispatch(
                  setLogScaleColumns(
                    astronomyLogDefaultColumns.filter((column) =>
                      selectedColumns.includes(column)
                    )
                  )
                )
              }
            >
              Use astronomy log defaults
            </Button>
          </Stack>
        </Stack>
      </Drawer>
    </>
  );
}
