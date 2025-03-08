import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EnvInfoComponent } from './env-info.component';

describe('EnvInfoComponent', () => {
  let component: EnvInfoComponent;
  let fixture: ComponentFixture<EnvInfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EnvInfoComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(EnvInfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
