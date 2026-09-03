import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  AfterViewInit,
  ViewChild,
  SimpleChanges,
} from '@angular/core';
import { createChartController } from 'keystone-chartjs-core';
import type { ChartConfiguration, ChartControllerHandle, ChartKind } from 'keystone-chartjs-core';

// Single generic <keystone-chart [type]="..."> component (decided
// architecture: one component, not per-type components — see
// docs/IMPLEMENTATION_PLAN.md Phase 4). Standalone (no NgModule),
// matching keystone-dashboard-layout's Angular package convention.
// Placeholder only: canvas ref + controller wiring, full rebuild on any
// input change rather than a diffed chart.update() — the destroy+recreate
// behavior itself is a deliberate, known Phase 4 TODO, left as-is here.
//
// Real Phase 1 API used correctly (not the stale sync/nested-shape one
// this file originally called, which crashed Chart.js at runtime with
// `type: undefined, data: undefined` — confirmed by reading the real
// createChartController signature directly, not assumed): it's async and
// takes a flat `{ type, data, options }` payload, not
// `{ kind, config: { ... } }`. `instance` now holds the pending Promise
// itself (not a resolved handle synchronously), since the real function
// returns one.
@Component({
  selector: 'keystone-chart',
  standalone: true,
  template: `<canvas #canvas></canvas>`,
})
export class KeystoneChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) type!: ChartKind;
  @Input({ required: true }) data!: ChartConfiguration['data'];
  @Input() options?: ChartConfiguration['options'];

  @ViewChild('canvas') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private instance?: Promise<ChartControllerHandle>;

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.canvasRef) return; // first change fires before view init
    if (changes['type'] || changes['data'] || changes['options']) {
      void this.instance?.then((handle) => handle.destroy());
      this.render();
    }
  }

  ngOnDestroy(): void {
    void this.instance?.then((handle) => handle.destroy());
  }

  private render(): void {
    this.instance = createChartController(this.canvasRef.nativeElement, {
      type: this.type,
      data: this.data,
      options: this.options,
    });
  }
}
