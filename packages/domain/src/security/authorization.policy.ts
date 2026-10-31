export interface ResourceOwned {
  userId: string;
}

export class AuthorizationPolicy {
  /**
   * Enforces zero-trust ownership check (anti-IDOR).
   * Returns true if the requesting user owns the resource or has an ADMIN role.
   */
  static canAccess(
    requestingUserId: string,
    requestingUserRole: "VISITOR" | "USER" | "PREMIUM" | "ADMIN",
    resource: ResourceOwned,
  ): boolean {
    if (requestingUserRole === "ADMIN") {
      return true;
    }
    return resource.userId === requestingUserId;
  }

  /**
   * Validates hierarchical resource ownership (nested route anti-IDOR).
   * Asserts that a child resource is linked to the validated parent container.
   */
  static canAccessNested(
    requestingUserId: string,
    parentOwnerId: string,
    childParentId: string,
    expectedParentId: string,
  ): boolean {
    if (parentOwnerId !== requestingUserId) {
      return false;
    }
    return childParentId === expectedParentId;
  }
}
