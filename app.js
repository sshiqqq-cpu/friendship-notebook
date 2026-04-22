const STORAGE_KEY = "relationship-notebook-v1";
const OWNER_KEY = "relationship-notebook-owner";

const initialState = {
  friends: [],
  events: []
};

let ownerName = localStorage.getItem(OWNER_KEY) || "";

const state = loadState();

const friendForm = document.querySelector("#friendForm");
const eventForm = document.querySelector("#eventForm");
const friendList = document.querySelector("#friendList");
const timeline = document.querySelector("#timeline");
const eventFriendSelect = document.querySelector("#eventFriendSelect");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const clearDataButton = document.querySelector("#clearDataButton");
const exportDataButton = document.querySelector("#exportDataButton");
const importDataButton = document.querySelector("#importDataButton");
const importFileInput = document.querySelector("#importFileInput");
const seedDataButton = document.querySelector("#seedDataButton");
const ownerNameDisplay = document.querySelector("#ownerNameDisplay");
const editOwnerButton = document.querySelector("#editOwnerButton");
const ownerDialog = document.querySelector("#ownerDialog");
const ownerDialogTitle = document.querySelector("#ownerDialogTitle");
const ownerDialogDesc = document.querySelector("#ownerDialogDesc");
const ownerForm = document.querySelector("#ownerForm");
const ownerNameInput = document.querySelector("#ownerNameInput");
const ownerCancelButton = document.querySelector("#ownerCancelButton");
const relationshipGraph = document.querySelector("#relationshipGraph");
const graphInsight = document.querySelector("#graphInsight");

const friendCount = document.querySelector("#friendCount");
const eventCount = document.querySelector("#eventCount");
const watchCount = document.querySelector("#watchCount");

document.addEventListener("DOMContentLoaded", () => {
  eventForm.date.value = new Date().toISOString().slice(0, 10);
  bindEvents();
  bindOwnerDialog();
  if (!ownerName) {
    openOwnerDialog(true);
  }
  render();
});

function bindOwnerDialog() {
  editOwnerButton.addEventListener("click", () => openOwnerDialog(false));
  ownerCancelButton.addEventListener("click", () => closeOwnerDialog());
  ownerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = ownerNameInput.value.trim();
    if (!value) return;
    ownerName = value;
    localStorage.setItem(OWNER_KEY, ownerName);
    closeOwnerDialog();
    render();
  });
}

function openOwnerDialog(isFirstTime) {
  ownerNameInput.value = ownerName;
  ownerDialogTitle.textContent = isFirstTime ? "이름을 알려주세요" : "이름 수정";
  ownerDialogDesc.textContent = isFirstTime
    ? "관계도 가운데와 안내 문구에 이 이름이 표시됩니다. 언제든 수정할 수 있습니다."
    : "새 이름을 입력하면 즉시 반영됩니다.";
  ownerCancelButton.hidden = isFirstTime;
  ownerDialog.hidden = false;
  setTimeout(() => ownerNameInput.focus(), 50);
}

function closeOwnerDialog() {
  ownerDialog.hidden = true;
}

