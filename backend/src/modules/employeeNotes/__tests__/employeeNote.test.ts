import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../../../app";
import { Role } from "../../../generated/prisma/enums";
import {
  createTestEmployee,
  createTestManager,
  createTestOrganization,
  createTestStore,
  createTestUser,
} from "../../../../tests/factories";

async function loginAs(email: string, password: string): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.body.accessToken as string;
}

async function createOrgAdmin(organizationId: string) {
  const { user, password } = await createTestUser({ role: Role.ORGANIZATION_ADMIN, organizationId });
  const token = await loginAs(user.email, password);
  return { token, userId: user.id };
}

describe("POST /api/employee-notes", () => {
  it("organization admin can create a note for an employee in their organization", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const admin = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employee-notes")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, body: "Great performance this quarter." });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      employeeId: employee.id,
      authorUserId: admin.userId,
      body: "Great performance this quarter.",
    });
  });

  it("store manager can create a note for an employee in their own store", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .post("/api/employee-notes")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: employee.id, body: "Arrived late twice this week." });

    expect(res.status).toBe(201);
    expect(res.body.authorUserId).toBe(user.id);
  });

  it("organization admin cannot create a note for another organization's employee (404)", async () => {
    const org = await createTestOrganization("Org A");
    const otherOrg = await createTestOrganization("Org B");
    const otherStore = await createTestStore(otherOrg.id);
    const { employee } = await createTestEmployee({ organizationId: otherOrg.id, storeId: otherStore.id });
    const admin = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employee-notes")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, body: "Should not be allowed." });

    expect(res.status).toBe(404);
  });

  it("store manager cannot create a note for another store's employee (404)", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const { user, password } = await createTestManager({ organizationId: org.id, storeId: storeA.id });
    const token = await loginAs(user.email, password);

    const res = await request(app)
      .post("/api/employee-notes")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: employee.id, body: "Should not be allowed." });

    expect(res.status).toBe(404);
  });

  it("author is always taken from the authenticated user, never client-supplied", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const admin = await createOrgAdmin(org.id);
    const someoneElse = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employee-notes")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, body: "Note body.", authorUserId: someoneElse.userId });

    // authorUserId isn't an accepted field at all — .strict() rejects it.
    expect(res.status).toBe(422);
  });

  it("rejects a client-supplied organizationId", async () => {
    const org = await createTestOrganization();
    const otherOrg = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const admin = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employee-notes")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, body: "Note body.", organizationId: otherOrg.id });

    expect(res.status).toBe(422);
  });

  it("rejects an invalid employeeId", async () => {
    const org = await createTestOrganization();
    const admin = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employee-notes")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: "not-a-uuid", body: "Note body." });

    expect(res.status).toBe(422);
  });

  it("rejects an empty note body", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const admin = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employee-notes")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, body: "" });

    expect(res.status).toBe(422);
  });

  it("rejects an oversized note body", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const admin = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employee-notes")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, body: "x".repeat(2001) });

    expect(res.status).toBe(422);
  });

  it("rejects unknown fields", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const admin = await createOrgAdmin(org.id);

    const res = await request(app)
      .post("/api/employee-notes")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ employeeId: employee.id, body: "Note body.", createdAt: new Date().toISOString() });

    expect(res.status).toBe(422);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });

    const res = await request(app)
      .post("/api/employee-notes")
      .send({ employeeId: employee.id, body: "Note body." });

    expect(res.status).toBe(401);
  });

  it("rejects EMPLOYEE role with 403", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { user, employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const token = await loginAs(user.email, "Test1234!");

    const res = await request(app)
      .post("/api/employee-notes")
      .set("Authorization", `Bearer ${token}`)
      .send({ employeeId: employee.id, body: "Note body." });

    expect(res.status).toBe(403);
  });
});

