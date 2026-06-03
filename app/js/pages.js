const Pages = {
  async dashboard(container) {
    const [tasksRes, companiesRes, seekersRes] = await Promise.all([
      API.tasks().catch(() => ({ tasks: [] })),
      Auth.isOrgMember() ? API.companies().catch(() => ({ companies: [] })) : Promise.resolve({ companies: [] }),
      API.jobSeekers().catch(() => ({ jobSeekers: [] })),
    ]);
    const tasks = tasksRes.tasks || [];
    const companies = companiesRes.companies || [];
    const seekers = seekersRes.jobSeekers || [];

    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="value">${tasks.length}</div><div class="label">未完了タスク</div></div>
        <div class="stat-card"><div class="value">${companies.length}</div><div class="label">採用企業</div></div>
        <div class="stat-card"><div class="value">${seekers.length}</div><div class="label">転職者</div></div>
        <div class="stat-card"><div class="value">${tasks.filter((t) => t.priority === "高").length}</div><div class="label">高優先度</div></div>
      </div>
      <div class="card">
        <div class="card-header"><h2>直近タスク</h2><button class="btn btn-sm" data-goto="tasks">すべて見る</button></div>
        ${Pages.renderTaskTable(tasks.slice(0, 8), false)}
      </div>
    `;
    container.querySelector("[data-goto=tasks]")?.addEventListener("click", () => App.navigate("tasks"));
  },

  renderTaskTable(tasks, showActions = true) {
    if (!tasks.length) return `<div class="empty-state">タスクがありません</div>`;
    return `<table class="data-table"><thead><tr>
      <th>優先度</th><th>タスク</th><th>企業</th><th>転職者</th><th>期限</th>
      ${showActions ? "<th></th>" : ""}
    </tr></thead><tbody>${tasks.map((t) => `
      <tr>
        <td>${priorityBadge(t.priority)}</td>
        <td>${escapeHtml(t.title)}</td>
        <td>${escapeHtml(t.company_name || "—")}</td>
        <td>${escapeHtml(t.job_seeker_name || "—")}</td>
        <td>${t.due_date || "—"}</td>
        ${showActions ? `<td>
        <button class="btn btn-sm" data-edit-task="${t.id}">編集</button>
        <button class="btn btn-sm btn-primary" data-complete-task="${t.id}">完了</button>
      </td>` : ""}
      </tr>`).join("")}</tbody></table>`;
  },

  async companies(container) {
    if (!Auth.isOrgMember()) {
      container.innerHTML = `<div class="card empty-state">採用企業管理は法人メンバー登録後に利用できます</div>`;
      return;
    }
    container.innerHTML = `
      <div class="toolbar">
        <input type="text" id="company-search" placeholder="企業名で検索..." style="max-width:280px" />
        <button class="btn btn-primary" id="btn-new-company">＋ 新規登録</button>
        <button class="btn" id="btn-bulk-company">📋 テキストから一括登録</button>
      </div>
      <div class="card" id="companies-list"><div class="empty-state">読み込み中...</div></div>
    `;
    const load = async (q) => {
      const { companies } = await API.companies(q);
      const list = document.getElementById("companies-list");
      if (!companies.length) {
        list.innerHTML = `<div class="empty-state">採用企業がありません</div>`;
        return;
      }
      list.innerHTML = `<table class="data-table"><thead><tr>
        <th>企業名</th><th>更新日</th><th></th>
      </tr></thead><tbody>${companies.map((c) => `
        <tr>
          <td><a href="#" class="link" data-company-id="${c.id}">${escapeHtml(c.name)}</a></td>
          <td>${(c.updated_at || c.created_at || "").slice(0, 10)}</td>
          <td><button class="btn btn-sm" data-edit-company="${c.id}">編集</button></td>
        </tr>`).join("")}</tbody></table>`;
      list.querySelectorAll("[data-company-id]").forEach((a) => {
        a.addEventListener("click", (e) => { e.preventDefault(); Pages.showCompanyDetail(a.dataset.companyId); });
      });
      list.querySelectorAll("[data-edit-company]").forEach((b) => {
        b.addEventListener("click", () => Pages.showCompanyForm(b.dataset.editCompany));
      });
    };
    await load("");
    document.getElementById("company-search").addEventListener("input", (e) => load(e.target.value));
    document.getElementById("btn-new-company").addEventListener("click", () => Pages.showCompanyForm(null));
    document.getElementById("btn-bulk-company").addEventListener("click", () => Pages.showCompanyBulkImport(load));
  },

  companyFormFields(c = {}) {
    return `
      <div class="form-grid">
        <div class="form-group full"><label>企業名 *</label><input name="name" value="${escapeHtml(c.name || "")}" required /></div>
        <div class="form-group full"><label>採用募集要項</label><textarea name="job_posting">${escapeHtml(c.job_posting || "")}</textarea></div>
        <div class="form-group full"><label>企業文化（非公開）</label><textarea name="company_culture">${escapeHtml(c.company_culture || "")}</textarea></div>
        <div class="form-group full"><label>内部メモ（非公開）</label><textarea name="internal_notes">${escapeHtml(c.internal_notes || "")}</textarea></div>
        <div class="form-group"><label>人事担当者</label><input name="hr_name" value="${escapeHtml(c.hr_name || "")}" /></div>
        <div class="form-group"><label>人事 TEL</label><input name="hr_phone" value="${escapeHtml(c.hr_phone || "")}" /></div>
        <div class="form-group"><label>人事 メール</label><input name="hr_email" type="email" value="${escapeHtml(c.hr_email || "")}" /></div>
        <div class="form-group"><label>採用部署責任者</label><input name="dept_manager_name" value="${escapeHtml(c.dept_manager_name || "")}" /></div>
        <div class="form-group"><label>責任者 TEL</label><input name="dept_manager_phone" value="${escapeHtml(c.dept_manager_phone || "")}" /></div>
        <div class="form-group"><label>責任者 メール</label><input name="dept_manager_email" type="email" value="${escapeHtml(c.dept_manager_email || "")}" /></div>
        <div class="form-group"><label>窓口担当者</label><input name="window_contact_name" value="${escapeHtml(c.window_contact_name || "")}" /></div>
        <div class="form-group"><label>窓口 TEL</label><input name="window_contact_phone" value="${escapeHtml(c.window_contact_phone || "")}" /></div>
        <div class="form-group"><label>窓口 メール</label><input name="window_contact_email" type="email" value="${escapeHtml(c.window_contact_email || "")}" /></div>
      </div>`;
  },

  showCompanyBulkImport(reload) {
    let parsedPositions = [];
    openModal("テキストから一括登録", `
      <p style="color:var(--gray-dark);font-size:13px;margin-bottom:12px;line-height:1.6">
        企業から受け取った採用募集情報を貼り付けてください。AI が<strong>ポジションごとに1件</strong>へ分割します（1社・複数求人 → 複数レコード）。
      </p>
      <div class="form-group full">
        <label>原文テキスト</label>
        <textarea id="bulk-company-source" rows="8" placeholder="採用募集要項・求人票・メール本文などをそのまま貼り付け"></textarea>
      </div>
      <button type="button" class="btn btn-primary" id="bulk-company-parse">AIで解析</button>
      <div id="bulk-company-preview" style="margin-top:16px"></div>
    `, `
      <button class="btn" id="bulk-company-cancel">キャンセル</button>
      <button class="btn btn-primary" id="bulk-company-save" disabled>0件を登録</button>
    `);

    const preview = () => document.getElementById("bulk-company-preview");
    const saveBtn = document.getElementById("bulk-company-save");

    function renderPreview() {
      if (!parsedPositions.length) {
        preview().innerHTML = "";
        saveBtn.disabled = true;
        saveBtn.textContent = "0件を登録";
        return;
      }
      preview().innerHTML = `
        <h3 style="font-size:13px;color:var(--dulton-navy);margin-bottom:8px">解析結果（${parsedPositions.length}件）</h3>
        <div class="bulk-position-list">${parsedPositions.map((p, i) => `
          <div class="bulk-position-item" data-idx="${i}">
            <div class="bulk-position-head">
              <label><input type="checkbox" class="bulk-pos-check" data-idx="${i}" checked />
                <strong>${escapeHtml(p.name)}</strong></label>
              <button type="button" class="btn btn-sm bulk-pos-edit" data-idx="${i}">編集</button>
            </div>
            <p class="bulk-position-snippet">${escapeHtml((p.job_posting || "（募集要項なし）").slice(0, 120))}${(p.job_posting || "").length > 120 ? "…" : ""}</p>
          </div>`).join("")}</div>`;
      saveBtn.disabled = false;
      saveBtn.textContent = `${parsedPositions.length}件を登録`;
      preview().querySelectorAll(".bulk-pos-check").forEach((cb) => {
        cb.addEventListener("change", () => {
          const n = preview().querySelectorAll(".bulk-pos-check:checked").length;
          saveBtn.disabled = n === 0;
          saveBtn.textContent = `${n}件を登録`;
        });
      });
      preview().querySelectorAll(".bulk-pos-edit").forEach((btn) => {
        btn.addEventListener("click", () => {
          const idx = Number(btn.dataset.idx);
          const p = parsedPositions[idx];
          if (!p) return;
          closeModal();
          Pages.showCompanyForm(null, reload, p);
        });
      });
    }

    document.getElementById("bulk-company-cancel").onclick = closeModal;
    document.getElementById("bulk-company-parse").onclick = async () => {
      const content = document.getElementById("bulk-company-source").value.trim();
      if (!content) { showToast("テキストを貼り付けてください"); return; }
      const btn = document.getElementById("bulk-company-parse");
      btn.disabled = true;
      btn.textContent = "解析中…";
      try {
        const data = await API.parseCompanyText(content);
        parsedPositions = data.positions || [];
        renderPreview();
        showToast(`${parsedPositions.length}件のポジションを抽出しました`);
      } catch (e) {
        showToast(e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = "AIで解析";
      }
    };
    saveBtn.onclick = async () => {
      const checks = preview().querySelectorAll(".bulk-pos-check:checked");
      const indices = [...checks].map((cb) => Number(cb.dataset.idx));
      if (!indices.length) return;
      saveBtn.disabled = true;
      let ok = 0;
      try {
        for (const i of indices) {
          await API.createCompany(parsedPositions[i]);
          ok++;
        }
        closeModal();
        showToast(`${ok}件を登録しました`);
        reload("");
      } catch (e) {
        showToast(e.message);
        saveBtn.disabled = false;
      }
    };
  },

  async showCompanyForm(id, reload, preset = null) {
    let c = preset || {};
    if (id) {
      const res = await API.company(id);
      c = res.company;
    }
    openModal(id ? "採用企業を編集" : "採用企業を登録", Pages.companyFormFields(c), `
      <button class="btn" id="modal-cancel">キャンセル</button>
      ${id ? `<button class="btn btn-danger" id="modal-delete-company">削除</button>` : ""}
      <button class="btn btn-primary" id="modal-save">保存</button>
    `);
    document.getElementById("modal-cancel").onclick = closeModal;
    if (id) {
      document.getElementById("modal-delete-company").onclick = async () => {
        if (!confirm("この採用企業を削除しますか？")) return;
        try {
          await API.deleteCompany(id);
          closeModal();
          showToast("削除しました");
          App.navigate("companies");
        } catch (e) { showToast(e.message); }
      };
    }
    document.getElementById("modal-save").onclick = async () => {
      const form = document.getElementById("modal-body");
      const body = {};
      form.querySelectorAll("[name]").forEach((el) => { body[el.name] = el.value; });
      try {
        if (id) await API.updateCompany(id, body);
        else await API.createCompany(body);
        closeModal();
        showToast("保存しました");
        if (typeof reload === "function") reload("");
        else App.navigate("companies");
      } catch (e) { showToast(e.message); }
    };
  },

  async showCompanyDetail(id) {
    const [{ company }, { memos }] = await Promise.all([API.company(id), API.memos(id)]);
    openModal(company.name, `
      <div class="detail-section"><h3>基本情報</h3>
        <p><strong>募集要項</strong></p><p>${escapeHtml(company.job_posting || "—")}</p>
        <p style="margin-top:10px"><strong>企業文化</strong></p><p>${escapeHtml(company.company_culture || "—")}</p>
      </div>
      <div class="detail-section"><h3>担当者</h3>
        <p>人事: ${escapeHtml(company.hr_name || "—")} / ${escapeHtml(company.hr_phone || "")} / ${escapeHtml(company.hr_email || "")}</p>
        <p>部署責任者: ${escapeHtml(company.dept_manager_name || "—")}</p>
        <p>窓口: ${escapeHtml(company.window_contact_name || "—")}</p>
      </div>
      <div class="detail-section">
        <div class="card-header"><h3>企業メモ</h3><button class="btn btn-sm btn-primary" id="btn-add-memo">＋ メモ追加</button></div>
        <div class="memo-list">${(memos || []).map((m) => `
          <div class="memo-item">
            <div class="memo-meta">${(m.created_at || "").slice(0, 10)} · 作成: ${escapeHtml(m.created_by_name)}
              <button class="btn btn-sm btn-danger" style="float:right" data-delete-memo="${m.id}">削除</button>
            </div>
            <h4>${escapeHtml(m.title || "（無題）")}</h4>
            <p>${escapeHtml(m.content)}</p>
          </div>`).join("") || `<div class="empty-state">メモがありません</div>`}
        </div>
      </div>
    `, `<button class="btn btn-primary" id="edit-company-btn">編集</button><button class="btn" id="modal-close2">閉じる</button>`);
    document.getElementById("modal-close2").onclick = closeModal;
    document.getElementById("edit-company-btn").onclick = () => { closeModal(); Pages.showCompanyForm(id); };
    document.getElementById("btn-add-memo").onclick = () => Pages.showMemoForm(id);
    document.querySelectorAll("[data-delete-memo]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("このメモを削除しますか？")) return;
        try {
          await API.deleteMemo(btn.dataset.deleteMemo);
          showToast("メモを削除しました");
          closeModal();
          Pages.showCompanyDetail(id);
        } catch (e) { showToast(e.message); }
      });
    });
  },

  showMemoForm(companyId) {
    openModal("企業メモを追加", `
      <div class="form-group"><label>タイトル</label><input id="memo-title" /></div>
      <div class="form-group" style="margin-top:12px"><label>内容 *</label><textarea id="memo-content"></textarea></div>
    `, `<button class="btn" onclick="closeModal()">キャンセル</button><button class="btn btn-primary" id="save-memo">保存</button>`);
    document.getElementById("save-memo").onclick = async () => {
      const title = document.getElementById("memo-title").value;
      const content = document.getElementById("memo-content").value;
      try {
        await API.createMemo(companyId, { title, content });
        closeModal();
        showToast("メモを追加しました");
        Pages.showCompanyDetail(companyId);
      } catch (e) { showToast(e.message); }
    };
  },

  async jobSeekers(container) {
    container.innerHTML = `
      <div class="toolbar">
        <input type="text" id="seeker-search" placeholder="氏名で検索..." style="max-width:280px" />
        <button class="btn btn-primary" id="btn-new-seeker">＋ 転職者登録</button>
      </div>
      <div class="card" id="seekers-list"><div class="empty-state">読み込み中...</div></div>
    `;
    const showAssignee = API.me?.isAdmin;
    const load = async (q) => {
      const { jobSeekers } = await API.jobSeekers(q);
      const list = document.getElementById("seekers-list");
      if (!jobSeekers.length) {
        list.innerHTML = `<div class="empty-state">転職者がありません</div>`;
        return;
      }
      list.innerHTML = `<table class="data-table"><thead><tr>
        <th>氏名</th><th>年齢</th><th>就業</th><th>希望職種</th>
        ${showAssignee ? "<th>担当</th>" : ""}<th></th>
      </tr></thead><tbody>${jobSeekers.map((j) => `
        <tr>
          <td><a href="#" class="link" data-seeker-id="${j.id}">${escapeHtml(j.name)}</a></td>
          <td>${j.age ?? "—"}</td>
          <td>${employmentLabel(j.employment_status)}</td>
          <td>${escapeHtml(j.desired_job_type || "—")}</td>
          ${showAssignee ? `<td>${escapeHtml(j.assignee_name || "—")}</td>` : ""}
          <td><button class="btn btn-sm" data-edit-seeker="${j.id}">編集</button></td>
        </tr>`).join("")}</tbody></table>`;
      list.querySelectorAll("[data-seeker-id]").forEach((a) => {
        a.addEventListener("click", (e) => { e.preventDefault(); Pages.showSeekerDetail(a.dataset.seekerId); });
      });
      list.querySelectorAll("[data-edit-seeker]").forEach((b) => {
        b.addEventListener("click", () => Pages.showSeekerForm(b.dataset.editSeeker));
      });
    };
    await load("");
    document.getElementById("seeker-search").addEventListener("input", (e) => load(e.target.value));
    document.getElementById("btn-new-seeker").addEventListener("click", () => Pages.showSeekerForm(null));
  },

  seekerFormFields(j = {}) {
    return `
      <div class="form-grid">
        <div class="form-group"><label>氏名 *</label><input name="name" value="${escapeHtml(j.name || "")}" required /></div>
        <div class="form-group"><label>年齢</label><input name="age" type="number" value="${j.age ?? ""}" /></div>
        <div class="form-group"><label>現年収（万円）</label><input name="current_salary_man" type="number" value="${j.current_salary_man ?? ""}" /></div>
        <div class="form-group"><label>希望年収（万円）</label><input name="desired_salary_man" type="number" value="${j.desired_salary_man ?? ""}" /></div>
        <div class="form-group"><label>就業状況</label>
          <select name="employment_status">
            <option value="">—</option>
            <option value="employed" ${j.employment_status === "employed" ? "selected" : ""}>現職あり</option>
            <option value="retired" ${j.employment_status === "retired" ? "selected" : ""}>退職済み</option>
          </select>
        </div>
        <div class="form-group"><label>現職</label><input name="current_company" value="${escapeHtml(j.current_company || "")}" /></div>
        <div class="form-group"><label>転職希望時期</label><input name="desired_timing" value="${escapeHtml(j.desired_timing || "")}" /></div>
        <div class="form-group"><label>転職希望職種</label><input name="desired_job_type" value="${escapeHtml(j.desired_job_type || "")}" /></div>
        <div class="form-group full"><label>メモ</label><textarea name="notes">${escapeHtml(j.notes || "")}</textarea></div>
        ${j.id ? `
        <div class="form-group"><label>履歴書 PDF</label><input type="file" accept="application/pdf" id="resume-file" /></div>
        <div class="form-group"><label>職務経歴書 PDF</label><input type="file" accept="application/pdf" id="cv-file" /></div>
        ` : ""}
      </div>`;
  },

  async showSeekerForm(id) {
    let j = {};
    if (id) {
      const res = await API.jobSeeker(id);
      j = res.jobSeeker;
    }
    openModal(id ? "転職者を編集" : "転職者を登録", Pages.seekerFormFields(j), `
      <button class="btn" id="modal-cancel">キャンセル</button>
      ${id ? `<button class="btn btn-danger" id="modal-delete">削除</button>` : ""}
      <button class="btn btn-primary" id="modal-save">保存</button>
    `);
    document.getElementById("modal-cancel").onclick = closeModal;
    if (id) {
      document.getElementById("modal-delete").onclick = async () => {
        if (!confirm("削除しますか？")) return;
        try {
          await API.deleteJobSeeker(id);
          closeModal();
          showToast("削除しました");
          App.navigate("job-seekers");
        } catch (e) { showToast(e.message); }
      };
    }
    document.getElementById("modal-save").onclick = async () => {
      const form = document.getElementById("modal-body");
      const body = {};
      form.querySelectorAll("[name]").forEach((el) => { body[el.name] = el.value; });
      try {
        let seekerId = id;
        if (id) await API.updateJobSeeker(id, body);
        else {
          const res = await API.createJobSeeker(body);
          seekerId = res.jobSeeker.id;
        }
        const resumeFile = document.getElementById("resume-file")?.files?.[0];
        const cvFile = document.getElementById("cv-file")?.files?.[0];
        if (resumeFile) await API.uploadPdf(seekerId, "resume", resumeFile);
        if (cvFile) await API.uploadPdf(seekerId, "cv", cvFile);
        closeModal();
        showToast("保存しました");
        App.navigate("job-seekers");
      } catch (e) { showToast(e.message); }
    };
  },

  async showSeekerDetail(id) {
    const { jobSeeker: j } = await API.jobSeeker(id);
    openModal(j.name, `
      <div class="form-grid">
        <div><strong>年齢</strong><br>${j.age ?? "—"}</div>
        <div><strong>就業</strong><br>${employmentLabel(j.employment_status)}</div>
        <div><strong>現年収</strong><br>${j.current_salary_man != null ? j.current_salary_man + "万円" : "—"}</div>
        <div><strong>希望年収</strong><br>${j.desired_salary_man != null ? j.desired_salary_man + "万円" : "—"}</div>
        <div><strong>現職</strong><br>${escapeHtml(j.current_company || "—")}</div>
        <div><strong>希望時期</strong><br>${escapeHtml(j.desired_timing || "—")}</div>
        <div class="full"><strong>希望職種</strong><br>${escapeHtml(j.desired_job_type || "—")}</div>
        <div><strong>履歴書</strong><br>${driveLink(j.resume_drive_file_id)} ${j.resume_file_name ? `(${escapeHtml(j.resume_file_name)})` : ""}</div>
        <div><strong>職務経歴書</strong><br>${driveLink(j.cv_drive_file_id)}</div>
        <div class="full"><strong>メモ</strong><br>${escapeHtml(j.notes || "—")}</div>
      </div>
    `, `<button class="btn btn-primary" id="edit-seeker">編集</button><button class="btn" onclick="closeModal()">閉じる</button>`);
    document.getElementById("edit-seeker").onclick = () => { closeModal(); Pages.showSeekerForm(id); };
  },

  async tasks(container) {
    let companies = [];
    let seekers = [];
    if (Auth.isOrgMember()) {
      try {
        companies = (await API.companies()).companies || [];
      } catch (_) {}
    }
    try {
      seekers = (await API.jobSeekers()).jobSeekers || [];
    } catch (_) {}

    container.innerHTML = `
      <div class="toolbar">
        <button class="btn btn-primary" id="btn-new-task">＋ タスク追加</button>
        <select id="filter-company" style="max-width:200px"><option value="">全企業</option>
          ${companies.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
        </select>
        <select id="filter-seeker" style="max-width:200px"><option value="">全転職者</option>
          ${seekers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}
        </select>
      </div>
      <div class="card" id="tasks-list"></div>
    `;

    const load = async () => {
      const params = {};
      const cid = document.getElementById("filter-company").value;
      const sid = document.getElementById("filter-seeker").value;
      if (cid) params.client_company_id = cid;
      if (sid) params.job_seeker_id = sid;
      const { tasks } = await API.tasks(params);
      const list = document.getElementById("tasks-list");
      list.innerHTML = Pages.renderTaskTable(tasks, true);
      list.querySelectorAll("[data-complete-task]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          try {
            await API.updateTask({ id: btn.dataset.completeTask, action: "complete" });
            showToast("タスクを完了しました");
            load();
          } catch (e) { showToast(e.message); }
        });
      });
      list.querySelectorAll("[data-edit-task]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const task = tasks.find((t) => t.id === btn.dataset.editTask);
          if (task) Pages.showTaskEditForm(task, companies, seekers, load);
        });
      });
    };

    document.getElementById("filter-company").addEventListener("change", load);
    document.getElementById("filter-seeker").addEventListener("change", load);
    document.getElementById("btn-new-task").addEventListener("click", () => Pages.showTaskForm(companies, seekers, load));
    await load();
  },

  showTaskForm(companies, seekers, onSave) {
    openModal("タスク追加", `
      <div class="form-grid">
        <div class="form-group full"><label>タスク内容 *</label><input name="title" required /></div>
        <div class="form-group"><label>担当企業</label>
          <select name="client_company_id"><option value="">—</option>
            ${companies.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group"><label>転職者</label>
          <select name="job_seeker_id"><option value="">—</option>
            ${seekers.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group"><label>期限</label><input name="due_date" type="date" /></div>
        <div class="form-group"><label>優先度</label>
          <select name="priority"><option value="中">中</option><option value="高">高</option><option value="低">低</option></select>
        </div>
      </div>
    `, `<button class="btn" onclick="closeModal()">キャンセル</button><button class="btn btn-primary" id="save-task">保存</button>`);
    document.getElementById("save-task").onclick = async () => {
      const form = document.getElementById("modal-body");
      const body = { title: form.querySelector("[name=title]").value };
      ["client_company_id", "job_seeker_id", "due_date", "priority"].forEach((f) => {
        const v = form.querySelector(`[name=${f}]`).value;
        body[f] = v || null;
      });
      try {
        await API.createTask(body);
        closeModal();
        showToast("タスクを追加しました");
        onSave();
      } catch (e) { showToast(e.message); }
    };
  },

  showTaskEditForm(task, companies, seekers, onSave) {
    const due = task.due_date ? String(task.due_date).slice(0, 10) : "";
    openModal("タスクを編集", `
      <div class="form-grid">
        <div class="form-group full"><label>タスク内容 *</label><input name="title" required value="${escapeHtml(task.title)}" /></div>
        <div class="form-group"><label>担当企業</label>
          <select name="client_company_id"><option value="">—</option>
            ${companies.map((c) => `<option value="${c.id}" ${task.client_company_id === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group"><label>転職者</label>
          <select name="job_seeker_id"><option value="">—</option>
            ${seekers.map((s) => `<option value="${s.id}" ${task.job_seeker_id === s.id ? "selected" : ""}>${escapeHtml(s.name)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group"><label>期限</label><input name="due_date" type="date" value="${due}" /></div>
        <div class="form-group"><label>優先度</label>
          <select name="priority">
            ${["高", "中", "低"].map((p) => `<option value="${p}" ${(task.priority || "中") === p ? "selected" : ""}>${p}</option>`).join("")}
          </select>
        </div>
      </div>
    `, `
      <button class="btn btn-danger" id="delete-task">削除</button>
      <button class="btn" onclick="closeModal()">キャンセル</button>
      <button class="btn btn-primary" id="save-task">保存</button>
    `);
    document.getElementById("delete-task").onclick = async () => {
      if (!confirm("このタスクを削除しますか？")) return;
      try {
        await API.deleteTask(task.id);
        closeModal();
        showToast("タスクを削除しました");
        onSave();
      } catch (e) { showToast(e.message); }
    };
    document.getElementById("save-task").onclick = async () => {
      const form = document.getElementById("modal-body");
      const body = {
        id: task.id,
        title: form.querySelector("[name=title]").value,
      };
      ["client_company_id", "job_seeker_id", "due_date", "priority"].forEach((f) => {
        body[f] = form.querySelector(`[name=${f}]`).value || null;
      });
      try {
        await API.updateTask(body);
        closeModal();
        showToast("タスクを更新しました");
        onSave();
      } catch (e) { showToast(e.message); }
    };
  },

  async organization(container) {
    await OrgAdmin.renderPage(container);
  },

  async insights(container) {
    container.innerHTML = `
      <div class="toolbar">
        <button class="btn btn-primary" id="btn-new-insight">＋ 気づき追加</button>
        <button class="btn" id="btn-export">📤 Google Drive へエクスポート</button>
      </div>
      <div class="card" id="insights-list"><div class="empty-state">読み込み中...</div></div>
    `;
    const load = async () => {
      const { insights } = await API.insights();
      const list = document.getElementById("insights-list");
      if (!insights.length) {
        list.innerHTML = `<div class="empty-state">気づきがありません</div>`;
        return;
      }
      list.innerHTML = insights.map((i) => `
        <div class="memo-item" style="margin-bottom:12px">
          <div class="memo-meta">${(i.created_at || "").slice(0, 16).replace("T", " ")} ${i.exported_at ? "· エクスポート済" : ""}</div>
          <p>${escapeHtml(i.content)}</p>
          ${i.tags ? `<small style="color:var(--muted)">#${escapeHtml(i.tags)}</small>` : ""}
        </div>`).join("");
    };
    await load();
    document.getElementById("btn-new-insight").onclick = () => {
      openModal("気づきを追加", `
        <div class="form-group"><label>内容 *</label><textarea id="insight-content"></textarea></div>
        <div class="form-group" style="margin-top:12px"><label>タグ（カンマ区切り）</label><input id="insight-tags" /></div>
      `, `<button class="btn" onclick="closeModal()">キャンセル</button><button class="btn btn-primary" id="save-insight">保存</button>`);
      document.getElementById("save-insight").onclick = async () => {
        try {
          await API.createInsight({
            content: document.getElementById("insight-content").value,
            tags: document.getElementById("insight-tags").value || null,
          });
          closeModal();
          showToast("保存しました");
          load();
        } catch (e) { showToast(e.message); }
      };
    };
    document.getElementById("btn-export").onclick = async () => {
      try {
        const res = await API.exportInsights();
        showToast(res.message || `${res.count || 0}件をエクスポートしました`);
        load();
      } catch (e) { showToast(e.message); }
    };
  },

  async settings(container) {
    if (!Auth.isOrgMember()) {
      container.innerHTML = `<div class="card empty-state">法人メンバー登録後に設定できます</div>`;
      return;
    }
    const { settings } = await API.orgSettings();
    const canEdit = Auth.isOrgAdmin();
    container.innerHTML = `
      <div class="card">
        <h2 style="margin-bottom:16px">Google Drive 連携</h2>
        <p style="color:var(--muted);font-size:14px;margin-bottom:16px">
          サービスアカウントにフォルダを「編集者」で共有したうえで、フォルダ ID を登録してください。
        </p>
        <div class="form-group"><label>Google Drive フォルダ ID</label>
          <input id="drive-folder-id" value="${escapeHtml(settings.google_drive_folder_id || "")}" ${canEdit ? "" : "disabled"} />
        </div>
        ${canEdit ? `<button class="btn btn-primary" id="save-settings" style="margin-top:16px">保存</button>` : `<p style="margin-top:12px;color:var(--muted)">org_admin のみ編集可能</p>`}
      </div>
    `;
    if (canEdit) {
      document.getElementById("save-settings").onclick = async () => {
        try {
          await API.saveOrgSettings({
            google_drive_folder_id: document.getElementById("drive-folder-id").value,
            google_drive_enabled: true,
          });
          showToast("設定を保存しました");
        } catch (e) { showToast(e.message); }
      };
    }
  },
};
