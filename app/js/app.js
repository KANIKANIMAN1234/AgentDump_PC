const PAGE_TITLES = {
  dashboard: "ダッシュボード",
  companies: "採用企業",
  "job-seekers": "転職者",
  tasks: "タスク",
  insights: "気づき",
  settings: "設定",
};

const App = {
  currentPage: "dashboard",

  async init() {
    try {
      const ok = await Auth.init();
      if (!ok) return;

      document.getElementById("loading-screen").classList.add("hidden");
      document.getElementById("app-root").classList.remove("hidden");

      document.querySelectorAll(".nav-item").forEach((btn) => {
        btn.addEventListener("click", () => this.navigate(btn.dataset.page));
      });

      const hash = location.hash.replace("#", "") || "dashboard";
      this.navigate(hash in PAGE_TITLES ? hash : "dashboard");
    } catch (e) {
      document.getElementById("loading-screen").innerHTML = `
        <p style="color:#dc2626;max-width:400px;text-align:center">${escapeHtml(e.message)}</p>
      `;
    }
  },

  async navigate(page) {
    if (!PAGE_TITLES[page]) page = "dashboard";
    this.currentPage = page;
    location.hash = page;

    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.page === page);
    });

    document.getElementById("page-title").textContent = PAGE_TITLES[page];
    const container = document.getElementById("page-content");
    container.innerHTML = `<div class="empty-state">読み込み中...</div>`;

    try {
      const fn = Pages[page.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] || Pages[page];
      if (page === "job-seekers") await Pages.jobSeekers(container);
      else if (fn) await fn(container);
      else container.innerHTML = `<div class="empty-state">ページが見つかりません</div>`;
    } catch (e) {
      container.innerHTML = `<div class="card empty-state" style="color:var(--danger)">${escapeHtml(e.message)}</div>`;
    }
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