describe("GET /api/employee-notes", () => {
  it("organization admin lists notes across their organization", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empA } = await createTestEmployee({ organizationId: org.id, storeId: storeA.id });
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const admin = await createOrgAdmin(org.id);

    await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: empA.id, body: "Note A" });
    await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: empB.id, body: "Note B" });

    const res = await request(app).get("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("store manager lists only notes for employees in their assigned store", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empA } = await createTestEmployee({ organizationId: org.id, storeId: storeA.id });
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const admin = await createOrgAdmin(org.id);
    await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: empA.id, body: "Note A" });
    await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: empB.id, body: "Note B" });

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: storeA.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app).get("/api/employee-notes").set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].employeeId).toBe(empA.id);
  });

  it("filtering by employeeId works", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee: empA } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const admin = await createOrgAdmin(org.id);
    await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: empA.id, body: "Note A" });
    await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: empB.id, body: "Note B" });

    const res = await request(app)
      .get(`/api/employee-notes?employeeId=${empA.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].employeeId).toBe(empA.id);
  });

  it("store manager cannot use employeeId filtering to escape their store (empty result)", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee: empB } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const admin = await createOrgAdmin(org.id);
    await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: empB.id, body: "Note B" });

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: storeA.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/employee-notes?employeeId=${empB.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  it("returns notes newest first", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const admin = await createOrgAdmin(org.id);

    const first = await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, body: "First note" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    const second = await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, body: "Second note" });

    const res = await request(app).get("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`);

    expect(res.body[0].id).toBe(second.body.id);
    expect(res.body[1].id).toBe(first.body.id);
  });
});

describe("GET /api/employee-notes/:noteId", () => {
  it("organization admin can retrieve an accessible note", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const admin = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, body: "Note body." });

    const res = await request(app)
      .get(`/api/employee-notes/${createRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(createRes.body.id);
  });

  it("store manager can retrieve an accessible note", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const admin = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, body: "Note body." });

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: store.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/employee-notes/${createRes.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(200);
  });

  it("cross-organization note access returns 404", async () => {
    const org = await createTestOrganization("Org A");
    const otherOrg = await createTestOrganization("Org B");
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const admin = await createOrgAdmin(org.id);
    const otherAdmin = await createOrgAdmin(otherOrg.id);
    const createRes = await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, body: "Note body." });

    const res = await request(app)
      .get(`/api/employee-notes/${createRes.body.id}`)
      .set("Authorization", `Bearer ${otherAdmin.token}`);

    expect(res.status).toBe(404);
  });

  it("cross-store note access returns 404 for a store manager", async () => {
    const org = await createTestOrganization();
    const storeA = await createTestStore(org.id, "Store A");
    const storeB = await createTestStore(org.id, "Store B");
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: storeB.id });
    const admin = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, body: "Note body." });

    const { user, password } = await createTestManager({ organizationId: org.id, storeId: storeA.id });
    const managerToken = await loginAs(user.email, password);

    const res = await request(app)
      .get(`/api/employee-notes/${createRes.body.id}`)
      .set("Authorization", `Bearer ${managerToken}`);

    expect(res.status).toBe(404);
  });
});

describe("append-only behavior", () => {
  // Authenticated on purpose: the router-level `authenticate` middleware
  // applies to every method under this mount point, so an unauthenticated
  // request would get 401 before Express ever checks whether a route
  // matches — masking exactly the thing these tests exist to prove. A
  // valid token gets past auth and lands on Express's own "no route
  // matched" 404, confirming these methods were genuinely never registered.
  it("no PATCH route exists", async () => {
    const org = await createTestOrganization();
    const admin = await createOrgAdmin(org.id);
    const res = await request(app)
      .patch("/api/employee-notes/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ body: "edited" });
    expect(res.status).toBe(404);
  });

  it("no PUT route exists", async () => {
    const org = await createTestOrganization();
    const admin = await createOrgAdmin(org.id);
    const res = await request(app)
      .put("/api/employee-notes/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ body: "edited" });
    expect(res.status).toBe(404);
  });

  it("no DELETE route exists", async () => {
    const org = await createTestOrganization();
    const admin = await createOrgAdmin(org.id);
    const res = await request(app)
      .delete("/api/employee-notes/00000000-0000-0000-0000-000000000000")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(res.status).toBe(404);
  });

  it("a note remains unchanged after creation (re-fetch matches original)", async () => {
    const org = await createTestOrganization();
    const store = await createTestStore(org.id);
    const { employee } = await createTestEmployee({ organizationId: org.id, storeId: store.id });
    const admin = await createOrgAdmin(org.id);
    const createRes = await request(app).post("/api/employee-notes").set("Authorization", `Bearer ${admin.token}`).send({ employeeId: employee.id, body: "Immutable note." });

    const res = await request(app)
      .get(`/api/employee-notes/${createRes.body.id}`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(res.body).toEqual(createRes.body);
  });
});
