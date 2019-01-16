import { NgModule, ModuleWithProviders } from '@angular/core';
import { CommonModule } from '@angular/common';

export * from './file-item.class';
export * from './file-like-object.class';
export * from './file-type.class';
export * from './queue-controller.class';

@NgModule({
  imports: [
    CommonModule
  ],
  declarations: [
  ],
  exports: [
  ]
})
export class MoontechFileUploadModule {
  static forRoot(): ModuleWithProviders {
    return {
      ngModule: MoontechFileUploadModule,
    };
  }
}
