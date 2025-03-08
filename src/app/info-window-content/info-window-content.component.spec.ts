import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InfoWindowContentComponent } from './info-window-content.component';

describe('InfoWindowContentComponent', () => {
  let component: InfoWindowContentComponent;
  let fixture: ComponentFixture<InfoWindowContentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoWindowContentComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(InfoWindowContentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
