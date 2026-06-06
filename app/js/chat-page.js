/** PC版 LINE風チャットページ */
const ChatPage = {
  STATE: {
    IDLE: "idle",
    TASK_COMPANY: "task_company",
    TASK_SEEKER: "task_seeker",
    TASK_NAME: "task_name",
    TASK_DUE: "task_due",
    TASK_PRIORITY: "task_priority",
    TASK_COMPLETE_RESULT: "task_complete_result",
    TASK_UPDATE_DUE_DATE: "task_update_due_date",
    INSIGHT_CONTENT: "insight_content",
    INSIGHT_CATEGORY: "insight_category",
  },

  currentState: "idle",
  flowData: {},
  root: null,
  mediaRecorder: null,
  recordingStream: null,
  recordedChunks: [],
  isRecording: false,
  isTranscribing: false,

  async render(container) {
    container.className = "page-content page-content--chat";
    container.innerHTML = `
      <div class="chat-page">
        <div class="chat-panel">
          <div class="chat-body" id="pc-chat-body"></div>
          <div class="quick-actions">
            <button type="button" class="qa-btn" data-qa="task">＋ タスク</button>
            <button type="button" class="qa-btn" data-qa="list">📋 一覧</button>
            <button type="button" class="qa-btn" data-qa="complete">✅ 完了</button>
            <button type="button" class="qa-btn" data-qa="insight">💡 気づき</button>
            <button type="button" class="qa-btn" data-qa="export">📤 出力</button>
            <button type="button" class="qa-btn" data-qa="priority">🔄 優先度</button>
            <button type="button" class="qa-btn" data-qa="due">📅 期日</button>
          </div>
          <footer class="chat-footer">
            <textarea id="pc-chat-input" class="chat-input" placeholder="メッセージを入力..." rows="1"></textarea>
            <button type="button" id="pc-chat-mic" class="mic-btn" aria-label="音声入力" title="音声入力">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1 1.93c-3.94-.49-7-3.85-7-7.93H2c0 4.97 3.59 9.1 8.35 9.84V21h3v-2.23C18.41 18.1 22 13.97 22 9h-2c0 4.08-3.06 7.44-7 7.93V15.93z"/></svg>
            </button>
            <button type="button" id="pc-chat-send" class="send-btn" aria-label="送信">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </footer>
        </div>
      </div>
    `;

    this.root = container;
    this.currentState = this.STATE.IDLE;
    this.flowData = {};
    this.bindEvents();
    await this.loadHistory();
  },

  chatBody() { return this.root.querySelector("#pc-chat-body"); },
  userInput() { return this.root.querySelector("#pc-chat-input"); },
  sendBtn() { return this.root.querySelector("#pc-chat-send"); },
  micBtn() { return this.root.querySelector("#pc-chat-mic"); },

  nowStr() {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  },

  scrollBottom() {
    const el = this.chatBody();
    if (el) el.scrollTop = el.scrollHeight;
  },

  addMessage(text, role, createdAt = null) {
    const wrap = document.createElement("div");
    wrap.className = `msg ${role}`;
    if (role === "bot") {
      const av = document.createElement("div");
      av.className = "msg-avatar";
      av.textContent = "📋";
      wrap.appendChild(av);
    }
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.textContent = text;
    const time = document.createElement("div");
    time.className = "msg-time";
    time.textContent = createdAt ? createdAt.slice(11, 16) : this.nowStr();
    if (role === "user") { wrap.appendChild(time); wrap.appendChild(bubble); }
    else { wrap.appendChild(bubble); wrap.appendChild(time); }
    this.chatBody().appendChild(wrap);
    this.scrollBottom();
  },

  addTyping() {
    const wrap = document.createElement("div");
    wrap.className = "msg bot typing";
    wrap.innerHTML = `<div class="msg-avatar">📋</div><div class="msg-bubble"><div class="dots"><span></span><span></span><span></span></div></div>`;
    this.chatBody().appendChild(wrap);
    this.scrollBottom();
    return wrap;
  },

  addBotMessageWithButtons(text, buttons, onSelect, multiSelect = false) {
    const wrap = document.createElement("div");
    wrap.className = "msg bot";
    const av = document.createElement("div");
    av.className = "msg-avatar";
    av.textContent = "📋";
    wrap.appendChild(av);
    const group = document.createElement("div");
    group.className = "msg-bubble-group";
    const bubble = document.createElement("div");
    bubble.className = "msg-bubble";
    bubble.textContent = text;
    group.appendChild(bubble);
    const btnWrap = document.createElement("div");
    btnWrap.className = "choice-buttons";
    const selected = new Set();

    buttons.forEach(({ label, value, className }) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `choice-btn ${className || ""}`;
      btn.textContent = label;
      btn.dataset.value = value ?? label;
      if (multiSelect) {
        btn.addEventListener("click", () => {
          btn.classList.toggle("selected");
          if (btn.classList.contains("selected")) selected.add(btn.dataset.value);
          else selected.delete(btn.dataset.value);
        });
      } else {
        btn.addEventListener("click", () => {
          btnWrap.querySelectorAll(".choice-btn").forEach((b) => { b.disabled = true; });
          btn.classList.add("selected");
          onSelect(btn.dataset.value);
        });
      }
      btnWrap.appendChild(btn);
    });

    group.appendChild(btnWrap);
    if (multiSelect) {
      const submitBtn = document.createElement("button");
      submitBtn.type = "button";
      submitBtn.className = "choice-submit-btn";
      submitBtn.textContent = "決定";
      submitBtn.addEventListener("click", () => {
        btnWrap.querySelectorAll(".choice-btn").forEach((b) => { b.disabled = true; });
        submitBtn.disabled = true;
        onSelect([...selected]);
      });
      group.appendChild(submitBtn);
    }
    wrap.appendChild(group);
    this.chatBody().appendChild(wrap);
    this.scrollBottom();
  },

  addTaskListMessage(tasks) {
    const wrap = document.createElement("div");
    wrap.className = "msg bot";
    wrap.innerHTML = `<div class="msg-avatar">📋</div>`;
    const group = document.createElement("div");
    group.className = "msg-bubble-group";
    const intro = document.createElement("div");
    intro.className = "msg-bubble";
    intro.textContent = tasks.length ? `未完了タスク ${tasks.length} 件📋` : "未完了タスクはありません🎉";
    group.appendChild(intro);
    if (tasks.length) {
      const list = document.createElement("div");
      list.className = "task-list-bubble";
      tasks.forEach((t) => {
        const item = document.createElement("div");
        item.className = "task-item";
        const p = t.priority || "中";
        const badge = document.createElement("span");
        badge.className = `priority-badge priority-badge-${p === "高" ? "high" : p === "中" ? "mid" : "low"}`;
        badge.textContent = p;
        const title = document.createElement("span");
        title.className = "task-item-title";
        const ctx = [t.company_name, t.job_seeker_name].filter(Boolean).join(" × ");
        title.textContent = ctx ? `${ctx} — ${t.title}` : t.title;
        item.appendChild(badge);
        item.appendChild(title);
        if (t.due_date) {
          const due = document.createElement("span");
          due.className = "task-item-due";
          due.textContent = t.due_date;
          item.appendChild(due);
        }
        list.appendChild(item);
      });
      group.appendChild(list);
    }
    wrap.appendChild(group);
    this.chatBody().appendChild(wrap);
    this.scrollBottom();
  },

  formatTaskLabel(task) {
    const icon = task.priority === "高" ? "🔴" : task.priority === "中" ? "🟡" : "🔵";
    const ctx = [task.company_name, task.job_seeker_name].filter(Boolean).join("×");
    const prefix = ctx ? `${ctx} ` : "";
    return `${icon} ${prefix}${task.title}`;
  },

  setInputEnabled(on) {
    this.userInput().disabled = !on;
    this.sendBtn().disabled = !on;
    if (on) this.userInput().focus();
  },

  async callChat(message) {
    const typing = this.addTyping();
    try {
      const data = await API.chat(message);
      typing.remove();
      if (data.tasks) this.addTaskListMessage(data.tasks);
      else this.addMessage(data.reply, "bot");
    } catch (e) {
      typing.remove();
      this.addMessage(`エラー: ${e.message}`, "bot");
    }
  },

  async loadHistory() {
    this.chatBody().innerHTML = "";
    try {
      const data = await API.messages();
      const msgs = Array.isArray(data) ? data : data.messages || [];
      if (!msgs.length) {
        this.addMessage("AgentDumpへようこそ！💬\nタスク・企業・転職者を管理できます", "bot");
        return;
      }
      let lastDate = "";
      msgs.forEach((m) => {
        const d = (m.created_at || "").slice(0, 10);
        if (d !== lastDate) {
          const sep = document.createElement("div");
          sep.className = "history-separator";
          sep.textContent = d;
          this.chatBody().appendChild(sep);
          lastDate = d;
        }
        this.addMessage(m.content, m.role === "user" ? "user" : "bot", m.created_at);
      });
    } catch {
      this.addMessage("AgentDumpへようこそ！💬\nタスク・企業・転職者を管理できます", "bot");
    }
  },

  async startTaskFlow() {
    this.flowData = {};
    this.setInputEnabled(false);
    if (Auth.isOrgMember()) {
      this.currentState = this.STATE.TASK_COMPANY;
      try {
        const { companies } = await API.companies();
        const btns = [{ label: "スキップ", value: "" }, ...companies.map((c) => ({ label: c.name, value: c.id }))];
        this.addBotMessageWithButtons("担当企業を選んでください（任意）", btns, (id) => {
          this.flowData.client_company_id = id || null;
          this.addMessage(id ? companies.find((c) => c.id === id)?.name || "選択" : "スキップ", "user");
          this.pickSeekerForTask();
        });
      } catch {
        this.currentState = this.STATE.TASK_NAME;
        this.setInputEnabled(true);
        this.addMessage("タスク内容を入力してください", "bot");
      }
    } else {
      this.currentState = this.STATE.TASK_NAME;
      this.setInputEnabled(true);
      this.addMessage("タスク内容を入力してください", "bot");
    }
  },

  async pickSeekerForTask() {
    this.currentState = this.STATE.TASK_SEEKER;
    try {
      const { jobSeekers } = await API.jobSeekers();
      const btns = [{ label: "スキップ", value: "" }, ...jobSeekers.map((j) => ({ label: j.name, value: j.id }))];
      this.addBotMessageWithButtons("担当転職者を選んでください（任意）", btns, (id) => {
        this.flowData.job_seeker_id = id || null;
        this.addMessage(id ? jobSeekers.find((j) => j.id === id)?.name || "選択" : "スキップ", "user");
        this.currentState = this.STATE.TASK_NAME;
        this.setInputEnabled(true);
        this.addMessage("タスク内容を入力してください", "bot");
      });
    } catch {
      this.currentState = this.STATE.TASK_NAME;
      this.setInputEnabled(true);
      this.addMessage("タスク内容を入力してください", "bot");
    }
  },

  async finishTaskAdd() {
    this.currentState = this.STATE.IDLE;
    this.setInputEnabled(false);
    try {
      await API.createTask({
        title: this.flowData.title,
        due_date: this.flowData.dueDate,
        priority: this.flowData.priority,
        client_company_id: this.flowData.client_company_id,
        job_seeker_id: this.flowData.job_seeker_id,
      });
      this.addMessage(`「${this.flowData.title}」を登録したよ✅`, "bot");
    } catch (e) {
      this.addMessage(`エラー: ${e.message}`, "bot");
    }
    this.setInputEnabled(true);
  },

  async startCompleteFlow() {
    this.flowData = {};
    this.setInputEnabled(false);
    const typing = this.addTyping();
    let tasks = [];
    try { tasks = (await API.tasks()).tasks || []; } catch (_) {}
    typing.remove();
    if (!tasks.length) {
      this.addMessage("未完了タスクはありません🎉", "bot");
      this.setInputEnabled(true);
      return;
    }
    this.addBotMessageWithButtons("完了するタスクを選んでください", tasks.map((t) => ({ label: this.formatTaskLabel(t), value: t.id })), (id) => {
      this.flowData.completeTaskId = id;
      this.currentState = this.STATE.TASK_COMPLETE_RESULT;
      this.setInputEnabled(true);
      this.addMessage("結果・成果を入力（「なし」でスキップ）", "bot");
    });
  },

  async startUpdatePriorityFlow() {
    this.flowData = {};
    const tasks = (await API.tasks()).tasks || [];
    if (!tasks.length) { this.addMessage("未完了タスクはありません", "bot"); return; }
    this.addBotMessageWithButtons("優先度を変えるタスクを選んでください", tasks.map((t) => ({ label: this.formatTaskLabel(t), value: t.id })), (id) => {
      const task = tasks.find((t) => t.id === id);
      this.addBotMessageWithButtons("新しい優先度", [
        { label: "🔴 高", value: "高", className: "priority-high" },
        { label: "🟡 中", value: "中", className: "priority-mid" },
        { label: "🟢 低", value: "低", className: "priority-low" },
      ], async (p) => {
        this.setInputEnabled(false);
        const typing = this.addTyping();
        try {
          await API.updateTask({ id, priority: p });
          typing.remove();
          this.addMessage(`「${task.title}」の優先度を${p}に変更しました`, "bot");
        } catch (e) {
          typing.remove();
          this.addMessage(e.message, "bot");
        }
        this.setInputEnabled(true);
      });
    });
  },

  async startUpdateDueFlow() {
    this.flowData = {};
    const tasks = (await API.tasks()).tasks || [];
    if (!tasks.length) { this.addMessage("未完了タスクはありません", "bot"); return; }
    this.addBotMessageWithButtons("期日を変えるタスクを選んでください", tasks.map((t) => ({ label: this.formatTaskLabel(t), value: t.id })), (id) => {
      this.flowData.updateTaskId = id;
      this.flowData.updateTitle = tasks.find((t) => t.id === id)?.title || "";
      this.currentState = this.STATE.TASK_UPDATE_DUE_DATE;
      this.setInputEnabled(true);
      this.addMessage("新しい期日（例: 2026-06-10、「なし」で削除）", "bot");
    });
  },

  async showTaskList() {
    this.addMessage("タスク一覧", "user");
    const typing = this.addTyping();
    try {
      const tasks = (await API.tasks()).tasks || [];
      typing.remove();
      this.addTaskListMessage(tasks);
    } catch (e) {
      typing.remove();
      this.addMessage(e.message, "bot");
    }
  },

  startInsightFlow() {
    this.flowData = {};
    this.currentState = this.STATE.INSIGHT_CONTENT;
    this.setInputEnabled(true);
    this.addMessage("気づきを入力してください📝", "bot");
  },

  async handleUserInput(text) {
    if (!text) return;
    this.userInput().value = "";
    this.userInput().style.height = "auto";
    this.addMessage(text, "user");

    if (this.currentState === this.STATE.IDLE) {
      this.setInputEnabled(false);
      await this.callChat(text);
      this.setInputEnabled(true);
      return;
    }

    if (this.currentState === this.STATE.TASK_NAME) {
      this.flowData.title = text;
      this.currentState = this.STATE.TASK_DUE;
      this.addMessage("期限は？（例: 2026-06-10、「なし」で未設定）", "bot");
      return;
    }

    if (this.currentState === this.STATE.TASK_DUE) {
      this.flowData.dueDate = text === "なし" ? null : text;
      this.currentState = this.STATE.TASK_PRIORITY;
      this.setInputEnabled(false);
      this.addBotMessageWithButtons("優先度を選んでください", [
        { label: "🔴 高", value: "高", className: "priority-high" },
        { label: "🟡 中", value: "中", className: "priority-mid" },
        { label: "🟢 低", value: "低", className: "priority-low" },
      ], async (p) => {
        this.flowData.priority = p;
        this.addMessage(p, "user");
        await this.finishTaskAdd();
      });
      return;
    }

    if (this.currentState === this.STATE.TASK_COMPLETE_RESULT) {
      this.currentState = this.STATE.IDLE;
      this.setInputEnabled(false);
      const typing = this.addTyping();
      try {
        const data = await API.completeTask(this.flowData.completeTaskId, text === "なし" ? null : text);
        typing.remove();
        this.addMessage(`「${data.task?.title || "タスク"}」を完了✅`, "bot");
      } catch (e) {
        typing.remove();
        this.addMessage(e.message, "bot");
      }
      this.setInputEnabled(true);
      return;
    }

    if (this.currentState === this.STATE.TASK_UPDATE_DUE_DATE) {
      this.currentState = this.STATE.IDLE;
      this.setInputEnabled(false);
      const typing = this.addTyping();
      const dueDate = text === "なし" ? null : text;
      try {
        await API.updateTask({ id: this.flowData.updateTaskId, due_date: dueDate });
        typing.remove();
        this.addMessage(`「${this.flowData.updateTitle}」の期日を${text === "なし" ? "未設定" : text}に変更しました`, "bot");
      } catch (e) {
        typing.remove();
        this.addMessage(e.message, "bot");
      }
      this.setInputEnabled(true);
      return;
    }

    if (this.currentState === this.STATE.INSIGHT_CONTENT) {
      this.flowData.content = text;
      this.currentState = this.STATE.INSIGHT_CATEGORY;
      this.setInputEnabled(false);
      const typing = this.addTyping();
      let cats = ["仕事", "学び", "転職", "クライアント", "その他"];
      try {
        cats = (await API.suggestCategories(text)).categories || cats;
      } catch (_) {}
      typing.remove();
      this.addBotMessageWithButtons("カテゴリ（複数可）", cats.map((c) => ({ label: c, value: c })), async (sel) => {
        const tags = Array.isArray(sel) ? sel.join(",") : sel;
        this.currentState = this.STATE.IDLE;
        await this.callChat(`気づき: ${this.flowData.content}${tags ? `、タグ:${tags}` : ""}`);
        this.setInputEnabled(true);
      }, true);
    }
  },

  resetMic() {
    this.isRecording = false;
    this.micBtn()?.classList.remove("recording");
  },

  async toggleMic() {
    if (this.isTranscribing) return;
    if (this.isRecording) {
      this.mediaRecorder?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.addMessage("この端末では音声入力が使えません", "bot");
      return;
    }
    try {
      this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.recordedChunks = [];
      this.mediaRecorder = new MediaRecorder(this.recordingStream);
      this.mediaRecorder.ondataavailable = (e) => { if (e.data.size) this.recordedChunks.push(e.data); };
      this.mediaRecorder.onstop = async () => {
        this.recordingStream.getTracks().forEach((t) => t.stop());
        this.resetMic();
        const blob = new Blob(this.recordedChunks, { type: this.recordedChunks[0]?.type || "audio/webm" });
        if (!blob.size) return;
        this.isTranscribing = true;
        try {
          const text = await API.transcribe(blob);
          if (text) {
            this.userInput().value = text;
            this.userInput().focus();
          }
        } catch (e) {
          this.addMessage(e.message, "bot");
        }
        this.isTranscribing = false;
      };
      this.mediaRecorder.start();
      this.isRecording = true;
      this.micBtn().classList.add("recording");
    } catch {
      this.addMessage("マイクの使用が許可されていません", "bot");
    }
  },

  bindEvents() {
    const input = this.userInput();
    const send = this.sendBtn();
    const mic = this.micBtn();

    send.addEventListener("click", () => this.handleUserInput(input.value.trim()));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        this.handleUserInput(input.value.trim());
      }
    });
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
    });
    mic.addEventListener("click", () => this.toggleMic());

    this.root.querySelector('[data-qa="task"]').addEventListener("click", () => this.startTaskFlow());
    this.root.querySelector('[data-qa="insight"]').addEventListener("click", () => this.startInsightFlow());
    this.root.querySelector('[data-qa="list"]').addEventListener("click", () => App.navigate("tasks"));
    this.root.querySelector('[data-qa="complete"]').addEventListener("click", () => this.startCompleteFlow());
    this.root.querySelector('[data-qa="priority"]').addEventListener("click", () => this.startUpdatePriorityFlow());
    this.root.querySelector('[data-qa="due"]').addEventListener("click", () => this.startUpdateDueFlow());
    this.root.querySelector('[data-qa="export"]').addEventListener("click", async () => {
      this.addMessage("気づきを Google Drive へ出力", "user");
      const typing = this.addTyping();
      try {
        const res = await API.exportInsights();
        typing.remove();
        this.addMessage(res.message || `${res.count || 0}件を出力したよ📤`, "bot");
      } catch (e) {
        typing.remove();
        this.addMessage(e.message, "bot");
      }
    });
  },
};
