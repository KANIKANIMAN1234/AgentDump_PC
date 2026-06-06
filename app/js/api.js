const API = {
  base: "",
  token: null,
  sessionToken: null,
  me: null,
  _cache: new Map(),
  _cacheTtl: 60000,

  setToken(token) {
    this.token = token;
    if (token) sessionStorage.setItem("agentdump_token", token);
    else sessionStorage.removeItem("agentdump_token");
  },

  setSessionToken(token) {
    this.sessionToken = token;
    if (token) sessionStorage.setItem("agentdump_session", token);
    else sessionStorage.removeItem("agentdump_session");
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
    const data = await this.get(path);
    this._setCache(path, data);
    return data;
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
    const cfg = await fetch(`${this.base}/api/config`).then((r) => r.json());
    return cfg;
  },

  authMe() { return this.get("/api/auth/me", { useLineToken: true }); },
  async activateInvite(code) {
    const data = await this.post("/api/auth/activate", { invite: code }, { useLineToken: true });
    this.invalidateList();
    return data;
  },
  async orgSetup(body) {
    const data = await this.post("/api/org/setup", body);
    this.invalidateList();
    return data;
  },
  orgTree() { return this.get("/api/org/tree"); },
  orgInvite(body) { return this.post("/api/org/invite", body); },
  orgMembers() { return this.get("/api/org/members"); },
  dashboard() { return this.cachedGet("/api/dashboard"); },
  companies(q) {
    const path = `/api/client-companies${q ? `?q=${encodeURIComponent(q)}` : ""}`;
    return q ? this.get(path) : this.cachedGet(path);
  },
  company(id) { return this.get(`/api/client-companies?id=${id}`); },
  async createCompany(body) {
    const data = await this.post("/api/client-companies", body);
    this.invalidateList();
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
    this.invalidateList();
    return data;
  },
  async updateJobPosting(id, body) {
    const data = await this.patch(`/api/job-postings?id=${id}`, body);
    this.invalidateList();
    return data;
  },
  async deleteJobPosting(id) {
    const data = await this.delete(`/api/job-postings?id=${id}`);
    this.invalidateList();
    return data;
  },
  async updateCompany(id, body) {
    const data = await this.patch(`/api/client-companies?id=${id}`, body);
    this.invalidateList();
    return data;
  },
  async deleteCompany(id) {
    const data = await this.delete(`/api/client-companies?id=${id}`);
    this.invalidateList();
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
    this.invalidateList();
    return data;
  },
  async updateJobSeeker(id, body) {
    const data = await this.patch(`/api/job-seekers?id=${id}`, body);
    this.invalidateList();
    return data;
  },
  async deleteJobSeeker(id) {
    const data = await this.delete(`/api/job-seekers?id=${id}`);
    this.invalidateList();
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
    this.invalidateList();
    return data;
  },
  async updateTask(body) {
    const data = await this.patch("/api/tasks", body);
    this.invalidateList();
    return data;
  },
  async deleteTask(id) {
    const data = await this.delete(`/api/tasks?id=${id}`);
    this.invalidateList();
    return data;
  },
  insights() { return this.cachedGet("/api/insights"); },
  async createInsight(body) {
    const data = await this.post("/api/insights", body);
    this.invalidateList();
    return data;
  },
  exportInsights() { return this.post("/api/export-insights", {}); },
  orgSettings() { return this.get("/api/org/settings"); },
  saveOrgSettings(body) { return this.patch("/api/org/settings", body); },
};

API.restoreSession();
