import { useEffect, useRef, useState } from 'react';

import { api, dataEndpoint } from '@/api/api';
import { ConnectionStatus } from '@/redux/connection/connectionSlice';
import { initializeData as initializeDataAction } from '@/redux/data/dataSlice';
import { useAppSelector } from '@/redux/hooks';
import {
  setCornerPlotSelectedColumns,
  setParallelCoordinatesColumnOrder,
  setParallelCoordinatesSelectedColumns
} from '@/redux/local/localSlice';
import { store } from '@/redux/store';
import { parseDataset } from '@/utils/datasetParsing';
import { getStringPropertyValue } from '@/utils/properties';
import { getEligibleUncertaintyColumns, startupConfig } from '@/utils/urlConfig';

const loadedDataFileProperty = 'Modules.ExoplanetExplorer.LoadedDataFile';
const hostedDataLocationProperty = 'Modules.ExoplanetExplorer.HostedDataLocation';
const openSpaceDataDirectory = 'exoplanetexplorer/data';
const propertyTimeoutMs = 5000;
const dataTimeoutMs = 15000;

const fallbackDataUrl = new URL('../data/aggregated_data.json', import.meta.url).href;

interface PlanetDataStartupInfo {
  warnings: string[];
  uncertaintyColumns: string[];
}

interface DataInitializationResult {
  warnings: string[];
}

interface ColumnInitializationResult {
  warnings: string[];
  uncertaintyColumns: string[];
}

/**
 * Builds the OpenSpace data URL for a path relative to its hosted data directory.
 **/
function buildOpenSpaceDataUrl(relativePath: string) {
  const encodedPath = relativePath.split('/').map(encodeURIComponent).join('/');
  const path = `${openSpaceDataDirectory}/${encodedPath}`;
  return import.meta.env.DEV
    ? `/openspace/${path}`
    : `http://${dataEndpoint.host}:${dataEndpoint.port}/${path}`;
}

/**
 * Normalizes path separators and trailing slashes before path comparison.
 **/
function normalizeOpenSpacePath(path: string) {
  return path
    .trim()
    .replace(/\\/g, '/')
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '');
}

/**
 * Returns the safe path within the hosted directory, or undefined if the file is
 * outside it.
 */
function getHostedRelativePath(loadedDataFile: string, hostedDataLocation: string) {
  const loadedPath = normalizeOpenSpacePath(loadedDataFile);
  const hostedPath = normalizeOpenSpacePath(hostedDataLocation);
  const hostedPrefix = `${hostedPath}/`;
  if (!loadedPath || !hostedPath || !loadedPath.startsWith(hostedPrefix)) {
    return undefined;
  }

  const relativePath = loadedPath.slice(hostedPrefix.length);
  const segments = relativePath.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return undefined;
  }
  return segments.join('/');
}

/**
 * Rejects if a request does not settle within the given time limit.
 **/
function withTimeout<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('OpenSpace request timed out.')),
      timeoutMs
    );
    request.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (reason: unknown) => {
        clearTimeout(timeout);
        reject(reason);
      }
    );
  });
}

/**
 * Reads a string property, returning undefined when it is unavailable or times out.
 **/
async function readStringProperty(property: string) {
  try {
    return getStringPropertyValue(
      await withTimeout(api.getProperty(property, 'StringProperty'), propertyTimeoutMs)
    );
  } catch {
    return undefined;
  }
}

/**
 * Fetches and parses a dataset, aborting the network request after the data timeout.
 **/
