const STORAGE_KEY = "returnflow.mock.requests.v1";
const POLL_INTERVAL = 3000;

const STATUS_META = {
  RECEIVED: {
    label: "접수됨",
    badgeClass: "badge badge-received",
    message: "반품 요청이 접수되었습니다.",
  },
  ROS_DISPATCHED: {
    label: "ROS 전달 완료",
    badgeClass: "badge badge-dispatched",
    message: "검수 요청이 로봇 시스템으로 전달되었습니다.",
  },
  ROBOT_JUDGING: {
    label: "로봇 판정 진행중",
    badgeClass: "badge badge-judging",
    message: "로봇이 현재 반품 상태를 판정 중입니다.",
  },
  NEEDS_REVIEW: {
    label: "추가 확인 필요",
    badgeClass: "badge badge-review",
    message: "자동 판정만으로는 결정이 어려워 추가 확인이 필요합니다.",
  },
  APPROVED: {
    label: "승인",
    badgeClass: "badge badge-approved",
    message: "반품 요청이 승인되었습니다.",
  },
  REJECTED: {
    label: "반려",
    badgeClass: "badge badge-rejected",
    message: "반품 요청이 반려되었습니다.",
  },
  ERROR: {
    label: "오류 발생",
    badgeClass: "badge badge-error",
    message: "처리 중 오류가 발생했습니다. 잠시 후 다시 확인해 주세요.",
  },
};

const STEPS = [
  { id: "RECEIVED", label: "접수" },
  { id: "ROS_DISPATCHED", label: "ROS 전달" },
  { id: "ROBOT_JUDGING", label: "판정 진행" },
  { id: "FINAL", label: "최종 결과" },
];

const FINAL_STATUSES = new Set(["APPROVED", "REJECTED", "NEEDS_REVIEW", "ERROR"]);

const DEMO_SAMPLES = [
  { object_name: "무선 이어폰 케이스", return_reason: "충전이 되지 않고 LED가 깜빡이지 않습니다." },
  { object_name: "블루투스 키보드", return_reason: "키 입력이 여러 번 중복되어 정상 사용이 어렵습니다." },
  { object_name: "텀블러 뚜껑", return_reason: "배송 직후 균열이 보이고 물이 샙니다." },
];

const app = document.getElementById("app");
let statusPollTimer = null;

window.addEventListener("popstate", renderRoute);
document.addEventListener("click", handleNavigation);

renderRoute();

function handleNavigation(event) {
  const link = event.target.closest("[data-link]");
  if (!link) return;

  const href = link.getAttribute("href");
  if (!href || href.startsWith("http")) return;

  event.preventDefault();
  navigate(href);
}

function navigate(path) {
  window.history.pushState({}, "", path);
  renderRoute();
}

function renderRoute() {
  clearStatusPolling();
  const path = window.location.pathname;

  if (path === "/") {
    app.innerHTML = renderLandingPage();
    return;
  }

  if (path === "/request") {
    app.innerHTML = renderRequestPage();
    bindRequestForm();
    return;
  }

  if (path.startsWith("/receipt/")) {
    const requestId = decodeURIComponent(path.split("/receipt/")[1] || "");
    app.innerHTML = renderReceiptPage(requestId);
    return;
  }

  if (path === "/status") {
    app.innerHTML = renderStatusLookupPage();
    bindLookupForm();
    return;
  }

  if (path.startsWith("/status/")) {
    const requestId = decodeURIComponent(path.split("/status/")[1] || "");
    renderStatusDetailPage(requestId);
    return;
  }

  app.innerHTML = renderNotFoundPage();
}

