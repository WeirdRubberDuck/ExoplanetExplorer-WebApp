import type { LocalState } from '@/redux/local/localSlice';
import type { Column, ColumnData } from '@/types/types';

export interface ColumnPreferences {
  objectNameColumn?: Column;
  logScaleColumns?: Column[];
  crossFiltering?: Partial<LocalState['crossFiltering']>;
  parallelCoordinates: {
    selectedColumns: Column[];
    columnOrder: Column[];
    settings?: Partial<
      Omit<
        LocalState['parallelCoordinates']['settings'],
        'selectedColumns' | 'axisViolinPlots'
      >
    > & {
      axisViolinPlots?: Partial<
        LocalState['parallelCoordinates']['settings']['axisViolinPlots']
      >;
    };
  };
  cornerPlot: {
    selectedColumns: Column[];
    settings?: Partial<Omit<LocalState['cornerPlot']['settings'], 'selectedColumns'>>;
  };
}

const LIVE_BRUSHING_MAX_ROWS = 10_000;

export const pcDefaultColumns: Column[] = [
  'discoverymethod',
  'sy_pnum',
  'pl_bmasse',
  'pl_rade',
  'pl_orbincl',
  'pl_Teq',
  'sy_dist',
  'st_age'
];

export const cornerDefaultColumns: Column[] = [
  'pl_bmasse',
  'pl_rade',
  'pl_orbper',
  'pl_orbeccen',
  'pl_orbsmax',
  'pl_eqt',
  'st_met',
  'st_age'
];

export interface DatasetSource {
  kind: 'builtin' | 'file';
  name: string;
}

export function getDatasetKey(source: DatasetSource, columns: Column[]): string {
  return JSON.stringify([source.kind, source.name, [...columns].sort()]);
}

/**
 * Determines the final column selection based on saved preferences, eligible columns,
 * and default columns.
 *
 * @param saved The previously saved column selection, if any.
 * @param eligible The list of columns that are eligible for selection.
 * @param defaults The default columns to use if no valid saved selection exists.
 * @returns The resolved column selection based on saved, eligible, and default columns.
 */
function resolveSelection(
  saved: Column[] | undefined,
  eligible: Column[],
  defaults: Column[]
): Column[] {
  if (!saved) {
    return defaults;
  }
  // Use only unique and eligible columns from the saved selection
  const valid = [...new Set(saved)].filter((column) => eligible.includes(column));
  return saved.length === 0 || valid.length > 0 ? valid : defaults;
}

export function resolveDatasetColumns(
  columns: Column[],
  columnData: Record<Column, ColumnData>,
  saved?: ColumnPreferences,
  rowCount = 0
) {
  const numericColumns = columns.filter(
    (column) => columnData[column]?.type === 'number'
  );

  const primaryParallel = pcDefaultColumns.filter((column) => columns.includes(column));
  const primaryCorner = cornerDefaultColumns.filter((column) =>
    numericColumns.includes(column)
  );

  // Use the first 8 columns as defaults if no primary defaults are available
  const parallelDefaults = primaryParallel.length ? primaryParallel : columns.slice(0, 8);
  const cornerDefaults = primaryCorner.length
    ? primaryCorner
    : numericColumns.slice(0, 8);

  // Resolve the final selection for the parallel coordinates chart based on saved
  // preferences, eligible columns, and defaults
  const parallelSelected = resolveSelection(
    saved?.parallelCoordinates.selectedColumns,
    columns,
    parallelDefaults
  );

  const cornerSelected = resolveSelection(
    saved?.cornerPlot.selectedColumns,
    numericColumns,
    cornerDefaults
  );

  const columnOrder = [
    ...new Set([...(saved?.parallelCoordinates.columnOrder ?? []), ...parallelSelected])
  ].filter((column) => parallelSelected.includes(column));
  const liveBrushingDisabledForLargeDataset =
    saved?.parallelCoordinates.settings?.updateOnBrushEnd === undefined &&
    rowCount > LIVE_BRUSHING_MAX_ROWS;

  return {
    crossFiltering: saved?.crossFiltering,
    logScaleColumns: [...new Set(saved?.logScaleColumns ?? [])].filter((column) => {
      const metadata = columnData[column];
      return (
        columns.includes(column) && metadata?.type === 'number' && !metadata.isUncertainty
      );
    }),
    objectNameColumn:
      saved?.objectNameColumn &&
      columns.includes(saved.objectNameColumn) &&
      columnData[saved.objectNameColumn]?.type === 'string'
        ? saved.objectNameColumn
        : 'pl_name',
    parallelCoordinates: {
      liveBrushingDisabledForLargeDataset,
      settings: {
        ...saved?.parallelCoordinates.settings,
        updateOnBrushEnd:
          saved?.parallelCoordinates.settings?.updateOnBrushEnd ??
          rowCount > LIVE_BRUSHING_MAX_ROWS
      },
      defaultColumns: parallelDefaults,
      selectedColumns: parallelSelected,
      columnOrder
    },
    cornerPlot: {
      settings: saved?.cornerPlot.settings,
      defaultColumns: cornerDefaults,
      selectedColumns: cornerSelected
    },
    numericColumns
  };
}
