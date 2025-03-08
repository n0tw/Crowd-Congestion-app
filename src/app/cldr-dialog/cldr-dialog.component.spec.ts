import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CldrDialogComponent } from './cldr-dialog.component';

describe('CldrDialogComponent', () => {
  let component: CldrDialogComponent;
  let fixture: ComponentFixture<CldrDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CldrDialogComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CldrDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
