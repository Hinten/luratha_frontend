import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextResponse } from "next/server";
import { z } from "zod";

const { mockRequireUser, mockAuthErrorResponse, mockGetSiteSettings, mockSetSiteSettings } =
  vi.hoisted(() => ({
    mockRequireUser: vi.fn(),
    mockAuthErrorResponse: vi.fn(),
    mockGetSiteSettings: vi.fn(),
    mockSetSiteSettings: vi.fn(),
  }));

vi.mock("@luratha/auth/requireUser", () => ({
  requireUser: mockRequireUser,
  authErrorResponse: mockAuthErrorResponse,
}));

vi.mock("@luratha/repositories/siteSettingsRepository", () => ({
  getSiteSettings: mockGetSiteSettings,
  setSiteSettings: mockSetSiteSettings,
}));

import { PATCH } from "../route";

const ADMIN = { uid: "u1", email: "admin@luratha.com.br", isAdmin: true };
const CURRENT = { id: "global", shipping: { providerId: "melhor-envio" }, updatedAt: "t0" };
const SAVED = { id: "global", shipping: { providerId: "fixed-rate" }, updatedAt: "t1" };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireUser.mockResolvedValue(ADMIN);
  mockAuthErrorResponse.mockReturnValue(null);
  mockGetSiteSettings.mockResolvedValue(CURRENT);
  mockSetSiteSettings.mockResolvedValue(SAVED);
});

describe("PATCH /api/settings", () => {
  it("returns 401 when the request is not authenticated", async () => {
    mockRequireUser.mockRejectedValue(new Error("unauth"));
    mockAuthErrorResponse.mockReturnValue(
      NextResponse.json({ message: "Não autenticado." }, { status: 401 }),
    );

    const response = await PATCH(makeRequest({ shipping: {} }));

    expect(response.status).toBe(401);
    expect(mockSetSiteSettings).not.toHaveBeenCalled();
  });

  it("returns 403 when the user is not an admin", async () => {
    mockRequireUser.mockResolvedValue({ ...ADMIN, isAdmin: false });

    const response = await PATCH(makeRequest({ shipping: {} }));

    expect(response.status).toBe(403);
    expect(mockSetSiteSettings).not.toHaveBeenCalled();
  });

  it("returns 400 when the body is not a JSON object", async () => {
    const response = await PATCH(makeRequest([1, 2, 3]));

    expect(response.status).toBe(400);
    expect(mockSetSiteSettings).not.toHaveBeenCalled();
  });

  it("returns 400 on invalid JSON", async () => {
    const request = new Request("http://localhost/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "{ not json",
    });

    const response = await PATCH(request);

    expect(response.status).toBe(400);
    expect(mockSetSiteSettings).not.toHaveBeenCalled();
  });

  it("merges the payload over the current document and persists", async () => {
    const payload = { shipping: { providerId: "fixed-rate" } };

    const response = await PATCH(makeRequest(payload));

    expect(response.status).toBe(200);
    expect(mockGetSiteSettings).toHaveBeenCalledWith({ forceFresh: true });
    // { ...current, ...payload } — payload.shipping replaces the stored block.
    expect(mockSetSiteSettings).toHaveBeenCalledWith({
      id: "global",
      shipping: { providerId: "fixed-rate" },
      updatedAt: "t0",
    });
    expect(await response.json()).toEqual(SAVED);
  });

  it("merges a company block over the current document and persists", async () => {
    const company = {
      legalName: "Luratha Comércio de Roupas LTDA",
      cnpj: "00.000.000/0001-00",
      dpoName: "Maria Silva",
      dpoEmail: "dpo@luratha.com.br",
    };

    const response = await PATCH(makeRequest({ company }));

    expect(response.status).toBe(200);
    expect(mockGetSiteSettings).toHaveBeenCalledWith({ forceFresh: true });
    // { ...current, ...payload } — the company block is added without touching shipping.
    expect(mockSetSiteSettings).toHaveBeenCalledWith({
      id: "global",
      shipping: { providerId: "melhor-envio" },
      updatedAt: "t0",
      company,
    });
  });

  it("returns 400 with issues when the merged document fails validation", async () => {
    mockSetSiteSettings.mockImplementation(async () => {
      z.number().parse("not a number"); // throws ZodError
      return SAVED;
    });

    const response = await PATCH(makeRequest({ shipping: {} }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.errors).toBeDefined();
  });
});
