import type { ColumnPreferences } from './datasetColumns';

const storagePrefix = 'exoplanet-explorer:columns:v1:';

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/**
 * Get the column preferences from local storage for the given dataset.
 *
 * @param datasetKey The key identifying the dataset (created from file name and columns)
 * @returns The column preferences if they exist, otherwise undefined.
 */
export function readColumnPreferences(datasetKey: string): ColumnPreferences | undefined {
  try {
    const stored = localStorage.getItem(storagePrefix + datasetKey);
    if (!stored) return undefined;
    const parsed = JSON.parse(stored);
    if (
      parsed?.version !== 1 ||
      !isStringArray(parsed.parallelCoordinates?.selectedColumns) ||
      !isStringArray(parsed.parallelCoordinates?.columnOrder) ||
      !isStringArray(parsed.cornerPlot?.selectedColumns)
    )
      return undefined;
    const parallel = parsed.parallelCoordinates.settings;
    const corner = parsed.cornerPlot.settings;
    return {
      crossFiltering: {
        cornerAffectsParallel: readBoolean(parsed.crossFiltering?.cornerAffectsParallel),
        parallelAffectsCorner: readBoolean(parsed.crossFiltering?.parallelAffectsCorner)
      },
      logScaleColumns: isStringArray(parsed.logScaleColumns)
        ? parsed.logScaleColumns
        : undefined,
      objectNameColumn:
        typeof parsed.objectNameColumn === 'string' ? parsed.objectNameColumn : undefined,
      parallelCoordinates: {
        selectedColumns: parsed.parallelCoordinates.selectedColumns,
        columnOrder: parsed.parallelCoordinates.columnOrder,
        settings: {
          lineOpacity:
            typeof parallel?.lineOpacity === 'number' &&
            Number.isFinite(parallel.lineOpacity) &&
            parallel.lineOpacity >= 0 &&
            parallel.lineOpacity <= 1
              ? parallel.lineOpacity
              : undefined,
          showGhostLines: readBoolean(parallel?.showGhostLines),
          showTextOnHighlightedLine: readBoolean(parallel?.showTextOnHighlightedLine),
          clipExtremes: readBoolean(parallel?.clipExtremes),
          axisViolinPlots: {
            show: readBoolean(parallel?.axisViolinPlots?.show),
            showMissingValueLobe: readBoolean(
              parallel?.axisViolinPlots?.showMissingValueLobe
            )
          }
        }
      },
      cornerPlot: {
        selectedColumns: parsed.cornerPlot.selectedColumns,
        settings: {
          renderMode:
            corner?.renderMode === 'scatter' ||
            corner?.renderMode === 'density' ||
            corner?.renderMode === 'both'
              ? corner.renderMode
              : undefined,
          invertLayout: readBoolean(corner?.invertLayout),
          clipExtremes: readBoolean(corner?.clipExtremes)
        }
      }
    };
  } catch {
    return undefined;
  }
}

/**
 * Write the column preferences to local storage for the given dataset.
 *
 * @param datasetKey The key identifying the dataset (created from file name and columns)
 * @param preferences The column preferences to save for the dataset.
 * @returns Nothing.
 */
export function writeColumnPreferences(
  datasetKey: string,
  preferences: ColumnPreferences
) {
  try {
    localStorage.setItem(
      storagePrefix + datasetKey,
      JSON.stringify({ version: 1, ...preferences })
    );
  } catch {
    return;
  }
}
