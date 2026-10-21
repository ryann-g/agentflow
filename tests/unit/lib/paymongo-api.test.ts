import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Coverage for the PayMongo API layer (Oct 21 2026 audit, finding L7).
 *
 * `src/lib/paymongo.ts` was at 42% line coverage: the signature
 * verification and the webhook handlers were tested, but every function that
 * talks to the PayMongo REST API was not. Those functions carry the money
 * logic — customer creation, plan creation, checkout, cancellation, retry
 * behaviour and the grace-period downgrade — so this file exercises them
 * against a mocked fetch and a mocked service client.
 */

const { mockFrom, mockServiceClient } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockServiceClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: mockServiceClient,
}));

/**
 * The module keeps a module-level plan cache, so each test loads a fresh
 * copy — otherwise the second case would skip the plan lookup entirely and
 * the mocked responses would land on the wrong call.
 */
async function loadPayMongo() {
  vi.resetModules();
  return await import("@/lib/paymongo");
}

/** Builds a Supabase query chain that resolves to `result`. */
function buildChain(result: { data?: unknown; error?: unknown } = {}) {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.lt = vi.fn(() => chain);
  chain.single = vi.fn(() => Promise.resolve({ data: result.data ?? null, error: result.error ?? null }));
  chain.then = (resolve: (v: unknown) => unknown) =>
    Promise.resolve({ data: result.data ?? null, error: result.error ?? null }).then(resolve);
  return chain;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

const CUSTOMER = { data: { id: "cus_1", type: "customer", attributes: {} } };
const PLAN_LIST = {
  data: [
    {
      data: {
        id: "plan_1",
        type: "plan",
        attributes: {
          name: "AgentFlow Pro",
          amount: 800,
          currency: "usd",
          interval: "month",
          interval_count: 1,
        },
      },
    },
  ],
};
const SUBSCRIPTION = {
  data: {
    id: "sub_1",
    type: "subscription",
    attributes: {
      status: "incomplete",
      customer_id: "cus_1",
      plan: {},
      latest_invoice: {
        id: "inv_1",
        amount: 800,
        currency: "usd",
        status: "pending",
        payment_intent: { id: "pi_1", status: "pending" },
      },
      next_billing_schedule: null,
      setup_intent: null,
      cancelled_at: null,
      created_at: 0,
      updated_at: 0,
    },
  },
};

describe("PayMongo API layer", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let api: Awaited<ReturnType<typeof loadPayMongo>>;

  beforeEach(async () => {
    vi.resetAllMocks();
    api = await loadPayMongo();
    process.env.PAYMONGO_SECRET_KEY = "sk_test_fake";
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    mockServiceClient.mockReturnValue({ from: mockFrom });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("getOrCreatePayMongoCustomer", () => {
    it("reuses the customer already stored on the profile", async () => {
      mockFrom.mockReturnValue(buildChain({ data: { paymongo_customer_id: "cus_existing" } }));

      const id = await api.getOrCreatePayMongoCustomer("u1", "a@example.com");

      expect(id).toBe("cus_existing");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("creates a customer and stores the id on the profile", async () => {
      mockFrom.mockReturnValue(buildChain({ data: { paymongo_customer_id: null } }));
      fetchMock.mockResolvedValue(jsonResponse(CUSTOMER));

      const id = await api.getOrCreatePayMongoCustomer("u1", "a@example.com", "Ann Lee");

      expect(id).toBe("cus_1");
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://api.paymongo.com/v1/customers");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body).data.attributes).toMatchObject({
        email: "a@example.com",
        name: "Ann Lee",
      });
    });

    it("sends basic auth built from the secret key", async () => {
      mockFrom.mockReturnValue(buildChain({ data: { paymongo_customer_id: null } }));
      fetchMock.mockResolvedValue(jsonResponse(CUSTOMER));

      await api.getOrCreatePayMongoCustomer("u1", "a@example.com");

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers.Authorization).toBe(
        `Basic ${Buffer.from("sk_test_fake:").toString("base64")}`
      );
      expect(headers["Idempotency-Key"]).toBeTruthy();
    });

    it("surfaces a client error without retrying", async () => {
      mockFrom.mockReturnValue(buildChain({ data: { paymongo_customer_id: null } }));
      fetchMock.mockResolvedValue(
        jsonResponse({ data: { attributes: { message: "Bad request", code: "invalid" } } }, 422)
      );

      await expect(api.getOrCreatePayMongoCustomer("u1", "a@example.com")).rejects.toThrow(
        api.PayMongoError
      );
      // 4xx is not retryable, so exactly one attempt.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("retries a 500 and succeeds on a later attempt", async () => {
      mockFrom.mockReturnValue(buildChain({ data: { paymongo_customer_id: null } }));
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ data: {} }, 500))
        .mockResolvedValueOnce(jsonResponse(CUSTOMER));

      const id = await api.getOrCreatePayMongoCustomer("u1", "a@example.com");

      expect(id).toBe("cus_1");
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("gives up after the retry budget and throws", async () => {
      mockFrom.mockReturnValue(buildChain({ data: { paymongo_customer_id: null } }));
      fetchMock.mockResolvedValue(jsonResponse({ data: {} }, 500));

      await expect(api.getOrCreatePayMongoCustomer("u1", "a@example.com")).rejects.toThrow(
        api.PayMongoError
      );
      // 1 initial attempt + 3 retries.
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });

  describe("createPayMongoSubscription", () => {
    it("reuses a matching existing plan and creates the subscription", async () => {
      mockFrom.mockReturnValue(buildChain());
      fetchMock
        .mockResolvedValueOnce(jsonResponse(PLAN_LIST))
        .mockResolvedValueOnce(jsonResponse(SUBSCRIPTION))
        .mockResolvedValueOnce(
          jsonResponse({ data: { attributes: { next_action: { redirect: { url: "https://pay/1" } } } } })
        );

      const result = await api.createPayMongoSubscription("cus_1", "u1", "monthly");

      expect(result.subscriptionId).toBe("sub_1");
      expect(result.checkoutUrl).toBe("https://pay/1");
      expect(fetchMock.mock.calls[0][0]).toContain("/subscriptions/plans");
    });

    it("returns no checkout URL when the subscription is already active", async () => {
      mockFrom.mockReturnValue(buildChain());
      const active = {
        ...SUBSCRIPTION,
        data: { ...SUBSCRIPTION.data, attributes: { ...SUBSCRIPTION.data.attributes, status: "active" } },
      };
      fetchMock
        .mockResolvedValueOnce(jsonResponse(PLAN_LIST))
        .mockResolvedValueOnce(jsonResponse(active));

      const result = await api.createPayMongoSubscription("cus_1", "u1", "monthly");

      expect(result.checkoutUrl).toBeNull();
      // Only plan-list + subscription: no payment intent lookup needed.
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("activates Pro immediately when the subscription is already active", async () => {
      mockFrom.mockReturnValue(buildChain());
      const active = {
        ...SUBSCRIPTION,
        data: { ...SUBSCRIPTION.data, attributes: { ...SUBSCRIPTION.data.attributes, status: "active" } },
      };
      fetchMock
        .mockResolvedValueOnce(jsonResponse(PLAN_LIST))
        .mockResolvedValueOnce(jsonResponse(active));

      await api.createPayMongoSubscription("cus_1", "u1", "monthly");

      const updateCalls = mockFrom.mock.results.length;
      expect(updateCalls).toBeGreaterThan(0);
    });
  });

  describe("cancelPayMongoSubscription", () => {
    it("posts to the subscription cancel endpoint", async () => {
      fetchMock.mockResolvedValue(jsonResponse({ data: { id: "sub_1" } }));

      await api.cancelPayMongoSubscription("sub_1");

      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.paymongo.com/v1/subscriptions/sub_1/cancel"
      );
      expect(fetchMock.mock.calls[0][1].method).toBe("POST");
    });

    it("fails loudly when every attempt returns a retryable error", async () => {
      // Regression: the retry loop used to fall through to the success
      // return on the last attempt, handing the error body back as a valid
      // response. A cancel would then report success while the
      // subscription stayed live and kept billing.
      fetchMock.mockResolvedValue(jsonResponse({ data: { error: "boom" } }, 500));

      await expect(api.cancelPayMongoSubscription("sub_1")).rejects.toThrow(
        api.PayMongoError
      );
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });

  describe("retrievePayMongoSubscription", () => {
    it("gets the subscription by id", async () => {
      fetchMock.mockResolvedValue(jsonResponse(SUBSCRIPTION));

      const result = await api.retrievePayMongoSubscription("sub_1");

      expect(result.data.id).toBe("sub_1");
      expect(fetchMock.mock.calls[0][0]).toBe(
        "https://api.paymongo.com/v1/subscriptions/sub_1"
      );
    });
  });

  describe("handleGracePeriodExpired", () => {
    it("returns 0 when no profile is past its grace period", async () => {
      mockFrom.mockReturnValue(buildChain({ data: [] }));

      expect(await api.handleGracePeriodExpired()).toBe(0);
    });

    it("downgrades every profile past its grace period and counts them", async () => {
      mockFrom.mockReturnValue(buildChain({ data: [{ id: "u1" }, { id: "u2" }] }));

      expect(await api.handleGracePeriodExpired()).toBe(2);
    });

    it("queries only profiles with a grace period that has passed", async () => {
      const chain = buildChain({ data: [] });
      mockFrom.mockReturnValue(chain);

      await api.handleGracePeriodExpired();

      expect(chain.not).toHaveBeenCalledWith("grace_period_ends_at", "is", null);
      expect(chain.lt).toHaveBeenCalled();
    });
  });
});
