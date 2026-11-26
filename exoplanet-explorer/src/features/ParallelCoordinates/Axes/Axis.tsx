import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

import type { Dimension } from '../types';

interface Props {
  dimension: Dimension;
  handleBrush: (dimension: Dimension, y0: number, y1: number) => void;
  handleBrushClear?: (dimension: Dimension) => void;
  updateOnBrushEnd: boolean;
  brushSelection?: [number, number];
  onMovePrevious?: () => void;
  onMoveNext?: () => void;
}

export function Axis({
  dimension,
  handleBrush,
  handleBrushClear,
  updateOnBrushEnd,
  brushSelection,
  onMovePrevious,
  onMoveNext
}: Props) {
  const ref = useRef<SVGGElement>(null);
  const headerRef = useRef<SVGGElement>(null);
  const dragStartXRef = useRef<number | null>(null);

  const brushRef = useRef<SVGGElement>(null);
  const brushBehaviorRef = useRef<d3.BrushBehavior<unknown> | null>(null);
  const handleBrushRef = useRef(handleBrush);
  const handleBrushClearRef = useRef(handleBrushClear);
  const updateOnBrushEndRef = useRef(updateOnBrushEnd);
  const brushWidth = 7;

  useEffect(() => {
    handleBrushRef.current = handleBrush;
    handleBrushClearRef.current = handleBrushClear;
    updateOnBrushEndRef.current = updateOnBrushEnd;
  }, [handleBrush, handleBrushClear, updateOnBrushEnd]);

  // Axis setup
  useEffect(() => {
    if (!ref.current) return;

    const { scale } = dimension;
    const axis =
      'ticks' in scale ? d3.axisLeft<number>(scale) : d3.axisLeft<string>(scale);

    d3.select(ref.current).call(axis);
  }, [dimension]);

  useEffect(() => {
    if (!headerRef.current) return;

    const headerSelection = d3.select(headerRef.current);

    const dragBehavior = d3
      .drag<SVGGElement, unknown>()
      .on('start', (event) => {
        dragStartXRef.current = event.x;
        headerSelection.style('cursor', 'grabbing');
      })
      .on('drag', (event) => {
        const startX = dragStartXRef.current;
        if (startX === null) return;

        const deltaX = event.x - startX;
        const maxOffset = 20;
        const visualOffset = Math.max(-maxOffset, Math.min(maxOffset, deltaX * 0.35));
        headerSelection.attr('transform', `translate(${visualOffset}, 0)`);
      })
      .on('end', (event) => {
        const startX = dragStartXRef.current;
        dragStartXRef.current = null;
        headerSelection.attr('transform', null);
        headerSelection.style('cursor', 'grab');

        if (startX === null) return;

        const deltaX = event.x - startX;
        if (Math.abs(deltaX) < 10) return;

        if (deltaX < 0) {
          onMovePrevious?.();
        } else {
          onMoveNext?.();
        }
      });

    d3.select(headerRef.current).call(
      dragBehavior as d3.DragBehavior<SVGGElement, unknown, unknown>
    );

    return () => {
      headerSelection.attr('transform', null);
      headerSelection.style('cursor', 'grab');
      headerSelection.on('.drag', null);
    };
  }, [onMovePrevious, onMoveNext]);

  // Create brush behavior once per axis scale/key changes.
  useEffect(() => {
    if (!brushRef.current) return;

    const brush = d3
      .brushY()
      .extent([
        [-brushWidth, dimension.scale.range()[1]],
        [brushWidth, dimension.scale.range()[0]]
      ])
      .on('brush end', (event) => {
        if (
          !event.sourceEvent ||
          (updateOnBrushEndRef.current && event.type === 'brush')
        ) {
          return;
        }

        const { selection } = event;

        if (!selection) {
          handleBrushClearRef.current?.(dimension);
          return;
        }

        const [y0, y1] = selection;
        handleBrushRef.current(dimension, y0, y1);
      });

    brushBehaviorRef.current = brush;
    const brushSelectionGroup = d3.select(brushRef.current);
    brushSelectionGroup.call(brush);
  }, [dimension]);

  // Keep visual brush in sync without re-creating behavior on each render.
  useEffect(() => {
    if (!brushRef.current || !brushBehaviorRef.current) return;

    const group = d3.select(brushRef.current);
    const currentSelection = d3.brushSelection(brushRef.current) as
      [number, number] | null;
    const nextSelection = brushSelection ?? null;

    const areEqual =
      (currentSelection === null && nextSelection === null) ||
      (currentSelection !== null &&
        nextSelection !== null &&
        Math.abs(currentSelection[0] - nextSelection[0]) < 0.5 &&
        Math.abs(currentSelection[1] - nextSelection[1]) < 0.5);

    if (areEqual) {
      return;
    }

    group.call(brushBehaviorRef.current.move, nextSelection);
  }, [brushSelection]);

  return (
    <g>
      <g ref={headerRef} style={{ cursor: 'grab' }}>
        <text
          className={'legend'}
          y={-9}
          fontSize={'11px'}
          fill={'var(--mantine-color-default-color)'}
          transform={'rotate(-21)'}
          textAnchor={'start'}
          opacity={dimension.isUncertainty ? 0.5 : 1.0}
        >
          {dimension.key}
        </text>
      </g>
      <g ref={ref} opacity={dimension.isUncertainty ? 0.5 : 1.0} />
      <g ref={brushRef} />
    </g>
  );
}
