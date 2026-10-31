import { describe, it, expect } from "vitest";
import { AuthorizationPolicy } from "../../src/security/authorization.policy.js";

describe("Anti-IDOR Security: Cross-Tenant Authorization Matrix", () => {
  const userAId = "11111111-1111-1111-1111-111111111111";
  const userBId = "22222222-2222-2222-2222-222222222222";
  const adminId = "99999999-9999-9999-9999-999999999999";

  const userAResource = { userId: userAId };

  it("allows owner (User A) to access their own resource", () => {
    const isAllowed = AuthorizationPolicy.canAccess(
      userAId,
      "USER",
      userAResource,
    );
    expect(isAllowed).toBe(true);
  });

  it("BLOCKS attacker (User B) attempting to access User A resource (Anti-IDOR)", () => {
    const isAllowed = AuthorizationPolicy.canAccess(
      userBId,
      "USER",
      userAResource,
    );
    expect(isAllowed).toBe(false);
  });

  it("allows system ADMIN to access resource for moderation/compliance", () => {
    const isAllowed = AuthorizationPolicy.canAccess(
      adminId,
      "ADMIN",
      userAResource,
    );
    expect(isAllowed).toBe(true);
  });

  it("enforces nested hierarchical validation", () => {
    const resumeId = "resume-100";
    const sectionId = "section-500";

    // Legitimate nested hierarchy
    expect(
      AuthorizationPolicy.canAccessNested(
        userAId,
        userAId,
        sectionId,
        sectionId,
      ),
    ).toBe(true);

    // Attacker does not own parent container
    expect(
      AuthorizationPolicy.canAccessNested(
        userBId,
        userAId,
        sectionId,
        sectionId,
      ),
    ).toBe(false);

    // Mismatched parent container ID
    expect(
      AuthorizationPolicy.canAccessNested(
        userAId,
        userAId,
        "other-section-999",
        sectionId,
      ),
    ).toBe(false);
  });
});
