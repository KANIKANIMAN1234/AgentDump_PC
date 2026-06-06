/** ユーザー設定（localStorage） */
const UserPrefs = (function () {
  const KEY = "agentdump_user_prefs_v1";

  const DEFAULTS = {
    dashboardStats: { tasks: true, companies: true, seekers: true, highPriority: true },
    taskSort: "due_asc",
    companySearchPresets: [],
    csvExportHistory: [],
    templates: [],
    notifications: {
      browserEnabled: false,
      dueTomorrow: true,
      dueTodayHigh: true,
      lineEnabled: false,
    },
    notifiedKeys: {},
  };

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return structuredClone(DEFAULTS);
      return { ...structuredClone(DEFAULTS), ...JSON.parse(raw) };
    } catch {
      return structuredClone(DEFAULTS);
    }
  }

  function save(partial) {
    const next = { ...load(), ...partial };
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  function update(fn) {
    const cur = load();
    const next = fn(cur) || cur;
    localStorage.setItem(KEY, JSON.stringify(next));
    return next;
  }

  function getDashboardStats() {
    return load().dashboardStats;
  }

  function setDashboardStats(stats) {
    return save({ dashboardStats: { ...load().dashboardStats, ...stats } });
  }

  function getTaskSort() {
    return load().taskSort || "due_asc";
  }

  function setTaskSort(sort) {
    return save({ taskSort: sort });
  }

  function sortTasks(tasks) {
    const list = [...(tasks || [])];
    const sort = getTaskSort();
    const pri = { 高: 3, 中: 2, 低: 1 };
    if (sort === "priority_desc") {
      return list.sort((a, b) => (pri[b.priority] || 0) - (pri[a.priority] || 0));
    }
    if (sort === "created_desc") {
      return list.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
    }
    return list.sort((a, b) => {
      const da = a.due_date || "9999-99-99";
      const db = b.due_date || "9999-99-99";
      if (da !== db) return da.localeCompare(db);
      return String(a.created_at || "").localeCompare(String(b.created_at || ""));
    });
  }

  function getCompanyPresets() {
    return load().companySearchPresets || [];
  }

  function addCompanyPreset(name, filters) {
    return update((p) => {
      p.companySearchPresets = [
        { id: crypto.randomUUID(), name, filters, createdAt: new Date().toISOString() },
        ...(p.companySearchPresets || []),
      ].slice(0, 20);
      return p;
    });
  }

  function deleteCompanyPreset(id) {
    return update((p) => {
      p.companySearchPresets = (p.companySearchPresets || []).filter((x) => x.id !== id);
      return p;
    });
  }

  function addCsvExportHistory(count) {
    return update((p) => {
      p.csvExportHistory = [{ at: new Date().toISOString(), count }, ...(p.csvExportHistory || [])].slice(0, 10);
      return p;
    });
  }

  function getCsvExportHistory() {
    return load().csvExportHistory || [];
  }

  function getTemplates(type) {
    return (load().templates || []).filter((t) => !type || t.type === type);
  }

  function addTemplate(type, title, body) {
    return update((p) => {
      p.templates = [
        { id: crypto.randomUUID(), type, title, body, createdAt: new Date().toISOString() },
        ...(p.templates || []),
      ];
      return p;
    });
  }

  function deleteTemplate(id) {
    return update((p) => {
      p.templates = (p.templates || []).filter((t) => t.id !== id);
      return p;
    });
  }

  function getNotifications() {
    return load().notifications;
  }

  function setNotifications(partial) {
    return save({ notifications: { ...load().notifications, ...partial } });
  }

  function templateSelectHtml(type, selectId) {
    const items = getTemplates(type);
    if (!items.length) return "";
    return `<select id="${selectId}" class="template-select" style="max-width:200px;margin-bottom:6px">
      <option value="">テンプレートを挿入…</option>
      ${items.map((t) => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.title)}</option>`).join("")}
    </select>`;
  }

  function wireTemplateSelect(selectId, targetSelector, formRoot) {
    const sel = formRoot.querySelector(`#${selectId}`);
    if (!sel) return;
    sel.addEventListener("change", () => {
      const t = getTemplates().find((x) => x.id === sel.value);
      if (!t) return;
      const el = formRoot.querySelector(targetSelector);
      if (el) {
        el.value = el.value ? `${el.value}\n\n${t.body}` : t.body;
      }
      sel.value = "";
    });
  }

  return {
    load,
    save,
    getDashboardStats,
    setDashboardStats,
    getTaskSort,
    setTaskSort,
    sortTasks,
    getCompanyPresets,
    addCompanyPreset,
    deleteCompanyPreset,
    addCsvExportHistory,
    getCsvExportHistory,
    getTemplates,
    addTemplate,
    deleteTemplate,
    getNotifications,
    setNotifications,
    templateSelectHtml,
    wireTemplateSelect,
  };
})();
