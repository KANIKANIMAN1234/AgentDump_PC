const Auth = {
  liffId: "",

  async init() {
    const cfg = await API.loadConfig();
    API.base = window.location.origin;
    this.liffId = cfg.liffId || new URLSearchParams(location.search).get("liffId") || "";

    if (!this.liffId) {
      throw new Error("LIFF_ID が未設定です。Vercel 環境変数または URL パラメータ ?liffId= を指定してください");
    }

    await liff.init({ liffId: this.liffId });

    if (!liff.isLoggedIn()) {
      liff.login({ redirectUri: window.location.href.split("?")[0] });
      return false;
    }

    const token = liff.getAccessToken();
    API.setToken(token);

    const invite = new URLSearchParams(location.search).get("invite");
    if (invite) {
      try {
        await API.activateInvite(invite);
        history.replaceState({}, "", location.pathname + location.hash);
        showToast("招待を受け付けました");
      } catch (e) {
        throw new Error(`招待の有効化に失敗しました: ${e.message}`);
      }
    }

    const me = await API.authMe();
    API.me = me;
    this.renderUserInfo(me);
    if (typeof OrgAdmin !== "undefined") OrgAdmin.init(me);
    return true;
  },

  renderUserInfo(me) {
    const el = document.getElementById("user-info");
    const profile = me.lineProfile || {};
    const orgName = me.organization?.name || "";
    document.getElementById("header-org").textContent = orgName;

    el.innerHTML = `
      ${profile.pictureUrl ? `<img src="${profile.pictureUrl}" alt="" />` : ""}
      <div>
        <div>${escapeHtml(profile.displayName || "ユーザー")}</div>
        <small style="opacity:0.75">${me.legacy ? "個人モード" : escapeHtml(me.member?.role || "")}</small>
      </div>
    `;
  },

  isOrgMember() {
    return API.me && !API.me.legacy;
  },

  isOrgAdmin() {
    return API.me?.member?.role === "org_admin";
  },
};

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg, ms = 3000) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), ms);
}

function openModal(title, bodyHtml, footerHtml) {
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-body").innerHTML = bodyHtml;
  document.getElementById("modal-footer").innerHTML = footerHtml || "";
  document.getElementById("modal-overlay").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
}

document.getElementById("modal-close").addEventListener("click", closeModal);
document.getElementById("modal-overlay").addEventListener("click", (e) => {
  if (e.target.id === "modal-overlay") closeModal();
});

function priorityBadge(p) {
  const cls = p === "高" ? "badge-high" : p === "低" ? "badge-low" : "badge-mid";
  return `<span class="badge ${cls}">${escapeHtml(p || "中")}</span>`;
}

function employmentLabel(s) {
  if (s === "employed") return "現職あり";
  if (s === "retired") return "退職済み";
  return "—";
}

function driveLink(fileId) {
  if (!fileId) return "—";
  return `<a class="link" href="https://drive.google.com/file/d/${fileId}/view" target="_blank" rel="noopener">Driveで開く</a>`;
}
