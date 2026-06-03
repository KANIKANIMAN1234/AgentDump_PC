const API = {
  base: "",
  token: null,
  me: null,

  setToken(token) {
    this.token = token;
    if (token) sessionStorage.setItem("agentdump_token", token);
    else sessionStorage.removeItem("agentdump_token");
  },

  headers(json = true) {
    const h = { Authorization: `Bearer ${this.token}` };
    if (json) h["Content-Type"] = "application/json";
    return h;
  },

  async request(path, options = {}) {
    const res = await fetch(`${this.base}${path}`, {
      ...options,
      headers: { ...this.headers(options.body != null), ...(options.headers || {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },

  get(path) { return this.request(path); },
  post(path, body) { return this.request(path, { method: "POST", body: JSON.stringify(body) }); },
  patch(path, body) { return this.request(path, { method: "PATCH", body: JSON.stringify(body) }); },
  delete(path) { return this.request(path, { method: "DELETE" }); },

  async loadConfig() {
    const cfg = await fetch(`${this.base}/api/config`).then((r) => r.json());
    return cfg;
  },

  authMe() { return this.get("/api/auth/me"); },
  activateInvite(code) {
    return this.post("/api/auth/activate", { invite: code });
  },
  orgSetup(body) { return this.post("/api/org/setup", body); },
  orgTree() { return this.get("/api/org/tree"); },
  orgInvite(body) { return this.post("/api/org/invite", body); },
  orgMembers() { return this.get("/api/org/members"); },
  companies(q) { return this.get(`/api/client-companies${q ? `?q=${encodeURIComponent(q)}` : ""}`); },
  company(id) { return this.get(`/api/client-companies?id=${id}`); },
  createCompany(body) { return this.post("/api/client-companies", body); },
  parseCompanyText(content) { return this.post("/api/parse-company", { content }); },
  jobPostings(companyId) { return this.get(`/api/job-postings?client_company_id=${companyId}`); },
  jobPosting(id) { return this.get(`/api/job-postings?id=${id}`); },
  createJobPosting(body) { return this.post("/api/job-postings", body); },
  updateJobPosting(id, body) { return this.patch(`/api/job-postings?id=${id}`, body); },
  deleteJobPosting(id) { return this.delete(`/api/job-postings?id=${id}`); },
  updateCompany(id, body) { return this.patch(`/api/client-companies?id=${id}`, body); },
  deleteCompany(id) { return this.delete(`/api/client-companies?id=${id}`); },
  memos(companyId) { return this.get(`/api/company-memos?companyId=${companyId}`); },
  createMemo(companyId, body) { return this.post(`/api/company-memos?companyId=${companyId}`, body); },
  updateMemo(id, body) { return this.patch(`/api/company-memos?id=${id}`, body); },
  deleteMemo(id) { return this.delete(`/api/company-memos?id=${id}`); },
  jobSeekers(q) { return this.get(`/api/job-seekers${q ? `?q=${encodeURIComponent(q)}` : ""}`); },
  jobSeeker(id) { return this.get(`/api/job-seekers?id=${id}`); },
  createJobSeeker(body) { return this.post("/api/job-seekers", body); },
  updateJobSeeker(id, body) { return this.patch(`/api/job-seekers?id=${id}`, body); },
  deleteJobSeeker(id) { return this.delete(`/api/job-seekers?id=${id}`); },
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
    return this.get(`/api/tasks${qs ? `?${qs}` : ""}`);
  },
  createTask(body) { return this.post("/api/tasks", body); },
  updateTask(body) { return this.patch("/api/tasks", body); },
  deleteTask(id) { return this.delete(`/api/tasks?id=${id}`); },
  insights() { return this.get("/api/insights"); },
  createInsight(body) { return this.post("/api/insights", body); },
  exportInsights() { return this.post("/api/export-insights", {}); },
  orgSettings() { return this.get("/api/org/settings"); },
  saveOrgSettings(body) { return this.patch("/api/org/settings", body); },
};
