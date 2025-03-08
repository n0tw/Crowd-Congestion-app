import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BusInfoComponent } from './bus-info.component';

describe('BusInfoComponent', () => {
  let component: BusInfoComponent;
  let fixture: ComponentFixture<BusInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BusInfoComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BusInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
