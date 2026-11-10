import { useMemo, useState } from 'react';
import { MdSearch } from 'react-icons/md';
import { Box, CloseButton, Text, TextInput, Title } from '@mantine/core';
import { useResizeObserver } from '@mantine/hooks';

import { useBaseDataset, useFilteredIds } from '@/hooks/data';
import { useAppSelector } from '@/redux/hooks';
import type { DataItem } from '@/types/types';

import { PlanetListItem } from './PlanetListItem';

export function SelectionList() {
  const [scrollTop, setScrollTop] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const { filteredIds } = useFilteredIds();
  const data = useBaseDataset();
  const fullData = useAppSelector((state) => state.data.full);
  const objectNameColumn = useAppSelector((state) => state.local.objectNameColumn);

  const hasNames = useMemo(
    () =>
      fullData.some((row) => {
        const name = row[objectNameColumn];
        return name != null && String(name).trim() !== '';
      }),
    [fullData, objectNameColumn]
  );

  const [ref, rect] = useResizeObserver();

  const defaultHeight = 800; // Default height if rect is not available
  const rowHeight = 30;
  const listHeight = rect?.height ?? defaultHeight;
  const overscan = 6;

  const idsToRender = useMemo(() => {
    const baseIds = filteredIds === undefined ? data.map((row) => row.id) : filteredIds;

    const query = searchQuery.trim().toLowerCase();
    if (query === '') {
      return baseIds;
    }

    return baseIds.filter((id) => {
      const name = fullData[id]?.[objectNameColumn];
      return typeof name === 'string' && name.toLowerCase().includes(query);
    });
  }, [filteredIds, data, searchQuery, fullData, objectNameColumn]);

  function handleSearchChange(query: string) {
    setSearchQuery(query);
    // Avoid being scrolled past the end of a newly-shortened, filtered list
    setScrollTop(0);
  }

  const visibleRowCount = Math.ceil(listHeight / rowHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    idsToRender.length,
    startIndex + visibleRowCount + overscan * 2
  );
  const visibleRows = idsToRender.slice(startIndex, endIndex);
  const yOffset = startIndex * rowHeight;
  const totalHeight = idsToRender.length * rowHeight;

  return (
    <Box>
      <Title order={4}>{`Planets (${idsToRender.length})`}</Title>

      <TextInput
        mt={'xs'}
        size={'sm'}
        placeholder={'Search by name'}
        disabled={!hasNames}
        leftSection={<MdSearch />}
        value={searchQuery}
        onChange={(event) => handleSearchChange(event.currentTarget.value)}
        rightSection={
          searchQuery ? (
            <CloseButton size={'sm'} onClick={() => handleSearchChange('')} />
          ) : undefined
        }
      />

      {!hasNames && fullData.length > 0 ? (
        <Text size={'sm'} c={'dimmed'} mt={'xs'} role={'status'}>
          No names loaded. Set the Object name column in page settings.
        </Text>
      ) : idsToRender.length === 0 ? (
        <Text size={'sm'} c={'dimmed'} mt={'xs'}>
          No rows matched the current filter.
        </Text>
      ) : (
        <Box
          mt={'xs'}
          h={defaultHeight}
          style={{
            height: listHeight,
            overflowY: 'auto',
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: 4,
            resize: 'vertical'
          }}
          ref={ref}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <Box style={{ height: totalHeight, position: 'relative' }}>
            <Box style={{ transform: `translateY(${yOffset}px)` }}>
              {visibleRows.map((id: DataItem['id']) => (
                <PlanetListItem key={id} id={id} />
              ))}
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  );
}
