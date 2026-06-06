const PAGE_TITLES = {
  dashboard: "ダッシュボード",
  chat: "チャット",
  companies: "採用企業",
  "job-seekers": "転職者",
  tasks: "タスク",
  insights: "気づき",
  organization: "組織",
  "my-page": "マイページ",
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
      const initial = hash in PAGE_TITLES ? hash : "dashboard";
      if (API.me?.needsOrgSetup) {
        await this.navigate("organization");
      } else {
        await this.navigate(initial);
        if (initial !== "dashboard") MyPage.checkNotifications();
      }
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
    container.className = "page-content";
    container.innerHTML = `<div class="empty-state">読み込み中...</div>`;

    try {
      if (page === "chat") await ChatPage.render(container);
      else if (page === "job-seekers") await Pages.jobSeekers(container);
      else if (page === "organization") await Pages.organization(container);
      else if (page === "dashboard") {
        const ret = await Pages.dashboard(container);
        MyPage.checkNotifications(ret?.tasks);
      } else {
        const fn = Pages[page.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] || Pages[page];
        if (fn) await fn(container);
        else container.innerHTML = `<div class="empty-state">ページが見つかりません</div>`;
      }
    } catch (e) {
      container.innerHTML = `<div class="card empty-state" style="color:var(--danger)">${escapeHtml(e.message)}</div>`;
    }
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
