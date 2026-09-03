import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';

// Real Chart.js is deliberately mocked here, same as everywhere else in
// this monorepo's test suites (see e.g. controller.spec.ts's own
// MockChart) — for the identical reason: jsdom has no real canvas 2D
// context implementation, so the real Chart.js constructor would throw
// "can't acquire context from the given item" the moment it calls
// canvas.getContext('2d'). Since createChartController is async and this
// smoke test's own ngAfterViewInit call is never awaited, that throw
// would surface as an unhandled rejection rather than a synchronous
// failure — mocked away here before it can happen, keeping this test
// scoped to what it's actually meant to prove (the Jest + TestBed
// wiring itself, not real Chart.js behavior).
//
// `jest.mock` + Jest's own ambient globals (describe/it/expect/jest),
// not `vi.mock`/an import from `'vitest'` — this package switched its
// test runner from Vitest to Jest after hitting a genuinely unresolved
// upstream ecosystem bug (see jest.config.ts's own header comment).
jest.mock('chart.js', () => ({
  Chart: class {
    static register = jest.fn();
    constructor() {}
  },
}));

import { KeystoneChartComponent } from '../../src/keystone-chart.component';

// Phase 0 smoke test — proves the Jest + Angular TestBed wiring itself
// works (component compiles, mounts, renders a <canvas>), not the chart
// behavior. Real component-level tests (per chart kind, update-vs-recreate,
// resize handling) land in Phase 4 once the placeholder component in
// keystone-chart.component.ts is replaced with a real implementation
// wired to keystone-chartjs-core (see docs/IMPLEMENTATION_PLAN.md).
@Component({
  standalone: true,
  imports: [KeystoneChartComponent],
  template: `<keystone-chart type="bar" [data]="data" />`,
})
class HostComponent {
  data = { labels: ['a', 'b'], datasets: [{ label: 'Test', data: [1, 2] }] };
}

describe('KeystoneChartComponent (Phase 0 smoke test)', () => {
  it('mounts inside a host component and renders a canvas', async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const canvas = fixture.nativeElement.querySelector('canvas');
    expect(canvas).not.toBeNull();
  });
});