function renderLandingPage() {
  const sampleId = ensureDemoSeed();
  return `
    <section class="hero">
      <div class="panel hero-copy">
        <span class="eyebrow">반품 접수부터 로봇 판정 추적까지</span>
        <h1>로그인 없이 접수하고,<br />로봇 판정 흐름을 바로 확인하세요.</h1>
        <p class="lead">
          ReturnFlow는 반품 object 이름과 반품 사유만 입력하면 요청을 접수하고,
          ROS 기반 로봇 판정 단계와 최종 결과를 한 화면에서 보여주는 서비스입니다.
        </p>
        <div class="chips">
          <span>무로그인 접수</span>
          <span>ROS 연동 전제</span>
          <span>상태 추적 지원</span>
          <span>운영 이력 확장 가능</span>
        </div>
        <div class="hero-actions">
          <a class="button" href="/request" data-link>반품 접수 시작</a>
          <a class="ghost-button" href="/status/${sampleId}" data-link>데모 상태 보기</a>
        </div>
      </div>

      <aside class="panel hero-card">
        <div class="hero-stat">
          <span class="eyebrow">Process</span>
          <strong>01</strong>
          <p class="muted">사용자가 object 이름과 반품 사유를 입력합니다.</p>
        </div>
        <div class="hero-stat">
          <span class="eyebrow">Bridge</span>
          <strong>02</strong>
          <p class="muted">백엔드가 요청을 저장하고 ROS 연동 계층으로 전달합니다.</p>
        </div>
        <div class="hero-stat">
          <span class="eyebrow">Result</span>
          <strong>03</strong>
          <p class="muted">로봇 판정 상태와 최종 결과를 상태 페이지에서 추적합니다.</p>
        </div>
      </aside>
    </section>

    <section class="section stack">
      <div>
        <span class="eyebrow">왜 필요한가</span>
        <h2>단순 접수가 아니라, 실제 판정 흐름까지 투명하게 보여주는 반품 서비스</h2>
      </div>
      <div class="section-grid">
        <article class="panel info-card">
          <span class="eyebrow">사용자</span>
          <p class="muted">접수 이후 지금 어디 단계인지, 추가 확인이 필요한지, 최종 판정이 무엇인지 바로 이해할 수 있습니다.</p>
        </article>
        <article class="panel info-card">
          <span class="eyebrow">운영팀</span>
          <p class="muted">웹 제출, 백엔드 저장, ROS 요청, 로봇 응답까지 끊긴 지점을 이력 기반으로 추적하기 쉽습니다.</p>
        </article>
        <article class="panel info-card">
          <span class="eyebrow">확장성</span>
          <p class="muted">MVP는 polling 기반으로 단순하게 시작하고, 이후 SSE나 WebSocket으로 실시간성을 높일 수 있습니다.</p>
        </article>
      </div>
    </section>
  `;
}

function renderRequestPage() {
  const sample = DEMO_SAMPLES[Math.floor(Math.random() * DEMO_SAMPLES.length)];
  return `
    <section class="panel form-panel">
      <span class="eyebrow">반품 신청</span>
      <h1 class="form-title">반품 요청을 접수합니다.</h1>
      <p class="lead">필수 입력은 두 가지뿐입니다. 구체적으로 작성할수록 로봇 판정과 이후 확인이 쉬워집니다.</p>

      <form id="request-form" novalidate>
        <div class="field">
          <label class="label" for="object_name">반품 object 이름</label>
          <input
            class="input"
            id="object_name"
            name="object_name"
            maxlength="60"
            placeholder="${sample.object_name}"
          />
          <p class="field-hint">예: 무선 이어폰 케이스, 블루투스 키보드, 로봇 청소기 먼지통</p>
          <p class="field-error" data-error-for="object_name"></p>
        </div>

        <div class="field">
          <label class="label" for="return_reason">반품 사유</label>
          <textarea
            class="textarea"
            id="return_reason"
            name="return_reason"
            maxlength="500"
            placeholder="${sample.return_reason}"
          ></textarea>
          <p class="field-hint">최소 10자 이상 입력해 주세요. 증상이나 상태를 구체적으로 적으면 자동 판정 정확도가 높아집니다.</p>
          <p class="field-error" data-error-for="return_reason"></p>
        </div>

        <div class="button-row">
          <button class="button" type="submit">반품 접수 제출</button>
          <a class="ghost-button" href="/status" data-link>요청 상태 확인</a>
        </div>
      </form>

      <p class="footer-note">데모 모드에서는 제출 후 mock 상태가 시간에 따라 자동으로 전이됩니다.</p>
    </section>
  `;
}

function renderReceiptPage(requestId) {
  const record = mockApi.getReturn(requestId);
  if (!record) {
    return renderMissingRequestPanel(requestId);
  }

  return `
    <section class="panel receipt-panel stack">
      <div>
        <span class="eyebrow">접수 완료</span>
        <h1 class="receipt-title">반품 요청이 정상 접수되었습니다.</h1>
        <p class="lead">아래 요청 ID로 현재 상태를 확인할 수 있습니다. 이 데모에서는 일정 시간마다 상태가 자동 갱신됩니다.</p>
      </div>

      <div class="metric-grid">
        <div class="metric">
          <span>Request ID</span>
          <strong class="request-id">${escapeHtml(record.request_id)}</strong>
        </div>
        <div class="metric">
          <span>Object</span>
          <strong>${escapeHtml(record.object_name)}</strong>
        </div>
        <div class="metric">
          <span>현재 상태</span>
          <strong>${STATUS_META[record.status].label}</strong>
        </div>
      </div>

      <div class="button-row">
        <a class="button" href="/status/${record.request_id}" data-link>상태 바로 확인</a>
        <a class="ghost-button" href="/request" data-link>새 반품 접수</a>
      </div>
    </section>
  `;
}

