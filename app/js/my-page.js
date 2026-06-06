/** PC版マイページ */
const MyPage = {
  roleLabel(role) {
    const map = {
      org_admin: "代表管理者",
      dept_admin: "部門管理者",
      unit_admin: "課管理者",
      member: "メンバー",
    };
    return map[role] || role || "—";
  },

  formatAt(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace("T", " ");
    return d.toLocaleString("ja-JP", { hour12: false });
  },

  async render(container) {
    const me = API.me || {};
    const profile = me.lineProfile || {};
    const isMember = Auth.isOrgMember();
    const isAdmin = Auth.isOrgAdmin();

    let dash = { tasks: [], jobSeekers: [], companies: [] };
    let insightCount = 0;
    let activity = [];

    if (isMember) {
      try {
        dash = await API.dashboard();
      } catch (_) {}
      try {
        const ins = await API.insights();
        insightCount = (ins.insights || []).length;
      } catch (_) {}
    }
    if (isAdmin) {
      try {
        activity = (await API.orgActivityLog()).events || [];
      } catch (_) {}
    }

    let serverPrefs = null;
    if (isMember) {
      try {
        serverPrefs = (await API.memberPreferences()).preferences;
      } catch (_) {}
    }

    const companies = dash.companies || [];
    const seekers = dash.jobSeekers || [];
    const tasks = dash.tasks || [];
    const prefs = UserPrefs.load();
    const presets = UserPrefs.getCompanyPresets();
    const templates = UserPrefs.getTemplates();
    const csvHistory = UserPrefs.getCsvExportHistory();
    const notif = {
      ...prefs.notifications,
      ...(serverPrefs ? {
        lineEnabled: serverPrefs.lineEnabled,
        dueTomorrow: serverPrefs.dueTomorrow,
        dueTodayHigh: serverPrefs.dueTodayHigh,
        browserEnabled: serverPrefs.browserEnabled ?? prefs.notifications.browserEnabled,
      } : {}),
    };
    if (serverPrefs) {
      UserPrefs.setNotifications(notif);
    }

    const checks = [
      { ok: isMember && !me.needsOrgSetup, label: "組織登録が完了している", page: "organization" },
      { ok: companies.length > 0, label: "採用企業を1件以上登録", page: "companies" },
      { ok: seekers.length > 0, label: "転職者を1件以上登録", page: "job-seekers" },
      { ok: tasks.length > 0, label: "タスクを1件以上作成", page: "tasks" },
      { ok: insightCount > 0, label: "気づきを1件以上記録", page: "insights" },
    ];

    container.innerHTML = `
      <div class="my-page-grid">
        <section class="card my-page-section">
          <h2 class="my-page-heading">プロフィール</h2>
          <div class="my-page-profile">
            ${profile.pictureUrl ? `<img src="${escapeHtml(profile.pictureUrl)}" alt="" class="my-page-avatar" />` : `<div class="my-page-avatar my-page-avatar--empty">👤</div>`}
            <div>
              <div class="my-page-name">${escapeHtml(profile.displayName || "ユーザー")}</div>
              <div class="my-page-meta">${escapeHtml(me.organization?.name || (me.legacy ? "個人モード" : "—"))}</div>
              <div class="my-page-meta">ロール: ${escapeHtml(this.roleLabel(me.member?.role))}</div>
            </div>
          </div>
        </section>

        <section class="card my-page-section">
          <h2 class="my-page-heading">データの見え方</h2>
          <ul class="my-page-list">
            <li><strong>採用企業・企業メモ</strong> … 組織内で共有（全メンバーが編集可）</li>
            <li><strong>転職者・タスク・気づき</strong> … 担当者個人（上司・管理者は配下分を閲覧可）</li>
          </ul>
        </section>

        <section class="card my-page-section">
          <h2 class="my-page-heading">初回ガイド</h2>
          <ul class="my-page-checklist">
            ${checks.map((c) => `
              <li class="${c.ok ? "done" : ""}">
                <span>${c.ok ? "✅" : "⬜"} ${escapeHtml(c.label)}</span>
                ${c.ok ? "" : `<button type="button" class="btn btn-sm" data-goto="${c.page}">今すぐ</button>`}
              </li>`).join("")}
          </ul>
        </section>

        <section class="card my-page-section">
          <h2 class="my-page-heading">ショートカット</h2>
          <div class="my-page-shortcuts">
            ${["chat", "companies", "job-seekers", "tasks", "insights"].map((p) =>
              `<button type="button" class="btn btn-sm" data-goto="${p}">${escapeHtml({ chat: "💬 チャット", companies: "🏢 採用企業", "job-seekers": "👤 転職者", tasks: "✅ タスク", insights: "💡 気づき" }[p])}</button>`
            ).join("")}
          </div>
        </section>

        <section class="card my-page-section my-page-section--wide">
          <h2 class="my-page-heading">業務効率設定</h2>
          <div class="my-page-subsection">
            <h3>ダッシュボード表示</h3>
            <div class="my-page-toggles">
              <label><input type="checkbox" id="pref-stat-tasks" ${prefs.dashboardStats.tasks ? "checked" : ""} /> 未完了タスク</label>
              <label><input type="checkbox" id="pref-stat-companies" ${prefs.dashboardStats.companies ? "checked" : ""} /> 採用企業</label>
              <label><input type="checkbox" id="pref-stat-seekers" ${prefs.dashboardStats.seekers ? "checked" : ""} /> 転職者</label>
              <label><input type="checkbox" id="pref-stat-high" ${prefs.dashboardStats.highPriority ? "checked" : ""} /> 高優先度</label>
            </div>
          </div>
          <div class="my-page-subsection">
            <h3>タスク一覧の並び順（デフォルト）</h3>
            <select id="pref-task-sort">
              <option value="due_asc" ${prefs.taskSort === "due_asc" ? "selected" : ""}>期限が近い順</option>
              <option value="priority_desc" ${prefs.taskSort === "priority_desc" ? "selected" : ""}>優先度が高い順</option>
              <option value="created_desc" ${prefs.taskSort === "created_desc" ? "selected" : ""}>作成が新しい順</option>
            </select>
          </div>
          <div class="my-page-subsection">
            <h3>採用企業 検索プリセット</h3>
            ${presets.length ? `<ul class="my-page-preset-list">${presets.map((p) => `
              <li>
                <button type="button" class="link" data-apply-preset="${p.id}">${escapeHtml(p.name)}</button>
                <button type="button" class="btn btn-sm btn-danger" data-del-preset="${p.id}">削除</button>
              </li>`).join("")}</ul>` : `<p class="my-page-hint">保存されたプリセットはありません。採用企業画面で条件を保存できます。</p>`}
          </div>
          <div class="my-page-subsection">
            <h3>気づき CSV ダウンロード履歴</h3>
            ${csvHistory.length ? `<ul class="my-page-list">${csvHistory.map((h) =>
              `<li>${this.formatAt(h.at)} … ${h.count}件</li>`
            ).join("")}</ul>` : `<p class="my-page-hint">まだダウンロード履歴がありません</p>`}
          </div>
        </section>

        <section class="card my-page-section my-page-section--wide">
          <h2 class="my-page-heading">テンプレート管理</h2>
          <div class="my-page-template-add">
            <select id="tpl-type"><option value="company_memo">企業メモ</option><option value="seeker_note">転職者メモ</option></select>
            <input type="text" id="tpl-title" placeholder="テンプレート名" style="max-width:180px" />
            <textarea id="tpl-body" rows="2" placeholder="本文" style="width:100%;margin-top:8px"></textarea>
            <button type="button" class="btn btn-sm btn-primary" id="tpl-add" style="margin-top:8px">追加</button>
          </div>
          ${templates.length ? `<ul class="my-page-preset-list" style="margin-top:12px">${templates.map((t) => `
            <li><strong>${escapeHtml(t.title)}</strong> <small>(${t.type === "company_memo" ? "企業メモ" : "転職者メモ"})</small>
              <button type="button" class="btn btn-sm btn-danger" data-del-tpl="${t.id}">削除</button></li>`).join("")}</ul>` : ""}
        </section>

        <section class="card my-page-section my-page-section--wide">
          <h2 class="my-page-heading">通知設定</h2>
          <div class="my-page-subsection">
            <h3>LINE 通知（毎朝9時頃）</h3>
            <p class="my-page-hint">LINE 公式アカウントを友だち追加し、LIFF でログインしている LINE アカウントに Push 通知します。</p>
            <div class="my-page-toggles">
              <label><input type="checkbox" id="pref-notif-line" ${notif.lineEnabled ? "checked" : ""} ${isMember ? "" : "disabled"} /> LINE 通知を有効化</label>
              <label><input type="checkbox" id="pref-notif-tomorrow" ${notif.dueTomorrow ? "checked" : ""} /> 期限前日のタスク</label>
              <label><input type="checkbox" id="pref-notif-today-high" ${notif.dueTodayHigh ? "checked" : ""} /> 当日・高優先度タスク</label>
            </div>
            <button type="button" class="btn btn-sm" id="pref-notif-line-test" style="margin-top:8px" ${isMember ? "" : "disabled"}>LINE テスト通知を送信</button>
          </div>
          <div class="my-page-subsection">
            <h3>ブラウザ通知（アプリ起動中）</h3>
            <div class="my-page-toggles">
              <label><input type="checkbox" id="pref-notif-browser" ${notif.browserEnabled ? "checked" : ""} /> ブラウザ通知を有効化</label>
            </div>
            <button type="button" class="btn btn-sm" id="pref-notif-permission" style="margin-top:8px">ブラウザ通知の許可を確認</button>
          </div>
        </section>

        ${isAdmin ? `
        <section class="card my-page-section my-page-section--wide">
          <h2 class="my-page-heading">監査ログ（org_admin）</h2>
          ${activity.length ? `<ul class="my-page-activity">${activity.map((e) => `
            <li><span class="my-page-activity-at">${this.formatAt(e.at)}</span>
              ${escapeHtml(e.actor)} — ${escapeHtml(e.label)}</li>`).join("")}</ul>` : `<p class="my-page-hint">更新履歴がありません</p>`}
        </section>` : ""}
      </div>
    `;

    container.querySelectorAll("[data-goto]").forEach((btn) => {
      btn.addEventListener("click", () => App.navigate(btn.dataset.goto));
    });

    ["pref-stat-tasks", "pref-stat-companies", "pref-stat-seekers", "pref-stat-high"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => {
        UserPrefs.setDashboardStats({
          tasks: document.getElementById("pref-stat-tasks").checked,
          companies: document.getElementById("pref-stat-companies").checked,
          seekers: document.getElementById("pref-stat-seekers").checked,
          highPriority: document.getElementById("pref-stat-high").checked,
        });
        showToast("ダッシュボード表示を保存しました");
      });
    });

    document.getElementById("pref-task-sort")?.addEventListener("change", (e) => {
      UserPrefs.setTaskSort(e.target.value);
      showToast("タスク並び順を保存しました");
    });

    container.querySelectorAll("[data-apply-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const preset = presets.find((p) => p.id === btn.dataset.applyPreset);
        if (!preset) return;
        UserPrefs.save({ pendingCompanyFilters: preset.filters });
        App.navigate("companies");
      });
    });

    container.querySelectorAll("[data-del-preset]").forEach((btn) => {
      btn.addEventListener("click", () => {
        UserPrefs.deleteCompanyPreset(btn.dataset.delPreset);
        showToast("プリセットを削除しました");
        this.render(container);
      });
    });

    document.getElementById("tpl-add")?.addEventListener("click", () => {
      const title = document.getElementById("tpl-title").value.trim();
      const body = document.getElementById("tpl-body").value.trim();
      const type = document.getElementById("tpl-type").value;
      if (!title || !body) {
        showToast("テンプレート名と本文を入力してください");
        return;
      }
      UserPrefs.addTemplate(type, title, body);
      showToast("テンプレートを追加しました");
      this.render(container);
    });

    container.querySelectorAll("[data-del-tpl]").forEach((btn) => {
      btn.addEventListener("click", () => {
        UserPrefs.deleteTemplate(btn.dataset.delTpl);
        showToast("テンプレートを削除しました");
        this.render(container);
      });
    });

    const saveNotif = async () => {
      const payload = {
        lineEnabled: document.getElementById("pref-notif-line")?.checked,
        dueTomorrow: document.getElementById("pref-notif-tomorrow")?.checked,
        dueTodayHigh: document.getElementById("pref-notif-today-high")?.checked,
        browserEnabled: document.getElementById("pref-notif-browser")?.checked,
      };
      UserPrefs.setNotifications({
        browserEnabled: payload.browserEnabled,
        lineEnabled: payload.lineEnabled,
        dueTomorrow: payload.dueTomorrow,
        dueTodayHigh: payload.dueTodayHigh,
      });
      if (isMember) {
        try {
          await API.saveMemberPreferences(payload);
        } catch (e) {
          showToast(e.message);
        }
      }
    };
    ["pref-notif-line", "pref-notif-browser", "pref-notif-tomorrow", "pref-notif-today-high"].forEach((id) => {
      document.getElementById(id)?.addEventListener("change", () => { saveNotif(); });
    });

    document.getElementById("pref-notif-line-test")?.addEventListener("click", async () => {
      try {
        await saveNotif();
        const res = await API.testLineNotification();
        showToast(res.message || "テスト通知を送信しました");
      } catch (e) {
        showToast(e.message);
      }
    });

    document.getElementById("pref-notif-permission")?.addEventListener("click", async () => {
      if (!("Notification" in window)) {
        showToast("このブラウザは通知に対応していません");
        return;
      }
      const perm = await Notification.requestPermission();
      showToast(perm === "granted" ? "通知が許可されました" : "通知が許可されませんでした");
    });
  },

  dateInTokyo(addDays = 0) {
    const base = new Date(Date.now() + addDays * 86400000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(base);
  },

  async checkNotifications() {
    const notif = UserPrefs.getNotifications();
    if (!notif.browserEnabled || !("Notification" in window) || Notification.permission !== "granted") return;

    let tasks = [];
    try {
      tasks = (await API.tasks()).tasks || [];
    } catch (_) {
      return;
    }

    const todayStr = this.dateInTokyo(0);
    const tomorrowStr = this.dateInTokyo(1);
    const prefs = UserPrefs.load();
    const notified = prefs.notifiedKeys || {};

    tasks.filter((t) => !t.completed).forEach((t) => {
      if (!t.due_date) return;
      const keyTomorrow = `tomorrow:${t.id}:${todayStr}`;
      const keyToday = `today:${t.id}:${todayStr}`;

      if (notif.dueTomorrow && t.due_date === tomorrowStr && !notified[keyTomorrow]) {
        new Notification("AgentDump — タスク期限前日", { body: `「${t.title}」の期限は明日です` });
        notified[keyTomorrow] = true;
      }
      if (notif.dueTodayHigh && t.due_date === todayStr && t.priority === "高" && !notified[keyToday]) {
        new Notification("AgentDump — 高優先度タスク", { body: `今日が期限: 「${t.title}」` });
        notified[keyToday] = true;
      }
    });

    UserPrefs.save({ notifiedKeys: notified });
  },
};
