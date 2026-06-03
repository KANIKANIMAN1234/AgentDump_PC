/**
 * PC版: 組織階層ウィザード・メンバー招待
 */
const OrgAdmin = (function () {
  let container = null;
  let latestAuth = null;
  let orgState = { depth: null, headquarters: [] };
  let currentSetupOrgName = "";

  function mount(html) {
    if (!container) return;
    container.innerHTML = `<div class="org-page card">${html}</div>`;
  }

  function extractInviteFromResponse(data) {
    const invite = data?.invite || data?.representativeInvite?.invite;
    if (!invite?.invite_url) return null;
    const member = data?.member || data?.representativeInvite?.member;
    return {
      url: invite.invite_url,
      displayName: member?.display_name || "—",
      role: member?.role || "—",
      expiresAt: invite.expires_at || null,
    };
  }

  function showInviteApiResult(areaId, boxId, preId, data) {
    const area = document.getElementById(areaId);
    const box = document.getElementById(boxId);
    const pre = document.getElementById(preId);
    if (!area || !pre) return;
    area.hidden = false;
    pre.textContent = JSON.stringify(data, null, 2);
    const info = extractInviteFromResponse(data);
    if (!info || !box) return;
    const expires = info.expiresAt
      ? new Date(info.expiresAt).toLocaleString("ja-JP")
      : "—";
    box.hidden = false;
    box.innerHTML = `
      <p class="org-invite-title">招待 URL（この URL を送付）</p>
      <div class="org-invite-url-row">
        <input type="text" class="org-invite-url-input" id="${boxId}-url" readonly />
        <button type="button" class="btn btn-sm btn-primary org-invite-copy" data-target="${boxId}-url">コピー</button>
      </div>
      <p class="org-invite-meta">招待先: <strong>${escapeHtml(info.displayName)}</strong>（${escapeHtml(info.role)}）<br />有効期限: ${escapeHtml(expires)}</p>
    `;
    const input = document.getElementById(`${boxId}-url`);
    input.value = info.url;
    box.querySelector(".org-invite-copy").addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const el = document.getElementById(btn.dataset.target);
      try {
        await navigator.clipboard.writeText(el.value);
        btn.textContent = "コピー済";
      } catch {
        el.select();
        document.execCommand("copy");
        btn.textContent = "コピー済";
      }
    });
  }

  function renderSetupStep1(orgName) {
    currentSetupOrgName = orgName;
    mount(`
      <div class="org-panel-inner">
        <h2 class="org-en-label">ORGANIZATION</h2>
        <h3>組織階層の設定</h3>
        <p class="org-sub">${escapeHtml(orgName)} の組織構造を選んでください。</p>
        <div class="org-depth-btns">
          <button type="button" class="btn org-depth-btn" data-depth="0">0段 — 代表者のみ</button>
          <button type="button" class="btn org-depth-btn" data-depth="1">1段 — 部門のみ</button>
          <button type="button" class="btn org-depth-btn" data-depth="2">2段 — 本部→部門</button>
          <button type="button" class="btn org-depth-btn" data-depth="3">3段 — 本部→課→部門</button>
        </div>
      </div>
    `);
    container.querySelectorAll(".org-depth-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        orgState.depth = Number(btn.dataset.depth);
        orgState.headquarters =
          orgState.depth === 0 ? [] : [{ name: "", departments: [""] }];
        renderSetupStep2(orgName);
      });
    });
  }

  function renderSetupStep2(orgName) {
    currentSetupOrgName = orgName;
    const d = Number(orgState.depth);
    orgState.depth = d;
    let body = "";
    if (d === 0) {
      body = `<p class="org-solo-note">部門・部下の登録はありません。<strong>代表者（あなた）1名のみ</strong>で利用します。</p>`;
    } else if (d === 1) {
      body = `<label>部門名（複数可）</label><div id="dept-list-1"></div>
        <button type="button" class="btn btn-sm" id="add-dept-1">＋ 部門を追加</button>`;
    } else if (d === 2) {
      body = `<div id="hq-list-2"></div><button type="button" class="btn btn-sm" id="add-hq-2">＋ 本部を追加</button>`;
    } else if (d === 3) {
      body = `<div id="hq-list-3"></div><button type="button" class="btn btn-sm" id="add-hq-3">＋ 本部を追加</button>`;
    } else {
      orgState.depth = 1;
      return renderSetupStep2(orgName);
    }
    mount(`
      <div class="org-panel-inner">
        <h2 class="org-en-label">SETUP</h2>
        <h3>${d === 0 ? "代表者のみの確認" : `組織名の入力（${d}段）`}</h3>
        <p class="org-sub">${escapeHtml(orgName)}</p>
        ${body}
        <label class="org-terms">
          <input type="checkbox" id="agreed-terms" />
          管理者は配下メンバーが登録した気づきの全文を業務管理上閲覧できることに同意します
        </label>
        <div class="org-actions">
          <button type="button" class="btn" id="org-back">戻る</button>
          <button type="button" class="btn btn-primary" id="org-submit">設定を保存</button>
        </div>
      </div>
    `);
    if (d === 1) initDeptList1();
    if (d === 2) initHqList2();
    if (d === 3) initHqList3();
    document.getElementById("org-back")?.addEventListener("click", () => renderSetupStep1(orgName));
    document.getElementById("org-submit")?.addEventListener("click", () => submitSetup(orgName));
  }

  function initDeptList1() {
    const wrap = document.getElementById("dept-list-1");
    if (!wrap) return;
    function addRow(val = "") {
      const row = document.createElement("div");
      row.className = "org-input-row";
      row.innerHTML = `<input type="text" class="dept-input" value="${escapeHtml(val)}" placeholder="部門名" />
        <button type="button" class="btn btn-sm btn-danger org-remove-btn">×</button>`;
      row.querySelector(".org-remove-btn").addEventListener("click", () => row.remove());
      wrap.appendChild(row);
    }
    addRow();
    document.getElementById("add-dept-1").addEventListener("click", () => addRow());
  }

  function initHqList2() {
    const wrap = document.getElementById("hq-list-2");
    if (!wrap) return;
    function render() {
      wrap.innerHTML = "";
      orgState.headquarters.forEach((hq, hi) => {
        const block = document.createElement("div");
        block.className = "org-block";
        block.innerHTML = `
          <label>本部名</label>
          <input type="text" class="hq-name" data-hi="${hi}" value="${escapeHtml(hq.name)}" placeholder="例：事業本部" />
          <label>部門</label>
          <div class="hq-depts" data-hi="${hi}"></div>
          <button type="button" class="btn btn-sm add-dept" data-hi="${hi}">＋ 部門</button>`;
        wrap.appendChild(block);
        const deptWrap = block.querySelector(".hq-depts");
        (hq.departments || [""]).forEach((dn, di) => {
          const row = document.createElement("div");
          row.className = "org-input-row";
          row.innerHTML = `<input type="text" class="dept-name" value="${escapeHtml(dn)}" />
            <button type="button" class="btn btn-sm btn-danger org-remove-btn">×</button>`;
          row.querySelector(".org-remove-btn").addEventListener("click", () => {
            hq.departments.splice(di, 1);
            render();
          });
          deptWrap.appendChild(row);
        });
        block.querySelector(".add-dept").addEventListener("click", () => {
          hq.departments.push("");
          render();
        });
      });
    }
    render();
    document.getElementById("add-hq-2").addEventListener("click", () => {
      orgState.headquarters.push({ name: "", departments: [""] });
      render();
    });
  }

  function initHqList3() {
    const wrap = document.getElementById("hq-list-3");
    if (!wrap) return;
    if (!orgState.headquarters[0]) {
      orgState.headquarters = [{ name: "", sections: [{ name: "", departments: [""] }] }];
    }
    function render() {
      wrap.innerHTML = "";
      orgState.headquarters.forEach((hq, hi) => {
        if (!hq.sections) hq.sections = [{ name: "", departments: [""] }];
        const block = document.createElement("div");
        block.className = "org-block";
        block.innerHTML = `
          <label>本部名</label>
          <input type="text" class="hq-name" value="${escapeHtml(hq.name)}" placeholder="例：事業本部" />
          <div class="hq-sections" data-hi="${hi}"></div>
          <button type="button" class="btn btn-sm add-sec" data-hi="${hi}">＋ 課を追加</button>`;
        const secWrap = block.querySelector(".hq-sections");
        hq.sections.forEach((sec, si) => {
          const secBlock = document.createElement("div");
          secBlock.className = "org-sub-block";
          secBlock.innerHTML = `
            <label>課・チーム名</label>
            <input type="text" class="sec-name" value="${escapeHtml(sec.name)}" />
            <div class="sec-depts"></div>
            <button type="button" class="btn btn-sm add-dept3">＋ 部門</button>`;
          const deptWrap = secBlock.querySelector(".sec-depts");
          (sec.departments || [""]).forEach((dn, di) => {
            const row = document.createElement("div");
            row.className = "org-input-row";
            row.innerHTML = `<input type="text" class="dept-name" value="${escapeHtml(dn)}" />
              <button type="button" class="btn btn-sm btn-danger org-remove-btn">×</button>`;
            row.querySelector(".org-remove-btn").addEventListener("click", () => {
              sec.departments.splice(di, 1);
              render();
            });
            deptWrap.appendChild(row);
          });
          secBlock.querySelector(".add-dept3").addEventListener("click", () => {
            sec.departments.push("");
            render();
          });
          secWrap.appendChild(secBlock);
        });
        block.querySelector(".add-sec").addEventListener("click", () => {
          hq.sections.push({ name: "", departments: [""] });
          render();
        });
        wrap.appendChild(block);
      });
    }
    render();
    document.getElementById("add-hq-3").addEventListener("click", () => {
      orgState.headquarters.push({ name: "", sections: [{ name: "", departments: [""] }] });
      render();
    });
  }

  function collectSetupPayload() {
    const root = container.querySelector(".org-page");
    const d = orgState.depth;
    if (d === 0) return { depth: 0, agreed_terms: true };
    if (d === 1) {
      const departments = [...root.querySelectorAll(".dept-input")]
        .map((i) => i.value.trim())
        .filter(Boolean);
      return { depth: 1, departments, agreed_terms: true };
    }
    if (d === 2) {
      const headquarters = [...root.querySelectorAll(".org-block")].map((block) => {
        const name = block.querySelector(".hq-name")?.value.trim() || "";
        const departments = [...block.querySelectorAll(".dept-name")]
          .map((i) => i.value.trim())
          .filter(Boolean);
        return { name, departments };
      });
      return { depth: 2, headquarters, agreed_terms: true };
    }
    const headquarters = orgState.headquarters.map((hq, hi) => {
      const block = root.querySelectorAll(".org-block")[hi];
      const name = block?.querySelector(".hq-name")?.value.trim() || hq.name;
      const sections = [...(block?.querySelectorAll(".org-sub-block") || [])].map((secBlock) => {
        const secName = secBlock.querySelector(".sec-name")?.value.trim() || "";
        const departments = [...secBlock.querySelectorAll(".dept-name")]
          .map((i) => i.value.trim())
          .filter(Boolean);
        return { name: secName, departments };
      });
      return { name, sections };
    });
    return { depth: 3, headquarters, agreed_terms: true };
  }

  async function submitSetup(orgName) {
    if (!document.getElementById("agreed-terms")?.checked) {
      showToast("利用規約への同意が必要です");
      return;
    }
    const submitBtn = document.getElementById("org-submit");
    if (submitBtn) submitBtn.disabled = true;
    try {
      const payload = collectSetupPayload();
      await API.orgSetup(payload);
      const savedDepth = orgState.depth;
      latestAuth = {
        ...latestAuth,
        needsOrgSetup: false,
        organization: {
          ...latestAuth.organization,
          status: "active",
          org_structure_depth: savedDepth,
        },
      };
      updateNavVisibility(latestAuth);
      if (savedDepth === 0) {
        showToast("代表者のみの組織として設定が完了しました");
        mount(`<div class="empty-state">0段組織の設定が完了しました。メンバー招待は不要です。</div>`);
        return;
      }
      showToast("組織設定が完了しました");
      await renderInvitePanel(orgName);
    } catch (e) {
      showToast(e.message);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  }

  async function renderInvitePanel(orgName) {
    let treeData;
    try {
      treeData = await API.orgTree();
    } catch (e) {
      mount(`<div class="empty-state" style="color:var(--dulton-red)">${escapeHtml(e.message)}</div>`);
      return;
    }
    const units = treeData.invitableUnits || [];
    const unitOptions = units
      .map((u) => {
        const prefix = u.unit_type === "hq" ? "本部" : u.unit_type === "section" ? "課" : "部門";
        return `<option value="${u.id}">[${prefix}] ${escapeHtml(u.name)}</option>`;
      })
      .join("");
    const roleOptions =
      treeData.member.role === "org_admin"
        ? `<option value="unit_admin">本部管理者</option>
           <option value="dept_admin">部門管理者</option>
           <option value="member">メンバー</option>`
        : treeData.member.role === "unit_admin"
          ? `<option value="dept_admin">部門管理者</option><option value="member">メンバー</option>`
          : `<option value="member">メンバー</option>`;

    mount(`
      <div class="org-panel-inner">
        <h2 class="org-en-label">INVITE</h2>
        <h3>メンバー招待</h3>
        <p class="org-sub">${escapeHtml(orgName || treeData.organization?.name || "")}</p>
        <div class="form-grid">
          <div class="form-group"><label>氏名</label><input type="text" id="inv-name" placeholder="山田 太郎" /></div>
          <div class="form-group"><label>ロール</label><select id="inv-role">${roleOptions}</select></div>
          <div class="form-group full"><label>所属組織</label><select id="inv-unit">${unitOptions}</select></div>
        </div>
        <button type="button" class="btn btn-primary" id="inv-submit" style="margin-top:12px">招待 URL を発行</button>
        <div id="inv-result-area" class="org-invite-result-area" hidden>
          <div id="inv-invite-box" class="org-invite-highlight" hidden></div>
          <details class="org-result-details">
            <summary>レスポンス詳細（JSON）</summary>
            <pre id="inv-result" class="org-result"></pre>
          </details>
        </div>
        <hr style="margin:24px 0;border:none;border-top:1px solid var(--border)" />
        <h3 class="org-en-label" style="margin-bottom:12px">MEMBERS</h3>
        <div id="member-list" class="org-member-list">読み込み中…</div>
      </div>
    `);

    document.getElementById("inv-submit").addEventListener("click", async () => {
      const display_name = document.getElementById("inv-name").value.trim();
      const role = document.getElementById("inv-role").value;
      const org_unit_id = document.getElementById("inv-unit").value;
      if (!display_name) {
        showToast("氏名を入力してください");
        return;
      }
      try {
        const data = await API.orgInvite({ display_name, role, org_unit_id });
        showInviteApiResult("inv-result-area", "inv-invite-box", "inv-result", data);
        loadMemberList();
      } catch (e) {
        showToast(e.message);
      }
    });
    await loadMemberList();
  }

  async function loadMemberList() {
    const el = document.getElementById("member-list");
    if (!el) return;
    try {
      const data = await API.orgMembers();
      el.innerHTML = (data.members || [])
        .map(
          (m) =>
            `<div class="org-member-item"><strong>${escapeHtml(m.display_name)}</strong>
              <span>${escapeHtml(m.role)} / ${escapeHtml(m.org_unit_name || "—")} / ${escapeHtml(m.status)}</span></div>`
        )
        .join("") || "メンバーはいません";
    } catch (e) {
      el.textContent = e.message;
    }
  }

  function updateNavVisibility(me) {
    const nav = document.getElementById("nav-organization");
    if (!nav || !me || me.legacy) {
      if (nav) nav.classList.add("hidden");
      return;
    }
    const isSoloOrg = me.organization?.org_structure_depth === 0 && me.organization?.status === "active";
    const show =
      me.needsOrgSetup || (!isSoloOrg && me.member && me.member.role !== "member");
    nav.classList.toggle("hidden", !show);
  }

  return {
    init(me) {
      if (!me || me.legacy) return;
      latestAuth = me;
      updateNavVisibility(me);
    },

    async renderPage(el) {
      container = el;
      if (!latestAuth || latestAuth.legacy) {
        mount(`<div class="empty-state">法人メンバー登録後に利用できます</div>`);
        return;
      }
      const orgName = latestAuth.organization?.name || "";
      if (latestAuth.needsOrgSetup) {
        renderSetupStep1(orgName);
        return;
      }
      const isSoloOrg = latestAuth.organization?.org_structure_depth === 0;
      if (isSoloOrg) {
        mount(`<div class="empty-state">0段組織（代表者のみ）のため、メンバー招待は不要です。</div>`);
        return;
      }
      if (latestAuth.member?.role === "member") {
        mount(`<div class="empty-state">メンバー招待は管理者のみ利用できます。</div>`);
        return;
      }
      await renderInvitePanel(orgName);
    },
  };
})();
