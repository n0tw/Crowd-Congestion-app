import { Component, Inject, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-exceldata',
  templateUrl: './exceldata.component.html',
  styleUrls: ['./exceldata.component.css'],
})
export class ExceldataComponent implements AfterViewInit {
  @ViewChild('dialogTitle', { static: false }) dialogTitle!: ElementRef;

  constructor(
    public dialogRef: MatDialogRef<ExceldataComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {}

  ngAfterViewInit(): void {
    if (this.dialogTitle) {
      this.dialogTitle.nativeElement.focus();
    }
  }

  closeDialog(): void {
    this.dialogRef.close();
  }
}
