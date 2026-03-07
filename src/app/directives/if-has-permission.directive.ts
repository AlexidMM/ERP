import { Directive, Input, OnChanges, SimpleChanges, TemplateRef, ViewContainerRef, inject } from '@angular/core';
import { PermissionsService } from '../services/permissions.service';

@Directive({
  selector: '[ifHasPermission]',
  standalone: true
})
export class IfHasPermissionDirective implements OnChanges {
  @Input('ifHasPermission') requiredPermissions: string | string[] = [];

  private readonly permissionsService = inject(PermissionsService);
  private readonly templateRef = inject(TemplateRef<unknown>);
  private readonly viewContainer = inject(ViewContainerRef);

  ngOnChanges(_changes: SimpleChanges): void {
    const required = Array.isArray(this.requiredPermissions)
      ? this.requiredPermissions
      : [this.requiredPermissions];

    const canShow = this.permissionsService.hasAnyPermission(required);

    this.viewContainer.clear();
    if (canShow) {
      this.viewContainer.createEmbeddedView(this.templateRef);
    }
  }
}