function renderStatusLookupPage(errorMessage = "") {
  return `
    <section class="panel lookup-panel stack">
      <div>
        <span class="eyebrow">상태 확인</span>
        <h1 class="status-title">요청 ID로 현재 상태를 조회합니다.</h1>
        <p class="lead">접수 완료 화면에서 받은 요청 ID를 입력하면 로봇 판정 상태와 최종 결과를 확인할 수 있습니다.</p>
      </div>

      <form id="lookup-form" class="search-form" novalidate>
        <input class="search-input" name="request_id" placeholder="예: RET-20260321-8F2A1" />
        <button class="button" type="submit">상태 조회</button>
      </form>

      ${errorMessage ? `<p class="field-error">${escapeHtml(errorMessage)}</p>` : ""}

      <div class="chips">
        <span>접수됨</span>
        <span>ROS 전달 완료</span>
        <span>로봇 판정 진행중</span>
        <span>추가 확인 필요</span>
        <span>승인</span>
        <span>반려</span>
        <span>오류 발생</span>
      </div>
    </section>
  `;
}

function renderStatusDetailPage(requestId) {
  const record = mockApi.getReturn(requestId);
  if (!record) {
    app.innerHTML = renderMissingRequestPanel(requestId);
    return;
  }

  const shouldPoll = !FINAL_STATUSES.has(record.status);
  app.innerHTML = `
    <section class="stack">
      <div class="status-layout">
        <div class="panel status-board stack">
          <div>
            <span class="eyebrow">상태 상세</span>
            <h1 class="status-title">현재 반품 요청 상태</h1>
          </div>

          <div class="status-meta">
            <span class="${STATUS_META[record.status].badgeClass}">${STATUS_META[record.status].label}</span>
            <span class="request-id">${escapeHtml(record.request_id)}</span>
          </div>

          <p class="status-copy">${escapeHtml(getStatusSummary(record))}</p>
          ${renderStepper(record)}

          <div class="metric-grid">
            <div class="metric">
              <span>Object</span>
              <strong>${escapeHtml(record.object_name)}</strong>
            </div>
            <div class="metric">
              <span>Robot Status</span>
              <strong>${escapeHtml(record.robot_status || "-")}</strong>
            </div>
            <div class="metric">
              <span>최종 판정</span>
              <strong>${escapeHtml(record.final_decision || "판정 대기")}</strong>
            </div>
          </div>
        </div>

        <aside class="stack">
          ${renderDecisionCard(record)}
          <section class="panel message-panel">
            <span class="eyebrow">안내</span>
            <p class="muted">${escapeHtml(getUserGuidance(record))}</p>
            ${shouldPoll ? '<p class="notice">3초 간격으로 상태를 다시 확인하고 있습니다.</p>' : ""}
          </section>
        </aside>
      </div>

      <section class="panel timeline">
        <span class="eyebrow">이력</span>
        <h2>상태 변경 히스토리</h2>
        ${renderTimeline(record.history)}
      </section>
    </section>
  `;

  if (shouldPoll) {
    statusPollTimer = window.setInterval(() => {
      renderStatusDetailPage(requestId);
    }, POLL_INTERVAL);
  }
}

function renderDecisionCard(record) {
  if (!FINAL_STATUSES.has(record.status)) {
    return `
      <section class="panel decision-card">
        <span class="eyebrow">판정 결과</span>
        <p class="muted">아직 최종 판정 전입니다. 진행 상태가 갱신되면 이 영역에 결과가 표시됩니다.</p>
      </section>
    `;
  }

  const variant =
    record.status === "APPROVED"
      ? "approved"
      : record.status === "REJECTED"
        ? "rejected"
        : record.status === "NEEDS_REVIEW"
          ? "review"
          : "error";

  return `
    <section class="panel decision-card ${variant}">
      <span class="eyebrow">최종 결과</span>
      <h2>${escapeHtml(STATUS_META[record.status].label)}</h2>
      <p class="decision-reason">${escapeHtml(record.decision_reason || STATUS_META[record.status].message)}</p>
      ${record.judge_note ? `<p class="muted">참고: ${escapeHtml(record.judge_note)}</p>` : ""}
      ${typeof record.confidence === "number" ? `<p class="muted">confidence: ${(record.confidence * 100).toFixed(0)}%</p>` : ""}
      ${record.error_code ? `<p class="muted">error_code: ${escapeHtml(record.error_code)}</p>` : ""}
    </section>
  `;
}