function bindEvents() {
  friendForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(friendForm);
    const friend = {
      id: crypto.randomUUID(),
      name: formData.get("name").toString().trim(),
      group: formData.get("group").toString().trim(),
      status: formData.get("status").toString(),
      tags: splitTags(formData.get("tags").toString()),
      note: formData.get("note").toString().trim(),
      createdAt: new Date().toISOString()
    };

    if (!friend.name) {
      return;
    }

    state.friends.unshift(friend);
    persistAndRender();
    friendForm.reset();
  });

  eventForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const formData = new FormData(eventForm);
    const friendId = formData.get("friendId").toString();
    const friend = state.friends.find((item) => item.id === friendId);

    if (!friend) {
      alert("먼저 친구를 등록해 주세요.");
      return;
    }

    state.events.unshift({
      id: crypto.randomUUID(),
      friendId,
      friendName: friend.name,
      date: formData.get("date").toString(),
      type: formData.get("type").toString(),
      detail: formData.get("detail").toString().trim(),
      createdAt: new Date().toISOString()
    });

    persistAndRender();
    eventForm.reset();
    eventForm.date.value = new Date().toISOString().slice(0, 10);
    eventFriendSelect.value = friendId;
  });

  searchInput.addEventListener("input", renderFriendList);
  statusFilter.addEventListener("change", renderFriendList);

  clearDataButton.addEventListener("click", () => {
    const confirmed = window.confirm("정말 모든 데이터를 초기화할까요? 이 브라우저에 저장된 기록이 모두 삭제됩니다.");
    if (!confirmed) {
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
    state.friends = [];
    state.events = [];
    render();
  });

  exportDataButton.addEventListener("click", () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      friends: state.friends,
      events: state.events
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `교우관계노트-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  seedDataButton.addEventListener("click", () => {
    const confirmed = window.confirm("샘플 데이터를 채워 넣을까요? 현재 친구 목록과 기록이 모두 교체됩니다.");
    if (!confirmed) return;
    const seeded = buildSeedData();
    state.friends = seeded.friends;
    state.events = seeded.events;
    persistAndRender();
  });

  importDataButton.addEventListener("click", () => importFileInput.click());

  importFileInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const friends = Array.isArray(parsed.friends) ? parsed.friends : null;
      const events = Array.isArray(parsed.events) ? parsed.events : null;

      if (!friends || !events) {
        alert("올바른 백업 파일이 아닙니다.");
        return;
      }

      const mode = window.confirm("확인: 기존 데이터에 합치기\n취소: 기존 데이터를 대체");

      if (mode) {
        const existingFriendIds = new Set(state.friends.map((f) => f.id));
        const existingEventIds = new Set(state.events.map((e) => e.id));
        state.friends = state.friends.concat(friends.filter((f) => !existingFriendIds.has(f.id)));
        state.events = state.events.concat(events.filter((e) => !existingEventIds.has(e.id)));
      } else {
        state.friends = friends;
        state.events = events;
      }

      persistAndRender();
      alert("불러오기가 완료되었습니다.");
    } catch {
      alert("파일을 읽는 중 문제가 발생했습니다.");
    } finally {
      importFileInput.value = "";
    }
  });
}

function render() {
  renderOwner();
  renderMetrics();
  renderFriendOptions();
  renderRelationshipGraph();
  renderFriendList();
  renderTimeline();
}

function renderOwner() {
  ownerNameDisplay.textContent = ownerName || "우리 아이";
}

function renderMetrics() {
  friendCount.textContent = `${state.friends.length}명`;
  eventCount.textContent = `${state.events.length}건`;
  watchCount.textContent = `${state.events.filter((item) => item.type === "concern").length}건`;
}

function renderFriendOptions() {
  if (state.friends.length === 0) {
    eventFriendSelect.innerHTML = '<option value="">등록된 친구가 없습니다</option>';
    eventFriendSelect.disabled = true;
    return;
  }

  eventFriendSelect.disabled = false;
  eventFriendSelect.innerHTML = state.friends
    .map((friend) => `<option value="${friend.id}">${escapeHtml(friend.name)}</option>`)
    .join("");
}

function renderFriendList() {
  const keyword = searchInput.value.trim().toLowerCase();
  const selectedStatus = statusFilter.value;

  const filtered = state.friends.filter((friend) => {
    const matchesKeyword =
      !keyword ||
      friend.name.toLowerCase().includes(keyword) ||
      friend.tags.join(" ").toLowerCase().includes(keyword) ||
      friend.note.toLowerCase().includes(keyword);

    const matchesStatus = selectedStatus === "all" || friend.status === selectedStatus;
    return matchesKeyword && matchesStatus;
  });

  if (filtered.length === 0) {
    friendList.className = "friend-list empty-state";
    friendList.textContent = "조건에 맞는 친구 정보가 없습니다.";
    return;
  }

  friendList.className = "friend-list";
  friendList.innerHTML = "";

  const template = document.querySelector("#friendCardTemplate");

  filtered.forEach((friend) => {
    const card = template.content.firstElementChild.cloneNode(true);
    const lastEvent = state.events.find((item) => item.friendId === friend.id);

    card.querySelector(".friend-name").textContent = friend.name;
    card.querySelector(".friend-group").textContent = friend.group || "반/학년 정보 없음";
    card.querySelector(".status-badge").textContent = friend.status;
    card.querySelector(".friend-note").textContent = friend.note || "메모가 아직 없습니다.";
    card.querySelector(".friend-tags").textContent = friend.tags.length > 0
      ? `태그: ${friend.tags.join(", ")}`
      : "태그 없음";
    card.querySelector(".friend-meta").textContent = lastEvent
      ? `최근 기록: ${lastEvent.date} / ${typeLabel(lastEvent.type)}`
      : "아직 상호작용 기록이 없습니다.";

    const statusSelect = card.querySelector(".friend-status-select");
    statusSelect.value = friend.status;
    statusSelect.addEventListener("change", (event) => {
      friend.status = event.target.value;
      persistAndRender();
    });

    card.querySelector(".delete-friend").addEventListener("click", () => {
      const confirmed = window.confirm(`${friend.name} 정보를 삭제할까요? 연결된 기록도 함께 삭제됩니다.`);
      if (!confirmed) {
        return;
      }

      state.friends = state.friends.filter((item) => item.id !== friend.id);
      state.events = state.events.filter((item) => item.friendId !== friend.id);
      persistAndRender();
    });

    friendList.appendChild(card);
  });
}

function renderTimeline() {
  if (state.events.length === 0) {
    timeline.className = "timeline empty-state";
    timeline.textContent = "아직 기록이 없습니다.";
    return;
  }

  timeline.className = "timeline";
  timeline.innerHTML = "";

  const template = document.querySelector("#timelineItemTemplate");

  [...state.events]
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))
    .forEach((item) => {
      const entry = template.content.firstElementChild.cloneNode(true);
      entry.querySelector(".timeline-friend").textContent = item.friendName;
      entry.querySelector(".timeline-date").textContent = formatDate(item.date);
      entry.querySelector(".timeline-type").textContent = typeLabel(item.type);
      entry.querySelector(".timeline-detail").textContent = item.detail;
      timeline.appendChild(entry);
    });
}

function renderRelationshipGraph() {
  if (state.friends.length === 0) {
    relationshipGraph.className = "relationship-graph empty-state";
    relationshipGraph.textContent = "친구를 등록하면 관계도가 표시됩니다.";
    graphInsight.innerHTML = `
      <h3>관계도 읽는 법</h3>
      <p>친구 정보가 쌓이면 ${escapeHtml(ownerName || "우리 아이")}과 친구들의 거리감이 한 화면에 나타납니다.</p>
      <ul class="insight-list">
        <li>중심에 가까울수록 정서적 친밀도가 높은 상태입니다.</li>
        <li>걱정 기록이 누적되면 요약 카드에서 바로 확인할 수 있습니다.</li>
        <li>친구를 더 등록할수록 패턴이 또렷하게 보입니다.</li>
      </ul>
    `;
    return;
  }

  relationshipGraph.className = "relationship-graph";
  relationshipGraph.innerHTML = buildRelationshipSvg();
  renderGraphDefaultInsight();

  relationshipGraph.querySelectorAll("[data-friend-id]").forEach((node) => {
    node.addEventListener("click", () => {
      const friendId = node.getAttribute("data-friend-id");
      const friend = state.friends.find((item) => item.id === friendId);
      if (friend) {
        renderGraphInsight(friend);
      }
    });
  });
}

function buildRelationshipSvg() {
  const width = 960;
  const height = 580;
  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.min(width, height) * 0.35;

  const nodes = state.friends.map((friend, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(state.friends.length, 1) - Math.PI / 2;
    const distance = outerRadius * statusDistance(friend.status);
    const x = centerX + Math.cos(angle) * distance;
    const y = centerY + Math.sin(angle) * distance;
    const stats = friendEventStats(friend.id);
    const lineColor = statusColor(friend.status);
    const strokeWidth = 2 + Math.min(stats.total, 4);
    const concernMark = stats.concern > 0
      ? `<circle cx="${x + 28}" cy="${y - 24}" r="10" fill="#c54f4f"></circle><text x="${x + 28}" y="${y - 20}" text-anchor="middle" font-size="12" fill="#fff">${stats.concern}</text>`
      : "";

    return `
      <g class="friend-node" data-friend-id="${friend.id}" style="cursor:pointer">
        <line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="${lineColor}" stroke-opacity="0.55" stroke-width="${strokeWidth}" stroke-linecap="round"></line>
        <circle cx="${x}" cy="${y}" r="30" fill="white" stroke="${lineColor}" stroke-width="4"></circle>
        <text x="${x}" y="${y + 6}" text-anchor="middle" font-size="14" font-weight="700" fill="#2b211b">${escapeHtml(friend.name)}</text>
        ${concernMark}
      </g>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(ownerName || "우리 아이")}을 중심으로 한 친구 관계도">
      <defs>
        <radialGradient id="centerGlow" cx="50%" cy="50%" r="55%">
          <stop offset="0%" stop-color="#fffefc"></stop>
          <stop offset="100%" stop-color="#f6dcca"></stop>
        </radialGradient>
      </defs>
      <circle cx="${centerX}" cy="${centerY}" r="${outerRadius * 0.48}" fill="none" stroke="rgba(45, 138, 102, 0.22)" stroke-dasharray="6 10"></circle>
      <circle cx="${centerX}" cy="${centerY}" r="${outerRadius * 0.72}" fill="none" stroke="rgba(227, 169, 58, 0.22)" stroke-dasharray="6 10"></circle>
      <circle cx="${centerX}" cy="${centerY}" r="${outerRadius * 0.95}" fill="none" stroke="rgba(214, 120, 68, 0.22)" stroke-dasharray="6 10"></circle>
      <circle cx="${centerX}" cy="${centerY}" r="${outerRadius * 1.18}" fill="none" stroke="rgba(197, 79, 79, 0.28)" stroke-dasharray="4 8"></circle>
      ${nodes}
      <circle cx="${centerX}" cy="${centerY}" r="52" fill="url(#centerGlow)" stroke="#dd6f3f" stroke-width="5"></circle>
      <text x="${centerX}" y="${centerY + 6}" text-anchor="middle" font-size="22" font-weight="700" fill="#2b211b">${escapeHtml(ownerName || "우리 아이")}</text>
      <text x="${centerX}" y="${centerY + 28}" text-anchor="middle" font-size="13" fill="#6d5b4f">관계 중심</text>
    </svg>
  `;
}

function renderGraphDefaultInsight() {
  const concernFriends = state.friends.filter((friend) => friendEventStats(friend.id).concern > 0);
  const closestFriend = [...state.friends].sort((left, right) => statusDistance(left.status) - statusDistance(right.status))[0];

  graphInsight.innerHTML = `
    <h3>관계도 요약</h3>
    <p>현재 등록된 친구 ${state.friends.length}명의 관계 위치를 한 장에 모았습니다. 선이나 원을 누르면 친구별 요약이 열립니다.</p>
    <ul class="insight-list">
      <li>가장 가까운 관계로 표시된 친구: ${closestFriend ? escapeHtml(closestFriend.name) : "-"}</li>
      <li>걱정 기록이 있는 친구 수: ${concernFriends.length}명</li>
      <li>최근 기록 총합: ${state.events.length}건</li>
    </ul>
  `;
}

function renderGraphInsight(friend) {
  const stats = friendEventStats(friend.id);
  const latestEvent = state.events
    .filter((item) => item.friendId === friend.id)
    .sort((left, right) => right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt))[0];

  graphInsight.innerHTML = `
    <h3>${escapeHtml(friend.name)} 요약</h3>
    <p>${friend.group || "반/학년 정보 없음"} · 현재 상태는 ${friend.status}로 기록되어 있습니다.</p>
    <div class="insight-chip-row">
      <span class="insight-chip">총 기록 ${stats.total}건</span>
      <span class="insight-chip">좋았던 일 ${stats.positive}건</span>
      <span class="insight-chip">걱정 기록 ${stats.concern}건</span>
    </div>
    <div class="insight-focus">
      <strong>부모 메모</strong>
      <p>${escapeHtml(friend.note || "아직 메모가 없습니다.")}</p>
    </div>
    <div class="insight-focus">
      <strong>최근 상황</strong>
      <p>${latestEvent ? `${formatDate(latestEvent.date)} · ${typeLabel(latestEvent.type)} · ${escapeHtml(latestEvent.detail)}` : "아직 상호작용 기록이 없습니다."}</p>
    </div>
  `;
}

function friendEventStats(friendId) {
  return state.events.reduce((stats, event) => {
    if (event.friendId !== friendId) {
      return stats;
    }

    stats.total += 1;

    if (event.type === "positive") {
      stats.positive += 1;
    } else if (event.type === "concern") {
      stats.concern += 1;
    } else {
      stats.neutral += 1;
    }

    return stats;
  }, { total: 0, positive: 0, neutral: 0, concern: 0 });
}

function statusDistance(status) {
  if (status === "가깝다") {
    return 0.48;
  }

  if (status === "무난하다") {
    return 0.72;
  }

  if (status === "조금 거리감") {
    return 0.95;
  }

  return 1.18;
}

function statusColor(status) {
  if (status === "가깝다") {
    return "#2d8a66";
  }

  if (status === "무난하다") {
    return "#e3a93a";
  }

  if (status === "조금 거리감") {
    return "#d67844";
  }

  return "#c54f4f";
}

function persistAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    return structuredClone(initialState);
  }

  try {
    const parsed = JSON.parse(saved);
    return {
      friends: Array.isArray(parsed.friends) ? parsed.friends : [],
      events: Array.isArray(parsed.events) ? parsed.events : []
    };
  } catch {
    return structuredClone(initialState);
  }
}

function splitTags(value) {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function formatDate(value) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function typeLabel(type) {
  if (type === "positive") {
    return "좋았던 일";
  }

  if (type === "concern") {
    return "걱정되는 일";
  }

  return "그냥 기록";
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildSeedData() {
  const today = new Date();
  const daysAgo = (n) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  };

  const friendSeeds = [
    { name: "고래", group: "3학년 2반", status: "가깝다", tags: ["같은 학원", "차분함"], note: "말수는 적지만 속 깊은 이야기를 가장 자주 나누는 친구." },
    { name: "사자", group: "3학년 2반", status: "가깝다", tags: ["리더형", "운동 좋아함"], note: "체육 시간마다 팀을 같이 짜는 단짝. 활동적인 편." },
    { name: "토끼", group: "3학년 1반", status: "무난하다", tags: ["같은 아파트"], note: "등하교를 종종 같이 함. 최근엔 만남이 줄었다." },
    { name: "여우", group: "3학년 2반", status: "무난하다", tags: ["미술 좋아함"], note: "그림 그리기 취향이 비슷해서 잘 맞음." },
    { name: "곰", group: "3학년 3반", status: "조금 거리감", tags: ["장난 많음"], note: "장난이 심해서 가끔 부담스러워한다고 말함." },
    { name: "너구리", group: "3학년 2반", status: "무난하다", tags: ["단톡방"], note: "단톡방에선 자주 이야기하지만 학교에선 어색한 사이." },
    { name: "펭귄", group: "3학년 2반", status: "가깝다", tags: ["짝꿍"], note: "올해 짝꿍. 쉬는 시간에 대부분 같이 보냄." },
    { name: "기린", group: "3학년 1반", status: "조금 거리감", tags: ["운동부"], note: "같은 반이 아니라 자주 못 본다고 함." },
    { name: "늑대", group: "3학년 2반", status: "주의 필요", tags: ["갈등 있음"], note: "최근 말다툼 이후 어색한 상태. 지켜보는 중." },
    { name: "판다", group: "3학년 4반", status: "가깝다", tags: ["같은 태권도장"], note: "학원에서 친해진 친구. 주말에 자주 놂." }
  ];

  const friends = friendSeeds.map((seed, idx) => ({
    id: crypto.randomUUID(),
    name: seed.name,
    group: seed.group,
    status: seed.status,
    tags: seed.tags,
    note: seed.note,
    createdAt: new Date(today.getTime() - (friendSeeds.length - idx) * 86400000).toISOString()
  }));

  const byName = Object.fromEntries(friends.map((f) => [f.name, f]));

  const eventSeeds = [
    { name: "고래", date: daysAgo(1), type: "positive", detail: "쉬는 시간에 비밀 이야기를 나눴다고 함. 기분이 좋아 보였다." },
    { name: "사자", date: daysAgo(2), type: "positive", detail: "체육 대회 팀을 같이 짜서 이겼다고 신나서 이야기함." },
    { name: "늑대", date: daysAgo(2), type: "concern", detail: "단톡방에서 사소한 오해로 말다툼. 오늘은 눈도 마주치지 않았다." },
    { name: "펭귄", date: daysAgo(3), type: "positive", detail: "짝꿍과 점심 반찬 바꿔 먹으며 웃었다고 함." },
    { name: "토끼", date: daysAgo(5), type: "neutral", detail: "등교길에 마주쳤지만 예전만큼 오래 이야기하진 않았다." },
    { name: "곰", date: daysAgo(6), type: "concern", detail: "필통을 던지는 장난에 기분이 상했다고 말함." },
    { name: "여우", date: daysAgo(7), type: "positive", detail: "미술 시간 함께 작품 만들기. 집에 와서도 자랑함." },
    { name: "판다", date: daysAgo(8), type: "positive", detail: "태권도 끝나고 분식집에서 떡볶이 먹음." },
    { name: "기린", date: daysAgo(10), type: "neutral", detail: "복도에서 인사만 하고 지나쳤다고 함." },
    { name: "너구리", date: daysAgo(12), type: "neutral", detail: "단톡방에서 게임 이야기. 직접 본 건 아님." },
    { name: "늑대", date: daysAgo(14), type: "concern", detail: "조별 활동에서 역할 분담으로 서로 불편해함." },
    { name: "고래", date: daysAgo(15), type: "positive", detail: "도서관에서 같이 책 읽는 시간이 늘었다고 함." }
  ];

  const events = eventSeeds.map((seed) => {
    const friend = byName[seed.name];
    return {
      id: crypto.randomUUID(),
      friendId: friend.id,
      friendName: friend.name,
      date: seed.date,
      type: seed.type,
      detail: seed.detail,
      createdAt: new Date(seed.date + "T12:00:00Z").toISOString()
    };
  });

  return { friends, events };
}