async function fetchPlanetData(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), dataTimeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Could not load planet data (${response.status}).`);
    }
    try {
      return parseDataset(await response.text(), url);
    } catch (reason) {
      throw new Error(
        `Could not load planet data from ${url}: ${reason instanceof Error ? reason.message : 'Could not read dataset.'}`
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetches the selected or fallback dataset and stores it in Redux.
 **/
async function initializeData(
  hostedRelativePath: string | undefined,
  loadedDataFile: string | undefined,
  isCurrent: () => boolean
): Promise<DataInitializationResult | undefined> {
  let planetData: Awaited<ReturnType<typeof fetchPlanetData>> | undefined;
  let source: { kind: 'builtin' | 'file'; name: string } = {
    kind: 'builtin',
    name: 'exoplanets'
  };
  const requestedFileName = loadedDataFile
    ? normalizeOpenSpacePath(loadedDataFile).split('/').pop()
    : undefined;
  let dataFileName = 'aggregated_data.csv';
  let requestedFileUnavailable = Boolean(loadedDataFile && !hostedRelativePath);
  let usedBundledFallback = false;

  if (hostedRelativePath) {
    try {
      planetData = await fetchPlanetData(buildOpenSpaceDataUrl(hostedRelativePath));
      source = { kind: 'file', name: hostedRelativePath };
      dataFileName = requestedFileName ?? hostedRelativePath;
    } catch {
      requestedFileUnavailable = true;
    }
  }

  if (planetData === undefined) {
    try {
      planetData = await fetchPlanetData(buildOpenSpaceDataUrl('aggregated_data.csv'));
    } catch {
      planetData = await fetchPlanetData(fallbackDataUrl);
      dataFileName = 'aggregated_data.json';
      usedBundledFallback = true;
    }
  }

  if (!isCurrent()) {
    return undefined;
  }

  store.dispatch(initializeDataAction({ rows: planetData, source, dataFileName }));

  const warnings: string[] = [];
  if (requestedFileUnavailable && usedBundledFallback) {
    warnings.push(
      `The webpage could not access the currently loaded OpenSpace file "${requestedFileName}" or the default dataset. Using the bundled dataset "${dataFileName}", which may be outdated.`
    );
  } else if (requestedFileUnavailable) {
    warnings.push(
      `The webpage could not access the currently loaded OpenSpace file "${requestedFileName}". Using the default OpenSpace dataset "${dataFileName}" instead.`
    );
  } else if (usedBundledFallback) {
    warnings.push(
      `OpenSpace data could not be loaded; using the bundled dataset "${dataFileName}", which may be outdated.`
    );
  }

  return { warnings };
}

/**
 * Applies URL column settings and resolves uncertainty columns for the selected chart.
 */
function initializeColumns(): ColumnInitializationResult {
  const warnings: string[] = [];
  const { chart, columns: requestedColumns } = startupConfig;
  if (chart && requestedColumns) {
    const { columns, columnData } = store.getState().data;
    const selectedColumns = requestedColumns.filter(
      (column) =>
        columns.includes(column) &&
        (chart === 'parallelcoordinates' || columnData[column]?.type === 'number')
    );
    if (selectedColumns.length === 0) {
      warnings.push('No valid URL columns; keeping the saved or default columns.');
    } else {
      if (selectedColumns.length !== requestedColumns.length) {
        warnings.push('Unavailable or nonnumeric URL columns were ignored.');
      }
      if (chart === 'parallelcoordinates') {
        store.dispatch(setParallelCoordinatesSelectedColumns(selectedColumns));
        store.dispatch(setParallelCoordinatesColumnOrder(selectedColumns));
      } else {
        store.dispatch(setCornerPlotSelectedColumns(selectedColumns));
      }
    }
  }

  let uncertaintyColumns: string[] = [];
  if (chart === 'parallelcoordinates' && startupConfig.uncertaintyColumns) {
    const { data, local } = store.getState();
    uncertaintyColumns = getEligibleUncertaintyColumns(
      startupConfig.uncertaintyColumns,
      local.parallelCoordinates.settings.selectedColumns,
      data.columnData,
      data.uncertaintyDomains
    );
    if (uncertaintyColumns.length !== startupConfig.uncertaintyColumns.length) {
      warnings.push(
        'Uncertainty columns that are not selected numeric axes with uncertainty data were ignored.'
      );
    }
  }
  return { warnings, uncertaintyColumns };
}

/** Loads planet data and keeps it synchronized with OpenSpace's loaded-file property. */
export function usePlanetDataInitialization() {
  const [startupInfo, setStartupInfo] = useState<PlanetDataStartupInfo>();
  const [error, setError] = useState<string>();
  const [isSyncing, setIsSyncing] = useState(false);
  const connectionStatus = useAppSelector((state) => state.connection.connectionStatus);
  const hasLoadedData = useRef(false);

  useEffect(() => {
    // Prevent this effect instance from updating state after cleanup or reconnect.
    let active = true;
    // Each load gets a new ID so a slower, older request cannot replace newer data.
    let requestId = 0;
    let lastLoadedDataFile: string | undefined;
    let cancelSubscription = () => {};

    const loadDataset = async (loadedDataFile?: string) => {
      // Do not proceed with async loading if this effect is no longer active
      if (!active) {
        return;
      }

      // No need to reload if the loaded data file has not changed
      if (loadedDataFile && loadedDataFile === lastLoadedDataFile) {
        return;
      }

      // Update the last loaded data file if a new one is provided
      if (loadedDataFile) {
        lastLoadedDataFile = loadedDataFile;
      }

      const currentRequestId = ++requestId;
      setIsSyncing(true);

      try {
        const hostedDataLocation = loadedDataFile
          ? await readStringProperty(hostedDataLocationProperty)
          : undefined;
        const hostedRelativePath =
          loadedDataFile && hostedDataLocation
            ? getHostedRelativePath(loadedDataFile, hostedDataLocation)
            : undefined;

        // Abort if this request is no longer the latest or the effect is inactive
        if (!active || currentRequestId !== requestId) {
          return;
        }

        const dataInitialization = await initializeData(
          hostedRelativePath,
          loadedDataFile,
          () => active && currentRequestId === requestId
        );
        if (!dataInitialization || !active || currentRequestId !== requestId) {
          return;
        }

        const columnInitialization = initializeColumns();
        setStartupInfo({
          warnings: [
            ...dataInitialization.warnings,
            ...startupConfig.warnings,
            ...columnInitialization.warnings
          ],
          uncertaintyColumns: columnInitialization.uncertaintyColumns
        });
        hasLoadedData.current = true;
        setError(undefined);
      } catch (reason: unknown) {
        if (active && currentRequestId === requestId) {
          setError(
            reason instanceof Error ? reason.message : 'Could not load planet data.'
          );
        }
      } finally {
        if (active && currentRequestId === requestId) {
          setIsSyncing(false);
        }
      }
    };

    if (connectionStatus === ConnectionStatus.Connected) {
      try {
        // Subscribe first so file changes during the initial read are not missed
        const subscription = api.subscribeToProperty(
          loadedDataFileProperty,
          'StringProperty'
        );
        cancelSubscription = () => subscription.cancel();

        (async () => {
          try {
            for await (const data of subscription) {
              if (data.type === 'value') {
                loadDataset(data.value);
              }
            }
          } catch (reason) {
            if (active) {
              console.error('OpenSpace data-file subscription failed:', reason);
            }
          }
        })();

        readStringProperty(loadedDataFileProperty).then((loadedDataFile) =>
          loadDataset(loadedDataFile)
        );
      } catch {
        loadDataset();
      }
    } else if (!hasLoadedData.current) {
      // Load fallback data while disconnected; a later connection loads the current file
      loadDataset();
    }

    return () => {
      active = false;
      requestId += 1;
      cancelSubscription();
      setIsSyncing(false);
    };
  }, [connectionStatus]);

  return { startupInfo, error, setError, isSyncing };
}