function renderTimeline(history) {
  return `
    <ol class="timeline-list">
      ${history
        .map(
          (item) => `
            <li class="timeline-item">
              <div class="timeline-time">${formatTime(item.created_at)}</div>
              <div>
                <span class="${STATUS_META[item.status]?.badgeClass || "badge"}">${escapeHtml(
                  STATUS_META[item.status]?.label || item.status,
                )}</span>
                <p class="timeline-copy">${escapeHtml(item.message)}</p>
              </div>
            </li>
          `,
        )
        .join("")}
    </ol>
  `;
}

function renderStepper(record) {
  const currentIndex = getCurrentStepIndex(record.status);
  return `
    <div class="stepper">
      ${STEPS.map((step, index) => {
        const finalReached = FINAL_STATUSES.has(record.status) && step.id === "FINAL";
        const isActive = index === currentIndex || finalReached;
        const isComplete = index < currentIndex || finalReached;
        const className = ["step", isActive ? "active" : "", isComplete ? "complete" : ""].join(" ").trim();
        const label =
          step.id === "FINAL" && FINAL_STATUSES.has(record.status)
            ? STATUS_META[record.status].label
            : step.label;
        return `
          <div class="${className}">
            <small>STEP ${index + 1}</small>
            <strong>${escapeHtml(label)}</strong>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderMissingRequestPanel(requestId) {
  return `
    <section class="panel lookup-panel stack">
      <span class="eyebrow">조회 실패</span>
      <h1 class="status-title">요청 정보를 찾을 수 없습니다.</h1>
      <p class="lead">입력한 요청 ID를 다시 확인해 주세요. 데모 모드에서는 브라우저에 저장된 요청만 조회할 수 있습니다.</p>
      ${requestId ? `<p class="request-id">${escapeHtml(requestId)}</p>` : ""}
      <div class="button-row">
        <a class="button" href="/status" data-link>다시 조회</a>
        <a class="ghost-button" href="/request" data-link>반품 접수하기</a>
      </div>
    </section>
  `;
}

function renderNotFoundPage() {
  return `
    <section class="panel lookup-panel stack">
      <span class="eyebrow">404</span>
      <h1 class="status-title">페이지를 찾을 수 없습니다.</h1>
      <div class="button-row">
        <a class="button" href="/" data-link>홈으로 이동</a>
      </div>
    </section>
  `;
}

function bindRequestForm() {
  const form = document.getElementById("request-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    clearFormErrors();

    const formData = new FormData(form);
    const payload = {
      object_name: String(formData.get("object_name") || ""),
      return_reason: String(formData.get("return_reason") || ""),
    };

    const errors = validateRequestPayload(payload);
    if (errors.object_name) showFieldError("object_name", errors.object_name);
    if (errors.return_reason) showFieldError("return_reason", errors.return_reason);
    if (Object.keys(errors).length > 0) return;

    const created = mockApi.createReturn(payload);
    navigate(`/receipt/${created.request_id}`);
  });
}

function bindLookupForm() {
  const form = document.getElementById("lookup-form");
  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const requestId = String(formData.get("request_id") || "").trim();

    if (!requestId) {
      app.innerHTML = renderStatusLookupPage("요청 ID를 입력해 주세요.");
      bindLookupForm();
      return;
    }

    navigate(`/status/${encodeURIComponent(requestId)}`);
  });
}

function validateRequestPayload(payload) {
  const errors = {};
  const objectName = payload.object_name.trim();
  const reason = payload.return_reason.trim();

  if (!objectName) {
    errors.object_name = "object 이름을 입력해 주세요.";
  } else if (objectName.length < 2) {
    errors.object_name = "object 이름은 2자 이상이어야 합니다.";
  }

  if (!reason) {
    errors.return_reason = "반품 사유를 입력해 주세요.";
  } else if (reason.length < 10) {
    errors.return_reason = "반품 사유는 최소 10자 이상 입력해 주세요.";
  } else if (isTooVague(reason)) {
    errors.return_reason = "사유가 너무 짧거나 모호합니다. 증상이나 상태를 조금 더 구체적으로 적어 주세요.";
  }

  return errors;
}

