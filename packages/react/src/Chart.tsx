import { useEffect, useRef } from 'react';
import { createChartController } from 'keystone-chartjs-core';
import type { ChartConfiguration, ChartKind } from 'keystone-chartjs-core';

// Single generic <Chart type="..."> component (decided architecture: one
// component, not per-type components — see docs/IMPLEMENTATION_PLAN.md
// Phase 3). Placeholder only: canvas ref + controller wiring on mount,
// full teardown on unmount. No options-diffing/theme/resize logic yet —
// currently rebuilds the whole chart if `data`/`options` change identity,
// rather than calling chart.update().

export interface ChartProps {
  type: ChartKind;
  data: ChartConfiguration['data'];
  options?: ChartConfiguration['options'];
}

export function Chart({ type, data, options }: ChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const instance = createChartController(canvasRef.current, {
      kind: type,
      config: { type, data, options },
    });
    return () => instance.destroy();
  }, [type, data, options]);

  return <canvas ref={canvasRef} />;
}
