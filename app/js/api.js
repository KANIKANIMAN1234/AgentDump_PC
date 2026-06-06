const API = {
  base: "",
  token: null,
  sessionToken: null,
  me: null,
  _cache: new Map(),
  _inflight: new Map(),
  _cacheTtl: 60000,

  setToken(token) {
    this.token = token;
    if (token) sessionStorage.setItem("agentdump_token", token);
    else sessionStorage.removeItem("agentdump_token");
  },

  setSessionToken(token) {
    if (token === this.sessionToken) return;
    this.sessionToken = token;
    if (token) sessionStorage.setItem("agentdump_session", token);
    else sessionStorage.removeItem("agentdump_session");
    this.invalidatePaths(["/api/auth/me"]);
  },

  restoreSession() {
    const s = sessionStorage.getItem("agentdump_session");
    if (s) this.sessionToken = s;
  },

  bearerToken(useLineToken = false) {
    if (useLineToken) return this.token;
    return this.sessionToken || this.token;
  },

  headers(json = true, useLineToken = false) {
    const h = { Authorization: `Bearer ${this.bearerToken(useLineToken)}` };
    if (json) h["Content-Type"] = "application/json";
    return h;
  },

  invalidateList() {
    this._cache.clear();
    this._inflight.clear();
  },

  invalidatePaths(prefixes) {
    if (!prefixes?.length) {
      this.invalidateList();
      return;
    }
    for (const key of [...this._cache.keys()]) {
      if (prefixes.some((p) => key.startsWith(p))) this._cache.delete(key);
    }
    for (const key of [...this._inflight.keys()]) {
      if (prefixes.some((p) => key.startsWith(p))) this._inflight.delete(key);
    }
  },

  _getCache(path) {
    const entry = this._cache.get(path);
    if (!entry) return null;
    if (Date.now() > entry.exp) {
      this._cache.delete(path);
      return null;
    }
    return entry.data;
  },

  _setCache(path, data) {
    this._cache.set(path, { data, exp: Date.now() + this._cacheTtl });
  },

  async cachedGet(path) {
    const cached = this._getCache(path);
    if (cached) return cached;
    if (this._inflight.has(path)) return this._inflight.get(path);

    const promise = this.get(path).then((data) => {
      this._setCache(path, data);
      if (path === "/api/dashboard" && data?.tasks) {
        this._setCache("/api/tasks", { tasks: data.tasks });
      }
      this._inflight.delete(path);
      return data;
    }).catch((err) => {
      this._inflight.delete(path);
      throw err;
    });
    this._inflight.set(path, promise);
    return promise;
  },

  async request(path, options = {}) {
    const useLineToken = !!options.useLineToken;
    const res = await fetch(`${this.base}${path}`, {
      ...options,
      headers: { ...this.headers(options.body != null, useLineToken), ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  get(path, opts) { return this.request(path, opts); },
  post(path, body, opts) {
    return this.request(path, { method: "POST", body: JSON.stringify(body), ...opts });
  },
  patch(path, body, opts) {
    return this.request(path, { method: "PATCH", body: JSON.stringify(body), ...opts });
  },
  delete(path, opts) { return this.request(path, { method: "DELETE", ...opts }); },

  async loadConfig() {
    const cached = sessionStorage.getItem("agentdump_liff_id");
    if (cached) return { liffId: cached };
    const cfg = await fetch(`${this.base}/api/config`).then((r) => r.json());
    if (cfg.liffId) sessionStorage.setItem("agentdump_liff_id", cfg.liffId);
    return cfg;
  },

  async authMe() {
    if (this.sessionToken) {
      try {
        return await this.get("/api/auth/me");
      } catch (_) {
        sessionStorage.removeItem("agentdump_session");
        this.sessionToken = null;
      }
    }
    return this.get("/api/auth/me", { useLineToken: true });
  },
  async activateInvite(code) {
    const data = await this.post("/api/auth/activate", { invite: code }, { useLineToken: true });
    this.invalidatePaths(["/api/auth/me", "/api/dashboard", "/api/tasks"]);
    return data;
  },
  async orgSetup(body) {
    const data = await this.post("/api/org/setup", body);
    this.invalidatePaths(["/api/org", "/api/dashboard"]);
    return data;
  },
  orgTree() { return this.get("/api/org/tree"); },
  orgInvite(body) { return this.post("/api/org/invite", body); },
  orgMembers() { return this.get("/api/org/members"); },
  dashboard() { return this.cachedGet("/api/dashboard"); },
  companies(filters) {
    const f = typeof filters === "string" ? { q: filters } : (filters || {});
    const params = new URLSearchParams();
    ["q", "area", "salary", "job_type", "keyword"].forEach((key) => {
      const v = String(f[key] || "").trim();
      if (v) params.set(key, v);
    });
    const qs = params.toString();
    const path = `/api/client-companies${qs ? `?${qs}` : ""}`;
    return qs ? this.get(path) : this.cachedGet(path);
  },
  company(id) { return this.get(`/api/client-companies?id=${id}`); },
  async createCompany(body) {
    const data = await this.post("/api/client-companies", body);
    this.invalidatePaths(["/api/client-companies", "/api/dashboard"]);
    return data;
  },
  parseCompanyText(content) { return this.post("/api/parse-company", { content }); },
  parseCompanyContacts(body) { return this.post("/api/parse-company-contacts", body); },
  parseJobSeekerText(content) { return this.post("/api/parse-job-seeker", { content }); },
  async transcribe(blob) {
    const base64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result).split(",")[1]);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
    const data = await this.post("/api/transcribe", { audioBase64: base64, mimeType: blob.type || "audio/webm" });
    return (data.text || "").trim();
  },
  jobPostings(companyId) { return this.get(`/api/job-postings?client_company_id=${companyId}`); },
  jobPosting(id) { return this.get(`/api/job-postings?id=${id}`); },
  async createJobPosting(body) {
    const data = await this.post("/api/job-postings", body);
    this.invalidatePaths(["/api/job-postings", "/api/client-companies", "/api/dashboard"]);
    return data;
  },
  async updateJobPosting(id, body) {
    const data = await this.patch(`/api/job-postings?id=${id}`, body);
    this.invalidatePaths(["/api/job-postings", "/api/client-companies", "/api/dashboard"]);
    return data;
  },
  async deleteJobPosting(id) {
    const data = await this.delete(`/api/job-postings?id=${id}`);
    this.invalidatePaths(["/api/job-postings", "/api/client-companies", "/api/dashboard"]);
    return data;
  },
  async updateCompany(id, body) {
    const data = await this.patch(`/api/client-companies?id=${id}`, body);
    this.invalidatePaths(["/api/job-postings", "/api/client-companies", "/api/dashboard"]);
    return data;
  },
  async deleteCompany(id) {
    const data = await this.delete(`/api/client-companies?id=${id}`);
    this.invalidatePaths(["/api/job-postings", "/api/client-companies", "/api/dashboard"]);
    return data;
  },
  memos(companyId) { return this.get(`/api/company-memos?companyId=${companyId}`); },
  createMemo(companyId, body) { return this.post(`/api/company-memos?companyId=${companyId}`, body); },
  updateMemo(id, body) { return this.patch(`/api/company-memos?id=${id}`, body); },
  deleteMemo(id) { return this.delete(`/api/company-memos?id=${id}`); },
  jobSeekers(q) {
    const path = `/api/job-seekers${q ? `?q=${encodeURIComponent(q)}` : ""}`;
    return q ? this.get(path) : this.cachedGet(path);
  },
  jobSeeker(id) { return this.get(`/api/job-seekers?id=${id}`); },
  async createJobSeeker(body) {
    const data = await this.post("/api/job-seekers", body);
    this.invalidatePaths(["/api/job-seekers", "/api/dashboard"]);
    return data;
  },
  async updateJobSeeker(id, body) {
    const data = await this.patch(`/api/job-seekers?id=${id}`, body);
    this.invalidatePaths(["/api/job-seekers", "/api/dashboard"]);
    return data;
  },
  async deleteJobSeeker(id) {
    const data = await this.delete(`/api/job-seekers?id=${id}`);
    this.invalidatePaths(["/api/job-seekers", "/api/dashboard"]);
    return data;
  },
  uploadPdf(jobSeekerId, type, file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(",")[1];
        try {
          const data = await this.post("/api/upload", {
            jobSeekerId,
            type,
            fileName: file.name,
            contentBase64: base64,
          });
          resolve(data);
        } catch (e) { reject(e); }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },
  tasks(params = {}) {
    const qs = new URLSearchParams(params).toString();
    const path = `/api/tasks${qs ? `?${qs}` : ""}`;
    return qs ? this.get(path) : this.cachedGet(path);
  },
  async createTask(body) {
    const data = await this.post("/api/tasks", body);
    this.invalidatePaths(["/api/tasks", "/api/dashboard"]);
    return data;
  },
  async updateTask(body) {
    const data = await this.patch("/api/tasks", body);
    this.invalidatePaths(["/api/tasks", "/api/dashboard"]);
    return data;
  },
  async deleteTask(id) {
    const data = await this.delete(`/api/tasks?id=${id}`);
    this.invalidatePaths(["/api/tasks", "/api/dashboard"]);
    return data;
  },
  insights() { return this.cachedGet("/api/insights"); },
  insightCount() { return this.cachedGet("/api/insights?count=1"); },
  async createInsight(body) {
    const data = await this.post("/api/insights", body);
    this.invalidatePaths(["/api/insights"]);
    return data;
  },
  exportInsights() { return this.post("/api/export-insights", {}); },
  messages() { return this.get("/api/messages"); },
  chat(message) { return this.post("/api/chat", { message }); },
  suggestCategories(content) { return this.post("/api/suggest-categories", { content }); },
  async completeTask(id, result) {
    const data = await this.patch("/api/tasks", { id, action: "complete", result: result || null });
    this.invalidatePaths(["/api/tasks", "/api/dashboard"]);
    return data;
  },
  orgSettings() { return this.get("/api/org/settings"); },
  saveOrgSettings(body) { return this.patch("/api/org/settings", body); },
  orgActivityLog(limit = 50) { return this.get(`/api/org/activity-log?limit=${limit}`); },
  memberPreferences() { return this.get("/api/member/preferences"); },
  saveMemberPreferences(body) { return this.patch("/api/member/preferences", body); },
  testLineNotification() { return this.post("/api/member/preferences", {}); },
};

API.restoreSession();