function isTooVague(text) {
  const normalized = text.replace(/\s+/g, "");
  const vagueTerms = ["이상함", "문제있음", "문제", "반품", "그냥", "불량"];
  return normalized.length < 14 || vagueTerms.includes(normalized);
}

function showFieldError(fieldName, message) {
  const node = document.querySelector(`[data-error-for="${fieldName}"]`);
  if (node) node.textContent = message;
}

function clearFormErrors() {
  document.querySelectorAll("[data-error-for]").forEach((node) => {
    node.textContent = "";
  });
}

function getStatusSummary(record) {
  if (record.status === "ROBOT_JUDGING" && record.judge_note) return record.judge_note;
  if (record.status === "NEEDS_REVIEW") return "추가 사진 확인 또는 운영자 검수가 필요할 수 있습니다.";
  return record.decision_reason || STATUS_META[record.status].message;
}

function getUserGuidance(record) {
  switch (record.status) {
    case "RECEIVED":
      return "현재 접수만 완료된 상태입니다. 잠시 후 ROS 전달 여부가 갱신됩니다.";
    case "ROS_DISPATCHED":
      return "로봇 시스템 큐에 등록되었습니다. 장비가 검수 작업을 시작하면 판정 진행중 상태로 바뀝니다.";
    case "ROBOT_JUDGING":
      return "판정이 진행되는 동안 페이지를 열어 두면 상태가 자동으로 갱신됩니다.";
    case "NEEDS_REVIEW":
      return "자동 판정만으로는 확정이 어려워 추가 확인이 필요합니다. 향후 운영 검수 단계가 연결되도록 설계되어 있습니다.";
    case "APPROVED":
      return "승인된 요청입니다. 이후 환불 또는 회수 절차는 운영 정책에 따라 연결될 수 있습니다.";
    case "REJECTED":
      return "반려 사유를 확인해 주세요. 추후 이의 제기나 수동 검수 단계가 필요하다면 같은 이력 모델로 연결할 수 있습니다.";
    case "ERROR":
      return "처리 중 오류가 발생했습니다. 운영 환경에서는 재시도 또는 사람 검수로 넘기는 fallback 정책이 필요합니다.";
    default:
      return "상태 정보를 확인 중입니다.";
  }
}

function getCurrentStepIndex(status) {
  switch (status) {
    case "RECEIVED":
      return 0;
    case "ROS_DISPATCHED":
      return 1;
    case "ROBOT_JUDGING":
      return 2;
    default:
      return 3;
  }
}

function ensureDemoSeed() {
  const records = loadRecords();
  if (records.length > 0) return records[0].request_id;

  const seed = mockApi.createReturn({
    object_name: "무선 이어폰 케이스",
    return_reason: "충전이 되지 않고 LED가 깜빡이지 않습니다.",
  });
  return seed.request_id;
}

const mockApi = {
  createReturn(payload) {
    const now = new Date().toISOString();
    const requestId = generateRequestId();
    const scenario = pickScenario(payload);
    const record = {
      request_id: requestId,
      object_name: payload.object_name.trim(),
      return_reason: payload.return_reason.trim(),
      status: "RECEIVED",
      robot_status: "PENDING",
      final_decision: null,
      decision_reason: null,
      judge_note: "반품 요청이 생성되어 처리 대기 중입니다.",
      confidence: null,
      error_code: null,
      created_at: now,
      updated_at: now,
      completed_at: null,
      scenario,
      history: [
        {
          status: "RECEIVED",
          message: STATUS_META.RECEIVED.message,
          created_at: now,
        },
      ],
    };

    saveRecords([record, ...loadRecords()]);
    return computeStatus(record);
  },

  getReturn(requestId) {
    const records = loadRecords();
    const index = records.findIndex((item) => item.request_id === requestId);
    if (index === -1) return null;

    const computed = computeStatus(records[index]);
    records[index] = computed;
    saveRecords(records);
    return computed;
  },
};

function computeStatus(record) {
  const elapsed = Date.now() - new Date(record.created_at).getTime();
  const next = {
    ...record,
    history: [...record.history],
  };

  const transitions = [
    { after: 0, status: "RECEIVED", robot_status: "PENDING", message: STATUS_META.RECEIVED.message },
    {
      after: 5000,
      status: "ROS_DISPATCHED",
      robot_status: "QUEUED",
      message: STATUS_META.ROS_DISPATCHED.message,
      judge_note: "ROS 브리지에서 작업 큐 등록을 완료했습니다.",
    },
    {
      after: 10000,
      status: "ROBOT_JUDGING",
      robot_status: "INSPECTING",
      message: STATUS_META.ROBOT_JUDGING.message,
      judge_note: "외관 확인, 센서 정렬, 기본 응답 테스트를 수행 중입니다.",
    },
    buildFinalTransition(record.scenario),
  ];

  transitions.forEach((transition) => {
    if (elapsed >= transition.after) applyTransition(next, transition);
  });

  return next;
}

function buildFinalTransition(scenario) {
  if (scenario === "approved") {
    return {
      after: 17000,
      status: "APPROVED",
      robot_status: "COMPLETED",
      final_decision: "APPROVED",
      confidence: 0.93,
      decision_reason: "불량 증상이 확인되어 반품이 승인되었습니다.",
      judge_note: "충전 불량과 외관 이상이 재현되었습니다.",
      message: STATUS_META.APPROVED.message,
    };
  }

  if (scenario === "rejected") {
    return {
      after: 17000,
      status: "REJECTED",
      robot_status: "COMPLETED",
      final_decision: "REJECTED",
      confidence: 0.87,
      decision_reason: "자동 점검 결과 정상 범위로 확인되어 반품이 반려되었습니다.",
      judge_note: "기본 테스트에서 이상 징후가 검출되지 않았습니다.",
      message: STATUS_META.REJECTED.message,
    };
  }

  if (scenario === "review") {
    return {
      after: 17000,
      status: "NEEDS_REVIEW",
      robot_status: "UNCERTAIN",
      final_decision: "NEEDS_REVIEW",
      confidence: 0.48,
      decision_reason: "판정 근거가 충분하지 않아 추가 확인이 필요합니다.",
      judge_note: "증상 설명과 센서 결과가 일치하지 않아 운영자 검수가 필요합니다.",
      message: STATUS_META.NEEDS_REVIEW.message,
    };
  }

  return {
    after: 17000,
    status: "ERROR",
    robot_status: "FAILED",
    final_decision: null,
    confidence: null,
    error_code: "ROS_TIMEOUT",
    decision_reason: "자동 검수 연결에 문제가 발생했습니다. 잠시 후 다시 확인해 주세요.",
    judge_note: "ROS 응답 제한 시간을 초과했습니다.",
    message: STATUS_META.ERROR.message,
  };
}

function applyTransition(record, transition) {
  if (record.status === transition.status) return;

  record.status = transition.status;
  record.robot_status = transition.robot_status ?? record.robot_status;
  record.final_decision = transition.final_decision ?? record.final_decision;
  record.decision_reason = transition.decision_reason ?? record.decision_reason;
  record.judge_note = transition.judge_note ?? record.judge_note;
  record.confidence = transition.confidence ?? record.confidence;
  record.error_code = transition.error_code ?? record.error_code;
  record.updated_at = new Date().toISOString();

  if (FINAL_STATUSES.has(transition.status)) {
    record.completed_at = record.updated_at;
  }

  const alreadyLogged = record.history.some((item) => item.status === transition.status);
  if (!alreadyLogged) {
    record.history.push({
      status: transition.status,
      message: transition.message,
      created_at: record.updated_at,
    });
  }
}

function pickScenario(payload) {
  const text = `${payload.object_name} ${payload.return_reason}`.toLowerCase();
  if (/(파손|균열|고장|충전|불량|전원)/.test(text)) return "approved";
  if (/(정상|단순변심|색상|생각보다|오배송아님)/.test(text)) return "rejected";
  if (/(모르겠|가끔|애매|간헐|확인필요)/.test(text)) return "review";
  if (/(오류테스트|timeout|실패데모)/.test(text)) return "error";

  const total = Array.from(text).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return ["approved", "rejected", "review"][total % 3];
}

function loadRecords() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveRecords(records) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function generateRequestId() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const token = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `RET-${y}${m}${d}-${token}`;
}

function clearStatusPolling() {
  if (statusPollTimer) {
    window.clearInterval(statusPollTimer);
    statusPollTimer = null;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTime(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}
